import Purchases, { LOG_LEVEL, type CustomerInfo } from "react-native-purchases";
import { PLUS_ENTITLEMENT_ID } from "@echo/core";
import { REVENUECAT_API_KEY } from "./config";

let configuredFor: string | null = null;

/** Configures RevenueCat with our user id so webhooks map straight to users.id. */
export async function identifyPurchaser(userId: string) {
  if (!REVENUECAT_API_KEY) return;
  if (configuredFor === null) {
    if (__DEV__) await Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: REVENUECAT_API_KEY, appUserID: userId });
    configuredFor = userId;
  } else if (configuredFor !== userId) {
    await Purchases.logIn(userId);
    configuredFor = userId;
  }
}

export async function resetPurchaser() {
  if (configuredFor === null) return;
  await Purchases.logOut().catch(() => undefined);
  configuredFor = null;
}

export function hasPlus(info: CustomerInfo | null | undefined): boolean {
  return Boolean(info?.entitlements.active[PLUS_ENTITLEMENT_ID]);
}

export const purchasesEnabled = () => Boolean(REVENUECAT_API_KEY);
