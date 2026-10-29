import { z } from "zod";
import type { RelatedSaveDTO } from "@echo/core";
import { getDb, getRewrite, relatedSaves } from "@echo/db";
import { json, route } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { ensureActiveVoice } from "@/lib/services/voices";

/** Saves closest to this one by embedding cosine similarity. */
export const GET = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId(req);
  const id = z.uuid().parse((await params).id);
  const db = getDb();
  const voice = await ensureActiveVoice(db, userId);
  const rows = await relatedSaves(db, userId, id, 5);
  const related: RelatedSaveDTO[] = await Promise.all(
    rows
      .filter((r) => r.similarity > 0.3)
      .map(async (r) => ({
        id: r.id,
        headline: (await getRewrite(db, r.id, voice.id))?.headline ?? r.summary,
        author: r.author,
        platform: r.platform,
        domain: r.domain,
        similarity: Number(r.similarity.toFixed(3)),
      })),
  );
  return json({ related });
});
