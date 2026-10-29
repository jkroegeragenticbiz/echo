import { describe, expect, it } from "vitest";
import { FixtureProvider } from "../src/server/providers/fixture";
import { ingest, IngestError, XClient } from "../src/server/ingest";
import { fakeFetch, fakeLookup, fixture, llmFixture } from "./helpers";

const lookup = fakeLookup();
const noLlm = new FixtureProvider({});

describe("ingest: links", () => {
  it("reads a public LinkedIn post from OpenGraph and canonicalizes the URL", async () => {
    const { fetch } = fakeFetch({ "https://www.linkedin.com/posts/": { body: fixture("http/linkedin-post.html") } });
    const content = await ingest(
      { url: "https://www.linkedin.com/posts/maya-okafor_cold-email-activity-1/?utm_source=share&utm_medium=member_ios" },
      { llm: noLlm, fetch, lookup },
    );
    expect(content.platform).toBe("linkedin");
    expect(content.canonicalUrl).toBe("https://linkedin.com/posts/maya-okafor_cold-email-activity-1");
    expect(content.author).toBe("Maya Okafor");
    expect(content.verbatimText).toContain("reply rate went from 9% to 31% in 6 weeks");
    expect(content.verbatimText).toContain('Stop asking "Do you have 15 minutes this week?"');
    expect(content.via).toBe("opengraph");
    expect(content.mediaUrls).toEqual(["https://www.linkedin.com/dms/image/post.jpg"]);
  });

  it("extracts the caption and handle from an Instagram reel's og:description", async () => {
    const { fetch } = fakeFetch({ "https://www.instagram.com/reel/": { body: fixture("http/instagram-reel.html") } });
    const content = await ingest({ url: "https://www.instagram.com/reel/C7abc123XYZ/?igsh=abc" }, { llm: noLlm, fetch, lookup });
    expect(content.author).toBe("@proteinpantry");
    expect(content.verbatimText.startsWith("High-protein overnight oats, 5 min prep:")).toBe(true);
    expect(content.verbatimText).toContain("48g protein");
    expect(content.canonicalUrl).toBe("https://instagram.com/reel/C7abc123XYZ");
  });

  it("uses the readable article body for normal web pages", async () => {
    const { fetch } = fakeFetch({ "https://notebook.example/": { body: fixture("http/article.html") } });
    const content = await ingest({ url: "https://notebook.example/readme-first" }, { llm: noLlm, fetch, lookup });
    expect(content.platform).toBe("web");
    expect(content.verbatimText).toContain("design review time dropped from about two weeks to three days");
    expect(content.verbatimText).not.toContain("Home · Archive");
    expect(content.author).toBe("Systems Notebook");
  });

  it("prefers the text the user shared over fetched text", async () => {
    const { fetch, requests } = fakeFetch({ "https://www.linkedin.com/": { body: fixture("http/linkedin-post.html") } });
    const content = await ingest(
      { url: "https://www.linkedin.com/posts/x", text: "The full post the user copied, word for word." },
      { llm: noLlm, fetch, lookup },
    );
    expect(content.verbatimText).toBe("The full post the user copied, word for word.");
    expect(content.author).toBe("Maya Okafor");
    expect(content.via).toBe("client");
    expect(requests).toHaveLength(1);
  });

  it("treats shared text that is only the link as no text", async () => {
    const { fetch } = fakeFetch({ "https://www.linkedin.com/": { body: fixture("http/linkedin-post.html") } });
    const url = "https://www.linkedin.com/posts/x";
    const content = await ingest({ url, text: ` ${url} ` }, { llm: noLlm, fetch, lookup });
    expect(content.verbatimText).toContain("9% to 31%");
  });
});

