import { getDb } from "@echo/db";
import { HttpError, json, route } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { serviceContext, xConfig } from "@/lib/services/runtime";
import { disconnectX, getXClient, syncXBookmarks } from "@/lib/services/x";

export const maxDuration = 300;

/** Manual "Import my X bookmarks now". */
export const POST = route(async (req: Request) => {
  const userId = await requireUserId(req);
  const ctx = serviceContext();
  const x = await getXClient(ctx.db, userId, xConfig());
  if (!x) throw new HttpError(409, "Connect your X account first.", "x_not_connected");
  return json(await syncXBookmarks(ctx, userId, x));
});

export const DELETE = route(async (req: Request) => {
  const userId = await requireUserId(req);
  await disconnectX(getDb(), userId);
  return json({ disconnected: true });
});
