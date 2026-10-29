import { createTransport } from "nodemailer";
import { z } from "zod";
import { getDb } from "@echo/db";
import { env } from "@/lib/env";
import { json, route } from "@/lib/http";
import { createMobileMagicToken } from "@/lib/services/accounts";

const Body = z.object({ email: z.email().max(254) });

/** Sends the app a magic link. The link opens /auth/mobile, which hands the code to the app. */
export const POST = route(async (req: Request) => {
  const { email } = Body.parse(await req.json());
  const token = await createMobileMagicToken(getDb(), email);
  const link = `${env.appUrl}/auth/mobile?${new URLSearchParams({ email, token })}`;
  await createTransport(process.env.EMAIL_SERVER).sendMail({
    to: email,
    from: process.env.EMAIL_FROM,
    subject: "Sign in to Echo",
    text: `Tap to sign in to Echo on your iPhone:\n\n${link}\n\nThe link works for 15 minutes. If you didn't ask for it, ignore this email.`,
    html: `<div style="font-family:-apple-system,system-ui,sans-serif;color:#111315;max-width:420px;margin:0 auto;padding:32px 24px">
<p style="font-size:20px;font-weight:600;margin:0 0 16px">Sign in to Echo</p>
<p style="color:#55554F;line-height:1.6">Tap the button on your iPhone to finish signing in. The link works for 15 minutes.</p>
<p style="margin:28px 0"><a href="${link}" style="background:#111315;color:#fff;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:600">Open Echo</a></p>
<p style="color:#8a8a83;font-size:13px">If you didn't ask for this, you can ignore this email.</p></div>`,
  });
  return json({ sent: true });
});
