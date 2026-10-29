import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Perspective, Tone } from "@echo/core";
import { Button, Field } from "@/components/ui";
import { draftToInput, PersonaPicker, PerspectivePicker, TonePicker, VoiceSampleField, type VoiceDraft } from "@/components/voice-editor";
import { voiceNameFor } from "@/lib/format";
import { useSession } from "@/lib/session";
import { colors, type } from "@/lib/theme";

export default function VoiceEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { api, voices, refresh } = useSession();
  const existing = voices.find((v) => v.id === id);
  const [name, setName] = useState(existing?.name ?? "");
  const [draft, setDraft] = useState<VoiceDraft>({
    personas: existing?.personas ?? [],
    description: existing?.description ?? "",
    perspective: (existing?.perspective ?? "first_person") as Perspective,
    tone: (existing?.tone ?? []) as Tone[],
    voiceSample: existing?.voice_sample ?? "",
  });
  const [busy, setBusy] = useState(false);
  const update = (patch: Partial<VoiceDraft>) => setDraft((d) => ({ ...d, ...patch }));

  async function save() {
    setBusy(true);
    try {
      const input = draftToInput(draft, name.trim() || voiceNameFor(draft.personas, draft.description));
      if (existing) await api.updateVoice(existing.id, input);
      else await api.createVoice(input);
      await refresh();
      router.back();
    } catch (err) {
      Alert.alert("Couldn't save voice", (err as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return;
    Alert.alert("Delete this voice?", "Rewrites made in this voice are deleted too.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteVoice(existing.id);
            await refresh();
            router.back();
          } catch (err) {
            Alert.alert("Couldn't delete voice", (err as Error).message);
          }
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={[type.title, { marginTop: 8 }]}>{existing ? "Edit voice" : "New voice"}</Text>
        <View style={{ gap: 8 }}>
          <Text style={type.headline}>Name</Text>
          <Field value={name} onChangeText={setName} placeholder={voiceNameFor(draft.personas, draft.description)} maxLength={60} />
        </View>
        <View style={{ gap: 8 }}>
          <Text style={type.headline}>Personas</Text>
          <PersonaPicker value={draft.personas} onChange={(personas) => update({ personas })} />
          <Field value={draft.description} onChangeText={(description) => update({ description })} placeholder="Describe yourself in your own words" maxLength={500} />
        </View>
        <View style={{ gap: 8 }}>
          <Text style={type.headline}>Perspective</Text>
          <PerspectivePicker value={draft.perspective} onChange={(perspective) => update({ perspective })} />
        </View>
        <View style={{ gap: 8 }}>
          <Text style={type.headline}>Tone</Text>
          <TonePicker value={draft.tone} onChange={(tone) => update({ tone })} />
        </View>
        <View style={{ gap: 8 }}>
          <Text style={type.headline}>Writing sample</Text>
          <VoiceSampleField value={draft.voiceSample} onChange={(voiceSample) => update({ voiceSample })} />
        </View>
        <Button title="Save voice" busy={busy} disabled={draft.personas.length === 0 && !draft.description.trim()} onPress={save} />
        {existing && voices.length > 1 ? <Button title="Delete voice" variant="plain" onPress={remove} /> : null}
      </ScrollView>
    </View>
  );
}
