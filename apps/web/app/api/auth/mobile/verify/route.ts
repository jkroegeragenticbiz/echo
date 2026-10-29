import { z } from "zod";
import { getDb } from "@echo/db";
import { env } from "@/lib/env";
import { HttpError, json, route } from "@/lib/http";
import { signMobileToken } from "@/lib/mobile-token";
import { consumeMobileMagicToken } from "@/lib/services/accounts";

const Body = z.object({ email: z.email(), token: z.string().min(10) });

export const POST = route(async (req: Request) => {
  const { email, token } = Body.parse(await req.json());
  const userId = await consumeMobileMagicToken(getDb(), email, token);
  if (!userId) throw new HttpError(401, "That sign-in link expired. Request a new one.", "invalid_magic_link");
  return json({ token: await signMobileToken(userId, env.authSecret), user_id: userId });
});
