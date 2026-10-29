import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import Purchases from "react-native-purchases";
import { Check, ChevronRight } from "lucide-react-native";
import { Button, Card, Eyebrow } from "@/components/ui";
import { LINKS } from "@/lib/config";
import { hasPlus, purchasesEnabled } from "@/lib/purchases";
import { useSession } from "@/lib/session";
import { colors, ICON_STROKE, radius, type } from "@/lib/theme";

const PERKS = ["Unlimited saves", "No ads, instant rewrites", "Multiple voices", "Automatic X bookmark sync"];

function Row({ label, detail, onPress, destructive }: { label: string; detail?: string; onPress: () => void; destructive?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16, opacity: pressed ? 0.6 : 1 })}>
      <Text style={[type.body, { flex: 1, color: destructive ? colors.danger : colors.ink }]}>{label}</Text>
      {detail ? <Text style={type.footnote}>{detail}</Text> : null}
      {!destructive ? <ChevronRight size={18} color={colors.muted} strokeWidth={ICON_STROKE} /> : null}
    </Pressable>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: colors.card, borderRadius: radius.inner, borderWidth: 1, borderColor: colors.line, overflow: "hidden" }}>{children}</View>;
}

const Divider = () => <View style={{ height: 1, backgroundColor: colors.line, marginLeft: 16 }} />;

export default function PlusScreen() {
  const router = useRouter();
  const { api, me, isPlus, refresh, signOut } = useSession();
  const [busy, setBusy] = useState<string | null>(null);

  async function connectX() {
    setBusy("x");
    try {
      const { url } = await api.xConnectUrl("echo://x-connected");
      await WebBrowser.openAuthSessionAsync(url, "echo://x-connected");
      await refresh();
    } catch (err) {
      Alert.alert("Couldn't connect X", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function syncX() {
    setBusy("sync");
    try {
      const r = await api.xSync();
      Alert.alert("X bookmarks", r.reason === "quota_exceeded" ? "You've used this month's free saves." : r.imported ? `Imported ${r.imported} new bookmark${r.imported === 1 ? "" : "s"}.` : "No new bookmarks.");
      await refresh();
    } catch (err) {
      Alert.alert("Sync failed", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function disconnectX() {
    Alert.alert("Disconnect X?", "Saves you already imported stay in your library.", [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: async () => { await api.xDisconnect(); await refresh(); } },
    ]);
  }

  async function restore() {
    if (!purchasesEnabled()) return;
    setBusy("restore");
    try {
      const info = await Purchases.restorePurchases();
      Alert.alert(hasPlus(info) ? "Echo Plus restored" : "No purchases found", hasPlus(info) ? "Thanks for being a member." : "We couldn't find an Echo Plus subscription for this Apple ID.");
      await refresh();
    } catch (err) {
      Alert.alert("Restore failed", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function deleteAccount() {
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your saves, rewrites, voices, connected accounts and uploads. If you have Echo Plus, also cancel it in Settings > Apple ID > Subscriptions.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteAccount();
              await signOut();
            } catch (err) {
              Alert.alert("Couldn't delete your account", (err as Error).message);
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 40 }}>
        <Text style={type.largeTitle}>Plus</Text>

        <Card style={{ gap: 14 }}>
          <Text style={type.title}>{isPlus ? "You're on Echo Plus" : "Echo Plus"}</Text>
          <View style={{ gap: 10 }}>
            {PERKS.map((p) => (
              <View key={p} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Check size={17} color={colors.ink} strokeWidth={2} />
                <Text style={[type.body, { color: colors.ink }]}>{p}</Text>
              </View>
            ))}
          </View>
          {isPlus ? (
            <Button title="Manage subscription" variant="secondary" onPress={() => Linking.openURL(LINKS.manageSubscription)} />
          ) : (
            <>
              <Button title="Go ad-free" onPress={() => router.push("/paywall")} />
              {me?.usage.limit != null ? <Text style={[type.footnote, { textAlign: "center" }]}>{me.usage.used} of {me.usage.limit} free saves used this month</Text> : null}
            </>
          )}
        </Card>

        <View style={{ gap: 8 }}>
          <Eyebrow>Connected accounts</Eyebrow>
          <Group>
            {me?.x.connected ? (
              <>
                <Row label={`X · @${me.x.username ?? "connected"}`} detail={busy === "sync" ? "Syncing…" : "Sync now"} onPress={syncX} />
                <Divider />
                <Row label="Disconnect X" onPress={disconnectX} />
              </>
            ) : (
              <Row label="Connect X bookmarks" detail={busy === "x" ? "Opening…" : undefined} onPress={connectX} />
            )}
          </Group>
          <Text style={type.footnote}>{isPlus ? "New bookmarks sync automatically every hour." : "Automatic sync is part of Echo Plus. Import manually any time."}</Text>
        </View>

        <View style={{ gap: 8 }}>
          <Eyebrow>Settings</Eyebrow>
          <Group>
            <Row label="Restore purchases" detail={busy === "restore" ? "Restoring…" : undefined} onPress={restore} />
            <Divider />
            <Row label="Privacy policy" onPress={() => WebBrowser.openBrowserAsync(LINKS.privacy)} />
            <Divider />
            <Row label="Terms of service" onPress={() => WebBrowser.openBrowserAsync(LINKS.terms)} />
            <Divider />
            <Row label="How Echo uses your data" onPress={() => WebBrowser.openBrowserAsync(LINKS.data)} />
          </Group>
          <Group>
            <Row label={`Sign out${me?.email ? ` (${me.email})` : ""}`} onPress={signOut} />
            <Divider />
            <Row label="Delete account" destructive onPress={deleteAccount} />
          </Group>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
