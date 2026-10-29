import { useState } from "react";
import { Alert, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Check, Share } from "lucide-react-native";
import { PERSONAS } from "@echo/core";
import { OnboardingFrame } from "@/components/onboarding-frame";
import { Button, Card } from "@/components/ui";
import { draftToInput } from "@/components/voice-editor";
import { voiceNameFor } from "@/lib/format";
import { useSession } from "@/lib/session";
import { colors, ICON_STROKE, type } from "@/lib/theme";
import { useDraft } from "./_layout";

export default function Connect() {
  const { api, refresh, me } = useSession();
  const { draft } = useDraft();
  const [xConnected, setXConnected] = useState(me?.x.connected ?? false);
  const [busy, setBusy] = useState<"x" | "finish" | null>(null);

  async function connectX() {
    setBusy("x");
    try {
      const { url } = await api.xConnectUrl("echo://x-connected");
      const result = await WebBrowser.openAuthSessionAsync(url, "echo://x-connected");
      if (result.type === "success" && result.url.includes("x=connected")) setXConnected(true);
    } catch (err) {
      Alert.alert("Couldn't connect X", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function finish() {
    setBusy("finish");
    try {
      const firstPersona = PERSONAS.find((p) => draft.personas.includes(p.id));
      const tone = draft.tone.length ? draft.tone : firstPersona ? [...firstPersona.defaultTone] : [];
      await api.upsertActiveVoice(draftToInput({ ...draft, tone }, voiceNameFor(draft.personas, draft.description)));
      await refresh(); // flips `onboarded`, which routes into the app
    } catch (err) {
      Alert.alert("Couldn't save your voice", (err as Error).message);
      setBusy(null);
    }
  }

  return (
    <OnboardingFrame
      step={3}
      title="Bring your saves in"
      subtitle="Connect X to sync bookmarks, and turn on Echo in the Share sheet for everything else."
      footer={<Button title="Start using Echo" busy={busy === "finish"} onPress={finish} />}
    >
      <Card style={{ gap: 12 }}>
        <Text style={type.headline}>X bookmarks</Text>
        <Text style={type.callout}>Read-only access through X&apos;s official sign-in. Echo never posts for you.</Text>
        {xConnected ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Check size={18} color={colors.ink} strokeWidth={ICON_STROKE} />
            <Text style={[type.callout, { color: colors.ink }]}>X connected</Text>
          </View>
        ) : (
          <Button title="Connect X" variant="secondary" busy={busy === "x"} onPress={connectX} />
        )}
      </Card>

      <Card style={{ gap: 14 }}>
        <Text style={type.headline}>Save from any app</Text>
        {[
          "In Instagram, LinkedIn, TikTok or YouTube, tap Share on a post.",
          "Scroll the app row to the end and tap More.",
          "Turn on Echo and drag it near the front.",
        ].map((step, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.ink }}>{i + 1}</Text>
            </View>
            <Text style={[type.callout, { flex: 1 }]}>{step}</Text>
          </View>
        ))}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Share size={16} color={colors.muted} strokeWidth={ICON_STROKE} />
          <Text style={type.footnote}>Screenshots and screen recordings work too.</Text>
        </View>
      </Card>
    </OnboardingFrame>
  );
}
