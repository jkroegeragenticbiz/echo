import { randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { accounts, deleteUserAccount, users, verificationTokens, type Database } from "@echo/db";
import { sha256Hex } from "../crypto";
import type { AppleIdentity } from "../apple";

/** Finds or creates the user for a native Sign in with Apple identity, linking by email when possible. */
export async function upsertAppleUser(db: Database, identity: AppleIdentity) {
  const [linked] = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(and(eq(accounts.provider, "apple"), eq(accounts.providerAccountId, identity.sub)))
    .limit(1);
  if (linked) return linked.userId;

  let userId: string | undefined;
  if (identity.email && identity.emailVerified) {
    const [byEmail] = await db.select({ id: users.id }).from(users).where(eq(users.email, identity.email)).limit(1);
    userId = byEmail?.id;
  }
  if (!userId) {
    const [created] = await db
      .insert(users)
      .values({ email: identity.email, emailVerified: identity.emailVerified ? new Date() : null })
      .returning({ id: users.id });
    userId = created!.id;
  }
  await db
    .insert(accounts)
    .values({ userId, type: "oidc", provider: "apple", providerAccountId: identity.sub })
    .onConflictDoNothing();
  return userId;
}

export async function upsertEmailUser(db: Database, email: string) {
  const normalized = email.trim().toLowerCase();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalized)).limit(1);
  if (existing) {
    await db.update(users).set({ emailVerified: new Date() }).where(eq(users.id, existing.id));
    return existing.id;
  }
  const [created] = await db.insert(users).values({ email: normalized, emailVerified: new Date() }).returning({ id: users.id });
  return created!.id;
}

const MOBILE_PREFIX = "mobile:";
export const MAGIC_LINK_TTL_MS = 15 * 60_000;

/** One-time code for the app's email sign-in. Only its hash is stored. */
export async function createMobileMagicToken(db: Database, email: string) {
  const token = randomBytes(24).toString("base64url");
  const identifier = `${MOBILE_PREFIX}${email.trim().toLowerCase()}`;
  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier));
  await db.insert(verificationTokens).values({ identifier, token: sha256Hex(token), expires: new Date(Date.now() + MAGIC_LINK_TTL_MS) });
  return token;
}

/** Consumes the token; returns the user id or null when invalid or expired. */
export async function consumeMobileMagicToken(db: Database, email: string, token: string) {
  const identifier = `${MOBILE_PREFIX}${email.trim().toLowerCase()}`;
  const [row] = await db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, identifier),
        eq(verificationTokens.token, sha256Hex(token)),
        gt(verificationTokens.expires, new Date()),
      ),
    )
    .returning();
  if (!row) return null;
  return upsertEmailUser(db, email);
}

/**
 * Deletes the account and every row that belongs to it, then the uploaded
 * media. `deleteBlobs` is injected so tests don't touch Blob storage.
 */
export async function deleteAccount(db: Database, userId: string, deleteBlobs: (urls: string[]) => Promise<void>) {
  const media = await deleteUserAccount(db, userId);
  const ours = media.filter((u) => u.includes(".blob.vercel-storage.com/"));
  if (ours.length) await deleteBlobs(ours);
  return { deletedMedia: ours.length };
}
