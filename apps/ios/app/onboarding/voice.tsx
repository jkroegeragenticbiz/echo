import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LANDING_DEMO_SAVE, PERSONAS, type PersonaId } from "@echo/core";
import { OnboardingFrame } from "@/components/onboarding-frame";
import { Button, Card, InYourVoice } from "@/components/ui";
import { PerspectivePicker, TonePicker, VoiceSampleField } from "@/components/voice-editor";
import { colors, type } from "@/lib/theme";
import { useDraft } from "./_layout";

export default function PickVoice() {
  const router = useRouter();
  const { draft, setDraft } = useDraft();
  const personaId = (draft.personas.find((p) => PERSONAS.some((x) => x.id === p)) ?? "founder") as PersonaId;
  const sample = LANDING_DEMO_SAVE.rewrites[personaId] ?? LANDING_DEMO_SAVE.rewrites.founder!;
  const persona = PERSONAS.find((p) => p.id === personaId)!;

  return (
    <OnboardingFrame
      step={2}
      title="How should Echo sound?"
      subtitle="Every save gets rewritten this way. You can change it any time."
      footer={
        <>
          <Button title="Continue" onPress={() => router.push("/onboarding/connect")} />
          <Button title="Back" variant="plain" onPress={() => router.back()} />
        </>
      }
    >
      <PerspectivePicker value={draft.perspective} onChange={(perspective) => setDraft({ perspective })} />
      <View style={{ gap: 10 }}>
        <Text style={type.headline}>Tone (pick up to 3)</Text>
        <TonePicker value={draft.tone.length ? draft.tone : [...persona.defaultTone]} onChange={(tone) => setDraft({ tone })} />
      </View>
      <View style={{ gap: 10 }}>
        <Text style={type.headline}>Sound like you</Text>
        <VoiceSampleField value={draft.voiceSample} onChange={(voiceSample) => setDraft({ voiceSample })} />
      </View>
      <Card style={{ gap: 10 }}>
        <Text style={type.footnote}>Preview for a {persona.label}</Text>
        <Text style={type.headline}>{sample.headline}</Text>
        <InYourVoice voiceName={persona.shortLabel}>
          <Text style={[type.callout, { color: colors.ink }]} numberOfLines={4}>{sample.paraphrase}</Text>
        </InYourVoice>
      </Card>
    </OnboardingFrame>
  );
}
