import { del } from "@vercel/blob";
import type { MeDTO } from "@echo/core";
import { getDb, getSocialConnection } from "@echo/db";
import { json, route } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { deleteAccount } from "@/lib/services/accounts";
import { serviceContext } from "@/lib/services/runtime";
import { getUsage } from "@/lib/services/saves";

export const GET = route(async (req: Request) => {
  const userId = await requireUserId(req);
  const { user, plan, used, limit } = await getUsage(serviceContext(), userId);
  const x = await getSocialConnection(getDb(), userId, "x");
  const me: MeDTO & { x: { connected: boolean; username: string | null; last_synced_at: string | null } } = {
    id: user.id,
    email: user.email,
    plan,
    usage: { used, limit },
    x: {
      connected: x?.status === "active",
      username: x?.externalUsername ?? null,
      last_synced_at: x?.lastSyncedAt?.toISOString() ?? null,
    },
  };
  return json(me);
});

/** Permanently deletes the account and all data (App Store guideline 5.1.1(v)). */
export const DELETE = route(async (req: Request) => {
  const userId = await requireUserId(req);
  const result = await deleteAccount(getDb(), userId, async (urls) => {
    if (process.env.BLOB_READ_WRITE_TOKEN) await del(urls);
  });
  return json({ deleted: true, ...result });
});
