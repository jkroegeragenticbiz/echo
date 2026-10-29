import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Apple, Mail } from "lucide-react";
import { auth, authMethods, signIn } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ check?: string; callbackUrl?: string; error?: string }> }) {
  const params = await searchParams;
  const session = await auth();
  const callbackUrl = params.callbackUrl?.startsWith("/") ? params.callbackUrl : "/library";
  if (session?.user) redirect(callbackUrl);

  if (params.check === "email") {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <Mail size={28} strokeWidth={1.75} className="mx-auto mb-5 text-ink" />
        <h1 className="text-3xl font-semibold">Check your email</h1>
        <p className="mt-3 leading-relaxed">We sent you a sign-in link. It works for 24 hours.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 py-20">
      <div className="card p-8">
        <h1 className="text-2xl font-semibold">Sign in to Echo</h1>
        <p className="mt-2 text-sm leading-relaxed">Use the same account as the iOS app to see your library on the web.</p>
        {params.error ? <p className="mt-4 text-sm text-red-700" role="alert">That didn&apos;t work. Please try again.</p> : null}
        {!authMethods.apple && !authMethods.email ? (
          <p className="mt-6 rounded-[var(--radius-inner)] bg-wash p-4 text-sm">Sign-in isn&apos;t configured yet. Set AUTH_APPLE_ID/AUTH_APPLE_SECRET or EMAIL_SERVER/EMAIL_FROM.</p>
        ) : null}
        {authMethods.apple ? (
        <form
          className="mt-7"
          action={async () => {
            "use server";
            await signIn("apple", { redirectTo: callbackUrl });
          }}
        >
          <button className="btn btn-primary w-full" type="submit">
            <Apple size={18} strokeWidth={1.75} /> Continue with Apple
          </button>
        </form>
        ) : null}
        {authMethods.apple && authMethods.email ? (
        <div className="my-6 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
        </div>
        ) : null}
        {authMethods.email ? (
        <form
          className={authMethods.apple ? "space-y-3" : "mt-7 space-y-3"}
          action={async (data: FormData) => {
            "use server";
            await signIn("nodemailer", { email: String(data.get("email") ?? ""), redirectTo: callbackUrl });
          }}
        >
          <label htmlFor="email" className="sr-only">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@email.com" className="field" />
          <button className="btn btn-secondary w-full" type="submit">
            <Mail size={17} strokeWidth={1.75} /> Email me a sign-in link
          </button>
        </form>
        ) : null}
      </div>
    </div>
  );
}
