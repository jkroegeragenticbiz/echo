import { NextResponse } from "next/server";
import { getDb } from "@echo/db";
import { env } from "@/lib/env";
import { xConfig } from "@/lib/services/runtime";
import { completeXConnect, readXState } from "@/lib/services/x";

function back(returnTo: string, params: Record<string, string>) {
  const target = returnTo.startsWith("echo://") ? new URL(returnTo) : new URL(returnTo, env.appUrl);
  for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
  return NextResponse.redirect(target.toString());
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const state = params.get("state");
  const code = params.get("code");
  if (!state) return NextResponse.redirect(new URL("/library?x=error", env.appUrl));
  let returnTo = "/library";
  try {
    returnTo = readXState(state, env.authSecret).returnTo;
    if (!code) return back(returnTo, { x: params.get("error") === "access_denied" ? "cancelled" : "error" });
    const result = await completeXConnect(getDb(), code, state, xConfig());
    return back(result.returnTo, { x: "connected", username: result.username });
  } catch (err) {
    console.error("X connect failed:", err);
    return back(returnTo, { x: "error" });
  }
}
