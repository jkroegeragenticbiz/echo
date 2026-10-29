"use client";

import { useState } from "react";
import { ArrowRight, CircleCheck, LoaderCircle } from "lucide-react";
import { PERSONAS } from "@echo/core";

export function WaitlistForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [persona, setPersona] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, persona: persona || undefined }),
    }).catch(() => null);
    setState(res?.ok ? "done" : "error");
  }

  if (state === "done") {
    return (
      <p className="flex items-center gap-2 font-medium text-ink" role="status">
        <CircleCheck size={18} strokeWidth={1.75} /> You&apos;re on the list. We&apos;ll email you when Echo is ready.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-lg space-y-2.5">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <label className="sr-only" htmlFor={compact ? "wl-email-2" : "wl-email"}>Email</label>
        <input
          id={compact ? "wl-email-2" : "wl-email"}
          type="email"
          required
          autoComplete="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field"
        />
        <button type="submit" className="btn btn-primary shrink-0" disabled={state === "sending"}>
          {state === "sending" ? <LoaderCircle size={17} className="animate-spin" /> : null}
          Join the waitlist <ArrowRight size={17} strokeWidth={1.75} />
        </button>
      </div>
      {!compact ? (
        <div>
          <label className="sr-only" htmlFor="wl-persona">What best describes you?</label>
          <select id="wl-persona" value={persona} onChange={(e) => setPersona(e.target.value)} className="field appearance-none !py-2.5 text-sm text-body">
            <option value="">What best describes you? (optional)</option>
            {PERSONAS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            <option value="custom">Something else</option>
          </select>
        </div>
      ) : null}
      {state === "error" ? <p className="text-sm text-red-700" role="alert">That didn&apos;t go through. Check the email and try again.</p> : null}
    </form>
  );
}
