/** The one place the teal accent appears: marking text written in the user's voice. */
export function InYourVoice({ voiceName, children, className = "" }: { voiceName?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-[var(--radius-inner)] bg-wash py-3.5 pl-5 pr-4 ${className}`}>
      <span aria-hidden="true" className="absolute top-3.5 bottom-3.5 left-0 w-[3px] rounded-full bg-accent" />
      <p className="mb-1.5 flex items-center gap-1.5 text-[0.72rem] font-semibold tracking-[0.06em] text-accent uppercase">
        In your voice{voiceName ? <span className="font-medium tracking-normal normal-case text-muted">· {voiceName}</span> : null}
      </p>
      {children}
    </div>
  );
}
