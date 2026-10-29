import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { VoiceProfileInputSchema } from "@echo/core";
import { getDb, getVoiceProfile, listVoiceProfiles, setActiveVoiceProfile, voiceProfiles } from "@echo/db";
import { HttpError, json, route } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { toVoiceDTO } from "@/lib/services/voices";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const id = z.uuid().parse((await params).id);
  const input = VoiceProfileInputSchema.partial().parse(await req.json());
  const db = getDb();
  const [row] = await db
    .update(voiceProfiles)
    .set({
      name: input.name,
      personas: input.personas,
      description: input.description,
      perspective: input.perspective,
      tone: input.tone,
      voiceSample: input.voice_sample,
    })
    .where(and(eq(voiceProfiles.id, id), eq(voiceProfiles.userId, userId)))
    .returning();
  if (!row) throw new HttpError(404, "Voice not found", "not_found");
  return json({ voice: toVoiceDTO(row) });
});

export const DELETE = route(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const id = z.uuid().parse((await params).id);
  const db = getDb();
  const voice = await getVoiceProfile(db, userId, id);
  if (!voice) throw new HttpError(404, "Voice not found", "not_found");
  const all = await listVoiceProfiles(db, userId);
  if (all.length <= 1) throw new HttpError(409, "You need at least one voice.", "last_voice");
  await db.delete(voiceProfiles).where(eq(voiceProfiles.id, id));
  if (voice.isActive) await setActiveVoiceProfile(db, userId, all.find((v) => v.id !== id)!.id);
  return json({ deleted: true });
});
