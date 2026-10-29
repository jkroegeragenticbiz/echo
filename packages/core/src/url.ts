import type { Platform } from "./schemas";

/** Query params that only exist for tracking or share attribution. */
const TRACKING_PARAMS = new Set([
  "igshid",
  "igsh",
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "_hsenc",
  "_hsmi",
  "mkt_tok",
  "ref",
  "ref_src",
  "ref_url",
  "trk",
  "trkinfo",
  "trackingid",
  "lipi",
  "rcm",
  "share_id",
  "sender_device",
  "is_from_webapp",
  "is_copy_url",
  "web_id",
  "si",
  "feature",
  "pp",
  "s",
  "t",
  "_r",
  "_t",
  "src",
  "utm",
]);

/** Params that are tracking-only on specific hosts but meaningful elsewhere. */
const HOST_SCOPED_PARAMS: Record<string, Set<string>> = {
  "x.com": new Set(["s", "t", "src"]),
  "youtube.com": new Set(["si", "feature", "pp"]),
  "tiktok.com": new Set(["_r", "_t", "is_from_webapp", "sender_device", "web_id", "is_copy_url"]),
};

const ALWAYS_STRIP = new Set(
  [...TRACKING_PARAMS].filter((p) => !Object.values(HOST_SCOPED_PARAMS).some((set) => set.has(p))),
);

const HOST_ALIASES: Record<string, string> = {
  "twitter.com": "x.com",
  "mobile.twitter.com": "x.com",
  "mobile.x.com": "x.com",
  "m.youtube.com": "youtube.com",
  "music.youtube.com": "youtube.com",
  "m.facebook.com": "facebook.com",
  "vm.tiktok.com": "vm.tiktok.com",
  "m.tiktok.com": "tiktok.com",
  "lnkd.in": "lnkd.in",
};

function normalizeHost(host: string): string {
  let h = host.toLowerCase().replace(/\.$/, "");
  const alias = HOST_ALIASES[h];
  if (alias) return alias;
  h = h.replace(/^(www|m)\./, "");
  return HOST_ALIASES[h] ?? h;
}

/**
 * Canonical form used for dedupe: https, normalized host, no tracking params,
 * no fragment, sorted query, no trailing slash. Returns null for non-http URLs.
 */
export function canonicalizeUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = normalizeHost(url.hostname);
  let pathname = url.pathname.replace(/\/{2,}/g, "/");
  const params = new URLSearchParams(url.search);

  // youtu.be/<id> -> youtube.com/watch?v=<id>
  if (host === "youtu.be") {
    const id = pathname.split("/").filter(Boolean)[0];
    if (id) {
      const out = new URL(`https://youtube.com/watch`);
      out.searchParams.set("v", id);
      return out.toString();
    }
  }

  // x.com/<user>/status/<id>/photo/1 -> x.com/<user>/status/<id>
  if (host === "x.com") {
    const match = pathname.match(/^\/([^/]+)\/status(?:es)?\/(\d+)/);
    if (match) pathname = `/${match[1]!.toLowerCase()}/status/${match[2]}`;
  }

  // instagram.com/reel/<id>/ and /p/<id>/ keep only the id path.
  if (host === "instagram.com") {
    const match = pathname.match(/^\/(?:[^/]+\/)?(p|reel|reels|tv)\/([^/]+)/);
    if (match) pathname = `/${match[1] === "reels" ? "reel" : match[1]}/${match[2]}`;
  }

  const hostScoped = HOST_SCOPED_PARAMS[host];
  const kept: [string, string][] = [];
  for (const [key, value] of params) {
    const k = key.toLowerCase();
    if (k.startsWith("utm_") || ALWAYS_STRIP.has(k) || hostScoped?.has(k)) continue;
    kept.push([key, value]);
  }
  kept.sort(([a], [b]) => a.localeCompare(b));

  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, "");
  const query = kept.length ? `?${new URLSearchParams(kept).toString()}` : "";
  const port = url.port && url.port !== "80" && url.port !== "443" ? `:${url.port}` : "";
  return `https://${host}${port}${pathname === "/" ? "" : pathname}${query}`;
}

export function detectPlatform(input: string | undefined | null): Platform {
  if (!input) return "manual";
  let host: string;
  try {
    host = normalizeHost(new URL(input).hostname);
  } catch {
    return "manual";
  }
  if (host === "x.com" || host === "t.co") return "x";
  if (host.endsWith("linkedin.com") || host === "lnkd.in") return "linkedin";
  if (host.endsWith("instagram.com") || host === "instagr.am") return "instagram";
  if (host.endsWith("tiktok.com")) return "tiktok";
  if (host.endsWith("youtube.com") || host === "youtu.be") return "youtube";
  return "web";
}

/** Extracts the numeric post id from an x.com / twitter.com status URL. */
export function extractXPostId(input: string): string | null {
  const canonical = canonicalizeUrl(input);
  const match = canonical?.match(/^https:\/\/x\.com\/[^/]+\/status\/(\d+)/);
  return match?.[1] ?? null;
}

/** Normalizes text before hashing so trivially different copies dedupe together. */
export function normalizeForHash(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[^\p{L}\p{N}$%.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
