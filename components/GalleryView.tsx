"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import KindToggle from "./KindToggle";
import MarqueeLanes from "./MarqueeLanes";
import GalleryTile from "./gallery/GalleryTile";
import { useRemoteCards, type RemoteSource } from "./gallery/useRemoteCards";
import { applyGalleryFilter, galleryCounts, type ActiveFilter, type GalleryCounts } from "@/lib/gallery/filter";
import type { FacetGroup, GalleryCard, GallerySortKey } from "@/lib/gallery/types";
import type { TemplateKind } from "@/lib/templates";

type ViewMode = "carousel" | "list";

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: "carousel", label: "Carousel" },
  { id: "list", label: "List" },
];

// Below this count the marquee feels redundant - each lane would only loop
// 1-2 unique cards on itself. Fall through to a static grid instead.
const MARQUEE_THRESHOLD = 15;
const MARQUEE_LANES = 3;
const LANE_DURATIONS = ["90s", "110s", "80s"];
const LANE_REVERSALS = [1]; // middle lane runs counter-flow

// Mobile-only: below this count, render cards as a centered vertical stack
// (each tile gets full attention). At or above it, a horizontally-swipeable
// two-row carousel the user drives with a finger.
const MOBILE_CAROUSEL_THRESHOLD = 18;

export interface GalleryViewProps {
  cards: GalleryCard[];
  facets: FacetGroup[];
  // Curated keys in display order. When set, "Our picks" is the default view
  // and keeps this order whatever the sort.
  picks?: readonly string[];
  // Landing pages only: the JSX/HTML switch at the top of the sidebar.
  kindPref?: TemplateKind | null;
  sorts: { id: GallerySortKey; label: string }[];
  defaultSort: GallerySortKey;
  // Many facet values: show group headings and let the pill list scroll.
  groupedFacets?: boolean;
  // What the cards are, for labels ("templates", "dashboards").
  noun: string;
  // Too many cards to ship (Components): the server searches, filters,
  // counts and pages; `cards`/`facets` are then ignored.
  remote?: RemoteSource;
  // Search to start with (?q= from the gallery-wide search).
  initialQuery?: string;
}

