import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, type } from "@/lib/theme";

/** Shared chrome for onboarding steps: progress dots, title, scrolling body, pinned footer. */
export function OnboardingFrame({ step, title, subtitle, children, footer }: { step: 1 | 2 | 3; title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={["top", "bottom"]}>
      <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 24, paddingTop: 12 }} accessibilityLabel={`Step ${step} of 3`}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: n <= step ? colors.ink : colors.line }} />
        ))}
      </View>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 8 }}>
          <Text style={[type.largeTitle, { fontSize: 30 }]}>{title}</Text>
          <Text style={type.body}>{subtitle}</Text>
        </View>
        {children}
      </ScrollView>
      <View style={{ paddingHorizontal: 24, paddingBottom: 8, paddingTop: 8, gap: 8 }}>{footer}</View>
    </SafeAreaView>
  );
}
