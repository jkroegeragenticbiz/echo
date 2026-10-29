import { generateKeyPairSync, sign } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { adUnlocks, getSaveById, listSaves, rewrites, saves, voiceProfiles, type Database } from "@echo/db";
import { createTestDb } from "@echo/db/testing";
import { HttpError } from "@/lib/http";
import { redeemAdReward, verifyAdMobCallback } from "@/lib/services/admob";
import { createSave, requestRewrite } from "@/lib/services/saves";
import { ensureActiveVoice } from "@/lib/services/voices";
import { createUser, fakeFetch, fixture, llmFixture, makeContext } from "./harness";

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(async () => close());

const linkedinFetch = () =>
  fakeFetch({ "https://www.linkedin.com/": { body: fixture("linkedin-post.html") } }).fetch;

const LINKEDIN_URL = "https://www.linkedin.com/posts/maya-okafor_cold-email-activity-1?utm_source=share";

describe("free user save flow", () => {
  it("saves, classifies in the background and waits for an ad before rewriting", async () => {
    const user = await createUser(db, "free");
    const ctx = makeContext(db, { fetch: linkedinFetch(), responses: { classify: [llmFixture("classify-career")] } });

    const res = await createSave(ctx, user.id, { url: LINKEDIN_URL });
    expect(res.duplicate).toBe(false);
    expect(res.save.status).toBe("processing");
    expect(res.unlock?.ad_unit_id).toBe("ca-app-pub-test/rewarded");
    expect(res.usage).toEqual({ used: 1, limit: 15 });

    await ctx.flush();
    const stored = await getSaveById(db, res.save.id);
    expect(stored?.status).toBe("ready");
    expect(stored?.domain).toBe("career_sales");
    expect(stored?.keyMetric).toEqual({ label: "Reply rate", value: "9% → 31%" });
    expect(stored?.embedding).toHaveLength(1536);
    expect(ctx.llm.calls.map((c) => c.task)).toEqual(["classify"]);

    const voice = await ensureActiveVoice(db, user.id);
    const [row] = await listSaves(db, user.id, { voiceProfileId: voice.id });
    expect(row!.rewrite).toBeNull();
  });

  it("returns the existing save for a duplicate link without using quota", async () => {
    const user = await createUser(db, "free");
    const ctx = makeContext(db, { fetch: linkedinFetch(), responses: { classify: [llmFixture("classify-career")] } });
    const first = await createSave(ctx, user.id, { url: LINKEDIN_URL });
    await ctx.flush();
    const second = await createSave(ctx, user.id, {
      url: "https://linkedin.com/posts/maya-okafor_cold-email-activity-1/?trk=public_post",
    });
    expect(second.duplicate).toBe(true);
    expect(second.save.id).toBe(first.save.id);
    expect(second.unlock).toBeUndefined();
    expect(await db.select().from(saves).where(eq(saves.userId, user.id))).toHaveLength(1);
  });

  it("dedupes pasted text that matches an existing save's content hash", async () => {
    const user = await createUser(db, "free");
    const ctx = makeContext(db, { responses: { classify: [llmFixture("classify-career")] } });
    const text = "Make the first version so small it takes under 2 minutes. Scale it after 21 days.";
    const a = await createSave(ctx, user.id, { text });
    const b = await createSave(ctx, user.id, { text: `  ${text.toUpperCase()}  ` });
    expect(b.duplicate).toBe(true);
    expect(b.save.id).toBe(a.save.id);
  });

  it("blocks saves past the monthly free cap with a Plus upsell", async () => {
    const user = await createUser(db, "free");
    const ctx = makeContext(db, { freeSavesPerMonth: 1, responses: { classify: [llmFixture("classify-career")] } });
    await createSave(ctx, user.id, { text: "First save of the month, about cold email reply rates." });
    const err = await createSave(ctx, user.id, { text: "Second save of the month, about something else entirely." }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(402);
    expect((err as HttpError).message).toMatch(/Echo Plus/);
  });

  it("still returns an existing save to a user at the cap", async () => {
    const user = await createUser(db, "free");
    const ctx = makeContext(db, { fetch: linkedinFetch(), freeSavesPerMonth: 1, responses: { classify: [llmFixture("classify-career")] } });
    await createSave(ctx, user.id, { url: LINKEDIN_URL });
    const again = await createSave(ctx, user.id, { url: LINKEDIN_URL });
    expect(again.duplicate).toBe(true);
  });
});

describe("Plus user save flow", () => {
  it("rewrites in the active voice right after classification, no ad", async () => {
    const user = await createUser(db, "plus");
    const ctx = makeContext(db, {
      fetch: linkedinFetch(),
      responses: { classify: [llmFixture("classify-career")], rewrite: [llmFixture("rewrite-sales")] },
    });
    const res = await createSave(ctx, user.id, { url: LINKEDIN_URL });
    expect(res.unlock).toBeUndefined();
    expect(res.usage.limit).toBeNull();
    await ctx.flush();

    const voice = await ensureActiveVoice(db, user.id);
    const [row] = await listSaves(db, user.id, { voiceProfileId: voice.id });
    expect(row!.rewrite?.headline).toBe("Lead with their problem, not my calendar");
    expect(row!.save.status).toBe("ready");
  });

  it("keeps the save and records the error when the rewrite keeps inventing facts", async () => {
    const user = await createUser(db, "plus");
    const bad = llmFixture("rewrite-sales-invented");
    const ctx = makeContext(db, { fetch: linkedinFetch(), responses: { classify: [llmFixture("classify-career")], rewrite: [bad, bad] } });
    const res = await createSave(ctx, user.id, { url: LINKEDIN_URL });
    await ctx.flush();
    const stored = await getSaveById(db, res.save.id);
    expect(stored?.status).toBe("ready");
    expect(stored?.error).toMatch(/facts not in the source/);
    expect(await db.select().from(rewrites).where(eq(rewrites.saveId, res.save.id))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AdMob server-side verification
// ---------------------------------------------------------------------------

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const keys = async () => new Map([["1234", publicKey.export({ type: "spki", format: "pem" }).toString()]]);

function signedCallback(params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  const signature = sign("sha256", Buffer.from(query), { key: privateKey, dsaEncoding: "der" }).toString("base64url");
  return `https://getecho.ai/api/webhooks/admob?${query}&signature=${signature}&key_id=1234`;
}

describe("rewarded ad unlock", () => {
  it("verifies the AdMob signature, redeems once and then rewrites", async () => {
    const user = await createUser(db, "free");
    const ctx = makeContext(db, {
      fetch: linkedinFetch(),
      responses: { classify: [llmFixture("classify-career")], rewrite: [llmFixture("rewrite-sales")] },
    });
    const res = await createSave(ctx, user.id, { url: LINKEDIN_URL });
    await ctx.flush();

    const url = signedCallback({
      ad_network: "5450213213286189855",
      ad_unit: "1234567890",
      custom_data: res.unlock!.ad_unlock_id,
      reward_amount: "1",
      reward_item: "rewrite",
      timestamp: String(Date.now()),
      transaction_id: "tx-123",
      user_id: user.id,
    });
    const reward = await verifyAdMobCallback(url, keys);
    expect(reward).toEqual({ adUnlockId: res.unlock!.ad_unlock_id, userId: user.id, transactionId: "tx-123", adUnit: "1234567890" });

    expect((await redeemAdReward(ctx, reward!)).redeemed).toBe(true);
    await ctx.flush();
    const [unlock] = await db.select().from(adUnlocks).where(eq(adUnlocks.id, res.unlock!.ad_unlock_id));
    expect(unlock!.rewardVerifiedAt).toBeInstanceOf(Date);
    expect(await db.select().from(rewrites).where(eq(rewrites.saveId, res.save.id))).toHaveLength(1);

    // AdMob retries callbacks; a replay must not trigger another rewrite.
    expect(await redeemAdReward(ctx, reward!)).toEqual({ redeemed: false, alreadyVerified: true });
  });

  it("rejects tampered or unsigned callbacks", async () => {
    const url = signedCallback({ custom_data: crypto.randomUUID(), transaction_id: "tx", user_id: crypto.randomUUID() });
    expect(await verifyAdMobCallback(url.replace("transaction_id=tx", "transaction_id=ty"), keys)).toBeNull();
    expect(await verifyAdMobCallback("https://getecho.ai/api/webhooks/admob?user_id=x", keys)).toBeNull();
    expect(await verifyAdMobCallback(url.replace("key_id=1234", "key_id=999"), keys)).toBeNull();
  });

  it("picks up an ad that was verified while the save was still processing", async () => {
    const user = await createUser(db, "free");
    const ctx = makeContext(db, {
      fetch: linkedinFetch(),
      responses: { classify: [llmFixture("classify-career")], rewrite: [llmFixture("rewrite-sales")] },
    });
    const res = await createSave(ctx, user.id, { url: LINKEDIN_URL });
    // Ad finishes before the background classification runs.
    await redeemAdReward(ctx, { adUnlockId: res.unlock!.ad_unlock_id, userId: user.id, transactionId: "tx-early", adUnit: null });
    await ctx.flush();
    expect(ctx.llm.calls.map((c) => c.task)).toEqual(["classify", "rewrite"]);
    expect(await db.select().from(rewrites).where(eq(rewrites.saveId, res.save.id))).toHaveLength(1);
  });
});

describe("rewrite in another voice", () => {
  it("asks free users to watch an ad, and rewrites right away for Plus", async () => {
    const free = await createUser(db, "free");
    const freeCtx = makeContext(db, { responses: { classify: [llmFixture("classify-career")] } });
    const saved = await createSave(freeCtx, free.id, { text: "Lead with their problem, not your calendar. Reply rate 9% to 31%." });
    await freeCtx.flush();
    const result = await requestRewrite(freeCtx, free.id, saved.save.id);
    expect(result.unlock?.ad_unlock_id).toBeTruthy();

    const plus = await createUser(db, "plus");
    const plusCtx = makeContext(db, {
      responses: { classify: [llmFixture("classify-career")], rewrite: [llmFixture("rewrite-sales"), llmFixture("rewrite-sales")] },
    });
    const s = await createSave(plusCtx, plus.id, { text: "Stop asking for 15 minutes. Reply rate went from 9% to 31% in 6 weeks. Lead with their problem, not your calendar." });
    await plusCtx.flush();
    const [second] = await db
      .insert(voiceProfiles)
      .values({ userId: plus.id, name: "Coach", personas: ["fitness_coach"], perspective: "coach" })
      .returning();
    const r = await requestRewrite(plusCtx, plus.id, s.save.id, second!.id);
    expect(r.unlock).toBeUndefined();
    await plusCtx.flush();
    const rows = await db.select().from(rewrites).where(eq(rewrites.saveId, s.save.id));
    expect(rows.map((x) => x.voiceProfileId)).toContain(second!.id);
    expect(plusCtx.llm.calls.at(-1)!.prompt).toMatch(/Perspective: Second person/);
  });
});
