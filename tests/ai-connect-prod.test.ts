import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  AI_PROVIDERS,
  detectProviderFromKey,
  estimateCostUsd,
  findPreset,
  looksLikeKey,
  maskKey,
} from "../lib/ai/providers";
import {
  connectionFromPastedKey,
  parseConnection,
} from "../lib/ai/connection-store";
import {
  buildAuthUrl,
  challengeFromVerifier,
  exchangeCodeForKey,
  parsePendingPkce,
  safeReturnTo,
} from "../lib/ai/openrouter-oauth";
import {
  buildChatCompletionsBody,
  messageForStatus,
  readChunkMeta,
  supportsEffort,
} from "../lib/ai/complete";

const OR_KEY = "sk-or-v1-0123456789abcdef0123456789abcdef";
const ANT_KEY = "sk-ant-api03-0123456789abcdef0123456789";
const OAI_KEY = "sk-proj-0123456789abcdef0123456789abcdef";

describe("providers", () => {
  it("detects the provider from the key prefix", () => {
    expect(detectProviderFromKey(OR_KEY)).toBe("openrouter");
    expect(detectProviderFromKey(`  ${ANT_KEY}\n`)).toBe("anthropic");
    expect(detectProviderFromKey(OAI_KEY)).toBe("openai");
    expect(detectProviderFromKey("AIza-not-supported")).toBeNull();
  });

  it("rejects things that aren't keys", () => {
    expect(looksLikeKey("sk-short")).toBe(false);
    expect(looksLikeKey("sk-ant-has a space in it 0123456789")).toBe(false);
    expect(looksLikeKey(ANT_KEY)).toBe(true);
  });

  it("masks keys", () => {
    expect(maskKey(OR_KEY)).toBe("sk-or-v1…cdef");
    expect(maskKey("short")).toBe("••••");
    expect(maskKey(OR_KEY)).not.toContain("0123456789");
  });

  it("defaults every provider to a recommended preset", () => {
    for (const p of Object.values(AI_PROVIDERS)) {
      const preset = findPreset(p.id, p.defaultModel);
      expect(preset?.recommended).toBe(true);
    }
    expect(AI_PROVIDERS.anthropic.defaultModel).toBe("claude-opus-5-5");
    expect(AI_PROVIDERS.openrouter.defaultModel).toBe(
      "anthropic/claude-opus-5.5",
    );
  });

  it("estimates cost from per-million prices", () => {
    const opus = findPreset("anthropic", "claude-opus-5-5");
    expect(estimateCostUsd(30_000, 12_000, opus)).toBeCloseTo(0.12 + 0.24, 6);
    expect(estimateCostUsd(1, 1, null)).toBeNull();
  });
});

describe("connection store", () => {
  it("builds a connection from a pasted key", () => {
    const c = connectionFromPastedKey(` ${ANT_KEY} `, { remember: false });
    expect(c).toMatchObject({
      provider: "anthropic",
      key: ANT_KEY,
      via: "pasted",
      model: "claude-opus-5-5",
    });
    expect(connectionFromPastedKey("nope", { remember: true })).toBeNull();
    expect(
      connectionFromPastedKey("xyz-0123456789abcdef0123456789", {
        remember: true,
      }),
    ).toBeNull();
    expect(
      connectionFromPastedKey("xyz-0123456789abcdef0123456789", {
        provider: "openrouter",
        remember: true,
      })?.provider,
    ).toBe("openrouter");
  });

  it("parses stored connections defensively", () => {
    expect(parseConnection(null)).toBeNull();
    expect(parseConnection("{not json")).toBeNull();
    expect(
      parseConnection(JSON.stringify({ provider: "gemini", key: OR_KEY })),
    ).toBeNull();
    expect(
      parseConnection(JSON.stringify({ provider: "openrouter", key: "x" })),
    ).toBeNull();
    const c = parseConnection(
      JSON.stringify({ provider: "openrouter", key: OR_KEY, via: "oauth" }),
    );
    expect(c).toMatchObject({
      via: "oauth",
      model: "anthropic/claude-opus-5.5",
      remember: false,
    });
  });
});

