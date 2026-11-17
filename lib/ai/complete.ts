// Connect-your-own-AI - one streaming completion against the user's provider,
// called straight from the browser with the user's key.
//
//   • Anthropic: the official SDK with dangerouslyAllowBrowser (the key is the
//     user's own and never leaves their browser except to Anthropic).
//   • OpenRouter / OpenAI: Chat Completions over fetch + SSE, parsed with the
//     helpers in lib/sse.ts. Both send CORS headers for browser calls.
//
// Errors are normalised into AiError.kind so the UI can say something useful
// ("out of OpenRouter credits") instead of a raw status code.

import Anthropic from "@anthropic-ai/sdk";
import { extractOpenAIDelta, parseSseFrame, splitSseFrames } from "../sse";
import type { AiConnection } from "./connection-store";

export type AiErrorKind =
  | "auth"
  | "credits"
  | "rate_limit"
  | "bad_request"
  | "refusal"
  | "network"
  | "server"
  | "aborted";

export class AiError extends Error {
  readonly kind: AiErrorKind;
  readonly status: number | null;
  constructor(
    kind: AiErrorKind,
    message: string,
    status: number | null = null,
  ) {
    super(message);
    this.name = "AiError";
    this.kind = kind;
    this.status = status;
  }
}

export type AiStopReason = "end" | "max_tokens" | "refusal" | "other";

export interface CompletionRequest {
  connection: AiConnection;
  system: string;
  prompt: string;
  maxTokens?: number;
  // Anthropic Claude 5.x only; ignored elsewhere.
  effort?: "low" | "medium" | "high";
  signal?: AbortSignal;
  onText?: (delta: string, full: string) => void;
}

export interface CompletionResult {
  text: string;
  stopReason: AiStopReason;
  usage: { inputTokens: number; outputTokens: number } | null;
}

const APP_TITLE = "AIMdropin";
const DEFAULT_MAX_TOKENS = 32000;

export function messageForStatus(
  status: number,
  provider: AiConnection["provider"],
): AiError {
  const name =
    provider === "openrouter"
      ? "OpenRouter"
      : provider === "anthropic"
        ? "Anthropic"
        : "OpenAI";
  if (status === 401) {
    return new AiError(
      "auth",
      `${name} didn't accept this key. Reconnect or paste a new one.`,
      status,
    );
  }
  if (status === 402) {
    return new AiError(
      "credits",
      `Your ${name} account is out of credits. Top up, then try again.`,
      status,
    );
  }
  if (status === 403) {
    return new AiError(
      "auth",
      `${name} refused the request for this key (permissions or region).`,
      status,
    );
  }
  if (status === 404) {
    return new AiError(
      "bad_request",
      `${name} doesn't know this model. Pick another one in AI settings.`,
      status,
    );
  }
  if (status === 429) {
    return new AiError(
      "rate_limit",
      `${name} is rate-limiting this key. Wait a minute and try again.`,
      status,
    );
  }
  if (status >= 500) {
    return new AiError(
      "server",
      `${name} had a problem (${status}). Try again shortly.`,
      status,
    );
  }
  return new AiError(
    "bad_request",
    `${name} rejected the request (${status}).`,
    status,
  );
}

function isAbort(e: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  return (
    e instanceof Error &&
    (e.name === "AbortError" || e.name === "APIUserAbortError")
  );
}

// Claude 5.x models take output_config.effort; older or unknown ids might
// reject it, so only send it where we know it's accepted.
export function supportsEffort(model: string): boolean {
  return /^claude-(opus|sonnet|haiku|fable)-5/.test(model);
}

async function completeAnthropic(
  req: CompletionRequest,
): Promise<CompletionResult> {
  const { connection: c } = req;
  const client = new Anthropic({
    apiKey: c.key,
    dangerouslyAllowBrowser: true,
    maxRetries: 1,
  });
  let full = "";
  try {
    const stream = client.messages.stream(
      {
        model: c.model,
        max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        system: req.system,
        messages: [{ role: "user", content: req.prompt }],
        ...(req.effort && supportsEffort(c.model)
          ? { output_config: { effort: req.effort } }
          : {}),
      },
      { signal: req.signal },
    );
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        full += event.delta.text;
        req.onText?.(event.delta.text, full);
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      throw new AiError(
        "refusal",
        "The model declined this request. Try rewording the brief.",
      );
    }
    return {
      text: full,
      stopReason:
        final.stop_reason === "end_turn"
          ? "end"
          : final.stop_reason === "max_tokens"
            ? "max_tokens"
            : "other",
      usage: {
        inputTokens:
          final.usage.input_tokens +
          (final.usage.cache_read_input_tokens ?? 0) +
          (final.usage.cache_creation_input_tokens ?? 0),
        outputTokens: final.usage.output_tokens,
      },
    };
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (isAbort(e, req.signal)) throw new AiError("aborted", "Stopped.");
    if (e instanceof Anthropic.APIConnectionError) {
      throw new AiError(
        "network",
        "Couldn't reach Anthropic. Check your connection and try again.",
      );
    }
    if (e instanceof Anthropic.APIError && typeof e.status === "number") {
      throw messageForStatus(e.status, "anthropic");
    }
    throw new AiError(
      "server",
      e instanceof Error ? e.message : "Unknown error from Anthropic.",
    );
  }
}

export function chatCompletionsUrl(provider: "openrouter" | "openai"): string {
  return provider === "openrouter"
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
}