describe("ingest: X", () => {
  it("falls back to the public oEmbed endpoint when X isn't connected", async () => {
    const { fetch, requests } = fakeFetch({
      "https://publish.twitter.com/oembed": { body: fixture("http/x-oembed.json"), contentType: "application/json" },
    });
    const content = await ingest(
      { url: "https://twitter.com/slowbuild/status/1800000000000000006?s=20" },
      { llm: noLlm, fetch, lookup },
    );
    expect(requests[0]!.url).toContain("url=https%3A%2F%2Ftwitter.com%2Fslowbuild");
    expect(content.platform).toBe("x");
    expect(content.canonicalUrl).toBe("https://x.com/slowbuild/status/1800000000000000006");
    expect(content.externalId).toBe("1800000000000000006");
    expect(content.author).toBe("@slowbuild");
    expect(content.verbatimText).toBe(
      'The habit advice that finally worked for me:\n\nMake the first version so small it takes under 2 minutes.\n\nNot "run 5k." Put on running shoes.',
    );
    expect(content.via).toBe("x_oembed");
  });

  it("unrolls a self-thread with the X API when connected", async () => {
    const api = fakeFetch({
      "https://api.x.com/2/tweets/1790000000000000003": { body: fixture("http/x-api-post-middle.json"), contentType: "application/json" },
      "https://api.x.com/2/tweets/1790000000000000002": { body: fixture("http/x-api-post-root.json"), contentType: "application/json" },
      "https://api.x.com/2/tweets/search/recent": { body: fixture("http/x-api-search.json"), contentType: "application/json" },
    });
    const x = new XClient("user-token", api.fetch);
    const content = await ingest(
      { url: "https://x.com/compounding_cal/status/1790000000000000003" },
      { llm: noLlm, fetch: api.fetch, lookup, x },
    );
    expect(content.via).toBe("x_api");
    expect(content.author).toBe("@compounding_cal");
    const parts = content.verbatimText.split("\n\n");
    expect(parts[0]).toBe("$COST thesis, quick thread");
    expect(content.verbatimText).toContain("Source: https://investor.costco.com/financials");
    expect(content.verbatimText).not.toContain("t.co");
    expect(content.verbatimText.indexOf("Bull case")).toBeLessThan(content.verbatimText.indexOf("What would make me wrong"));
    expect(content.verbatimText.match(/Bull case/g)).toHaveLength(1);
    expect(content.mediaUrls).toEqual(["https://pbs.twimg.com/media/chart.jpg"]);
    const search = api.requests.find((r) => r.url.includes("search/recent"))!;
    expect(new URL(search.url).searchParams.get("query")).toContain("conversation_id:1790000000000000002 from:compounding_cal");
    expect((search.init?.headers as Record<string, string>).authorization).toBe("Bearer user-token");
  });

  it("falls back to oEmbed when the X API errors", async () => {
    const { fetch } = fakeFetch({
      "https://api.x.com/2/tweets/": { status: 429, body: "{}", contentType: "application/json" },
      "https://publish.twitter.com/oembed": { body: fixture("http/x-oembed.json"), contentType: "application/json" },
    });
    const content = await ingest(
      { url: "https://x.com/slowbuild/status/1800000000000000006" },
      { llm: noLlm, fetch, lookup, x: new XClient("t", fetch) },
    );
    expect(content.via).toBe("x_oembed");
  });
});

describe("ingest: media", () => {
  it("runs server OCR on screenshots when the device didn't send ocr_text", async () => {
    const llm = new FixtureProvider({ vision_ocr: [llmFixture("ocr-screenshot")] });
    const content = await ingest(
      { media: [{ url: "https://blob.example/shot.png", kind: "image" }] },
      { llm, fetch: fakeFetch({}).fetch, lookup },
    );
    expect(llm.calls).toHaveLength(1);
    expect(llm.calls[0]!.imageCount).toBe(1);
    expect(content.ocrText).toContain("take 3 breaths");
    expect(content.author).toBe("@slowbuild");
    expect(content.platform).toBe("manual");
  });

  it("trusts on-device OCR and skips the vision call", async () => {
    const llm = new FixtureProvider({});
    const content = await ingest(
      { media: [{ url: "https://blob.example/shot.png", kind: "image" }], ocr_text: "Recognised on device" },
      { llm, fetch: fakeFetch({}).fetch, lookup },
    );
    expect(llm.calls).toHaveLength(0);
    expect(content.ocrText).toBe("Recognised on device");
  });

  it("flags videos for the background media job", async () => {
    const content = await ingest(
      { media: [{ url: "https://blob.example/reel.mp4", kind: "video" }], platform: "instagram" },
      { llm: noLlm, fetch: fakeFetch({}).fetch, lookup },
    );
    expect(content.needsMediaJob).toBe(true);
    expect(content.mediaUrls).toEqual(["https://blob.example/reel.mp4"]);
  });
});

describe("ingest: safety and errors", () => {
  it("refuses internal addresses", async () => {
    const { fetch } = fakeFetch({});
    await expect(ingest({ url: "http://169.254.169.254/latest/meta-data" }, { llm: noLlm, fetch, lookup })).rejects.toThrow(IngestError);
    await expect(ingest({ url: "http://localhost:3000/admin" }, { llm: noLlm, fetch, lookup })).rejects.toThrow(IngestError);
    await expect(
      ingest({ url: "https://sneaky.example/" }, { llm: noLlm, fetch, lookup: fakeLookup({ "sneaky.example": "10.0.0.5" }) }),
    ).rejects.toThrow(IngestError);
  });

  it("re-checks every redirect hop", async () => {
    const { fetch } = fakeFetch({
      "https://short.example/": { status: 302, body: "", headers: { location: "http://127.0.0.1/secret" } },
    });
    await expect(ingest({ url: "https://short.example/abc" }, { llm: noLlm, fetch, lookup })).rejects.toThrow(IngestError);
  });

  it("explains what to do when nothing is readable", async () => {
    const { fetch } = fakeFetch({ "https://empty.example/": { body: "<html><head></head><body></body></html>" } });
    const err = await ingest({ url: "https://empty.example/" }, { llm: noLlm, fetch, lookup }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(IngestError);
    expect((err as IngestError).userMessage).toMatch(/screenshot or paste the text/);
  });
});