describe("OpenRouter OAuth PKCE", () => {
  it("derives the S256 challenge as base64url(sha256(verifier))", async () => {
    const verifier = "a".repeat(43) + "-_~.";
    const expected = createHash("sha256").update(verifier).digest("base64url");
    expect(await challengeFromVerifier(verifier)).toBe(expected);
  });

  it("builds the auth URL", () => {
    const u = new URL(
      buildAuthUrl({
        callbackUrl: "http://localhost:3000/connect/openrouter/callback",
        challenge: "abc",
        state: "st",
        keyLabel: "AIMdropin",
      }),
    );
    expect(u.origin + u.pathname).toBe("https://openrouter.ai/auth");
    expect(u.searchParams.get("callback_url")).toBe(
      "http://localhost:3000/connect/openrouter/callback",
    );
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("state")).toBe("st");
  });

  it("only returns to same-site paths", () => {
    expect(safeReturnTo("/build?x=1")).toBe("/build?x=1");
    expect(safeReturnTo("https://evil.example")).toBe("/");
    expect(safeReturnTo("//evil.example")).toBe("/");
    expect(safeReturnTo("/\\evil.example")).toBe("/");
    expect(safeReturnTo(null)).toBe("/");
  });

  it("parses pending PKCE state and sanitises returnTo", () => {
    expect(parsePendingPkce(null)).toBeNull();
    expect(parsePendingPkce('{"verifier":"v"}')).toBeNull();
    const p = parsePendingPkce(
      JSON.stringify({
        verifier: "v",
        state: "s",
        createdAt: 1,
        returnTo: "//evil",
        remember: true,
      }),
    );
    expect(p).toEqual({
      verifier: "v",
      state: "s",
      createdAt: 1,
      returnTo: "/",
      remember: true,
    });
  });

  it("exchanges the code for a key", async () => {
    let body: unknown = null;
    const okFetch = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ key: OR_KEY }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await exchangeCodeForKey("c0de", "ver", okFetch)).toEqual({
      ok: true,
      key: OR_KEY,
    });
    expect(body).toEqual({
      code: "c0de",
      code_verifier: "ver",
      code_challenge_method: "S256",
    });

    const denied = (async () =>
      new Response("{}", { status: 403 })) as unknown as typeof fetch;
    const r = await exchangeCodeForKey("c", "v", denied);
    expect(r.ok).toBe(false);

    const offline = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect((await exchangeCodeForKey("c", "v", offline)).ok).toBe(false);
  });
});

describe("completion helpers", () => {
  const base = {
    provider: "openrouter" as const,
    key: OR_KEY,
    via: "oauth" as const,
    model: "anthropic/claude-opus-5.5",
    remember: true,
    connectedAt: "2026-10-29T00:00:00Z",
  };

  it("uses max_completion_tokens for OpenAI and max_tokens elsewhere", () => {
    const or = buildChatCompletionsBody({
      connection: base,
      system: "s",
      prompt: "p",
      maxTokens: 100,
    });
    expect(or).toMatchObject({
      max_tokens: 100,
      stream: true,
      model: "anthropic/claude-opus-5.5",
    });
    const oai = buildChatCompletionsBody({
      connection: { ...base, provider: "openai", model: "gpt-6.1-sol" },
      system: "s",
      prompt: "p",
      maxTokens: 100,
    });
    expect(oai).toMatchObject({ max_completion_tokens: 100 });
    expect(oai).not.toHaveProperty("max_tokens");
  });

  it("reads finish reason, usage and errors from stream chunks", () => {
    expect(
      readChunkMeta('{"choices":[{"finish_reason":"length"}]}').finishReason,
    ).toBe("length");
    expect(
      readChunkMeta(
        '{"choices":[],"usage":{"prompt_tokens":5,"completion_tokens":7}}',
      ).usage,
    ).toEqual({
      inputTokens: 5,
      outputTokens: 7,
    });
    expect(readChunkMeta('{"error":{"message":"boom"}}').error).toBe("boom");
    expect(readChunkMeta("[DONE]")).toEqual({
      finishReason: null,
      usage: null,
      error: null,
    });
  });

  it("maps HTTP statuses to user-facing errors", () => {
    expect(messageForStatus(401, "openrouter").kind).toBe("auth");
    expect(messageForStatus(402, "openrouter").message).toMatch(
      /out of credits/,
    );
    expect(messageForStatus(429, "anthropic").kind).toBe("rate_limit");
    expect(messageForStatus(503, "openai").kind).toBe("server");
  });

  it("only sends effort to Claude 5.x models", () => {
    expect(supportsEffort("claude-opus-5-5")).toBe(true);
    expect(supportsEffort("claude-haiku-5-5")).toBe(true);
    expect(supportsEffort("claude-3-5-sonnet-latest")).toBe(false);
    expect(supportsEffort("gpt-6.1-sol")).toBe(false);
  });
});
