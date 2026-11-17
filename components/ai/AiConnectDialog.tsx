"use client";

// "Connect your AI" - one dialog for both ways in:
//   1. Connect OpenRouter (OAuth PKCE; one click, their credits pay)
//   2. Paste a key (Anthropic, OpenAI or OpenRouter; provider auto-detected)
// Once connected it becomes the settings view: provider, masked key, model
// picker, disconnect. The key never leaves the browser except to the provider.

import { useEffect, useMemo, useState } from "react";
import {
  AI_PROVIDERS,
  AI_PROVIDER_ORDER,
  type AiProviderId,
  detectProviderFromKey,
  findPreset,
  looksLikeKey,
  maskKey,
} from "@/lib/ai/providers";
import {
  clearConnection,
  connectionFromPastedKey,
  saveConnection,
  setConnectionModel,
} from "@/lib/ai/connection-store";
import { checkKey } from "@/lib/ai/complete";
import { startOpenRouterConnect } from "@/lib/ai/openrouter-oauth";
import { useAiConnection } from "@/lib/ai/use-ai-connection";
import Portal from "@/components/ui/Portal";

interface Props {
  onClose: () => void;
  // Path to come back to after the OpenRouter round trip.
  returnTo?: string;
}

interface LiveModel {
  id: string;
  name: string;
  inPerM: number | null;
  outPerM: number | null;
}

let openRouterModelsCache: LiveModel[] | null = null;

async function loadOpenRouterModels(): Promise<LiveModel[]> {
  if (openRouterModelsCache) return openRouterModelsCache;
  const res = await fetch("https://openrouter.ai/api/v1/models");
  if (!res.ok) throw new Error(String(res.status));
  const j = (await res.json()) as {
    data?: Array<{
      id: string;
      name?: string;
      pricing?: { prompt?: string; completion?: string };
    }>;
  };
  const num = (s: string | undefined) =>
    s != null && Number.isFinite(Number(s)) ? Number(s) * 1e6 : null;
  openRouterModelsCache = (j.data ?? [])
    .filter((m) => !m.id.endsWith(":batch"))
    .map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      inPerM: num(m.pricing?.prompt),
      outPerM: num(m.pricing?.completion),
    }));
  return openRouterModelsCache;
}

