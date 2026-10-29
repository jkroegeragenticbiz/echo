import { useEffect, useRef } from "react";
import { Alert, AppState } from "react-native";
import { useRouter } from "expo-router";
import { EchoShared } from "@/modules/echo-shared";
import { parsePending } from "./pending";
import { useSession } from "./session";
import { uploadFile } from "./upload";

/**
 * Drains work the Share Extension queued in the App Group: uploads shared
 * videos and opens the rewarded-ad screen for free saves. Runs whenever the
 * app becomes active.
 */
export function usePendingShares(enabled: boolean) {
  const router = useRouter();
  const { api, getToken } = useSession();
  const running = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    async function run() {
      if (running.current) return;
      running.current = true;
      try {
        const { items, discard } = parsePending(EchoShared.readPending());
        if (discard.length) EchoShared.removePending(discard);
        for (const item of items) {
          if (item.kind === "video") {
            const uri = EchoShared.pendingFileUri(item.fileName);
            const token = getToken();
            if (!uri || !token) {
              EchoShared.removePending([item.id]);
              continue;
            }
            const contentType = item.fileName.endsWith(".mp4") ? "video/mp4" : "video/quicktime";
            const url = await uploadFile(uri, { contentType, token, folder: "videos" });
            const res = await api.createSave({
              media: [{ url, kind: "video", content_type: contentType }],
              url: item.sourceUrl || undefined,
              text: item.text || undefined,
            });
            EchoShared.removePending([item.id]);
            if (res.unlock) {
              router.push({
                pathname: "/unlock",
                params: { saveId: res.save.id, adUnlockId: res.unlock.ad_unlock_id, adUnitId: res.unlock.ad_unit_id },
              });
              return;
            }
          } else {
            EchoShared.removePending([item.id]);
            router.push({
              pathname: "/unlock",
              params: { saveId: item.saveId, adUnlockId: item.adUnlockId, adUnitId: item.adUnitId, voiceName: item.voiceName },
            });
            return; // one ad at a time; the rest run next time the app is active
          }
        }
      } catch (err) {
        Alert.alert("Couldn't finish a shared save", (err as Error).message);
      } finally {
        running.current = false;
      }
    }

    void run();
    const sub = AppState.addEventListener("change", (state) => state === "active" && void run());
    return () => sub.remove();
  }, [enabled, api, getToken, router]);
}
