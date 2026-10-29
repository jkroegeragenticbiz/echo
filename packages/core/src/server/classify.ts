import { z } from "zod";
import {
  CareerSalesSchema,
  DomainSchema,
  FitnessNutritionSchema,
  GeneralInsightSchema,
  KeyMetricSchema,
  MarketsThesisSchema,
  type Classification,
  type Domain,
  type Structured,
} from "../schemas";
import type { IngestedContent } from "./content";
import { extractCashtags, guessDomain } from "./heuristics";
import { CLASSIFIER_SYSTEM, classifierPrompt } from "./prompts";
import type { LlmProvider } from "./providers/types";

/**
 * Flat schema the model fills (one nullable block per domain). Easier for
 * structured output than a discriminated union; normalized below.
 */
export const ClassifierOutputSchema = z.object({
  domain: DomainSchema,
  summary: z.string(),
  key_metric: KeyMetricSchema.nullable(),
  topics: z.array(z.string()),
  markets: MarketsThesisSchema.nullable(),
  fitness: FitnessNutritionSchema.nullable(),
  career: CareerSalesSchema.nullable(),
  general: GeneralInsightSchema.nullable(),
});
export type ClassifierOutput = z.infer<typeof ClassifierOutputSchema>;

export async function classifyContent(content: IngestedContent, llm: LlmProvider): Promise<Classification> {
  const text = [content.verbatimText, content.ocrText, content.transcript].filter(Boolean).join("\n");
  const guess = guessDomain(text);
  const output = await llm.generateObject({
    task: "classify",
    schemaName: "classification",
    system: CLASSIFIER_SYSTEM,
    prompt: classifierPrompt(content, guess.score > 0 ? guess.domain : null),
    images: [],
    schema: ClassifierOutputSchema,
  });
  return normalizeClassification(output, text);
}

export function normalizeClassification(output: ClassifierOutput, sourceText: string): Classification {
  return {
    structured: toStructured(output, sourceText),
    summary: output.summary.trim(),
    key_metric: output.key_metric,
    topics: output.topics.map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 4),
  };
}

function toStructured(o: ClassifierOutput, sourceText: string): Structured {
  switch (o.domain) {
    case "markets_thesis":
      return {
        domain: "markets_thesis",
        data: o.markets
          ? { ...o.markets, tickers: [...new Set(o.markets.tickers.map((t) => t.replace(/^\$/, "").toUpperCase()))] }
          : emptyMarkets(sourceText),
      };
    case "fitness_nutrition":
      return { domain: "fitness_nutrition", data: o.fitness ?? { exercises: [], macros: null, ingredients: [], timing: null } };
    case "career_sales":
      return {
        domain: "career_sales",
        data: o.career ?? { core_mechanism: o.summary, scripts: [], rules: [], before_after: null },
      };
    default:
      return { domain: o.domain, data: o.general ?? { key_ideas: [o.summary], quotes: [] } };
  }
}

function emptyMarkets(sourceText: string) {
  return {
    tickers: extractCashtags(sourceText),
    direction: "neutral" as const,
    bull_case: [],
    bear_case: [],
    catalysts: [],
    key_metrics: [],
    invalidation_triggers: [],
    time_horizon: null,
  };
}

/** Used when the model is unavailable: file the save by keyword so it still shows up. */
export function fallbackClassification(content: IngestedContent): Classification {
  const text = [content.verbatimText, content.ocrText, content.transcript].filter(Boolean).join("\n");
  const domain: Domain = guessDomain(text).domain;
  const firstLine = text.split("\n").find((l) => l.trim())?.trim() ?? "";
  return normalizeClassification(
    {
      domain,
      summary: firstLine.slice(0, 160),
      key_metric: null,
      topics: [],
      markets: null,
      fitness: null,
      career: null,
      general: null,
    },
    text,
  );
}
