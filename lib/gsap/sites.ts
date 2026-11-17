// The fourth library: complete websites built with GSAP (and WebGL where a
// scene needs it), to open, study and remix. Each one is a first-party
// component with a full-window page of its own under /gallery/gsap, and the
// cards on /gallery/gsap, the tab's count and the sitemap all read this list.
// With the list empty the section says "Soon" instead.
//
// A site's files: components/gsap/<slug>/ (the code), public/assets/gsap/<slug>/
// (pictures, data and fonts), scripts/gsap/<slug>/ (how its assets were made)
// and scripts/gsap/verify-<slug>.mjs (its browser check). Each site's folder
// imports nothing from outside itself but gsap and react; only its
// <Site>Route.tsx knows about Next and about this host.
//
// Licence note: a site's own code is MIT like the rest of the project, but
// GSAP is not MIT. It is free to use under GreenSock's "standard no charge"
// licence (https://gsap.com/standard-license), which has its own conditions.
// It is credited in THIRD_PARTY_NOTICES.md. Do not describe GSAP itself as MIT
// or open source on the site.

export interface GsapSite {
  // Address under /gallery/gsap, and the folder its files live in.
  slug: string;
  title: string;
  // One sentence: what the site is and what its motion does.
  blurb: string;
  // What it shows off, for the card's chips. Only what the site really uses:
  // none of the first three uses ScrollTrigger.
  techniques: string[];
  // Card image and share card, under /public: a 1200x750 screen from the site.
  thumb: string;
  // Where the running site opens.
  liveHref: string;
  // ISO date it was added.
  added: string;
}

export const GSAP_SITES: GsapSite[] = [
  {
    slug: "sum",
    title: "Sum",
    blurb: "A shop for one watch. Scroll and it comes apart into its 147 parts, each one counted, then goes back together.",
    techniques: ["Scroll-driven timeline", "WebGL2", "Exploded view", "Step controls"],
    thumb: "/thumbs/gsap/sum.webp",
    liveHref: "/gallery/gsap/sum",
    added: "2026-11-17",
  },
  {
    slug: "meridian",
    title: "Meridian",
    blurb: "Delivery tracking software, shown in use. One zoom from the whole earth to a single door, while the console counts the parcels in the picture.",
    techniques: ["Canvas 2D map", "Continuous zoom", "Live counters", "Step controls"],
    thumb: "/thumbs/gsap/meridian.webp",
    liveHref: "/gallery/gsap/meridian",
    added: "2026-11-17",
  },
  {
    slug: "datum",
    title: "Datum",
    blurb: "An architecture practice. One red level line holds still while the drawing is drawn and becomes the house standing on it.",
    techniques: ["Line drawing", "Registered photo sequence", "Masked reveals", "Step controls"],
    thumb: "/thumbs/gsap/datum.webp",
    liveHref: "/gallery/gsap/datum",
    added: "2026-11-17",
  },
];

export function getGsapSite(slug: string): GsapSite | undefined {
  return GSAP_SITES.find((s) => s.slug === slug);
}
