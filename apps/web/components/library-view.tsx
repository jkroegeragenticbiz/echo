"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, LoaderCircle, Plus, Search, Smartphone } from "lucide-react";
import { DOMAIN_LABELS, DOMAINS, type CreateSaveResponse, type Domain, type Plan, type SaveDTO, type VoiceProfile } from "@echo/core";
import { appStoreUrl } from "@/lib/links";
import { SaveCard } from "./save-card";
import { SaveSheet } from "./save-sheet";

interface Props {
  initialSaves: SaveDTO[];
  voices: VoiceProfile[];
  initialVoiceId: string;
  plan: Plan;
  usage: { used: number; limit: number | null };
}

export function LibraryView({ initialSaves, voices, initialVoiceId, plan, usage: initialUsage }: Props) {
  const [saves, setSaves] = useState(initialSaves);
  const [voiceId, setVoiceId] = useState(initialVoiceId);
  const [domain, setDomain] = useState<Domain | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialSaves.length >= 30);
  const [openId, setOpenId] = useState<string | null>(null);
  const [usage, setUsage] = useState(initialUsage);
  const firstRender = useRef(true);

  const voice = voices.find((v) => v.id === voiceId) ?? voices[0];
  const voiceName = voice?.name ?? "your";

  const load = useCallback(
    async (opts: { append?: boolean } = {}) => {
      setLoading(true);
      const params = new URLSearchParams({ voice: voiceId, limit: "30" });
      if (domain) params.set("domain", domain);
      if (query.trim()) params.set("q", query.trim());
      if (opts.append && saves.length) params.set("before", saves[saves.length - 1]!.created_at);
      const res = await fetch(`/api/saves?${params}`);
      setLoading(false);
      if (!res.ok) return;
      const data = (await res.json()) as { saves: SaveDTO[] };
      setSaves((prev) => (opts.append ? [...prev, ...data.saves] : data.saves));
      setHasMore(data.saves.length >= 30);
    },
    [voiceId, domain, query, saves],
  );

  // Refetch when the voice or filter changes, and (debounced) when the search changes.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => void load(), query ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceId, domain, query]);

  // Poll saves that are still being read or rewritten.
  const processing = saves.filter((s) => s.status === "processing").map((s) => s.id);
  useEffect(() => {
    if (processing.length === 0) return;
    const t = setInterval(async () => {
      for (const id of processing) {
        const res = await fetch(`/api/saves/${id}?voice=${voiceId}`);
        if (res.ok) {
          const { save } = (await res.json()) as { save: SaveDTO };
          if (save.status !== "processing") setSaves((prev) => prev.map((s) => (s.id === id ? save : s)));
        }
      }
    }, 3000);
    return () => clearInterval(t);
  }, [processing.join(","), voiceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const domainsPresent = useMemo(() => DOMAINS.filter((d) => initialSaves.some((s) => s.domain === d) || saves.some((s) => s.domain === d)), [initialSaves, saves]);
  const open = saves.find((s) => s.id === openId) ?? null;

  return (
    <div className="pt-6">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[2.5rem] leading-none font-bold tracking-tight sm:text-5xl">Library</h1>
          <p className="mt-3 text-sm text-muted">
            {usage.limit === null ? "Echo Plus · unlimited saves" : `${usage.used} of ${usage.limit} free saves used this month`}
          </p>
        </div>
        <AddSave
          onSaved={(res) => {
            setUsage(res.usage);
            setSaves((prev) => [res.save, ...prev.filter((s) => s.id !== res.save.id)]);
            if (res.duplicate) setOpenId(res.save.id);
          }}
        />
      </div>

      <div className="space-y-4">
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="group" aria-label="Voice">
          {voices.map((v) => (
            <button key={v.id} type="button" aria-pressed={v.id === voiceId} onClick={() => setVoiceId(v.id)} className="pill">
              {v.name}
            </button>
          ))}
          {plan === "free" ? (
            <a href={appStoreUrl()} className="pill !border-dashed text-muted" title="Multiple voices are part of Echo Plus">
              <Plus size={14} strokeWidth={1.75} /> Add a voice
            </a>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="-mx-1 flex flex-1 gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="group" aria-label="Filter by topic">
            <button type="button" aria-pressed={domain === null} onClick={() => setDomain(null)} className="pill">All</button>
            {domainsPresent.map((d) => (
              <button key={d} type="button" aria-pressed={domain === d} onClick={() => setDomain(domain === d ? null : d)} className="pill">
                {DOMAIN_LABELS[d]}
              </button>
            ))}
          </div>
          <label className="relative block sm:w-72">
            <span className="sr-only">Search your library</span>
            <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Search" className="field !py-2.5 !pl-10" />
          </label>
        </div>
      </div>

      <div className="mt-8">
        {saves.length === 0 && !loading ? (
          <EmptyState filtered={Boolean(domain || query)} />
        ) : (
          <div className="columns-1 gap-5 md:columns-2 xl:columns-3">
            {saves.map((s) => (
              <div key={s.id} className="mb-5 break-inside-avoid">
                <SaveCard save={s} voiceName={voiceName} onOpen={() => setOpenId(s.id)} />
              </div>
            ))}
          </div>
        )}
        {loading ? <LoaderCircle className="mx-auto mt-6 animate-spin text-muted" size={22} /> : null}
        {hasMore && !loading && saves.length > 0 ? (
          <div className="mt-6 text-center">
            <button type="button" className="btn btn-secondary" onClick={() => void load({ append: true })}>Show more</button>
          </div>
        ) : null}
      </div>

      {open ? (
        <SaveSheet
          key={`${open.id}-${voiceId}`}
          save={open}
          voiceId={voiceId}
          voiceName={voiceName}
          plan={plan}
          onClose={() => setOpenId(null)}
          onChanged={(save) => setSaves((prev) => prev.map((s) => (s.id === save.id ? save : s)))}
          onDeleted={(id) => {
            setOpenId(null);
            setSaves((prev) => prev.filter((s) => s.id !== id));
          }}
          onOpenRelated={(id) => {
            if (saves.some((s) => s.id === id)) setOpenId(id);
            else
              void fetch(`/api/saves/${id}?voice=${voiceId}`)
                .then((r) => r.json())
                .then(({ save }: { save: SaveDTO }) => {
                  setSaves((prev) => [...prev, save]);
                  setOpenId(id);
                });
          }}
        />
      ) : null}
    </div>
  );
}

function AddSave({ onSaved }: { onSaved: (res: CreateSaveResponse) => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = value.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    const isUrl = /^https?:\/\/\S+$/.test(text);
    const res = await fetch("/api/saves", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(isUrl ? { url: text } : { text }),
    });
    setBusy(false);
    const data = (await res.json()) as CreateSaveResponse & { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Couldn't save that.");
      return;
    }
    setValue("");
    onSaved(data);
  }

  return (
    <form onSubmit={submit} className="w-full sm:max-w-md">
      <div className="flex gap-2">
        <label htmlFor="add-save" className="sr-only">Paste a link or text to save</label>
        <input id="add-save" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Paste a link or post text" className="field !py-2.5" />
        <button type="submit" className="btn btn-primary shrink-0 !px-4 !py-2.5" disabled={busy} aria-label="Save">
          {busy ? <LoaderCircle size={17} className="animate-spin" /> : <ArrowRight size={17} strokeWidth={1.75} />}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-700" role="alert">{error}</p> : null}
    </form>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  if (filtered) return <p className="py-16 text-center text-muted">Nothing matches that yet.</p>;
  return (
    <div className="card mx-auto max-w-lg p-10 text-center">
      <h2 className="text-xl font-semibold">Your library is empty</h2>
      <p className="mt-2 leading-relaxed">Share a post to Echo from any app on your iPhone, or paste a link above. It will show up here, rewritten in your voice.</p>
      <a href={appStoreUrl()} className="btn btn-secondary mt-6"><Smartphone size={17} strokeWidth={1.75} /> Get the iOS app</a>
    </div>
  );
}
