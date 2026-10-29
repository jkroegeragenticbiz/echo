import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { colors, radius, shadow, type } from "@/lib/theme";

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({ label, selected, onPress, dashed }: { label: string; selected?: boolean; onPress?: () => void; dashed?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      style={({ pressed }) => [styles.pill, selected && styles.pillSelected, dashed && styles.pillDashed, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.pillText, selected && { color: "#fff" }, dashed && { color: colors.muted }]}>{label}</Text>
    </Pressable>
  );
}

type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  title: string;
  variant?: "primary" | "secondary" | "plain";
  busy?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, variant = "primary", busy, icon, style, disabled, ...rest }: ButtonProps) {
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      {...rest}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : variant === "secondary" ? styles.buttonSecondary : styles.buttonPlain,
        (disabled || busy) && { opacity: 0.45 },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={primary ? "#fff" : colors.ink} /> : icon}
      <Text style={[styles.buttonText, { color: primary ? "#fff" : colors.ink }]}>{title}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.field, props.multiline && styles.fieldMultiline, props.style]} />;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={type.eyebrow}>{children}</Text>;
}

/** The only place the teal accent appears: text written in the user's voice. */
export function InYourVoice({ voiceName, children }: { voiceName?: string; children: React.ReactNode }) {
  return (
    <View style={styles.voice}>
      <View style={styles.voiceBar} />
      <Text style={styles.voiceLabel}>
        IN YOUR VOICE{voiceName ? <Text style={styles.voiceName}>  · {voiceName}</Text> : null}
      </Text>
      {children}
    </View>
  );
}

export function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.card,
    padding: 20,
    ...shadow,
  },
  pill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillDashed: { borderStyle: "dashed", borderColor: colors.lineStrong },
  pillText: { fontSize: 15, fontWeight: "500", color: colors.body },
  button: {
    minHeight: 52,
    borderRadius: radius.pill,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonPrimary: { backgroundColor: colors.ink },
  buttonSecondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  buttonPlain: { backgroundColor: "transparent", minHeight: 44 },
  buttonText: { fontSize: 17, fontWeight: "600", letterSpacing: -0.2 },
  field: {
    backgroundColor: colors.card,
    borderRadius: radius.inner,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.ink,
  },
  fieldMultiline: { minHeight: 120, textAlignVertical: "top", paddingTop: 14 },
  voice: { backgroundColor: colors.wash, borderRadius: radius.inner, paddingVertical: 14, paddingLeft: 18, paddingRight: 14 },
  voiceBar: { position: "absolute", left: 0, top: 14, bottom: 14, width: 3, borderRadius: 2, backgroundColor: colors.accent },
  voiceLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.7, color: colors.accent, marginBottom: 6 },
  voiceName: { fontWeight: "500", letterSpacing: 0, color: colors.muted },
  metric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
    maxWidth: 200,
  },
  metricLabel: { fontSize: 12, color: colors.muted },
  metricValue: { fontSize: 12, fontWeight: "600", color: colors.ink, fontVariant: ["tabular-nums"], flexShrink: 1 },
});
