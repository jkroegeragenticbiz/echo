import { and, eq, isNotNull } from "drizzle-orm";
import { canonicalizeUrl, extractXPostId, type CreateSaveInput, type CreateSaveResponse, type Classification, type SaveDTO } from "@echo/core";
import {
  analyze,
  contentHash,
  ingest,
  rewriteInVoice,
  type IngestedContent,
} from "@echo/core/server";
import {
  adUnlocks,
  countSavesThisMonth,
  createAdUnlock,
  effectivePlan,
  enqueueMediaJob,
  findDuplicateSave,
  getActiveVoiceProfile,
  getRewrite,
  getSave,
  getSaveById,
  getUser,
  getVoiceProfile,
  insertSave,
  isUniqueViolation,
  updateSave,
  upsertRewrite,
  type SaveRow,
  type VoiceProfileRow,
} from "@echo/db";
import { HttpError } from "../http";
import type { ServiceContext } from "./context";
import { toSaveDTO } from "./dto";
import { ensureActiveVoice, toVoiceDTO } from "./voices";

export async function getUsage(ctx: ServiceContext, userId: string) {
  const user = await getUser(ctx.db, userId);
  if (!user) throw new HttpError(401, "Sign in to continue", "unauthorized");
  const plan = effectivePlan(user);
  const used = await countSavesThisMonth(ctx.db, userId);
  return { user, plan, used, limit: plan === "plus" ? null : ctx.config.freeSavesPerMonth };
}

export interface CreateSaveOptions {
  /** X bookmark sync imports in bulk and asks for ads later, per card. */
  createUnlock?: boolean;
}

/**
 * POST /api/saves. Ingests synchronously (fast: one fetch or the device's OCR),
 * stores the save, then classifies and rewrites after the response. Free users
 * get an ad unlock to redeem; Plus users get their rewrite with no ad.
 */
export async function createSave(
  ctx: ServiceContext,
  userId: string,
  input: CreateSaveInput,
  opts: CreateSaveOptions = {},
): Promise<CreateSaveResponse> {
  const { plan, used, limit } = await getUsage(ctx, userId);
  const voice = input.voice_profile_id
    ? await getVoiceProfile(ctx.db, userId, input.voice_profile_id)
    : await ensureActiveVoice(ctx.db, userId);
  if (!voice) throw new HttpError(404, "Voice not found", "voice_not_found");

  // Re-shares of a link we already have skip the fetch (and the quota check) entirely.
  if (input.url) {
    const early = await findDuplicateSave(ctx.db, userId, {
      canonicalUrl: canonicalizeUrl(input.url),
      externalId: extractXPostId(input.url),
    });
    if (early) return duplicateResponse(ctx, early, voice.id, { used, limit });
  }

  if (limit !== null && used >= limit) {
    throw new HttpError(
      402,
      `You've used all ${limit} free saves this month. Echo Plus gives you unlimited saves with no ads.`,
      "quota_exceeded",
    );
  }

  const deps = await ctx.pipelineDeps(userId);
  const content = await ingest(input, deps);
  const hash = contentHash(content);
  const keys = { canonicalUrl: content.canonicalUrl, contentHash: hash, externalId: content.externalId };

  const existing = await findDuplicateSave(ctx.db, userId, keys);
  if (existing) return duplicateResponse(ctx, existing, voice.id, { used, limit });

  let save: SaveRow;
  try {
    save = await insertSave(ctx.db, {
      userId,
      platform: content.platform,
      sourceUrl: content.sourceUrl,
      canonicalUrl: content.canonicalUrl,
      externalId: content.externalId,
      author: content.author,
      verbatimText: content.verbatimText,
      mediaUrls: content.mediaUrls,
      ocrText: content.ocrText,
      contentHash: hash,
      status: "processing",
    });
  } catch (err) {
    // Two devices saved the same post at once; the unique index caught it.
    if (!isUniqueViolation(err)) throw err;
    const raced = await findDuplicateSave(ctx.db, userId, keys);
    if (!raced) throw err;
    return duplicateResponse(ctx, raced, voice.id, { used, limit });
  }

  if (content.needsMediaJob) {
    const job = await enqueueMediaJob(ctx.db, save.id);
    ctx.defer(async () => {
      const { runMediaJobs } = await import("./media");
      await runMediaJobs(ctx, { jobId: job.id });
    });
  } else {
    ctx.defer(() => processSave(ctx, save.id).then(() => undefined));
  }

  let unlock: CreateSaveResponse["unlock"];
  if (plan === "free" && opts.createUnlock !== false) {
    const row = await createAdUnlock(ctx.db, { userId, saveId: save.id, voiceProfileId: voice.id });
    unlock = { ad_unlock_id: row.id, ad_unit_id: ctx.config.admobRewardedUnitId };
  }

  return { save: toSaveDTO(save, null), duplicate: false, unlock, usage: { used: used + 1, limit } };
}

