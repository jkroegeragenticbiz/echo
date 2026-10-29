/** Product limits shared by the API and the apps. Override via env on the server. */
export const DEFAULT_FREE_SAVES_PER_MONTH = 15;

export const PLUS_PRICING = {
  monthly: { price: "$7.99", period: "month", productId: "echo_plus_monthly" },
  annual: { price: "$59.99", period: "year", productId: "echo_plus_annual" },
} as const;

/** RevenueCat entitlement identifier that maps to users.plan = 'plus'. */
export const PLUS_ENTITLEMENT_ID = "plus";

export const APP_GROUP_ID = "group.ai.getecho.shared";
export const IOS_BUNDLE_ID = "ai.getecho.app";
