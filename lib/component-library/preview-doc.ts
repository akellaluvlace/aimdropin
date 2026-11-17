// Standalone preview document for one HTML component (Uiverse / HyperUI):
// Tailwind CDN when needed, the component's scoped CSS, centred on a plain
// background. Used by the editor's library detail modal and /library pages.

import type { ComponentFull } from "./types";

// The Tailwind Play CDN takes short plugin names ("forms"), not package names
// ("@tailwindcss/forms"); one unknown name and it applies no Tailwind at all.
const PLAY_CDN_PLUGINS = new Set(["forms", "typography", "aspect-ratio", "line-clamp", "container-queries"]);
export function playCdnPlugin(name: string): string | null {
  const short = name.trim().replace(/^@tailwindcss\//, "");
  return PLAY_CDN_PLUGINS.has(short) ? short : null;
}

// Collections ship snippets that link their own site's /component.css and
// /component.js; those don't exist here.
export function stripSiteAssets(html: string): string {
  return html
    .replace(/<link\b[^>]*\bhref=["']\/component\.css["'][^>]*>\s*/gi, "")
    .replace(/<script\b[^>]*\bsrc=["']\/component\.js["'][^>]*>\s*<\/script>\s*/gi, "");
}

export function buildPreviewDoc(full: ComponentFull): string {
  const thumbScope = "dropin-preview";
  const scopedCss = full.css
    ? full.css.split("__UIV_SCOPE__").join(thumbScope)
    : "";
  const pluginNames = (full.tailwindPlugins ?? []).map(playCdnPlugin).filter((p): p is string => p !== null);
  const plugins = pluginNames.length ? `?plugins=${pluginNames.join(",")}` : "";
  const tailwind = full.tailwindRequired
    ? `<script src="https://cdn.tailwindcss.com${plugins}"></script>`
    : "";
  const bodyClass = full.darkVariant ? "dark" : "";
  const wrap = full.css ? thumbScope : "";
  return `<!doctype html>
<html class="${bodyClass}">
<head>
<meta charset="utf-8" />
${tailwind}
<style>
  html,body{margin:0;padding:0;background:${full.darkVariant ? "#0b0c0e" : "#fafafa"};font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;}
  .dropin-preview-wrap{min-height:100vh;display:grid;place-items:center;padding:32px;}
  ${scopedCss}
</style>
</head>
<body>
<div class="dropin-preview-wrap">
<div class="${wrap}">
${stripSiteAssets(full.html)}
</div>
</div>
</body>
</html>`;
}