async function duplicateResponse(
  ctx: ServiceContext,
  save: SaveRow,
  voiceId: string,
  usage: { used: number; limit: number | null },
): Promise<CreateSaveResponse> {
  const rewrite = await getRewrite(ctx.db, save.id, voiceId);
  return { save: toSaveDTO(save, rewrite), duplicate: true, usage };
}

/** Rebuilds the pipeline's view of a stored save. */
export function contentFromSave(save: SaveRow): IngestedContent {
  return {
    platform: save.platform,
    sourceUrl: save.sourceUrl,
    canonicalUrl: save.canonicalUrl,
    externalId: save.externalId,
    author: save.author,
    verbatimText: save.verbatimText,
    mediaUrls: save.mediaUrls,
    ocrText: save.ocrText,
    transcript: save.transcript,
    needsMediaJob: false,
    via: "manual",
  };
}

function classificationFromSave(save: SaveRow): Classification | null {
  if (!save.structured) return null;
  return { structured: save.structured, summary: save.summary ?? "", key_metric: save.keyMetric, topics: save.topics };
}

async function analyzeSave(ctx: ServiceContext, save: SaveRow): Promise<{ save: SaveRow; classification: Classification }> {
  const deps = await ctx.pipelineDeps(save.userId);
  const analysis = await analyze(contentFromSave(save), deps);
  const c = analysis.classification;
  const updated = await updateSave(ctx.db, save.id, {
    domain: c.structured.domain,
    structured: c.structured,
    summary: c.summary,
    keyMetric: c.key_metric,
    topics: c.topics,
    embedding: analysis.embedding,
  });
  return { save: updated ?? save, classification: c };
}

/** Voices this save may be rewritten into right now: Plus users' active voice, plus any voice unlocked by a verified ad. */
async function entitledVoices(ctx: ServiceContext, save: SaveRow): Promise<VoiceProfileRow[]> {
  const user = await getUser(ctx.db, save.userId);
  if (!user) return [];
  const voices = new Map<string, VoiceProfileRow>();
  if (effectivePlan(user) === "plus") {
    const active = await getActiveVoiceProfile(ctx.db, save.userId);
    if (active) voices.set(active.id, active);
  }
  const unlocked = await ctx.db
    .select({ voiceProfileId: adUnlocks.voiceProfileId })
    .from(adUnlocks)
    .where(and(eq(adUnlocks.saveId, save.id), isNotNull(adUnlocks.rewardVerifiedAt)));
  for (const { voiceProfileId } of unlocked) {
    if (!voiceProfileId || voices.has(voiceProfileId)) continue;
    const voice = await getVoiceProfile(ctx.db, save.userId, voiceProfileId);
    if (voice) voices.set(voice.id, voice);
  }
  return [...voices.values()];
}

/**
 * Classify + embed (step 2/4), then rewrite (step 3) for every voice the user
 * is entitled to, then mark the save ready. Safe to call more than once.
 */
