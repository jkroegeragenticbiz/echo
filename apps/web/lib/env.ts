import "server-only";
import { DEFAULT_FREE_SAVES_PER_MONTH } from "@echo/core";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  return value;
}

/** Read lazily so `next build` works without secrets present. */
export const env = {
  get authSecret() {
    return required("AUTH_SECRET");
  },
  get appUrl() {
    return (process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get freeSavesPerMonth() {
    const n = Number(process.env.FREE_SAVES_PER_MONTH);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_FREE_SAVES_PER_MONTH;
  },
  get xClientId() {
    return required("X_CLIENT_ID");
  },
  get xClientSecret() {
    return process.env.X_CLIENT_SECRET || undefined;
  },
  get admobRewardedUnitId() {
    return process.env.ADMOB_REWARDED_UNIT_ID ?? "";
  },
  get revenuecatWebhookSecret() {
    return required("REVENUECAT_WEBHOOK_SECRET");
  },
  get appleBundleId() {
    return process.env.APPLE_BUNDLE_ID ?? "ai.getecho.app";
  },
  get cronSecret() {
    return process.env.CRON_SECRET;
  },
};
