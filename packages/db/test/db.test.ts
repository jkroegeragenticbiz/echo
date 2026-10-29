import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { DEMO_SAVES, PERSONAS } from "@echo/core";
import {
  claimMediaJobs,
  countSavesThisMonth,
  createAdUnlock,
  deleteUserAccount,
  effectivePlan,
  enqueueMediaJob,
  finishMediaJob,
  findDuplicateSave,
  getActiveVoiceProfile,
  insertSave,
  listSaves,
  listVoiceProfiles,
  recordRevenuecatEvent,
  relatedSaves,
  setActiveVoiceProfile,
  updateSave,
  upsertRewrite,
  verifyAdUnlock,
  MAX_JOB_ATTEMPTS,
} from "../src/queries";
import { rewrites, saves, users, voiceProfiles } from "../src/schema";
import { seed } from "../src/seed";
import type { Database } from "../src/client";
import { createTestDb, fakeEmbedding } from "../src/testing";

let db: Database;
let close: () => Promise<void>;
let userId: string;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  const embeddings = DEMO_SAVES.map((_, i) => fakeEmbedding(i < 2 ? 0 : i, i * 0.1));
  const result = await seed(db, { embed: async () => embeddings });
  userId = result.userId;
});

afterAll(async () => close());

describe("seed", () => {
  it("creates a voice for each of the 8 personas and 6 saves across domains", async () => {
    const voices = await listVoiceProfiles(db, userId);
    expect(voices).toHaveLength(8);
    expect(new Set(voices.flatMap((v) => v.personas))).toEqual(new Set(PERSONAS.map((p) => p.id)));
    const rows = await db.select().from(saves).where(eq(saves.userId, userId));
    expect(rows).toHaveLength(6);
    expect(new Set(rows.map((r) => r.domain)).size).toBeGreaterThanOrEqual(5);
    const allRewrites = await db.select().from(rewrites);
    expect(allRewrites.length).toBe(DEMO_SAVES.reduce((n, s) => n + Object.keys(s.rewrites).length, 0));
  });

  it("is idempotent", async () => {
    const again = await seed(db);
    userId = again.userId;
    const count = await db.select().from(users).where(eq(users.email, "demo@getecho.ai"));
    expect(count).toHaveLength(1);
  });
});

describe("voice profiles", () => {
  it("keeps exactly one active voice", async () => {
    const voices = await listVoiceProfiles(db, userId);
    const target = voices.find((v) => !v.isActive)!;
    await setActiveVoiceProfile(db, userId, target.id);
    const active = await db.select().from(voiceProfiles).where(eq(voiceProfiles.isActive, true));
    expect(active).toHaveLength(1);
    expect((await getActiveVoiceProfile(db, userId))?.id).toBe(target.id);
  });
});

describe("saves", () => {
  it("dedupes on canonical url and on content hash", async () => {
    const [first] = await db.select().from(saves).where(eq(saves.userId, userId)).limit(1);
    expect(await findDuplicateSave(db, userId, { canonicalUrl: first!.canonicalUrl })).not.toBeNull();
    expect(await findDuplicateSave(db, userId, { contentHash: first!.contentHash })).not.toBeNull();
    expect(await findDuplicateSave(db, userId, { canonicalUrl: "https://example.com/nope" })).toBeNull();
    await expect(
      insertSave(db, { userId, platform: "web", canonicalUrl: first!.canonicalUrl, verbatimText: "x" }),
    ).rejects.toThrow();
  });

  it("lists with the rewrite for the requested voice, filters and searches", async () => {
    const sales = (await listVoiceProfiles(db, userId)).find((v) => v.personas.includes("sales_exec"))!;
    const all = await listSaves(db, userId, { voiceProfileId: sales.id });
    expect(all).toHaveLength(6);
    expect(all[0]!.rewrite?.headline).toBe(DEMO_SAVES[0]!.rewrites.sales_exec!.headline);
    const markets = await listSaves(db, userId, { domain: "markets_thesis" });
    expect(markets.map((r) => r.save.author)).toEqual(["@compounding_cal"]);
    const search = await listSaves(db, userId, { query: "split squat" });
    expect(search).toHaveLength(1);
    const byRewrite = await listSaves(db, userId, { query: "calendar", voiceProfileId: sales.id });
    expect(byRewrite.map((r) => r.save.author)).toContain("Maya Okafor");
  });

  it("counts saves in the current UTC month", async () => {
    expect(await countSavesThisMonth(db, userId)).toBe(6);
    expect(await countSavesThisMonth(db, userId, new Date("2099-01-15"))).toBe(0);
  });

  it("ranks related saves by cosine similarity", async () => {
    const rows = await db.select().from(saves).where(eq(saves.userId, userId));
    // Re-seed wiped embeddings; give two saves nearby vectors and one far away.
    const [a, b, c] = rows;
    await updateSave(db, a!.id, { embedding: fakeEmbedding(10) });
    await updateSave(db, b!.id, { embedding: fakeEmbedding(10, 0.2) });
    await updateSave(db, c!.id, { embedding: fakeEmbedding(500) });
    const related = await relatedSaves(db, userId, a!.id, 2);
    expect(related[0]!.id).toBe(b!.id);
    expect(related[0]!.similarity).toBeGreaterThan(0.9);
  });

  it("upserts a rewrite per save and voice", async () => {
    const [save] = await db.select().from(saves).where(eq(saves.userId, userId)).limit(1);
    const voice = (await listVoiceProfiles(db, userId))[0]!;
    const rw = { headline: "h", paraphrase: "p", action_steps: ["a", "b", "c"] };
    await upsertRewrite(db, save!.id, voice.id, rw);
    const second = await upsertRewrite(db, save!.id, voice.id, { ...rw, headline: "h2" });
    expect(second.headline).toBe("h2");
  });
});

