import { Lock } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { SaveDTO } from "@echo/core";
import { firstLine } from "@/lib/format";
import { colors, ICON_STROKE, type } from "@/lib/theme";
import { PlatformBadge } from "./platform";
import { Card, InYourVoice, MetricPill } from "./ui";

export function SaveCard({ save, voiceName, onPress }: { save: SaveDTO; voiceName: string; onPress: () => void }) {
  const headline = save.rewrite?.headline ?? save.summary ?? firstLine(save.verbatim_text);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={headline} style={({ pressed }) => pressed && { opacity: 0.85 }}>
      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <PlatformBadge platform={save.platform} author={save.author} />
          {save.key_metric ? <MetricPill label={save.key_metric.label} value={save.key_metric.value} /> : null}
        </View>
        <Text style={type.headline}>{headline}</Text>
        {save.status === "ready" && save.rewrite ? (
          <InYourVoice voiceName={voiceName}>
            <Text numberOfLines={4} style={[type.callout, { color: colors.ink }]}>{save.rewrite.paraphrase}</Text>
          </InYourVoice>
        ) : save.status === "processing" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator size="small" color={colors.muted} />
            <Text style={type.footnote}>Reading and rewriting…</Text>
          </View>
        ) : save.status === "failed" ? (
          <Text style={type.footnote}>We couldn&apos;t read this one. Open it to see the original.</Text>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Lock size={14} color={colors.muted} strokeWidth={ICON_STROKE} />
            <Text style={type.footnote}>Rewrite in your {voiceName} voice</Text>
          </View>
        )}
      </Card>
    </Pressable>
  );
}
