import type { RewriteDTO, SaveDTO, SaveStatus } from "@echo/core";
import type { RewriteRow, SaveRow } from "@echo/db";

export function toRewriteDTO(row: RewriteRow): RewriteDTO {
  return {
    id: row.id,
    voice_profile_id: row.voiceProfileId,
    headline: row.headline,
    paraphrase: row.paraphrase,
    action_steps: row.actionSteps,
    created_at: row.createdAt.toISOString(),
  };
}

export function saveStatus(save: SaveRow, rewrite: RewriteRow | null): SaveStatus {
  if (save.status === "processing") return "processing";
  if (save.status === "failed") return "failed";
  return rewrite ? "ready" : "needs_rewrite";
}

export function toSaveDTO(save: SaveRow, rewrite: RewriteRow | null): SaveDTO {
  return {
    id: save.id,
    platform: save.platform,
    source_url: save.sourceUrl,
    author: save.author,
    verbatim_text: save.verbatimText || save.ocrText || "",
    domain: save.domain,
    structured: save.structured,
    key_metric: save.keyMetric,
    summary: save.summary,
    media_urls: save.mediaUrls,
    created_at: save.createdAt.toISOString(),
    status: saveStatus(save, rewrite),
    rewrite: rewrite ? toRewriteDTO(rewrite) : null,
  };
}
