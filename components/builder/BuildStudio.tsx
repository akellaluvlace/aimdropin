"use client";

// /build - pick → note → brief → one AI pass → page.
// Left: the kit (what you picked in the library) with a note per piece.
// Right: a short brief (what it's for, style, colours, sections, output).
// Generate sends everything to the user's own AI in one request, then the
// layout check + one fix-up run automatically (lib/builder/generate.ts).

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useKit } from "@/lib/kit/use-kit";
import {
  clearKit,
  moveKitItem,
  removeFromKit,
  setKitNote,
  KIT_NOTE_MAX,
} from "@/lib/kit/kit-store";
import { useAiConnection } from "@/lib/ai/use-ai-connection";
import { AI_PROVIDERS, findPreset } from "@/lib/ai/providers";
import { AiError } from "@/lib/ai/complete";
import AiConnectDialog from "@/components/ai/AiConnectDialog";
import KitPicker from "./KitPicker";
import { collectKit } from "@/lib/builder/collect-kit";
import {
  PAGE_TYPE_LABEL,
  SECTION_PRESETS,
  buildSystemPrompt,
  buildUserPrompt,
  estimateTokens,
  type BuildBrief,
  type BuildOutput,
  type PageType,
} from "@/lib/builder/prompt";
import { generatePage, type BuildProgress } from "@/lib/builder/generate";
import {
  listDrafts,
  newDraftId,
  putDraft,
  titleFromCode,
  type BuilderDraft,
} from "@/lib/builder/drafts";

const STYLE_CHIPS = [
  "Match the kit",
  "Clean and minimal",
  "Bold and colourful",
  "Dark and techy",
  "Warm and editorial",
  "Playful",
  "Brutalist",
  "Luxury",
] as const;

const BRIEF_KEY = "aimdropin:build:brief";

const DEFAULT_BRIEF: BuildBrief = {
  about: "",
  pageType: "landing",
  output: "html",
  style: "",
  colors: [],
  sections: [],
  extra: "",
};

function loadBrief(): BuildBrief {
  try {
    const raw = window.localStorage.getItem(BRIEF_KEY);
    if (!raw) return DEFAULT_BRIEF;
    const b = JSON.parse(raw) as Partial<BuildBrief>;
    return {
      ...DEFAULT_BRIEF,
      ...b,
      colors: Array.isArray(b.colors) ? b.colors.slice(0, 3) : [],
      sections: Array.isArray(b.sections) ? b.sections : [],
    };
  } catch {
    return DEFAULT_BRIEF;
  }
}

