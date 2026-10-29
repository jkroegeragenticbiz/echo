import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Check, ChevronRight } from "lucide-react-native";
import { getPersona, type VoiceProfile } from "@echo/core";
import { Button, Card, Eyebrow, InYourVoice } from "@/components/ui";
import { useSession } from "@/lib/session";
import { colors, ICON_STROKE, radius, type } from "@/lib/theme";

const PERSPECTIVE_LABEL = { first_person: "Like my own notes", coach: "Like a coach", checklist: "Just the checklist" } as const;

function describe(v: VoiceProfile) {
  const personas = v.personas.map((id) => getPersona(id)?.label).filter(Boolean).join(", ");
  return personas || v.description || "No personas yet";
}

export default function VoiceScreen() {
  const router = useRouter();
  const { api, voices, activeVoice, isPlus, refresh } = useSession();

  async function activate(v: VoiceProfile) {
    try {
      await api.activateVoice(v.id);
      await refresh();
    } catch (err) {
      Alert.alert("Couldn't switch voice", (err as Error).message);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
        <Text style={type.largeTitle}>Voice</Text>
        {activeVoice ? (
          <Card style={{ gap: 14 }}>
            <Eyebrow>Active voice</Eyebrow>
            <Text style={type.title}>{activeVoice.name}</Text>
            <Text style={type.callout}>{describe(activeVoice)}</Text>
            <InYourVoice voiceName={activeVoice.name}>
              <Text style={[type.callout, { color: colors.ink }]}>
                {PERSPECTIVE_LABEL[activeVoice.perspective]}
                {activeVoice.tone.length ? ` · ${activeVoice.tone.join(", ")}` : ""}
                {activeVoice.voice_sample ? " · matches your writing sample" : ""}
              </Text>
            </InYourVoice>
            <Button title="Edit voice" variant="secondary" onPress={() => router.push({ pathname: "/voice-edit", params: { id: activeVoice.id } })} />
          </Card>
        ) : null}

        <View style={{ gap: 10 }}>
          <Eyebrow>Your voices</Eyebrow>
          {voices.map((v) => (
            <Pressable
              key={v.id}
              onPress={() => (v.is_active ? router.push({ pathname: "/voice-edit", params: { id: v.id } }) : activate(v))}
              onLongPress={() => router.push({ pathname: "/voice-edit", params: { id: v.id } })}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: colors.card, borderRadius: radius.inner, borderWidth: 1, borderColor: v.is_active ? colors.ink : colors.line }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[type.headline, { fontSize: 16 }]}>{v.name}</Text>
                <Text style={type.footnote} numberOfLines={1}>{describe(v)}</Text>
              </View>
              {v.is_active ? <Check size={18} color={colors.ink} strokeWidth={ICON_STROKE} /> : <ChevronRight size={18} color={colors.muted} strokeWidth={ICON_STROKE} />}
            </Pressable>
          ))}
          <Button
            title={isPlus ? "Add a voice" : "Add a voice with Echo Plus"}
            variant="secondary"
            onPress={() => router.push(isPlus ? { pathname: "/voice-edit", params: { id: "new" } } : "/paywall")}
          />
          {voices.length > 1 ? <Text style={type.footnote}>Tap a voice to make it active. Long-press to edit.</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
