import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { FixtureTranscriber } from "@echo/core/server";
import { getSaveById, getUser, mediaJobs, saves, socialConnections, users, voiceProfiles, type Database } from "@echo/db";
import { createTestDb } from "@echo/db/testing";
import { decrypt, deriveKey, encrypt } from "@/lib/crypto";
import { signMobileToken, verifyMobileToken } from "@/lib/mobile-token";
import { consumeMobileMagicToken, createMobileMagicToken, deleteAccount, upsertAppleUser } from "@/lib/services/accounts";
import { runMediaJobs } from "@/lib/services/media";
import { handleRevenueCatEvent } from "@/lib/services/revenuecat";
import { createSave } from "@/lib/services/saves";
import { completeXConnect, getXClient, readXState, safeReturnTo, startXConnect, syncXBookmarks } from "@/lib/services/x";
import { createUser, fakeFetch, fixture, llmFixture, makeContext } from "./harness";

let db: Database;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(async () => close());

const SECRET = "test-secret-for-echo";

describe("RevenueCat webhook", () => {
  const event = (type: string, userId: string, extra: Record<string, unknown> = {}) => ({
    api_version: "1.0",
    event: { id: crypto.randomUUID(), type, app_user_id: userId, entitlement_ids: ["plus"], expiration_at_ms: Date.now() + 864e5, ...extra },
  });

  it("grants Plus on purchase, ignores replays and revokes on expiration", async () => {
    const user = await createUser(db, "free");
    const purchase = event("INITIAL_PURCHASE", user.id);
    expect(await handleRevenueCatEvent(db, purchase)).toEqual({ status: "applied" });
    expect((await getUser(db, user.id))?.plan).toBe("plus");
    expect(await handleRevenueCatEvent(db, purchase)).toEqual({ status: "duplicate" });

    await handleRevenueCatEvent(db, event("CANCELLATION", user.id));
    expect((await getUser(db, user.id))?.plan).toBe("plus");
    await handleRevenueCatEvent(db, event("EXPIRATION", user.id));
    expect((await getUser(db, user.id))?.plan).toBe("free");
  });

  it("finds our user through aliases and moves Plus on transfer", async () => {
    const a = await createUser(db, "free");
    const b = await createUser(db, "free");
    await handleRevenueCatEvent(db, event("RENEWAL", "$RCAnonymousID:abc", { aliases: ["$RCAnonymousID:abc", a.id] }));
    expect((await getUser(db, a.id))?.plan).toBe("plus");
    await handleRevenueCatEvent(db, event("TRANSFER", "", { transferred_from: [a.id], transferred_to: [b.id], entitlement_ids: null }));
    expect((await getUser(db, a.id))?.plan).toBe("free");
    expect((await getUser(db, b.id))?.plan).toBe("plus");
  });

  it("ignores test events and other entitlements", async () => {
    const user = await createUser(db, "free");
    expect(await handleRevenueCatEvent(db, event("TEST", user.id))).toEqual({ status: "ignored" });
    expect(await handleRevenueCatEvent(db, event("INITIAL_PURCHASE", user.id, { entitlement_ids: ["other"] }))).toEqual({ status: "ignored" });
  });
});

describe("mobile auth", () => {
  it("signs and verifies bearer tokens", async () => {
    const token = await signMobileToken("00000000-0000-4000-8000-000000000001", SECRET);
    expect(await verifyMobileToken(token, SECRET)).toBe("00000000-0000-4000-8000-000000000001");
    expect(await verifyMobileToken(token, "other-secret")).toBeNull();
    expect(await verifyMobileToken(`${token}x`, SECRET)).toBeNull();
    const expired = await signMobileToken("u", SECRET, Date.now() - 365 * 864e5);
    expect(await verifyMobileToken(expired, SECRET)).toBeNull();
  });

  it("consumes a magic link once", async () => {
    const token = await createMobileMagicToken(db, "Reader@Example.com");
    const userId = await consumeMobileMagicToken(db, "reader@example.com", token);
    expect(userId).toBeTruthy();
    expect(await consumeMobileMagicToken(db, "reader@example.com", token)).toBeNull();
    expect(await consumeMobileMagicToken(db, "reader@example.com", "wrong-token-value")).toBeNull();
  });

  it("links Sign in with Apple to an existing email account", async () => {
    const existing = await createUser(db, "free", "apple-person@example.com");
    const id = await upsertAppleUser(db, { sub: "apple-sub-1", email: "apple-person@example.com", emailVerified: true });
    expect(id).toBe(existing.id);
    expect(await upsertAppleUser(db, { sub: "apple-sub-1", email: null, emailVerified: false })).toBe(existing.id);
    const relay = await upsertAppleUser(db, { sub: "apple-sub-2", email: "x@privaterelay.appleid.com", emailVerified: true });
    expect(relay).not.toBe(existing.id);
  });
});

