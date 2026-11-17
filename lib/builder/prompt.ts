// Builder - prompts for "build a whole page from my kit" in one pass.
//
// The approach (decided with the user, 2026-10-29): stacking picked pieces
// programmatically, or queueing many small AI replaces, produces garbled
// layouts. What works is handing the whole kit (code + the user's notes) to
// one strong model and asking for one complete, cohesive page. Then an
// automatic layout check and at most one fix-up request; after that, plain-
// word "change X" requests regenerate the whole page.
//
// Everything here is pure so it can be unit-tested.

import { SITE_NAME, SITE_URL } from "@/lib/site";

export type BuildOutput = "html" | "jsx";
export type PageType =
  | "landing"
  | "dashboard"
  | "portfolio"
  | "store"
  | "blog"
  | "other";

export interface KitPromptItem {
  index: number;
  title: string;
  sourceLabel: string;
  kind: "page" | "section" | "component";
  license: string;
  author: string | null;
  sourceUrl: string | null;
  note: string;
  // Code as fetched (already truncated to budget). Empty when unavailable.
  files: Array<{ path: string; content: string }>;
  truncated: boolean;
}

export interface BuildBrief {
  about: string;
  pageType: PageType;
  output: BuildOutput;
  // Free text: "warm, editorial", "dark neon", … Empty = match the kit.
  style: string;
  // Hex colours the user picked, if any.
  colors: string[];
  // Sections the user ticked, in order. Empty = let the model decide.
  sections: string[];
  // Anything else ("no pricing yet", "Irish English", …).
  extra: string;
}

export const PAGE_TYPE_LABEL: Record<PageType, string> = {
  landing: "landing page",
  dashboard: "dashboard / app screen",
  portfolio: "portfolio",
  store: "online store page",
  blog: "blog / content page",
  other: "web page",
};

export const SECTION_PRESETS: Record<PageType, string[]> = {
  landing: [
    "Navigation",
    "Hero",
    "Logos",
    "Features",
    "How it works",
    "Testimonials",
    "Pricing",
    "FAQ",
    "Call to action",
    "Footer",
  ],
  dashboard: [
    "Sidebar",
    "Top bar",
    "Stat cards",
    "Main chart",
    "Data table",
    "Activity feed",
    "Settings panel",
  ],
  portfolio: [
    "Navigation",
    "Intro",
    "Selected work",
    "About",
    "Services",
    "Testimonials",
    "Contact",
    "Footer",
  ],
  store: [
    "Navigation",
    "Hero",
    "Product grid",
    "Featured product",
    "Reviews",
    "Newsletter",
    "Footer",
  ],
  blog: [
    "Navigation",
    "Featured post",
    "Post list",
    "Categories",
    "Newsletter",
    "Footer",
  ],
  other: ["Navigation", "Hero", "Content", "Call to action", "Footer"],
};

// Budget for kit code in the prompt. ~4 chars per token: 160k chars is about
// 40k input tokens (≈ $0.16 on Claude Opus 5.5), plenty for a dozen pieces.
export const KIT_CODE_BUDGET_CHARS = 160_000;
export const KIT_ITEM_MAX_CHARS = 24_000;

// Picsum always returns an image for any seed, unlike guessed Unsplash ids.
const IMAGE_RULE =
  "For photos use https://picsum.photos/seed/<one-word-seed>/<width>/<height> (pick seeds that describe the subject). Never invent other image URLs. Decorative graphics: inline SVG or CSS gradients.";

