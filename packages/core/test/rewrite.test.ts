import { describe, expect, it } from "vitest";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { DEMO_SAVES, type Classification } from "../src";
import type { IngestedContent } from "../src/server/content";
import { findUnsupportedFacts } from "../src/server/fact-guard";
import { FixtureProvider } from "../src/server/providers/fixture";
import { cleanRewrite, rewriteInVoice, UnsupportedFactsError, type VoiceInput } from "../src/server/rewrite";
import { llmFixture } from "./helpers";

const demo = DEMO_SAVES[0]!;
const content: IngestedContent = {
  platform: demo.platform,
  sourceUrl: demo.source_url,
  canonicalUrl: demo.source_url,
  externalId: null,
  author: demo.author,
  verbatimText: demo.verbatim_text,
  mediaUrls: [],
  ocrText: null,
  transcript: null,
  needsMediaJob: false,
  via: "opengraph",
};
const classification: Classification = {
  structured: demo.structured,
  summary: demo.summary,
  key_metric: demo.key_metric,
  topics: demo.topics,
};
const salesVoice: VoiceInput = {
  name: "Closer",
  personas: ["sales_exec", "creator"],
  description: "I run mid-market deals and post on LinkedIn on weekends.",
  perspective: "first_person",
  tone: ["direct", "concise"],
  voice_sample: "Short sentences. No fluff. I say what I'll do and then I do it.",
};

describe("rewriteInVoice", () => {
  it("builds the voice prompt from personas, perspective, tone and the voice sample", async () => {
    const llm = new FixtureProvider({ rewrite: [llmFixture("rewrite-sales")] });
    await rewriteInVoice(content, classification, salesVoice, llm);
    const { system, prompt, task } = llm.calls[0]!;
    expect(task).toBe("rewrite");
    expect(system).toMatch(/Never invent facts/);
    expect(prompt).toContain("Sales Executive (AE / GTM): Turns ideas into talk tracks");
    expect(prompt).toContain("Creator / Writer:");
    expect(prompt).toContain("In their own words: I run mid-market deals");
    expect(prompt).toMatch(/Perspective: First person/);
    expect(prompt).toContain("Tone: direct and plain-spoken; concise, no filler words");
    expect(prompt).toContain('"""\nShort sentences. No fluff.');
    expect(prompt).toContain("<source>\nStop asking");
    expect(prompt).toContain('"core_mechanism":"Open with a verifiable observation');
  });

  it("returns a cleaned rewrite: no trailing period, no list numbering", async () => {
    const llm = new FixtureProvider({ rewrite: [llmFixture("rewrite-sales")] });
    const rw = await rewriteInVoice(content, classification, salesVoice, llm);
    expect(rw.headline).toBe("Lead with their problem, not my calendar");
    expect(rw.action_steps[0]).toBe("Rewrite the first line of my top sequences to name a problem the prospect can verify.");
    expect(rw.action_steps).toHaveLength(3);
  });

  it("retries once with the invented facts named, then succeeds", async () => {
    const llm = new FixtureProvider({ rewrite: [llmFixture("rewrite-sales-invented"), llmFixture("rewrite-sales")] });
    const rw = await rewriteInVoice(content, classification, salesVoice, llm);
    expect(llm.calls).toHaveLength(2);
    expect(llm.calls[1]!.prompt).toContain('It mentioned "40", "$HUBS", which do not appear in the source.');
    expect(rw.headline).not.toContain("40%");
  });

  it("refuses to return a rewrite that keeps inventing facts", async () => {
    const invented = llmFixture("rewrite-sales-invented");
    const llm = new FixtureProvider({ rewrite: [invented, invented] });
    const err = await rewriteInVoice(content, classification, salesVoice, llm).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnsupportedFactsError);
    expect((err as UnsupportedFactsError).violations.map((v) => v.value)).toEqual(["40", "$HUBS"]);
  });

  it("uses coach and checklist perspectives when asked", async () => {
    const llm = new FixtureProvider({ rewrite: [llmFixture("rewrite-sales"), llmFixture("rewrite-sales")] });
    await rewriteInVoice(content, classification, { ...salesVoice, perspective: "coach", voice_sample: null }, llm);
    await rewriteInVoice(content, classification, { ...salesVoice, perspective: "checklist", tone: [] }, llm);
    expect(llm.calls[0]!.prompt).toMatch(/Perspective: Second person/);
    expect(llm.calls[0]!.prompt).not.toContain('"""');
    expect(llm.calls[1]!.prompt).toMatch(/Perspective: Terse and scannable/);
    expect(llm.calls[1]!.prompt).toContain("Tone: natural and clear");
  });
});

describe("cleanRewrite", () => {
  it("strips emojis and bullets and caps steps at 5", () => {
    const rw = cleanRewrite({
      headline: '"Ship it 🚀."',
      paraphrase: "Do the thing  now ✅",
      action_steps: ["- one", "• two", "3) three", "four", "five", "six"],
    });
    expect(rw).toEqual({ headline: "Ship it", paraphrase: "Do the thing now", action_steps: ["one", "two", "three", "four", "five"] });
  });

  it("rejects fewer than 3 action steps", () => {
    expect(() => cleanRewrite({ headline: "h", paraphrase: "p", action_steps: ["a", "  "] })).toThrow(/validation/);
  });
});

describe("fact guard", () => {
  it("accepts every hand-written demo rewrite (the seed data obeys the same rule)", () => {
    for (const save of DEMO_SAVES) {
      const basis = `${save.verbatim_text}\n${JSON.stringify(save.structured.data)}`;
      for (const [persona, rw] of Object.entries(save.rewrites)) {
        expect(findUnsupportedFacts(basis, rw!), `${save.key}/${persona}`).toEqual([]);
      }
    }
  });

  it("flags altered numbers and unknown tickers", () => {
    const source = "$COST renewal rate 90%+, ~50x earnings, 3-5 year horizon";
    const rw = { headline: "$COST at 50x", paraphrase: "Renewals at 91% and $WMT too", action_steps: ["a", "b", "c"] };
    expect(findUnsupportedFacts(source, rw)).toEqual([
      { kind: "number", value: "91" },
      { kind: "ticker", value: "$WMT" },
    ]);
  });

  it("treats 1,000 and 1000 as the same number", () => {
    expect(findUnsupportedFacts("Saved 1,000 dollars", { headline: "1000 saved", paraphrase: "p", action_steps: ["a", "b", "c"] })).toEqual([]);
  });

  it("rewrite output schema is accepted by the structured-output helper", () => {
    expect(() => betaZodOutputFormat(z.object({ headline: z.string(), paraphrase: z.string(), action_steps: z.array(z.string()) }))).not.toThrow();
  });
});
