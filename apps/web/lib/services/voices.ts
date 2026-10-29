import { PERSONAS, type VoiceProfile } from "@echo/core";
import { getActiveVoiceProfile, voiceProfiles, type Database, type VoiceProfileRow } from "@echo/db";

export function toVoiceDTO(row: VoiceProfileRow): VoiceProfile {
  return {
    id: row.id,
    name: row.name,
    personas: row.personas,
    description: row.description,
    perspective: row.perspective,
    tone: row.tone,
    voice_sample: row.voiceSample,
    is_active: row.isActive,
  };
}

/** Returns the active voice, creating a neutral one if onboarding was skipped. */
export async function ensureActiveVoice(db: Database, userId: string): Promise<VoiceProfileRow> {
  const active = await getActiveVoiceProfile(db, userId);
  if (active) return active;
  const [created] = await db
    .insert(voiceProfiles)
    .values({ userId, name: "My voice", personas: [], description: "", perspective: "first_person", tone: [], isActive: true })
    .onConflictDoNothing()
    .returning();
  return created ?? (await getActiveVoiceProfile(db, userId))!;
}

export const MAX_FREE_VOICES = 1;
export const MAX_PLUS_VOICES = PERSONAS.length + 4;
