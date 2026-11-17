// Runs first in every demo page. Demos are served with a CSP sandbox, so
// they get an opaque origin: localStorage, sessionStorage, document.cookie
// and navigator.serviceWorker throw, and plenty of dashboards touch them at
// startup (theme toggles, sidebar state). This swaps in working in-memory
// versions, persisted in window.name so a setting survives the demo's own
// page loads. It also keeps clicks inside the demo, sends external links to
// a new tab, reports the current page to the gallery frame, and takes
// back/forward/reload commands from it.
//
// Plain ES5 inside a template string: no backticks, no "${" except the
// config splice.

export interface DemoShimConfig {
  slug: string;
  kind: "static" | "build";
  entry: string;
}

export function demoShimSource(cfg: DemoShimConfig): string {
  const json = JSON.stringify({ slug: cfg.slug, kind: cfg.kind, entry: cfg.entry }).replace(/</g, "\\u003c");
  return String.raw`(function () {
  var CFG = ${json};
  var w = window, d = document, KEY = "__aimdemo:", HAS = Object.prototype.hasOwnProperty;
  var state = { l: {}, s: {}, c: {} };
  try {
    var n = w.name;
    if (typeof n === "string" && n.indexOf(KEY) === 0) {
      var p = JSON.parse(n.slice(KEY.length));
      if (p && typeof p === "object") { state.l = p.l || {}; state.s = p.s || {}; state.c = p.c || {}; }
    }
  } catch (e) {}
  function save() { try { w.name = KEY + JSON.stringify(state); } catch (e) {} }

  function makeStorage(bucket) {
    var o = state[bucket];
    var api = {
      getItem: function (k) { k = String(k); return HAS.call(o, k) ? o[k] : null; },
      setItem: function (k, v) { o[String(k)] = String(v); save(); },
      removeItem: function (k) { delete o[String(k)]; save(); },
      clear: function () { for (var k in o) { if (HAS.call(o, k)) delete o[k]; } save(); },
      key: function (i) { var ks = Object.keys(o); return i >= 0 && i < ks.length ? ks[i] : null; }
    };
    if (typeof Proxy !== "function") {
      Object.defineProperty(api, "length", { get: function () { return Object.keys(o).length; } });
      return api;
    }
    // Real Storage also answers localStorage.theme = "dark" style access.
    return new Proxy(o, {
      get: function (t, k) {
        if (k === "length") return Object.keys(o).length;
        if (HAS.call(api, k)) return api[k];
        if (typeof k === "string" && HAS.call(o, k)) return o[k];
        return undefined;
      },
      set: function (t, k, v) { if (typeof k === "string" && !HAS.call(api, k)) api.setItem(k, v); return true; },
      has: function (t, k) { return HAS.call(api, k) || HAS.call(o, k); },
      deleteProperty: function (t, k) { api.removeItem(k); return true; },
      ownKeys: function () { return Object.keys(o); },
      getOwnPropertyDescriptor: function (t, k) {
        return HAS.call(o, k) ? { value: o[k], writable: true, enumerable: true, configurable: true } : undefined;
      }
    });
  }
  function broken(name) {
    try { var s = w[name]; s.setItem("__aimdemo_probe", "1"); s.removeItem("__aimdemo_probe"); return false; }
    catch (e) { return true; }
  }
  if (broken("localStorage")) { try { Object.defineProperty(w, "localStorage", { value: makeStorage("l"), configurable: true }); } catch (e) {} }
  if (broken("sessionStorage")) { try { Object.defineProperty(w, "sessionStorage", { value: makeStorage("s"), configurable: true }); } catch (e) {} }

  var cookieBroken = false;
  try { void d.cookie; } catch (e) { cookieBroken = true; }
  if (cookieBroken) {
    try {
      Object.defineProperty(d, "cookie", {
        configurable: true,
        get: function () { var out = []; for (var k in state.c) { if (HAS.call(state.c, k)) out.push(k + "=" + state.c[k]); } return out.join("; "); },
        set: function (v) {
          var str = String(v), first = str.split(";")[0], i = first.indexOf("=");
          if (i <= 0) return;
          var k = first.slice(0, i).trim();
          if (/;\s*max-age\s*=\s*(0|-\d+)\s*(;|$)/i.test(str) || /;\s*expires\s*=[^;]*1970/i.test(str)) delete state.c[k];
          else state.c[k] = first.slice(i + 1).trim();
          save();
        }
      });
    } catch (e) {}
  }
  try { void w.caches; } catch (e) {
    try {
      var none = function () { return Promise.resolve(undefined); };
      Object.defineProperty(w, "caches", { configurable: true, value: {
        open: function () { return Promise.resolve({ match: none, matchAll: function () { return Promise.resolve([]); }, add: none, addAll: none, put: none, delete: function () { return Promise.resolve(false); }, keys: function () { return Promise.resolve([]); } }); },
        match: none, has: function () { return Promise.resolve(false); }, delete: function () { return Promise.resolve(false); }, keys: function () { return Promise.resolve([]); }
      } });
    } catch (e2) {}
  }
  // Always stubbed: in the opaque origin registration fails (or throws), and a
  // registered worker would outlive the demo anyway.
  {
    try {
      var never = new Promise(function () {});
      Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: {
        register: function () { return never; }, getRegistration: function () { return Promise.resolve(undefined); },
        getRegistrations: function () { return Promise.resolve([]); }, ready: never, controller: null,
        addEventListener: function () {}, removeEventListener: function () {}
      } });
    } catch (e2) {}
  }

  // Built apps sometimes hard-code assets at the site root ("/avatars/01.png",
  // "/fonts/x.css") instead of under their base path, so on our site they'd
  // hit the gallery, not the demo. Keep those URLs inside the demo: the demo
  // route serves the file or redirects it to jsDelivr.
  var ROOT = "/demos/" + CFG.slug + "/";
  function inDemo(v) {
    if (typeof v !== "string" || v.charAt(0) !== "/" || v.charAt(1) === "/" || v.indexOf("/demos/") === 0) return v;
    return ROOT + v.slice(1);
  }
  function inDemoSet(v) {
    // A data: URI's own commas would be split apart: leave those alone.
    return typeof v === "string" && v.indexOf("data:") === -1 ? v.split(",").map(function (c) { var t = c.replace(/^\s+/, ""); return c.slice(0, c.length - t.length) + inDemo(t); }).join(",") : v;
  }
  var MEDIA = { IMG: 1, SOURCE: 1, VIDEO: 1, AUDIO: 1, TRACK: 1 };
  function fixValue(el, name, v) {
    var tag = String(el.tagName || "").toUpperCase();
    name = String(name).toLowerCase();
    if (MEDIA[tag] && (name === "src" || name === "poster")) return inDemo(v);
    if (MEDIA[tag] && name === "srcset") return inDemoSet(v);
    if (tag === "LINK" && name === "href") return inDemo(v);
    return v;
  }
  try {
    var sa = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, v) { return sa.call(this, name, fixValue(this, name, v)); };
    var props = [[w.HTMLImageElement, "src"], [w.HTMLImageElement, "srcset"], [w.HTMLSourceElement, "src"], [w.HTMLSourceElement, "srcset"], [w.HTMLMediaElement, "src"], [w.HTMLVideoElement, "poster"], [w.HTMLLinkElement, "href"]];
    for (var pi = 0; pi < props.length; pi++) {
      (function (C, name) {
        if (!C) return;
        var desc = Object.getOwnPropertyDescriptor(C.prototype, name);
        if (!desc || !desc.set || !desc.configurable) return;
        Object.defineProperty(C.prototype, name, {
          configurable: true, enumerable: desc.enumerable, get: desc.get,
          set: function (v) { desc.set.call(this, fixValue(this, name, v)); }
        });
      })(props[pi][0], props[pi][1]);
    }
  } catch (e) {}

  // <use href="sprite.svg#id"> is cross-origin from an opaque origin, so
  // browsers refuse it. Fetch each sprite once (CORS is open), inline it, and
  // point the icons at the inlined symbols.
  var sprites = {};
  function inlineSprites(root) {
    var uses = (root || d).querySelectorAll ? (root || d).querySelectorAll("use") : [];
    for (var i = 0; i < uses.length; i++) {
      (function (u) {
        var attr = u.hasAttribute("href") ? "href" : u.hasAttribute("xlink:href") ? "xlink:href" : null;
        if (!attr) return;
        var ref = u.getAttribute(attr) || "";
        var hash = ref.indexOf("#");
        if (hash <= 0) return;
        var file = new URL(ref.slice(0, hash), location.href).href;
        var id = ref.slice(hash);
        if (!sprites[file]) {
          sprites[file] = w.fetch(file).then(function (r) { return r.ok ? r.text() : ""; }).then(function (text) {
            if (!text) return;
            var holder = d.createElement("div");
            holder.setAttribute("aria-hidden", "true");
            holder.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
            holder.innerHTML = text;
            (d.body || d.documentElement).appendChild(holder);
          }).catch(function () {});
        }
        sprites[file].then(function () { u.setAttribute(attr, id); });
      })(uses[i]);
    }
  }
  d.addEventListener("DOMContentLoaded", function () {
    inlineSprites(d);
    if (typeof MutationObserver === "function") {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          for (var j = 0; j < muts[i].addedNodes.length; j++) {
            var n = muts[i].addedNodes[j];
            if (n.nodeType === 1) inlineSprites(n.tagName && n.tagName.toLowerCase() === "use" ? n.parentNode : n);
          }
        }
      }).observe(d.documentElement, { childList: true, subtree: true });
    }
  });

  var prefix = "/demos/" + CFG.slug + "/";
  d.addEventListener("click", function (ev) {
    var a = ev.target;
    while (a && a.nodeType === 1 && String(a.tagName).toUpperCase() !== "A") a = a.parentNode;
    if (!a || a.nodeType !== 1) return;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#" || /^(javascript|mailto|tel|data|blob|sms):/i.test(href)) return;
    var url;
    try { url = new URL(href, location.href); } catch (e) { return; }
    var tgt = String(a.getAttribute("target") || "").toLowerCase();
    if (url.host !== location.host) {
      if (!tgt || tgt === "_self" || tgt === "_top" || tgt === "_parent") { ev.preventDefault(); w.open(url.href, "_blank", "noopener"); }
      return;
    }
    if (url.pathname.indexOf(prefix) !== 0 && url.pathname + "/" !== prefix && CFG.kind === "static") {
      var path = url.pathname === "/" ? CFG.entry : url.pathname.slice(1);
      a.setAttribute("href", prefix + path + url.search + url.hash);
    }
    if (tgt === "_top" || tgt === "_parent") a.setAttribute("target", "_self");
  }, true);

  if (w.parent !== w) {
    var report = function () {
      try {
        var pth = location.pathname;
        w.parent.postMessage({ __aimDemo: true, type: "demo:location", slug: CFG.slug,
          path: (pth.indexOf(prefix) === 0 ? pth.slice(prefix.length) : pth + "/" === prefix ? "" : pth) + location.search + location.hash,
          title: d.title }, "*");
      } catch (e) {}
    };
    w.addEventListener("DOMContentLoaded", report);
    w.addEventListener("load", report);
    w.addEventListener("popstate", report);
    w.addEventListener("hashchange", report);
    var hp = history.pushState, hr = history.replaceState;
    history.pushState = function () { var r = hp.apply(this, arguments); setTimeout(report, 0); return r; };
    history.replaceState = function () { var r = hr.apply(this, arguments); setTimeout(report, 0); return r; };
    w.addEventListener("message", function (ev) {
      if (ev.source !== w.parent || !ev.data || ev.data.__aimDemoCmd === undefined) return;
      var c = ev.data.__aimDemoCmd;
      if (c === "back") history.back();
      else if (c === "forward") history.forward();
      else if (c === "reload") location.reload();
    });
  }
})();`;
}
