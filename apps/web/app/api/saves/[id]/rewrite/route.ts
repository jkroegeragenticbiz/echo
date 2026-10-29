import { z } from "zod";
import { json, route } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { serviceContext } from "@/lib/services/runtime";
import { requestRewrite } from "@/lib/services/saves";

export const maxDuration = 120;

const Body = z.object({ voice_profile_id: z.uuid().optional() });

/** Rewrite a save in a (different) voice. Free users get an ad unlock to redeem first. */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId(req);
  const id = z.uuid().parse((await params).id);
  const body = Body.parse(await req.json().catch(() => ({})));
  return json(await requestRewrite(serviceContext(), userId, id, body.voice_profile_id), 202);
});