describe("account deletion", () => {
  it("removes all data and only the blobs we host", async () => {
    const user = await createUser(db, "plus");
    const ctx = makeContext(db, { responses: { classify: [llmFixture("classify-career")], rewrite: [llmFixture("rewrite-sales")] } });
    const res = await createSave(ctx, user.id, { text: "Stop asking for 15 minutes. Reply rate went from 9% to 31% in 6 weeks." });
    await ctx.flush();
    await db
      .update(saves)
      .set({ mediaUrls: ["https://abc.public.blob.vercel-storage.com/shot.png", "https://pbs.twimg.com/media/x.jpg"] })
      .where(eq(saves.id, res.save.id));
    const deleted: string[] = [];
    await deleteAccount(db, user.id, async (urls) => void deleted.push(...urls));
    expect(deleted).toEqual(["https://abc.public.blob.vercel-storage.com/shot.png"]);
    expect(await db.select().from(users).where(eq(users.id, user.id))).toHaveLength(0);
    expect(await db.select().from(voiceProfiles).where(eq(voiceProfiles.userId, user.id))).toHaveLength(0);
    expect(await getSaveById(db, res.save.id)).toBeNull();
  });
});

describe("token encryption", () => {
  it("round-trips and detects tampering", () => {
    const key = deriveKey(SECRET, "oauth-tokens");
    const sealed = encrypt("access-token-value", key);
    expect(sealed).not.toContain("access-token-value");
    expect(decrypt(sealed, key)).toBe("access-token-value");
    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decrypt(parts.join("."), key)).toThrow();
    expect(() => decrypt(sealed, deriveKey(SECRET, "other-purpose"))).toThrow();
  });
});

describe("X connect and bookmark sync", () => {
  const config = { clientId: "cid", clientSecret: "csecret", redirectUri: "https://getecho.ai/api/x/callback", secret: SECRET };

  it("only redirects back to our pages or the app scheme", () => {
    expect(safeReturnTo("echo://x-connected")).toBe("echo://x-connected");
    expect(safeReturnTo("/library")).toBe("/library");
    expect(safeReturnTo("//evil.example")).toBe("/library");
    expect(safeReturnTo("https://evil.example")).toBe("/library");
  });

  it("connects with PKCE, stores encrypted tokens and imports new bookmarks", async () => {
    const user = await createUser(db, "plus");
    const authorizeUrl = new URL(startXConnect(user.id, "echo://x-connected", config));
    const state = authorizeUrl.searchParams.get("state")!;
    expect(readXState(state, SECRET).userId).toBe(user.id);

    const x = fakeFetch({
      "https://api.x.com/2/oauth2/token": {
        contentType: "application/json",
        body: JSON.stringify({ access_token: "at-1", refresh_token: "rt-1", expires_in: 7200, scope: "tweet.read users.read bookmark.read offline.access", token_type: "bearer" }),
      },
      "https://api.x.com/2/users/me": { contentType: "application/json", body: JSON.stringify({ data: { id: "99", username: "reader", name: "Reader" } }) },
      "https://api.x.com/2/users/99/bookmarks": { contentType: "application/json", body: fixture("x-api-bookmarks.json") },
      "https://publish.twitter.com/oembed": {
        contentType: "application/json",
        body: JSON.stringify({ author_url: "https://twitter.com/slowbuild", html: "<blockquote><p>The habit advice that finally worked for me: make the first version so small it takes under 2 minutes.</p></blockquote>" }),
      },
    });
    const result = await completeXConnect(db, "auth-code", state, { ...config, fetch: x.fetch });
    expect(result).toMatchObject({ userId: user.id, returnTo: "echo://x-connected", username: "reader" });
    const tokenBody = new URLSearchParams(x.requests[0]!.init!.body as URLSearchParams);
    expect(tokenBody.get("code_verifier")).toBeTruthy();

    const [conn] = await db.select().from(socialConnections).where(eq(socialConnections.userId, user.id));
    expect(conn!.accessTokenEnc).not.toContain("at-1");
    expect(conn!.externalUsername).toBe("reader");

    const client = await getXClient(db, user.id, { ...config, fetch: x.fetch });
    const ctx = makeContext(db, { fetch: x.fetch, responses: { classify: [llmFixture("classify-career")], rewrite: [llmFixture("rewrite-sales")] } });
    const sync = await syncXBookmarks(ctx, user.id, client!);
    expect(sync.imported).toBe(1);
    const [save] = await db.select().from(saves).where(eq(saves.userId, user.id));
    expect(save!.externalId).toBe("1800000000000000006");
    expect(save!.canonicalUrl).toBe("https://x.com/slowbuild/status/1800000000000000006");

    // A second run finds nothing new.
    expect((await syncXBookmarks(ctx, user.id, client!)).imported).toBe(0);
  });

  it("refreshes an expiring access token", async () => {
    const user = await createUser(db, "plus");
    const key = deriveKey(SECRET, "oauth-tokens");
    await db.insert(socialConnections).values({
      userId: user.id,
      platform: "x",
      accessTokenEnc: encrypt("old", key),
      refreshTokenEnc: encrypt("rt-old", key),
      tokenExpiresAt: new Date(Date.now() + 5_000),
    });
    const x = fakeFetch({
      "https://api.x.com/2/oauth2/token": {
        contentType: "application/json",
        body: JSON.stringify({ access_token: "new", refresh_token: "rt-new", expires_in: 7200, scope: "bookmark.read", token_type: "bearer" }),
      },
    });
    await getXClient(db, user.id, { ...config, fetch: x.fetch });
    expect(new URLSearchParams(x.requests[0]!.init!.body as URLSearchParams).get("refresh_token")).toBe("rt-old");
    const [conn] = await db.select().from(socialConnections).where(eq(socialConnections.userId, user.id));
    expect(decrypt(conn!.accessTokenEnc!, key)).toBe("new");
    expect(decrypt(conn!.refreshTokenEnc!, key)).toBe("rt-new");
  });
});

