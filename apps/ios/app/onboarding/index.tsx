import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { OnboardingFrame } from "@/components/onboarding-frame";
import { Button, Field } from "@/components/ui";
import { PersonaPicker } from "@/components/voice-editor";
import { type } from "@/lib/theme";
import { useDraft } from "./_layout";

export default function PickPersonas() {
  const router = useRouter();
  const { draft, setDraft } = useDraft();
  const canContinue = draft.personas.length > 0 || draft.description.trim().length > 2;

  return (
    <OnboardingFrame
      step={1}
      title="Who are you saving for?"
      subtitle="Pick any that fit. Most people are more than one thing."
      footer={<Button title="Continue" disabled={!canContinue} onPress={() => router.push("/onboarding/voice")} />}
    >
      <PersonaPicker value={draft.personas} onChange={(personas) => setDraft({ personas })} />
      <View style={{ gap: 8 }}>
        <Text style={type.headline}>Or describe yourself</Text>
        <Field
          value={draft.description}
          onChangeText={(description) => setDraft({ description })}
          placeholder="ER nurse who lifts and invests on the side"
          maxLength={500}
        />
      </View>
    </OnboardingFrame>
  );
}
