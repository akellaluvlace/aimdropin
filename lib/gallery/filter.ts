// Gallery search, single-pill filter, sort and counts. One pill is active at
// a time (Our picks, All, or one facet value); picking another replaces it.
// Counts follow the search only, so each pill shows what you'd land on.

import type { FacetGroup, GalleryCard, GallerySortKey } from "./types";

export type ActiveFilter =
  | { kind: "picks" }
  | { kind: "facet"; facet: string; value: string }
  | null;

function tokensOf(query: string): string[] {
  const q = query.trim().toLowerCase();
  return q ? q.split(/\s+/).filter(Boolean) : [];
}

function matcher(query: string): (c: GalleryCard) => boolean {
  const tokens = tokensOf(query);
  return (c) => tokens.every((t) => c.search.includes(t));
}

function numberOf(c: GalleryCard): number {
  return typeof c.number === "number" && Number.isFinite(c.number) ? c.number : Number.POSITIVE_INFINITY;
}

export function applyGalleryFilter(
  cards: GalleryCard[],
  opts: { query: string; active: ActiveFilter; sort: GallerySortKey; picks?: readonly string[] },
): GalleryCard[] {
  const matches = matcher(opts.query);
  const pickIndex = new Map((opts.picks ?? []).map((k, i) => [k, i]));
  const active = opts.active;
  const out = cards.filter((c) => {
    if (active?.kind === "picks" && !pickIndex.has(c.key)) return false;
    if (active?.kind === "facet" && c.facets[active.facet] !== active.value) return false;
    return matches(c);
  });
  if (active?.kind === "picks") {
    return out.sort((a, b) => (pickIndex.get(a.key) ?? 0) - (pickIndex.get(b.key) ?? 0));
  }
  return out.sort((a, b) => {
    switch (opts.sort) {
      case "az":
        return a.title.localeCompare(b.title);
      case "za":
        return b.title.localeCompare(a.title);
      case "num-asc":
        return numberOf(a) - numberOf(b);
      case "num-desc": {
        // Unnumbered (folder) templates stay last in both directions.
        const na = numberOf(a);
        const nb = numberOf(b);
        if (na === nb) return 0;
        if (na === Number.POSITIVE_INFINITY) return 1;
        if (nb === Number.POSITIVE_INFINITY) return -1;
        return nb - na;
      }
      case "best":
        return (b.rank ?? 0) - (a.rank ?? 0) || a.title.localeCompare(b.title);
      case "top": {
        // Rated items first, by Bayesian average; unrated keep "best" order.
        const ra = a.stats?.ratingCount ? a.stats.bayes ?? a.stats.rating ?? 0 : -1;
        const rb = b.stats?.ratingCount ? b.stats.bayes ?? b.stats.rating ?? 0 : -1;
        return rb - ra || (b.rank ?? 0) - (a.rank ?? 0) || a.title.localeCompare(b.title);
      }
      case "views":
        return (b.stats?.views ?? -1) - (a.stats?.views ?? -1) || a.title.localeCompare(b.title);
      case "new":
        return (b.added ?? "").localeCompare(a.added ?? "") || a.title.localeCompare(b.title);
    }
  });
}

export interface GalleryCounts {
  all: number;
  picks: number;
  // "<facet id>:<value>" → count
  byFacet: Map<string, number>;
}

export function galleryCounts(
  cards: GalleryCard[],
  opts: { query: string; picks: readonly string[]; facets: FacetGroup[] },
): GalleryCounts {
  const matches = matcher(opts.query);
  const picks = new Set(opts.picks);
  const byFacet = new Map<string, number>();
  for (const g of opts.facets) for (const v of g.values) byFacet.set(`${g.id}:${v}`, 0);
  let all = 0;
  let pickCount = 0;
  for (const c of cards) {
    if (!matches(c)) continue;
    all += 1;
    if (picks.has(c.key)) pickCount += 1;
    for (const g of opts.facets) {
      const v = c.facets[g.id];
      if (v != null) {
        const k = `${g.id}:${v}`;
        if (byFacet.has(k)) byFacet.set(k, (byFacet.get(k) ?? 0) + 1);
      }
    }
  }
  return { all, picks: pickCount, byFacet };
}
