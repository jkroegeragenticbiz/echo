import { useState } from "react";
import { Alert, KeyboardAvoidingView, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Camera, Clipboard as ClipboardIcon, Share, Video } from "lucide-react-native";
import type { CreateSaveInput, CreateSaveResponse } from "@echo/core";
import { Button, Card, Field } from "@/components/ui";
import { EchoShared } from "@/modules/echo-shared";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors, ICON_STROKE, type } from "@/lib/theme";
import { uploadFile } from "@/lib/upload";

export default function SaveScreen() {
  const router = useRouter();
  const { api, getToken, activeVoice, refresh } = useSession();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState<"text" | "image" | "video" | null>(null);

  async function submit(input: CreateSaveInput, kind: "text" | "image" | "video") {
    setBusy(kind);
    try {
      const res: CreateSaveResponse = await api.createSave(input);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setValue("");
      void refresh();
      if (res.unlock) {
        router.push({ pathname: "/unlock", params: { saveId: res.save.id, adUnlockId: res.unlock.ad_unlock_id, adUnitId: res.unlock.ad_unit_id, voiceName: activeVoice?.name ?? "" } });
      } else {
        router.push({ pathname: "/save/[id]", params: { id: res.save.id, voice: activeVoice?.id ?? "" } });
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "quota_exceeded") {
        Alert.alert("You're out of free saves", err.message, [
          { text: "Not now", style: "cancel" },
          { text: "See Echo Plus", onPress: () => router.push("/paywall") },
        ]);
      } else {
        Alert.alert("Couldn't save that", (err as Error).message);
      }
    } finally {
      setBusy(null);
    }
  }

  function saveText() {
    const text = value.trim();
    if (!text) return;
    const isUrl = /^https?:\/\/\S+$/i.test(text);
    void submit(isUrl ? { url: text } : { text }, "text");
  }

  async function paste() {
    const text = await Clipboard.getStringAsync();
    if (text) setValue(text);
  }

  async function pick(kind: "image" | "video") {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === "image" ? ["images"] : ["videos"],
      allowsMultipleSelection: kind === "image",
      selectionLimit: kind === "image" ? 4 : 1,
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;
    const token = getToken();
    if (!token) return;
    setBusy(kind);
    try {
      if (kind === "image") {
        // Text is read on device with Apple Vision; the image is kept as the source.
        const texts = await Promise.all(result.assets.map((a) => EchoShared.recognizeText(a.uri).catch(() => "")));
        const urls = await Promise.all(result.assets.map((a) => uploadFile(a.uri, { contentType: a.mimeType ?? "image/jpeg", token, folder: "images" })));
        await submit(
          { media: urls.map((url) => ({ url, kind: "image" as const })), ocr_text: texts.filter(Boolean).join("\n\n") || undefined },
          "image",
        );
      } else {
        const asset = result.assets[0]!;
        const url = await uploadFile(asset.uri, { contentType: asset.mimeType ?? "video/quicktime", token, folder: "videos" });
        await submit({ media: [{ url, kind: "video", content_type: asset.mimeType ?? undefined }] }, "video");
      }
    } catch (err) {
      Alert.alert("Upload failed", (err as Error).message);
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={["top"]}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }} keyboardShouldPersistTaps="handled">
          <Text style={type.largeTitle}>Save</Text>
          <Card style={{ gap: 12 }}>
            <Field multiline value={value} onChangeText={setValue} placeholder="Paste a link or the post's text" autoCapitalize="none" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button title="Paste" variant="secondary" icon={<ClipboardIcon size={18} color={colors.ink} strokeWidth={ICON_STROKE} />} onPress={paste} style={{ flex: 1 }} />
              <Button title="Save" busy={busy === "text"} disabled={!value.trim() || busy !== null} onPress={saveText} style={{ flex: 1 }} />
            </View>
          </Card>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <Button title="Screenshot" variant="secondary" busy={busy === "image"} disabled={busy !== null} icon={<Camera size={18} color={colors.ink} strokeWidth={ICON_STROKE} />} onPress={() => pick("image")} style={{ flex: 1 }} />
            <Button title="Video" variant="secondary" busy={busy === "video"} disabled={busy !== null} icon={<Video size={18} color={colors.ink} strokeWidth={ICON_STROKE} />} onPress={() => pick("video")} style={{ flex: 1 }} />
          </View>

          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Share size={18} color={colors.ink} strokeWidth={ICON_STROKE} />
              <Text style={type.headline}>Faster: save from any app</Text>
            </View>
            <Text style={type.callout}>
              Tap Share on a post in LinkedIn, X, Instagram, TikTok or YouTube and choose Echo. It&apos;s rewritten as {activeVoice?.name ?? "you"} and lands here.
            </Text>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
