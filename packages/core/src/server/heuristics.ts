import type { Domain } from "../schemas";

const RULES: { domain: Domain; patterns: RegExp[] }[] = [
  {
    domain: "markets_thesis",
    patterns: [/\$[A-Z]{1,5}\b/, /\b(bull|bear)(ish)? case\b/i, /\b(earnings|eps|p\/e|valuation|catalyst|long|short)\b/i, /\b\d+x (earnings|sales|revenue)\b/i],
  },
  {
    domain: "fitness_nutrition",
    patterns: [/\b\d+\s?(x|×)\s?\d+\b/i, /\b(sets?|reps?|rpe|squat|deadlift|bench|hypertrophy|protein|macros?|calories|kcal)\b/i, /\b\d+\s?g (protein|carbs|fat)\b/i],
  },
  {
    domain: "career_sales",
    patterns: [/\b(cold (email|call)|prospect|pipeline|quota|discovery call|reply rate|closing|negotiat|hiring|recruiter|interview|promotion|sdr|ae)\b/i],
  },
  {
    domain: "tech",
    patterns: [/\b(api|database|deploy|kubernetes|typescript|python|llm|latency|backend|frontend|code review|readme|engineer)\b/i],
  },
  {
    domain: "mindset",
    patterns: [/\b(habit|discipline|mindset|motivation|journal|meditat|identity|consisten|procrastinat|burnout)\b/i],
  },
];

/**
 * Cheap keyword pre-classifier. Passed to the model as a hint and used as the
 * fallback domain if the model call fails, so a save is never left unfiled.
 */
export function guessDomain(text: string): { domain: Domain; score: number } {
  let best: { domain: Domain; score: number } = { domain: "other", score: 0 };
  for (const rule of RULES) {
    const score = rule.patterns.reduce((n, p) => n + (p.test(text) ? 1 : 0), 0);
    if (score > best.score) best = { domain: rule.domain, score };
  }
  return best;
}

export function extractCashtags(text: string): string[] {
  return [...new Set([...text.matchAll(/\$([A-Z]{1,5})\b/g)].map((m) => m[1]!))];
}
