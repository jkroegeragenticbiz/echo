import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums shared by the database, API and both clients.
// ---------------------------------------------------------------------------

export const PLATFORMS = ["x", "linkedin", "instagram", "tiktok", "youtube", "web", "manual"] as const;
export const PlatformSchema = z.enum(PLATFORMS);
export type Platform = z.infer<typeof PlatformSchema>;

export const DOMAINS = ["career_sales", "markets_thesis", "fitness_nutrition", "mindset", "tech", "other"] as const;
export const DomainSchema = z.enum(DOMAINS);
export type Domain = z.infer<typeof DomainSchema>;

export const PERSPECTIVES = ["first_person", "coach", "checklist"] as const;
export const PerspectiveSchema = z.enum(PERSPECTIVES);
export type Perspective = z.infer<typeof PerspectiveSchema>;

export const PLANS = ["free", "plus"] as const;
export const PlanSchema = z.enum(PLANS);
export type Plan = z.infer<typeof PlanSchema>;

export const TONES = [
  "direct",
  "warm",
  "analytical",
  "playful",
  "calm",
  "motivating",
  "skeptical",
  "concise",
] as const;
export const ToneSchema = z.enum(TONES);
export type Tone = z.infer<typeof ToneSchema>;

// ---------------------------------------------------------------------------
// Structured fields extracted by the classifier, one shape per domain.
// These schemas are also sent to the model as the structured-output format,
// so they avoid numeric/length constraints (validated separately instead).
// ---------------------------------------------------------------------------

export const KeyMetricSchema = z.object({
  label: z.string().describe("Short label, e.g. 'Reply rate' or 'Target'"),
  value: z.string().describe("Value exactly as written in the source, e.g. '31%' or '$140'"),
});
export type KeyMetric = z.infer<typeof KeyMetricSchema>;

export const MarketsThesisSchema = z.object({
  tickers: z.array(z.string()).describe("Uppercase tickers without the $ sign"),
  direction: z.enum(["long", "short", "neutral", "mixed"]),
  bull_case: z.array(z.string()),
  bear_case: z.array(z.string()),
  catalysts: z.array(z.string()),
  key_metrics: z.array(KeyMetricSchema),
  invalidation_triggers: z.array(z.string()),
  time_horizon: z.string().nullable(),
});
export type MarketsThesis = z.infer<typeof MarketsThesisSchema>;

export const ExerciseSchema = z.object({
  name: z.string(),
  sets: z.number().nullable(),
  reps: z.string().nullable().describe("Keep ranges verbatim, e.g. '6-8' or 'AMRAP'"),
  rest: z.string().nullable(),
  tempo: z.string().nullable(),
  notes: z.string().nullable(),
});
export type Exercise = z.infer<typeof ExerciseSchema>;

export const MacrosSchema = z.object({
  calories: z.number().nullable(),
  protein_g: z.number().nullable(),
  carbs_g: z.number().nullable(),
  fat_g: z.number().nullable(),
});

export const FitnessNutritionSchema = z.object({
  exercises: z.array(ExerciseSchema),
  macros: MacrosSchema.nullable(),
  ingredients: z.array(z.object({ item: z.string(), quantity: z.string().nullable() })),
  timing: z.string().nullable(),
});
export type FitnessNutrition = z.infer<typeof FitnessNutritionSchema>;

export const CareerSalesSchema = z.object({
  core_mechanism: z.string(),
  scripts: z.array(z.string()).describe("Exact scripts or phrasing, verbatim from the source"),
  rules: z.array(z.string()),
  before_after: z.object({ before: z.string(), after: z.string() }).nullable(),
});
export type CareerSales = z.infer<typeof CareerSalesSchema>;

export const GeneralInsightSchema = z.object({
  key_ideas: z.array(z.string()),
  quotes: z.array(z.string()).describe("Memorable lines, verbatim"),
});
export type GeneralInsight = z.infer<typeof GeneralInsightSchema>;

/** Stored in saves.structured: a tagged union keyed by domain. */
export const StructuredSchema = z.discriminatedUnion("domain", [
  z.object({ domain: z.literal("markets_thesis"), data: MarketsThesisSchema }),
  z.object({ domain: z.literal("fitness_nutrition"), data: FitnessNutritionSchema }),
  z.object({ domain: z.literal("career_sales"), data: CareerSalesSchema }),
  z.object({ domain: z.literal("mindset"), data: GeneralInsightSchema }),
  z.object({ domain: z.literal("tech"), data: GeneralInsightSchema }),
  z.object({ domain: z.literal("other"), data: GeneralInsightSchema }),
]);
export type Structured = z.infer<typeof StructuredSchema>;

/** Full classifier result stored alongside the save. */
export const ClassificationSchema = z.object({
  structured: StructuredSchema,
  summary: z.string(),
  key_metric: KeyMetricSchema.nullable(),
  topics: z.array(z.string()),
});
export type Classification = z.infer<typeof ClassificationSchema>;

// ---------------------------------------------------------------------------
// Rewrites
// ---------------------------------------------------------------------------

export const RewriteSchema = z.object({
  headline: z.string().min(1).max(140),
  paraphrase: z.string().min(1),
  action_steps: z.array(z.string().min(1)).min(3).max(5),
});
export type Rewrite = z.infer<typeof RewriteSchema>;

// ---------------------------------------------------------------------------
// Voice profiles
// ---------------------------------------------------------------------------

export const VoiceProfileInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  personas: z.array(z.string().min(1).max(40)).min(1).max(8),
  description: z.string().trim().max(500).default(""),
  perspective: PerspectiveSchema.default("first_person"),
  tone: z.array(ToneSchema).max(4).default([]),
  voice_sample: z.string().trim().max(2000).nullable().default(null),
});
export type VoiceProfileInput = z.input<typeof VoiceProfileInputSchema>;

export interface VoiceProfile {
  id: string;
  name: string;
  personas: string[];
  description: string;
  perspective: Perspective;
  tone: Tone[];
  voice_sample: string | null;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Ingest request (POST /api/saves)
// ---------------------------------------------------------------------------

export const CreateSaveSchema = z
  .object({
    url: z.url().optional(),
    text: z.string().max(20_000).optional(),
    /** Text recognised on-device (Apple Vision in the Share Extension). */
    ocr_text: z.string().max(20_000).optional(),
    /** Media already uploaded to Blob storage by the client. */
    media: z
      .array(
        z.object({
          url: z.url(),
          kind: z.enum(["image", "video"]),
          content_type: z.string().optional(),
        }),
      )
      .max(10)
      .optional(),
    platform: PlatformSchema.optional(),
    /** Which voice to rewrite with; defaults to the user's active profile. */
    voice_profile_id: z.uuid().optional(),
  })
  .refine((v) => Boolean(v.url || v.text || v.ocr_text || v.media?.length), {
    message: "Provide a url, text, ocr_text or media",
  });
export type CreateSaveInput = z.infer<typeof CreateSaveSchema>;

export const WaitlistSchema = z.object({
  email: z.email().max(254),
  persona: z.string().max(60).optional(),
});
