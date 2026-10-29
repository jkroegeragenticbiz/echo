import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useSession } from "@/lib/session";

/** Landing route for echo://x-connected when X OAuth finishes outside the auth session. */
export default function XConnected() {
  const { refresh } = useSession();
  const router = useRouter();
  useEffect(() => {
    void refresh().finally(() => router.replace("/plus"));
  }, [refresh, router]);
  return null;
}
