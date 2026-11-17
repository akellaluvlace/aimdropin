// Connect OpenRouter - OAuth PKCE, entirely in the browser.
//
// Flow (https://openrouter.ai/docs/guides/overview/auth/oauth):
//   1. make a random verifier, send the user to openrouter.ai/auth with its
//      S256 challenge and our callback URL;
//   2. OpenRouter redirects back with ?code=…;
//   3. POST code + verifier to /api/v1/auth/keys → { key }.
// The key is a normal OpenRouter API key owned by the user, billed to their
// credits, revocable from their OpenRouter settings. Codes expire after 10
// minutes and are single-use. Localhost callbacks work on any port.

export const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";
export const OPENROUTER_KEY_EXCHANGE_URL =
  "https://openrouter.ai/api/v1/auth/keys";
export const OPENROUTER_CALLBACK_PATH = "/connect/openrouter/callback";

const PKCE_STORAGE_KEY = "aimdropin:ai:openrouter-pkce";

export interface PendingPkce {
  verifier: string;
  state: string;
  // Where to send the user after connecting (a same-site path).
  returnTo: string;
  remember: boolean;
  createdAt: number;
}

export function base64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function challengeFromVerifier(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64Url(new Uint8Array(digest));
}

export function buildAuthUrl(opts: {
  callbackUrl: string;
  challenge: string;
  state: string;
  keyLabel?: string;
}): string {
  const u = new URL(OPENROUTER_AUTH_URL);
  u.searchParams.set("callback_url", opts.callbackUrl);
  u.searchParams.set("code_challenge", opts.challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("state", opts.state);
  if (opts.keyLabel) u.searchParams.set("key_label", opts.keyLabel);
  return u.toString();
}

// Only same-site paths: an open redirect here would let a crafted link bounce
// a freshly connected user to another site.
export function safeReturnTo(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/";
  }
  return raw;
}

export function parsePendingPkce(raw: string | null): PendingPkce | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<PendingPkce>;
    if (
      typeof o.verifier !== "string" ||
      typeof o.state !== "string" ||
      typeof o.createdAt !== "number"
    ) {
      return null;
    }
    return {
      verifier: o.verifier,
      state: o.state,
      returnTo: safeReturnTo(o.returnTo),
      remember: o.remember === true,
      createdAt: o.createdAt,
    };
  } catch {
    return null;
  }
}

// Codes live 10 minutes; give the whole round trip a little longer.
export const PKCE_MAX_AGE_MS = 15 * 60 * 1000;

export async function startOpenRouterConnect(opts: {
  returnTo: string;
  remember: boolean;
}): Promise<void> {
  const verifier = randomToken(48);
  const state = randomToken(16);
  const challenge = await challengeFromVerifier(verifier);
  const pending: PendingPkce = {
    verifier,
    state,
    returnTo: safeReturnTo(opts.returnTo),
    remember: opts.remember,
    createdAt: Date.now(),
  };
  // sessionStorage survives the round trip in the same tab. If it is blocked
  // we can't complete PKCE, so surface that instead of a silent failure.
  try {
    window.sessionStorage.setItem(PKCE_STORAGE_KEY, JSON.stringify(pending));
  } catch {
    throw new Error(
      "Your browser blocked site storage, so we can't finish connecting. Paste an OpenRouter key instead.",
    );
  }
  const callbackUrl = `${window.location.origin}${OPENROUTER_CALLBACK_PATH}`;
  window.location.assign(
    buildAuthUrl({ callbackUrl, challenge, state, keyLabel: "AIMdropin" }),
  );
}

export function takePendingPkce(): PendingPkce | null {
  try {
    const raw = window.sessionStorage.getItem(PKCE_STORAGE_KEY);
    window.sessionStorage.removeItem(PKCE_STORAGE_KEY);
    return parsePendingPkce(raw);
  } catch {
    return null;
  }
}

export type ExchangeResult =
  | { ok: true; key: string }
  | { ok: false; error: string };

export async function exchangeCodeForKey(
  code: string,
  verifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ExchangeResult> {
  let res: Response;
  try {
    res = await fetchImpl(OPENROUTER_KEY_EXCHANGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        code_verifier: verifier,
        code_challenge_method: "S256",
      }),
    });
  } catch {
    return {
      ok: false,
      error: "Couldn't reach OpenRouter. Check your connection and try again.",
    };
  }
  if (!res.ok) {
    if (res.status === 403) {
      return {
        ok: false,
        error:
          "OpenRouter rejected the sign-in (it may have expired). Try connecting again.",
      };
    }
    return {
      ok: false,
      error: `OpenRouter returned an error (${res.status}). Try again.`,
    };
  }
  try {
    const j = (await res.json()) as { key?: unknown };
    if (typeof j.key === "string" && j.key.length > 0)
      return { ok: true, key: j.key };
  } catch {
    // fall through
  }
  return {
    ok: false,
    error: "OpenRouter didn't return a key. Try connecting again.",
  };
}
