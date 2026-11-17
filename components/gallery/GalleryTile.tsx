"use client";

import Link from "next/link";
import { useState } from "react";
import FullscreenLink from "@/components/fullscreen/FullscreenLink";
import type { GalleryCard } from "@/lib/gallery/types";

interface GalleryTileProps {
  card: GalleryCard;
  // false on duplicated marquee tracks so screen readers + tab key only see
  // the first copy.
  tabbable?: boolean;
  // Fixed tile width in px (the marquee needs a uniform stride); omitted,
  // the tile fills its container.
  widthPx?: number;
  // The first cards of a view: load the thumbnail straight away at high
  // priority instead of lazily, since one of them is the page's largest paint.
  eager?: boolean;
}

// The gallery card for every section. Hovering reveals two explicit actions,
// Select (editor / workbench) and Full screen, so a single click never takes
// you away by accident. On touch screens the card opens the item and a corner
// button goes straight to full screen.
export default function GalleryTile({ card, tabbable = true, widthPx, eager = false }: GalleryTileProps) {
  // A gallery shows dozens of cards with two links each. Prefetching every
  // link as it scrolled into view cost a server request per link, so a card's
  // links are prefetched only once the pointer, a touch or focus reaches it.
  const [intent, setIntent] = useState(false);
  const prefetch = intent ? null : false;
  const warm = intent ? undefined : () => setIntent(true);
  return (
    <article
      onPointerEnter={warm}
      onTouchStart={warm}
      onFocus={warm}
      style={widthPx ? { width: widthPx } : undefined}
      className={
        "group relative block overflow-hidden border-2 border-ink bg-card transition-transform duration-200 ease-out hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#FF4D2E] focus-within:-translate-y-1 focus-within:shadow-[6px_6px_0_0_#FF4D2E] " +
        (widthPx ? "" : "w-full")
      }
    >
      {/* Touch screens: the whole card is one link; no hover layer there. Not
          aria-hidden: a tap focuses it, and hiding a focused element is an
          accessibility error (Chrome warns). Out of the tab order, since
          keyboard users have the card's own buttons. */}
      <Link
        href={card.touchHref ?? card.previewHref}
        prefetch={prefetch}
        tabIndex={-1}
        aria-label={`Open ${card.title}`}
        className="absolute inset-0 z-30 lg:hidden"
      />
      <FullscreenLink
        href={card.previewHref}
        prefetch={prefetch}
        iconOnly
        ariaLabel={`Full screen: ${card.title}`}
        tabIndex={-1}
        className="absolute right-2 top-2 z-40 flex h-9 w-9 items-center justify-center border-2 border-ink bg-ink text-paper shadow-brut-sm active:bg-sun active:text-ink lg:hidden"
        iconClassName="h-4 w-4"
      />
      <div className="relative aspect-[4/3] overflow-hidden bg-soft">
        {card.thumb ? (
          <img
            src={card.thumb}
            alt={`${card.title} - ${card.subtitle}`}
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : undefined}
            decoding="async"
            width={1280}
            height={800}
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-4 text-center">
            <span className="font-display text-xl leading-tight">{card.title}</span>
          </div>
        )}
        {card.chips.length > 0 && (
          <span className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-3.75rem)] flex-wrap gap-1 lg:max-w-[calc(100%-1rem)]">
            {card.chips.map((c) => (
              <span key={c.label} className={`chip ${c.accent ? "chip-accent" : ""}`}>
                {c.label.toUpperCase()}
              </span>
            ))}
          </span>
        )}

        <span aria-hidden="true" className="pointer-events-none absolute bottom-2 right-2 z-10 border-2 border-ink bg-paper px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink shadow-brut-sm lg:hidden">
          Open →
        </span>

        <div className="pointer-events-none absolute inset-0 z-20 hidden flex-col items-center justify-center gap-2 bg-ink/65 opacity-0 backdrop-blur-[2px] transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 lg:flex">
          <Link
            href={card.selectHref}
            prefetch={prefetch}
            tabIndex={tabbable ? 0 : -1}
            aria-label={`Open ${card.title}`}
            className="min-w-[6.5rem] border-2 border-paper bg-paper px-4 py-2 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-ink transition-colors hover:bg-sun focus-visible:bg-sun focus-visible:outline-none"
          >
            Select
          </Link>
          <FullscreenLink
            href={card.previewHref}
            prefetch={prefetch}
            tabIndex={tabbable ? 0 : -1}
            ariaLabel={`Full screen: ${card.title}`}
            className="inline-flex min-w-[6.5rem] items-center justify-center gap-2 border-2 border-paper bg-coral px-4 py-2 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-paper hover:text-coral focus-visible:bg-paper focus-visible:text-coral focus-visible:outline-none"
          />
        </div>
      </div>
      <div className="border-t-2 border-ink px-3 py-2">
        <p className="truncate font-mono text-[9px] uppercase tracking-[0.2em] text-muted">{card.subtitle}</p>
        <p className="mt-1 truncate font-display text-sm leading-tight">{card.title}</p>
        {card.stats && (card.stats.ratingCount > 0 || card.stats.views > 0) ? (
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-muted">
            {card.stats.ratingCount > 0 && card.stats.rating != null ? (
              <span className="text-coral">★ {card.stats.rating.toFixed(1)}</span>
            ) : null}
            {card.stats.ratingCount > 0 ? ` (${card.stats.ratingCount})` : ""}
            {card.stats.ratingCount > 0 && card.stats.views > 0 ? " · " : ""}
            {card.stats.views > 0 ? `${card.stats.views.toLocaleString("en-US")} views` : ""}
          </p>
        ) : null}
      </div>
    </article>
  );
}
