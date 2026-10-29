import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 sm:flex-row sm:items-start sm:justify-between sm:px-8">
        <div className="max-w-xs space-y-3">
          <Logo />
          <p className="text-sm leading-relaxed">Your saves from every app, in one library, in your own voice.</p>
        </div>
        <nav className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm" aria-label="Footer">
          <Link href="/#how" className="hover:text-ink">How it works</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/#pricing" className="hover:text-ink">Pricing</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <Link href="/library" className="hover:text-ink">Web library</Link>
          <Link href="/data" className="hover:text-ink">Your data</Link>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-5 pb-10 text-xs text-muted sm:px-8">© {new Date().getFullYear()} Echo. Not affiliated with LinkedIn, X, Instagram, TikTok or YouTube.</p>
    </footer>
  );
}