export default function GalleryView({
  cards,
  facets,
  picks = [],
  kindPref = null,
  sorts,
  defaultSort,
  groupedFacets = false,
  noun,
  remote,
  initialQuery = "",
}: GalleryViewProps) {
  // Dev-only fast-fail when a picks key no longer matches a card (renamed
  // template): the pill would silently show N-1 cards.
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !picks.length) return;
    const keys = new Set(cards.map((c) => c.key));
    const missing = picks.filter((k) => !keys.has(k));
    if (missing.length) console.warn("[GalleryView] picks contain unknown keys (renamed or removed?):", missing);
  }, [cards, picks]);

  const hasPicks = picks.length > 0;
  const [query, setQuery] = useState(initialQuery);
  // A search arriving from elsewhere searches everything, not just the picks.
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(hasPicks && !initialQuery ? { kind: "picks" } : null);
  const [sort, setSort] = useState<GallerySortKey>(defaultSort);
  const [searchOpen, setSearchOpen] = useState(Boolean(initialQuery));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  // Hydration-safe view mode: SSR and first client render agree on
  // "carousel"; the stored preference is applied after mount.
  const [viewMode, setViewMode] = useState<ViewMode>("carousel");
  const viewModeHydratedRef = useRef(false);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("dropin:gallery:view");
      if (stored === "list" || stored === "carousel") setViewMode(stored);
    } catch {
      // private mode → state-only
    }
    viewModeHydratedRef.current = true;
  }, []);
  useEffect(() => {
    if (!viewModeHydratedRef.current) return;
    try {
      window.localStorage.setItem("dropin:gallery:view", viewMode);
    } catch {
      // private mode → state-only
    }
  }, [viewMode]);

  const deferredQuery = useDeferredValue(query);
  // Remote sections debounce typing a little more: each change is a request.
  const [remoteQuery, setRemoteQuery] = useState(initialQuery);
  useEffect(() => {
    if (!remote) return;
    const t = window.setTimeout(() => setRemoteQuery(deferredQuery), 250);
    return () => window.clearTimeout(t);
  }, [remote, deferredQuery]);
  const remoteState = useRemoteCards(remote, remoteQuery, activeFilter, sort);
  const localCounts = useMemo(
    () => (remote ? null : galleryCounts(cards, { query: deferredQuery, picks, facets })),
    [remote, cards, deferredQuery, picks, facets],
  );
  const localFiltered = useMemo(
    () => (remote ? [] : applyGalleryFilter(cards, { query: deferredQuery, active: activeFilter, sort, picks })),
    [remote, cards, deferredQuery, activeFilter, sort, picks],
  );
  const counts: GalleryCounts = remoteState?.counts ?? localCounts ?? { all: 0, picks: 0, byFacet: new Map() };
  const filtered = remoteState?.cards ?? localFiltered;
  const shownFacets = remoteState?.facets ?? facets;

  const picksActive = activeFilter?.kind === "picks";
  // Paged results don't loop: remote sections always use the grid.
  const useMarquee = !remote && filtered.length >= MARQUEE_THRESHOLD;
  const lanes = useMemo(() => {
    if (!useMarquee || picksActive) return [];
    const rows: GalleryCard[][] = Array.from({ length: MARQUEE_LANES }, () => []);
    filtered.forEach((c, i) => rows[i % MARQUEE_LANES].push(c));
    return rows;
  }, [filtered, useMarquee, picksActive]);

  const setFilterAndCloseMobile = (f: ActiveFilter) => {
    setActiveFilter(f);
    setMobileMenuOpen(false);
  };
  const sortLockTitle = picksActive ? "Sort is fixed to the curated order for Our picks" : undefined;

  const searchControls = (
    <>
      <SearchToggle
        open={searchOpen}
        value={query}
        hasQuery={query.length > 0}
        onToggle={() => {
          const next = !searchOpen;
          setSearchOpen(next);
          if (!next) setQuery("");
        }}
      />
      {searchOpen && (
        <SearchInput
          value={query}
          noun={noun}
          onChange={setQuery}
          onClose={() => {
            setSearchOpen(false);
            setQuery("");
          }}
        />
      )}
    </>
  );

  return (
    <>
      {/* Mobile top bar - filters + sort + view. lg+ uses the sidebar. */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b-2 border-ink bg-paper px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open filters menu"
          aria-expanded={mobileMenuOpen}
          className="inline-flex items-center gap-2 border-2 border-ink bg-paper px-3 py-2 font-mono text-[11px] uppercase tracking-[0.15em] hover:bg-ink hover:text-paper"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          <span>Filters</span>
          {activeFilter !== null && (
            <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[9px] font-bold text-paper" aria-label="Active filter indicator">
              •
            </span>
          )}
        </button>
        <SortSelect sorts={sorts} value={sort} onChange={setSort} disabled={picksActive} title={sortLockTitle} noun={noun} />
        <ViewSelect value={viewMode} onChange={setViewMode} />
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-paper lg:hidden" role="dialog" aria-modal="true" aria-label="Gallery filters">
          <header className="sticky top-0 flex items-center justify-between border-b-2 border-ink bg-paper px-4 py-3">
            <span className="font-display text-xl">Filters</span>
            <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Close filters" className="font-mono text-2xl leading-none text-ink hover:text-coral">
              ×
            </button>
          </header>
          <div className="space-y-3 p-4">
            {kindPref && <KindToggle current={kindPref} size="block" />}
            {searchControls}
            <p className="mb-1 px-1 pt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted">Browse</p>
            <FilterSidebar facets={shownFacets} counts={counts} hasPicks={hasPicks} grouped={groupedFacets} active={activeFilter} onSelect={setFilterAndCloseMobile} noun={noun} />
          </div>
        </div>
      )}

      <div className="grid h-full w-full grid-cols-1 gap-y-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-x-0">
        <aside aria-label="Gallery filters" className="hidden px-6 lg:block lg:px-0 lg:pb-3 lg:pl-6 lg:pr-3">
          <div className="flex flex-col gap-1 pt-4 lg:h-full lg:min-h-0">
            {kindPref && <KindToggle current={kindPref} size="block" />}
            <SortSelect sorts={sorts} value={sort} onChange={setSort} disabled={picksActive} title={sortLockTitle} noun={noun} />
            <ViewSelect value={viewMode} onChange={setViewMode} />
            {searchControls}
            <div className="my-1 border-t-2 border-ink" aria-hidden="true" />
            <p className="mb-1 px-1 font-mono text-[10px] uppercase tracking-[0.3em] text-muted">Browse</p>
            <FilterSidebar facets={shownFacets} counts={counts} hasPicks={hasPicks} grouped={groupedFacets} active={activeFilter} onSelect={setActiveFilter} noun={noun} />
          </div>
        </aside>

        <div className="min-w-0 pb-14 lg:flex lg:flex-col lg:overflow-y-auto lg:pb-3 lg:pr-0">
          <div className="pt-4 lg:flex lg:flex-1 lg:flex-col lg:min-h-0">
            {remoteState?.error && (
              <p className="mx-6 mb-3 border-2 border-coral bg-paper px-3 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-coral lg:mx-0" role="alert">
                {remoteState.error}
              </p>
            )}
            {filtered.length === 0 && !remoteState?.loading ? (
              <div className="mx-6 lg:mx-0">
                <div className="card p-10 text-center">
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Nothing matches</p>
                  <p className="mt-3 font-display text-2xl">
                    {picksActive && deferredQuery.trim()
                      ? "No picks match your search. Try clearing it."
                      : activeFilter && !deferredQuery.trim()
                        ? "Try a different filter or pick All."
                        : !activeFilter && deferredQuery.trim()
                          ? "Try clearing the search."
                          : "Try loosening your filters or clearing the search."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setActiveFilter(null);
                      setSearchOpen(false);
                    }}
                    className="btn mt-6"
                  >
                    Reset filters
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="lg:hidden">
                  <MobileCardView cards={filtered} viewMode={viewMode} onReachEnd={remoteState?.hasMore && !remoteState.error ? remoteState.loadMore : undefined} />
                </div>
                {/* lg:contents keeps the inner views in the parent flex chain
                    (their flex-1 / lane height logic depends on it). */}
                <div className="hidden lg:contents">
                  {viewMode === "list" ? (
                    <ListView cards={filtered} />
                  ) : useMarquee && !picksActive ? (
                    <MarqueeLanes
                      rows={lanes}
                      reverseLanes={LANE_REVERSALS}
                      durations={LANE_DURATIONS}
                      className="space-y-3 lg:flex lg:flex-1 lg:flex-col lg:justify-between lg:space-y-0"
                    />
                  ) : (
                    <StaticGrid cards={filtered} />
                  )}
                </div>
                {remoteState && <LoadMore state={remoteState} shown={filtered.length} noun={noun} />}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// "Load more" for paged sections; also loads by itself when scrolled into view.
function LoadMore({ state, shown, noun }: { state: NonNullable<ReturnType<typeof useRemoteCards>>; shown: number; noun: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { hasMore, loading, loadMore, error } = state;
  useEffect(() => {
    const el = ref.current;
    // After a failed load only the button retries. This observer is rebuilt on
    // every render and reports straight away, so retrying from here would
    // hammer a server that just said "too many requests".
    if (!el || !hasMore || error) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      // The phone carousel grows sideways, so this block never scrolls out of
      // view there and would keep loading until the whole section was in the
      // page. The carousel asks for more from its own right-hand end instead.
      const carousel = document.querySelector<HTMLElement>("[data-gallery-carousel]");
      if (carousel && carousel.offsetParent !== null) return;
      loadMore();
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore, error]);
  return (
    <div ref={ref} className="flex flex-col items-center gap-2 px-6 py-8 lg:px-1">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
        {shown.toLocaleString("en-US")} of {state.total.toLocaleString("en-US")} {noun}
      </p>
      {hasMore && (
        <button type="button" onClick={loadMore} disabled={loading} className="btn">
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}

function SearchToggle({ open, hasQuery, value, onToggle }: { open: boolean; hasQuery: boolean; value: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? "Close search" : "Open search"}
      title={hasQuery ? `Search: "${value}"` : "Search"}
      className={
        "flex h-9 w-full items-center justify-between gap-2 border-2 border-ink px-3 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors " +
        (open || hasQuery ? "bg-ink text-paper hover:bg-coral hover:text-paper" : "bg-paper text-ink hover:bg-sun")
      }
    >
      <span className="flex items-center gap-2">
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" strokeLinejoin="miter">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <line x1="20" y1="20" x2="15.5" y2="15.5" />
        </svg>
        <span>Search</span>
      </span>
      <span aria-hidden="true" className="font-mono text-[10px] tracking-[0.2em]">
        {open ? "Close" : "/"}
      </span>
    </button>
  );
}

function SearchInput({ value, noun, onChange, onClose }: { value: string; noun: string; onChange: (v: string) => void; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  return (
    <label className="relative block">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">/</span>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        placeholder="Search…"
        className="h-9 w-full border-2 border-ink bg-paper px-8 font-mono text-xs uppercase tracking-[0.1em] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-coral"
        aria-label={`Search ${noun}`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 border border-ink bg-paper px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted hover:bg-ink hover:text-paper"
          aria-label="Clear search"
        >
          Clear
        </button>
      )}
    </label>
  );
}

function SortSelect({
  sorts,
  value,
  onChange,
  disabled,
  title,
  noun,
}: {
  sorts: { id: GallerySortKey; label: string }[];
  value: GallerySortKey;
  onChange: (v: GallerySortKey) => void;
  disabled?: boolean;
  title?: string;
  noun: string;
}) {
  return (
    <div className="relative" title={title}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as GallerySortKey)}
        aria-label={`Sort ${noun}`}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        className={`h-9 w-full appearance-none border-2 border-ink bg-paper px-3 pr-9 font-mono text-[11px] uppercase tracking-[0.18em] text-ink focus:outline-none focus:ring-2 focus:ring-coral${disabled ? " cursor-not-allowed opacity-50" : ""}`}
      >
        {sorts.map((s) => (
          <option key={s.id} value={s.id}>
            Sort · {s.label}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] tracking-[0.2em]">
        ▾
      </span>
    </div>
  );
}

function ViewSelect({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ViewMode)}
        aria-label="View mode"
        className="h-9 w-full appearance-none border-2 border-ink bg-paper px-3 pr-9 font-mono text-[11px] uppercase tracking-[0.18em] text-ink focus:outline-none focus:ring-2 focus:ring-coral"
      >
        {VIEW_MODES.map((v) => (
          <option key={v.id} value={v.id}>
            View · {v.label}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] tracking-[0.2em]">
        ▾
      </span>
    </div>
  );
}

// One flat list of pills: Our picks (when curated), All, then every facet
// value. Picking one replaces the previous selection. Ungrouped (landing
// pages) the pills stretch to fill the bounded sidebar height; grouped
// (dashboards) they keep their height, get headings and the list scrolls.
function FilterSidebar({
  facets,
  counts,
  hasPicks,
  grouped,
  active,
  onSelect,
  noun,
}: {
  facets: FacetGroup[];
  counts: GalleryCounts;
  hasPicks: boolean;
  grouped: boolean;
  active: ActiveFilter;
  onSelect: (f: ActiveFilter) => void;
  noun: string;
}) {
  return (
    <nav
      aria-label={`Filter ${noun}`}
      className={"flex flex-col gap-1 lg:min-h-0 lg:flex-1 " + (grouped ? "lg:overflow-y-auto lg:pr-1" : "")}
    >
      {hasPicks && (
        <FilterButton label="Our picks" count={counts.picks} selected={active?.kind === "picks"} stretch={!grouped} onClick={() => onSelect({ kind: "picks" })} />
      )}
      <FilterButton label="All" count={counts.all} selected={active === null} stretch={!grouped} onClick={() => onSelect(null)} />
      {facets.map((g) => (
        <div key={g.id} className={grouped ? "mt-2 flex flex-col gap-1" : "contents"}>
          {grouped && <p className="px-1 pt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-muted">{g.label}</p>}
          {g.values.map((v) => (
            <FilterButton
              key={`${g.id}-${v}`}
              label={v}
              count={counts.byFacet.get(`${g.id}:${v}`) ?? 0}
              selected={active?.kind === "facet" && active.facet === g.id && active.value === v}
              stretch={!grouped}
              onClick={() => onSelect({ kind: "facet", facet: g.id, value: v })}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

function FilterButton({ label, count, selected, stretch, onClick }: { label: string; count: number; selected: boolean; stretch: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        "flex min-h-9 w-full items-center justify-between gap-3 border-2 border-ink px-3 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors " +
        (stretch ? "lg:flex-1 lg:basis-0 " : "shrink-0 ") +
        (selected ? "bg-ink text-paper shadow-[3px_3px_0_0_#FF4D2E]" : "bg-paper text-ink hover:bg-sun")
      }
    >
      <span className="truncate text-left">{label}</span>
      <span className={"shrink-0 font-mono text-[10px] tabular-nums tracking-[0.1em] " + (selected ? "text-paper/70" : "text-muted")}>{count}</span>
    </button>
  );
}

// Mobile: list rows, a centered stack under the threshold, or a two-row
// swipe carousel at or above it.
function MobileCardView({ cards, viewMode, onReachEnd }: { cards: GalleryCard[]; viewMode: ViewMode; onReachEnd?: () => void }) {
  if (viewMode === "list") {
    return (
      <ul className="flex list-none flex-col px-4 pb-10">
        {cards.map((c) => (
          <li key={c.key}>
            <Link href={c.selectHref} prefetch={false} className="flex items-center justify-between gap-3 border-b border-ink/15 py-3.5 transition-colors hover:bg-ink/5">
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-display text-base leading-tight">{c.title}</span>
                <span className="truncate font-mono text-[9px] uppercase tracking-[0.2em] text-muted">{c.subtitle}</span>
              </div>
              {c.chips[0] && <span className={`chip shrink-0 ${c.chips[0].accent ? "chip-accent" : ""}`}>{c.chips[0].label.toUpperCase()}</span>}
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  if (cards.length < MOBILE_CAROUSEL_THRESHOLD) {
    return (
      <div className="flex flex-col items-center gap-4 px-5 pb-10">
        {cards.map((c, i) => (
          <div key={c.key} className="w-full max-w-[400px]">
            <GalleryTile card={c} eager={i < 2} />
          </div>
        ))}
      </div>
    );
  }
  return <MobileCarousel cards={cards} onReachEnd={onReachEnd} />;
}

// The two-row swipe carousel. For paged sections it loads the next page when
// the swipe gets near its right-hand end.
function MobileCarousel({ cards, onReachEnd }: { cards: GalleryCard[]; onReachEnd?: () => void }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = scrollerRef.current;
    const end = endRef.current;
    if (!root || !end || !onReachEnd) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) onReachEnd();
    }, { root, rootMargin: "0px 900px 0px 0px" });
    io.observe(end);
    return () => io.disconnect();
  }, [onReachEnd]);
  return (
    <div>
      <div aria-hidden="true" className="flex items-center justify-center gap-2 px-4 pb-2 pt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
        <span>←</span>
        <span>Hold and swipe to scroll</span>
        <span>→</span>
      </div>
      <div
        ref={scrollerRef}
        data-gallery-carousel
        className="grid snap-x snap-mandatory grid-flow-col grid-rows-2 gap-3 overflow-x-auto scroll-pl-5 pb-10 pl-5 pr-5"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {cards.map((c, i) => (
          <div key={c.key} className="w-[70vw] max-w-[280px] snap-start">
            <GalleryTile card={c} eager={i < 3} />
          </div>
        ))}
        {onReachEnd && <div ref={endRef} aria-hidden="true" className="row-span-2 w-px" />}
      </div>
    </div>
  );
}

function StaticGrid({ cards }: { cards: GalleryCard[] }) {
  return (
    <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 px-1 pr-6">
      {cards.map((c, i) => (
        <li key={c.key} className="min-w-0">
          <GalleryTile card={c} eager={i < 3} />
        </li>
      ))}
    </ul>
  );
}

// Compact name rows; hover/focus pops the full tile (thumbnail + actions)
// over the row, anchored on it so the cursor never crosses a gap.
function ListView({ cards }: { cards: GalleryCard[] }) {
  return (
    <ul className="grid list-none grid-cols-1 gap-2 px-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {cards.map((c) => (
        <li key={c.key} className="group relative">
          <div
            tabIndex={0}
            aria-label={`${c.title} - hover for actions`}
            className="flex h-12 w-full cursor-default items-center justify-between gap-2 border-2 border-ink bg-paper px-3 transition-colors hover:bg-soft group-focus-within:bg-soft"
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-display text-sm leading-tight">{c.title}</span>
              <span className="truncate font-mono text-[9px] uppercase tracking-[0.2em] text-muted">{c.subtitle}</span>
            </div>
            {c.chips[0] && <span className={`chip shrink-0 ${c.chips[0].accent ? "chip-accent" : ""}`}>{c.chips[0].label.toUpperCase()}</span>}
          </div>
          <div className="pointer-events-none invisible absolute left-0 top-0 z-30 w-[260px] opacity-0 shadow-[6px_6px_0_0_rgba(15,15,15,0.18)] transition-opacity duration-150 group-hover:visible group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:visible group-focus-within:pointer-events-auto group-focus-within:opacity-100">
            <GalleryTile card={c} widthPx={260} />
          </div>
        </li>
      ))}
    </ul>
  );
}
