import { Check } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { PERSONAS, TONES, type Perspective, type Tone } from "@echo/core";
import { colors, ICON_STROKE, radius, type } from "@/lib/theme";
import { Field, Pill } from "./ui";

export interface VoiceDraft {
  personas: string[];
  description: string;
  perspective: Perspective;
  tone: Tone[];
  voiceSample: string;
}

export function PersonaPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  return (
    <View style={{ gap: 10 }}>
      {PERSONAS.map((p) => {
        const selected = value.includes(p.id);
        return (
          <Pressable
            key={p.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(selected ? value.filter((v) => v !== p.id) : [...value, p.id])}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              padding: 16,
              borderRadius: radius.inner,
              borderWidth: 1,
              borderColor: selected ? colors.ink : colors.line,
              backgroundColor: colors.card,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[type.headline, { fontSize: 16 }]}>{p.label}</Text>
              <Text style={type.footnote}>{p.blurb}</Text>
            </View>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: selected ? colors.ink : colors.lineStrong,
                backgroundColor: selected ? colors.ink : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {selected ? <Check size={14} color="#fff" strokeWidth={2.5} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const PERSPECTIVE_OPTIONS: { value: Perspective; label: string; example: string }[] = [
  { value: "first_person", label: "Like my own notes", example: "\"I'll open with their problem.\"" },
  { value: "coach", label: "Like a coach", example: "\"Open with their problem.\"" },
  { value: "checklist", label: "Just the checklist", example: "\"Opener: their problem first.\"" },
];

export function PerspectivePicker({ value, onChange }: { value: Perspective; onChange: (p: Perspective) => void }) {
  return (
    <View style={{ gap: 8 }}>
      {PERSPECTIVE_OPTIONS.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={{ padding: 14, borderRadius: radius.inner, borderWidth: 1, borderColor: selected ? colors.ink : colors.line, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[type.headline, { fontSize: 16 }]}>{o.label}</Text>
              <Text style={type.footnote}>{o.example}</Text>
            </View>
            {selected ? <Check size={18} color={colors.ink} strokeWidth={ICON_STROKE} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const TONE_LABELS: Record<Tone, string> = {
  direct: "Direct",
  warm: "Warm",
  analytical: "Analytical",
  playful: "Playful",
  calm: "Calm",
  motivating: "Motivating",
  skeptical: "Skeptical",
  concise: "Concise",
};

export function TonePicker({ value, onChange }: { value: Tone[]; onChange: (t: Tone[]) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {TONES.map((t) => {
        const selected = value.includes(t);
        return (
          <Pill
            key={t}
            label={TONE_LABELS[t]}
            selected={selected}
            onPress={() => onChange(selected ? value.filter((v) => v !== t) : value.length >= 3 ? [...value.slice(1), t] : [...value, t])}
          />
        );
      })}
    </View>
  );
}

export function VoiceSampleField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field
      multiline
      value={value}
      onChangeText={onChange}
      maxLength={2000}
      placeholder="Optional: paste a few sentences you wrote (a post, an email, a note) so Echo can match your voice."
    />
  );
}

export function draftToInput(draft: VoiceDraft, name: string) {
  return {
    name,
    personas: draft.personas.length ? draft.personas : ["custom"],
    description: draft.description.trim(),
    perspective: draft.perspective,
    tone: draft.tone,
    voice_sample: draft.voiceSample.trim() || null,
  };
}
