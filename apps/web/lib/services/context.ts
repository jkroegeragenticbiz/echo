import type { Database } from "@echo/db";
import type { PipelineDeps, Transcriber } from "@echo/core/server";

/**
 * Everything a service needs from the outside world. Routes build the real
 * one (lib/services/runtime.ts); tests pass PGlite plus fixture providers.
 */
export interface ServiceContext {
  db: Database;
  pipelineDeps(userId: string): Promise<PipelineDeps>;
  media: { ffmpegPath: string | null; transcriber: Transcriber | null };
  /** Run work after the response is sent (next/server `after` in production). */
  defer(task: () => Promise<void>): void;
  config: { freeSavesPerMonth: number; admobRewardedUnitId: string };
}
