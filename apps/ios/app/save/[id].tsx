import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ArrowUpRight, Check, Trash } from "lucide-react-native";
import { DOMAIN_LABELS, type RelatedSaveDTO, type SaveDTO } from "@echo/core";
import { PlatformBadge } from "@/components/platform";
import { StructuredView } from "@/components/structured-view";
import { Button, Eyebrow, InYourVoice, MetricPill } from "@/components/ui";
import { firstLine } from "@/lib/format";
import { useSession } from "@/lib/session";
import { colors, ICON_STROKE, radius, type } from "@/lib/theme";

export default function SaveDetail() {
  const { id, voice: voiceParam } = useLocalSearchParams<{ id: string; voice?: string }>();
  const router = useRouter();
  const { api, voices, activeVoice, isPlus } = useSession();
  const voice = voices.find((v) => v.id === voiceParam) ?? activeVoice;
  const [save, setSave] = useState<SaveDTO | null>(null);
  const [related, setRelated] = useState<RelatedSaveDTO[]>([]);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await api.getSave(id, voice?.id);
    setSave(res.save);
    return res.save;
  }, [api, id, voice?.id]);

  useEffect(() => {
    load().catch((err: Error) => Alert.alert("Couldn't open this save", err.message));
    api.related(id).then((r) => setRelated(r.related)).catch(() => undefined);
  }, [api, id, load]);

  // Keep refreshing while it's still processing.
  useEffect(() => {
    if (save?.status !== "processing") return;
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [save?.status, load]);

  async function rewrite() {
    if (!save || !voice) return;
    setBusy(true);
    try {
      const res = await api.requestRewrite(save.id, voice.id);
      if (res.unlock) {
        router.push({ pathname: "/unlock", params: { saveId: save.id, adUnlockId: res.unlock.ad_unlock_id, adUnitId: res.unlock.ad_unit_id, voiceName: voice.name } });
        return;
      }
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        if ((await load()).rewrite) return;
      }
    } catch (err) {
      Alert.alert("Couldn't rewrite", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    Alert.alert("Delete this save?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await api.deleteSave(id);
          router.back();
        },
      },
    ]);
  }

  if (!save) {
    return <ActivityIndicator style={{ marginTop: 60 }} color={colors.muted} />;
  }

  const rw = save.rewrite;
  return (
    <ScrollView style={{ backgroundColor: colors.card }} contentContainerStyle={{ padding: 22, paddingTop: 28, gap: 22, paddingBottom: 48 }}>
      <View style={{ gap: 10 }}>
        <PlatformBadge platform={save.platform} author={save.author} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Eyebrow>{DOMAIN_LABELS[save.domain]}</Eyebrow>
          {save.key_metric ? <MetricPill label={save.key_metric.label} value={save.key_metric.value} /> : null}
        </View>
        <Text style={[type.title, { fontSize: 24, lineHeight: 30 }]}>{rw?.headline ?? save.summary ?? firstLine(save.verbatim_text)}</Text>
      </View>

      {rw ? (
        <>
          <InYourVoice voiceName={voice?.name}>
            <Text style={[type.body, { color: colors.ink }]}>{rw.paraphrase}</Text>
          </InYourVoice>
          <View style={{ gap: 10 }}>
            <Eyebrow>Do this next</Eyebrow>
            {rw.action_steps.map((step, i) => {
              const checked = done.has(i);
              return (
                <Pressable
                  key={i}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setDone((prev) => {
                      const next = new Set(prev);
                      if (checked) next.delete(i);
                      else next.add(i);
                      return next;
                    });
                  }}
                  style={{ flexDirection: "row", gap: 12, padding: 14, borderRadius: radius.inner, borderWidth: 1, borderColor: colors.line }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: checked ? colors.ink : colors.lineStrong, backgroundColor: checked ? colors.ink : "transparent", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                    {checked ? <Check size={13} color="#fff" strokeWidth={2.5} /> : null}
                  </View>
                  <Text style={[type.callout, { flex: 1, color: checked ? colors.muted : colors.ink, textDecorationLine: checked ? "line-through" : "none" }]}>{step}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : save.status === "processing" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <ActivityIndicator color={colors.muted} />
          <Text style={type.callout}>Reading the post and rewriting it in your voice…</Text>
        </View>
      ) : (
        <Button title={isPlus ? `Rewrite in your ${voice?.name ?? ""} voice` : "Watch a short ad to rewrite"} busy={busy} onPress={rewrite} />
      )}

      {save.structured ? (
        <View style={{ gap: 12 }}>
          <Eyebrow>The details</Eyebrow>
          <StructuredView structured={save.structured} />
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Eyebrow>Original, word for word</Eyebrow>
          {save.source_url ? (
            <Pressable onPress={() => Linking.openURL(save.source_url!)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }} accessibilityRole="link">
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.ink }}>View original</Text>
              <ArrowUpRight size={15} color={colors.ink} strokeWidth={ICON_STROKE} />
            </Pressable>
          ) : null}
        </View>
        <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.inner, padding: 14 }}>
          <Text selectable style={type.callout}>{save.verbatim_text || "No text was captured for this save."}</Text>
        </View>
      </View>

      {related.length ? (
        <View style={{ gap: 10 }}>
          <Eyebrow>Related in your library</Eyebrow>
          <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.inner }}>
            {related.map((r, i) => (
              <Pressable
                key={r.id}
                onPress={() => router.push({ pathname: "/save/[id]", params: { id: r.id, voice: voice?.id ?? "" } })}
                style={{ padding: 14, gap: 4, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}
              >
                <Text style={[type.callout, { color: colors.ink, fontWeight: "500" }]} numberOfLines={2}>{r.headline ?? "Saved post"}</Text>
                <PlatformBadge platform={r.platform} author={r.author} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <Pressable onPress={remove} style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }} accessibilityRole="button">
        <Trash size={15} color={colors.muted} strokeWidth={ICON_STROKE} />
        <Text style={type.footnote}>Delete save</Text>
      </Pressable>
    </ScrollView>
  );
}
