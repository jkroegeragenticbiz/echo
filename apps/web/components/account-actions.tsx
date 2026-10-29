"use client";

import { useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import type { Plan } from "@echo/core";

export function XConnection(props: { connected: boolean; username: string | null; lastSyncedAt: string | null; plan: Plan; result: string | null }) {
  const [connected, setConnected] = useState(props.connected);
  const [status, setStatus] = useState<string | null>(
    props.result === "connected" ? "X connected." : props.result === "error" ? "Couldn't connect X. Try again." : null,
  );
  const [busy, setBusy] = useState(false);

  async function sync() {
    setBusy(true);
    const res = await fetch("/api/x/sync", { method: "POST" });
    const data = (await res.json()) as { imported?: number; error?: string; reason?: string | null };
    setBusy(false);
    if (!res.ok) setStatus(data.error ?? "Sync failed.");
    else if (data.reason === "quota_exceeded") setStatus("You've used this month's free saves. Echo Plus imports everything.");
    else setStatus(data.imported ? `Imported ${data.imported} new bookmark${data.imported === 1 ? "" : "s"}.` : "No new bookmarks.");
  }

  async function disconnect() {
    if (!confirm("Disconnect X? Saves you already imported stay in your library.")) return;
    await fetch("/api/x/sync", { method: "DELETE" });
    setConnected(false);
    setStatus("X disconnected.");
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-4 rounded-[var(--radius-inner)] border border-line px-4 py-3">
        <div>
          <p className="font-medium text-ink">X bookmarks</p>
          <p className="text-sm text-muted">
            {connected
              ? `@${props.username ?? "connected"}${props.lastSyncedAt ? ` · last synced ${new Date(props.lastSyncedAt).toLocaleString()}` : ""}`
              : "Import bookmarks with X's official API."}
          </p>
        </div>
        {connected ? (
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={sync} disabled={busy} className="btn btn-secondary !px-3 !py-2 text-sm">
              {busy ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} strokeWidth={1.75} />} Sync now
            </button>
            <button type="button" onClick={disconnect} className="text-sm text-muted hover:text-ink">Disconnect</button>
          </div>
        ) : (
          <a href="/api/x/connect?return_to=/account" className="btn btn-primary shrink-0 !px-4 !py-2 text-sm">Connect X</a>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">
        {props.plan === "plus" ? "Echo Plus syncs new bookmarks automatically every hour." : "Automatic hourly sync is part of Echo Plus. You can import manually any time."}
      </p>
      {status ? <p className="mt-2 text-sm text-ink" role="status">{status}</p> : null}
    </div>
  );
}

export function DeleteAccount({ signOutAction }: { signOutAction: () => Promise<void> }) {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    const res = await fetch("/api/me", { method: "DELETE" });
    if (!res.ok) {
      setBusy(false);
      setError("Something went wrong. Nothing was deleted.");
      return;
    }
    await signOutAction();
  }

  return (
    <div className="mt-4 space-y-3">
      <label htmlFor="confirm-delete" className="block text-sm">Type <strong className="text-ink">DELETE</strong> to confirm</label>
      <input id="confirm-delete" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="field max-w-xs !py-2.5" autoComplete="off" />
      <div>
        <button type="button" onClick={remove} disabled={confirmText !== "DELETE" || busy} className="btn !py-2 text-sm bg-red-700 text-white disabled:opacity-40">
          {busy ? <LoaderCircle size={15} className="animate-spin" /> : null} Delete my account
        </button>
      </div>
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
