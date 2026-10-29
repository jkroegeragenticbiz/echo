"use client";

import { useEffect, useState } from "react";
import { LANDING_DEMO_SAVE, PERSONAS, type PersonaId } from "@echo/core";
import { InYourVoice } from "./in-your-voice";
import { MetricPill } from "./metric-pill";
import { PlatformBadge } from "./platform-badge";

const demo = LANDING_DEMO_SAVE;
const personas = PERSONAS.filter((p) => demo.rewrites[p.id]);

/** Words fade in one after another so the rewrite visibly "writes itself". */
function Reveal({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <>
      {text.split(" ").map((word, i) => (
        <span key={i} className="inline-block opacity-0 [animation:word-in_380ms_ease-out_forwards]" style={{ animationDelay: `${delay + i * 22}ms` }}>
          {word}&nbsp;
        </span>
      ))}
    </>
  );
}

export function LiveDemo() {
  const [active, setActive] = useState<PersonaId>(personas[0]!.id);
  const [touched, setTouched] = useState(false);

  // Gently cycle personas until the visitor picks one.
  useEffect(() => {
    if (touched) return;
    const id = setInterval(() => {
      setActive((current) => {
        const i = personas.findIndex((p) => p.id === current);
        return personas[(i + 1) % personas.length]!.id;
      });
    }, 6500);
    return () => clearInterval(id);
  }, [touched]);

  const persona = personas.find((p) => p.id === active)!;
  const rewrite = demo.rewrites[active]!;
  const headlineWords = rewrite.headline.split(" ").length;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
      <article className="card p-6" aria-label="The original post">
        <div className="mb-4 flex items-center justify-between">
          <PlatformBadge platform={demo.platform} author={demo.author} />
          <span className="eyebrow">Original</span>
        </div>
        <p className="max-h-[22rem] overflow-y-auto text-[0.92rem] leading-relaxed whitespace-pre-wrap">{demo.verbatim_text}</p>
      </article>

      <div className="space-y-4">
        <div role="tablist" aria-label="Pick a persona" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible">
          {personas.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={p.id === active}
              onClick={() => {
                setTouched(true);
                setActive(p.id);
              }}
              className="pill"
            >
              {p.shortLabel}
            </button>
          ))}
        </div>

        <article className="card p-6" aria-live="polite" role="tabpanel">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted">Rewritten for a {persona.label}</span>
            {demo.key_metric ? <MetricPill metric={demo.key_metric} /> : null}
          </div>
          <div key={active}>
            <h3 className="mb-4 text-xl leading-snug font-semibold text-ink sm:text-[1.4rem]">
              <Reveal text={rewrite.headline} />
            </h3>
            <InYourVoice voiceName={persona.shortLabel}>
              <p className="leading-relaxed text-ink/85"><Reveal text={rewrite.paraphrase} delay={headlineWords * 22 + 120} /></p>
            </InYourVoice>
            <ol className="mt-5 space-y-2.5">
              {rewrite.action_steps.map((step, i) => (
                <li
                  key={i}
                  className="flex gap-3 opacity-0 [animation:word-in_420ms_ease-out_forwards]"
                  style={{ animationDelay: `${900 + i * 160}ms` }}
                >
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong text-[0.7rem] font-semibold text-ink">{i + 1}</span>
                  <span className="text-[0.93rem] leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </article>
      </div>
    </div>
  );
}
