import { and, cosineDistance, desc, eq, gte, ilike, inArray, isNotNull, lt, ne, or, sql } from "drizzle-orm";
import type { Domain, Plan, Rewrite } from "@echo/core";
import type { Database } from "./client";
import {
  adUnlocks,
  mediaJobs,
  revenuecatEvents,
  rewrites,
  saves,
  socialConnections,
  users,
  voiceProfiles,
  waitlist,
  type NewSave,
  type SaveRow,
} from "./schema";

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function getUser(db: Database, userId: string) {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

/** Effective plan: Plus only while the entitlement hasn't expired. */
export function effectivePlan(user: { plan: Plan; planExpiresAt: Date | null }, now = new Date()): Plan {
  if (user.plan !== "plus") return "free";
  if (user.planExpiresAt && user.planExpiresAt.getTime() < now.getTime()) return "free";
  return "plus";
}

export async function setUserPlan(db: Database, userId: string, plan: Plan, expiresAt: Date | null) {
  await db.update(users).set({ plan, planExpiresAt: expiresAt }).where(eq(users.id, userId));
}

/**
 * Deletes the user and everything that cascades from them. Returns the media
 * URLs that were attached to their saves so the caller can purge blob storage.
 */
export async function deleteUserAccount(db: Database, userId: string): Promise<string[]> {
  const media = await db
    .select({ mediaUrls: saves.mediaUrls })
    .from(saves)
    .where(eq(saves.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  return media.flatMap((m) => m.mediaUrls);
}

// ---------------------------------------------------------------------------
// Voice profiles
// ---------------------------------------------------------------------------

export async function listVoiceProfiles(db: Database, userId: string) {
  return db
    .select()
    .from(voiceProfiles)
    .where(eq(voiceProfiles.userId, userId))
    .orderBy(desc(voiceProfiles.isActive), voiceProfiles.createdAt);
}

export async function getVoiceProfile(db: Database, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(voiceProfiles)
    .where(and(eq(voiceProfiles.userId, userId), eq(voiceProfiles.id, id)))
    .limit(1);
  return row ?? null;
}

export async function getActiveVoiceProfile(db: Database, userId: string) {
  const [row] = await db
    .select()
    .from(voiceProfiles)
    .where(and(eq(voiceProfiles.userId, userId), eq(voiceProfiles.isActive, true)))
    .limit(1);
  return row ?? null;
}

export async function setActiveVoiceProfile(db: Database, userId: string, id: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(voiceProfiles)
      .set({ isActive: false })
      .where(and(eq(voiceProfiles.userId, userId), ne(voiceProfiles.id, id)));
    await tx
      .update(voiceProfiles)
      .set({ isActive: true })
      .where(and(eq(voiceProfiles.userId, userId), eq(voiceProfiles.id, id)));
  });
}

export async function countVoiceProfiles(db: Database, userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(voiceProfiles)
    .where(eq(voiceProfiles.userId, userId));
  return row?.n ?? 0;
}

// ---------------------------------------------------------------------------
// Saves
// ---------------------------------------------------------------------------

export function startOfUtcMonth(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function countSavesThisMonth(db: Database, userId: string, now = new Date()) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(saves)
    .where(and(eq(saves.userId, userId), gte(saves.createdAt, startOfUtcMonth(now))));
  return row?.n ?? 0;
}

export async function findDuplicateSave(
  db: Database,
  userId: string,
  keys: { canonicalUrl?: string | null; contentHash?: string | null; externalId?: string | null },
): Promise<SaveRow | null> {
  const matchers = [
    keys.canonicalUrl ? eq(saves.canonicalUrl, keys.canonicalUrl) : undefined,
    keys.contentHash ? eq(saves.contentHash, keys.contentHash) : undefined,
    keys.externalId ? eq(saves.externalId, keys.externalId) : undefined,
  ].filter((m) => m !== undefined);
  if (matchers.length === 0) return null;
  const [row] = await db
    .select()
    .from(saves)
    .where(and(eq(saves.userId, userId), or(...matchers)))
    .limit(1);
  return row ?? null;
}

export async function insertSave(db: Database, values: NewSave) {
  const [row] = await db.insert(saves).values(values).returning();
  return row!;
}

export async function updateSave(db: Database, id: string, values: Partial<NewSave>) {
  const [row] = await db.update(saves).set(values).where(eq(saves.id, id)).returning();
  return row ?? null;
}

export async function getSave(db: Database, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(saves)
    .where(and(eq(saves.userId, userId), eq(saves.id, id)))
    .limit(1);
  return row ?? null;
}

export async function getSaveById(db: Database, id: string) {
  const [row] = await db.select().from(saves).where(eq(saves.id, id)).limit(1);
  return row ?? null;
}

export async function deleteSave(db: Database, userId: string, id: string) {
  const [row] = await db
    .delete(saves)
    .where(and(eq(saves.userId, userId), eq(saves.id, id)))
    .returning({ mediaUrls: saves.mediaUrls });
  return row ?? null;
}

export interface ListSavesOptions {
  voiceProfileId?: string | null;
  domain?: Domain | null;
  query?: string | null;
  limit?: number;
  /** ISO timestamp; returns saves created strictly before it. */
  before?: string | null;
}

export async function listSaves(db: Database, userId: string, opts: ListSavesOptions = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
  const conditions = [eq(saves.userId, userId)];
  if (opts.domain) conditions.push(eq(saves.domain, opts.domain));
  if (opts.before) conditions.push(lt(saves.createdAt, new Date(opts.before)));
  if (opts.query?.trim()) {
    const q = `%${opts.query.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conditions.push(
      or(
        ilike(saves.verbatimText, q),
        ilike(saves.author, q),
        ilike(saves.summary, q),
        ilike(saves.transcript, q),
        sql`exists (select 1 from ${rewrites} r where r.save_id = ${saves.id} and (r.headline ilike ${q} or r.paraphrase ilike ${q}))`,
      )!,
    );
  }

  const rewriteJoin = opts.voiceProfileId
    ? and(eq(rewrites.saveId, saves.id), eq(rewrites.voiceProfileId, opts.voiceProfileId))
    : sql`false`;

  return db
    .select({ save: saves, rewrite: rewrites })
    .from(saves)
    .leftJoin(rewrites, rewriteJoin)
    .where(and(...conditions))
    .orderBy(desc(saves.createdAt))
    .limit(limit);
}

export async function getRewrite(db: Database, saveId: string, voiceProfileId: string) {
  const [row] = await db
    .select()
    .from(rewrites)
    .where(and(eq(rewrites.saveId, saveId), eq(rewrites.voiceProfileId, voiceProfileId)))
    .limit(1);
  return row ?? null;
}

export async function upsertRewrite(db: Database, saveId: string, voiceProfileId: string, rewrite: Rewrite) {
  const values = {
    saveId,
    voiceProfileId,
    headline: rewrite.headline,
    paraphrase: rewrite.paraphrase,
    actionSteps: rewrite.action_steps,
  };
  const [row] = await db
    .insert(rewrites)
    .values(values)
    .onConflictDoUpdate({
      target: [rewrites.saveId, rewrites.voiceProfileId],
      set: { headline: values.headline, paraphrase: values.paraphrase, actionSteps: values.actionSteps, createdAt: new Date() },
    })
    .returning();
  return row!;
}

/** Nearest saves by cosine similarity of their embeddings. */
export async function relatedSaves(db: Database, userId: string, saveId: string, limit = 5) {
  const [target] = await db
    .select({ embedding: saves.embedding })
    .from(saves)
    .where(and(eq(saves.userId, userId), eq(saves.id, saveId)))
    .limit(1);
  if (!target?.embedding) return [];
  const distance = cosineDistance(saves.embedding, target.embedding);
  return db
    .select({
      id: saves.id,
      author: saves.author,
      platform: saves.platform,
      domain: saves.domain,
      summary: saves.summary,
      similarity: sql<number>`1 - (${distance})`,
    })
    .from(saves)
    .where(and(eq(saves.userId, userId), ne(saves.id, saveId), isNotNull(saves.embedding)))
    .orderBy(distance)
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Rewarded-ad unlocks
// ---------------------------------------------------------------------------

export async function createAdUnlock(
  db: Database,
  values: { userId: string; saveId: string; voiceProfileId: string | null; adNetwork?: string },
) {
  const [row] = await db
    .insert(adUnlocks)
    .values({ ...values, adNetwork: values.adNetwork ?? "admob" })
    .returning();
  return row!;
}

export async function getAdUnlock(db: Database, id: string) {
  const [row] = await db.select().from(adUnlocks).where(eq(adUnlocks.id, id)).limit(1);
  return row ?? null;
}

/**
 * Marks an unlock as verified by the ad network. Returns the row only the
 * first time (null when already verified or the transaction was replayed).
 */
export async function verifyAdUnlock(db: Database, id: string, userId: string, transactionId: string) {
  try {
    const [row] = await db
      .update(adUnlocks)
      .set({ rewardVerifiedAt: new Date(), transactionId })
      .where(and(eq(adUnlocks.id, id), eq(adUnlocks.userId, userId), sql`${adUnlocks.rewardVerifiedAt} is null`))
      .returning();
    return row ?? null;
  } catch (err) {
    // Unique violation on transaction_id: the same reward was already redeemed.
    if (isUniqueViolation(err)) return null;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Media jobs (a tiny Postgres-backed queue)
// ---------------------------------------------------------------------------

export const MAX_JOB_ATTEMPTS = 3;

export async function enqueueMediaJob(db: Database, saveId: string) {
  const [row] = await db.insert(mediaJobs).values({ saveId }).returning();
  return row!;
}

/**
 * Claims up to `limit` jobs. Jobs stuck in "running" for over 15 minutes
 * (a crashed function) are reclaimed. SKIP LOCKED lets cron and the inline
 * trigger run concurrently without double-processing.
 */
export async function claimMediaJobs(db: Database, limit = 1, jobId?: string) {
  const idFilter = jobId ? sql`and id = ${jobId}` : sql``;
  const result = await db.execute<{ id: string; save_id: string; attempts: number }>(sql`
    update media_jobs set status = 'running', attempts = attempts + 1, locked_at = now(), updated_at = now()
    where id in (
      select id from media_jobs
      where (status = 'queued' or (status = 'running' and locked_at < now() - interval '15 minutes'))
        and attempts < ${MAX_JOB_ATTEMPTS} ${idFilter}
      order by created_at
      limit ${limit}
      for update skip locked
    )
    returning id, save_id, attempts`);
  const rows = Array.isArray(result) ? result : (result as { rows: unknown[] }).rows;
  return (rows as { id: string; save_id: string; attempts: number }[]).map((r) => ({
    id: r.id,
    saveId: r.save_id,
    attempts: Number(r.attempts),
  }));
}

export async function finishMediaJob(db: Database, id: string, error?: string, attempts = 0) {
  const failedForGood = Boolean(error) && attempts >= MAX_JOB_ATTEMPTS;
  await db
    .update(mediaJobs)
    .set({
      status: error ? (failedForGood ? "failed" : "queued") : "done",
      lastError: error ?? null,
      lockedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(mediaJobs.id, id));
  return { failedForGood };
}

// ---------------------------------------------------------------------------
// Social connections
// ---------------------------------------------------------------------------

export async function getSocialConnection(db: Database, userId: string, platform: SaveRow["platform"]) {
  const [row] = await db
    .select()
    .from(socialConnections)
    .where(and(eq(socialConnections.userId, userId), eq(socialConnections.platform, platform)))
    .limit(1);
  return row ?? null;
}

export async function upsertSocialConnection(
  db: Database,
  values: typeof socialConnections.$inferInsert,
) {
  const { userId: _u, platform: _p, ...rest } = values;
  const [row] = await db
    .insert(socialConnections)
    .values(values)
    .onConflictDoUpdate({ target: [socialConnections.userId, socialConnections.platform], set: rest })
    .returning();
  return row!;
}

export async function listActiveXConnections(db: Database, userIds?: string[]) {
  return db
    .select()
    .from(socialConnections)
    .where(
      and(
        eq(socialConnections.platform, "x"),
        eq(socialConnections.status, "active"),
        userIds?.length ? inArray(socialConnections.userId, userIds) : undefined,
      ),
    );
}

// ---------------------------------------------------------------------------
// Billing + waitlist
// ---------------------------------------------------------------------------

/** Returns false when the event id was already processed. */
export async function recordRevenuecatEvent(db: Database, id: string, type: string, userId: string | null) {
  const rows = await db
    .insert(revenuecatEvents)
    .values({ id, type, userId })
    .onConflictDoNothing()
    .returning({ id: revenuecatEvents.id });
  return rows.length > 0;
}

export async function addToWaitlist(db: Database, email: string, persona?: string | null) {
  await db
    .insert(waitlist)
    .values({ email: email.toLowerCase(), persona: persona ?? null })
    .onConflictDoNothing();
}

export function isUniqueViolation(err: unknown): boolean {
  let e: unknown = err;
  for (let i = 0; i < 3 && e; i++) {
    if (typeof e === "object" && e && "code" in e && (e as { code?: string }).code === "23505") return true;
    e = typeof e === "object" && e && "cause" in e ? (e as { cause?: unknown }).cause : undefined;
  }
  return false;
}
