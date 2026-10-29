import { z } from "zod";
import { RewriteSchema, type Classification, type Rewrite, type VoiceProfile } from "../schemas";
import type { IngestedContent } from "./content";
import { findUnsupportedFacts, type FactViolation } from "./fact-guard";
import { REWRITE_SYSTEM, rewritePrompt, sourceBody } from "./prompts";
import { LlmOutputError, type LlmProvider } from "./providers/types";

/** Loose schema for the model (no length limits); tightened by RewriteSchema after cleanup. */
const RewriteOutputSchema = z.object({
  headline: z.string(),
  paraphrase: z.string(),
  action_steps: z.array(z.string()),
});

export class UnsupportedFactsError extends LlmOutputError {
  constructor(readonly violations: FactViolation[]) {
    super(`Rewrite mentioned facts not in the source: ${violations.map((v) => v.value).join(", ")}`);
    this.name = "UnsupportedFactsError";
  }
}

export type VoiceInput = Pick<VoiceProfile, "name" | "personas" | "description" | "perspective" | "tone" | "voice_sample">;

/**
 * Generates { headline, paraphrase, action_steps } in the given voice. If the
 * draft mentions any number or ticker that isn't in the source, it retries
 * once with the violations spelled out, then gives up rather than store it.
 */
export async function rewriteInVoice(
  content: IngestedContent,
  classification: Classification,
  voice: VoiceInput,
  llm: LlmProvider,
): Promise<Rewrite> {
  // Structured data is derived from the source, so its values count as "in the source" too.
  const factBasis = `${sourceBody(content)}\n${JSON.stringify(classification.structured.data)}`;
  let correction: string | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    const draft = await llm.generateObject({
      task: "rewrite",
      schemaName: "rewrite",
      system: REWRITE_SYSTEM,
      prompt: rewritePrompt(content, classification, voice, correction),
      schema: RewriteOutputSchema,
    });
    const rewrite = cleanRewrite(draft);
    const violations = findUnsupportedFacts(factBasis, rewrite);
    if (violations.length === 0) return rewrite;
    if (attempt === 1) throw new UnsupportedFactsError(violations);
    correction = `It mentioned ${violations.map((v) => `"${v.value}"`).join(", ")}, which ${violations.length === 1 ? "does" : "do"} not appear in the source.`;
  }
  throw new LlmOutputError("unreachable");
}

/** Trims whitespace/quotes, drops emojis and enforces 3-5 steps. */
export function cleanRewrite(draft: z.infer<typeof RewriteOutputSchema>): Rewrite {
  const tidy = (s: string) =>
    s
      .replace(/\p{Extended_Pictographic}️?/gu, "")
      .replace(/^["'\s]+|["'\s]+$/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([.,!?;:])/g, "$1")
      .trim();
  const steps = draft.action_steps.map((s) => tidy(s).replace(/^(\d+[.)]|[-*•])\s*/, "")).filter(Boolean);
  const parsed = RewriteSchema.safeParse({
    headline: tidy(draft.headline).replace(/\.$/, "").trim().slice(0, 140),
    paraphrase: tidy(draft.paraphrase),
    action_steps: steps.slice(0, 5),
  });
  if (!parsed.success) {
    throw new LlmOutputError(`Rewrite failed validation: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
  }
  return parsed.data;
}
