import { htmlToText } from "./html";
import { safeFetch, type SafeFetchOptions } from "./safe-fetch";

export interface OEmbedResult {
  title: string | null;
  authorName: string | null;
  authorUrl: string | null;
  thumbnailUrl: string | null;
  html: string | null;
}

/** Official, unauthenticated oEmbed endpoints. */
const ENDPOINTS = {
  x: "https://publish.twitter.com/oembed",
  tiktok: "https://www.tiktok.com/oembed",
  youtube: "https://www.youtube.com/oembed",
} as const;

export async function fetchOEmbed(
  provider: keyof typeof ENDPOINTS,
  url: string,
  opts: SafeFetchOptions = {},
): Promise<OEmbedResult | null> {
  const endpoint = new URL(ENDPOINTS[provider]);
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("format", "json");
  if (provider === "x") {
    endpoint.searchParams.set("omit_script", "1");
    endpoint.searchParams.set("dnt", "true");
  }
  const res = await safeFetch(endpoint.toString(), { ...opts, accept: "application/json" });
  if (res.status !== 200) return null;
  try {
    const json = JSON.parse(new TextDecoder().decode(res.body)) as Record<string, unknown>;
    const str = (k: string) => (typeof json[k] === "string" && json[k] ? (json[k] as string) : null);
    return {
      title: str("title"),
      authorName: str("author_name"),
      authorUrl: str("author_url"),
      thumbnailUrl: str("thumbnail_url"),
      html: str("html"),
    };
  } catch {
    return null;
  }
}

/**
 * The X oEmbed HTML is a blockquote: <p>post text</p>&mdash; Name (@handle) <a>date</a>.
 * Returns just the post text.
 */
export function textFromXOEmbedHtml(html: string): string {
  const paragraph = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? html;
  return htmlToText(paragraph)
    .replace(/\s*pic\.twitter\.com\/\w+\s*$/i, "")
    .trim();
}
