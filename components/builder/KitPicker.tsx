"use client";

// Side drawer on /build: search the library and add pieces to the kit
// without leaving the builder.

import { useEffect, useRef, useState } from "react";
import Portal from "@/components/ui/Portal";
import AddToKitButton from "@/components/kit/AddToKitButton";
import { kitItemFromLibrary, type KitSourceItem } from "@/lib/kit/from-library";

const TABS = [
  ["section", "Sections"],
  ["component", "Components"],
  ["landing", "Landing pages"],
  ["dashboard", "Dashboards"],
  ["screen", "App screens"],
  ["all", "All"],
] as const;

type Tab = (typeof TABS)[number][0];

export default function KitPicker({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("section");
  const [items, setItems] = useState<KitSourceItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      const sp = new URLSearchParams({ tab });
      if (q.trim()) sp.set("q", q.trim());
      fetch(`/api/catalog/search?${sp}`, { signal: ac.signal })
        .then((r) =>
          r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
        )
        .then((j: { items: KitSourceItem[]; total: number }) => {
          setItems(j.items);
          setTotal(j.total);
          setError(null);
        })
        .catch((e) => {
          if (!ac.signal.aborted) setError("Search failed. Try again.");
          void e;
        });
    }, 250);
    return () => {
      ac.abort();
      window.clearTimeout(t);
    };
  }, [q, tab]);

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[65] flex justify-end bg-ink/50"
        onClick={onClose}
      >
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Add pieces to your kit"
          className="flex h-full w-full max-w-xl flex-col border-l-2 border-ink bg-paper"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-3 border-b-2 border-ink p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl">Add pieces</h2>
              <button type="button" onClick={onClose} className="btn px-3 py-2">
                Done
              </button>
            </div>
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="hero, pricing, testimonials, navbar, footer…"
              aria-label="Search the library"
              className="w-full border-2 border-ink bg-card px-3 py-2.5 text-sm outline-none focus:border-coral"
            />
            <div className="flex flex-wrap gap-1.5">
              {TABS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={tab === id}
                  onClick={() => setTab(id)}
                  className={
                    "border-2 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] " +
                    (tab === id
                      ? "border-ink bg-ink text-paper"
                      : "border-ink/25 hover:border-ink")
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {error ? <p className="text-sm text-coral">{error}</p> : null}
            {items === null ? (
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
                Loading…
              </p>
            ) : items.length === 0 ? (
              <p className="text-sm text-ink/70">Nothing matches that.</p>
            ) : (
              <>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  {total.toLocaleString("en-US")} results
                  {total > items.length ? ` · top ${items.length}` : ""}
                </p>
                <ul className="grid grid-cols-2 gap-3">
                  {items.map((i) => (
                    <li
                      key={i.id}
                      className="flex flex-col border-2 border-ink bg-card"
                    >
                      <a
                        href={`/library/${i.id.split("/").map(encodeURIComponent).join("/")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block aspect-[16/10] overflow-hidden border-b-2 border-ink bg-soft"
                        title="Open details in a new tab"
                      >
                        {i.thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={i.thumb}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover object-top"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center p-2 text-center font-display text-lg leading-tight text-ink/70">
                            {i.title}
                          </span>
                        )}
                      </a>
                      <div className="flex flex-1 items-start justify-between gap-2 p-2">
                        <span className="min-w-0">
                          <span className="line-clamp-2 text-xs font-medium">
                            {i.title}
                          </span>
                          <span className="block font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                            {i.src.replace(/^@/, "")} · {i.kind}
                          </span>
                        </span>
                        <AddToKitButton item={kitItemFromLibrary(i)} compact />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </aside>
      </div>
    </Portal>
  );
}
