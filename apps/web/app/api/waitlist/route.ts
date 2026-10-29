import { WaitlistSchema } from "@echo/core";
import { addToWaitlist, getDb } from "@echo/db";
import { json, route } from "@/lib/http";

export const POST = route(async (req: Request) => {
  const { email, persona } = WaitlistSchema.parse(await req.json());
  await addToWaitlist(getDb(), email, persona);
  return json({ ok: true }, 201);
});
