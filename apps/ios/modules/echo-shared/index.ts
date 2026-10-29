import { requireOptionalNativeModule } from "expo-modules-core";

export interface EchoSharedNative {
  setAuthToken(token: string | null): Promise<void>;
  getAuthToken(): Promise<string | null>;
  setContext(apiUrl: string, voiceName: string, plan: string): void;
  readPending(): string;
  removePending(ids: string[]): void;
  pendingFileUri(fileName: string): string | null;
  recognizeText(uri: string): Promise<string>;
}

/**
 * In-memory stand-in for environments without the native module (Expo Go,
 * web previews). The real app always links the Swift module.
 */
function memoryFallback(): EchoSharedNative {
  let token: string | null = null;
  return {
    async setAuthToken(t) {
      token = t;
    },
    async getAuthToken() {
      return token;
    },
    setContext() {},
    readPending: () => "[]",
    removePending() {},
    pendingFileUri: () => null,
    async recognizeText() {
      return "";
    },
  };
}

export const EchoShared: EchoSharedNative = requireOptionalNativeModule<EchoSharedNative>("EchoShared") ?? memoryFallback();
