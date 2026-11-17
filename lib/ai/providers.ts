// Connect-your-own-AI - provider + model registry.
//
// Users bring their own AI: either "Connect OpenRouter" (OAuth PKCE, their
// OpenRouter credits pay) or a pasted Anthropic / OpenAI / OpenRouter key.
// Every call goes straight from the browser to the provider; our server never
// sees the key. The preview iframes run with an opaque origin (no
// allow-same-origin), so template code can't read the key out of storage.
//
// Model ids below were checked against each provider's live model list on
// 2026-10-29. The picker also loads the live list after connecting, so new
// models show up without a code change; these presets are the fallback and
// the "recommended" ordering.

export type AiProviderId = "openrouter" | "anthropic" | "openai";

export interface AiModelPreset {
  id: string;
  label: string;
  // One line shown under the label in the picker.
  note: string;
  // USD per million tokens. null when we don't know (live models).
  inputPerMTok: number | null;
  outputPerMTok: number | null;
  recommended?: boolean;
}

export interface AiProviderInfo {
  id: AiProviderId;
  label: string;
  keyHint: string;
  keyUrl: string;
  defaultModel: string;
  models: ReadonlyArray<AiModelPreset>;
}

export const AI_PROVIDERS: Record<AiProviderId, AiProviderInfo> = {
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    keyHint: "sk-or-…",
    keyUrl: "https://openrouter.ai/settings/keys",
    defaultModel: "anthropic/claude-opus-5.5",
    models: [
      {
        id: "anthropic/claude-opus-5.5",
        label: "Claude Opus 5.5",
        note: "Best page quality. Roughly $0.20-0.60 per page.",
        inputPerMTok: 4,
        outputPerMTok: 20,
        recommended: true,
      },
      {
        id: "anthropic/claude-sonnet-5.5",
        label: "Claude Sonnet 5.5",
        note: "Close to Opus at half the price.",
        inputPerMTok: 2,
        outputPerMTok: 10,
      },
      {
        id: "openai/gpt-6.1-sol",
        label: "GPT-6.1 Sol",
        note: "OpenAI's current flagship.",
        inputPerMTok: 2,
        outputPerMTok: 10,
      },
      {
        id: "google/gemini-4-argon",
        label: "Gemini 4 Argon",
        note: "Google's current flagship.",
        inputPerMTok: 2,
        outputPerMTok: 10,
      },
      {
        id: "anthropic/claude-haiku-5.5",
        label: "Claude Haiku 5.5",
        note: "Fast and cheap. Good for small edits.",
        inputPerMTok: 0.1,
        outputPerMTok: 0.5,
      },
    ],
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    keyHint: "sk-ant-…",
    keyUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: "claude-opus-5-5",
    models: [
      {
        id: "claude-opus-5-5",
        label: "Claude Opus 5.5",
        note: "Best page quality. Roughly $0.20-0.60 per page.",
        inputPerMTok: 4,
        outputPerMTok: 20,
        recommended: true,
      },
      {
        id: "claude-sonnet-5-5",
        label: "Claude Sonnet 5.5",
        note: "Close to Opus at half the price.",
        inputPerMTok: 2,
        outputPerMTok: 10,
      },
      {
        id: "claude-haiku-5-5",
        label: "Claude Haiku 5.5",
        note: "Fast and cheap. Good for small edits.",
        inputPerMTok: 0.1,
        outputPerMTok: 0.5,
      },
    ],
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    keyHint: "sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-6.1-sol",
    models: [
      {
        id: "gpt-6.1-sol",
        label: "GPT-6.1 Sol",
        note: "OpenAI's current flagship.",
        inputPerMTok: 2,
        outputPerMTok: 10,
        recommended: true,
      },
      {
        id: "gpt-6-luna",
        label: "GPT-6 Luna",
        note: "Fast and cheap. Good for small edits.",
        inputPerMTok: 0.1,
        outputPerMTok: 0.5,
      },
    ],
  },
};

export const AI_PROVIDER_ORDER: ReadonlyArray<AiProviderId> = [
  "openrouter",
  "anthropic",
  "openai",
];

// Guess the provider from a pasted key's prefix. Order matters: Anthropic and
// OpenRouter keys also start with "sk-".
export function detectProviderFromKey(raw: string): AiProviderId | null {
  const key = raw.trim();
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("sk-or-")) return "openrouter";
  if (key.startsWith("sk-")) return "openai";
  return null;
}

// Cheap shape check before any network call: no whitespace inside, plausible
// length. The real check is the live model-list request.
export function looksLikeKey(raw: string): boolean {
  const key = raw.trim();
  return key.length >= 20 && key.length <= 400 && !/\s/.test(key);
}

export function findPreset(
  provider: AiProviderId,
  modelId: string,
): AiModelPreset | null {
  return AI_PROVIDERS[provider].models.find((m) => m.id === modelId) ?? null;
}

// "sk-or-v1-abcd…wxyz" - enough to recognise the key, not enough to use it.
export function maskKey(raw: string): string {
  const key = raw.trim();
  if (key.length <= 12) return "••••";
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

export function estimateCostUsd(
  inputTokens: number,
  outputTokens: number,
  preset: Pick<AiModelPreset, "inputPerMTok" | "outputPerMTok"> | null,
): number | null {
  if (!preset || preset.inputPerMTok == null || preset.outputPerMTok == null) {
    return null;
  }
  return (
    (inputTokens / 1e6) * preset.inputPerMTok +
    (outputTokens / 1e6) * preset.outputPerMTok
  );
}
