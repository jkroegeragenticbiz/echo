import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

const APPLE_ISSUER = "https://appleid.apple.com";
let jwks: JWTVerifyGetKey | null = null;

export interface AppleIdentity {
  sub: string;
  email: string | null;
  emailVerified: boolean;
}

/** Verifies an identity token from native Sign in with Apple (expo-apple-authentication). */
export async function verifyAppleIdentityToken(
  token: string,
  audience: string,
  getKey: JWTVerifyGetKey = (jwks ??= createRemoteJWKSet(new URL(`${APPLE_ISSUER}/auth/keys`))),
): Promise<AppleIdentity> {
  const { payload } = await jwtVerify(token, getKey, { issuer: APPLE_ISSUER, audience });
  if (!payload.sub) throw new Error("Apple token has no subject");
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  return {
    sub: payload.sub,
    email,
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
  };
}
