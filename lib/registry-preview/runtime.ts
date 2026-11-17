// The script that runs inside the registry preview iframe. It reads the
// PreviewPlan embedded in the document, transpiles every virtual module with
// Babel standalone (TSX → ESM, automatic JSX runtime), rewrites import
// specifiers (relative + "@/…" aliases → virtual ids, npm → esm.sh with React
// kept external, next/* → shims), registers them all through one dynamic
// import map of blob URLs (so circular imports work), then imports the entry
// and renders it inside an error boundary. Status goes to the host as
// { __dropin: true, type: "registry-preview:status", status, message }.
//
// Plain ES2017 in a String.raw template: no backticks and no "${" inside, and
// the closing script tag is written as "<\/script>" by srcdoc.ts's escaping.

export const REACT_VERSION = "19.2.0";
export const ESM_SH = "https://esm.sh";

// Some packages read process.env.NODE_ENV at import time (bundled for Node).
export const PROCESS_SHIM =
  'if (typeof window.process === "undefined") { window.process = { env: { NODE_ENV: "production" }, browser: true }; }';

export const REGISTRY_PREVIEW_RUNTIME = String.raw`${PROCESS_SHIM}
(function () {
  var REACT = "${REACT_VERSION}";
  var ESM = "https://esm.sh";
  var plan = JSON.parse(document.getElementById("__rp_plan").textContent);
  var cfg = JSON.parse(document.getElementById("__rp_cfg").textContent);
  var reported = false;
  var errors = [];
  var BENIGN = /ResizeObserver loop|Script error\.?$|Non-Error promise rejection captured/i;

  function post(msg) {
    try { msg.__dropin = true; parent.postMessage(msg, "*"); } catch (e) {}
  }
  function report(status, message) {
    if (reported) return;
    reported = true;
    post({ type: "registry-preview:status", status: status, message: message || null, url: plan.rootUrl });
    if (status === "error") showError(message);
  }
  function showError(message) {
    var root = document.getElementById("__rp_root");
    var card = document.createElement("div");
    card.setAttribute("style", "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:#fafafa;font:14px/1.5 ui-sans-serif,system-ui,sans-serif;color:#262626;z-index:2147483647");
    var inner = document.createElement("div");
    inner.setAttribute("style", "max-width:520px;border:1px solid #e5e5e5;border-radius:12px;background:#fff;padding:20px 22px;box-shadow:0 1px 2px rgba(0,0,0,.05)");
    var h = document.createElement("div");
    h.setAttribute("style", "font-weight:600;margin-bottom:6px");
    h.textContent = "Live preview unavailable";
    var p = document.createElement("div");
    p.setAttribute("style", "color:#737373;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,monospace;font-size:12px");
    p.textContent = String(message || "Unknown error").slice(0, 600);
    var hint = document.createElement("div");
    hint.setAttribute("style", "margin-top:10px;color:#737373");
    hint.textContent = "The code and install command still work - this item needs something the in-browser preview can't provide.";
    inner.appendChild(h); inner.appendChild(p); inner.appendChild(hint);
    card.appendChild(inner);
    (root && root.parentNode ? root.parentNode : document.body).appendChild(card);
  }
  window.addEventListener("error", function (e) {
    var m = (e && (e.message || (e.error && e.error.message))) || "";
    if (!m || BENIGN.test(m)) return;
    errors.push(m);
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason;
    var m = (r && (r.message || String(r))) || "";
    if (!m || BENIGN.test(m)) return;
    errors.push(m);
  });

  // Snapshot for thumbnails / the editor (same protocol as lib/preview.ts).
  window.addEventListener("message", function (ev) {
    var d = ev.data;
    if (!d || d.__dropin !== true || d.type !== "dropin:request-snapshot") return;
    var html = null;
    try { html = "<!doctype html>\n" + document.documentElement.outerHTML; } catch (e) {}
    post({ type: "dropin:snapshot", nonce: d.nonce, html: html });
  });

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("Failed to load " + src)); };
      document.head.appendChild(s);
    });
  }
  function fetchText(url, ms) {
    return new Promise(function (resolve) {
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; resolve(""); } }, ms);
      fetch(url).then(function (r) { return r.ok ? r.text() : ""; }).then(function (txt) {
        if (!done) { done = true; clearTimeout(t); resolve(txt); }
      }, function () { if (!done) { done = true; clearTimeout(t); resolve(""); } });
    });
  }

  // ------------------------------------------------------------ resolution
  var table = {};   // alias / id -> module id
  var byId = {};
  plan.modules.forEach(function (m) {
    byId[m.id] = m;
    table[m.id] = m.id;
    m.aliases.forEach(function (a) { if (!table[a]) table[a] = m.id; });
  });

  function moduleKey(p) {
    return /\.css$/i.test(p) ? p : p.replace(/\.(tsx|ts|mts|jsx|js|mjs|json)$/i, "");
  }
  function joinPath(dir, rel) {
    var parts = dir.split("/");
    rel.split("/").forEach(function (seg) {
      if (seg === "." || seg === "") return;
      if (seg === "..") { if (parts.length > 1) parts.pop(); return; }
      parts.push(seg);
    });
    return parts.join("/");
  }
  function lookup(key) {
    return table[key] || table[key + "/index"] || null;
  }
  function pkgOf(spec) {
    var parts = spec.split("/");
    return spec.charAt(0) === "@" ? parts.slice(0, 2).join("/") : parts[0];
  }

  var BUILTINS = {
    "next/link": 1, "next/image": 1, "next/navigation": 1, "next/router": 1,
    "next/dynamic": 1, "next/head": 1, "next/script": 1, "next/font/local": 1,
    "next/font/google": 1, "next": 1, "next-themes": 1, "server-only": 1, "client-only": 1
  };
  var REACT_SPECS = /^(react|react-dom)(\/.*)?$/;
  var missing = {};
  var googleFonts = {};
  var cssTexts = [];
  var cssLinks = [];

  function esmUrl(spec) {
    var pkg = pkgOf(spec);
    var sub = spec.slice(pkg.length);
    var ver = plan.npm[pkg];
    return ESM + "/" + pkg + (ver ? "@" + ver : "") + sub + "?external=react,react-dom";
  }

  // Returns the specifier to emit, or null to drop the import (CSS).
  function mapSpec(spec, mod) {
    if (/\.css$/i.test(spec) || /\.css\?/.test(spec)) {
      var cssMod = null;
      if (spec.charAt(0) === ".") {
        for (var i = 0; i < mod.dirs.length && !cssMod; i++) cssMod = byId[lookup(joinPath(mod.dirs[i], spec))];
      } else if (/^[@~]\//.test(spec)) {
        cssMod = byId[lookup("@/" + spec.slice(2))];
      } else {
        var pkg = pkgOf(spec);
        var ver = plan.npm[pkg];
        cssLinks.push("https://cdn.jsdelivr.net/npm/" + pkg + (ver ? "@" + ver : "") + spec.slice(pkg.length));
        return null;
      }
      if (cssMod) cssTexts.push(cssMod.code);
      return null;
    }
    if (spec.charAt(0) === ".") {
      for (var j = 0; j < mod.dirs.length; j++) {
        var hit = lookup(moduleKey(joinPath(mod.dirs[j], spec)));
        if (hit) return hit;
      }
      return missingSpec(spec + " (from " + mod.id + ")");
    }
    if (/^[@~]\//.test(spec)) {
      var id = lookup(moduleKey("@/" + spec.slice(2)));
      if (id) return id;
      if (moduleKey(spec.replace(/^~/, "@")) === "@/lib/utils") return "@/lib/utils";
      return missingSpec(spec);
    }
    if (BUILTINS[spec]) return spec;
    if (REACT_SPECS.test(spec)) return spec;
    if (/^(https?:)?\/\//.test(spec)) return spec;
    return esmUrl(spec);
  }
  function missingSpec(spec) {
    var key = "missing:" + spec;
    missing[key] = spec;
    return key;
  }

  function rewritePlugin(mod) {
    function fix(path) {
      var src = path.node.source;
      if (!src || typeof src.value !== "string") return;
      if (src.value === "next/font/google" && path.node.specifiers) {
        path.node.specifiers.forEach(function (s) {
          if (s.type === "ImportSpecifier") googleFonts[s.imported.name || s.imported.value] = 1;
        });
      }
      var out = mapSpec(src.value, mod);
      if (out === null) {
        if (path.node.type === "ImportDeclaration") path.remove();
        return;
      }
      src.value = out;
    }
    return {
      visitor: {
        ImportDeclaration: fix,
        ExportNamedDeclaration: fix,
        ExportAllDeclaration: fix,
        CallExpression: function (path) {
          var n = path.node;
          if (n.callee.type === "Import" && n.arguments[0] && n.arguments[0].type === "StringLiteral") {
            var out = mapSpec(n.arguments[0].value, mod);
            if (out) n.arguments[0].value = out;
          }
        }
      }
    };
  }

  function transpile(mod) {
    if (mod.lang === "json") return "export default " + mod.code.trim() + ";";
    var res = Babel.transform(mod.code, {
      filename: mod.id + "." + (mod.lang === "ts" ? "ts" : "tsx"),
      sourceType: "module",
      presets: [
        ["typescript", { isTSX: mod.lang !== "ts", allExtensions: true, allowDeclareFields: true }],
        ["react", { runtime: "automatic" }]
      ],
      plugins: [rewritePlugin(mod)],
      compact: false,
      comments: false
    });
    return res.code;
  }

  // ------------------------------------------------------------ builtins
  function builtinSources() {
    var fontNames = Object.keys(googleFonts);
    var fontExports = fontNames.map(function (n) {
      return "export const " + n + " = __font(" + JSON.stringify(n.replace(/_/g, " ")) + ");";
    }).join("\n");
    return {
      "next": "export default {};",
      "server-only": "export {};",
      "client-only": "export {};",
      "@/lib/utils": "import { clsx } from \"" + esmUrl("clsx") + "\";\nimport { twMerge } from \"" + esmUrl("tailwind-merge") + "\";\nexport function cn(...inputs) { return twMerge(clsx(inputs)); }",
      "next/link": "import * as React from \"react\";\nconst Link = React.forwardRef(function Link({ href, children, prefetch, replace, scroll, shallow, passHref, legacyBehavior, locale, onClick, ...rest }, ref) {\n  const h = typeof href === \"string\" ? href : (href && (href.pathname || \"#\")) || \"#\";\n  return React.createElement(\"a\", { ...rest, ref, href: h, onClick: (e) => { if (onClick) onClick(e); if (!/^(#|https?:|mailto:|tel:)/.test(h)) e.preventDefault(); } }, children);\n});\nexport default Link;",
      "next/image": "import * as React from \"react\";\nconst Image = React.forwardRef(function Image({ src, alt, fill, width, height, style, priority, quality, placeholder, blurDataURL, loader, unoptimized, sizes, overrideSrc, ...rest }, ref) {\n  const s = typeof src === \"object\" && src ? src.src : src;\n  const st = fill ? { position: \"absolute\", inset: 0, width: \"100%\", height: \"100%\", ...style } : style;\n  return React.createElement(\"img\", { ...rest, ref, src: s, alt: alt || \"\", width: fill ? undefined : width, height: fill ? undefined : height, style: st, loading: priority ? \"eager\" : \"lazy\" });\n});\nexport default Image;",
      "next/navigation": "const router = { push() {}, replace() {}, back() {}, forward() {}, refresh() {}, prefetch() {} };\nexport function useRouter() { return router; }\nexport function usePathname() { return \"/\"; }\nexport function useSearchParams() { return new URLSearchParams(); }\nexport function useParams() { return {}; }\nexport function useSelectedLayoutSegment() { return null; }\nexport function useSelectedLayoutSegments() { return []; }\nexport function redirect() {}\nexport function permanentRedirect() {}\nexport function notFound() {}",
      "next/router": "const router = { pathname: \"/\", route: \"/\", query: {}, asPath: \"/\", isReady: true, push() { return Promise.resolve(true); }, replace() { return Promise.resolve(true); }, back() {}, prefetch() { return Promise.resolve(); }, events: { on() {}, off() {}, emit() {} } };\nexport function useRouter() { return router; }\nexport default router;",
      "next/dynamic": "import * as React from \"react\";\nexport default function dynamic(loader, opts) {\n  const L = React.lazy(async () => { const m = await (typeof loader === \"function\" ? loader() : loader); return { default: (m && m.default) || m }; });\n  return function Dynamic(props) { return React.createElement(React.Suspense, { fallback: null }, React.createElement(L, props)); };\n}",
      "next/head": "export default function Head() { return null; }",
      "next/script": "export default function Script() { return null; }",
      "next/font/local": "export default function localFont() { return { className: \"\", variable: \"\", style: {} }; }",
      "next/font/google": "function __font(family) {\n  try { const l = document.createElement(\"link\"); l.rel = \"stylesheet\"; l.href = \"https://fonts.googleapis.com/css2?family=\" + encodeURIComponent(family) + \":wght@300;400;500;600;700&display=swap\"; document.head.appendChild(l); } catch (e) {}\n  return function () { return { className: \"\", variable: \"\", style: { fontFamily: \"'\" + family + \"', sans-serif\" } }; };\n}\n" + fontExports,
      "next-themes": "import * as React from \"react\";\nexport function ThemeProvider({ children }) { return React.createElement(React.Fragment, null, children); }\nexport function useTheme() {\n  const [t, setT] = React.useState(document.documentElement.classList.contains(\"dark\") ? \"dark\" : \"light\");\n  return { theme: t, resolvedTheme: t, systemTheme: t, themes: [\"light\", \"dark\"], setTheme: (v) => { document.documentElement.classList.toggle(\"dark\", v === \"dark\"); setT(v); } };\n}"
    };
  }

  function blobUrl(code) {
    return URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  }

  // ------------------------------------------------------------ boot
  var twAnimate = fetchText(cfg.twAnimateUrl, 4000);
  var babelReady = loadScript(cfg.babelUrl);

  babelReady.then(function () {
    var imports = {
      "react": ESM + "/react@" + REACT,
      "react/": ESM + "/react@" + REACT + "/",
      "react-dom": ESM + "/react-dom@" + REACT + "?external=react",
      "react-dom/client": ESM + "/react-dom@" + REACT + "/client?external=react",
      "react-dom/server": ESM + "/react-dom@" + REACT + "/server?external=react",
      "react-dom/": ESM + "/react-dom@" + REACT + "/"
    };
    var failures = [];
    plan.modules.forEach(function (m) {
      if (m.lang === "css") return;
      var code;
      try { code = transpile(m); }
      catch (e) {
        failures.push(m.id + ": " + (e && e.message ? e.message.split("\n")[0] : e));
        code = "throw new Error(" + JSON.stringify("Could not compile " + m.id) + ");";
      }
      var url = blobUrl(code);
      imports[m.id] = url;
      m.aliases.forEach(function (a) { if (!imports[a]) imports[a] = url; });
    });
    var builtins = builtinSources();
    Object.keys(builtins).forEach(function (k) {
      if (imports[k]) return;
      try { imports[k] = blobUrl(transpile({ id: "builtin/" + k, lang: "js", code: builtins[k], dirs: [] })); }
      catch (e) { imports[k] = blobUrl(builtins[k]); }
    });
    Object.keys(missing).forEach(function (k) {
      imports[k] = blobUrl("throw new Error(" + JSON.stringify("Missing module: " + missing[k]) + ");");
    });
    var map = document.createElement("script");
    map.type = "importmap";
    map.textContent = JSON.stringify({ imports: imports });
    document.head.appendChild(map);
    if (failures.length && failures.length === plan.modules.length) throw new Error(failures.join("\n"));
    return twAnimate.then(function (anim) {
      plan.stylesheets.concat(cssLinks).forEach(function (href) {
        var l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; document.head.appendChild(l);
      });
      var st = document.createElement("style");
      st.type = "text/tailwindcss";
      st.textContent = anim + "\n" + cfg.themeCss + "\n" + cssTexts.join("\n");
      document.head.appendChild(st);
      return loadScript(cfg.tailwindUrl);
    });
  }).then(function () {
    // Apps mount shadcn's TooltipProvider once at the root; blocks that use
    // Tooltip assume it's there.
    var tooltipId = table["@/components/ui/tooltip"];
    return Promise.all([
      import("react"),
      import("react-dom/client"),
      import(plan.entry.moduleId),
      tooltipId ? import(tooltipId).catch(function () { return null; }) : null
    ]);
  }).then(function (mods) {
    var React = mods[0], ReactDOM = mods[1], entry = mods[2], tooltip = mods[3];
    var name = plan.entry.exportName;
    var Comp;
    if (name.charAt(0) === "?") {
      // export * wrapper: the export named after the file, else the first
      // thing that looks like a component (function or memo/forwardRef).
      var isComp = function (k) {
        var v = entry[k];
        return /^[A-Z]/.test(k) && !/(Context|Provider|Props|Variants)$/.test(k) &&
          (typeof v === "function" || (v && typeof v === "object" && v.$$typeof));
      };
      name = isComp(name.slice(1)) ? name.slice(1) : Object.keys(entry).filter(isComp)[0];
      Comp = name ? entry[name] : null;
    } else {
      Comp = entry[name];
    }
    if (name === "default" && Comp && Comp.default && typeof Comp !== "function") Comp = Comp.default;
    if (!Comp) throw new Error("Export " + plan.entry.exportName + " not found in " + plan.entry.moduleId);
    var h = React.createElement;
    class Boundary extends React.Component {
      constructor(p) { super(p); this.state = { error: null }; }
      static getDerivedStateFromError(error) { return { error: error }; }
      componentDidCatch(error) { report("error", (error && error.message) || String(error)); }
      render() { return this.state.error ? null : this.props.children; }
    }
    var el = document.getElementById("__rp_root");
    var tree = h(Boundary, null, h(Comp, null));
    if (tooltip && tooltip.TooltipProvider) tree = h(tooltip.TooltipProvider, null, tree);
    if (plan.layout === "centered") {
      tree = h("div", { style: { minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px", boxSizing: "border-box" } },
        h("div", { style: { width: "100%", maxWidth: "960px", display: "flex", justifyContent: "center" } }, tree));
    }
    ReactDOM.createRoot(el).render(tree);
    setTimeout(function () {
      if (reported) return;
      var fatal = errors.filter(function (m) { return !BENIGN.test(m); });
      if (fatal.length) return report("error", fatal[0]);
      var rendered = el.querySelector("*:not(div:empty)") || (el.textContent || "").trim();
      if (!rendered) return report("error", "The component rendered nothing on its own.");
      report("ok");
    }, cfg.settleMs);
  }).catch(function (e) {
    var msg = (e && e.message) || String(e);
    var miss = msg.match(/module '(missing:[^']+)'/);
    report("error", miss ? "Missing module: " + (missing[miss[1]] || miss[1]) : msg);
  });
})();`;
