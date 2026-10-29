import { z } from "zod";
import { getDb } from "@echo/db";
import { verifyAppleIdentityToken } from "@/lib/apple";
import { env } from "@/lib/env";
import { HttpError, json, route } from "@/lib/http";
import { signMobileToken } from "@/lib/mobile-token";
import { upsertAppleUser } from "@/lib/services/accounts";

const Body = z.object({ identity_token: z.string().min(20) });

/** Native Sign in with Apple: exchanges Apple's identity token for an Echo bearer token. */
export const POST = route(async (req: Request) => {
  const { identity_token } = Body.parse(await req.json());
  const identity = await verifyAppleIdentityToken(identity_token, env.appleBundleId).catch(() => {
    throw new HttpError(401, "Apple sign-in failed. Please try again.", "invalid_apple_token");
  });
  const userId = await upsertAppleUser(getDb(), identity);
  return json({ token: await signMobileToken(userId, env.authSecret), user_id: userId });
});
