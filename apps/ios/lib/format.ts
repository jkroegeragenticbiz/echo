import { PERSONAS } from "@echo/core";

export function shortVoiceName(name: string | undefined | null): string {
  return name?.trim() || "your";
}

/** Suggests a voice name from the picked personas, e.g. "Sales + Fitness Coach". */
export function voiceNameFor(personaIds: string[], custom: string): string {
  const names = personaIds.map((id) => PERSONAS.find((p) => p.id === id)?.shortLabel).filter(Boolean) as string[];
  if (names.length === 0) return custom.trim() ? "My own voice" : "My voice";
  if (names.length <= 2) return names.join(" + ");
  return `${names[0]} + ${names.length - 1} more`;
}

export function firstLine(text: string, max = 110): string {
  const line = text.split("\n").find((l) => l.trim())?.trim() ?? "Saved post";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
