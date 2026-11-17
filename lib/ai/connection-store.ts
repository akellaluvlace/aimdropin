// Connect-your-own-AI - where the user's connection lives.
//
// The key stays in this browser. "Remember on this device" puts it in
// localStorage; otherwise sessionStorage, so it's gone when the tab closes.
// Every read/write is wrapped: storage can throw (private mode, blocked site
// data) and the app must still work, just without a remembered connection.

import {
  AI_PROVIDERS,
  type AiProviderId,
  detectProviderFromKey,
  looksLikeKey,
} from "./providers";

export interface AiConnection {
  provider: AiProviderId;
  key: string;
  // How the key arrived. "oauth" = Connect OpenRouter; "pasted" = typed in.
  via: "oauth" | "pasted";
  model: string;
  remember: boolean;
  connectedAt: string;
}

export const AI_CONNECTION_STORAGE_KEY = "aimdropin:ai:connection";
export const AI_CONNECTION_EVENT = "aimdropin:ai-connection-change";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function safeStorage(kind: "local" | "session"): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

// Parse-don't-validate: anything stored by an older build, or edited by hand,
// comes back as null instead of a half-valid object.
export function parseConnection(raw: string | null): AiConnection | null {
  if (!raw) return null;
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!j || typeof j !== "object") return null;
  const o = j as Record<string, unknown>;
  const provider = o.provider;
  if (
    provider !== "openrouter" &&
    provider !== "anthropic" &&
    provider !== "openai"
  ) {
    return null;
  }
  if (typeof o.key !== "string" || !looksLikeKey(o.key)) return null;
  const model =
    typeof o.model === "string" && o.model.trim()
      ? o.model.trim()
      : AI_PROVIDERS[provider].defaultModel;
  return {
    provider,
    key: o.key.trim(),
    via: o.via === "oauth" ? "oauth" : "pasted",
    model,
    remember: o.remember === true,
    connectedAt:
      typeof o.connectedAt === "string"
        ? o.connectedAt
        : new Date().toISOString(),
  };
}

export function loadConnection(): AiConnection | null {
  for (const kind of ["session", "local"] as const) {
    const store = safeStorage(kind);
    if (!store) continue;
    try {
      const c = parseConnection(store.getItem(AI_CONNECTION_STORAGE_KEY));
      if (c) return c;
    } catch {
      // fall through to the next store
    }
  }
  return null;
}

function notify(): void {
  try {
    window.dispatchEvent(new Event(AI_CONNECTION_EVENT));
  } catch {
    // SSR / no window
  }
}

export function saveConnection(c: AiConnection): void {
  const json = JSON.stringify(c);
  const target = safeStorage(c.remember ? "local" : "session");
  const other = safeStorage(c.remember ? "session" : "local");
  try {
    other?.removeItem(AI_CONNECTION_STORAGE_KEY);
  } catch {
    // ignore
  }
  try {
    target?.setItem(AI_CONNECTION_STORAGE_KEY, json);
  } catch {
    // Storage full or blocked: the connection lives only in memory for this
    // page via the event listeners' state.
  }
  notify();
}

export function clearConnection(): void {
  for (const kind of ["session", "local"] as const) {
    try {
      safeStorage(kind)?.removeItem(AI_CONNECTION_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  notify();
}

export function setConnectionModel(model: string): void {
  const c = loadConnection();
  if (!c || !model.trim()) return;
  saveConnection({ ...c, model: model.trim() });
}

export function connectionFromPastedKey(
  rawKey: string,
  opts: { provider?: AiProviderId; model?: string; remember: boolean },
): AiConnection | null {
  const key = rawKey.trim();
  if (!looksLikeKey(key)) return null;
  const provider = opts.provider ?? detectProviderFromKey(key);
  if (!provider) return null;
  return {
    provider,
    key,
    via: "pasted",
    model: opts.model?.trim() || AI_PROVIDERS[provider].defaultModel,
    remember: opts.remember,
    connectedAt: new Date().toISOString(),
  };
}
