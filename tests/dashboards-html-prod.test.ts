// lib/dashboards/html.ts + shim.ts - every demo HTML page is rewritten at
// serve time: storage shim first in <head>, trackers out, and (for static
// sites) root-relative links kept inside /demos/<slug>/.

import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { transformDemoHtml, BASE_STYLE_MARKER, SHIM_MARKER } from "@/lib/dashboards/html";
import { demoShimSource } from "@/lib/dashboards/shim";

const opts = { slug: "sb-admin-2", kind: "static" as const, entry: "index.html" };

describe("transformDemoHtml - shim placement", () => {
  it("puts the shim first inside <head>, before any other script", () => {
    const out = transformDemoHtml(
      '<!doctype html><html lang="en"><head class="x"><meta charset="utf-8"><script src="js/app.js"></script></head><body></body></html>',
      opts,
    );
    const head = out.indexOf('<head class="x">');
    const shim = out.indexOf(SHIM_MARKER);
    const app = out.indexOf('src="js/app.js"');
    expect(head).toBeGreaterThan(-1);
    expect(shim).toBeGreaterThan(head);
    expect(shim).toBeLessThan(app);
    expect(out.slice(head + '<head class="x">'.length).startsWith("<script")).toBe(true);
  });

  it("works without <head> and without <html>", () => {
    const noHead = transformDemoHtml("<html><body>hi</body></html>", opts);
    expect(noHead.indexOf(SHIM_MARKER)).toBeGreaterThan(noHead.indexOf("<html>"));
    expect(noHead.indexOf(SHIM_MARKER)).toBeLessThan(noHead.indexOf("<body>"));
    const bare = transformDemoHtml("<p>hi</p>", opts);
    expect(bare.indexOf(SHIM_MARKER)).toBeLessThan(bare.indexOf("<p>"));
  });

  it("is idempotent", () => {
    const once = transformDemoHtml('<html><head></head><body><a href="/x.html">x</a></body></html>', opts);
    expect(transformDemoHtml(once, opts)).toBe(once);
  });
});

describe("transformDemoHtml - default font", () => {
  const page = '<html><head><link rel="stylesheet" href="app.css"><style>body{color:red}</style></head><body></body></html>';

  it("gives the dashboards that set no font a sans-serif any page rule overrides", () => {
    const out = transformDemoHtml(page, { ...opts, slug: "geeker-admin" });
    const base = out.indexOf(BASE_STYLE_MARKER);
    // After the shim (which must stay first) and before the page's own styles.
    expect(base).toBeGreaterThan(out.indexOf(SHIM_MARKER));
    expect(base).toBeLessThan(out.indexOf('href="app.css"'));
    // In a cascade layer of its own, declared first: the lowest priority
    // there is. Unlayered, it would beat every font a Tailwind v4 dashboard
    // sets inside "@layer base".
    expect(out).toMatch(/<style data-aim-demo-base>@layer aim-demo-base\{:where\(html\)\{font-family:[^}]*sans-serif\}\}<\/style>/);
    expect(out.split(BASE_STYLE_MARKER)).toHaveLength(2);
  });

  it("leaves every other dashboard's page exactly as it was", () => {
    expect(transformDemoHtml(page, opts)).not.toContain(BASE_STYLE_MARKER);
    expect(transformDemoHtml(page, { ...opts, slug: "nuxt-ui-dashboard" })).not.toContain(BASE_STYLE_MARKER);
  });
});

describe("transformDemoHtml - trackers", () => {
  it("removes Google tag, Analytics, Tag Manager, Hotjar, Clarity and ad scripts", () => {
    const html = `<html><head>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-1"></script>
<script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-1');</script>
<script>(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r})(window,document,'script','https://www.google-analytics.com/analytics.js','ga'); ga('create','UA-1','auto');</script>
<script>(function(h,o,t,j,a,r){h.hj=h.hj||function(){};a.src='https://static.hotjar.com/c/hotjar-'+h._hjSettings.hjid+'.js'})(window,document);</script>
<script type="text/javascript">(function(c,l,a,r,i,t,y){})(window, document, "clarity", "script", "abc"); // https://www.clarity.ms/tag/</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>
<script async type="text/javascript" src="//cdn.carbonads.com/carbon.js?serve=X" id="_carbonads_js"></script>
<script src="js/keep-me.js"></script>
<script>console.log("keep me too")</script>
</head><body><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-1" height="0" width="0"></iframe></noscript></body></html>`;
    const out = transformDemoHtml(html, opts);
    for (const gone of ["googletagmanager", "google-analytics", "hotjar", "clarity", "googlesyndication", "carbonads", "gtag("]) {
      expect(out).not.toContain(gone);
    }
    expect(out).toContain('src="js/keep-me.js"');
    expect(out).toContain('console.log("keep me too")');
  });
});

