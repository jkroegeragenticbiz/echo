import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { AdEventType, RewardedAd, RewardedAdEventType } from "react-native-google-mobile-ads";
import { Sparkles } from "lucide-react-native";
import { ProgressRing } from "@/components/progress-ring";
import { Button, Card } from "@/components/ui";
import { pollSave } from "@/lib/api";
import { rewardedUnitId } from "@/lib/config";
import { useSession } from "@/lib/session";
import { colors, ICON_STROKE, type } from "@/lib/theme";

type Phase = "countdown" | "playing" | "rewriting" | "slow" | "skipped" | "unavailable";

const COUNTDOWN_MS = 3000;
const LOAD_TIMEOUT_MS = 15_000;
const EXPECTED_REWRITE_MS = 15_000;

export default function UnlockScreen() {
  const params = useLocalSearchParams<{ saveId: string; adUnlockId: string; adUnitId?: string; voiceName?: string }>();
  const router = useRouter();
  const { api, me, activeVoice } = useSession();
  const voiceName = params.voiceName || activeVoice?.name || "your";
  const [phase, setPhase] = useState<Phase>("countdown");
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const earned = useRef(false);

  // One ad per attempt. The SSV options let AdMob tell our server which unlock this reward is for.
  const ad = useMemo(
    () =>
      RewardedAd.createForAdRequest(rewardedUnitId(params.adUnitId), {
        requestNonPersonalizedAdsOnly: true,
        serverSideVerificationOptions: { userId: me?.id, customData: params.adUnlockId },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.adUnitId, params.adUnlockId, me?.id, attempt],
  );

  useEffect(() => {
    earned.current = false;
    setLoaded(false);
    const subs = [
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => setLoaded(true)),
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned.current = true;
      }),
      ad.addAdEventListener(AdEventType.CLOSED, () => setPhase(earned.current ? "rewriting" : "skipped")),
      ad.addAdEventListener(AdEventType.ERROR, () => setPhase((p) => (p === "countdown" || p === "playing" ? "unavailable" : p))),
    ];
    ad.load();
    return () => subs.forEach((unsubscribe) => unsubscribe());
  }, [ad]);

  // Countdown ring, then show the ad as soon as it's loaded.
  useEffect(() => {
    if (phase !== "countdown") return;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(1, elapsed / COUNTDOWN_MS));
      if (elapsed >= COUNTDOWN_MS && loaded) {
        clearInterval(timer);
        setPhase("playing");
        ad.show().catch(() => setPhase("unavailable"));
      } else if (elapsed >= LOAD_TIMEOUT_MS) {
        clearInterval(timer);
        setPhase("unavailable");
      }
    }, 50);
    return () => clearInterval(timer);
  }, [phase, loaded, ad]);

  // After the reward, the server verifies it and rewrites; wait for the result.
  useEffect(() => {
    if (phase !== "rewriting") return;
    let cancelled = false;
    const start = Date.now();
    const ring = setInterval(() => setProgress(Math.min(0.92, (Date.now() - start) / EXPECTED_REWRITE_MS)), 100);
    void (async () => {
      const ready = (s: { rewrite: unknown }) => Boolean(s.rewrite);
      let save = await pollSave(api, params.saveId, activeVoice?.id, ready, { timeoutMs: 45_000 }).catch(() => null);
      if (!save && !cancelled) {
        // Nudge the server in case the reward landed while the save was still processing.
        await api.requestRewrite(params.saveId, activeVoice?.id).catch(() => undefined);
        save = await pollSave(api, params.saveId, activeVoice?.id, ready, { timeoutMs: 45_000 }).catch(() => null);
      }
      if (cancelled) return;
      clearInterval(ring);
      if (save) {
        setProgress(1);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace({ pathname: "/save/[id]", params: { id: params.saveId, voice: activeVoice?.id ?? "" } });
      } else {
        setPhase("slow");
      }
    })();
    return () => {
      cancelled = true;
      clearInterval(ring);
    };
  }, [phase, api, params.saveId, activeVoice?.id, router]);

  const secondsLeft = Math.max(1, Math.ceil((COUNTDOWN_MS * (1 - progress)) / 1000));
  const copy: Record<Phase, { title: string; body: string }> = {
    countdown: { title: "Your rewrite is one short ad away", body: "Watch a short video and Echo rewrites this save for free." },
    playing: { title: "Enjoy the ad", body: "Your rewrite starts right after." },
    rewriting: { title: `Rewriting in your ${voiceName} voice…`, body: "Pulling out the steps that matter to you." },
    slow: { title: "Almost there", body: "This one is taking longer than usual. It'll be in your library in a moment." },
    skipped: { title: "No rewrite this time", body: "The save is in your library. Watch the whole ad to unlock the rewrite." },
    unavailable: { title: "No ad available right now", body: "Try again in a minute. Your save is safe in your library." },
  };

  const retry = () => {
    setProgress(0);
    setPhase("countdown");
    setAttempt((n) => n + 1);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas, padding: 24, justifyContent: "space-between" }}>
      <View />
      <Card style={{ alignItems: "center", gap: 22, paddingVertical: 36 }}>
        <View style={{ width: 120, height: 120, alignItems: "center", justifyContent: "center" }}>
          <ProgressRing progress={phase === "countdown" || phase === "rewriting" ? progress : phase === "slow" ? 0.92 : 0}>
            <View style={{ position: "absolute", alignItems: "center", justifyContent: "center", width: 120, height: 120 }}>
              {phase === "countdown" ? (
                <Text style={{ fontSize: 36, fontWeight: "600", color: colors.ink, fontVariant: ["tabular-nums"] }}>{secondsLeft}</Text>
              ) : (
                <Sparkles size={30} color={colors.ink} strokeWidth={ICON_STROKE} />
              )}
            </View>
          </ProgressRing>
        </View>
        <View style={{ gap: 8, alignItems: "center" }}>
          <Text style={[type.title, { textAlign: "center" }]}>{copy[phase].title}</Text>
          <Text style={[type.callout, { textAlign: "center" }]}>{copy[phase].body}</Text>
        </View>
        {phase === "skipped" || phase === "unavailable" ? <Button title="Try again" onPress={retry} style={{ alignSelf: "stretch" }} /> : null}
        {phase === "slow" ? <Button title="Back to library" onPress={() => router.replace("/")} style={{ alignSelf: "stretch" }} /> : null}
      </Card>

      <View style={{ gap: 6 }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 10 }}>
          <Text style={type.headline}>Go ad-free</Text>
          <Text style={type.callout}>Echo Plus rewrites every save instantly, with no ads and no monthly limit.</Text>
          <Button title="See Echo Plus" variant="secondary" onPress={() => router.push("/paywall")} disabled={phase === "playing"} />
        </View>
        {phase !== "playing" && phase !== "rewriting" ? <Button title="Not now" variant="plain" onPress={() => router.back()} /> : null}
      </View>
    </SafeAreaView>
  );
}
