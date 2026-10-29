import { z } from "zod";
import { getDb, getVoiceProfile, setActiveVoiceProfile } from "@echo/db";
import { HttpError, json, route } from "@/lib/http";
import { requireUserId } from "@/lib/session";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId(req);
  const id = z.uuid().parse((await params).id);
  const db = getDb();
  if (!(await getVoiceProfile(db, userId, id))) throw new HttpError(404, "Voice not found", "not_found");
  await setActiveVoiceProfile(db, userId, id);
  return json({ active: id });
});
