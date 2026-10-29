"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, LoaderCircle, Smartphone, Sparkles, Trash, X } from "lucide-react";
import { DOMAIN_LABELS, type Plan, type RelatedSaveDTO, type SaveDTO } from "@echo/core";
import { appStoreUrl } from "@/lib/links";
import { InYourVoice } from "./in-your-voice";
import { MetricPill } from "./metric-pill";
import { PlatformBadge } from "./platform-badge";
import { StructuredView } from "./structured-view";

interface Props {
  save: SaveDTO;
  voiceId: string;
  voiceName: string;
  plan: Plan;
  onClose: () => void;
  onChanged: (save: SaveDTO) => void;
  onDeleted: (id: string) => void;
  onOpenRelated: (id: string) => void;
}

export function SaveSheet({ save, voiceId, voiceName, plan, onClose, onChanged, onDeleted, onOpenRelated }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [related, setRelated] = useState<RelatedSaveDTO[]>([]);
  const [busy, setBusy] = useState<"rewrite" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/saves/${save.id}/related`)
      .then((r) => (r.ok ? r.json() : { related: [] }))
      .then((d: { related: RelatedSaveDTO[] }) => !cancelled && setRelated(d.related))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [save.id]);

  async function rewrite() {
    setBusy("rewrite");
    setError(null);
    try {
      const res = await fetch(`/api/saves/${save.id}/rewrite`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voice_profile_id: voiceId }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Rewrite failed");
      // The rewrite runs in the background; poll briefly for it.
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const poll = (await (await fetch(`/api/saves/${save.id}?voice=${voiceId}`)).json()) as { save: SaveDTO };
        if (poll.save.rewrite) {
          onChanged(poll.save);
          return;
        }
      }
      throw new Error("This is taking longer than usual. Check back in a minute.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm("Delete this save? This can't be undone.")) return;
    setBusy("delete");
    const res = await fetch(`/api/saves/${save.id}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) onDeleted(save.id);
    else setError("Couldn't delete this save.");
  }

  const rw = save.rewrite;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/25 backdrop-blur-[2px] [animation:fade-in_200ms_ease-out]" />
      <div className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-line bg-card shadow-[var(--shadow-lift)] [animation:sheet-up_260ms_cubic-bezier(.2,.8,.2,1)] sm:rounded-[28px]">
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3 px-6 pt-4 pb-2 sm:pt-6">
          <PlatformBadge platform={save.platform} author={save.author} />
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-wash hover:text-ink" aria-label="Close">
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>

        <div className="space-y-7 overflow-y-auto px-6 pt-2 pb-8">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow">{DOMAIN_LABELS[save.domain]}</span>
              {save.key_metric ? <MetricPill metric={save.key_metric} /> : null}
            </div>
            <h2 id="sheet-title" className="text-2xl leading-tight font-semibold">
              {rw?.headline ?? save.summary ?? "Saved post"}
            </h2>
          </div>

          {rw ? (
            <>
              <InYourVoice voiceName={voiceName}>
                <p className="text-[1rem] leading-relaxed text-ink/90">{rw.paraphrase}</p>
              </InYourVoice>
              <section className="space-y-3">
                <h3 className="eyebrow">Do this next</h3>
                <ol className="space-y-2">
                  {rw.action_steps.map((step, i) => {
                    const checked = done.has(i);
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => setDone((prev) => { const next = new Set(prev); if (checked) next.delete(i); else next.add(i); return next; })}
                          className="flex w-full items-start gap-3 rounded-[var(--radius-inner)] border border-line px-4 py-3 text-left hover:border-line-strong"
                          aria-pressed={checked}
                        >
                          <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${checked ? "border-ink bg-ink text-white" : "border-line-strong"}`}>
                            {checked ? <Check size={12} strokeWidth={2.5} /> : null}
                          </span>
                          <span className={`text-[0.95rem] leading-relaxed ${checked ? "text-muted line-through" : "text-ink"}`}>{step}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </>
          ) : save.status === "processing" ? (
            <p className="flex items-center gap-2 text-sm"><LoaderCircle size={16} className="animate-spin" strokeWidth={1.75} /> Reading the post and rewriting it in your voice…</p>
          ) : plan === "plus" ? (
            <button type="button" onClick={rewrite} disabled={busy !== null} className="btn btn-primary w-full sm:w-auto">
              {busy === "rewrite" ? <LoaderCircle size={17} className="animate-spin" /> : <Sparkles size={17} strokeWidth={1.75} />}
              {busy === "rewrite" ? `Rewriting in your ${voiceName} voice…` : `Rewrite in your ${voiceName} voice`}
            </button>
          ) : (
            <div className="rounded-[var(--radius-inner)] border border-line bg-wash p-4">
              <p className="font-medium text-ink">Unlock this rewrite in the Echo app</p>
              <p className="mt-1 text-sm leading-relaxed">Free rewrites unlock with a short ad on iPhone. Echo Plus removes ads everywhere.</p>
              <a href={appStoreUrl()} className="btn btn-secondary mt-3 !py-2 text-sm"><Smartphone size={16} strokeWidth={1.75} /> Open the iOS app</a>
            </div>
          )}
          {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}

          {save.structured ? (
            <section className="space-y-3">
              <h3 className="eyebrow">The details</h3>
              <StructuredView structured={save.structured} />
            </section>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="eyebrow">Original, word for word</h3>
              {save.source_url ? (
                <a href={save.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-ink hover:underline">
                  View original <ArrowUpRight size={15} strokeWidth={1.75} />
                </a>
              ) : null}
            </div>
            <blockquote className="rounded-[var(--radius-inner)] border border-line px-4 py-3.5 text-[0.93rem] leading-relaxed whitespace-pre-wrap">{save.verbatim_text || "No text was captured for this save."}</blockquote>
          </section>

          {related.length ? (
            <section className="space-y-3">
              <h3 className="eyebrow">Related in your library</h3>
              <ul className="divide-y divide-line rounded-[var(--radius-inner)] border border-line">
                {related.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => onOpenRelated(r.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-wash">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">{r.headline ?? "Saved post"}</span>
                        <PlatformBadge platform={r.platform} author={r.author} />
                      </span>
                      <ArrowUpRight size={16} strokeWidth={1.75} className="shrink-0 text-muted" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <button type="button" onClick={remove} disabled={busy !== null} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <Trash size={15} strokeWidth={1.75} /> Delete save
          </button>
        </div>
      </div>
    </div>
  );
}
