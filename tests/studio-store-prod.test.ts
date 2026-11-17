// lib/studio - projects people build in their studio: where a project came
// from (kept as an MIT credit), the version-history rule, and the
// browser-side store used when signed out (and as history when signed in).

import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { nextVersions, VERSION_EVERY_MS, MAX_VERSIONS } from "@/lib/studio/versions";
import { originCredit, originFromCredits, originHref } from "@/lib/studio/origin";
import { localCreate, localDelete, localGet, localList, localSave } from "@/lib/studio/local-store";

describe("nextVersions", () => {
  const t0 = 1_000_000;
  it("keeps the previous code as a version when it changed and enough time passed", () => {
    const v1 = nextVersions([], { source: "a", stack: "html" }, { source: "b", stack: "html" }, t0);
    expect(v1).toEqual([{ source: "a", stack: "html", at: t0 }]);
    const v2 = nextVersions(v1, { source: "b", stack: "html" }, { source: "c", stack: "html" }, t0 + 1000);
    expect(v2).toHaveLength(1);
    const v3 = nextVersions(v1, { source: "b", stack: "html" }, { source: "c", stack: "html" }, t0 + VERSION_EVERY_MS + 1);
    expect(v3.map((v) => v.source)).toEqual(["b", "a"]);
  });
  it("does nothing when the code didn't change, and caps the history", () => {
    expect(nextVersions([], { source: "a", stack: "html" }, { source: "a", stack: "html" }, t0)).toEqual([]);
    let vs: ReturnType<typeof nextVersions> = [];
    for (let i = 0; i < MAX_VERSIONS + 5; i++) {
      vs = nextVersions(vs, { source: `s${i}`, stack: "jsx" }, { source: `s${i + 1}`, stack: "jsx" }, t0 + i * (VERSION_EVERY_MS + 1));
    }
    expect(vs).toHaveLength(MAX_VERSIONS);
    expect(vs[0].source).toBe(`s${MAX_VERSIONS + 4}`);
  });
});

describe("origin credits", () => {
  it("round-trips an origin through the page credits", () => {
    const credit = originCredit({ type: "dashboard", id: "sb-admin-2/tables.html", title: "SB Admin 2 - Tables", license: "MIT", sourceUrl: "https://github.com/a/b" });
    expect(credit).toEqual({ id: "dashboard:sb-admin-2/tables.html", title: "SB Admin 2 - Tables", sourceUrl: "https://github.com/a/b", license: "MIT" });
    expect(originFromCredits([credit])).toEqual({ type: "dashboard", id: "sb-admin-2/tables.html", title: "SB Admin 2 - Tables", license: "MIT", sourceUrl: "https://github.com/a/b" });
    expect(originFromCredits([{ id: "@magicui/marquee", title: "x", sourceUrl: null, license: "MIT" }])).toBeNull();
    expect(originFromCredits([])).toBeNull();
  });
  it("links back to where a project started", () => {
    expect(originHref({ type: "template", id: "3-saas-dark" })).toBe("/t/3-saas-dark");
    expect(originHref({ type: "dashboard", id: "sb-admin-2/tables.html" })).toBe("/d/sb-admin-2");
    expect(originHref({ type: "component", id: "@magicui/marquee" })).toBe("/c/%40magicui/marquee");
    expect(originHref({ type: "community", id: "0d9e" })).toBe("/p/0d9e");
    expect(originHref({ type: "paste" })).toBeNull();
  });
});

describe("local store (signed out)", () => {
  it("creates, lists newest first, saves with history and deletes", async () => {
    const a = await localCreate({ title: "First", stack: "html", source: "<p>a</p>", origin: { type: "blank" } });
    expect(a.id.startsWith("local-")).toBe(true);
    expect(a.local).toBe(true);
    expect(a.status).toBe("draft");
    const b = await localCreate({ title: "Second", stack: "jsx", source: "export default () => null", origin: null });
    const list = await localList();
    expect(list.map((p) => p.id).slice(0, 2)).toEqual([b.id, a.id]);

    const saved = await localSave(a.id, { source: "<p>b</p>" });
    expect(saved?.source).toBe("<p>b</p>");
    expect(saved?.versions.map((v) => v.source)).toEqual(["<p>a</p>"]);
    expect((await localGet(a.id))?.updatedAt).toBeGreaterThanOrEqual(a.updatedAt);

    await localDelete(a.id);
    expect(await localGet(a.id)).toBeNull();
    expect(await localSave("local-missing", { source: "x" })).toBeNull();
  });
});
