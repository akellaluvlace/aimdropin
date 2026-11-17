// Serve-time rewrite of every demo HTML page. Stored files stay exactly as
// the author shipped them; this runs on the way out (and the CDN caches the
// result), so the shim can change without re-importing anything.

import { demoShimSource, type DemoShimConfig } from "./shim";

export const SHIM_MARKER = "data-aim-demo-shim";
export const BASE_STYLE_MARKER = "data-aim-demo-base";

// These dashboards never set a font on <html> or <body>, so their plain text
// fell back to the browser's serif default. They get a sans-serif with the
// lowest priority there is: a cascade layer of its own, declared before
// anything of the page's, and :where() for zero specificity, so every font the
// dashboard does set still wins.
//
// Only these, not every demo: layers are ordered by position, and some apps
// (nuxt-ui-dashboard) insert a stylesheet above this one while they start,
// which would let this default outrank their own "@layer base" font. The
// browser sweep fails on a default serif font, so a new dashboard that needs
// this shows up there.
const SANS_DEFAULT = new Set(["geeker-admin", "vitify-admin", "vue-element-plus-admin"]);
const BASE_STYLE = `<style ${BASE_STYLE_MARKER}>@layer aim-demo-base{:where(html){font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}}</style>`;

export type DemoHtmlOptions = DemoShimConfig;

// Analytics, tag managers, session recorders and ad networks. Demos run
// inside our site, so the template author's trackers would follow our
// visitors; the templates work the same without them.
const TRACKER_SRC =
  /googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net|static\.hotjar\.com|clarity\.ms|connect\.facebook\.net|cdn\.carbonads\.com|srv\.buysellads\.com|plausible\.io|cdn\.segment\.com|cdn\.mxpnl\.com|mc\.yandex\.ru|statcounter\.com|static\.cloudflareinsights\.com|js\.hs-scripts\.com|cdn\.amplitude\.com/i;
