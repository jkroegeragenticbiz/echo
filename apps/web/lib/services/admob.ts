import { createPublicKey, verify } from "node:crypto";
import { getAdUnlock, verifyAdUnlock } from "@echo/db";
import type { ServiceContext } from "./context";
import { ensureRewrite } from "./saves";

const KEYS_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json";
const KEY_TTL_MS = 24 * 60 * 60 * 1000;

export type AdMobKeyFetcher = () => Promise<Map<string, string>>;

let cache: { keys: Map<string, string>; fetchedAt: number } | null = null;

/** Google's rotating SSV public keys (PEM by key id), cached for a day. */
export const fetchAdMobKeys: AdMobKeyFetcher = async () => {
  if (cache && Date.now() - cache.fetchedAt < KEY_TTL_MS) return cache.keys;
  const res = await fetch(KEYS_URL);
  if (!res.ok) throw new Error(`Failed to fetch AdMob verifier keys: ${res.status}`);
  const json = (await res.json()) as { keys: { keyId: number | string; pem: string }[] };
  const keys = new Map(json.keys.map((k) => [String(k.keyId), k.pem]));
  cache = { keys, fetchedAt: Date.now() };
  return keys;
};

export interface AdMobReward {
  adUnlockId: string;
  userId: string;
  transactionId: string;
  adUnit: string | null;
}

/**
 * Verifies an AdMob server-side verification callback. The signed message is
 * the raw query string up to (not including) "&signature=", and signature is
 * a web-safe base64 DER ECDSA/SHA-256 signature. Returns null when invalid.
 */
export async function verifyAdMobCallback(rawUrl: string, getKeys: AdMobKeyFetcher = fetchAdMobKeys): Promise<AdMobReward | null> {
  const url = new URL(rawUrl);
  const query = url.search.slice(1);
  const sigIndex = query.indexOf("&signature=");
  if (sigIndex < 0) return null;
  const message = query.slice(0, sigIndex);
  const params = url.searchParams;
  const signature = params.get("signature");
  const keyId = params.get("key_id");
  if (!signature || !keyId) return null;

  let pem = (await getKeys()).get(keyId);
  if (!pem) {
    cache = null; // Keys rotate; refetch once for an unknown id.
    pem = (await getKeys()).get(keyId);
  }
  if (!pem) return null;

  const valid = verify(
    "sha256",
    Buffer.from(message, "utf8"),
    { key: createPublicKey(pem), dsaEncoding: "der" },
    Buffer.from(signature, "base64url"),
  );
  if (!valid) return null;

  const adUnlockId = params.get("custom_data");
  const userId = params.get("user_id");
  const transactionId = params.get("transaction_id");
  if (!adUnlockId || !userId || !transactionId) return null;
  return { adUnlockId, userId, transactionId, adUnit: params.get("ad_unit") };
}

/** Records the verified reward (once per transaction) and starts the rewrite. */
export async function redeemAdReward(ctx: ServiceContext, reward: AdMobReward) {
  const unlock = await verifyAdUnlock(ctx.db, reward.adUnlockId, reward.userId, reward.transactionId);
  if (!unlock) {
    const existing = await getAdUnlock(ctx.db, reward.adUnlockId);
    return { redeemed: false, alreadyVerified: Boolean(existing?.rewardVerifiedAt) };
  }
  if (unlock.voiceProfileId) {
    const voiceId = unlock.voiceProfileId;
    ctx.defer(async () => {
      await ensureRewrite(ctx, unlock.saveId, voiceId);
    });
  }
  return { redeemed: true, alreadyVerified: false };
}
