import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import { DOMAIN_LABELS, DOMAINS, type Domain, type SaveDTO } from "@echo/core";
import { SaveCard } from "@/components/save-card";
import { Button, Card, Pill } from "@/components/ui";
import { useSession } from "@/lib/session";
import { colors, ICON_STROKE, radius, type } from "@/lib/theme";

export default function LibraryScreen() {
  const router = useRouter();
  const { api, voices, activeVoice, isPlus, me } = useSession();
  const [voiceId, setVoiceId] = useState<string | undefined>(activeVoice?.id);
  const [domain, setDomain] = useState<Domain | null>(null);
  const [query, setQuery] = useState("");
  const [saves, setSaves] = useState<SaveDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const voice = voices.find((v) => v.id === voiceId) ?? activeVoice;

  const load = useCallback(async () => {
    try {
      const res = await api.listSaves({ voice: voiceId, domain, q: query });
      setSaves(res.saves);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api, voiceId, domain, query]);

  // Loads on focus (returning from a save, the ad screen or the Save tab) and
  // whenever the voice, filter or search changes; typing is debounced.
  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => void load(), query ? 250 : 0);
      return () => clearTimeout(t);
    }, [load, query]),
  );

  // Poll while anything is still being read or rewritten.
  const processing = saves.some((s) => s.status === "processing");
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [processing, load]);

  const domains = useMemo(() => DOMAINS.filter((d) => d !== "other" || saves.some((s) => s.domain === "other")), [saves]);

  const header = (
    <View style={{ gap: 16, paddingBottom: 8 }}>
      <View style={{ gap: 4 }}>
        <Text style={type.largeTitle}>Library</Text>
        {me?.usage.limit != null ? (
          <Text style={type.footnote}>
            {me.usage.used} of {me.usage.limit} free saves this month
          </Text>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {voices.map((v) => (
          <Pill key={v.id} label={v.name} selected={v.id === voice?.id} onPress={() => setVoiceId(v.id)} />
        ))}
        {!isPlus ? <Pill label="+ Voice" dashed onPress={() => router.push("/paywall")} /> : null}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Pill label="All" selected={domain === null} onPress={() => setDomain(null)} />
        {domains.map((d) => (
          <Pill key={d} label={DOMAIN_LABELS[d]} selected={domain === d} onPress={() => setDomain(domain === d ? null : d)} />
        ))}
      </ScrollView>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14 }}>
        <Search size={17} color={colors.muted} strokeWidth={ICON_STROKE} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search your saves"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          clearButtonMode="while-editing"
          style={{ flex: 1, paddingVertical: 11, fontSize: 16, color: colors.ink }}
        />
      </View>
      {error ? <Text style={[type.footnote, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={["top"]}>
      <FlatList
        data={saves}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 14 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.muted} />}
        renderItem={({ item }) => (
          <SaveCard
            save={item}
            voiceName={voice?.name ?? "your"}
            onPress={() => router.push({ pathname: "/save/[id]", params: { id: item.id, voice: voice?.id ?? "" } })}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.muted} />
          ) : domain || query ? (
            <Text style={[type.callout, { textAlign: "center", marginTop: 40 }]}>Nothing matches that yet.</Text>
          ) : (
            <Card style={{ gap: 10, marginTop: 8 }}>
              <Text style={type.headline}>Your library is empty</Text>
              <Text style={type.callout}>Tap Share on any post and pick Echo, or paste a link in the Save tab.</Text>
              <Button title="Save something" variant="secondary" onPress={() => router.push("/save")} />
            </Card>
          )
        }
      />
    </SafeAreaView>
  );
}
