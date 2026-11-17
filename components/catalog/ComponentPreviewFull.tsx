"use client";

import FullscreenBar from "@/components/fullscreen/FullscreenBar";
import { useEffect, useState } from "react";
import RegistryPreviewSlot from "./RegistryPreviewSlot";
import { getComponentFull } from "@/lib/component-library/client";
import { buildPreviewDoc } from "@/lib/component-library/preview-doc";
import type { ComponentFull } from "@/lib/component-library/types";
import type { LibraryItem } from "@/lib/catalog/library";

// Full-screen preview of one component ("Preview" on its gallery tile).
export default function ComponentPreviewFull({ item, backHref }: { item: LibraryItem; backHref: string }) {
  const [dark, setDark] = useState(false);
  const [htmlFull, setHtmlFull] = useState<ComponentFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isRegistry = item.install.method === "shadcn" && !!item.install.url;
  const isHtml = !isRegistry && item.stack === "html";

  useEffect(() => {
    if (!isHtml) return;
    getComponentFull(item.name).then(setHtmlFull, (e) => setError(String(e)));
  }, [isHtml, item.name]);

  return (
    <div className="flex h-[100dvh] flex-col bg-paper font-sans text-ink">
      <FullscreenBar
        title={item.title}
        kind="Component"
        fallbackHref={backHref}
        primary={{ href: backHref, label: "Code & install", shortLabel: "Code" }}
      >
        {isRegistry && (
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            aria-pressed={dark}
            className="h-9 shrink-0 border-2 border-ink bg-paper px-3 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors hover:bg-ink hover:text-paper"
          >
            {dark ? "Light" : "Dark"}
          </button>
        )}
      </FullscreenBar>
      <div className={"min-h-0 flex-1 " + (dark ? "bg-[#0a0a0a]" : "bg-white")}>
        {isRegistry ? (
          <RegistryPreviewSlot installUrl={item.install.url as string} dark={dark} title={item.title} />
        ) : isHtml ? (
          htmlFull ? (
            <iframe title={`Preview: ${item.title}`} srcDoc={buildPreviewDoc(htmlFull)} sandbox="allow-scripts" className="h-full w-full border-0" />
          ) : (
            <p className="p-6 font-mono text-xs uppercase tracking-[0.2em] text-muted">{error ?? "Loading…"}</p>
          )
        ) : (
          <p className="p-6 font-mono text-xs uppercase tracking-[0.2em] text-muted">No live preview for this item.</p>
        )}
      </div>
    </div>
  );
}
