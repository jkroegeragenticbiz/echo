import Link from "next/link";
import { appStoreUrl } from "@/lib/links";
import { Logo } from "./logo";

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-transparent bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 text-[0.92rem] font-medium md:flex">
          <Link href="/#how" className="hover:text-ink">How it works</Link>
          <Link href="/#pricing" className="hover:text-ink">Pricing</Link>
          <Link href="/#faq" className="hover:text-ink">FAQ</Link>
          <Link href={signedIn ? "/library" : "/sign-in"} className="hover:text-ink">
            {signedIn ? "Library" : "Sign in"}
          </Link>
        </nav>
        <a href={appStoreUrl()} className="btn btn-primary !px-4 !py-2 text-sm">
          Get the iOS app
        </a>
      </div>
    </header>
  );
}