describe("transformDemoHtml - framework data scripts", () => {
  it("never strips Next.js page data even when it mentions gtag", () => {
    const html = '<html><head></head><body><script>self.__next_f.push([1,"gtag(\'config\')"])</script><script id="__NEXT_DATA__" type="application/json">{"gtag(":1}</script></body></html>';
    const out = transformDemoHtml(html, { slug: "x", kind: "build", entry: "index.html" });
    expect(out).toContain("self.__next_f.push");
    expect(out).toContain("__NEXT_DATA__");
  });
});

describe("transformDemoHtml - root-relative links", () => {
  it("prefixes root-relative href/src/srcset/action/poster for static sites", () => {
    const out = transformDemoHtml(
      `<html><head><link href="/css/a.css" rel="stylesheet"></head><body>
<a href="/">home</a><a href="/pages/">pages</a><a href='/x.html?y=1#z'>x</a>
<img src="/img/a.png" srcset="/img/a.png 1x, /img/a@2x.png 2x"><form action="/login"></form><video poster="/p.jpg"></video>
<a href="//cdn.example.com/a.js">cdn</a><a href="https://example.com/">abs</a><a href="rel.html">rel</a><a href="#top">hash</a>
</body></html>`,
      opts,
    );
    expect(out).toContain('href="/demos/sb-admin-2/css/a.css"');
    expect(out).toContain('href="/demos/sb-admin-2/index.html"');
    expect(out).toContain('href="/demos/sb-admin-2/pages/index.html"');
    expect(out).toContain("href='/demos/sb-admin-2/x.html?y=1#z'");
    expect(out).toContain('src="/demos/sb-admin-2/img/a.png"');
    expect(out).toContain('srcset="/demos/sb-admin-2/img/a.png 1x, /demos/sb-admin-2/img/a@2x.png 2x"');
    expect(out).toContain('action="/demos/sb-admin-2/login"');
    expect(out).toContain('poster="/demos/sb-admin-2/p.jpg"');
    expect(out).toContain('href="//cdn.example.com/a.js"');
    expect(out).toContain('href="https://example.com/"');
    expect(out).toContain('href="rel.html"');
    expect(out).toContain('href="#top"');
  });

  it("leaves links alone for built sites (they were built for /demos/<slug>/)", () => {
    const html = '<html><head></head><body><a href="/demos/x/settings">s</a><img src="/logo.svg"></body></html>';
    const out = transformDemoHtml(html, { slug: "x", kind: "build", entry: "index.html" });
    expect(out).toContain('href="/demos/x/settings"');
    expect(out).toContain('src="/logo.svg"');
  });
});

