import { describe, expect, it } from "vitest";
import {
  KIT_CODE_BUDGET_CHARS,
  buildFixPrompt,
  buildRefinePrompt,
  buildSystemPrompt,
  buildUserPrompt,
  creditsComment,
  extractPage,
  fitKitToBudget,
  type BuildBrief,
  type KitPromptItem,
} from "../lib/builder/prompt";
import {
  checkScript,
  injectCheck,
  mergeProblems,
} from "../lib/builder/layout-check";
import { parseKit } from "../lib/kit/kit-store";
import { codeRefFor } from "../lib/kit/from-library";
import { SITE_NAME, SITE_URL } from "../lib/site";

const brief: BuildBrief = {
  about: "Pawpath, a dog-walking app in Dublin.",
  pageType: "landing",
  output: "html",
  style: "warm and editorial",
  colors: ["#ff4d2e"],
  sections: ["Hero", "Pricing", "Footer"],
  extra: "UK English",
};

const item = (over: Partial<KitPromptItem> = {}): KitPromptItem => ({
  index: 1,
  title: "Hero 03",
  sourceLabel: "shadcn/ui",
  kind: "section",
  license: "MIT",
  author: "shadcn",
  sourceUrl: "https://ui.shadcn.com",
  note: "Use as the hero, swap photo for a dog walker",
  files: [
    {
      path: "components/hero.tsx",
      content: "export default function Hero(){return <section/>}",
    },
  ],
  truncated: false,
  ...over,
});

describe("builder prompts", () => {
  it("system prompt fixes the output contract per format", () => {
    const html = buildSystemPrompt("html");
    expect(html).toMatch(/```html/);
    expect(html).toMatch(/cdn\.tailwindcss\.com/);
    expect(html).toMatch(/picsum\.photos/);
    const jsx = buildSystemPrompt("jsx");
    expect(jsx).toMatch(/export default/);
    expect(jsx).toMatch(/lucide-react/);
    expect(jsx).not.toMatch(/cdn\.tailwindcss\.com/);
  });

  it("user prompt carries brief, notes, code and credits", () => {
    const p = buildUserPrompt(brief, [
      item(),
      item({ index: 2, title: "Pricing", note: "", files: [] }),
    ]);
    expect(p).toContain("Build a landing page.");
    expect(p).toContain("Pawpath");
    expect(p).toContain("Hero → Pricing → Footer");
    expect(p).toContain("#ff4d2e");
    expect(p).toContain("User's note: Use as the hero");
    expect(p).toContain("```tsx");
    expect(p).toContain("(Code unavailable");
    expect(p).toContain(
      "Hero 03 by shadcn, shadcn/ui (https://ui.shadcn.com), MIT License",
    );
  });

  it("credits comments link to the live site", () => {
    const html = creditsComment([], "html");
    expect(html).toContain(`Built with ${SITE_NAME} (${SITE_URL}).`);
    expect(html).not.toContain("akellainmotion");
  });

  it("credits comments can't be closed early by item titles", () => {
    const html = creditsComment([item({ title: "Evil --> <script>" })], "html");
    expect(html.startsWith("<!--")).toBe(true);
    expect(html.indexOf("-->")).toBe(html.length - 3);
    const jsx = creditsComment([item({ title: "x */ alert(1)" })], "jsx");
    expect(jsx.indexOf("*/")).toBe(jsx.length - 2);
  });

  it("credits comments can't be closed early by the other comment end either", () => {
    // Browsers end a comment at "--!>" as well as at "-->".
    for (const title of ["Evil --!> <script>", "Evil ---!> <script>", "Evil --!--> <script>", "Evil ---> <script>"]) {
      const html = creditsComment([item({ title })], "html");
      expect(html.indexOf("-->")).toBe(html.length - 3);
      expect(html).not.toContain("--!>");
    }
  });

  it("credits comments never contain an em dash of our own", () => {
    const html = creditsComment([item({ title: "Evil --> <script>" })], "html");
    expect(html).not.toMatch(/\u2014/);
  });

  it("fix and refine prompts include the current file and the ask", () => {
    const fix = buildFixPrompt("<html></html>", "html", [
      { kind: "overflow-x", detail: "too wide", viewport: 390 },
    ]);
    expect(fix).toContain("[overflow-x @ 390px] too wide");
    expect(fix).toContain("<html></html>");
    const refine = buildRefinePrompt("code", "jsx", "make it dark");
    expect(refine).toContain("make it dark");
    expect(refine).toContain("```jsx");
  });
});

describe("extractPage", () => {
  const doc = "<!doctype html><html><body>hi</body></html>";

  it("prefers the fence in the wanted language", () => {
    const r = extractPage(
      "Here:\n```css\nbody{}\n```\n```html\n" + doc + "\n```\nEnjoy",
      "html",
    );
    expect(r).toEqual({ code: doc, incomplete: false });
  });

  it("flags an unclosed fence as incomplete", () => {
    const r = extractPage(
      "```html\n<!doctype html><html><body><section>",
      "html",
    );
    expect(r.incomplete).toBe(true);
    expect(r.code.startsWith("<!doctype html>")).toBe(true);
  });

  it("accepts a bare HTML document", () => {
    expect(extractPage("Sure!\n" + doc, "html")).toEqual({
      code: doc,
      incomplete: false,
    });
  });

  it("handles jsx fences and CRLF", () => {
    const r = extractPage(
      "```jsx\r\nexport default function App(){return null}\r\n```",
      "jsx",
    );
    expect(r.code).toBe("export default function App(){return null}");
    expect(r.incomplete).toBe(false);
  });
});

describe("fitKitToBudget", () => {
  it("keeps everything under the budget and marks truncation", () => {
    const big = "x".repeat(50_000);
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      files: [{ path: "a.tsx", content: big }],
    }));
    const fitted = fitKitToBudget(items);
    const total = fitted.reduce(
      (n, i) => n + i.files.reduce((m, f) => m + f.content.length, 0),
      0,
    );
    expect(total).toBeLessThanOrEqual(KIT_CODE_BUDGET_CHARS + 10 * 20);
    expect(fitted.every((i) => i.truncated)).toBe(true);
    expect(fitted.every((i) => i.files.length === 1)).toBe(true);
  });

  it("leaves small kits untouched", () => {
    const fitted = fitKitToBudget([
      { files: [{ path: "a.html", content: "<b>hi</b>" }] },
    ]);
    expect(fitted[0]).toEqual({
      files: [{ path: "a.html", content: "<b>hi</b>" }],
      truncated: false,
    });
  });
});