function money(n: number | null): string {
  if (n == null) return "?";
  return n < 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(n % 1 ? 2 : 0)}`;
}

export default function AiConnectDialog({ onClose, returnTo }: Props) {
  const { connection, ready } = useAiConnection();
  const [pasted, setPasted] = useState("");
  const [providerOverride, setProviderOverride] = useState<AiProviderId | null>(
    null,
  );
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState<"oauth" | "paste" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveModels, setLiveModels] = useState<LiveModel[] | null>(null);
  const [modelQuery, setModelQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const detected = detectProviderFromKey(pasted);
  const pasteProvider = providerOverride ?? detected;

  async function connectOpenRouter() {
    setError(null);
    setBusy("oauth");
    try {
      await startOpenRouterConnect({
        returnTo: returnTo ?? window.location.pathname + window.location.search,
        remember,
      });
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function connectPasted() {
    setError(null);
    const c = connectionFromPastedKey(pasted, {
      provider: pasteProvider ?? undefined,
      remember,
    });
    if (!c) {
      setError(
        looksLikeKey(pasted)
          ? "We couldn't tell which provider this key is for. Pick one below."
          : "That doesn't look like an API key.",
      );
      return;
    }
    setBusy("paste");
    const check = await checkKey(c);
    setBusy(null);
    if (!check.ok) {
      setError(check.error ?? "That key didn't work.");
      return;
    }
    // Prefer the recommended model if the key can use it; otherwise the
    // provider default stays and the user can pick from the live list.
    if (check.models?.length) {
      setLiveModels(
        check.models.map((id) => ({
          id,
          name: id,
          inPerM: null,
          outPerM: null,
        })),
      );
    }
    saveConnection(c);
    setPasted("");
  }

  async function openAllModels() {
    setShowAll(true);
    if (!connection || liveModels) return;
    if (connection.provider === "openrouter") {
      try {
        setLiveModels(await loadOpenRouterModels());
      } catch {
        setError(
          "Couldn't load OpenRouter's model list. The recommended models still work.",
        );
      }
    } else {
      const check = await checkKey(connection);
      if (check.ok && check.models) {
        setLiveModels(
          check.models.map((id) => ({
            id,
            name: id,
            inPerM: null,
            outPerM: null,
          })),
        );
      }
    }
  }

  const filteredLive = useMemo(() => {
    if (!liveModels) return [];
    const q = modelQuery.trim().toLowerCase();
    const list = q
      ? liveModels.filter(
          (m) =>
            m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
        )
      : liveModels;
    return list.slice(0, 80);
  }, [liveModels, modelQuery]);

  const provider = connection ? AI_PROVIDERS[connection.provider] : null;
  const currentPreset = connection
    ? findPreset(connection.provider, connection.model)
    : null;

  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Connect your AI"
        className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/70 p-4"
        onClick={onClose}
      >
        <div
          className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden border-2 border-ink bg-paper shadow-[8px_8px_0_0_#FF4D2E]"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-start justify-between gap-4 border-b-2 border-ink px-5 py-4">
            <div>
              <h2 className="font-display text-2xl leading-tight">
                {connection ? "Your AI" : "Connect your AI"}
              </h2>
              <p className="mt-1 text-sm text-ink/70">
                AIMdropin builds pages with your own AI account. You pay your
                provider directly; your key stays in this browser and is only
                sent to them.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="btn px-3 py-2"
            >
              Close
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {!ready ? (
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
                Loading…
              </p>
            ) : connection && provider ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3 border-2 border-ink bg-card px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                      Connected · {provider.label} ·{" "}
                      {connection.via === "oauth" ? "signed in" : "pasted key"}
                    </p>
                    <p className="mt-1 truncate font-mono text-sm">
                      {maskKey(connection.key)}
                    </p>
                    <p className="mt-1 text-xs text-ink/60">
                      {connection.remember
                        ? "Remembered on this device."
                        : "Forgotten when this tab closes."}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn px-3 py-2"
                    onClick={() => {
                      clearConnection();
                      setLiveModels(null);
                      setShowAll(false);
                    }}
                  >
                    Disconnect
                  </button>
                </div>

                <fieldset>
                  <legend className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                    Model
                  </legend>
                  <div className="mt-2 space-y-2">
                    {provider.models.map((m) => (
                      <label
                        key={m.id}
                        className={
                          "flex cursor-pointer items-start gap-3 border-2 px-3 py-2 " +
                          (connection.model === m.id
                            ? "border-ink bg-card"
                            : "border-ink/20 hover:border-ink")
                        }
                      >
                        <input
                          type="radio"
                          name="ai-model"
                          className="mt-1 accent-[#FF4D2E]"
                          checked={connection.model === m.id}
                          onChange={() => setConnectionModel(m.id)}
                        />
                        <span className="min-w-0">
                          <span className="font-medium">
                            {m.label}
                            {m.recommended ? (
                              <span className="ml-2 bg-coral px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-paper">
                                Recommended
                              </span>
                            ) : null}
                          </span>
                          <span className="block text-xs text-ink/60">
                            {m.note} {money(m.inputPerMTok)} in /{" "}
                            {money(m.outputPerMTok)} out per million tokens.
                          </span>
                        </span>
                      </label>
                    ))}
                    {!currentPreset ? (
                      <p className="border-2 border-ink bg-card px-3 py-2 text-sm">
                        Using{" "}
                        <span className="font-mono">{connection.model}</span>
                      </p>
                    ) : null}
                  </div>

                  {!showAll ? (
                    <button
                      type="button"
                      className="mt-3 text-sm underline"
                      onClick={openAllModels}
                    >
                      Use a different model…
                    </button>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <input
                        type="search"
                        value={modelQuery}
                        onChange={(e) => setModelQuery(e.target.value)}
                        placeholder="Search models"
                        className="w-full border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:border-coral"
                      />
                      {liveModels == null ? (
                        <p className="text-sm text-ink/60">Loading models…</p>
                      ) : (
                        <ul className="max-h-56 overflow-y-auto border-2 border-ink bg-white">
                          {filteredLive.map((m) => (
                            <li key={m.id}>
                              <button
                                type="button"
                                onClick={() => setConnectionModel(m.id)}
                                className={
                                  "flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm hover:bg-soft " +
                                  (connection.model === m.id ? "bg-soft" : "")
                                }
                              >
                                <span className="truncate font-mono text-xs">
                                  {m.id}
                                </span>
                                {m.inPerM != null ? (
                                  <span className="shrink-0 font-mono text-[10px] text-muted">
                                    {money(m.inPerM)}/{money(m.outPerM)}
                                  </span>
                                ) : null}
                              </button>
                            </li>
                          ))}
                          {filteredLive.length === 0 ? (
                            <li className="px-3 py-2 text-sm text-ink/60">
                              No match.
                            </li>
                          ) : null}
                        </ul>
                      )}
                      <p className="text-xs text-ink/60">
                        Pages come out best with the recommended model. Cheaper
                        models are fine for small edits.
                      </p>
                    </div>
                  )}
                </fieldset>
              </div>
            ) : (
              <div className="space-y-6">
                <section>
                  <button
                    type="button"
                    onClick={connectOpenRouter}
                    disabled={busy !== null}
                    className="btn btn-accent w-full py-4 text-sm"
                  >
                    {busy === "oauth"
                      ? "Opening OpenRouter…"
                      : "Connect OpenRouter"}
                  </button>
                  <p className="mt-2 text-xs text-ink/60">
                    One sign-in gives you Claude, GPT, Gemini and hundreds more
                    on your OpenRouter credits. You can set a spending limit and
                    revoke access any time in OpenRouter.
                  </p>
                </section>

                <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  <span className="h-px flex-1 bg-ink/20" /> or paste a key{" "}
                  <span className="h-px flex-1 bg-ink/20" />
                </div>

                <section className="space-y-3">
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={pasted}
                    onChange={(e) => {
                      setPasted(e.target.value);
                      setProviderOverride(null);
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && pasted.trim()) connectPasted();
                    }}
                    placeholder="sk-ant-…, sk-or-… or sk-…"
                    aria-label="API key"
                    className="w-full border-2 border-ink bg-white px-3 py-3 font-mono text-sm outline-none focus:border-coral"
                  />
                  <div
                    className="flex flex-wrap gap-2"
                    role="radiogroup"
                    aria-label="Provider"
                  >
                    {AI_PROVIDER_ORDER.map((id) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={pasteProvider === id}
                        onClick={() => setProviderOverride(id)}
                        className={
                          "border-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] " +
                          (pasteProvider === id
                            ? "border-ink bg-ink text-paper"
                            : "border-ink/30 hover:border-ink")
                        }
                      >
                        {AI_PROVIDERS[id].label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={connectPasted}
                    disabled={busy !== null || !pasted.trim()}
                    className="btn w-full disabled:opacity-50"
                  >
                    {busy === "paste" ? "Checking key…" : "Connect key"}
                  </button>
                  <p className="text-xs text-ink/60">
                    Get a key:{" "}
                    {AI_PROVIDER_ORDER.map((id, i) => (
                      <span key={id}>
                        {i > 0 ? " · " : ""}
                        <a
                          href={AI_PROVIDERS[id].keyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {AI_PROVIDERS[id].label}
                        </a>
                      </span>
                    ))}
                  </p>
                </section>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="accent-[#FF4D2E]"
                  />
                  Remember on this device
                </label>
              </div>
            )}

            {error ? (
              <p
                role="alert"
                className="mt-4 border-2 border-coral bg-card px-3 py-2 text-sm text-ink"
              >
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </Portal>
  );
}