const TRACKER_INLINE =
  /googletagmanager\.com|google-analytics\.com|\bgtag\s*\(|\bga\s*\(\s*['"](?:create|send)|GoogleAnalyticsObject|_hjSettings|static\.hotjar\.com|clarity\.ms|["']clarity["']|connect\.facebook\.net|\bfbq\s*\(|adsbygoogle|googlesyndication|carbonads|buysellads|mc\.yandex\.ru|ym\s*\(\s*\d+\s*,\s*["']init|statcounter|cloudflareinsights/i;

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const NOSCRIPT_RE = /<noscript\b[^>]*>([\s\S]*?)<\/noscript\s*>/gi;

function srcOf(attrs: string): string | null {
  const m = attrs.match(/\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  return m ? (m[1] ?? m[2] ?? m[3] ?? "") : null;
}

export function stripTrackers(html: string): string {
  return html
    .replace(SCRIPT_RE, (whole, attrs: string, body: string) => {
      if (attrs.includes(SHIM_MARKER)) return whole;
      // Framework payloads (Next.js app/pages router) can mention anything.
      if (/__NEXT_DATA__|application\/json|application\/ld\+json/i.test(attrs) || /self\.__next_f|__NUXT__|__sveltekit/.test(body)) return whole;
      const src = srcOf(attrs);
      if (src !== null) return TRACKER_SRC.test(src) ? "" : whole;
      return TRACKER_INLINE.test(body) ? "" : whole;
    })
    .replace(NOSCRIPT_RE, (whole, body: string) => (TRACKER_SRC.test(body) ? "" : whole));
}

function mapRootPath(value: string, opts: DemoHtmlOptions): string {
  // value is everything after the leading "/".
  const prefix = `demos/${opts.slug}/`;
  if (value.startsWith(prefix)) return `/${value}`;
  const cut = value.search(/[?#]/);
  const pathPart = cut === -1 ? value : value.slice(0, cut);
  const rest = cut === -1 ? "" : value.slice(cut);
  const mapped = pathPart === "" ? opts.entry : pathPart.endsWith("/") ? `${pathPart}index.html` : pathPart;
  return `/${prefix}${mapped}${rest}`;
}

const URL_ATTR_RE =
  /(\s(?:href|src|action|poster|data-src|data-href|data-bg|data-background|data-image)\s*=\s*)(["'])\/(?!\/)([^"']*)\2/gi;
const SRCSET_RE = /(\s(?:srcset|data-srcset)\s*=\s*)(["'])([^"']*)\2/gi;
const STYLE_ATTR_RE = /(\sstyle\s*=\s*)(["'])([^"']*)\2/gi;
const STYLE_BLOCK_RE = /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi;
const CSS_URL_RE = /url\(\s*(["']?)\/(?!\/)/gi;

/** Static templates were made for a domain root; keep their root-relative URLs inside the demo. */
export function rewriteRootLinks(html: string, opts: DemoHtmlOptions): string {
  const cssPrefix = `/demos/${opts.slug}/`;
  const fixCss = (css: string) =>
    css.replace(CSS_URL_RE, (m, q: string, offset: number, all: string) =>
      all.startsWith(cssPrefix, offset + m.length - 1) ? m : `url(${q}${cssPrefix}`,
    );
  return html
    .replace(URL_ATTR_RE, (_m, lead: string, q: string, value: string) => `${lead}${q}${mapRootPath(value, opts)}${q}`)
    .replace(SRCSET_RE, (_m, lead: string, q: string, value: string) => {
      const fixed = value
        .split(",")
        .map((cand) => {
          const t = cand.trim();
          return t.startsWith("/") && !t.startsWith("//") ? cand.replace(t, mapRootPath(t.slice(1), opts)) : cand;
        })
        .join(",");
      return `${lead}${q}${fixed}${q}`;
    })
    .replace(STYLE_ATTR_RE, (_m, lead: string, q: string, value: string) => `${lead}${q}${fixCss(value)}${q}`)
    .replace(STYLE_BLOCK_RE, (_m, open: string, css: string, close: string) => `${open}${fixCss(css)}${close}`);
}

export function injectShim(html: string, opts: DemoHtmlOptions): string {
  if (html.includes(SHIM_MARKER)) return html;
  const tag = `<script ${SHIM_MARKER}>${demoShimSource(opts)}</script>${SANS_DEFAULT.has(opts.slug) ? BASE_STYLE : ""}`;
  const head = html.match(/<head(\s[^>]*)?>/i);
  if (head && head.index !== undefined) {
    const at = head.index + head[0].length;
    return html.slice(0, at) + tag + html.slice(at);
  }
  const root = html.match(/<html(\s[^>]*)?>/i);
  if (root && root.index !== undefined) {
    const at = root.index + root[0].length;
    return html.slice(0, at) + tag + html.slice(at);
  }
  return tag + html;
}

// <meta http-equiv="refresh" content="0; url=/settings/profile"> - static
// redirect stubs (Nuxt writes one per redirect route) that would leave the
// demo for the site root.
const META_REFRESH_RE = /(<meta\b[^>]*\bhttp-equiv\s*=\s*["']?refresh["']?[^>]*\bcontent\s*=\s*)(["'])([^"']*)\2/gi;

export function rewriteMetaRefresh(html: string, opts: DemoHtmlOptions): string {
  const base = `/demos/${opts.slug}/`;
  return html.replace(META_REFRESH_RE, (whole, lead: string, q: string, content: string) => {
    const m = content.match(/^(\s*\d+\s*[;,]\s*url\s*=\s*)(['"]?)(\/(?!\/)[^'"]*)\2\s*$/i);
    if (!m || m[3].startsWith(base)) return whole;
    return `${lead}${q}${m[1]}${m[2]}${base}${m[3].slice(1)}${m[2]}${q}`;
  });
}

export function transformDemoHtml(html: string, opts: DemoHtmlOptions): string {
  let out = stripTrackers(html);
  if (opts.kind === "static") out = rewriteRootLinks(out, opts);
  out = rewriteMetaRefresh(out, opts);
  return injectShim(out, opts);
}

/**
 * One demo page as editable HTML for the playground: trackers out, root
 * links kept inside the demo, and a <base> pointing at the page's folder in
 * /demos/<slug>/ so its relative CSS, scripts and images keep loading.
 */
export function editablePageHtml(html: string, pagePath: string, opts: DemoHtmlOptions): string {
  let out = stripTrackers(html);
  if (opts.kind === "static") out = rewriteRootLinks(out, opts);
  const dir = pagePath.includes("/") ? pagePath.slice(0, pagePath.lastIndexOf("/") + 1) : "";
  const base = `<base href="/demos/${opts.slug}/${dir}">`;
  out = out.replace(/<base\b[^>]*>/gi, "");
  const head = out.match(/<head(\s[^>]*)?>/i);
  if (head && head.index !== undefined) {
    const at = head.index + head[0].length;
    return out.slice(0, at) + base + out.slice(at);
  }
  return base + out;
}
