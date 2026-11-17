"use client";

// Header pill: "Connect AI" when nothing is connected, otherwise the model in
// use. Opens AiConnectDialog either way.

import { useState } from "react";
import dynamic from "next/dynamic";

// The dialog pulls in the provider SDKs; load it only when someone opens it,
// so every page with the header doesn't pay for it.
const AiConnectDialog = dynamic(() => import("./AiConnectDialog"), {
  ssr: false,
});
import { AI_PROVIDERS, findPreset } from "@/lib/ai/providers";
import { useAiConnection } from "@/lib/ai/use-ai-connection";

export default function AiStatusButton({
  className = "",
}: {
  className?: string;
}) {
  const { connection, ready } = useAiConnection();
  const [open, setOpen] = useState(false);

  const label = !ready
    ? "AI"
    : connection
      ? (findPreset(connection.provider, connection.model)?.label ??
        connection.model)
      : "Connect AI";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={
          connection
            ? `${AI_PROVIDERS[connection.provider].label} · ${connection.model}`
            : "Connect OpenRouter or paste your own key"
        }
        className={
          "inline-flex items-center gap-2 border-2 border-ink px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors " +
          (connection
            ? "bg-card hover:bg-soft"
            : "bg-coral text-paper hover:bg-ink hover:text-coral") +
          " " +
          className
        }
      >
        <span
          aria-hidden
          className={
            "h-2 w-2 rounded-full " +
            (connection ? "bg-emerald-500" : "bg-paper")
          }
        />
        <span className="max-w-[22ch] truncate">{label}</span>
      </button>
      {open ? <AiConnectDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
