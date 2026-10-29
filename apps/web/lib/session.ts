import "server-only";
import { auth } from "./auth";
import { env } from "./env";
import { HttpError } from "./http";
import { verifyMobileToken } from "./mobile-token";

/** Resolves the signed-in user from a bearer token (iOS) or the Auth.js session cookie (web). */
export async function getUserId(req?: Request): Promise<string | null> {
  const header = req?.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    return verifyMobileToken(header.slice(7).trim(), env.authSecret);
  }
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function requireUserId(req?: Request): Promise<string> {
  const userId = await getUserId(req);
  if (!userId) throw new HttpError(401, "Sign in to continue", "unauthorized");
  return userId;
}
