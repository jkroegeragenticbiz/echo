import { safeEqual } from "./crypto";
import { env } from "./env";
import { HttpError } from "./http";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export function requireCron(req: Request) {
  const secret = env.cronSecret;
  if (!secret) throw new HttpError(500, "CRON_SECRET is not configured", "cron_not_configured");
  if (!safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    throw new HttpError(401, "Unauthorized", "unauthorized");
  }
}
