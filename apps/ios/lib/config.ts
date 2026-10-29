import { TestIds } from "react-native-google-mobile-ads";

/** The deployed web app (API host). Set per EAS build profile in eas.json. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? "";

/** Development builds always use Google's test unit so we never serve real ads to ourselves. */
export function rewardedUnitId(fromServer?: string | null): string {
  if (__DEV__) return TestIds.REWARDED;
  return fromServer || process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID || TestIds.REWARDED;
}

export const LINKS = {
  privacy: `${API_URL}/privacy`,
  terms: `${API_URL}/terms`,
  data: `${API_URL}/data`,
  manageSubscription: "https://apps.apple.com/account/subscriptions",
} as const;