export async function processSave(ctx: ServiceContext, saveId: string, opts: { reanalyze?: boolean } = {}) {
  let save = await getSaveById(ctx.db, saveId);
  if (!save) return null;
  let classification = classificationFromSave(save);
  if (!classification || opts.reanalyze) ({ save, classification } = await analyzeSave(ctx, save));

  let rewriteError: string | null = null;
  for (const voice of await entitledVoices(ctx, save)) {
    if (await getRewrite(ctx.db, save.id, voice.id)) continue;
    try {
      await generateRewrite(ctx, save, classification, voice);
    } catch (err) {
      rewriteError = (err as Error).message;
      console.error(`Rewrite failed for save ${save.id}:`, rewriteError);
    }
  }
  return updateSave(ctx.db, save.id, { status: "ready", error: rewriteError });
}

async function generateRewrite(ctx: ServiceContext, save: SaveRow, classification: Classification, voice: VoiceProfileRow) {
  const deps = await ctx.pipelineDeps(save.userId);
  const rewrite = await rewriteInVoice(contentFromSave(save), classification, toVoiceDTO(voice), deps.llm);
  return upsertRewrite(ctx.db, save.id, voice.id, rewrite);
}

/**
 * Rewrites one save into one voice if the user is entitled to it. While the
 * save is still processing this is a no-op: processSave will pick up the
 * verified unlock when analysis finishes.
 */
export async function ensureRewrite(ctx: ServiceContext, saveId: string, voiceId: string) {
  const save = await getSaveById(ctx.db, saveId);
  if (!save || save.status === "processing") return null;
  const existing = await getRewrite(ctx.db, saveId, voiceId);
  if (existing) return existing;
  const voice = await getVoiceProfile(ctx.db, save.userId, voiceId);
  if (!voice) return null;
  let classification = classificationFromSave(save);
  let current = save;
  if (!classification) ({ save: current, classification } = await analyzeSave(ctx, save));
  try {
    const row = await generateRewrite(ctx, current, classification, voice);
    await updateSave(ctx.db, save.id, { error: null });
    return row;
  } catch (err) {
    await updateSave(ctx.db, save.id, { error: (err as Error).message });
    throw err;
  }
}

export interface RewriteRequestResult {
  save: SaveDTO;
  unlock?: { ad_unlock_id: string; ad_unit_id: string };
}

/** POST /api/saves/:id/rewrite. Plus: generate now. Free: redeem a verified ad or get a new unlock to watch. */
export async function requestRewrite(
  ctx: ServiceContext,
  userId: string,
  saveId: string,
  voiceId?: string,
): Promise<RewriteRequestResult> {
  const save = await getSave(ctx.db, userId, saveId);
  if (!save) throw new HttpError(404, "Save not found", "not_found");
  const voice = voiceId ? await getVoiceProfile(ctx.db, userId, voiceId) : await ensureActiveVoice(ctx.db, userId);
  if (!voice) throw new HttpError(404, "Voice not found", "voice_not_found");

  const existing = await getRewrite(ctx.db, save.id, voice.id);
  if (existing) return { save: toSaveDTO(save, existing) };

  const { plan } = await getUsage(ctx, userId);
  let entitled = plan === "plus";
  if (!entitled) {
    const [verified] = await ctx.db
      .select({ id: adUnlocks.id })
      .from(adUnlocks)
      .where(and(eq(adUnlocks.saveId, save.id), eq(adUnlocks.voiceProfileId, voice.id), isNotNull(adUnlocks.rewardVerifiedAt)))
      .limit(1);
    entitled = Boolean(verified);
  }

  if (!entitled) {
    const row = await createAdUnlock(ctx.db, { userId, saveId: save.id, voiceProfileId: voice.id });
    return { save: toSaveDTO(save, null), unlock: { ad_unlock_id: row.id, ad_unit_id: ctx.config.admobRewardedUnitId } };
  }

  ctx.defer(async () => {
    await ensureRewrite(ctx, save.id, voice.id);
  });
  return { save: toSaveDTO(save, null) };
}
