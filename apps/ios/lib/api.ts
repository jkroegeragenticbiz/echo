import type {
  CreateSaveInput,
  CreateSaveResponse,
  Domain,
  MeDTO,
  RelatedSaveDTO,
  SaveDTO,
  VoiceProfile,
  VoiceProfileInput,
} from "@echo/core";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type Me = MeDTO & { x: { connected: boolean; username: string | null; last_synced_at: string | null } };

type Fetch = typeof fetch;

/** Typed client for the Echo API. Pure TypeScript so it can be unit tested. */
export function createApi(baseUrl: string, getToken: () => string | null, fetchImpl: Fetch = fetch) {
  async function request<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
    const headers: Record<string, string> = { accept: "application/json" };
    const token = getToken();
    if (init.auth !== false && token) headers.authorization = `Bearer ${token}`;
    if (init.body !== undefined) headers["content-type"] = "application/json";
    const res = await fetchImpl(`${baseUrl}${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await res.text();
    const data = text ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) {
      const err = (data ?? {}) as { error?: string; code?: string };
      throw new ApiError(res.status, err.error ?? `Request failed (${res.status})`, err.code);
    }
    return data as T;
  }

  return {
    signInWithApple: (identityToken: string) =>
      request<{ token: string; user_id: string }>("/api/auth/mobile/apple", { body: { identity_token: identityToken }, auth: false }),
    requestMagicLink: (email: string) => request<{ sent: boolean }>("/api/auth/mobile/email", { body: { email }, auth: false }),
    verifyMagicLink: (email: string, token: string) =>
      request<{ token: string; user_id: string }>("/api/auth/mobile/verify", { body: { email, token }, auth: false }),

    me: () => request<Me>("/api/me"),
    deleteAccount: () => request<{ deleted: boolean }>("/api/me", { method: "DELETE" }),

    listSaves: (params: { voice?: string; domain?: Domain | null; q?: string; before?: string | null }) => {
      const qs = new URLSearchParams();
      if (params.voice) qs.set("voice", params.voice);
      if (params.domain) qs.set("domain", params.domain);
      if (params.q?.trim()) qs.set("q", params.q.trim());
      if (params.before) qs.set("before", params.before);
      return request<{ saves: SaveDTO[]; voice_profile_id: string; next_before: string | null }>(`/api/saves?${qs}`);
    },
    getSave: (id: string, voice?: string) => request<{ save: SaveDTO }>(`/api/saves/${id}${voice ? `?voice=${voice}` : ""}`),
    createSave: (input: CreateSaveInput) => request<CreateSaveResponse>("/api/saves", { body: input }),
    deleteSave: (id: string) => request<{ deleted: boolean }>(`/api/saves/${id}`, { method: "DELETE" }),
    requestRewrite: (id: string, voiceId?: string) =>
      request<{ save: SaveDTO; unlock?: { ad_unlock_id: string; ad_unit_id: string } }>(`/api/saves/${id}/rewrite`, {
        body: { voice_profile_id: voiceId },
      }),
    related: (id: string) => request<{ related: RelatedSaveDTO[] }>(`/api/saves/${id}/related`),

    voices: () => request<{ voices: VoiceProfile[] }>("/api/voices"),
    upsertActiveVoice: (input: VoiceProfileInput) => request<{ voice: VoiceProfile }>("/api/voices", { method: "PUT", body: input }),
    createVoice: (input: VoiceProfileInput) => request<{ voice: VoiceProfile }>("/api/voices", { body: input }),
    updateVoice: (id: string, input: Partial<VoiceProfileInput>) => request<{ voice: VoiceProfile }>(`/api/voices/${id}`, { method: "PATCH", body: input }),
    deleteVoice: (id: string) => request<{ deleted: boolean }>(`/api/voices/${id}`, { method: "DELETE" }),
    activateVoice: (id: string) => request<{ active: string }>(`/api/voices/${id}/activate`, { body: {} }),

    xConnectUrl: (returnTo = "echo://x-connected") => request<{ url: string }>("/api/x/connect", { body: { return_to: returnTo } }),
    xSync: () => request<{ imported: number; reason: string | null }>("/api/x/sync", { body: {} }),
    xDisconnect: () => request<{ disconnected: boolean }>("/api/x/sync", { method: "DELETE" }),
  };
}

export type Api = ReturnType<typeof createApi>;

/** Polls a save until `done` returns true or the timeout passes. */
export async function pollSave(
  api: Pick<Api, "getSave">,
  id: string,
  voice: string | undefined,
  done: (save: SaveDTO) => boolean,
  opts: { intervalMs?: number; timeoutMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<SaveDTO | null> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const deadline = Date.now() + (opts.timeoutMs ?? 60_000);
  let attempt = 0;
  while (Date.now() < deadline) {
    const { save } = await api.getSave(id, voice);
    if (done(save)) return save;
    attempt++;
    await sleep(opts.intervalMs ?? Math.min(1500 + attempt * 250, 4000));
  }
  return null;
}
