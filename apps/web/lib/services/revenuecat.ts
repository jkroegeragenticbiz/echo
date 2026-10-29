import { z } from "zod";
import { PLUS_ENTITLEMENT_ID } from "@echo/core";
import { getUser, recordRevenuecatEvent, setUserPlan, type Database } from "@echo/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const RevenueCatWebhookSchema = z.object({
  api_version: z.string().optional(),
  event: z
    .object({
      id: z.string(),
      type: z.string(),
      app_user_id: z.string().optional(),
      original_app_user_id: z.string().optional(),
      aliases: z.array(z.string()).optional(),
      entitlement_ids: z.array(z.string()).nullable().optional(),
      expiration_at_ms: z.number().nullable().optional(),
      transferred_from: z.array(z.string()).optional(),
      transferred_to: z.array(z.string()).optional(),
      environment: z.string().optional(),
    })
    .loose(),
});
export type RevenueCatWebhook = z.infer<typeof RevenueCatWebhookSchema>;

const GRANTS = new Set(["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE", "NON_RENEWING_PURCHASE", "SUBSCRIPTION_EXTENDED"]);
// CANCELLATION and BILLING_ISSUE keep access until expiration_at_ms; EXPIRATION ends it.
const KEEPS_UNTIL_EXPIRY = new Set(["CANCELLATION", "BILLING_ISSUE", "SUBSCRIPTION_PAUSED"]);

/** The app calls Purchases.logIn(user.id), so one of these ids is our user's UUID. */
function findUserIds(event: RevenueCatWebhook["event"]): string[] {
  const candidates = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])];
  return [...new Set(candidates.filter((id): id is string => Boolean(id && UUID.test(id))))];
}

/** Applies a RevenueCat webhook to users.plan. Idempotent per event id. */
export async function handleRevenueCatEvent(db: Database, payload: RevenueCatWebhook) {
  const { event } = payload;
  if (event.type === "TEST") return { status: "ignored" as const };
  if (event.entitlement_ids && !event.entitlement_ids.includes(PLUS_ENTITLEMENT_ID) && event.type !== "TRANSFER") {
    return { status: "ignored" as const };
  }

  if (event.type === "TRANSFER") {
    const from = (event.transferred_from ?? []).filter((id) => UUID.test(id));
    const to = (event.transferred_to ?? []).filter((id) => UUID.test(id));
    if (!(await recordRevenuecatEvent(db, event.id, event.type, to[0] ?? null))) return { status: "duplicate" as const };
    for (const id of from) if (await getUser(db, id)) await setUserPlan(db, id, "free", null);
    for (const id of to) if (await getUser(db, id)) await setUserPlan(db, id, "plus", expiry(event));
    return { status: "applied" as const };
  }

  const userId = await firstExistingUser(db, findUserIds(event));
  if (!(await recordRevenuecatEvent(db, event.id, event.type, userId))) return { status: "duplicate" as const };
  if (!userId) return { status: "unknown_user" as const };

  if (GRANTS.has(event.type) || KEEPS_UNTIL_EXPIRY.has(event.type)) {
    await setUserPlan(db, userId, "plus", expiry(event));
  } else if (event.type === "EXPIRATION") {
    await setUserPlan(db, userId, "free", null);
  } else {
    return { status: "ignored" as const };
  }
  return { status: "applied" as const };
}

function expiry(event: RevenueCatWebhook["event"]): Date | null {
  return event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
}

async function firstExistingUser(db: Database, ids: string[]) {
  for (const id of ids) if (await getUser(db, id)) return id;
  return null;
}
