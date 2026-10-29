import { processVideo } from "@echo/core/server";
import { claimMediaJobs, finishMediaJob, getSaveById, updateSave } from "@echo/db";
import type { ServiceContext } from "./context";
import { processSave } from "./saves";

const VIDEO_URL = /\.(mp4|mov|m4v|webm)(\?|$)/i;

/**
 * Background media work: transcribe audio (Whisper) and OCR keyframes, then
 * run the normal classify/rewrite step. Called right after the upload via
 * `after()` and swept by the cron route for retries.
 */
export async function runMediaJobs(ctx: ServiceContext, opts: { jobId?: string; limit?: number } = {}) {
  const jobs = await claimMediaJobs(ctx.db, opts.limit ?? 1, opts.jobId);
  const results: { jobId: string; ok: boolean; error?: string }[] = [];

  for (const job of jobs) {
    const save = await getSaveById(ctx.db, job.saveId);
    if (!save) {
      await finishMediaJob(ctx.db, job.id);
      continue;
    }
    try {
      const videoUrl = save.mediaUrls.find((u) => VIDEO_URL.test(u));
      if (videoUrl && ctx.media.ffmpegPath) {
        const deps = await ctx.pipelineDeps(save.userId);
        const result = await processVideo(videoUrl, {
          ffmpegPath: ctx.media.ffmpegPath,
          transcriber: ctx.media.transcriber,
          llm: deps.llm,
          fetch: deps.fetch,
          lookup: deps.lookup,
        });
        await updateSave(ctx.db, save.id, {
          transcript: result.transcript,
          ocrText: [save.ocrText, result.ocrText].filter(Boolean).join("\n\n") || null,
        });
      }
      await processSave(ctx, save.id, { reanalyze: true });
      await finishMediaJob(ctx.db, job.id);
      results.push({ jobId: job.id, ok: true });
    } catch (err) {
      const message = (err as Error).message;
      const { failedForGood } = await finishMediaJob(ctx.db, job.id, message, job.attempts);
      if (failedForGood) {
        // Keep whatever text we have; a save with words is still useful.
        const hasText = Boolean(save.verbatimText || save.ocrText);
        if (hasText) await processSave(ctx, save.id).catch(() => undefined);
        else await updateSave(ctx.db, save.id, { status: "failed", error: "We couldn't process this video." });
      }
      results.push({ jobId: job.id, ok: false, error: message });
    }
  }
  return results;
}