function money(n: number): string {
  return n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`;
}

const PHASE_LABEL: Record<BuildProgress["phase"], string> = {
  collecting: "Gathering the code for your kit…",
  writing: "Your AI is writing the page…",
  checking: "Checking the layout on desktop and phone…",
  fixing: "Fixing what the check found…",
  done: "Done",
};

export default function BuildStudio() {
  const router = useRouter();
  const { kit, ready: kitReady } = useKit();
  const { connection } = useAiConnection();
  const [brief, setBrief] = useState<BuildBrief>(DEFAULT_BRIEF);
  const [briefReady, setBriefReady] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [progress, setProgress] = useState<BuildProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<BuilderDraft[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const pendingGenerate = useRef(false);

  useEffect(() => {
    setBrief(loadBrief());
    setBriefReady(true);
    listDrafts().then(setDrafts, () => setDrafts([]));
  }, []);

  useEffect(() => {
    if (!briefReady) return;
    try {
      window.localStorage.setItem(BRIEF_KEY, JSON.stringify(brief));
    } catch {
      // not remembered; fine
    }
  }, [brief, briefReady]);

  // Connected from the dialog after pressing Generate: carry on.
  useEffect(() => {
    if (connection && pendingGenerate.current) {
      pendingGenerate.current = false;
      setShowConnect(false);
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection]);

  const preset = connection
    ? findPreset(connection.provider, connection.model)
    : null;

  // Rough estimate before fetching code: prompt text + ~6k chars per piece.
  const estimate = useMemo(() => {
    const promptChars =
      buildSystemPrompt(brief.output).length +
      buildUserPrompt(brief, []).length +
      kit.reduce(
        (n, k) => n + (k.codeRef.type === "none" ? 300 : 6000) + k.note.length,
        0,
      );
    const t = estimateTokens(promptChars);
    if (!preset || preset.inputPerMTok == null || preset.outputPerMTok == null)
      return null;
    const low =
      (t.input / 1e6) * preset.inputPerMTok +
      (t.outputLow / 1e6) * preset.outputPerMTok;
    const high =
      (t.input / 1e6) * preset.inputPerMTok * 1.3 +
      (t.outputHigh / 1e6) * preset.outputPerMTok * 1.5;
    return { low, high };
  }, [brief, kit, preset]);

  function patch(p: Partial<BuildBrief>) {
    setBrief((b) => ({ ...b, ...p }));
  }

  async function run() {
    if (!connection) {
      pendingGenerate.current = true;
      setShowConnect(true);
      return;
    }
    setError(null);
    setMissing([]);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      setProgress({ phase: "collecting", chars: 0, text: "" });
      const collected = await collectKit(kit, brief.output);
      setMissing(collected.missing);
      const result = await generatePage({
        connection,
        brief,
        kit: collected.items,
        signal: ac.signal,
        onProgress: setProgress,
      });
      const id = newDraftId();
      const now = Date.now();
      const fallbackTitle =
        brief.about.trim().split(/[.\n]/)[0]?.slice(0, 60) ||
        `New ${PAGE_TYPE_LABEL[brief.pageType]}`;
      const draft: BuilderDraft = {
        id,
        title: titleFromCode(result.code, fallbackTitle),
        output: brief.output,
        code: result.code,
        brief,
        credits: kit.map((k) => ({
          id: k.id,
          title: k.title,
          sourceUrl: k.srcUrl,
          license: k.lic,
        })),
        versions: [{ code: result.code, label: "First version", at: now }],
        model: connection.model,
        costUsd: result.costUsd,
        remotePageId: null,
        createdAt: now,
        updatedAt: now,
      };
      await putDraft(draft);
      try {
        window.sessionStorage.setItem(
          `aimdropin:build:report:${id}`,
          JSON.stringify({
            problems: result.problems,
            fixed: result.fixedProblems,
            missing: collected.missing,
          }),
        );
      } catch {
        // report is optional
      }
      router.push(`/build/d/${id}`);
    } catch (e) {
      setProgress(null);
      if (e instanceof AiError && e.kind === "aborted") return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      abortRef.current = null;
    }
  }

  const busy = progress !== null && progress.phase !== "done";
  const sections = SECTION_PRESETS[brief.pageType];

  return (
    <div className="mx-auto grid max-w-[1400px] gap-8 px-4 pb-32 pt-8 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* ---------------- Kit ---------------- */}
      <section aria-labelledby="kit-h">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1
              id="kit-h"
              className="font-display text-display-lg leading-none"
            >
              Build a page
            </h1>
            <p className="mt-3 text-ink/70">
              Your kit is what you picked in the library. Add a note to any
              piece (where it goes, colours, what to change), describe the page,
              and your AI builds the whole thing in one go.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Your kit · {kitReady ? kit.length : "…"} piece
            {kit.length === 1 ? "" : "s"}
          </h2>
          <div className="flex gap-3 text-sm">
            <button
              type="button"
              className="underline"
              onClick={() => setShowPicker(true)}
            >
              + Add pieces
            </button>
            <Link href="/library" className="text-ink/60 underline">
              Browse library
            </Link>
            {kit.length ? (
              <button
                type="button"
                className="text-ink/60 underline"
                onClick={() => clearKit()}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        {kitReady && kit.length === 0 ? (
          <div className="mt-3 border-2 border-dashed border-ink/40 p-6">
            <p className="font-display text-xl">Your kit is empty.</p>
            <p className="mt-2 text-sm text-ink/70">
              Add anything you like: a hero, a pricing table, a button style, a
              whole template. Or skip it and let your AI design from the brief
              alone.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-accent px-4 py-2"
                onClick={() => setShowPicker(true)}
              >
                + Add pieces
              </button>
              <Link href="/library" className="btn px-4 py-2">
                Browse the library
              </Link>
            </div>
          </div>
        ) : (
          <ol className="mt-3 space-y-3">
            {kit.map((k, i) => (
              <li key={k.id} className="border-2 border-ink bg-card">
                <div className="flex gap-3 p-3">
                  <div className="h-16 w-24 shrink-0 overflow-hidden border border-ink/20 bg-soft">
                    {k.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={k.thumb}
                        alt=""
                        className="h-full w-full object-cover object-top"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-1 text-center font-mono text-[9px] uppercase text-ink/50">
                        {k.kind}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      <span className="mr-1 font-mono text-xs text-muted">
                        {i + 1}.
                      </span>
                      {k.title}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                      {k.srcLabel ?? k.src} · {k.kind} · {k.lic}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        aria-label="Move up"
                        disabled={i === 0}
                        onClick={() => moveKitItem(k.id, -1)}
                        className="border border-ink/30 px-1.5 text-xs disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        disabled={i === kit.length - 1}
                        onClick={() => moveKitItem(k.id, 1)}
                        className="border border-ink/30 px-1.5 text-xs disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromKit(k.id)}
                      className="text-xs text-ink/60 underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <label className="block border-t border-ink/15 px-3 pb-3 pt-2">
                  <span className="sr-only">Note for {k.title}</span>
                  <textarea
                    value={k.note}
                    maxLength={KIT_NOTE_MAX}
                    rows={2}
                    onChange={(e) => setKitNote(k.id, e.target.value)}
                    placeholder={
                      k.kind === "component"
                        ? "How to use it: e.g. “all buttons look like this, in our green”"
                        : "Where and how: e.g. “use as the hero, swap the photo for a dog walker”"
                    }
                    className="w-full resize-y bg-transparent text-sm outline-none placeholder:text-ink/35"
                  />
                </label>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* ---------------- Brief ---------------- */}
      <section aria-labelledby="brief-h" className="lg:pt-[7.5rem]">
        <h2 id="brief-h" className="sr-only">
          Brief
        </h2>
        <div className="space-y-6 border-2 border-ink bg-card p-5">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              What is the page for?
            </span>
            <textarea
              value={brief.about}
              onChange={(e) => patch({ about: e.target.value })}
              rows={4}
              maxLength={4000}
              placeholder="e.g. Pawpath, a dog-walking app in Dublin. Owners book vetted walkers by the hour. Main action: download the app. Friendly, trustworthy, a bit playful."
              className="mt-2 w-full border-2 border-ink bg-paper px-3 py-2 text-sm outline-none focus:border-coral"
            />
          </label>

          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Kind of page
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(PAGE_TYPE_LABEL) as PageType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={brief.pageType === t}
                  onClick={() => patch({ pageType: t, sections: [] })}
                  className={
                    "border-2 px-3 py-1.5 text-sm " +
                    (brief.pageType === t
                      ? "border-ink bg-ink text-paper"
                      : "border-ink/25 hover:border-ink")
                  }
                >
                  {PAGE_TYPE_LABEL[t].replace(/^\w/, (c) => c.toUpperCase())}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Sections{" "}
              <span className="normal-case tracking-normal">
                (optional: tick to fix the order)
              </span>
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {sections.map((s) => {
                const on = brief.sections.includes(s);
                const pos = brief.sections.indexOf(s) + 1;
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      patch({
                        sections: on
                          ? brief.sections.filter((x) => x !== s)
                          : [...brief.sections, s],
                      })
                    }
                    className={
                      "border-2 px-2.5 py-1 text-sm " +
                      (on
                        ? "border-ink bg-coral text-paper"
                        : "border-ink/25 hover:border-ink")
                    }
                  >
                    {on ? `${pos}. ` : ""}
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Style
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {STYLE_CHIPS.map((s) => {
                const value = s === "Match the kit" ? "" : s.toLowerCase();
                const on = brief.style === value;
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => patch({ style: value })}
                    className={
                      "border-2 px-2.5 py-1 text-sm " +
                      (on
                        ? "border-ink bg-ink text-paper"
                        : "border-ink/25 hover:border-ink")
                    }
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            <input
              value={
                STYLE_CHIPS.some((c) => c.toLowerCase() === brief.style)
                  ? ""
                  : brief.style
              }
              onChange={(e) => patch({ style: e.target.value })}
              maxLength={300}
              aria-label="Describe the style in your own words"
              placeholder="…or describe it: “like a Swiss poster, lots of white, one red accent”"
              className="mt-2 w-full border-b-2 border-ink/25 bg-transparent py-1.5 text-sm outline-none focus:border-coral"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Brand colours
            </span>
            {brief.colors.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                <input
                  type="color"
                  value={c}
                  aria-label={`Colour ${i + 1}`}
                  onChange={(e) =>
                    patch({
                      colors: brief.colors.map((x, j) =>
                        j === i ? e.target.value : x,
                      ),
                    })
                  }
                  className="h-8 w-10 cursor-pointer border-2 border-ink bg-transparent p-0"
                />
                <button
                  type="button"
                  aria-label={`Remove colour ${i + 1}`}
                  onClick={() =>
                    patch({ colors: brief.colors.filter((_, j) => j !== i) })
                  }
                  className="text-xs text-ink/60"
                >
                  ✕
                </button>
              </span>
            ))}
            {brief.colors.length < 3 ? (
              <button
                type="button"
                onClick={() =>
                  patch({
                    colors: [
                      ...brief.colors,
                      brief.colors.length ? "#0f172a" : "#ff4d2e",
                    ],
                  })
                }
                className="border-2 border-dashed border-ink/40 px-2.5 py-1 text-sm hover:border-ink"
              >
                + Colour
              </button>
            ) : null}
            {brief.colors.length === 0 ? (
              <span className="text-xs text-ink/50">None: the AI picks</span>
            ) : null}
          </div>

          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Output
            </span>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(
                [
                  [
                    "html",
                    "HTML + Tailwind",
                    "One file. Opens anywhere, no build step.",
                  ],
                  [
                    "jsx",
                    "React (JSX)",
                    "One component file for React / Next.js projects.",
                  ],
                ] as Array<[BuildOutput, string, string]>
              ).map(([id, label, note]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={brief.output === id}
                  onClick={() => patch({ output: id })}
                  className={
                    "border-2 px-3 py-2 text-left " +
                    (brief.output === id
                      ? "border-ink bg-paper shadow-[3px_3px_0_0_#0F0F0F]"
                      : "border-ink/25 hover:border-ink")
                  }
                >
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-ink/60">{note}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Anything else
            </span>
            <input
              value={brief.extra}
              onChange={(e) => patch({ extra: e.target.value })}
              maxLength={1000}
              placeholder="e.g. no pricing yet · UK English · include a waitlist form"
              className="mt-2 w-full border-b-2 border-ink/25 bg-transparent py-1.5 text-sm outline-none focus:border-coral"
            />
          </label>
        </div>

        {drafts.length ? (
          <div className="mt-8">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Recent builds (this browser)
            </h2>
            <ul className="mt-2 divide-y divide-ink/10 border-2 border-ink bg-card">
              {drafts.slice(0, 8).map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/build/d/${d.id}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-soft"
                  >
                    <span className="truncate text-sm">{d.title}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted">
                      {new Date(d.updatedAt).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* ---------------- Generate bar ---------------- */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1 text-sm">
            {connection ? (
              <span>
                With <strong>{preset?.label ?? connection.model}</strong> via{" "}
                {AI_PROVIDERS[connection.provider].label}
                {estimate ? (
                  <span className="text-ink/60">
                    {" "}
                    · about {money(estimate.low)}-{money(estimate.high)} on your
                    account
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="text-ink/70">
                Connect your AI to build. You pay your provider directly.
              </span>
            )}
            {error ? <p className="mt-1 text-coral">{error}</p> : null}
          </div>
          <button
            type="button"
            disabled={busy || !kitReady}
            onClick={() => void run()}
            className="btn btn-accent px-6 py-3 disabled:opacity-60"
          >
            {connection
              ? kit.length
                ? `Build page from ${kit.length} piece${kit.length === 1 ? "" : "s"}`
                : "Build page"
              : "Connect AI and build"}
          </button>
        </div>
      </div>

      {busy && progress ? (
        <BuildingOverlay
          progress={progress}
          missing={missing}
          output={brief.output}
          onCancel={() => abortRef.current?.abort()}
        />
      ) : null}
      {showPicker ? <KitPicker onClose={() => setShowPicker(false)} /> : null}
      {showConnect ? (
        <AiConnectDialog
          onClose={() => {
            pendingGenerate.current = false;
            setShowConnect(false);
          }}
        />
      ) : null}
    </div>
  );
}

// HTML streamed so far, from the opening of the document, or null while
// the model hasn't started the page yet. Browsers render partial HTML, so
// the page can be shown building up live.
function partialHtml(text: string): string | null {
  const start = text.search(/<!doctype html|<html[s>]/i);
  if (start < 0) return null;
  return text.slice(start).replace(/```[sS]*$/, "");
}

