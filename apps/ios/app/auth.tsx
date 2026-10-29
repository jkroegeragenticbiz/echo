import { useEffect, useRef } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

/** Deep link from the magic-link email: echo://auth?email=…&token=… */
export default function AuthCallback() {
  const { email, token } = useLocalSearchParams<{ email?: string; token?: string }>();
  const { api, signIn } = useSession();
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    // The token is single-use; never verify it twice.
    if (started.current) return;
    started.current = true;
    if (!email || !token) {
      router.replace("/sign-in");
      return;
    }
    api
      .verifyMagicLink(email, token)
      .then((res) => signIn(res.token))
      .catch((err: Error) => {
        Alert.alert("Sign in failed", err.message);
        router.replace("/sign-in");
      });
  }, [api, email, token, signIn, router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }}>
      <ActivityIndicator color={colors.ink} />
    </View>
  );
}
