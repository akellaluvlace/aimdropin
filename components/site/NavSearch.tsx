"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Site-wide search: a field on wide screens, an icon that opens one on
// narrow screens. Submits to /gallery/search, which searches every section.
export default function NavSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/gallery/search?q=${encodeURIComponent(term)}` : "/gallery/search");
    setOpen(false);
  };

  const field = (
    <input
      ref={inputRef}
      type="search"
      name="q"
      value={q}
      onChange={(e) => setQ(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
      placeholder={placeholder}
      aria-label="Search all pages, dashboards and components"
      className="h-10 w-full border-2 border-ink bg-paper pl-9 pr-3 font-mono text-[11px] tracking-normal text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-coral"
    />
  );
  const icon = (
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="20" y1="20" x2="15.5" y2="15.5" />
    </svg>
  );

  return (
    <>
      <form onSubmit={submit} role="search" className="relative hidden w-44 xl:block xl:w-56">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">{icon}</span>
        {field}
      </form>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Search"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center border-2 border-ink bg-paper shadow-brut-sm hover:bg-ink hover:text-paper xl:hidden"
      >
        {icon}
      </button>
      {open ? (
        <form onSubmit={submit} role="search" className="absolute inset-x-0 top-full z-50 border-b-2 border-ink bg-paper px-4 py-3 shadow-brut xl:hidden">
          <div className="relative mx-auto max-w-[1400px]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">{icon}</span>
            {field}
          </div>
        </form>
      ) : null}
    </>
  );
}
