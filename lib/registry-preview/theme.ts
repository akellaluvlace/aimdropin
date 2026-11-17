// The shadcn new-york-v4 base theme (neutral), as a Tailwind v4 stylesheet
// for the browser build. Registry components are written against these
// tokens (bg-background, text-muted-foreground, ring-ring/50 …); without them
// most items render as unstyled black-on-white. Registry `cssVars` are layered
// on top by srcdoc.ts.

import type { RegistryCssVars } from "./types";

const LIGHT: Record<string, string> = {
  radius: "0.625rem",
  background: "oklch(1 0 0)",
  foreground: "oklch(0.145 0 0)",
  card: "oklch(1 0 0)",
  "card-foreground": "oklch(0.145 0 0)",
  popover: "oklch(1 0 0)",
  "popover-foreground": "oklch(0.145 0 0)",
  primary: "oklch(0.205 0 0)",
  "primary-foreground": "oklch(0.985 0 0)",
  secondary: "oklch(0.97 0 0)",
  "secondary-foreground": "oklch(0.205 0 0)",
  muted: "oklch(0.97 0 0)",
  "muted-foreground": "oklch(0.556 0 0)",
  accent: "oklch(0.97 0 0)",
  "accent-foreground": "oklch(0.205 0 0)",
  destructive: "oklch(0.577 0.245 27.325)",
  "destructive-foreground": "oklch(0.985 0 0)",
  border: "oklch(0.922 0 0)",
  input: "oklch(0.922 0 0)",
  ring: "oklch(0.708 0 0)",
  "chart-1": "oklch(0.646 0.222 41.116)",
  "chart-2": "oklch(0.6 0.118 184.704)",
  "chart-3": "oklch(0.398 0.07 227.392)",
  "chart-4": "oklch(0.828 0.189 84.429)",
  "chart-5": "oklch(0.769 0.188 70.08)",
  sidebar: "oklch(0.985 0 0)",
  "sidebar-foreground": "oklch(0.145 0 0)",
  "sidebar-primary": "oklch(0.205 0 0)",
  "sidebar-primary-foreground": "oklch(0.985 0 0)",
  "sidebar-accent": "oklch(0.97 0 0)",
  "sidebar-accent-foreground": "oklch(0.205 0 0)",
  "sidebar-border": "oklch(0.922 0 0)",
  "sidebar-ring": "oklch(0.708 0 0)",
};

const DARK: Record<string, string> = {
  background: "oklch(0.145 0 0)",
  foreground: "oklch(0.985 0 0)",
  card: "oklch(0.205 0 0)",
  "card-foreground": "oklch(0.985 0 0)",
  popover: "oklch(0.205 0 0)",
  "popover-foreground": "oklch(0.985 0 0)",
  primary: "oklch(0.922 0 0)",
  "primary-foreground": "oklch(0.205 0 0)",
  secondary: "oklch(0.269 0 0)",
  "secondary-foreground": "oklch(0.985 0 0)",
  muted: "oklch(0.269 0 0)",
  "muted-foreground": "oklch(0.708 0 0)",
  accent: "oklch(0.269 0 0)",
  "accent-foreground": "oklch(0.985 0 0)",
  destructive: "oklch(0.704 0.191 22.216)",
  "destructive-foreground": "oklch(0.985 0 0)",
  border: "oklch(1 0 0 / 10%)",
  input: "oklch(1 0 0 / 15%)",
  ring: "oklch(0.556 0 0)",
  "chart-1": "oklch(0.488 0.243 264.376)",
  "chart-2": "oklch(0.696 0.17 162.48)",
  "chart-3": "oklch(0.769 0.188 70.08)",
  "chart-4": "oklch(0.627 0.265 303.9)",
  "chart-5": "oklch(0.645 0.246 16.439)",
  sidebar: "oklch(0.205 0 0)",
  "sidebar-foreground": "oklch(0.985 0 0)",
  "sidebar-primary": "oklch(0.488 0.243 264.376)",
  "sidebar-primary-foreground": "oklch(0.985 0 0)",
  "sidebar-accent": "oklch(0.269 0 0)",
  "sidebar-accent-foreground": "oklch(0.985 0 0)",
  "sidebar-border": "oklch(1 0 0 / 10%)",
  "sidebar-ring": "oklch(0.556 0 0)",
};

const COLOR_TOKENS = Object.keys(LIGHT).filter((k) => k !== "radius");

const THEME_INLINE: Record<string, string> = {
  "radius-sm": "calc(var(--radius) - 4px)",
  "radius-md": "calc(var(--radius) - 2px)",
  "radius-lg": "var(--radius)",
  "radius-xl": "calc(var(--radius) + 4px)",
  ...Object.fromEntries(COLOR_TOKENS.map((k) => [`color-${k}`, `var(--${k})`])),
};

function decls(vars: Record<string, string>, indent = "  "): string {
  return Object.entries(vars)
    .map(([k, v]) => `${indent}${k.startsWith("--") ? k : `--${k}`}: ${v};`)
    .join("\n");
}

/** The full `text/tailwindcss` stylesheet: base theme + registry overrides. */
export function themeCss(vars: RegistryCssVars, extraCss: string): string {
  return [
    "@custom-variant dark (&:is(.dark *));",
    `:root {\n${decls({ ...LIGHT, ...vars.light })}\n}`,
    `.dark {\n${decls({ ...DARK, ...vars.dark })}\n}`,
    `@theme inline {\n${decls({ ...THEME_INLINE, ...vars.theme })}\n}`,
    "@layer base {\n  * { @apply border-border outline-ring/50; }\n  body { @apply bg-background text-foreground; }\n}",
    extraCss,
  ]
    .filter(Boolean)
    .join("\n\n");
}
