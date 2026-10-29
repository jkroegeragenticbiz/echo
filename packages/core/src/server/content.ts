import { createHash } from "node:crypto";
import { normalizeForHash } from "../url";
import type { Platform } from "../schemas";

/** Normalized result of the ingest step, ready for classification. */
export interface IngestedContent {
  platform: Platform;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  /** Platform-native id (e.g. X post id). */
  externalId: string | null;
  author: string | null;
  /** The post's own words, word for word. Never rewritten. */
  verbatimText: string;
  mediaUrls: string[];
  ocrText: string | null;
  transcript: string | null;
  /** True when a video still needs transcription/keyframe OCR in a background job. */
  needsMediaJob: boolean;
  /** Where the text came from, for debugging and the data-use page. */
  via: "x_api" | "x_oembed" | "oembed" | "opengraph" | "client" | "manual";
}

/** Below this length a hash would collide too easily to be a useful dedupe key. */
const MIN_HASH_LENGTH = 24;

export function contentHash(content: Pick<IngestedContent, "verbatimText" | "ocrText">): string | null {
  const basis = normalizeForHash(content.verbatimText || content.ocrText || "");
  if (basis.length < MIN_HASH_LENGTH) return null;
  return createHash("sha256").update(basis).digest("hex");
}

/** Text used for the embedding: what the post is about, not how it's formatted. */
export function embeddingText(content: IngestedContent, summary?: string | null): string {
  const text = [summary, content.verbatimText, content.ocrText, content.transcript].filter(Boolean).join("\n\n");
  // text-embedding-3-small accepts ~8k tokens; keep well under that.
  return text.slice(0, 24_000);
}