// Re-rendering an iframe reloads it, so the live view refreshes every few
// seconds rather than on every token.
const LIVE_REFRESH_MS = 2500;

function BuildingOverlay({
  progress,
  missing,
  output,
  onCancel,
}: {
  progress: BuildProgress;
  missing: string[];
  output: BuildOutput;
  onCancel: () => void;
}) {
  const tailRef = useRef<HTMLPreElement>(null);
  const [live, setLive] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const latest = useRef(progress.text);
  latest.current = progress.text;

  useEffect(() => {
    const el = tailRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [progress.text, showCode]);

  useEffect(() => {
    if (output !== "html" || progress.phase !== "writing") return;
    const tick = () => setLive(partialHtml(latest.current));
    tick();
    const t = window.setInterval(tick, LIVE_REFRESH_MS);
    return () => window.clearInterval(t);
  }, [output, progress.phase]);

  const showLive = output === "html" && !!live && !showCode;
  const steps: BuildProgress["phase"][] = ["collecting", "writing", "checking"];
  const at = progress.phase === "fixing" ? 2 : steps.indexOf(progress.phase);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Building your page"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/80 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col border-2 border-ink bg-paper shadow-[8px_8px_0_0_#FF4D2E]">
        <div className="border-b-2 border-ink px-5 py-4">
          <p className="font-display text-2xl" aria-live="polite">
            {PHASE_LABEL[progress.phase]}
          </p>
          <ol className="mt-3 flex gap-2 font-mono text-[10px] uppercase tracking-[0.15em]">
            {["Kit", "Write", "Check"].map((s, i) => (
              <li
                key={s}
                className={
                  "border-2 px-2 py-1 " +
                  (i < at
                    ? "border-ink bg-ink text-paper"
                    : i === at
                      ? "border-coral text-coral"
                      : "border-ink/20 text-ink/40")
                }
              >
                {s}
              </li>
            ))}
          </ol>
          {progress.phase === "fixing" && progress.problems?.length ? (
            <ul className="mt-3 list-disc pl-5 text-sm text-ink/70">
              {progress.problems.slice(0, 4).map((p, i) => (
                <li key={i}>{p.detail.slice(0, 160)}</li>
              ))}
            </ul>
          ) : null}
          {missing.length ? (
            <p className="mt-2 text-xs text-ink/60">
              Couldn&apos;t load code for: {missing.join(", ")}. The AI uses
              their names as a reference.
            </p>
          ) : null}
        </div>
        {showLive ? (
          <iframe
            title="Your page, as it's written"
            srcDoc={live ?? ""}
            sandbox="allow-scripts"
            className="min-h-[50vh] w-full flex-1 bg-white"
          />
        ) : (
          <pre
            ref={tailRef}
            className="min-h-[200px] flex-1 overflow-auto bg-ink p-4 font-mono text-[11px] leading-[1.5] text-paper/80"
          >
            {progress.text
              ? progress.text.slice(-6000)
              : progress.phase === "writing"
                ? "Thinking about the layout…"
                : ""}
          </pre>
        )}
        <div className="flex items-center justify-between gap-3 border-t-2 border-ink px-5 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            {progress.chars
              ? `${Math.round(progress.chars / 1000)}k characters`
              : "Usually 1-3 minutes"}
            {output === "html" && live ? (
              <button
                type="button"
                className="ml-3 underline"
                onClick={() => setShowCode((c) => !c)}
              >
                {showCode ? "Show page" : "Show code"}
              </button>
            ) : null}
          </span>
          <button type="button" onClick={onCancel} className="btn px-4 py-2">
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}
