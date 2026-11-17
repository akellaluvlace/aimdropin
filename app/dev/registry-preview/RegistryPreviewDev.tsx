"use client";

import { useState } from "react";
import RegistryPreview from "@/components/registry-preview/RegistryPreview";

export default function RegistryPreviewDev({
  urls,
  single,
  theme,
}: {
  urls: string[];
  single: boolean;
  theme: "light" | "dark";
}) {
  const [status, setStatus] = useState<Record<string, string>>({});
  return (
    <main className="space-y-6 p-6 font-sans">
      {urls.map((u) => (
        <section key={u} className="space-y-2">
          <div className="flex gap-3 font-mono text-xs">
            <span>{u}</span>
            <span id={single ? "rp-status" : undefined} data-status={status[u] ?? "pending"}>
              {status[u] ?? "pending"}
            </span>
          </div>
          <RegistryPreview
            installUrl={u}
            theme={theme}
            height={single ? "85vh" : 480}
            className="rounded-lg border border-ink/10"
            onStatus={(s, m) => setStatus((p) => ({ ...p, [u]: m ? `${s}: ${m}` : s }))}
          />
        </section>
      ))}
    </main>
  );
}
