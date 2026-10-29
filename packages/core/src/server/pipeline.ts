import type { Classification, CreateSaveInput, Rewrite } from "../schemas";
import { classifyContent, fallbackClassification } from "./classify";
import { contentHash, embeddingText, type IngestedContent } from "./content";
import { ingest, type IngestDeps } from "./ingest";
import type { Embedder } from "./providers/types";
import { rewriteInVoice, type VoiceInput } from "./rewrite";

export interface PipelineDeps extends IngestDeps {
  embedder: Embedder | null;
}

export interface Analysis {
  classification: Classification;
  /** True when the model call failed and we filed the save by keyword instead. */
  classificationFallback: boolean;
  embedding: number[] | null;
}

/**
 * Steps 2 and 4: classify into a domain with structured fields, then embed.
 * Neither failure loses the save: classification falls back to keywords and a
 * missing embedding only hides "related saves".
 */
export async function analyze(content: IngestedContent, deps: PipelineDeps): Promise<Analysis> {
  let classification: Classification;
  let classificationFallback = false;
  try {
    classification = await classifyContent(content, deps.llm);
  } catch (err) {
    console.error("Classification failed, using keyword fallback:", (err as Error).message);
    classification = fallbackClassification(content);
    classificationFallback = true;
  }

  let embedding: number[] | null = null;
  if (deps.embedder) {
    try {
      [embedding = null] = await deps.embedder.embed([embeddingText(content, classification.summary)]);
    } catch (err) {
      console.error("Embedding failed:", (err as Error).message);
    }
  }
  return { classification, classificationFallback, embedding };
}

export interface PipelineResult extends Analysis {
  content: IngestedContent;
  contentHash: string | null;
  rewrite: Rewrite | null;
}

/**
 * The whole pipeline for content that needs no background media work:
 * ingest -> classify -> rewrite (when a voice is given) -> embed.
 * The API route runs the steps individually so it can dedupe and gate the
 * rewrite behind a rewarded ad; this is the reference composition.
 */
export async function runPipeline(
  input: CreateSaveInput,
  deps: PipelineDeps,
  voice: VoiceInput | null,
): Promise<PipelineResult> {
  const content = await ingest(input, deps);
  const analysis = await analyze(content, deps);
  const rewrite = voice ? await rewriteInVoice(content, analysis.classification, voice, deps.llm) : null;
  return { content, contentHash: contentHash(content), ...analysis, rewrite };
}
