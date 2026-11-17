"use client";

// Builder - the one-pass flow: kit + brief → one strong model writes the
// whole page → automatic layout check → at most one fix-up request.
// Refines reuse the same check-and-fix tail.

import { buildPreviewDocument } from "@/lib/preview";
import { complete, type CompletionResult } from "@/lib/ai/complete";
import type { AiConnection } from "@/lib/ai/connection-store";
import { estimateCostUsd, findPreset } from "@/lib/ai/providers";
import {
  buildFixPrompt,
  buildRefinePrompt,
  buildSystemPrompt,
  buildUserPrompt,
  extractPage,
  type BuildBrief,
  type BuildOutput,
  type KitPromptItem,
  type LayoutProblem,
} from "./prompt";
import { runLayoutCheck } from "./layout-check";

export type BuildPhase =
  | "collecting"
  | "writing"
  | "checking"
  | "fixing"
  | "done";

export interface BuildProgress {
  phase: BuildPhase;
  // Characters of code received so far in the current request.
  chars: number;
  // Live text of the current reply (for the "watch it write" pane).
  text: string;
  problems?: LayoutProblem[];
}

export interface BuildOutcome {
  code: string;
  incomplete: boolean;
  // Problems still present after the fix-up (usually none).
  problems: LayoutProblem[];
  fixedProblems: LayoutProblem[];
  costUsd: number | null;
  inputTokens: number;
  outputTokens: number;
}

// Page generation is long output; thinking models spend part of the budget
// on reasoning first.
const PAGE_MAX_TOKENS = 48000;

// Problems worth a fix-up request. A timeout usually means a heavy page or
// slow CDN rather than a bug, so it's reported but not "fixed".
function fixable(p: LayoutProblem): boolean {
  return p.kind !== "timeout";
}

interface Ctx {
  connection: AiConnection;
  output: BuildOutput;
  signal?: AbortSignal;
  onProgress: (p: BuildProgress) => void;
  usage: { input: number; output: number; cost: number | null };
}

async function ask(
  ctx: Ctx,
  phase: BuildPhase,
  system: string,
  prompt: string,
): Promise<CompletionResult> {
  ctx.onProgress({ phase, chars: 0, text: "" });
  const r = await complete({
    connection: ctx.connection,
    system,
    prompt,
    maxTokens: PAGE_MAX_TOKENS,
    effort: "high",
    signal: ctx.signal,
    onText: (_d, full) =>
      ctx.onProgress({ phase, chars: full.length, text: full }),
  });
  if (r.usage) {
    ctx.usage.input += r.usage.inputTokens;
    ctx.usage.output += r.usage.outputTokens;
    // null stays null: we don't know this model's price.
    const c = estimateCostUsd(
      r.usage.inputTokens,
      r.usage.outputTokens,
      findPreset(ctx.connection.provider, ctx.connection.model),
    );
    ctx.usage.cost =
      ctx.usage.cost == null || c == null ? null : ctx.usage.cost + c;
  }
  return r;
}

export function previewDocFor(code: string, output: BuildOutput): string {
  return buildPreviewDocument({
    code,
    kind: output === "html" ? "html" : "jsx",
  });
}

async function checkAndFix(
  ctx: Ctx,
  code: string,
  incomplete: boolean,
): Promise<Omit<BuildOutcome, "costUsd" | "inputTokens" | "outputTokens">> {
  ctx.onProgress({ phase: "checking", chars: code.length, text: "" });
  let problems = await runLayoutCheck(() => previewDocFor(code, ctx.output));
  if (incomplete) {
    problems = [
      {
        kind: "truncated",
        detail:
          "The file was cut off before the end. Finish the page; keep it within the same design.",
      },
      ...problems,
    ];
  }
  const toFix = problems.filter(fixable);
  if (!toFix.length) return { code, incomplete, problems, fixedProblems: [] };

  ctx.onProgress({ phase: "fixing", chars: 0, text: "", problems: toFix });
  const r = await ask(
    ctx,
    "fixing",
    buildSystemPrompt(ctx.output),
    buildFixPrompt(code, ctx.output, toFix),
  );
  const fixed = extractPage(r.text, ctx.output);
  // A fix-up that comes back shorter than half the page dropped content;
  // keep the original rather than lose sections.
  if (!fixed.code || fixed.code.length < code.length * 0.5) {
    return { code, incomplete, problems, fixedProblems: [] };
  }
  ctx.onProgress({ phase: "checking", chars: fixed.code.length, text: "" });
  const after = await runLayoutCheck(() =>
    previewDocFor(fixed.code, ctx.output),
  );
  const remaining = after.filter(fixable);
  const fixedProblems = toFix.filter(
    (p) =>
      !remaining.some((q) => q.kind === p.kind && q.viewport === p.viewport),
  );
  return {
    code: fixed.code,
    incomplete: fixed.incomplete,
    problems: after,
    fixedProblems,
  };
}

function outcome(
  ctx: Ctx,
  r: Omit<BuildOutcome, "costUsd" | "inputTokens" | "outputTokens">,
): BuildOutcome {
  ctx.onProgress({ phase: "done", chars: r.code.length, text: "" });
  return {
    ...r,
    costUsd: ctx.usage.cost,
    inputTokens: ctx.usage.input,
    outputTokens: ctx.usage.output,
  };
}

function emptyUsage(connection: AiConnection) {
  const preset = findPreset(connection.provider, connection.model);
  return { input: 0, output: 0, cost: preset?.inputPerMTok != null ? 0 : null };
}

export async function generatePage(opts: {
  connection: AiConnection;
  brief: BuildBrief;
  kit: KitPromptItem[];
  signal?: AbortSignal;
  onProgress: (p: BuildProgress) => void;
}): Promise<BuildOutcome> {
  const ctx: Ctx = {
    connection: opts.connection,
    output: opts.brief.output,
    signal: opts.signal,
    onProgress: opts.onProgress,
    usage: emptyUsage(opts.connection),
  };
  const r = await ask(
    ctx,
    "writing",
    buildSystemPrompt(opts.brief.output),
    buildUserPrompt(opts.brief, opts.kit),
  );
  const page = extractPage(r.text, opts.brief.output);
  if (!page.code.trim())
    throw new Error(
      "The AI replied without any code. Try again, or try another model.",
    );
  return outcome(
    ctx,
    await checkAndFix(
      ctx,
      page.code,
      page.incomplete || r.stopReason === "max_tokens",
    ),
  );
}

export async function refinePage(opts: {
  connection: AiConnection;
  code: string;
  output: BuildOutput;
  instruction: string;
  signal?: AbortSignal;
  onProgress: (p: BuildProgress) => void;
}): Promise<BuildOutcome> {
  const ctx: Ctx = {
    connection: opts.connection,
    output: opts.output,
    signal: opts.signal,
    onProgress: opts.onProgress,
    usage: emptyUsage(opts.connection),
  };
  const r = await ask(
    ctx,
    "writing",
    buildSystemPrompt(opts.output),
    buildRefinePrompt(opts.code, opts.output, opts.instruction),
  );
  const page = extractPage(r.text, opts.output);
  if (!page.code.trim())
    throw new Error(
      "The AI replied without any code. Try rephrasing the change.",
    );
  return outcome(
    ctx,
    await checkAndFix(
      ctx,
      page.code,
      page.incomplete || r.stopReason === "max_tokens",
    ),
  );
}
