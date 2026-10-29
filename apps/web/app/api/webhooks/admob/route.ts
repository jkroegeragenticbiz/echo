import { NextResponse } from "next/server";
import { redeemAdReward, verifyAdMobCallback } from "@/lib/services/admob";
import { serviceContext } from "@/lib/services/runtime";

export const maxDuration = 120;

/**
 * AdMob rewarded-ad server-side verification callback. AdMob sends a signed
 * GET; we verify the ECDSA signature, mark the ad unlock as rewarded (once per
 * transaction) and start the rewrite. Configure this URL on the ad unit.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  // AdMob pings the URL without parameters when you save the setting.
  if (!params.has("signature")) return new NextResponse("ok");
  try {
    const reward = await verifyAdMobCallback(req.url);
    if (!reward) return new NextResponse("invalid signature", { status: 400 });
    await redeemAdReward(serviceContext(), reward);
    return new NextResponse("ok");
  } catch (err) {
    console.error("AdMob SSV failed:", err);
    return new NextResponse("error", { status: 500 });
  }
}
