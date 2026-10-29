import { Text, View } from "react-native";
import type { Structured } from "@echo/core";
import { colors, radius, type } from "@/lib/theme";
import { Eyebrow } from "./ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Eyebrow>{title}</Eyebrow>
      {children}
    </View>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View style={{ gap: 6 }}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong, marginTop: 10 }} />
          <Text style={[type.callout, { flex: 1 }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.inner, overflow: "hidden" }}>
      {rows.map(([k, v], i) => (
        <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
          <Text style={[type.callout, { color: colors.ink, flex: 1 }]}>{k}</Text>
          <Text style={[type.callout, { fontVariant: ["tabular-nums"], textAlign: "right" }]}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

export function StructuredView({ structured }: { structured: Structured }) {
  switch (structured.domain) {
    case "markets_thesis": {
      const d = structured.data;
      return (
        <View style={{ gap: 18 }}>
          <Rows rows={[["Tickers", d.tickers.map((t) => `$${t}`).join(", ") || "—"], ["Direction", d.direction], ...(d.time_horizon ? [["Horizon", d.time_horizon] as [string, string]] : [])]} />
          {d.bull_case.length ? <Section title="Bull case"><Bullets items={d.bull_case} /></Section> : null}
          {d.bear_case.length ? <Section title="Bear case"><Bullets items={d.bear_case} /></Section> : null}
          {d.catalysts.length ? <Section title="Catalysts"><Bullets items={d.catalysts} /></Section> : null}
          {d.key_metrics.length ? <Section title="Key metrics"><Rows rows={d.key_metrics.map((m) => [m.label, m.value])} /></Section> : null}
          {d.invalidation_triggers.length ? <Section title="What would make it wrong"><Bullets items={d.invalidation_triggers} /></Section> : null}
        </View>
      );
    }
    case "fitness_nutrition": {
      const d = structured.data;
      const macros = d.macros;
      return (
        <View style={{ gap: 18 }}>
          {d.exercises.length ? (
            <Section title="Workout">
              <Rows
                rows={d.exercises.map((e) => [
                  e.name,
                  [e.sets != null && e.reps ? `${e.sets} × ${e.reps}` : e.reps, e.tempo && `tempo ${e.tempo}`, e.rest && `rest ${e.rest}`, e.notes].filter(Boolean).join(" · ") || "—",
                ])}
              />
            </Section>
          ) : null}
          {macros ? (
            <Section title="Macros">
              <Rows rows={[["Calories", macros.calories != null ? String(macros.calories) : "—"], ["Protein", macros.protein_g != null ? `${macros.protein_g}g` : "—"], ["Carbs", macros.carbs_g != null ? `${macros.carbs_g}g` : "—"], ["Fat", macros.fat_g != null ? `${macros.fat_g}g` : "—"]]} />
            </Section>
          ) : null}
          {d.ingredients.length ? <Section title="Ingredients"><Bullets items={d.ingredients.map((i) => (i.quantity ? `${i.quantity} ${i.item}` : i.item))} /></Section> : null}
          {d.timing ? <Section title="Timing"><Text style={type.callout}>{d.timing}</Text></Section> : null}
        </View>
      );
    }
    case "career_sales": {
      const d = structured.data;
      return (
        <View style={{ gap: 18 }}>
          <Section title="How it works"><Text style={type.callout}>{d.core_mechanism}</Text></Section>
          {d.scripts.map((s, i) => (
            <View key={i} style={{ backgroundColor: colors.wash, borderRadius: radius.inner, padding: 14 }}>
              <Text style={[type.callout, { color: colors.ink }]}>{s}</Text>
            </View>
          ))}
          {d.rules.length ? <Section title="Rules"><Bullets items={d.rules} /></Section> : null}
          {d.before_after ? (
            <Section title="Before and after">
              <Rows rows={[["Before", d.before_after.before], ["After", d.before_after.after]]} />
            </Section>
          ) : null}
        </View>
      );
    }
    default: {
      const d = structured.data;
      return (
        <View style={{ gap: 18 }}>
          {d.key_ideas.length ? <Section title="Key ideas"><Bullets items={d.key_ideas} /></Section> : null}
          {d.quotes.length ? <Section title="Worth quoting"><Bullets items={d.quotes.map((q) => `“${q}”`)} /></Section> : null}
        </View>
      );
    }
  }
}