describe("ad unlocks", () => {
  it("verifies once and rejects replayed transactions", async () => {
    const [save] = await db.select().from(saves).where(eq(saves.userId, userId)).limit(1);
    const unlock = await createAdUnlock(db, { userId, saveId: save!.id, voiceProfileId: null });
    expect(await verifyAdUnlock(db, unlock.id, "00000000-0000-0000-0000-000000000000", "tx-0")).toBeNull();
    expect(await verifyAdUnlock(db, unlock.id, userId, "tx-1")).not.toBeNull();
    expect(await verifyAdUnlock(db, unlock.id, userId, "tx-1")).toBeNull();
    const other = await createAdUnlock(db, { userId, saveId: save!.id, voiceProfileId: null });
    expect(await verifyAdUnlock(db, other.id, userId, "tx-1")).toBeNull();
  });
});

describe("media jobs", () => {
  it("claims each job once and retries up to the attempt limit", async () => {
    const [save] = await db.select().from(saves).where(eq(saves.userId, userId)).limit(1);
    const job = await enqueueMediaJob(db, save!.id);
    const claimed = await claimMediaJobs(db, 5);
    expect(claimed.map((j) => j.id)).toEqual([job.id]);
    expect(await claimMediaJobs(db, 5)).toEqual([]);
    let attempts = claimed[0]!.attempts;
    let result = await finishMediaJob(db, job.id, "boom", attempts);
    expect(result.failedForGood).toBe(false);
    while (attempts < MAX_JOB_ATTEMPTS) {
      const [again] = await claimMediaJobs(db, 1);
      attempts = again!.attempts;
      result = await finishMediaJob(db, job.id, "boom", attempts);
    }
    expect(result.failedForGood).toBe(true);
    expect(await claimMediaJobs(db, 5)).toEqual([]);
  });
});

describe("billing", () => {
  it("records each RevenueCat event once", async () => {
    expect(await recordRevenuecatEvent(db, "evt_1", "INITIAL_PURCHASE", userId)).toBe(true);
    expect(await recordRevenuecatEvent(db, "evt_1", "INITIAL_PURCHASE", userId)).toBe(false);
  });

  it("treats an expired Plus entitlement as free", () => {
    expect(effectivePlan({ plan: "plus", planExpiresAt: null })).toBe("plus");
    expect(effectivePlan({ plan: "plus", planExpiresAt: new Date("2000-01-01") })).toBe("free");
    expect(effectivePlan({ plan: "free", planExpiresAt: null })).toBe("free");
  });
});

describe("account deletion", () => {
  it("removes the user and all of their data", async () => {
    await updateSave(db, (await db.select().from(saves).limit(1))[0]!.id, { mediaUrls: ["https://blob/x.jpg"] });
    const media = await deleteUserAccount(db, userId);
    expect(media).toEqual(["https://blob/x.jpg"]);
    expect(await db.select().from(saves).where(eq(saves.userId, userId))).toHaveLength(0);
    expect(await db.select().from(voiceProfiles).where(eq(voiceProfiles.userId, userId))).toHaveLength(0);
    expect(await db.select().from(rewrites)).toHaveLength(0);
  });
});
