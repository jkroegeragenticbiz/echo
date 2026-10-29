import { createHash, randomBytes } from "node:crypto";

const API = "https://api.x.com/2";
export const X_AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
export const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
export const X_REVOKE_URL = "https://api.x.com/2/oauth2/revoke";
export const X_SCOPES = ["tweet.read", "users.read", "bookmark.read", "offline.access"];

const TWEET_FIELDS = "conversation_id,author_id,created_at,note_tweet,referenced_tweets,attachments,entities,in_reply_to_user_id";
const EXPANSIONS = "author_id,attachments.media_keys";
const MEDIA_FIELDS = "url,preview_image_url,type,variants";
const USER_FIELDS = "username,name";

export class XApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "XApiError";
  }
}

interface XEntityUrl {
  start: number;
  end: number;
  url: string;
  expanded_url?: string;
  media_key?: string;
}

export interface XTweet {
  id: string;
  text: string;
  author_id: string;
  conversation_id: string;
  created_at?: string;
  in_reply_to_user_id?: string;
  note_tweet?: { text: string; entities?: { urls?: XEntityUrl[] } };
  referenced_tweets?: { type: "replied_to" | "quoted" | "retweeted"; id: string }[];
  attachments?: { media_keys?: string[] };
  entities?: { urls?: XEntityUrl[] };
}

interface XMedia {
  media_key: string;
  type: "photo" | "video" | "animated_gif";
  url?: string;
  preview_image_url?: string;
  variants?: { bit_rate?: number; content_type: string; url: string }[];
}

interface XUser {
  id: string;
  username: string;
  name: string;
}

interface XIncludes {
  users?: XUser[];
  media?: XMedia[];
}

export interface XThread {
  postId: string;
  conversationId: string;
  author: string;
  authorName: string;
  /** Root post plus the author's own replies, oldest first, separated by blank lines. */
  text: string;
  postCount: number;
  imageUrls: string[];
  videoUrls: string[];
}

/** Minimal X API v2 client using a user-context OAuth 2.0 access token. */
export class XClient {
  constructor(
    private readonly accessToken: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${API}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await this.fetchImpl(url, { headers: { authorization: `Bearer ${this.accessToken}` } });
    if (!res.ok) throw new XApiError(`X API ${path} failed: ${res.status} ${await res.text()}`, res.status);
    return (await res.json()) as T;
  }

  async me(): Promise<XUser> {
    const res = await this.get<{ data: XUser }>("/users/me", { "user.fields": USER_FIELDS });
    return res.data;
  }

  async getPost(id: string): Promise<{ tweet: XTweet; includes: XIncludes }> {
    const res = await this.get<{ data?: XTweet; includes?: XIncludes }>(`/tweets/${id}`, {
      "tweet.fields": TWEET_FIELDS,
      expansions: EXPANSIONS,
      "media.fields": MEDIA_FIELDS,
      "user.fields": USER_FIELDS,
    });
    if (!res.data) throw new XApiError(`Post ${id} not found or not visible`, 404);
    return { tweet: res.data, includes: res.includes ?? {} };
  }

  /** One page of the user's bookmarks (newest first). */
  async getBookmarks(userId: string, paginationToken?: string) {
    const res = await this.get<{
      data?: XTweet[];
      includes?: XIncludes;
      meta?: { next_token?: string; result_count: number };
    }>(`/users/${userId}/bookmarks`, {
      max_results: "100",
      "tweet.fields": TWEET_FIELDS,
      expansions: EXPANSIONS,
      "media.fields": MEDIA_FIELDS,
      "user.fields": USER_FIELDS,
      ...(paginationToken ? { pagination_token: paginationToken } : {}),
    });
    return { tweets: res.data ?? [], includes: res.includes ?? {}, nextToken: res.meta?.next_token ?? null };
  }

