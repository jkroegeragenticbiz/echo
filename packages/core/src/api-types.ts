import type { Classification, Domain, KeyMetric, Platform, Rewrite, Structured } from "./schemas";

/** Shape returned by GET /api/saves and used by the web and iOS library. */
export interface SaveDTO {
  id: string;
  platform: Platform;
  source_url: string | null;
  author: string | null;
  verbatim_text: string;
  domain: Domain;
  structured: Structured | null;
  key_metric: KeyMetric | null;
  summary: string | null;
  media_urls: string[];
  created_at: string;
  status: SaveStatus;
  rewrite: RewriteDTO | null;
}

/**
 * ready: a rewrite exists for the requested voice.
 * needs_rewrite: no rewrite for that voice yet (free users unlock it with an ad).
 * processing: a media job (transcription/OCR) is still running.
 */
export type SaveStatus = "ready" | "needs_rewrite" | "processing" | "failed";

export interface RewriteDTO extends Rewrite {
  id: string;
  voice_profile_id: string;
  created_at: string;
}

export interface CreateSaveResponse {
  save: SaveDTO;
  duplicate: boolean;
  /** Present when the user is on the free plan and must watch a rewarded ad. */
  unlock?: { ad_unlock_id: string; ad_unit_id: string };
  usage: { used: number; limit: number | null };
}

export interface RelatedSaveDTO {
  id: string;
  headline: string | null;
  author: string | null;
  platform: Platform;
  domain: Domain;
  similarity: number;
}

export interface MeDTO {
  id: string;
  email: string | null;
  plan: "free" | "plus";
  usage: { used: number; limit: number | null };
}

export type { Classification };