describe("video media job (real ffmpeg)", () => {
  const ffmpeg = createRequire(import.meta.url)("ffmpeg-static") as string;

  it("transcribes, OCRs keyframes, then classifies and rewrites", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "echo-test-"));
    const video = path.join(dir, "reel.mp4");
    execFileSync(ffmpeg, [
      "-hide_banner", "-loglevel", "error",
      "-f", "lavfi", "-i", "testsrc=duration=7:size=320x240:rate=10",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=7",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", video,
    ]);
    const blobUrl = "https://abc.public.blob.vercel-storage.com/reel-x1.mp4";
    const { fetch } = fakeFetch({ [blobUrl]: { body: new Uint8Array(readFileSync(video)), contentType: "video/mp4" } });

    const user = await createUser(db, "plus");
    const ctx = makeContext(db, {
      fetch,
      ffmpegPath: ffmpeg,
      transcriber: new FixtureTranscriber("Bulgarian split squats, four sets of eight, three one one tempo."),
      responses: {
        vision_ocr: [llmFixture("ocr-frames")],
        classify: [llmFixture("classify-fitness")],
        rewrite: [llmFixture("rewrite-sales")],
      },
    });
    const res = await createSave(ctx, user.id, { media: [{ url: blobUrl, kind: "video" }], platform: "tiktok" });
    expect(res.save.status).toBe("processing");
    await ctx.flush();

    const save = await getSaveById(db, res.save.id);
    expect(save?.transcript).toBe("Bulgarian split squats, four sets of eight, three one one tempo.");
    expect(save?.ocrText).toContain("Bulgarian split squat 4x8 each leg");
    expect(save?.status).toBe("ready");
    const ocrCall = ctx.llm.calls.find((c) => c.task === "vision_ocr")!;
    expect(ocrCall.imageCount).toBeGreaterThanOrEqual(2);
    expect(ctx.llm.calls.find((c) => c.task === "classify")!.prompt).toContain("[Audio transcript]");
    const [job] = await db.select().from(mediaJobs).where(eq(mediaJobs.saveId, res.save.id));
    expect(job!.status).toBe("done");
  });

  it("marks a video save failed after the last retry when there's no text", async () => {
    const user = await createUser(db, "plus");
    const blobUrl = "https://abc.public.blob.vercel-storage.com/broken.mp4";
    const { fetch } = fakeFetch({ [blobUrl]: { status: 404, body: "missing", contentType: "text/plain" } });
    const ctx = makeContext(db, { fetch, ffmpegPath: ffmpeg });
    const res = await createSave(ctx, user.id, { media: [{ url: blobUrl, kind: "video" }] });
    await ctx.flush(); // attempt 1
    await runMediaJobs(ctx); // attempt 2 (cron)
    await runMediaJobs(ctx); // attempt 3 (cron)
    const save = await getSaveById(db, res.save.id);
    expect(save?.status).toBe("failed");
    const [job] = await db.select().from(mediaJobs).where(eq(mediaJobs.saveId, res.save.id));
    expect(job!.status).toBe("failed");
    expect(job!.attempts).toBe(3);
  });
});
