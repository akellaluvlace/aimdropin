// scripts/dashboards/manifest.mjs - the gate every dashboard source passes
// before the pipeline downloads anything.

import { describe, it, expect } from "vitest";
import { validateSources } from "../scripts/dashboards/manifest.mjs";

const SHA = "f0309881ef2fe0e6b9e0f0b4f1b5f6c2d8a9b7c1";

function staticSource(over: Record<string, unknown> = {}) {
  return {
    slug: "sb-admin-2",
    title: "SB Admin 2",
    description: "Bootstrap 4 admin with charts and tables.",
    repo: "StartBootstrap/startbootstrap-sb-admin-2",
    sha: SHA,
    license: { spdx: "MIT", path: "LICENSE", verifiedAt: "2026-11-10" },
    author: "Start Bootstrap",
    framework: "html",
    ui: "bootstrap",
    category: "Admin",
    tags: ["bootstrap4"],
    quality: 3,
    site: { kind: "static", root: ".", entry: "index.html" },
    ...over,
  };
}

function buildSource(over: Record<string, unknown> = {}) {
  return staticSource({
    slug: "shadcn-admin",
    title: "Shadcn Admin",
    repo: "satnaing/shadcn-admin",
    framework: "react",
    ui: "shadcn",
    site: {
      kind: "build",
      image: "node:22",
      install: "pnpm install --frozen-lockfile",
      build: "pnpm vite build --base=$DEMO_BASE",
      out: "dist",
      entry: "index.html",
      spa: true,
    },
    ...over,
  });
}

describe("validateSources", () => {
  it("accepts a static source and a build source", () => {
    const r = validateSources([staticSource(), buildSource()]);
    expect(r.errors).toEqual([]);
    expect(r.ok.map((s) => s.slug)).toEqual(["sb-admin-2", "shadcn-admin"]);
  });

  it("rejects licenses outside the permissive allowlist", () => {
    for (const spdx of ["GPL-3.0", "CC-BY-4.0", "MIT-Commons-Clause", "", undefined]) {
      const r = validateSources([
        staticSource({ license: { spdx, path: "LICENSE", verifiedAt: "2026-11-10" } }),
      ]);
      expect(r.ok).toEqual([]);
      expect(r.errors.join("\n")).toMatch(/sb-admin-2: license/);
    }
  });

  it("requires a verified date and a license path", () => {
    const r = validateSources([
      staticSource({ license: { spdx: "MIT", path: "", verifiedAt: "yesterday" } }),
    ]);
    expect(r.ok).toEqual([]);
    expect(r.errors.join("\n")).toMatch(/license path/);
    expect(r.errors.join("\n")).toMatch(/verifiedAt/);
  });

  it("requires a full 40-character commit sha", () => {
    for (const sha of ["main", SHA.slice(0, 10), SHA.toUpperCase().replace(/F/g, "G")]) {
      const r = validateSources([staticSource({ sha })]);
      expect(r.ok).toEqual([]);
      expect(r.errors.join("\n")).toMatch(/sha/);
    }
  });

  it("rejects bad and duplicate slugs", () => {
    const bad = validateSources([staticSource({ slug: "SB Admin" })]);
    expect(bad.errors.join("\n")).toMatch(/slug/);
    const dup = validateSources([staticSource(), staticSource()]);
    expect(dup.ok).toHaveLength(1);
    expect(dup.errors.join("\n")).toMatch(/duplicate slug sb-admin-2/);
  });

  it("rejects owner/name repos that aren't owner/name", () => {
    const r = validateSources([staticSource({ repo: "https://github.com/a/b" })]);
    expect(r.errors.join("\n")).toMatch(/repo/);
  });

  it("rejects build sources missing their commands or output folder", () => {
    for (const key of ["image", "install", "build", "out", "entry"]) {
      const src = buildSource();
      delete (src.site as Record<string, unknown>)[key];
      const r = validateSources([src]);
      expect(r.ok).toEqual([]);
      expect(r.errors.join("\n")).toMatch(new RegExp(`site\\.${key}`));
    }
  });

  it("accepts .sh and .mjs patches and rejects other patch names", () => {
    const withPatch = (patch: string) =>
      buildSource({ site: { ...(buildSource().site as object), patch } });
    expect(validateSources([withPatch("shadcn-admin.mjs")]).errors).toEqual([]);
    expect(validateSources([withPatch("fix.sh")]).errors).toEqual([]);
    for (const bad of ["../x.mjs", "x.js", "/abs.sh"]) {
      expect(validateSources([withPatch(bad)]).errors.join("\n")).toMatch(/site\.patch/);
    }
  });

  it("accepts a build whose output is the repo itself (install-only builds)", () => {
    const src = buildSource({ site: { ...(buildSource().site as object), out: ".", spa: false } });
    expect(validateSources([src]).errors).toEqual([]);
  });

  it("rejects site paths that climb out of the repo", () => {
    const r = validateSources([
      staticSource({ site: { kind: "static", root: "../etc", entry: "index.html" } }),
    ]);
    expect(r.errors.join("\n")).toMatch(/site\.root/);
  });

  it("sets excluded sources aside without treating them as errors", () => {
    const r = validateSources([staticSource({ exclude: "GPL-3.0 since v3" })]);
    expect(r.ok).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(r.excluded).toEqual([{ slug: "sb-admin-2", reason: "GPL-3.0 since v3" }]);
  });
});