export function buildChatCompletionsBody(
  req: CompletionRequest,
): Record<string, unknown> {
  const c = req.connection;
  const maxTokens = req.maxTokens ?? DEFAULT_MAX_TOKENS;
  return {
    model: c.model,
    stream: true,
    stream_options: { include_usage: true },
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.prompt },
    ],
    // OpenAI's reasoning models only accept max_completion_tokens; OpenRouter
    // normalises max_tokens across providers.
    ...(c.provider === "openai"
      ? { max_completion_tokens: maxTokens }
      : { max_tokens: maxTokens }),
  };
}

// Pull usage + finish_reason out of a raw Chat Completions stream chunk.
export function readChunkMeta(data: string): {
  finishReason: string | null;
  usage: { inputTokens: number; outputTokens: number } | null;
  error: string | null;
} {
  try {
    const j = JSON.parse(data) as {
      choices?: Array<{ finish_reason?: string | null }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      error?: { message?: string };
    };
    const u = j.usage;
    return {
      finishReason: j.choices?.[0]?.finish_reason ?? null,
      usage:
        u &&
        typeof u.prompt_tokens === "number" &&
        typeof u.completion_tokens === "number"
          ? { inputTokens: u.prompt_tokens, outputTokens: u.completion_tokens }
          : null,
      error: j.error?.message ?? null,
    };
  } catch {
    return { finishReason: null, usage: null, error: null };
  }
}

async function completeChat(req: CompletionRequest): Promise<CompletionResult> {
  const c = req.connection;
  if (c.provider === "anthropic") throw new Error("unreachable");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${c.key}`,
  };
  if (c.provider === "openrouter") {
    headers["HTTP-Referer"] = window.location.origin;
    headers["X-Title"] = APP_TITLE;
  }
  let res: Response;
  try {
    res = await fetch(chatCompletionsUrl(c.provider), {
      method: "POST",
      headers,
      body: JSON.stringify(buildChatCompletionsBody(req)),
      signal: req.signal,
    });
  } catch (e) {
    if (isAbort(e, req.signal)) throw new AiError("aborted", "Stopped.");
    throw new AiError(
      "network",
      "Couldn't reach the AI provider. Check your connection and try again.",
    );
  }
  if (!res.ok || !res.body) throw messageForStatus(res.status, c.provider);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let finish: string | null = null;
  let usage: CompletionResult["usage"] = null;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { frames, remaining } = splitSseFrames(buffer);
      buffer = remaining;
      for (const frame of frames) {
        const evt = parseSseFrame(frame);
        if (!evt) continue;
        const delta = extractOpenAIDelta(evt);
        if (delta.text) {
          full += delta.text;
          req.onText?.(delta.text, full);
        }
        const meta = readChunkMeta(evt.data);
        if (meta.error) throw new AiError("server", meta.error);
        if (meta.finishReason) finish = meta.finishReason;
        if (meta.usage) usage = meta.usage;
      }
    }
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (isAbort(e, req.signal)) throw new AiError("aborted", "Stopped.");
    throw new AiError(
      "network",
      "The connection dropped mid-answer. Try again.",
    );
  }
  if (finish === "content_filter") {
    throw new AiError(
      "refusal",
      "The model declined this request. Try rewording the brief.",
    );
  }
  return {
    text: full,
    stopReason:
      finish === "stop" ? "end" : finish === "length" ? "max_tokens" : "other",
    usage,
  };
}

export async function complete(
  req: CompletionRequest,
): Promise<CompletionResult> {
  return req.connection.provider === "anthropic"
    ? completeAnthropic(req)
    : completeChat(req);
}

export interface KeyCheck {
  ok: boolean;
  error?: string;
  // Live model ids the key can use (when the provider lists them).
  models?: string[];
  // OpenRouter only: remaining credit on the key, in USD (null = no limit).
  creditRemaining?: number | null;
}

// Validate a key with the cheapest call each provider offers.
export async function checkKey(c: AiConnection): Promise<KeyCheck> {
  try {
    if (c.provider === "anthropic") {
      const client = new Anthropic({
        apiKey: c.key,
        dangerouslyAllowBrowser: true,
        maxRetries: 0,
      });
      const models: string[] = [];
      for await (const m of client.models.list({ limit: 100 }))
        models.push(m.id);
      return { ok: true, models };
    }
    if (c.provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${c.key}` },
      });
      if (!res.ok)
        return {
          ok: false,
          error: messageForStatus(res.status, "openai").message,
        };
      const j = (await res.json()) as { data?: Array<{ id?: string }> };
      return {
        ok: true,
        models: (j.data ?? [])
          .map((m) => m.id)
          .filter((x): x is string => typeof x === "string"),
      };
    }
    const res = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${c.key}` },
    });
    if (!res.ok)
      return {
        ok: false,
        error: messageForStatus(res.status, "openrouter").message,
      };
    const j = (await res.json()) as {
      data?: { limit_remaining?: number | null };
    };
    const remaining = j.data?.limit_remaining;
    return {
      ok: true,
      creditRemaining: typeof remaining === "number" ? remaining : null,
    };
  } catch (e) {
    if (e instanceof Anthropic.APIError && typeof e.status === "number") {
      return {
        ok: false,
        error: messageForStatus(e.status, "anthropic").message,
      };
    }
    return {
      ok: false,
      error: "Couldn't reach the provider to check the key.",
    };
  }
}
