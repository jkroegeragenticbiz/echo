import { BriefcaseBusiness, Camera, CirclePlay, Clapperboard, Globe, PenLine } from "lucide-react-native";
import { Text, View } from "react-native";
import { PLATFORM_LABELS, type Platform } from "@echo/core";
import { colors, ICON_STROKE } from "@/lib/theme";

const ICONS = { linkedin: BriefcaseBusiness, instagram: Camera, tiktok: Clapperboard, youtube: CirclePlay, web: Globe, manual: PenLine } as const;

export function PlatformBadge({ platform, author }: { platform: Platform; author?: string | null }) {
  const Icon = platform === "x" ? null : ICONS[platform];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1, minWidth: 0 }}>
      {Icon ? <Icon size={14} color={colors.muted} strokeWidth={ICON_STROKE} /> : <Text style={{ fontSize: 13, fontWeight: "700", color: colors.muted }}>X</Text>}
      {platform !== "x" ? <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted }}>{PLATFORM_LABELS[platform]}</Text> : null}
      {author ? (
        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "500", color: colors.body, flexShrink: 1 }}>
          {platform !== "x" ? "· " : ""}
          {author}
        </Text>
      ) : null}
    </View>
  );
}
