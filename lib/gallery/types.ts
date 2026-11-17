// One card shape for every gallery section, so landing pages, dashboards,
// components and community pages share the same tiles, sidebar, search and
// views. Pure data: built on the server, sent to the client gallery.

export type GallerySectionId = "landing" | "dashboards" | "components" | "gsap" | "community";

// A section in the site navigation, with its live item count.
export interface GallerySectionTab {
  id: GallerySectionId;
  label: string;
  href: string;
  count: number;
  // Announced but still empty: the tab shows "Soon" in place of its count.
  soon?: boolean;
}

export interface GalleryChip {
  label: string;
  accent?: boolean;
}

export interface GalleryCard {
  key: string;
  title: string;
  // Small caps line above the title.
  subtitle: string;
  // Image URL, or null for the title-only placeholder.
  thumb: string | null;
  // Badges on the thumbnail; the first one also shows in list rows.
  chips: GalleryChip[];
  // "Select" opens the editor / workbench, "Preview" the full-screen view.
  selectHref: string;
  previewHref: string;
  // Where a tap goes on touch screens (no hover actions there). Defaults to
  // the preview: the landing-page editor isn't usable on a phone, but the
  // dashboard and component pages are.
  touchHref?: string;
  // Facet id → this card's value (null = not in any pill of that facet).
  facets: Record<string, string | null>;
  // Lowercase text the search box matches against.
  search: string;
  // Leading number for "№" sorts (landing pages are numbered).
  number?: number;
  // Higher first for "Best first".
  rank?: number;
  // Community stats (when accounts are on): drives "Top rated" / "Most viewed".
  stats?: { rating: number | null; ratingCount: number; views: number; bayes?: number };
  // ISO date it was added/published, for "Newest".
  added?: string;
}

export interface FacetGroup {
  id: string;
  label: string;
  // Display order; each value is also its pill label.
  values: string[];
}

export type GallerySortKey = "best" | "az" | "za" | "num-asc" | "num-desc" | "top" | "views" | "new";
