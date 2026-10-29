import type { Domain, Perspective, Tone } from "./schemas";

export interface Persona {
  id: string;
  label: string;
  /** One line shown under the label in onboarding. */
  blurb: string;
  /** How this persona reads a post: what they care about and the words they use. */
  lens: string;
  defaultTone: Tone[];
  defaultPerspective: Perspective;
  /** Domains this persona is most likely to save; used to order library filters. */
  focusDomains: Domain[];
}

export const PERSONAS = [
  {
    id: "founder",
    label: "Startup Founder / CEO",
    blurb: "Leverage, hiring, fundraising, focus.",
    lens: "Reads everything through company-building: what it means for the roadmap, the team, burn and the next raise. Prefers decisions over opinions.",
    defaultTone: ["direct", "concise"],
    defaultPerspective: "first_person",
    focusDomains: ["career_sales", "tech", "mindset"],
  },
  {
    id: "markets_analyst",
    label: "Wall Street / Markets Analyst",
    blurb: "Theses, catalysts, risk.",
    lens: "Frames ideas as positions: thesis, catalysts, what's priced in, what would make them wrong. Comfortable with tickers, multiples and basis points.",
    defaultTone: ["analytical", "skeptical"],
    defaultPerspective: "checklist",
    focusDomains: ["markets_thesis", "tech"],
  },
  {
    id: "yoga_instructor",
    label: "Yoga & Wellness Instructor",
    blurb: "Breath, recovery, sustainable habits.",
    lens: "Translates ideas into gentle, embodied practice and cues they could give a class. Values consistency, nervous-system regulation and listening to the body.",
    defaultTone: ["calm", "warm"],
    defaultPerspective: "coach",
    focusDomains: ["fitness_nutrition", "mindset"],
  },
  {
    id: "fitness_coach",
    label: "Fitness Coach / Athlete",
    blurb: "Programming, progressive overload, fuel.",
    lens: "Thinks in sessions, sets, reps, RPE and weekly volume. Wants to know exactly what to do in the gym or kitchen tomorrow.",
    defaultTone: ["motivating", "direct"],
    defaultPerspective: "coach",
    focusDomains: ["fitness_nutrition", "mindset"],
  },
  {
    id: "software_engineer",
    label: "Software Engineer",
    blurb: "Systems, trade-offs, shipping.",
    lens: "Looks for the underlying system and its trade-offs. Likes concrete steps, small experiments and anything that can be automated.",
    defaultTone: ["analytical", "concise"],
    defaultPerspective: "first_person",
    focusDomains: ["tech", "career_sales"],
  },
  {
    id: "sales_exec",
    label: "Sales Executive (AE / GTM)",
    blurb: "Pipeline, talk tracks, closing.",
    lens: "Turns ideas into talk tracks, discovery questions and pipeline actions. Cares about reply rates, conversion and what to say on the next call.",
    defaultTone: ["direct", "motivating"],
    defaultPerspective: "first_person",
    focusDomains: ["career_sales", "mindset"],
  },
  {
    id: "creator",
    label: "Creator / Writer",
    blurb: "Hooks, audience, craft.",
    lens: "Sees every post as craft: the hook, the structure, the angle they could take for their own audience.",
    defaultTone: ["playful", "warm"],
    defaultPerspective: "first_person",
    focusDomains: ["mindset", "career_sales", "tech"],
  },
  {
    id: "student",
    label: "Med / Grad Student",
    blurb: "Study systems, energy, focus.",
    lens: "Wants ideas that fit around a heavy study load: efficient, evidence-minded, easy to review later like flashcards.",
    defaultTone: ["analytical", "warm"],
    defaultPerspective: "checklist",
    focusDomains: ["mindset", "fitness_nutrition", "tech"],
  },
] as const satisfies readonly Persona[];

export type PersonaId = (typeof PERSONAS)[number]["id"];

export const CUSTOM_PERSONA_ID = "custom";

export function getPersona(id: string): Persona | undefined {
  return PERSONAS.find((p) => p.id === id);
}

/** Human-readable description of a set of persona ids plus any custom text. */
export function describePersonas(ids: readonly string[], customDescription?: string | null): string {
  const parts = ids
    .map((id) => getPersona(id))
    .filter((p): p is Persona => Boolean(p))
    .map((p) => `${p.label}: ${p.lens}`);
  if (customDescription?.trim()) parts.push(`In their own words: ${customDescription.trim()}`);
  return parts.join("\n");
}

export const DOMAIN_LABELS: Record<Domain, string> = {
  career_sales: "Career & Sales",
  markets_thesis: "Markets",
  fitness_nutrition: "Fitness & Food",
  mindset: "Mindset",
  tech: "Tech",
  other: "Other",
};

export const PLATFORM_LABELS = {
  x: "X",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  web: "Web",
  manual: "Note",
} as const;
