// Direct-import tests for the catalog indexer's pure parts:
// `scripts/catalog/license.mjs` (the license gate) and
// `scripts/catalog/classify.mjs` (kind / purpose / heavy deps / stack).

import { describe, it, expect } from "vitest";
import { checkSourceLicense, isAllowedLicense } from "../scripts/catalog/license.mjs";
import {
  classifyKind,
  classifyPurpose,
  detectHeavyDeps,
  detectStack,
  normalizeDep,
  titleFromName,
} from "../scripts/catalog/classify.mjs";
import { indexCandidates, itemUrl } from "../scripts/catalog/adapters/shadcn-registry.mjs";
import { detectFramework } from "../scripts/catalog/adapters/github-template.mjs";
import { licenseTextMatches } from "../scripts/catalog/license.mjs";

const MIT_TEXT = `MIT License

Copyright (c) 2024 Example

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...`;

const verified = {
  spdx: "MIT",
  url: "https://github.com/example/ui/blob/main/LICENSE",
  verifiedAt: "2026-10-29",
};

describe("§1 license gate - only verified, permissive licenses pass", () => {
  it("accepts the permissive allowlist", () => {
    for (const id of ["MIT", "Apache-2.0", "BSD-3-Clause", "ISC", "0BSD", "Unlicense", "CC0-1.0"]) {
      expect(isAllowedLicense(id)).toBe(true);
    }
  });

  it("rejects copyleft, attribution-only, non-commercial and custom licenses", () => {
    for (const id of ["GPL-3.0", "AGPL-3.0", "CC-BY-4.0", "CC-BY-NC-4.0", "CC-BY-SA-4.0", "custom", "none", "mit"]) {
      expect(isAllowedLicense(id)).toBe(false);
    }
  });

  it("rejects a source with no recorded license", () => {
    expect(checkSourceLicense({ license: null })).toEqual({ ok: false, reason: "no license recorded" });
  });

  it("rejects an allowlisted id that nobody verified (no URL or date)", () => {
    expect(checkSourceLicense({ license: { spdx: "MIT" } }).ok).toBe(false);
    expect(checkSourceLicense({ license: { spdx: "MIT", url: verified.url } }).ok).toBe(false);
    expect(checkSourceLicense({ license: { ...verified, url: "http://insecure.example/LICENSE" } }).ok).toBe(false);
  });

  it("passes a verified MIT source and carries freeOnly through", () => {
    const r = checkSourceLicense({ license: { ...verified, freeOnly: true } });
    expect(r).toEqual({ ok: true, license: { ...verified, freeOnly: true } });
  });
});

describe("§1b licenseTextMatches - the LICENSE file must still say what we approved", () => {
  it("matches real MIT and Apache text", () => {
    expect(licenseTextMatches("MIT", MIT_TEXT)).toBe(true);
    expect(licenseTextMatches("Apache-2.0", "Apache License\nVersion 2.0, January 2004")).toBe(true);
  });

  it("fails when the file was relicensed or mixes in other terms", () => {
    expect(licenseTextMatches("MIT", "GNU GENERAL PUBLIC LICENSE Version 3")).toBe(false);
    expect(licenseTextMatches("MIT", `${MIT_TEXT}\n\nPreline UI Fair Use License applies to...`)).toBe(false);
    expect(licenseTextMatches("MIT", `${MIT_TEXT}\n\nAssets are under Creative Commons BY-NC`)).toBe(false);
    expect(licenseTextMatches("MIT", `${MIT_TEXT}\n\n"Commons Clause" License Condition v1.0`)).toBe(false);
    expect(licenseTextMatches("Apache-2.0", MIT_TEXT)).toBe(false);
  });

  it("fails on missing text or unknown ids", () => {
    expect(licenseTextMatches("MIT", null)).toBe(false);
    expect(licenseTextMatches("GPL-3.0", "GNU GENERAL PUBLIC LICENSE")).toBe(false);
  });
});

