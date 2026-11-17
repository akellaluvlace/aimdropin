// Pure helpers behind the dashboard page: the code view's file tree and
// language detection, demo/download URLs, and the HTML handed to the
// playground when someone edits one page of a dashboard.

import { describe, it, expect } from "vitest";
import { buildFileTree, languageForPath, isBinaryPath, defaultOpenFile } from "@/lib/dashboards/tree";
import { editablePageHtml } from "@/lib/dashboards/html";
import { demoPageUrl, zipUrl, rawFileUrl } from "@/lib/dashboards/urls";

describe("buildFileTree", () => {
  it("nests folders first, then files, alphabetically", () => {
    const tree = buildFileTree([
      ["index.html", 10],
      ["css/style.css", 5],
      ["README.md", 3],
      ["css/vendor/a.css", 1],
      ["assets/img/logo.png", 99],
    ]);
    expect(tree.map((n) => n.name)).toEqual(["assets", "css", "index.html", "README.md"]);
    const css = tree.find((n) => n.name === "css");
    expect(css?.kind).toBe("dir");
    expect(css && css.kind === "dir" ? css.children.map((n) => n.name) : []).toEqual(["vendor", "style.css"]);
    const file = tree.find((n) => n.name === "index.html");
    expect(file).toEqual({ kind: "file", name: "index.html", path: "index.html", size: 10 });
  });
});

describe("languageForPath / isBinaryPath", () => {
  it("maps common extensions to Monaco languages", () => {
    expect(languageForPath("a/b.tsx")).toBe("typescript");
    expect(languageForPath("x.jsx")).toBe("javascript");
    expect(languageForPath("x.html")).toBe("html");
    expect(languageForPath("x.scss")).toBe("scss");
    expect(languageForPath("x.json")).toBe("json");
    expect(languageForPath("x.vue")).toBe("html");
    expect(languageForPath("Makefile")).toBe("plaintext");
  });

  it("recognises binary files", () => {
    for (const p of ["a.png", "b.woff2", "c.ico", "d.zip", "e.mp4", "f.pdf"]) expect(isBinaryPath(p)).toBe(true);
    for (const p of ["a.svg", "b.css", "README"]) expect(isBinaryPath(p)).toBe(false);
  });
});

describe("defaultOpenFile", () => {
  it("prefers the README, then the entry page, then the first file", () => {
    expect(defaultOpenFile([["src/a.ts", 1], ["README.md", 2]], "index.html")).toBe("README.md");
    expect(defaultOpenFile([["src/a.ts", 1], ["index.html", 2]], "index.html")).toBe("index.html");
    expect(defaultOpenFile([["src/a.ts", 1]], "index.html")).toBe("src/a.ts");
    expect(defaultOpenFile([], "index.html")).toBeNull();
  });
});

describe("dashboard URLs", () => {
  const d = { slug: "sb-admin-2", spa: false, entry: "index.html", repo: "StartBootstrap/startbootstrap-sb-admin-2", sha: "f".repeat(40) };
  it("points static demos at their entry page and SPAs at the root", () => {
    expect(demoPageUrl(d)).toBe("/demos/sb-admin-2/index.html");
    expect(demoPageUrl(d, "tables.html")).toBe("/demos/sb-admin-2/tables.html");
    expect(demoPageUrl({ ...d, spa: true })).toBe("/demos/sb-admin-2/");
    expect(demoPageUrl({ ...d, spa: true }, "settings/account")).toBe("/demos/sb-admin-2/settings/account");
  });
  it("downloads the original repo at the pinned commit", () => {
    expect(zipUrl(d)).toBe(`https://codeload.github.com/StartBootstrap/startbootstrap-sb-admin-2/zip/${"f".repeat(40)}`);
    expect(rawFileUrl(d, "css/sb admin.css")).toBe(
      `https://raw.githubusercontent.com/StartBootstrap/startbootstrap-sb-admin-2/${"f".repeat(40)}/css/sb%20admin.css`,
    );
  });
});

describe("editablePageHtml", () => {
  const opts = { slug: "sb-admin-2", kind: "static" as const, entry: "index.html" };
  it("adds a base pointing at the page's folder so relative assets still load", () => {
    const out = editablePageHtml('<html><head><title>x</title></head><body><img src="img/a.png"></body></html>', "pages/tables.html", opts);
    expect(out).toContain('<head><base href="/demos/sb-admin-2/pages/">');
    expect(out).toContain('src="img/a.png"');
  });
  it("keeps root-relative links inside the demo, drops trackers, adds no shim", () => {
    const out = editablePageHtml(
      '<html><head><script async src="https://www.googletagmanager.com/gtag/js?id=G-1"></script><link href="/css/a.css" rel="stylesheet"></head><body></body></html>',
      "index.html",
      opts,
    );
    expect(out).toContain('href="/demos/sb-admin-2/css/a.css"');
    expect(out).not.toContain("googletagmanager");
    expect(out).not.toContain("data-aim-demo-shim");
    expect(out).toContain('<base href="/demos/sb-admin-2/">');
  });
  it("replaces an existing <base> instead of adding a second one", () => {
    const out = editablePageHtml('<html><head><base href="./"></head><body></body></html>', "index.html", opts);
    expect(out.match(/<base\b/g)).toHaveLength(1);
  });
});
