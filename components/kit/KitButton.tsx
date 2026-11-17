"use client";

import Link from "next/link";
import { useKit } from "@/lib/kit/use-kit";

export default function KitButton() {
  const { kit, ready } = useKit();
  if (!ready || kit.length === 0) return null;
  return (
    <Link
      href="/build"
      className="inline-flex items-center gap-2 border-2 border-ink bg-ink px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-paper hover:bg-coral"
      title="Open the builder with your picked components"
    >
      Kit <span className="bg-coral px-1.5 text-paper">{kit.length}</span>
    </Link>
  );
}
