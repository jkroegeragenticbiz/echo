import {
  XApiError,
  XClient,
  buildXAuthorizeUrl,
  createPkcePair,
  exchangeXCode,
  refreshXToken,
  type XTokens,
} from "@echo/core/server";
import {
  findDuplicateSave,
  getSocialConnection,
  upsertSocialConnection,
  type Database,
  type SocialConnectionRow,
} from "@echo/db";
import { eq } from "drizzle-orm";
import { socialConnections } from "@echo/db";
import { decrypt, deriveKey, encrypt } from "../crypto";
import { HttpError } from "../http";
import type { ServiceContext } from "./context";
import { createSave, getUsage } from "./saves";

export interface XConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  secret: string;
  fetch?: typeof fetch;
}

interface ConnectState {
  userId: string;
  verifier: string;
  returnTo: string;
  exp: number;
}

/** Only our own pages or the app's custom scheme may receive the user after OAuth. */
export function safeReturnTo(value: string | null | undefined): string {
  if (value && (value.startsWith("echo://") || (value.startsWith("/") && !value.startsWith("//")))) return value;
  return "/library";
}

/**
 * Starts OAuth 2.0 PKCE. The verifier travels inside the encrypted `state`
 * (AES-GCM with a key derived from AUTH_SECRET), so no server-side session
 * is needed and it works from the app's in-app browser too.
 */
export function startXConnect(userId: string, returnTo: string | null, config: XConfig) {
  const { verifier, challenge } = createPkcePair();
  const state: ConnectState = { userId, verifier, returnTo: safeReturnTo(returnTo), exp: Date.now() + 10 * 60_000 };
  const encrypted = encrypt(JSON.stringify(state), deriveKey(config.secret, "x-oauth-state"));
  return buildXAuthorizeUrl({ clientId: config.clientId, redirectUri: config.redirectUri, state: encrypted, codeChallenge: challenge });
}

export function readXState(state: string, secret: string): ConnectState {
  let parsed: ConnectState;
  try {
    parsed = JSON.parse(decrypt(state, deriveKey(secret, "x-oauth-state"))) as ConnectState;
  } catch {
    throw new HttpError(400, "Invalid OAuth state", "bad_state");
  }
  if (parsed.exp < Date.now()) throw new HttpError(400, "This connection link expired. Try again.", "state_expired");
  return parsed;
}

function tokenKey(secret: string) {
  return deriveKey(secret, "oauth-tokens");
}

async function storeTokens(db: Database, userId: string, tokens: XTokens, config: XConfig, profile?: { id: string; username: string }) {
  const key = tokenKey(config.secret);
  return upsertSocialConnection(db, {
    userId,
    platform: "x",
    status: "active",
    accessTokenEnc: encrypt(tokens.access_token, key),
    refreshTokenEnc: tokens.refresh_token ? encrypt(tokens.refresh_token, key) : undefined,
    tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    scopes: tokens.scope.split(" "),
    ...(profile ? { externalUserId: profile.id, externalUsername: profile.username } : {}),
  });
}

export async function completeXConnect(db: Database, code: string, state: string, config: XConfig) {
  const s = readXState(state, config.secret);
  const tokens = await exchangeXCode(
    { code, codeVerifier: s.verifier, redirectUri: config.redirectUri, clientId: config.clientId, clientSecret: config.clientSecret },
    config.fetch,
  );
  const me = await new XClient(tokens.access_token, config.fetch).me();
  await storeTokens(db, s.userId, tokens, config, { id: me.id, username: me.username });
  return { userId: s.userId, returnTo: s.returnTo, username: me.username };
}

/** An X client for the user, refreshing the access token when it's about to expire. */
export async function getXClient(db: Database, userId: string, config: Omit<XConfig, "redirectUri">) {
  const conn = await getSocialConnection(db, userId, "x");
  if (!conn || conn.status !== "active" || !conn.accessTokenEnc) return null;
  const key = tokenKey(config.secret);
  let accessToken = decrypt(conn.accessTokenEnc, key);
  const expiresSoon = conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() < Date.now() + 60_000;
  if (expiresSoon && conn.refreshTokenEnc) {
    try {
      const tokens = await refreshXToken(
        { refreshToken: decrypt(conn.refreshTokenEnc, key), clientId: config.clientId, clientSecret: config.clientSecret },
        config.fetch,
      );
      await storeTokens(db, userId, tokens, { ...config, redirectUri: "" });
      accessToken = tokens.access_token;
    } catch (err) {
      if (err instanceof XApiError && (err.status === 400 || err.status === 401)) {
        await db.update(socialConnections).set({ status: "expired" }).where(eq(socialConnections.id, conn.id));
        return null;
      }
      throw err;
    }
  }
  return { client: new XClient(accessToken, config.fetch), connection: conn };
}

export async function disconnectX(db: Database, userId: string) {
  await db
    .update(socialConnections)
    .set({ status: "revoked", accessTokenEnc: null, refreshTokenEnc: null })
    .where(eq(socialConnections.userId, userId));
}

const MAX_PAGES = 3;
const PLUS_IMPORT_PER_RUN = 25;

/**
 * Imports new X bookmarks as saves, oldest first. Stops paging once a page is
 * entirely made of posts we already have. Free users import up to their
 * remaining monthly quota and unlock rewrites per card later.
 */
export async function syncXBookmarks(
  ctx: ServiceContext,
  userId: string,
  x: { client: XClient; connection: SocialConnectionRow },
) {
  const { limit, used } = await getUsage(ctx, userId);
  const budget = limit === null ? PLUS_IMPORT_PER_RUN : Math.max(0, limit - used);
  if (budget === 0) return { imported: 0, skipped: 0, reason: "quota_exceeded" as const };

  const xUserId = x.connection.externalUserId ?? (await x.client.me()).id;
  const fresh: { id: string; username: string }[] = [];
  let token: string | undefined;
  let skipped = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { tweets, includes, nextToken } = await x.client.getBookmarks(xUserId, token);
    const usernames = new Map((includes.users ?? []).map((u) => [u.id, u.username]));
    let newOnPage = 0;
    for (const t of tweets) {
      if (await findDuplicateSave(ctx.db, userId, { externalId: t.id })) {
        skipped++;
        continue;
      }
      fresh.push({ id: t.id, username: usernames.get(t.author_id) ?? "i" });
      newOnPage++;
    }
    if (!nextToken || newOnPage === 0 || fresh.length >= budget) break;
    token = nextToken;
  }

  let imported = 0;
  for (const post of fresh.slice(0, budget).reverse()) {
    try {
      const res = await createSave(
        ctx,
        userId,
        { url: `https://x.com/${post.username}/status/${post.id}`, platform: "x" },
        { createUnlock: false },
      );
      if (!res.duplicate) imported++;
    } catch (err) {
      if (err instanceof HttpError && err.code === "quota_exceeded") break;
      console.error(`X import failed for ${post.id}:`, (err as Error).message);
    }
  }
  await upsertSocialConnection(ctx.db, { userId, platform: "x", lastSyncedAt: new Date() });
  return { imported, skipped, reason: null };
}
