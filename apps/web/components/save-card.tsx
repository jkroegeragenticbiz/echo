import { LoaderCircle, Lock } from "lucide-react";
import type { SaveDTO } from "@echo/core";
import { InYourVoice } from "./in-your-voice";
import { MetricPill } from "./metric-pill";
import { PlatformBadge } from "./platform-badge";

export function SaveCard({ save, voiceName, onOpen }: { save: SaveDTO; voiceName: string; onOpen?: () => void }) {
  const headline = save.rewrite?.headline ?? save.summary ?? firstLine(save.verbatim_text);
  return (
    <article className="card group flex flex-col gap-4 p-5 transition-shadow hover:shadow-[var(--shadow-lift)]">
      <button type="button" onClick={onOpen} className="flex flex-col gap-4 text-left focus-visible:outline-none" aria-label={`Open ${headline}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 flex-1"><PlatformBadge platform={save.platform} author={save.author} /></span>
          {save.key_metric ? <MetricPill metric={save.key_metric} /> : null}
        </div>
        <h3 className="text-[1.08rem] leading-snug font-semibold text-ink">{headline}</h3>
        {save.status === "ready" && save.rewrite ? (
          <InYourVoice voiceName={voiceName}>
            <p className="line-clamp-4 text-[0.93rem] leading-relaxed text-ink/85">{save.rewrite.paraphrase}</p>
          </InYourVoice>
        ) : save.status === "processing" ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <LoaderCircle size={15} strokeWidth={1.75} className="animate-spin" aria-hidden="true" /> Reading and rewriting…
          </p>
        ) : save.status === "failed" ? (
          <p className="text-sm text-muted">We couldn&apos;t read this one. Open it to see the original.</p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Lock size={14} strokeWidth={1.75} aria-hidden="true" /> Rewrite in your {voiceName} voice
          </p>
        )}
      </button>
    </article>
  );
}

function firstLine(text: string) {
  const line = text.split("\n").find((l) => l.trim()) ?? "Untitled save";
  return line.length > 110 ? `${line.slice(0, 107)}…` : line;
}
