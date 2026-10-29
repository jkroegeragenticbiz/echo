import { jwtVerify, SignJWT } from "jose";
import { deriveKey } from "./crypto";

const AUDIENCE = "echo-ios";
const ISSUER = "echo";
export const MOBILE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 90;

/** Bearer token the iOS app (and its Share Extension, via the App Group) sends to the API. */
export async function signMobileToken(userId: string, secret: string, now = Date.now()): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience(AUDIENCE)
    .setIssuer(ISSUER)
    .setIssuedAt(Math.floor(now / 1000))
    .setExpirationTime(Math.floor(now / 1000) + MOBILE_TOKEN_TTL_SECONDS)
    .sign(deriveKey(secret, "mobile-token"));
}

export async function verifyMobileToken(token: string, secret: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, deriveKey(secret, "mobile-token"), { audience: AUDIENCE, issuer: ISSUER });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
