"use client";

// Search box for /library. Updates ?q= as you type (debounced) and keeps the
// current tab and filters; the server component re-renders the results.

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function LibrarySearch({
  initialQuery,
}: {
  initialQuery: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  const timer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" focuses search, like most catalog sites.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        e.key === "/" &&
        t &&
        !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) &&
        !t.isContentEditable
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function push(next: string) {
    const sp = new URLSearchParams(params.toString());
    if (next.trim()) sp.set("q", next.trim());
    else sp.delete("q");
    sp.delete("page");
    sp.delete("category");
    const s = sp.toString();
    startTransition(() =>
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }),
    );
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) window.clearTimeout(timer.current);
        push(value);
      }}
      className="relative"
    >
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => push(v), 300);
        }}
        placeholder='Search: "pricing table", "dashboard sidebar", "animated button", "magicui"…'
        aria-label="Search the library"
        className="w-full border-2 border-ink bg-card px-4 py-4 pr-24 text-base outline-none placeholder:text-ink/40 focus:shadow-[4px_4px_0_0_#FF4D2E]"
      />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        {pending ? "Searching…" : "Press /"}
      </span>
    </form>
  );
}
