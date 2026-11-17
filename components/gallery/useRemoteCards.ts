"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActiveFilter, GalleryCounts } from "@/lib/gallery/filter";
import type { FacetGroup, GalleryCard, GallerySortKey } from "@/lib/gallery/types";

// A gallery section too big to ship whole (Components): the server filters,
// counts and pages; this keeps the shown cards in sync with the sidebar.

export interface RemotePage {
  cards: GalleryCard[];
  total: number;
  page: number;
  pageSize: number;
  counts: { all: number; byFacet: Record<string, number> };
  facets: FacetGroup[];
}

export interface RemoteSource {
  endpoint: string;
  initial: RemotePage;
}

export interface RemoteState {
  cards: GalleryCard[];
  total: number;
  counts: GalleryCounts;
  facets: FacetGroup[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
}

function toCounts(c: RemotePage["counts"]): GalleryCounts {
  return { all: c.all, picks: 0, byFacet: new Map(Object.entries(c.byFacet)) };
}

// Names one search (text, pill and sort), so cards can be matched to the
// search they answer.
function searchKey(endpoint: string | undefined, query: string, active: ActiveFilter, sort: GallerySortKey): string {
  return JSON.stringify([endpoint ?? "", query.trim(), active, sort]);
}

function urlFor(endpoint: string, query: string, active: ActiveFilter, sort: GallerySortKey, page: number): string {
  const sp = new URLSearchParams();
  if (query.trim()) sp.set("q", query.trim());
  if (active?.kind === "facet") {
    sp.set("facet", active.facet);
    sp.set("value", active.value);
  }
  sp.set("sort", sort === "az" ? "az" : "popular");
  if (page > 1) sp.set("page", String(page));
  return `${endpoint}?${sp.toString()}`;
}

export function useRemoteCards(
  remote: RemoteSource | undefined,
  query: string,
  active: ActiveFilter,
  sort: GallerySortKey,
): RemoteState | null {
  const endpoint = remote?.endpoint;
  // The search this render is showing. `state.key` is the search the loaded
  // cards belong to; they differ while a new search's first page is on its way.
  const key = searchKey(endpoint, query, active, sort);
  const [state, setState] = useState(() =>
    remote
      ? { cards: remote.initial.cards, total: remote.initial.total, page: 1, counts: toCounts(remote.initial.counts), facets: remote.initial.facets, key }
      : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  // True from the moment a request starts. `loading` only changes on the next
  // render, and "load more" can be asked for again before that.
  const busyRef = useRef(false);

  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      if (!endpoint) return;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      busyRef.current = true;
      setLoading(true);
      setError(null);
      const forSearch = searchKey(endpoint, query, active, sort);
      try {
        const res = await fetch(urlFor(endpoint, query, active, sort, page), { signal: ac.signal });
        if (!res.ok) throw new Error(res.status === 429 ? "Too many searches - wait a moment." : `Couldn't load (${res.status}).`);
        const data = (await res.json()) as RemotePage;
        setState((prev) => ({
          // Only ever added to cards of the same search.
          cards:
            append && prev && prev.key === forSearch
              ? [...prev.cards, ...data.cards.filter((c) => !prev.cards.some((p) => p.key === c.key))]
              : data.cards,
          total: data.total,
          page: data.page,
          counts: toCounts(data.counts),
          facets: data.facets,
          key: forSearch,
        }));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message || "Couldn't load.");
      } finally {
        if (abortRef.current === ac) {
          busyRef.current = false;
          setLoading(false);
        }
      }
    },
    [endpoint, query, active, sort],
  );

  // A new search, pill or sort starts again from page 1. The server already
  // rendered the first page for the defaults.
  useEffect(() => {
    if (!endpoint) return;
    if (first.current) {
      first.current = false;
      return;
    }
    void fetchPage(1, false);
  }, [endpoint, fetchPage]);

  if (!state) return null;
  // The cards on screen answer an earlier search: the current one's first
  // page hasn't arrived (still loading, or it failed).
  const stale = state.key !== key;
  const hasMore = stale || state.cards.length < state.total;
  return {
    cards: state.cards,
    total: state.total,
    counts: state.counts,
    facets: state.facets,
    loading,
    error,
    hasMore,
    loadMore: () => {
      if (busyRef.current) return;
      // Never page 2 of a new search on top of the old search's cards: until
      // the first page has arrived, "more" means that first page.
      if (stale) void fetchPage(1, false);
      else if (hasMore) void fetchPage(state.page + 1, true);
    },
  };
}
