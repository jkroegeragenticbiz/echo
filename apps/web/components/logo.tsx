import Link from "next/link";

/** Wordmark plus a small "echo" mark: a dot with two widening arcs. */
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-ink" aria-label="Echo home">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="6" cy="12" r="2.5" fill="currentColor" />
        <path d="M11 7.5a6.5 6.5 0 0 1 0 9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <path d="M15.5 4.5a11 11 0 0 1 0 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" opacity="0.45" />
      </svg>
      <span className="text-[1.15rem] font-semibold tracking-tight">Echo</span>
    </Link>
  );
}
