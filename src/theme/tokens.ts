// Values mirror the web design tokens ("Blueprint Circuit", spec §21.2) — dark theme first.
export const colors = {
  background: "#0a1020",
  surface: "#111a2e",
  surfaceRaised: "#16223b",
  border: "#1f2d4a",
  borderInput: "#64748b",
  foreground: "#e6edf7",
  muted: "#94a3b8",
  primary: "#60a5fa",
  primaryStrong: "#3b82f6",
  primaryForeground: "#0a1020",
  cyan: "#22d3ee",
  success: "#34d399",
  warning: "#fbbf24",
  danger: "#f87171",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14 } as const;
export const font = {
  body: 16,
  small: 14,
  tiny: 12,
  title: 22,
  heading: 18,
  mono: "monospace",
} as const;
