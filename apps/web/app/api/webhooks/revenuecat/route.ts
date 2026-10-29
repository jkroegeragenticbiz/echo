import { getDb } from "@echo/db";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { HttpError, json, route } from "@/lib/http";
import { handleRevenueCatEvent, RevenueCatWebhookSchema } from "@/lib/services/revenuecat";

/** RevenueCat sends the Authorization header value configured in its dashboard. */
export const POST = route(async (req: Request) => {
  const header = req.headers.get("authorization") ?? "";
  const secret = env.revenuecatWebhookSecret;
  if (!safeEqual(header, secret) && !safeEqual(header, `Bearer ${secret}`)) {
    throw new HttpError(401, "Unauthorized", "unauthorized");
  }
  const payload = RevenueCatWebhookSchema.parse(await req.json());
  return json(await handleRevenueCatEvent(getDb(), payload));
});
