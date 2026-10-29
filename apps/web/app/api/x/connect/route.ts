import { NextResponse } from "next/server";
import { json, route } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { xConfig } from "@/lib/services/runtime";
import { startXConnect } from "@/lib/services/x";

/** Web: GET redirects to X. App: POST (bearer auth) returns the URL to open in an auth session. */
export const GET = route(async (req: Request) => {
  const userId = await requireUserId(req);
  const returnTo = new URL(req.url).searchParams.get("return_to");
  return NextResponse.redirect(startXConnect(userId, returnTo, xConfig()));
});

export const POST = route(async (req: Request) => {
  const userId = await requireUserId(req);
  const body = (await req.json().catch(() => ({}))) as { return_to?: string };
  return json({ url: startXConnect(userId, body.return_to ?? "echo://x-connected", xConfig()) });
});
