"use client";

// Live preview of a React shadcn-registry item. Fetches the PreviewPlan from
// /api/registry/bundle, builds the iframe document (lib/registry-preview/
// srcdoc.ts) and renders it in the same opaque-origin sandbox as every other
// preview: `allow-scripts` without `allow-same-origin`, so registry code can't
// reach the app's storage (where users' AI keys live) or its DOM.
//
// Usage:
//   <RegistryPreview installUrl={item.install.url} height={560}
//     onStatus={(s, msg) => …} />
// `onStatus("error")` means "preview unavailable" - the item's code and
// install command still work, so callers should keep those visible.

import { useEffect, useMemo, useRef, useState } from "react";
import { buildRegistryPreviewDocument } from "@/lib/registry-preview/srcdoc";
import type { PreviewPlan } from "@/lib/registry-preview/types";

export type RegistryPreviewStatus = "ok" | "error";

interface RegistryPreviewProps {
  installUrl: string;
  height?: number | string;
  theme?: "light" | "dark";
  className?: string;
  title?: string;
  onStatus?: (status: RegistryPreviewStatus, message?: string) => void;
  // Give up if the iframe hasn't reported by then (CDN stalls, huge deps).
  timeoutMs?: number;
}

type State =
  | { phase: "loading" }
  | { phase: "ready"; plan: PreviewPlan }
  | { phase: "error"; message: string };

export default function RegistryPreview({
  installUrl,
  height = 520,
  theme = "light",
  className,
  title,
  onStatus,
  timeoutMs = 45_000,
}: RegistryPreviewProps) {
  const [state, setState] = useState<State>({ phase: "loading" });
  const [rendered, setRendered] = useState<RegistryPreviewStatus | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  useEffect(() => {
    let active = true;
    setState({ phase: "loading" });
    setRendered(null);
    fetch(`/api/registry/bundle?url=${encodeURIComponent(installUrl)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
        return body as PreviewPlan;
      })
      .then((plan) => active && setState({ phase: "ready", plan }))
      .catch((e: unknown) => {
        if (!active) return;
        const message = e instanceof Error ? e.message : String(e);
        setState({ phase: "error", message });
        onStatusRef.current?.("error", message);
      });
    return () => {
      active = false;
    };
  }, [installUrl]);

  const srcDoc = useMemo(
    () => (state.phase === "ready" ? buildRegistryPreviewDocument(state.plan, { theme }) : null),
    [state, theme],
  );

  useEffect(() => {
    if (!srcDoc) return;
    let done = false;
    const finish = (status: RegistryPreviewStatus, message?: string) => {
      if (done) return;
      done = true;
      setRendered(status);
      onStatusRef.current?.(status, message);
    };
    const onMessage = (ev: MessageEvent) => {
      if (ev.source !== iframeRef.current?.contentWindow) return;
      const d = ev.data;
      if (!d || d.__dropin !== true || d.type !== "registry-preview:status") return;
      finish(d.status === "ok" ? "ok" : "error", d.message ?? undefined);
    };
    window.addEventListener("message", onMessage);
    const timer = setTimeout(() => finish("error", "Preview timed out"), timeoutMs);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
    };
  }, [srcDoc, timeoutMs]);

  return (
    <div
      className={`relative overflow-hidden ${className ?? ""}`}
      style={{ height }}
      data-preview-status={rendered ?? state.phase}
    >
      {srcDoc && (
        <iframe
          ref={iframeRef}
          title={title ?? "Component preview"}
          srcDoc={srcDoc}
          // SECURITY: no allow-same-origin - registry code runs in an opaque
          // origin and can't touch the app's storage, cookies or DOM.
          sandbox="allow-scripts allow-popups allow-forms"
          className="h-full w-full border-0 bg-white"
          loading="lazy"
        />
      )}
      {(state.phase === "loading" || (srcDoc && rendered === null)) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-paper/70 text-xs text-ink/60">
          Loading live preview…
        </div>
      )}
      {state.phase === "error" && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-ink/70">
          <div>
            <div className="font-medium text-ink">Live preview unavailable</div>
            <div className="mt-1 text-xs">{state.message}</div>
          </div>
        </div>
      )}
    </div>
  );
}