export function buildSystemPrompt(output: BuildOutput): string {
  const format =
    output === "html"
      ? [
          'Output ONE complete HTML document in a single ```html code block: <!doctype html>, <head> with charset, viewport, <title>, and Tailwind via <script src="https://cdn.tailwindcss.com"></script> (you may add a tailwind.config script for custom colours and fonts).',
          "Google Fonts <link> tags are fine. Any interactivity is small vanilla JS in an inline <script> at the end of <body>. No other external scripts, no build step, no frameworks.",
        ]
      : [
          "Output ONE React 18 file in a single ```jsx code block. It must `export default` the page component. Style only with Tailwind classes.",
          "Allowed imports, nothing else: react (hooks), lucide-react (icons), recharts (charts), clsx. No TypeScript, no next/* imports, no CSS imports, no other packages. Inline any small helper components in the same file.",
        ];
  return [
    "You are a senior product designer and front-end engineer. You turn a kit of UI pieces a user picked into one finished, cohesive page.",
    "",
    "Format:",
    ...format.map((l) => `- ${l}`),
    "- Reply with the code block only. No explanation before or after.",
    "",
    "How to use the kit:",
    "- Each kit piece is a reference the user chose on purpose: keep its structure, visual idea and signature details, and follow the user's note for it exactly (placement, colours, shapes, wording).",
    "- Translate everything into the output format: shadcn/ui or other React components become equivalent Tailwind markup; icon packages become inline SVG (HTML) or lucide-react (JSX); animation libraries become CSS transitions/keyframes.",
    "- Pieces will come from different sources with different styles. Unify them: one palette, one type scale, one spacing rhythm, one border-radius and shadow language. The page must look designed by one person.",
    "- Order sections in the sequence a real visitor needs. Use every kit piece unless the user's note says otherwise; you may add small connective pieces (nav, footer, spacing sections) the page needs.",
    "",
    "Quality bar:",
    "- Responsive from 360px to 1440px wide, mobile first. Nothing may overflow horizontally at any width. Use max-width containers and sensible padding.",
    "- Real, specific copy written for the brief. No lorem ipsum, no placeholder names like 'Company Name'.",
    "- Accessible: semantic landmarks, one h1, heading order, alt text, visible focus states, AA colour contrast.",
    `- ${IMAGE_RULE}`,
    "- Forms don't submit anywhere: prevent default and show a friendly confirmation.",
    "- Include the credits comment the user gives you, unchanged, at the very top of the file (for HTML: right after <!doctype html>). It carries the license notices of the kit pieces.",
  ].join("\n");
}

function fence(path: string): string {
  if (/\.(tsx|ts)$/.test(path)) return "tsx";
  if (/\.(jsx|js)$/.test(path)) return "jsx";
  if (/\.css$/.test(path)) return "css";
  if (/\.html?$/.test(path)) return "html";
  return "";
}

