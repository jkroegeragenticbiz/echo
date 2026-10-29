/** Echo design tokens (mirrors apps/web/app/globals.css). */
export const colors = {
  canvas: "#F7F6F2",
  card: "#FFFFFF",
  line: "#EAE8E1",
  lineStrong: "#DCD9CF",
  ink: "#111315",
  body: "#55554F",
  muted: "#8A8A83",
  wash: "#FBFAF7",
  accent: "#0D9488",
  danger: "#B42318",
} as const;

export const radius = { card: 24, inner: 16, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

/** Lucide stroke width used everywhere in UI chrome. */
export const ICON_STROKE = 1.75;

export const shadow = {
  shadowColor: "#111315",
  shadowOpacity: 0.06,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
} as const;

export const type = {
  largeTitle: { fontSize: 34, fontWeight: "700", letterSpacing: 0.37, color: colors.ink },
  title: { fontSize: 22, fontWeight: "600", letterSpacing: -0.26, color: colors.ink },
  headline: { fontSize: 17, fontWeight: "600", letterSpacing: -0.41, color: colors.ink, lineHeight: 23 },
  body: { fontSize: 16, color: colors.body, lineHeight: 23 },
  callout: { fontSize: 15, color: colors.body, lineHeight: 21 },
  footnote: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  eyebrow: { fontSize: 12, fontWeight: "600", letterSpacing: 0.8, color: colors.muted, textTransform: "uppercase" },
} as const;
