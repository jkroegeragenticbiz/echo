import { canonicalizeUrl, detectPlatform, extractXPostId } from "../../url";
import type { CreateSaveInput, Platform } from "../../schemas";
import type { IngestedContent } from "../content";
import type { LlmProvider } from "../providers/types";
import { parseInstagramDescription, parsePage } from "./html";
import { ocrImages } from "./ocr";
import { fetchOEmbed, textFromXOEmbedHtml } from "./oembed";
import { IngestError, safeFetch, type LookupFn } from "./safe-fetch";
import { XApiError, type XClient } from "./x";

export * from "./html";
export * from "./oembed";
export * from "./ocr";
export * from "./safe-fetch";
export * from "./video";
export * from "./x";
export * from "./instagram";

export interface IngestDeps {
  llm: LlmProvider;
  fetch?: typeof fetch;
  lookup?: LookupFn;
  /** Present when the user has connected X; enables thread unrolling. */
  x?: XClient | null;
}

interface LinkData {
  text: string;
  author: string | null;
  externalId: string | null;
  imageUrls: string[];
  videoUrls: string[];
  via: IngestedContent["via"];
}

/**
 * Step 1 of the pipeline: turn whatever was shared (link, text, screenshot,
 * video) into the post's verbatim words plus metadata. Videos are only
 * flagged here; transcription happens in the background media job.
 */
export async function ingest(input: CreateSaveInput, deps: IngestDeps): Promise<IngestedContent> {
  const sourceUrl = input.url ?? findUrl(input.text) ?? null;
  const platform: Platform = input.platform ?? detectPlatform(sourceUrl);
  const canonicalUrl = sourceUrl ? canonicalizeUrl(sourceUrl) : null;

  // Text the user shared or pasted is what they actually saw; prefer it over
  // anything we fetch, unless it's just the link itself.
  const sharedText = stripUrlOnly(input.text, sourceUrl);

  let link: LinkData | null = null;
  if (sourceUrl) {
    try {
      link = await fetchLink(sourceUrl, platform, deps);
    } catch (err) {
      // Shared text or media can still make a useful save; otherwise surface the error.
      if (!sharedText && !input.ocr_text && !input.media?.length) throw err;
      console.warn("Link fetch failed, continuing with shared content:", (err as Error).message);
    }
  }

  const images = (input.media ?? []).filter((m) => m.kind === "image").map((m) => m.url);
  const videos = (input.media ?? []).filter((m) => m.kind === "video").map((m) => m.url);

  let ocrText = input.ocr_text?.trim() || null;
  let ocrAuthor: string | null = null;
  if (!ocrText && images.length > 0) {
    const result = await ocrImages(images.map((url) => ({ kind: "url" as const, url })), deps.llm, "screenshot");
    ocrText = result.text.trim() || null;
    ocrAuthor = result.author;
  }

  const verbatimText = (sharedText ?? link?.text ?? "").trim();
  if (!verbatimText && !ocrText && videos.length === 0 && !link?.videoUrls.length) {
    throw new IngestError(
      `No readable content for ${sourceUrl ?? "input"}`,
      "We couldn't read this post. Share a screenshot or paste the text instead.",
    );
  }

  return {
    platform,
    sourceUrl,
    canonicalUrl,
    externalId: link?.externalId ?? null,
    author: link?.author ?? ocrAuthor ?? null,
    verbatimText,
    mediaUrls: [...images, ...videos, ...(link?.imageUrls ?? []), ...(link?.videoUrls ?? [])],
    ocrText,
    transcript: null,
    needsMediaJob: videos.length > 0 || (link?.videoUrls.length ?? 0) > 0,
    via: sharedText || input.ocr_text ? "client" : (link?.via ?? "manual"),
  };
}

async function fetchLink(url: string, platform: Platform, deps: IngestDeps): Promise<LinkData> {
  const fetchOpts = { fetch: deps.fetch, lookup: deps.lookup };

  if (platform === "x") {
    const postId = extractXPostId(url);
    if (postId && deps.x) {
      try {
        const thread = await deps.x.getThread(postId);
        return {
          text: thread.text,
          author: thread.author,
          externalId: thread.postId,
          imageUrls: thread.imageUrls,
          videoUrls: thread.videoUrls,
          via: "x_api",
        };
      } catch (err) {
        if (!(err instanceof XApiError)) throw err;
        console.warn("X API lookup failed, falling back to oEmbed:", err.message);
      }
    }
    const embed = await fetchOEmbed("x", url, fetchOpts);
    if (embed?.html) {
      return {
        text: textFromXOEmbedHtml(embed.html),
        author: embed.authorUrl ? `@${embed.authorUrl.split("/").filter(Boolean).pop()}` : embed.authorName,
        externalId: postId,
        imageUrls: [],
        videoUrls: [],
        via: "x_oembed",
      };
    }
    throw new IngestError(`X post unavailable: ${url}`, "That post is private or deleted. Try a screenshot instead.");
  }

  if (platform === "tiktok" || platform === "youtube") {
    const embed = await fetchOEmbed(platform, url, fetchOpts).catch(() => null);
    const page = platform === "youtube" ? await fetchPage(url, fetchOpts).catch(() => null) : null;
    const text = [embed?.title, page?.description].filter(Boolean).join("\n\n");
    if (text) {
      return {
        text,
        author: embed?.authorName ?? page?.author ?? null,
        externalId: null,
        imageUrls: embed?.thumbnailUrl ? [embed.thumbnailUrl] : [],
        videoUrls: [],
        via: "oembed",
      };
    }
  }

  const page = await fetchPage(url, fetchOpts);
  if (platform === "instagram" && page.description) {
    const ig = parseInstagramDescription(page.description);
    if (ig) return { text: ig.caption, author: ig.author, externalId: null, imageUrls: page.image ? [page.image] : [], videoUrls: [], via: "opengraph" };
  }
  // Prefer the full readable article; social pages usually only have og:description.
  const article = page.text && page.text.length > (page.description?.length ?? 0) ? page.text : null;
  return {
    text: article ?? [page.title, page.description].filter(Boolean).join("\n\n"),
    author: page.author ?? page.siteName,
    externalId: null,
    imageUrls: page.image ? [page.image] : [],
    videoUrls: [],
    via: "opengraph",
  };
}

async function fetchPage(url: string, opts: { fetch?: typeof fetch; lookup?: LookupFn }) {
  const res = await safeFetch(url, opts);
  if (res.status >= 400) {
    throw new IngestError(`Fetch ${url} returned ${res.status}`, "We couldn't open that link. Try a screenshot instead.");
  }
  if (!/html|xml/.test(res.contentType)) {
    throw new IngestError(`Unsupported content type ${res.contentType}`, "That link isn't a web page we can read.");
  }
  return parsePage(new TextDecoder().decode(res.body), res.url);
}

function findUrl(text: string | undefined): string | undefined {
  return text?.match(/https?:\/\/[^\s<>"]+/)?.[0];
}

function stripUrlOnly(text: string | undefined, url: string | null): string | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  const withoutUrl = url ? trimmed.split(url).join("").trim() : trimmed;
  return withoutUrl.length >= 3 ? trimmed : null;
}
