import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Purchases, { type CustomerInfo } from "react-native-purchases";
import type { VoiceProfile } from "@echo/core";
import { EchoShared } from "@/modules/echo-shared";
import { ApiError, createApi, type Api, type Me } from "./api";
import { API_URL } from "./config";
import { hasPlus, identifyPurchaser, purchasesEnabled, resetPurchaser } from "./purchases";

type Status = "loading" | "signedOut" | "signedIn";

interface Session {
  status: Status;
  api: Api;
  me: Me | null;
  voices: VoiceProfile[];
  activeVoice: VoiceProfile | null;
  /** Plus per the server, or optimistically per RevenueCat right after a purchase. */
  isPlus: boolean;
  onboarded: boolean;
  /** Current bearer token, for direct Blob uploads. */
  getToken(): string | null;
  signIn(token: string): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const tokenRef = useRef<string | null>(null);
  const api = useMemo(() => createApi(API_URL, () => tokenRef.current), []);
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  const clear = useCallback(async () => {
    tokenRef.current = null;
    await EchoShared.setAuthToken(null);
    await resetPurchaser();
    setMe(null);
    setVoices([]);
    setCustomerInfo(null);
    setStatus("signedOut");
  }, []);

  const load = useCallback(async () => {
    try {
      const [meRes, voicesRes] = await Promise.all([api.me(), api.voices()]);
      setMe(meRes);
      setVoices(voicesRes.voices);
      setStatus("signedIn");
      await identifyPurchaser(meRes.id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) await clear();
      else setStatus(tokenRef.current ? "signedIn" : "signedOut");
    }
  }, [api, clear]);

  // Restore the session from the shared keychain on launch.
  useEffect(() => {
    void (async () => {
      tokenRef.current = await EchoShared.getAuthToken().catch(() => null);
      if (tokenRef.current) await load();
      else setStatus("signedOut");
    })();
  }, [load]);

  // Keep the local Plus flag in sync with RevenueCat.
  useEffect(() => {
    if (status !== "signedIn" || !purchasesEnabled()) return;
    const listener = (info: CustomerInfo) => setCustomerInfo(info);
    Purchases.addCustomerInfoUpdateListener(listener);
    void Purchases.getCustomerInfo().then(setCustomerInfo).catch(() => undefined);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [status]);

  const activeVoice = voices.find((v) => v.is_active) ?? voices[0] ?? null;
  const isPlus = me?.plan === "plus" || hasPlus(customerInfo);

  // Tell the Share Extension where to post and how to label the sheet.
  useEffect(() => {
    if (status === "signedIn") EchoShared.setContext(API_URL, activeVoice?.name ?? "your", isPlus ? "plus" : "free");
  }, [status, activeVoice?.name, isPlus]);

  const value: Session = {
    status,
    api,
    me,
    voices,
    activeVoice,
    isPlus,
    onboarded: voices.some((v) => v.personas.length > 0 || v.description.trim().length > 0),
    getToken: () => tokenRef.current,
    async signIn(token) {
      tokenRef.current = token;
      await EchoShared.setAuthToken(token);
      await load();
    },
    signOut: clear,
    refresh: load,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