describe("§2 classifyKind", () => {
  it("registry:page is a page only when its name says it is a screen", () => {
    expect(classifyKind({ registryType: "registry:page", name: "pricing" })).toBe("page");
    expect(classifyKind({ registryType: "registry:page", name: "saas-landing" })).toBe("page");
    expect(classifyKind({ registryType: "registry:page", name: "template-kanban-board" })).toBe("page");
  });

  it("registry:page demos and widgets are components", () => {
    expect(classifyKind({ registryType: "registry:page", name: "radial-bar-chart-example" })).toBe("component");
    expect(classifyKind({ registryType: "registry:page", name: "login-form-demo" })).toBe("component");
    expect(classifyKind({ registryType: "registry:page", name: "scroll-reveal" })).toBe("component");
  });

  it("blocks named like whole screens are pages", () => {
    for (const name of ["dashboard-01", "login-03", "template-saas-landing", "saas-landing-page", "admin"]) {
      expect(classifyKind({ registryType: "registry:block", name })).toBe("page");
    }
  });

  it("other blocks are sections", () => {
    for (const name of ["hero-section-1", "pricing-02", "sidebar-07", "footer"]) {
      expect(classifyKind({ registryType: "registry:block", name })).toBe("section");
    }
  });

  it("components, ui, examples and items are components", () => {
    for (const t of ["registry:component", "registry:ui", "registry:example", "registry:item"]) {
      expect(classifyKind({ registryType: t, name: "x" })).toBe("component");
    }
  });

  it("non-visual types are not catalog items", () => {
    for (const t of ["registry:theme", "registry:hook", "registry:lib", "registry:font", "registry:style", null]) {
      expect(classifyKind({ registryType: t, name: "x" })).toBeNull();
    }
  });
});

describe("§3 classifyPurpose", () => {
  it("reads purpose from name, title and categories", () => {
    expect(classifyPurpose({ name: "dashboard-01" })).toBe("dashboard");
    expect(classifyPurpose({ name: "sign-in-02" })).toBe("auth");
    expect(classifyPurpose({ name: "hero-section-1" })).toBe("landing");
    expect(classifyPurpose({ name: "x", categories: ["ecommerce"] })).toBe("ecommerce");
    expect(classifyPurpose({ name: "blog-grid" })).toBe("blog");
  });

  it("dashboard and auth win over landing words", () => {
    expect(classifyPurpose({ name: "pricing-settings" })).toBe("dashboard");
    expect(classifyPurpose({ name: "login-hero" })).toBe("auth");
  });

  it("falls back to the description only when name and title say nothing", () => {
    expect(classifyPurpose({ name: "card-07", description: "A card for an analytics dashboard" })).toBe("dashboard");
    expect(classifyPurpose({ name: "hero-3", description: "Works great in a dashboard" })).toBe("landing");
    expect(classifyPurpose({ name: "tooltip", description: "See the docs for the blog example" })).toBe("general");
  });

  it("defaults to general", () => {
    expect(classifyPurpose({ name: "shiny-text" })).toBe("general");
  });
});

describe("§4 deps and stack", () => {
  it("normalizeDep strips versions, keeps scopes", () => {
    expect(normalizeDep("motion@^11.0.0")).toBe("motion");
    expect(normalizeDep("@radix-ui/react-slot@1.2.0")).toBe("@radix-ui/react-slot");
    expect(normalizeDep("@radix-ui/react-slot")).toBe("@radix-ui/react-slot");
  });

  it("detectHeavyDeps finds animation, 3D and chart libraries", () => {
    expect(detectHeavyDeps(["clsx", "motion@11", "three", "@react-three/fiber", "recharts"])).toEqual([
      "@react-three/fiber",
      "motion",
      "recharts",
      "three",
    ]);
    expect(detectHeavyDeps(["clsx", "lucide-react"])).toEqual([]);
  });

  it("detectStack reads file extensions", () => {
    expect(detectStack([{ path: "components/hero.tsx" }])).toBe("react-tsx");
    expect(detectStack([{ path: "hero.jsx" }])).toBe("react-jsx");
    expect(detectStack([{ target: "index.html" }])).toBe("html");
    expect(detectStack([])).toBeNull();
  });

  it("detectFramework reads package.json deps", () => {
    expect(detectFramework({ next: "16", react: "19" })).toBe("next");
    expect(detectFramework({ astro: "5" })).toBe("astro");
    expect(detectFramework({ react: "19", vite: "6" })).toBe("react");
    expect(detectFramework({ tailwindcss: "4" })).toBe("html");
    expect(detectFramework(null)).toBe("html");
  });

  it("titleFromName", () => {
    expect(titleFromName("hero-section-01")).toBe("Hero Section 01");
  });
});

describe("§5 registry URLs", () => {
  it("guesses index locations from the {name} template", () => {
    expect(indexCandidates({ url: "https://x.dev/r/{name}.json" })).toEqual([
      "https://x.dev/r/registry.json",
      "https://x.dev/r/index.json",
      "https://x.dev/registry.json",
    ]);
  });

  it("uses an explicit indexUrl and fills {style}", () => {
    expect(indexCandidates({ url: "https://x.dev/r/{name}.json", indexUrl: "https://x.dev/idx.json" })).toEqual([
      "https://x.dev/idx.json",
    ]);
    expect(itemUrl({ url: "https://x.dev/r/styles/{style}/{name}.json", style: "new-york" }, "hero")).toBe(
      "https://x.dev/r/styles/new-york/hero.json"
    );
  });
});
