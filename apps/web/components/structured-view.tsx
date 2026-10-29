import type { Structured } from "@echo/core";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="eyebrow">{title}</h4>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-[0.95rem] leading-relaxed">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden="true" className="mt-[0.6rem] size-1 shrink-0 rounded-full bg-line-strong" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number | null)[][] }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-inner)] border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-wash text-muted">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-line">
              {row.map((cell, j) => (
                <td key={j} className={`px-3 py-2 tabular-nums ${j === 0 ? "font-medium text-ink" : ""}`}>{cell ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Renders the classifier's domain-specific fields. */
export function StructuredView({ structured }: { structured: Structured }) {
  switch (structured.domain) {
    case "markets_thesis": {
      const d = structured.data;
      return (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {d.tickers.map((t) => <span key={t} className="rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">${t}</span>)}
            <span className="rounded-full border border-line px-2.5 py-1 text-xs font-medium capitalize">{d.direction}</span>
            {d.time_horizon ? <span className="rounded-full border border-line px-2.5 py-1 text-xs font-medium">{d.time_horizon}</span> : null}
          </div>
          {d.bull_case.length ? <Section title="Bull case"><Bullets items={d.bull_case} /></Section> : null}
          {d.bear_case.length ? <Section title="Bear case"><Bullets items={d.bear_case} /></Section> : null}
          {d.catalysts.length ? <Section title="Catalysts"><Bullets items={d.catalysts} /></Section> : null}
          {d.key_metrics.length ? <Section title="Key metrics"><Table head={["Metric", "Value"]} rows={d.key_metrics.map((m) => [m.label, m.value])} /></Section> : null}
          {d.invalidation_triggers.length ? <Section title="What would make it wrong"><Bullets items={d.invalidation_triggers} /></Section> : null}
        </div>
      );
    }
    case "fitness_nutrition": {
      const d = structured.data;
      return (
        <div className="space-y-5">
          {d.exercises.length ? (
            <Section title="Workout">
              <Table head={["Exercise", "Sets", "Reps", "Rest", "Tempo"]} rows={d.exercises.map((e) => [e.notes ? `${e.name} (${e.notes})` : e.name, e.sets, e.reps, e.rest, e.tempo])} />
            </Section>
          ) : null}
          {d.macros ? (
            <Section title="Macros">
              <div className="grid grid-cols-4 gap-2">
                {([["Calories", d.macros.calories, ""], ["Protein", d.macros.protein_g, "g"], ["Carbs", d.macros.carbs_g, "g"], ["Fat", d.macros.fat_g, "g"]] as const).map(([label, value, unit]) => (
                  <div key={label} className="rounded-[var(--radius-inner)] border border-line px-3 py-2.5">
                    <p className="text-xs text-muted">{label}</p>
                    <p className="font-semibold text-ink tabular-nums">{value == null ? "—" : `${value}${unit}`}</p>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}
          {d.ingredients.length ? <Section title="Ingredients"><Bullets items={d.ingredients.map((i) => (i.quantity ? `${i.quantity} ${i.item}` : i.item))} /></Section> : null}
          {d.timing ? <Section title="Timing"><p>{d.timing}</p></Section> : null}
        </div>
      );
    }
    case "career_sales": {
      const d = structured.data;
      return (
        <div className="space-y-5">
          <Section title="How it works"><p className="leading-relaxed">{d.core_mechanism}</p></Section>
          {d.scripts.length ? (
            <Section title="Script">
              {d.scripts.map((s, i) => <blockquote key={i} className="rounded-[var(--radius-inner)] bg-wash px-4 py-3 text-[0.95rem] leading-relaxed text-ink">{s}</blockquote>)}
            </Section>
          ) : null}
          {d.rules.length ? <Section title="Rules"><Bullets items={d.rules} /></Section> : null}
          {d.before_after ? (
            <Section title="Before and after">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-[var(--radius-inner)] border border-line px-4 py-3"><p className="mb-1 text-xs text-muted">Before</p><p className="text-sm">{d.before_after.before}</p></div>
                <div className="rounded-[var(--radius-inner)] border border-line px-4 py-3"><p className="mb-1 text-xs text-muted">After</p><p className="text-sm text-ink">{d.before_after.after}</p></div>
              </div>
            </Section>
          ) : null}
        </div>
      );
    }
    default: {
      const d = structured.data;
      return (
        <div className="space-y-5">
          {d.key_ideas.length ? <Section title="Key ideas"><Bullets items={d.key_ideas} /></Section> : null}
          {d.quotes.length ? (
            <Section title="Worth quoting">
              {d.quotes.map((q, i) => <blockquote key={i} className="border-l-2 border-line-strong pl-3 italic">{q}</blockquote>)}
            </Section>
          ) : null}
        </div>
      );
    }
  }
}
