import { describe, expect, it } from "vitest";
import { ApiError, createApi, pollSave } from "../lib/api";
import { firstLine, voiceNameFor } from "../lib/format";
import { parsePending } from "../lib/pending";

function fakeFetch(handler: (url: string, init: RequestInit) => { status?: number; body?: unknown }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const { status = 200, body } = handler(url, init);
    return new Response(body === undefined ? "" : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("api client", () => {
  it("sends the bearer token and JSON body", async () => {
    const { impl, calls } = fakeFetch(() => ({ status: 201, body: { save: { id: "s1" }, duplicate: false, usage: { used: 1, limit: 15 } } }));
    const api = createApi("https://getecho.ai", () => "tok", impl);
    const res = await api.createSave({ url: "https://x.com/a/status/1" });
    expect(res.save.id).toBe("s1");
    expect(calls[0]!.url).toBe("https://getecho.ai/api/saves");
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer tok");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ url: "https://x.com/a/status/1" });
    expect(calls[0]!.init.method).toBe("POST");
  });

  it("omits auth on sign-in calls and builds list query strings", async () => {
    const { impl, calls } = fakeFetch(() => ({ body: { saves: [], voice_profile_id: "v", next_before: null } }));
    const api = createApi("https://getecho.ai", () => "tok", impl);
    await api.listSaves({ voice: "v1", domain: "markets_thesis", q: "  costco " });
    expect(calls[0]!.url).toBe("https://getecho.ai/api/saves?voice=v1&domain=markets_thesis&q=costco");
    await api.requestMagicLink("a@b.co").catch(() => undefined);
    expect((calls[1]!.init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it("raises ApiError with the server's message and code", async () => {
    const { impl } = fakeFetch(() => ({ status: 402, body: { error: "You've used all 15 free saves", code: "quota_exceeded" } }));
    const err = await createApi("https://x", () => null, impl).createSave({ text: "hello world" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("quota_exceeded");
    expect((err as ApiError).status).toBe(402);
  });

  it("polls until the rewrite appears", async () => {
    let n = 0;
    const api = { getSave: async () => ({ save: { rewrite: ++n >= 3 ? { headline: "h" } : null } as never }) };
    const save = await pollSave(api, "s1", "v1", (s) => Boolean(s.rewrite), { sleep: async () => undefined });
    expect(save).toBeTruthy();
    expect(n).toBe(3);
  });
});

describe("pending share queue", () => {
  const now = Date.parse("2026-10-29T12:00:00Z");
  it("parses unlocks and videos, videos first, and flags stale or malformed entries", () => {
    const raw = JSON.stringify([
      { id: "u1", kind: "unlock", createdAt: "2026-10-29T11:00:00Z", saveId: "s1", adUnlockId: "a1", adUnitId: "unit", voiceName: "Sales" },
      { id: "v1", kind: "video", createdAt: "2026-10-29T11:30:00Z", fileName: "x.mov", sourceUrl: "", text: "" },
      { id: "old", kind: "unlock", createdAt: "2026-10-01T00:00:00Z", saveId: "s", adUnlockId: "a" },
      { id: "bad", kind: "unlock", createdAt: "2026-10-29T11:00:00Z" },
      { kind: "video" },
    ]);
    const { items, discard } = parsePending(raw, now);
    expect(items.map((i) => i.id)).toEqual(["v1", "u1"]);
    expect(discard.sort()).toEqual(["bad", "old"]);
  });

  it("tolerates garbage", () => {
    expect(parsePending("not json")).toEqual({ items: [], discard: [] });
    expect(parsePending("{}")).toEqual({ items: [], discard: [] });
  });
});

describe("format helpers", () => {
  it("names a voice from its personas", () => {
    expect(voiceNameFor(["sales_exec"], "")).toBe("Sales");
    expect(voiceNameFor(["sales_exec", "fitness_coach"], "")).toBe("Sales + Fitness Coach");
    expect(voiceNameFor(["founder", "creator", "student"], "")).toBe("Founder + 2 more");
    expect(voiceNameFor([], "nurse who lifts")).toBe("My own voice");
  });

  it("trims the first line for headlines", () => {
    expect(firstLine("\n\n  Hello there  \nsecond")).toBe("Hello there");
    expect(firstLine("x".repeat(200), 10)).toBe("xxxxxxxxx…");
  });
});
