"use client";

import { useState } from "react";
import {
  addToKit,
  removeFromKit,
  KIT_MAX_ITEMS,
  type KitItem,
} from "@/lib/kit/kit-store";
import { useKit } from "@/lib/kit/use-kit";

export default function AddToKitButton({
  item,
  compact = false,
  className = "",
}: {
  item: Omit<KitItem, "note" | "addedAt">;
  compact?: boolean;
  className?: string;
}) {
  const { kit } = useKit();
  const [flash, setFlash] = useState<string | null>(null);
  const inKit = kit.some((k) => k.id === item.id);

  return (
    <button
      type="button"
      aria-pressed={inKit}
      title={
        inKit
          ? "Remove from your kit"
          : "Add to your kit, then build a page from it"
      }
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (inKit) {
          removeFromKit(item.id);
          return;
        }
        const r = addToKit(item);
        if (r === "full") {
          setFlash(`Kit is full (${KIT_MAX_ITEMS})`);
          window.setTimeout(() => setFlash(null), 2000);
        }
      }}
      className={
        "inline-flex items-center justify-center border-2 border-ink font-mono uppercase tracking-[0.15em] transition-colors " +
        (compact ? "px-2 py-1 text-[9px] " : "px-4 py-2.5 text-[11px] ") +
        (inKit
          ? "bg-ink text-paper hover:bg-coral"
          : "bg-card text-ink hover:bg-coral hover:text-paper") +
        " " +
        className
      }
    >
      {flash ?? (inKit ? "✓ In kit" : "+ Kit")}
    </button>
  );
}
