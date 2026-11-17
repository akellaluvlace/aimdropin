// Previous / next item for the full-screen views, in the gallery's default
// order, wrapping around at the ends so ← and → never dead-end.

import { getDashboards } from "@/lib/dashboards";
import { getAllTemplates, getThumbSlugs, type TemplateKind } from "@/lib/templates";
import { dashboardCard, templateCard } from "./cards";
import { applyGalleryFilter } from "./filter";
import type { GalleryCard } from "./types";

export interface Neighbors {
  prev: { href: string; title: string };
  next: { href: string; title: string };
  /** 1-based position in the gallery order. */
  index: number;
  total: number;
}

function around(cards: GalleryCard[], key: string): Neighbors | null {
  const i = cards.findIndex((c) => c.key === key);
  if (i < 0 || cards.length < 2) return null;
  const prev = cards[(i - 1 + cards.length) % cards.length];
  const next = cards[(i + 1) % cards.length];
  return {
    prev: { href: prev.previewHref, title: prev.title },
    next: { href: next.previewHref, title: next.title },
    index: i + 1,
    total: cards.length,
  };
}

/** Dashboards, in "Best first" order (the dashboards gallery's default). */
export async function dashboardNeighbors(slug: string): Promise<Neighbors | null> {
  const cards = (await getDashboards()).map(dashboardCard);
  return around(applyGalleryFilter(cards, { query: "", active: null, sort: "best" }), slug);
}

/** Landing pages, in A → Z order (the landing gallery's default). */
export async function templateNeighbors(slug: string, kindPref: TemplateKind): Promise<Neighbors | null> {
  const [all, thumbs] = await Promise.all([getAllTemplates({ preferKind: kindPref }), getThumbSlugs()]);
  const cards = all.map(({ source: _source, ...t }) => templateCard(t, thumbs.has(t.slug), kindPref));
  return around(applyGalleryFilter(cards, { query: "", active: null, sort: "az" }), slug);
}
