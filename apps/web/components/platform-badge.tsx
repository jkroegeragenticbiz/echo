import { BriefcaseBusiness, Camera, CirclePlay, Clapperboard, Globe, PenLine } from "lucide-react";
import { PLATFORM_LABELS, type Platform } from "@echo/core";

const ICONS = {
  linkedin: BriefcaseBusiness,
  instagram: Camera,
  tiktok: Clapperboard,
  youtube: CirclePlay,
  web: Globe,
  manual: PenLine,
} as const;

export function PlatformGlyph({ platform, size = 15 }: { platform: Platform; size?: number }) {
  if (platform === "x") {
    return (
      <span aria-hidden="true" className="inline-flex items-center justify-center font-semibold leading-none" style={{ width: size, height: size, fontSize: size * 0.85 }}>
        X
      </span>
    );
  }
  const Icon = ICONS[platform];
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
}

export function PlatformBadge({ platform, author }: { platform: Platform; author?: string | null }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[0.8rem] font-medium text-muted">
      <PlatformGlyph platform={platform} size={14} />
      {/* The X glyph already reads as the name. */}
      {platform === "x" ? <span className="sr-only">X</span> : <span className="shrink-0">{PLATFORM_LABELS[platform]}</span>}
      {author ? (
        <>
          <span aria-hidden="true">·</span>
          <span className="truncate text-body">{author}</span>
        </>
      ) : null}
    </span>
  );
}
