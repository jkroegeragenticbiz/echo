import { VoiceProfileInputSchema } from "@echo/core";
import { countVoiceProfiles, effectivePlan, getActiveVoiceProfile, getDb, getUser, listVoiceProfiles, voiceProfiles } from "@echo/db";
import { eq } from "drizzle-orm";
import { HttpError, json, route } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { MAX_FREE_VOICES, MAX_PLUS_VOICES, toVoiceDTO } from "@/lib/services/voices";

export const GET = route(async (req: Request) => {
  const userId = await requireUserId(req);
  return json({ voices: (await listVoiceProfiles(getDb(), userId)).map(toVoiceDTO) });
});

/** Adds another voice. More than one voice is an Echo Plus feature. */
export const POST = route(async (req: Request) => {
  const userId = await requireUserId(req);
  const input = VoiceProfileInputSchema.parse(await req.json());
  const db = getDb();
  const user = await getUser(db, userId);
  if (!user) throw new HttpError(401, "Sign in to continue", "unauthorized");
  const max = effectivePlan(user) === "plus" ? MAX_PLUS_VOICES : MAX_FREE_VOICES;
  const count = await countVoiceProfiles(db, userId);
  if (count >= max) {
    throw new HttpError(402, max === MAX_FREE_VOICES ? "Multiple voices are part of Echo Plus." : "You've reached the voice limit.", "voice_limit");
  }
  const [row] = await db
    .insert(voiceProfiles)
    .values({
      userId,
      name: input.name,
      personas: input.personas,
      description: input.description,
      perspective: input.perspective,
      tone: input.tone,
      voiceSample: input.voice_sample,
      isActive: count === 0,
    })
    .returning();
  return json({ voice: toVoiceDTO(row!) }, 201);
});

/** Onboarding: create or replace the active voice. */
export const PUT = route(async (req: Request) => {
  const userId = await requireUserId(req);
  const input = VoiceProfileInputSchema.parse(await req.json());
  const db = getDb();
  const values = {
    name: input.name,
    personas: input.personas,
    description: input.description,
    perspective: input.perspective,
    tone: input.tone,
    voiceSample: input.voice_sample,
  };
  const active = await getActiveVoiceProfile(db, userId);
  const [row] = active
    ? await db.update(voiceProfiles).set(values).where(eq(voiceProfiles.id, active.id)).returning()
    : await db.insert(voiceProfiles).values({ ...values, userId, isActive: true }).returning();
  return json({ voice: toVoiceDTO(row!) });
});
