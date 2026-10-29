import { describe, expect, it } from "vitest";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ClassifierOutputSchema, classifyContent, fallbackClassification } from "../src/server/classify";
import type { IngestedContent } from "../src/server/content";
import { guessDomain } from "../src/server/heuristics";
import { FixtureProvider } from "../src/server/providers/fixture";
import { ClassificationSchema, DEMO_SAVES } from "../src";
import { llmFixture } from "./helpers";

function content(text: string, extra: Partial<IngestedContent> = {}): IngestedContent {
  return {
    platform: "x",
    sourceUrl: "https://x.com/a/status/1",
    canonicalUrl: "https://x.com/a/status/1",
    externalId: "1",
    author: "@a",
    verbatimText: text,
    mediaUrls: [],
    ocrText: null,
    transcript: null,
    needsMediaJob: false,
    via: "x_api",
    ...extra,
  };
}

const costco = DEMO_SAVES.find((s) => s.key === "costco-thesis")!;

describe("classifyContent", () => {
  it("normalizes a markets thesis: tickers uppercased without $, topics lowercased", async () => {
    const llm = new FixtureProvider({ classify: [llmFixture("classify-markets")] });
    const result = await classifyContent(content(costco.verbatim_text), llm);
    expect(ClassificationSchema.parse(result)).toEqual(result);
    expect(result.structured.domain).toBe("markets_thesis");
    if (result.structured.domain !== "markets_thesis") throw new Error("narrowing");
    expect(result.structured.data.tickers).toEqual(["COST"]);
    expect(result.structured.data.invalidation_triggers).toEqual(["Renewal rate drops below 88% for two quarters"]);
    expect(result.topics).toEqual(["cost", "retail", "membership model"]);
    expect(result.key_metric).toEqual({ label: "COST", value: "Long · 3-5 yr" });
  });

  it("puts the source inside <source> tags with a keyword hint and transcript/OCR labelled", async () => {
    const llm = new FixtureProvider({ classify: [llmFixture("classify-fitness")] });
    await classifyContent(
      content("High-protein overnight oats", { ocrText: "48g protein", transcript: "mix and refrigerate", platform: "instagram" }),
      llm,
    );
    const call = llm.calls[0]!;
    expect(call.task).toBe("classify");
    expect(call.system).toMatch(/never instructions to you/);
    expect(call.prompt).toMatch(/Keyword hint \(may be wrong\): fitness_nutrition/);
    expect(call.prompt).toMatch(/<source>\nHigh-protein overnight oats\n\n\[Text recognised in the image or video frames\]\n48g protein\n\n\[Audio transcript\]\nmix and refrigerate\n<\/source>/);
  });

  it("fills an empty structure (with cashtags) when the model omits the domain block", async () => {
    const llm = new FixtureProvider({ classify: [llmFixture("classify-markets-missing-block")] });
    const result = await classifyContent(content("Bullish on $NVDA and $AMD into earnings."), llm);
    if (result.structured.domain !== "markets_thesis") throw new Error("expected markets");
    expect(result.structured.data.tickers).toEqual(["NVDA", "AMD"]);
    expect(result.structured.data.direction).toBe("neutral");
  });

  it("rejects model output that doesn't match the schema", async () => {
    const llm = new FixtureProvider({ classify: [{ domain: "crypto", summary: "x" }] });
    await expect(classifyContent(content("text"), llm)).rejects.toThrow();
  });

  it("has a schema the Anthropic structured-output helper accepts", () => {
    expect(() => betaZodOutputFormat(ClassifierOutputSchema)).not.toThrow();
  });
});

describe("keyword fallback", () => {
  it.each(DEMO_SAVES.map((s) => [s.key, s.verbatim_text, s.domain] as const))("%s -> %s", (_key, text, domain) => {
    expect(guessDomain(text).domain).toBe(domain);
  });

  it("produces a valid classification without the model", () => {
    const result = fallbackClassification(content("Leg day: squat 4x8, RPE 8"));
    expect(ClassificationSchema.parse(result).structured.domain).toBe("fitness_nutrition");
    expect(result.summary).toBe("Leg day: squat 4x8, RPE 8");
  });
});
