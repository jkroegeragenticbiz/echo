import { BookmarkX, Check, Library, Share, Sparkles } from "lucide-react";
import { DEFAULT_FREE_SAVES_PER_MONTH, PERSONAS, PLUS_PRICING } from "@echo/core";
import { LiveDemo } from "@/components/live-demo";
import { WaitlistForm } from "@/components/waitlist-form";
import { appStoreUrl } from "@/lib/links";

const STEPS = [
  {
    icon: Share,
    title: "Save anywhere",
    body: "Tap Share on any post in LinkedIn, X, Instagram, TikTok or YouTube, or drop in a screenshot. Connect X once and your bookmarks sync on their own.",
  },
  {
    icon: Sparkles,
    title: "Rewritten in your voice",
    body: "Echo keeps the original word for word, then rewrites the takeaway as you: your role, your tone, your next three steps. Numbers stay exactly as posted.",
  },
  {
    icon: Library,
    title: "One library to grow from",
    body: "Stock theses, workouts, sales scripts and habits in one calm place, filed by topic, searchable, and linked to the saves they relate to.",
  },
];

const FAQ = [
  {
    q: "Which apps does Echo work with?",
    a: "Anything with a Share button: LinkedIn, X, Instagram, TikTok, YouTube, Safari and more. Screenshots and screen recordings work too. X is the only platform with an official bookmarks API, so it's the only one that can sync automatically.",
  },
  {
    q: "Does Echo log in to my Instagram or LinkedIn?",
    a: "No. Echo never asks for your social passwords and never reads your accounts. It only sees what you share to it. For X, you connect through X's official sign-in and can disconnect any time.",
  },
  {
    q: "Will the rewrite change the facts?",
    a: "No. The original is kept word for word next to every rewrite, and Echo checks each rewrite: if it mentions a number or ticker that isn't in the original, it's rejected and redone.",
  },
  {
    q: "What if I'm more than one thing?",
    a: "Most people are. Pick several personas, or describe yourself in your own words, like \"ER nurse who lifts and invests on the side\". Plus members can keep several voices and switch between them.",
  },
  {
    q: "How does the free plan work?",
    a: `You get ${DEFAULT_FREE_SAVES_PER_MONTH} saves a month. Before each rewrite you watch one short video ad. Echo Plus removes ads, lifts the limit and adds automatic X sync.`,
  },
  {
    q: "Can I delete my data?",
    a: "Yes. Delete any save, or delete your account from Settings in the app or on the web. Everything is removed, including uploaded screenshots and videos.",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pt-16 pb-20 sm:px-8 sm:pt-24">
        <div className="max-w-3xl">
          <p className="eyebrow mb-5 inline-flex items-center gap-2"><BookmarkX size={15} strokeWidth={1.75} /> For everyone with a bookmarks folder</p>
          <h1 className="text-[2.6rem] leading-[1.05] font-semibold sm:text-6xl">Stop letting your best saves die in a bookmark folder.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
            Echo collects the posts you save across every app into one library, keeps each one word for word, and rewrites the takeaway in your own voice, so you actually use it.
          </p>
          <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-start" id="waitlist">
            <WaitlistForm />
            <a href={appStoreUrl()} className="btn btn-secondary shrink-0">Get the iOS app</a>
          </div>
        </div>
      </section>

      {/* Live demo */}
      <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8" aria-labelledby="demo-title">
        <div className="mb-8 max-w-2xl">
          <h2 id="demo-title" className="text-3xl font-semibold sm:text-4xl">One post. Eight people. Eight takeaways.</h2>
          <p className="mt-3 text-lg leading-relaxed">Pick a persona and watch the same LinkedIn post rewrite itself for them.</p>
        </div>
        <LiveDemo />
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-line bg-card/60 py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <h2 className="mb-12 max-w-xl text-3xl font-semibold sm:text-4xl">How Echo works</h2>
          <ol className="grid gap-5 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="card p-7">
                <div className="mb-6 flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-full border border-line bg-wash text-ink">
                    <step.icon size={20} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold text-muted tabular-nums">0{i + 1}</span>
                </div>
                <h3 className="mb-2 text-xl font-semibold">{step.title}</h3>
                <p className="leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Personas */}
      <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-semibold sm:text-4xl">Built for whoever you are</h2>
          <p className="mt-3 text-lg leading-relaxed">Start with a persona, mix a few, or describe yourself in a sentence.</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PERSONAS.map((p) => (
            <li key={p.id} className="rounded-[var(--radius-card)] border border-line bg-card px-5 py-4">
              <p className="font-semibold text-ink">{p.label}</p>
              <p className="mt-1 text-sm">{p.blurb}</p>
            </li>
          ))}
          <li className="rounded-[var(--radius-card)] border border-dashed border-line-strong px-5 py-4">
            <p className="font-semibold text-ink">Custom</p>
            <p className="mt-1 text-sm">&ldquo;Product designer who runs marathons and reads 10-Ks.&rdquo;</p>
          </li>
        </ul>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-y border-line bg-card/60 py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <h2 className="mb-3 text-3xl font-semibold sm:text-4xl">Simple pricing</h2>
          <p className="mb-12 text-lg">Start free. Go ad-free when Echo earns it.</p>
          <div className="grid max-w-4xl gap-5 md:grid-cols-2">
            <PriceCard
              name="Free"
              price="$0"
              period="forever"
              features={[`${DEFAULT_FREE_SAVES_PER_MONTH} saves a month`, "One voice", "Share from any app", "A short ad before each rewrite"]}
            />
            <PriceCard
              name="Echo Plus"
              price={PLUS_PRICING.monthly.price}
              period="per month"
              note={`or ${PLUS_PRICING.annual.price} a year (save 37%)`}
              features={["Unlimited saves", "No ads, instant rewrites", "Multiple voices", "Automatic X bookmark sync"]}
              highlight
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
        <h2 className="mb-10 text-3xl font-semibold sm:text-4xl">Questions</h2>
        <div className="divide-y divide-line border-y border-line">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium text-ink">
                {item.q}
                <span aria-hidden="true" className="text-2xl leading-none font-light text-muted transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <div className="card flex flex-col items-start gap-6 p-8 sm:p-12">
          <h2 className="max-w-xl text-3xl font-semibold sm:text-4xl">Your saves are worth more than a folder.</h2>
          <p className="max-w-xl text-lg">Join the waitlist and we&apos;ll send you the App Store link the day Echo launches.</p>
          <WaitlistForm compact />
        </div>
      </section>
    </>
  );
}

function PriceCard(props: { name: string; price: string; period: string; note?: string; features: string[]; highlight?: boolean }) {
  return (
    <div className={`card flex flex-col p-7 ${props.highlight ? "border-ink/80" : ""}`}>
      <p className="font-semibold text-ink">{props.name}</p>
      <p className="mt-4 flex items-baseline gap-2">
        <span className="text-4xl font-semibold text-ink tabular-nums">{props.price}</span>
        <span className="text-muted">{props.period}</span>
      </p>
      {props.note ? <p className="mt-1 text-sm text-muted">{props.note}</p> : <p className="mt-1 text-sm">&nbsp;</p>}
      <ul className="mt-6 space-y-2.5">
        {props.features.map((f) => (
          <li key={f} className="flex items-center gap-2.5">
            <Check size={16} strokeWidth={2} className="text-ink" aria-hidden="true" /> {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
