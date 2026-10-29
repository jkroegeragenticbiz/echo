import type { Rewrite } from "../schemas";

const NUMBER = /\d+(?:[.,]\d+)*/g;
const CASHTAG = /\$([A-Z]{1,5})\b/g;

function numbersIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(NUMBER)) {
    const raw = m[0];
    out.add(raw);
    out.add(raw.replace(/,/g, "")); // 1,000 == 1000
    for (const part of raw.split(/[.,]/)) out.add(part); // tolerate "2.5" vs "2" splitting
  }
  return out;
}

/** Fraction glyphs and similar that users write instead of digits. */
const GLYPH_NUMBERS: Record<string, string> = { "½": "1/2", "¼": "1/4", "¾": "3/4" };

export interface FactViolation {
  kind: "number" | "ticker";
  value: string;
}

/**
 * Finds numbers and $TICKERS in a rewrite that do not appear in the source.
 * The voice engine must not invent or alter facts; any hit triggers a retry.
 */
export function findUnsupportedFacts(source: string, rewrite: Rewrite): FactViolation[] {
  let normalizedSource = source;
  for (const [glyph, ascii] of Object.entries(GLYPH_NUMBERS)) normalizedSource += normalizedSource.includes(glyph) ? ` ${ascii}` : "";
  const sourceNumbers = numbersIn(normalizedSource);
  const sourceTickers = new Set([...normalizedSource.matchAll(/\$?\b([A-Z]{1,5})\b/g)].map((m) => m[1]!));

  const text = [rewrite.headline, rewrite.paraphrase, ...rewrite.action_steps].join("\n");
  const violations: FactViolation[] = [];
  const seen = new Set<string>();

  for (const m of text.matchAll(NUMBER)) {
    const raw = m[0];
    const plain = raw.replace(/,/g, "");
    if (sourceNumbers.has(raw) || sourceNumbers.has(plain)) continue;
    if (seen.has(`n:${raw}`)) continue;
    seen.add(`n:${raw}`);
    violations.push({ kind: "number", value: raw });
  }
  for (const m of text.matchAll(CASHTAG)) {
    const ticker = m[1]!;
    if (sourceTickers.has(ticker) || seen.has(`t:${ticker}`)) continue;
    seen.add(`t:${ticker}`);
    violations.push({ kind: "ticker", value: `$${ticker}` });
  }
  return violations;
}
