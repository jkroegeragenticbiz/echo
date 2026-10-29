import { describe, expect, it } from "vitest";
import { analyze, runPipeline } from "../src/server/pipeline";
import { FixtureEmbedder, FixtureProvider } from "../src/server/providers/fixture";
import { contentHash } from "../src/server/content";
import { fakeFetch, fakeLookup, fixture, llmFixture } from "./helpers";

describe("runPipeline", () => {
  it("ingests, classifies, rewrites and embeds a LinkedIn post end to end", async () => {
    const { fetch } = fakeFetch({ "https://www.linkedin.com/": { body: fixture("http/linkedin-post.html") } });
    const llm = new FixtureProvider({ classify: [llmFixture("classify-career")], rewrite: [llmFixture("rewrite-sales")] });
    const result = await runPipeline(
      { url: "https://www.linkedin.com/posts/maya-okafor_cold-email-activity-1?trk=feed" },
      { llm, fetch, lookup: fakeLookup(), embedder: new FixtureEmbedder() },
      { name: "Sales", personas: ["sales_exec"], description: "", perspective: "first_person", tone: ["direct"], voice_sample: null },
    );
    expect(llm.calls.map((c) => c.task)).toEqual(["classify", "rewrite"]);
    expect(result.content.canonicalUrl).toBe("https://linkedin.com/posts/maya-okafor_cold-email-activity-1");
    expect(result.classification.structured.domain).toBe("career_sales");
    expect(result.rewrite?.action_steps).toHaveLength(3);
    expect(result.embedding).toHaveLength(1536);
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.classificationFallback).toBe(false);
  });

  it("files the save by keyword if the classifier call fails", async () => {
    const llm = new FixtureProvider({ classify: [new Error("overloaded")] });
    const analysis = await analyze(
      {
        platform: "manual",
        sourceUrl: null,
        canonicalUrl: null,
        externalId: null,
        author: null,
        verbatimText: "$TSLA bull case: deliveries beat, margins expand",
        mediaUrls: [],
        ocrText: null,
        transcript: null,
        needsMediaJob: false,
        via: "client",
      },
      { llm, embedder: null },
    );
    expect(analysis.classificationFallback).toBe(true);
    expect(analysis.classification.structured.domain).toBe("markets_thesis");
    expect(analysis.embedding).toBeNull();
  });
});

describe("contentHash", () => {
  it("matches reposts with different formatting and skips trivial text", () => {
    const a = contentHash({ verbatimText: "Make the first version so small it takes under 2 minutes!", ocrText: null });
    const b = contentHash({ verbatimText: "make the first version  so small it takes under 2 minutes", ocrText: null });
    expect(a).toBe(b);
    expect(contentHash({ verbatimText: "nice", ocrText: null })).toBeNull();
  });
});
