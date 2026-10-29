/** App Store link once the app is live; until then the button scrolls to the waitlist. */
export function appStoreUrl(): string {
  return process.env.NEXT_PUBLIC_APP_STORE_URL || "/#waitlist";
}