describe("demo shim in an opaque origin", () => {
  function opaqueWindow(name = "") {
    // jsdom without a URL is about:blank, an opaque origin: localStorage throws.
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
      runScripts: "outside-only",
    });
    dom.window.name = name;
    return dom.window;
  }

  it("throws before the shim (so the test exercises the real case)", () => {
    const w = opaqueWindow();
    expect(() => w.localStorage).toThrow();
  });

  it("replaces localStorage/sessionStorage with working in-memory storage", () => {
    const w = opaqueWindow();
    w.eval(demoShimSource({ slug: "x", kind: "static", entry: "index.html" }));
    w.localStorage.setItem("theme", "dark");
    expect(w.localStorage.getItem("theme")).toBe("dark");
    expect(w.localStorage.length).toBe(1);
    expect(w.localStorage.key(0)).toBe("theme");
    w.sessionStorage.setItem("s", "1");
    w.localStorage.removeItem("theme");
    expect(w.localStorage.getItem("theme")).toBeNull();
    expect(w.sessionStorage.getItem("s")).toBe("1");
  });

  it("keeps stored values across the demo's own page loads via window.name", () => {
    const first = opaqueWindow();
    first.eval(demoShimSource({ slug: "x", kind: "static", entry: "index.html" }));
    first.localStorage.setItem("sidebar", "collapsed");
    const second = opaqueWindow(first.name);
    second.eval(demoShimSource({ slug: "x", kind: "static", entry: "index.html" }));
    expect(second.localStorage.getItem("sidebar")).toBe("collapsed");
  });

  it("always stubs service-worker registration (demos can't keep one)", async () => {
    const w = opaqueWindow();
    w.eval(demoShimSource({ slug: "x", kind: "static", entry: "index.html" }));
    const sw = (w.navigator as unknown as { serviceWorker: { register: () => Promise<unknown> } }).serviceWorker;
    expect(typeof sw.register).toBe("function");
    expect(sw.register()).toBeInstanceOf(w.Promise);
  });

  it("inlines external SVG sprites so <use> icons render in the opaque origin", async () => {
    const dom = new JSDOM(
      '<!doctype html><html><head></head><body><svg><use href="icons/sprite.svg#home"></use></svg><svg><use xlink:href="icons/sprite.svg#user"></use></svg></body></html>',
      { runScripts: "outside-only", url: "http://localhost/demos/x/index.html" },
    );
    const w = dom.window as unknown as { fetch: () => Promise<unknown> };
    let calls = 0;
    w.fetch = async () => {
      calls++;
      return { ok: true, text: async () => '<svg xmlns="http://www.w3.org/2000/svg"><symbol id="home"></symbol><symbol id="user"></symbol></svg>' };
    };
    dom.window.eval(demoShimSource({ slug: "x", kind: "static", entry: "index.html" }));
    dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
    await new Promise((r) => setTimeout(r, 30));
    const uses = Array.from(dom.window.document.querySelectorAll("use"));
    expect(uses.map((u) => u.getAttribute("href") ?? u.getAttribute("xlink:href"))).toEqual(["#home", "#user"]);
    expect(dom.window.document.getElementById("home")).not.toBeNull();
    expect(calls).toBe(1);
  });

  it("stubs Cache Storage when the sandbox forbids it", async () => {
    const w = opaqueWindow();
    Object.defineProperty(w, "caches", { configurable: true, get() { throw new Error("SecurityError"); } });
    w.eval(demoShimSource({ slug: "x", kind: "static", entry: "index.html" }));
    const c = (w as unknown as { caches: { keys: () => Promise<unknown[]> } }).caches;
    expect(await c.keys()).toEqual([]);
  });

  it("ignores a window.name that isn't the shim's", () => {
    const w = opaqueWindow("some-frame-name");
    w.eval(demoShimSource({ slug: "x", kind: "static", entry: "index.html" }));
    expect(w.localStorage.getItem("anything")).toBeNull();
  });
});

describe("rewriteMetaRefresh", () => {
  it("keeps root-absolute meta refresh redirects inside the demo", async () => {
    const { rewriteMetaRefresh } = await import("@/lib/dashboards/html");
    const opts = { slug: "nuxt-shadcn-dashboard", kind: "build" as const, entry: "index.html" };
    expect(rewriteMetaRefresh(`<meta http-equiv="refresh" content="0; url=/settings/profile">`, opts)).toBe(
      `<meta http-equiv="refresh" content="0; url=/demos/nuxt-shadcn-dashboard/settings/profile">`,
    );
    // Already inside, relative, external and protocol-relative targets are left alone.
    for (const html of [
      `<meta http-equiv="refresh" content="0; url=/demos/nuxt-shadcn-dashboard/x">`,
      `<meta http-equiv="refresh" content="0; url=settings/profile">`,
      `<meta http-equiv="refresh" content="5; url=https://example.com/">`,
      `<meta http-equiv="refresh" content="0; url=//cdn.example.com/x">`,
      `<meta name="description" content="0; url=/x">`,
    ]) {
      expect(rewriteMetaRefresh(html, opts)).toBe(html);
    }
  });
});
