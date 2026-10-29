import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import { Mail } from "lucide-react-native";
import { LANDING_DEMO_SAVE } from "@echo/core";
import { Button, Card, Field, InYourVoice } from "@/components/ui";
import { useSession } from "@/lib/session";
import { colors, ICON_STROKE, radius, type } from "@/lib/theme";

export default function SignIn() {
  const { api, signIn } = useSession();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"apple" | "email" | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const preview = LANDING_DEMO_SAVE.rewrites.founder!;

  async function apple() {
    setBusy("apple");
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL, AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
      });
      if (!credential.identityToken) throw new Error("Apple didn't return a sign-in token.");
      const { token } = await api.signInWithApple(credential.identityToken);
      await signIn(token);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "ERR_REQUEST_CANCELED") Alert.alert("Sign in failed", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function magicLink() {
    setBusy("email");
    try {
      await api.requestMagicLink(email.trim());
      setSentTo(email.trim());
    } catch (err) {
      Alert.alert("Couldn't send the link", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, padding: 24, justifyContent: "space-between" }}>
        <View style={{ gap: 16, marginTop: 24 }}>
          <Text style={[type.largeTitle, { fontSize: 38, lineHeight: 44 }]}>Your saves,{"\n"}in your voice.</Text>
          <Text style={type.body}>Everything you save on LinkedIn, X, Instagram, TikTok and YouTube, in one library you&apos;ll actually use.</Text>
          <Card style={{ marginTop: 12, gap: 12 }}>
            <Text style={type.footnote}>A LinkedIn post, rewritten for a founder</Text>
            <Text style={type.headline}>{preview.headline}</Text>
            <InYourVoice voiceName="Founder">
              <Text numberOfLines={3} style={[type.callout, { color: colors.ink }]}>{preview.paraphrase}</Text>
            </InYourVoice>
          </Card>
        </View>

        <View style={{ gap: 12 }}>
          {sentTo ? (
            <View style={{ backgroundColor: colors.card, borderRadius: radius.inner, padding: 16, borderWidth: 1, borderColor: colors.line }}>
              <Text style={type.headline}>Check your email</Text>
              <Text style={type.callout}>Open the link we sent to {sentTo} on this iPhone.</Text>
            </View>
          ) : null}
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={26}
            style={{ height: 52, opacity: busy === "apple" ? 0.5 : 1 }}
            onPress={apple}
          />
          <Field value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
          <Button
            title="Email me a sign-in link"
            variant="secondary"
            busy={busy === "email"}
            disabled={!/^\S+@\S+\.\S+$/.test(email)}
            icon={<Mail size={18} color={colors.ink} strokeWidth={ICON_STROKE} />}
            onPress={magicLink}
          />
          <Text style={[type.footnote, { textAlign: "center" }]}>By continuing you agree to the Terms and Privacy Policy.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