export function creditsComment(
  items: KitPromptItem[],
  output: BuildOutput,
): string {
  const lines = [
    `Built with ${SITE_NAME} (${SITE_URL}).`,
    ...(items.length ? ["Based on these open-source pieces:"] : []),
    ...items.map((i) => {
      const by = i.author ? ` by ${i.author}` : "";
      const url = i.sourceUrl ? ` (${i.sourceUrl})` : "";
      return `- ${i.title}${by}, ${i.sourceLabel}${url}, ${i.license} License`;
    }),
  ];
  // Neither comment style may contain its own terminator. Browsers end an
  // HTML comment at "--!>" as well as at "-->".
  const safe = lines.map((l) =>
    l.replace(/--(!?)>/g, "- -$1>").replace(/\*\//g, "* /"),
  );
  return output === "html"
    ? `<!--\n${safe.map((l) => `  ${l}`).join("\n")}\n-->`
    : `/*\n${safe.map((l) => ` * ${l}`).join("\n")}\n */`;
}

export function buildUserPrompt(
  brief: BuildBrief,
  items: KitPromptItem[],
): string {
  const parts: string[] = [];
  parts.push(`Build a ${PAGE_TYPE_LABEL[brief.pageType]}.`);
  parts.push("");
  parts.push("## Brief");
  parts.push(
    brief.about.trim() ||
      "(No brief given: infer a believable product from the kit.)",
  );
  if (brief.style.trim())
    parts.push(`\nStyle direction: ${brief.style.trim()}`);
  else
    parts.push(
      "\nStyle direction: take it from the kit pieces and make it cohesive.",
    );
  if (brief.colors.length)
    parts.push(
      `Brand colours (use as the palette's anchors): ${brief.colors.join(", ")}`,
    );
  if (brief.sections.length) {
    parts.push(`Sections, in this order: ${brief.sections.join(" → ")}`);
  }
  if (brief.extra.trim()) parts.push(`Also: ${brief.extra.trim()}`);

  parts.push("");
  parts.push("## Credits comment (top of the file, unchanged)");
  parts.push(creditsComment(items, brief.output));

  parts.push("");
  parts.push(`## Kit (${items.length} piece${items.length === 1 ? "" : "s"})`);
  if (!items.length) parts.push("(Empty kit: design the page from scratch.)");
  for (const i of items) {
    parts.push("");
    parts.push(`### ${i.index}. ${i.title} - ${i.kind} from ${i.sourceLabel}`);
    parts.push(
      i.note.trim()
        ? `User's note: ${i.note.trim()}`
        : "User's note: (none - use your judgement)",
    );
    if (!i.files.length) {
      parts.push(
        "(Code unavailable: use the title and source as a visual reference.)",
      );
      continue;
    }
    for (const f of i.files) {
      parts.push(`File: ${f.path}`);
      parts.push("```" + fence(f.path));
      parts.push(f.content);
      parts.push("```");
    }
    if (i.truncated)
      parts.push("(Code shortened to fit; the beginning shows the structure.)");
  }
  return parts.join("\n");
}

export interface LayoutProblem {
  // Short machine id: "overflow-x", "broken-image", "js-error", "empty", …
  kind: string;
  detail: string;
  viewport?: number;
}

export function buildFixPrompt(
  code: string,
  output: BuildOutput,
  problems: LayoutProblem[],
): string {
  return [
    "This page was generated from a kit, then rendered and checked automatically. Fix the problems below without redesigning anything else: keep the content, structure, styling and credits comment.",
    "",
    "## Problems found",
    ...problems.map(
      (p) =>
        `- [${p.kind}${p.viewport ? ` @ ${p.viewport}px` : ""}] ${p.detail}`,
    ),
    "",
    `Return the complete corrected file in one \`\`\`${output} code block, nothing else.`,
    "",
    "## Current file",
    "```" + output,
    code,
    "```",
  ].join("\n");
}

export function buildRefinePrompt(
  code: string,
  output: BuildOutput,
  instruction: string,
): string {
  return [
    "Change this page as asked. Keep everything not mentioned exactly as it is, including the credits comment. Stay consistent with the page's existing palette, type and spacing unless the request changes them.",
    "",
    "## Change",
    instruction.trim(),
    "",
    `Return the complete updated file in one \`\`\`${output} code block, nothing else.`,
    "",
    "## Current file",
    "```" + output,
    code,
    "```",
  ].join("\n");
}

export interface ExtractedPage {
  code: string;
  // The model stopped mid-file (no closing fence / </html>).
  incomplete: boolean;
}

// Pull the page out of a model reply. Prefers a fence tagged with the wanted
// language, then the longest fence, then a bare HTML document; handles a
// reply cut off before its closing fence.
export function extractPage(reply: string, output: BuildOutput): ExtractedPage {
  const text = reply.replace(/\r\n?/g, "\n");
  const fences = [...text.matchAll(/```([a-zA-Z]*)[^\n]*\n([\s\S]*?)```/g)].map(
    (m) => ({
      lang: m[1].toLowerCase(),
      body: m[2].trim(),
    }),
  );
  const wanted =
    output === "html"
      ? ["html", "htm"]
      : ["jsx", "tsx", "javascript", "js", "react"];
  const tagged = fences.filter((f) => wanted.includes(f.lang));
  const pool = tagged.length ? tagged : fences;
  if (pool.length) {
    const best = pool.reduce((a, b) => (b.body.length > a.body.length ? b : a));
    return {
      code: best.body,
      incomplete: output === "html" && !/<\/html>\s*$/i.test(best.body),
    };
  }
  // Unclosed fence: the reply hit the token limit mid-file.
  const open = text.match(/```[a-zA-Z]*[^\n]*\n([\s\S]*)$/);
  if (open) return { code: open[1].trim(), incomplete: true };
  if (output === "html") {
    const start = text.search(/<!doctype html|<html[\s>]/i);
    if (start >= 0) {
      const body = text.slice(start).trim();
      return { code: body, incomplete: !/<\/html>\s*$/i.test(body) };
    }
  }
  return { code: text.trim(), incomplete: false };
}

// Shrink kit code to the budget: each item capped, then items share what's
// left in order (earlier picks are kept more fully).
export function fitKitToBudget<
  T extends { files: Array<{ path: string; content: string }> },
>(
  items: T[],
  budget = KIT_CODE_BUDGET_CHARS,
  perItem = KIT_ITEM_MAX_CHARS,
): Array<T & { truncated: boolean }> {
  let remaining = budget;
  const fairShare = items.length
    ? Math.max(4000, Math.floor(budget / items.length))
    : budget;
  return items.map((item) => {
    const cap = Math.min(
      perItem,
      Math.max(fairShare, 0),
      Math.max(remaining, 0),
    );
    let used = 0;
    let truncated = false;
    const files: Array<{ path: string; content: string }> = [];
    for (const f of item.files) {
      const left = cap - used;
      if (left <= 200) {
        truncated = true;
        break;
      }
      if (f.content.length > left) {
        files.push({
          path: f.path,
          content: f.content.slice(0, left) + "\n/* … */",
        });
        used += left;
        truncated = true;
        break;
      }
      files.push(f);
      used += f.content.length;
    }
    remaining -= used;
    return { ...item, files, truncated };
  });
}

// Rough cost preview before sending: ~3.6 chars per token for code-heavy
// prompts; a finished page is usually 8-16k output tokens.
export function estimateTokens(promptChars: number): {
  input: number;
  outputLow: number;
  outputHigh: number;
} {
  return {
    input: Math.ceil(promptChars / 3.6),
    outputLow: 8000,
    outputHigh: 16000,
  };
}
