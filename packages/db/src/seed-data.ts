import { DEMO_SAVES, PERSONAS, canonicalizeUrl, normalizeForHash } from "@echo/core";

export const DEMO_USER_EMAIL = "demo@getecho.ai";

/** One voice profile per starter persona; the Sales voice starts active. */
export const DEMO_VOICES = PERSONAS.map((p) => ({
  personaId: p.id,
  name: p.shortLabel,
  personas: [p.id],
  description: p.blurb,
  perspective: p.defaultPerspective,
  tone: [...p.defaultTone],
  isActive: p.id === "sales_exec",
}));

export { DEMO_SAVES, canonicalizeUrl, normalizeForHash };
