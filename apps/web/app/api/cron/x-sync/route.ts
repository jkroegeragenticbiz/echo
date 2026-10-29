import { effectivePlan, getUser, listActiveXConnections } from "@echo/db";
import { json, route } from "@/lib/http";
import { requireCron } from "@/lib/cron";
import { serviceContext, xConfig } from "@/lib/services/runtime";
import { getXClient, syncXBookmarks } from "@/lib/services/x";

export const maxDuration = 300;

/** Vercel Cron: automatic X bookmark sync for Echo Plus members. */
export const GET = route(async (req: Request) => {
  requireCron(req);
  const ctx = serviceContext();
  const started = Date.now();
  const results: { userId: string; imported?: number; error?: string }[] = [];
  const connections = (await listActiveXConnections(ctx.db)).sort(
    (a, b) => (a.lastSyncedAt?.getTime() ?? 0) - (b.lastSyncedAt?.getTime() ?? 0),
  );
  for (const conn of connections) {
    if (Date.now() - started > 240_000) break; // leave headroom under maxDuration
    const user = await getUser(ctx.db, conn.userId);
    if (!user || effectivePlan(user) !== "plus") continue;
    try {
      const x = await getXClient(ctx.db, conn.userId, xConfig());
      if (!x) continue;
      const r = await syncXBookmarks(ctx, conn.userId, x);
      results.push({ userId: conn.userId, imported: r.imported });
    } catch (err) {
      results.push({ userId: conn.userId, error: (err as Error).message });
    }
  }
  return json({ results });
});
