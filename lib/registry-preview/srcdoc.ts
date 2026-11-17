// PreviewPlan → a self-contained srcDoc for the opaque-origin preview iframe.
// Everything heavy loads from CDNs inside the iframe: Babel standalone (same
// build lib/preview.ts uses), the Tailwind v4 browser build, tw-animate-css
// (the animate-in/out utilities shadcn v4 relies on), React 19 + every npm
// dependency from esm.sh. React 19 rather than the editor's 18: shadcn v4 and
// most current registries are written for it (ref as a prop, no forwardRef),
// and the iframe is isolated, so the versions never meet.

import { PREVIEW_HEAD } from "../preview";
import { REGISTRY_PREVIEW_RUNTIME } from "./runtime";
import { themeCss } from "./theme";
import type { PreviewPlan } from "./types";

export const BABEL_URL = "https://unpkg.com/@babel/standalone@7.24.7/babel.min.js";
export const TAILWIND_BROWSER_URL =
  "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1.11/dist/index.global.js";
export const TW_ANIMATE_URL = "https://cdn.jsdelivr.net/npm/tw-animate-css@1.4.0/dist/tw-animate.css";

export interface RegistryDocOpts {
  theme?: "light" | "dark";
  // How long after mounting to wait for late errors before reporting "ok".
  settleMs?: number;
}

/** JSON that is safe inside a <script> element. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function buildRegistryPreviewDocument(plan: PreviewPlan, opts: RegistryDocOpts = {}): string {
  const dark = opts.theme === "dark";
  const cfg = {
    babelUrl: BABEL_URL,
    tailwindUrl: TAILWIND_BROWSER_URL,
    twAnimateUrl: TW_ANIMATE_URL,
    themeCss: themeCss(plan.cssVars, plan.css),
    settleMs: opts.settleMs ?? 1500,
  };
  return `<!doctype html>
<html lang="en"${dark ? ' class="dark"' : ""}>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${PREVIEW_HEAD}
<link rel="preload" as="script" href="${BABEL_URL}" />
<link rel="preload" as="script" href="${TAILWIND_BROWSER_URL}" />
<link rel="preconnect" href="https://esm.sh" crossorigin />
<style>html,body{margin:0;min-height:100%}body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;background:${dark ? "#0a0a0a" : "#fff"}}#__rp_root{min-height:100vh}</style>
<script type="application/json" id="__rp_plan">${scriptJson(plan)}</script>
<script type="application/json" id="__rp_cfg">${scriptJson(cfg)}</script>
</head>
<body>
<div id="__rp_root"></div>
<script>${REGISTRY_PREVIEW_RUNTIME}</script>
</body>
</html>`;
}
