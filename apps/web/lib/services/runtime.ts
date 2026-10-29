import "server-only";
import { after } from "next/server";
import { createRequire } from "node:module";
import { createEmbedder, createLlmProvider, createTranscriber, type LlmProvider } from "@echo/core/server";
import { getDb } from "@echo/db";
import { env } from "../env";
import type { ServiceContext } from "./context";
import { getXClient } from "./x";

let llm: LlmProvider | null = null;

function ffmpegPath(): string | null {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    return createRequire(import.meta.url)("ffmpeg-static") as string | null;
  } catch {
    return null;
  }
}

/** The production ServiceContext: real database, providers and `after()`. */
export function serviceContext(): ServiceContext {
  const db = getDb();
  return {
    db,
    async pipelineDeps(userId) {
      llm ??= createLlmProvider();
      const x = process.env.X_CLIENT_ID
        ? await getXClient(db, userId, { clientId: env.xClientId, clientSecret: env.xClientSecret, secret: env.authSecret })
        : null;
      return { llm, embedder: createEmbedder(), x: x?.client ?? null };
    },
    media: { ffmpegPath: ffmpegPath(), transcriber: createTranscriber() },
    defer(task) {
      after(async () => {
        try {
          await task();
        } catch (err) {
          console.error("Background task failed:", err);
        }
      });
    },
    config: { freeSavesPerMonth: env.freeSavesPerMonth, admobRewardedUnitId: env.admobRewardedUnitId },
  };
}

export function xConfig() {
  return {
    clientId: env.xClientId,
    clientSecret: env.xClientSecret,
    redirectUri: `${env.appUrl}/api/x/callback`,
    secret: env.authSecret,
  };
}