describe("layout check", () => {
  it("injects the check right after <head>", () => {
    const out = injectCheck(
      "<!doctype html><html><head><title>x</title></head><body></body></html>",
      7,
    );
    expect(out.indexOf("__aimcheck")).toBeGreaterThan(out.indexOf("<head>"));
    expect(out.indexOf("__aimcheck")).toBeLessThan(out.indexOf("<title>"));
    expect(checkScript(7)).toContain("nonce: 7");
  });

  it("merges per-width problems, keeping overflow per width", () => {
    const merged = mergeProblems([
      { width: 1280, problems: [{ kind: "broken-image", detail: "a.png" }] },
      {
        width: 390,
        problems: [
          { kind: "broken-image", detail: "a.png" },
          { kind: "overflow-x", detail: "wide" },
        ],
      },
    ]);
    expect(merged).toEqual([
      { kind: "broken-image", detail: "a.png", viewport: undefined },
      { kind: "overflow-x", detail: "wide", viewport: 390 },
    ]);
  });
});

describe("kit", () => {
  it("parses stored kits defensively", () => {
    expect(parseKit(null)).toEqual([]);
    expect(parseKit("nope")).toEqual([]);
    expect(parseKit('[{"id":1}]')).toEqual([]);
    const ok = parseKit(
      JSON.stringify([
        {
          id: "a/b",
          title: "B",
          codeRef: { type: "none" },
          note: "x".repeat(1000),
        },
      ]),
    );
    expect(ok).toHaveLength(1);
    expect(ok[0].note.length).toBe(400);
  });

  it("picks where to fetch code from", () => {
    expect(
      codeRefFor({
        src: "aimdropin",
        name: "x",
        install: { method: "editor" },
        editorSlug: "x",
        stack: "react-jsx",
      }),
    ).toEqual({
      type: "template",
      slug: "x",
    });
    expect(
      codeRefFor({
        src: "@magicui",
        name: "globe",
        install: {
          method: "shadcn",
          url: "https://magicui.design/r/globe.json",
        },
        stack: "react-tsx",
      }),
    ).toEqual({ type: "registry", url: "https://magicui.design/r/globe.json" });
    expect(
      codeRefFor({
        src: "uiverse",
        name: "btn-1",
        install: { method: "editor" },
        stack: "html",
      }),
    ).toEqual({
      type: "html-component",
      slug: "btn-1",
    });
    expect(
      codeRefFor({
        src: "tailadmin",
        name: "t",
        install: { method: "clone" },
        stack: "html",
      }),
    ).toEqual({ type: "none" });
  });
});
