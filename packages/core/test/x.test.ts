import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildXAuthorizeUrl, createPkcePair, exchangeXCode, postText, XClient } from "../src/server/ingest/x";
import { fakeFetch, fixture } from "./helpers";

describe("X OAuth 2.0 PKCE", () => {
  it("creates an S256 challenge for the verifier", () => {
    const { verifier, challenge } = createPkcePair();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });

  it("asks for bookmark.read and offline access", () => {
    const url = new URL(buildXAuthorizeUrl({ clientId: "cid", redirectUri: "https://getecho.ai/api/x/callback", state: "s", codeChallenge: "c" }));
    expect(url.origin + url.pathname).toBe("https://x.com/i/oauth2/authorize");
    expect(url.searchParams.get("scope")).toBe("tweet.read users.read bookmark.read offline.access");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("exchanges the code with basic auth for confidential clients", async () => {
    const { fetch, requests } = fakeFetch({
      "https://api.x.com/2/oauth2/token": {
        contentType: "application/json",
        body: JSON.stringify({ access_token: "at", refresh_token: "rt", expires_in: 7200, scope: "bookmark.read", token_type: "bearer" }),
      },
    });
    const tokens = await exchangeXCode({ code: "c", codeVerifier: "v", redirectUri: "https://r", clientId: "id", clientSecret: "secret" }, fetch);
    expect(tokens.refresh_token).toBe("rt");
    const init = requests[0]!.init!;
    expect((init.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from("id:secret").toString("base64")}`);
    expect(new URLSearchParams(init.body as URLSearchParams).get("code_verifier")).toBe("v");
  });
});

describe("XClient", () => {
  it("pages through bookmarks", async () => {
    const { fetch, requests } = fakeFetch({
      "https://api.x.com/2/users/7/bookmarks": { body: fixture("http/x-api-bookmarks.json"), contentType: "application/json" },
    });
    const page = await new XClient("t", fetch).getBookmarks("7", "page1");
    expect(page.tweets).toHaveLength(1);
    expect(page.nextToken).toBe("page2");
    expect(new URL(requests[0]!.url).searchParams.get("pagination_token")).toBe("page1");
  });

  it("prefers long-form note text and expands links", () => {
    expect(
      postText({
        text: "short https://t.co/a",
        note_tweet: { text: "long version https://t.co/a", entities: { urls: [{ start: 0, end: 0, url: "https://t.co/a", expanded_url: "https://example.com" }] } },
      }),
    ).toBe("long version https://example.com");
  });
});
