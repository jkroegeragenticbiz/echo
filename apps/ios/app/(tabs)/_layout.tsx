import { Tabs } from "expo-router";
import { AudioLines, Library, Plus, Sparkles } from "lucide-react-native";
import { colors, ICON_STROKE } from "@/lib/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.canvas, borderTopColor: colors.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Library", tabBarIcon: ({ color }) => <Library size={24} color={color} strokeWidth={ICON_STROKE} /> }} />
      <Tabs.Screen name="save" options={{ title: "Save", tabBarIcon: ({ color }) => <Plus size={24} color={color} strokeWidth={ICON_STROKE} /> }} />
      <Tabs.Screen name="voice" options={{ title: "Voice", tabBarIcon: ({ color }) => <AudioLines size={24} color={color} strokeWidth={ICON_STROKE} /> }} />
      <Tabs.Screen name="plus" options={{ title: "Plus", tabBarIcon: ({ color }) => <Sparkles size={24} color={color} strokeWidth={ICON_STROKE} /> }} />
    </Tabs>
  );
}
