import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import Purchases, { type PurchasesPackage } from "react-native-purchases";
import { Check, X } from "lucide-react-native";
import { PLUS_PRICING } from "@echo/core";
import { Button } from "@/components/ui";
import { LINKS } from "@/lib/config";
import { hasPlus, purchasesEnabled } from "@/lib/purchases";
import { useSession } from "@/lib/session";
import { colors, ICON_STROKE, radius, type } from "@/lib/theme";

const PERKS = [
  ["No ads", "Rewrites appear instantly, every time."],
  ["Unlimited saves", "No monthly cap."],
  ["Multiple voices", "Founder at work, coach at the gym."],
  ["Automatic X sync", "New bookmarks land on their own."],
] as const;

type PlanKey = "annual" | "monthly";

export default function Paywall() {
  const router = useRouter();
  const { refresh } = useSession();
  const [packages, setPackages] = useState<Partial<Record<PlanKey, PurchasesPackage>>>({});
  const [selected, setSelected] = useState<PlanKey>("annual");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"buy" | "restore" | null>(null);

  useEffect(() => {
    if (!purchasesEnabled()) {
      setLoading(false);
      return;
    }
    Purchases.getOfferings()
      .then((o) => setPackages({ annual: o.current?.annual ?? undefined, monthly: o.current?.monthly ?? undefined }))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function finish() {
    // The RevenueCat webhook updates the server; refresh until it reflects Plus.
    for (let i = 0; i < 5; i++) {
      await refresh();
      await new Promise((r) => setTimeout(r, 800));
    }
    router.back();
  }

  async function buy() {
    const pkg = packages[selected];
    if (!pkg) return;
    setBusy("buy");
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      if (hasPlus(customerInfo)) await finish();
    } catch (err) {
      if (!(err as { userCancelled?: boolean }).userCancelled) Alert.alert("Purchase failed", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy("restore");
    try {
      const info = await Purchases.restorePurchases();
      if (hasPlus(info)) await finish();
      else Alert.alert("No purchases found", "We couldn't find an Echo Plus subscription for this Apple ID.");
    } catch (err) {
      Alert.alert("Restore failed", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const priceOf = (key: PlanKey) => packages[key]?.product.priceString ?? PLUS_PRICING[key].price;
  const monthlyPrice = packages.monthly?.product.price;
  const annualPrice = packages.annual?.product.price;
  const savings = monthlyPrice && annualPrice ? Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100) : 37;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Pressable onPress={() => router.back()} accessibilityLabel="Close" style={{ position: "absolute", top: 16, right: 16, zIndex: 2, padding: 8, borderRadius: 20, backgroundColor: colors.card }}>
        <X size={20} color={colors.ink} strokeWidth={ICON_STROKE} />
      </Pressable>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 56, gap: 24 }}>
        <View style={{ gap: 8 }}>
          <Text style={[type.largeTitle, { fontSize: 32 }]}>Echo Plus</Text>
          <Text style={type.body}>Every save, rewritten the moment you share it.</Text>
        </View>

        <View style={{ gap: 14 }}>
          {PERKS.map(([title, body]) => (
            <View key={title} style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                <Check size={15} color="#fff" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.headline, { fontSize: 16 }]}>{title}</Text>
                <Text style={type.callout}>{body}</Text>
              </View>
            </View>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.muted} />
        ) : (
          <View style={{ gap: 10 }} accessibilityRole="radiogroup">
            {(["annual", "monthly"] as const).map((key) => {
              const isSelected = selected === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setSelected(key)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 18, borderRadius: radius.inner, borderWidth: isSelected ? 2 : 1, borderColor: isSelected ? colors.ink : colors.line, backgroundColor: colors.card }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[type.headline, { fontSize: 16 }]}>{key === "annual" ? "Yearly" : "Monthly"}</Text>
                    <Text style={type.footnote}>{key === "annual" ? `${priceOf("annual")} a year · save ${savings}%` : `${priceOf("monthly")} a month`}</Text>
                  </View>
                  {key === "annual" ? (
                    <View style={{ backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>Best value</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ gap: 6 }}>
          <Button title="Continue" busy={busy === "buy"} disabled={!packages[selected] || busy !== null} onPress={buy} />
          {!loading && !packages[selected] ? <Text style={[type.footnote, { textAlign: "center" }]}>Subscriptions aren&apos;t available right now. Try again later.</Text> : null}
          <Button title="Restore purchases" variant="plain" busy={busy === "restore"} disabled={busy !== null || !purchasesEnabled()} onPress={restore} />
        </View>

        <Text style={[type.footnote, { textAlign: "center" }]}>
          Renews automatically until cancelled. Cancel any time in Settings at least 24 hours before renewal. Payment is charged to your Apple ID.
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 20 }}>
          <Text style={[type.footnote, { textDecorationLine: "underline" }]} onPress={() => WebBrowser.openBrowserAsync(LINKS.terms)}>Terms</Text>
          <Text style={[type.footnote, { textDecorationLine: "underline" }]} onPress={() => WebBrowser.openBrowserAsync(LINKS.privacy)}>Privacy</Text>
        </View>
      </ScrollView>
    </View>
  );
}
