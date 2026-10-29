import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import MobileAds from "react-native-google-mobile-ads";
import { usePendingShares } from "@/lib/pending-runner";
import { SessionProvider, useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    void MobileAds().initialize();
  }, []);
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </SessionProvider>
  );
}

function RootNavigator() {
  const { status, onboarded } = useSession();
  const ready = status === "signedIn" && onboarded;

  useEffect(() => {
    if (status !== "loading") void SplashScreen.hideAsync();
  }, [status]);

  usePendingShares(ready);

  if (status === "loading") return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Protected guard={status === "signedOut"}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="auth" />
      </Stack.Protected>
      <Stack.Protected guard={status === "signedIn" && !onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={ready}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="save/[id]"
          options={{
            presentation: "formSheet",
            sheetAllowedDetents: [0.65, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 28,
            contentStyle: { backgroundColor: colors.card },
          }}
        />
        <Stack.Screen name="unlock" options={{ presentation: "fullScreenModal", gestureEnabled: false }} />
        <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
        <Stack.Screen name="voice-edit" options={{ presentation: "modal" }} />
        <Stack.Screen name="x-connected" />
      </Stack.Protected>
    </Stack>
  );
}
