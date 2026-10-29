import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { countSavesThisMonth, effectivePlan, getDb, getSocialConnection, getUser } from "@echo/db";
import { DeleteAccount, XConnection } from "@/components/account-actions";
import { auth, signOut } from "@/lib/auth";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ x?: string }> }) {
  const { x: xResult } = await searchParams;
  const session = await auth();
  const userId = session!.user.id;
  const db = getDb();
  const [user, x, used] = await Promise.all([getUser(db, userId), getSocialConnection(db, userId, "x"), countSavesThisMonth(db, userId)]);
  const plan = user ? effectivePlan(user) : "free";

  return (
    <div className="max-w-2xl space-y-5 pt-6">
      <h1 className="mb-6 text-4xl font-bold tracking-tight">Account</h1>

      <section className="card p-6">
        <h2 className="text-lg font-semibold">Plan</h2>
        <p className="mt-1">
          {plan === "plus"
            ? `Echo Plus${user?.planExpiresAt ? `, renews or ends ${user.planExpiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""}.`
            : `Free: ${used} of ${env.freeSavesPerMonth} saves used this month.`}
        </p>
        <p className="mt-2 text-sm text-muted">Subscriptions are managed in the iOS app and in your Apple ID settings.</p>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold">Connected accounts</h2>
        <XConnection
          connected={x?.status === "active"}
          username={x?.externalUsername ?? null}
          lastSyncedAt={x?.lastSyncedAt?.toISOString() ?? null}
          plan={plan}
          result={xResult ?? null}
        />
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold">Signed in as</h2>
        <p className="mt-1">{user?.email ?? "Apple ID (email hidden)"}</p>
        <form
          className="mt-4"
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button type="submit" className="btn btn-secondary !py-2 text-sm"><LogOut size={16} strokeWidth={1.75} /> Sign out</button>
        </form>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold">Delete account</h2>
        <p className="mt-1 leading-relaxed">
          This permanently deletes your saves, rewrites, voices, connected accounts and uploaded media. If you subscribe to Echo Plus, also cancel in your Apple ID settings so you aren&apos;t billed again.
        </p>
        <DeleteAccount signOutAction={async () => {
          "use server";
          await signOut({ redirectTo: "/?deleted=1" });
        }} />
      </section>
    </div>
  );
}
