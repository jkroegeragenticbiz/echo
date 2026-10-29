export const LEGAL_UPDATED = "October 29, 2026";
export const PRIVACY_EMAIL = process.env.NEXT_PUBLIC_PRIVACY_EMAIL ?? "privacy@getecho.ai";

export function LegalPage({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <p className="eyebrow">Last updated {LEGAL_UPDATED}</p>
      <h1 className="mt-3 text-4xl font-semibold">{title}</h1>
      {intro ? <p className="mt-5 text-lg leading-relaxed">{intro}</p> : null}
      <div className="prose-legal mt-8">{children}</div>
    </article>
  );
}
