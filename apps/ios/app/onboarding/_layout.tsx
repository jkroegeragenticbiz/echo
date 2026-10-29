import { createContext, useContext, useState } from "react";
import { Stack } from "expo-router";
import type { VoiceDraft } from "@/components/voice-editor";
import { colors } from "@/lib/theme";

const DraftContext = createContext<{ draft: VoiceDraft; setDraft: (update: Partial<VoiceDraft>) => void } | null>(null);

export function useDraft() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error("useDraft must be used in onboarding");
  return ctx;
}

/** Three quick steps: who you are, how Echo should sound, how saves get in. */
export default function OnboardingLayout() {
  const [draft, setDraftState] = useState<VoiceDraft>({ personas: [], description: "", perspective: "first_person", tone: [], voiceSample: "" });
  return (
    <DraftContext.Provider value={{ draft, setDraft: (update) => setDraftState((d) => ({ ...d, ...update })) }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />
    </DraftContext.Provider>
  );
}
