import { z } from "zod";
import { CreateSaveSchema, DomainSchema } from "@echo/core";
import { getDb, listSaves } from "@echo/db";
import { json, route } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { toSaveDTO } from "@/lib/services/dto";
import { serviceContext } from "@/lib/services/runtime";
import { createSave } from "@/lib/services/saves";
import { ensureActiveVoice } from "@/lib/services/voices";

// Classification/rewrite (and video jobs) run in after(); give them room.
export const maxDuration = 300;

const ListQuery = z.object({
  voice: z.uuid().optional(),
  domain: DomainSchema.optional(),
  q: z.string().max(200).optional(),
  before: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const GET = route(async (req: Request) => {
  const userId = await requireUserId(req);
  const params = ListQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const db = getDb();
  const voiceId = params.voice ?? (await ensureActiveVoice(db, userId)).id;
  const rows = await listSaves(db, userId, {
    voiceProfileId: voiceId,
    domain: params.domain,
    query: params.q,
    before: params.before,
    limit: params.limit,
  });
  const saves = rows.map((r) => toSaveDTO(r.save, r.rewrite));
  return json({ saves, voice_profile_id: voiceId, next_before: saves.length ? saves[saves.length - 1]!.created_at : null });
});

export const POST = route(async (req: Request) => {
  const userId = await requireUserId(req);
  const input = CreateSaveSchema.parse(await req.json());
  const result = await createSave(serviceContext(), userId, input);
  return json(result, result.duplicate ? 200 : 201);
});
