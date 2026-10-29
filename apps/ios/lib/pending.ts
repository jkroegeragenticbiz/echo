/**
 * Work the Share Extension hands to the app through the App Group
 * (targets/share/SharedStore.swift writes these).
 */
export type PendingItem =
  | { id: string; kind: "unlock"; createdAt: string; saveId: string; adUnlockId: string; adUnitId: string; voiceName: string }
  | { id: string; kind: "video"; createdAt: string; fileName: string; sourceUrl: string; text: string };

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Parses the shared JSON defensively; malformed or stale entries are returned separately for cleanup. */
export function parsePending(raw: string, now = Date.now()): { items: PendingItem[]; discard: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { items: [], discard: [] };
  }
  if (!Array.isArray(parsed)) return { items: [], discard: [] };
  const items: PendingItem[] = [];
  const discard: string[] = [];
  for (const entry of parsed as Record<string, unknown>[]) {
    const id = typeof entry?.id === "string" ? entry.id : null;
    if (!id) continue;
    const created = Date.parse(String(entry.createdAt ?? ""));
    if (!Number.isFinite(created) || now - created > MAX_AGE_MS) {
      discard.push(id);
      continue;
    }
    const str = (k: string) => (typeof entry[k] === "string" ? (entry[k] as string) : "");
    if (entry.kind === "unlock" && str("saveId") && str("adUnlockId")) {
      items.push({ id, kind: "unlock", createdAt: str("createdAt"), saveId: str("saveId"), adUnlockId: str("adUnlockId"), adUnitId: str("adUnitId"), voiceName: str("voiceName") });
    } else if (entry.kind === "video" && str("fileName")) {
      items.push({ id, kind: "video", createdAt: str("createdAt"), fileName: str("fileName"), sourceUrl: str("sourceUrl"), text: str("text") });
    } else {
      discard.push(id);
    }
  }
  // Videos first (they create saves), then the oldest unlock.
  items.sort((a, b) => (a.kind === b.kind ? a.createdAt.localeCompare(b.createdAt) : a.kind === "video" ? -1 : 1));
  return { items, discard };
}
