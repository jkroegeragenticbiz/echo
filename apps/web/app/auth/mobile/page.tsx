import type { Metadata } from "next";
import { OpenInApp } from "./open-in-app";

export const metadata: Metadata = { title: "Open Echo", robots: { index: false } };

/** Target of the app's magic-link email: hands the one-time code to the app. */
export default async function MobileAuthPage({ searchParams }: { searchParams: Promise<{ email?: string; token?: string }> }) {
  const { email, token } = await searchParams;
  const deepLink = email && token ? `echo://auth?${new URLSearchParams({ email, token })}` : null;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold">Opening Echo…</h1>
      {deepLink ? (
        <>
          <p className="mt-3 leading-relaxed">If nothing happens, tap the button on the iPhone where Echo is installed.</p>
          <OpenInApp href={deepLink} />
        </>
      ) : (
        <p className="mt-3">This sign-in link is incomplete. Request a new one from the app.</p>
      )}
    </main>
  );
}
