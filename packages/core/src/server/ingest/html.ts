import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export interface PageData {
  title: string | null;
  description: string | null;
  author: string | null;
  siteName: string | null;
  image: string | null;
  /** Main readable text of the page (Readability), if any. */
  text: string | null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** Parses OpenGraph/Twitter-card metadata and readable text from public HTML. */
export function parsePage(html: string, baseUrl: string): PageData {
  const { document } = parseHTML(html);
  const meta = (...keys: string[]) => {
    for (const key of keys) {
      const el = document.querySelector(`meta[property="${key}"], meta[name="${key}"]`);
      const content = el?.getAttribute("content")?.trim();
      if (content) return decodeEntities(content);
    }
    return null;
  };

  let text: string | null = null;
  try {
    const article = new Readability(document as unknown as ConstructorParameters<typeof Readability>[0], { charThreshold: 200 }).parse();
    text = article?.textContent?.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim() || null;
  } catch {
    text = null;
  }

  const image = meta("og:image", "twitter:image");
  return {
    title: meta("og:title", "twitter:title") ?? (document.querySelector("title")?.textContent?.trim() || null),
    description: meta("og:description", "twitter:description", "description"),
    author: meta("author", "article:author", "twitter:creator"),
    siteName: meta("og:site_name"),
    image: image ? new URL(image, baseUrl).toString() : null,
    text,
  };
}

/**
 * Instagram's public og:description looks like
 * `12K likes, 80 comments - handle on March 1, 2024: "caption"`. Pull out the
 * handle and caption; return null when the format doesn't match.
 */
export function parseInstagramDescription(description: string): { author: string; caption: string } | null {
  const match = description.match(/-\s*([\w.]+)\s+on\s+[^:]+:\s*"([\s\S]*)"\s*\.?\s*$/);
  if (!match) return null;
  return { author: `@${match[1]}`, caption: match[2]!.trim() };
}

/** Strips tags from an oEmbed HTML snippet, keeping paragraph breaks. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
