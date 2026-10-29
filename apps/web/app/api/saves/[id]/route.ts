import { z } from "zod";
import { del } from "@vercel/blob";
import { deleteSave, getDb, getRewrite, getSave } from "@echo/db";
import { HttpError, json, route } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { toSaveDTO } from "@/lib/services/dto";
import { ensureActiveVoice } from "@/lib/services/voices";

type Ctx = { params: Promise<{ id: string }> };
const Id = z.uuid();

export const GET = route(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const id = Id.parse((await params).id);
  const db = getDb();
  const save = await getSave(db, userId, id);
  if (!save) throw new HttpError(404, "Save not found", "not_found");
  const voiceParam = new URL(req.url).searchParams.get("voice");
  const voiceId = voiceParam ? Id.parse(voiceParam) : (await ensureActiveVoice(db, userId)).id;
  return json({ save: toSaveDTO(save, await getRewrite(db, save.id, voiceId)) });
});

export const DELETE = route(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const id = Id.parse((await params).id);
  const removed = await deleteSave(getDb(), userId, id);
  if (!removed) throw new HttpError(404, "Save not found", "not_found");
  const blobs = removed.mediaUrls.filter((u) => u.includes(".blob.vercel-storage.com/"));
  if (blobs.length && process.env.BLOB_READ_WRITE_TOKEN) await del(blobs);
  return json({ deleted: true });
});
