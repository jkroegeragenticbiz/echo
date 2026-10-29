import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { auth } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/library");
  return (
    <>
      <header className="sticky top-0 z-30 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Logo href="/library" />
          <nav className="flex items-center gap-6 text-[0.92rem] font-medium">
            <Link href="/library" className="hover:text-ink">Library</Link>
            <Link href="/account" className="hover:text-ink">Account</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">{children}</main>
    </>
  );
}