  /**
   * Unrolls a self-thread: the conversation root (if by the same author) plus
   * every reply the author made to themselves in that conversation.
   * Recent search only covers the last 7 days, so older threads fall back to
   * the posts we can look up directly.
   */
  async getThread(postId: string): Promise<XThread> {
    const { tweet, includes } = await this.getPost(postId);
    const users = new Map((includes.users ?? []).map((u) => [u.id, u]));
    const media = new Map((includes.media ?? []).map((m) => [m.media_key, m]));
    const author = users.get(tweet.author_id);

    const posts = new Map<string, XTweet>([[tweet.id, tweet]]);
    if (tweet.conversation_id !== tweet.id) {
      try {
        const root = await this.getPost(tweet.conversation_id);
        if (root.tweet.author_id === tweet.author_id) {
          posts.set(root.tweet.id, root.tweet);
          for (const m of root.includes.media ?? []) media.set(m.media_key, m);
        }
      } catch (err) {
        if (!(err instanceof XApiError)) throw err;
      }
    }

    if (author) {
      try {
        const search = await this.get<{ data?: XTweet[]; includes?: XIncludes }>("/tweets/search/recent", {
          query: `conversation_id:${tweet.conversation_id} from:${author.username} to:${author.username}`,
          max_results: "100",
          "tweet.fields": TWEET_FIELDS,
          expansions: "attachments.media_keys",
          "media.fields": MEDIA_FIELDS,
        });
        for (const t of search.data ?? []) {
          if (t.author_id === tweet.author_id) posts.set(t.id, t);
        }
        for (const m of search.includes?.media ?? []) media.set(m.media_key, m);
      } catch (err) {
        // Search needs a higher API tier on some plans; a single post is still useful.
        if (!(err instanceof XApiError)) throw err;
      }
    }

    const ordered = [...posts.values()].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
    const imageUrls: string[] = [];
    const videoUrls: string[] = [];
    for (const post of ordered) {
      for (const key of post.attachments?.media_keys ?? []) {
        const m = media.get(key);
        if (!m) continue;
        if (m.type === "photo" && m.url) imageUrls.push(m.url);
        if (m.type !== "photo") {
          const best = (m.variants ?? [])
            .filter((v) => v.content_type === "video/mp4")
            .sort((a, b) => (b.bit_rate ?? 0) - (a.bit_rate ?? 0))[0];
          if (best) videoUrls.push(best.url);
        }
      }
    }

    return {
      postId: tweet.id,
      conversationId: tweet.conversation_id,
      author: author ? `@${author.username}` : tweet.author_id,
      authorName: author?.name ?? "",
      text: ordered.map(postText).join("\n\n"),
      postCount: ordered.length,
      imageUrls,
      videoUrls,
    };
  }
}

/** Full text of a post (long-form note_tweet when present) with t.co links expanded. */
export function postText(tweet: Pick<XTweet, "text" | "note_tweet" | "entities">): string {
  const text = tweet.note_tweet?.text ?? tweet.text;
  const urls = tweet.note_tweet?.entities?.urls ?? tweet.entities?.urls ?? [];
  let out = text;
  for (const u of urls) {
    // Media links point back at the post itself; drop them, expand the rest.
    out = out.split(u.url).join(u.media_key ? "" : (u.expanded_url ?? u.url));
  }
  return out.replace(/[ \t]+\n/g, "\n").trim();
}

// ---------------------------------------------------------------------------
// OAuth 2.0 Authorization Code with PKCE
// ---------------------------------------------------------------------------

export function createPkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildXAuthorizeUrl(opts: { clientId: string; redirectUri: string; state: string; codeChallenge: string }) {
  const url = new URL(X_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", opts.clientId);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("scope", X_SCOPES.join(" "));
  url.searchParams.set("state", opts.state);
  url.searchParams.set("code_challenge", opts.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export interface XTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

async function tokenRequest(
  body: Record<string, string>,
  creds: { clientId: string; clientSecret?: string },
  fetchImpl: typeof fetch,
): Promise<XTokens> {
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  if (creds.clientSecret) {
    headers.authorization = `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64")}`;
  }
  const res = await fetchImpl(X_TOKEN_URL, {
    method: "POST",
    headers,
    body: new URLSearchParams({ ...body, client_id: creds.clientId }),
  });
  if (!res.ok) throw new XApiError(`X token request failed: ${res.status} ${await res.text()}`, res.status);
  return (await res.json()) as XTokens;
}

export function exchangeXCode(
  opts: { code: string; codeVerifier: string; redirectUri: string; clientId: string; clientSecret?: string },
  fetchImpl: typeof fetch = fetch,
) {
  return tokenRequest(
    { grant_type: "authorization_code", code: opts.code, redirect_uri: opts.redirectUri, code_verifier: opts.codeVerifier },
    opts,
    fetchImpl,
  );
}

export function refreshXToken(
  opts: { refreshToken: string; clientId: string; clientSecret?: string },
  fetchImpl: typeof fetch = fetch,
) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: opts.refreshToken }, opts, fetchImpl);
}
