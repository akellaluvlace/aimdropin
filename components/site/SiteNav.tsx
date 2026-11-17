import Link from "@/components/site/IntentLink";
import type { ReactNode } from "react";
import NavSearch from "./NavSearch";
import type { GallerySectionId, GallerySectionTab } from "@/lib/gallery/types";

function compact(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}k`;
}

// The one navigation bar: wordmark, the libraries with live counts,
// search and the playground. The gallery, item pages, search and builder all
// use it, so moving between sections works the same everywhere.
export default function SiteNav({
  tabs,
  active = null,
  extra,
  sticky = false,
}: {
  tabs: GallerySectionTab[];
  active?: GallerySectionId | null;
  // Page-specific controls before the playground button (kit, AI, account).
  extra?: ReactNode;
  sticky?: boolean;
}) {
  const total = tabs.reduce((n, t) => n + t.count, 0);
  return (
    <header className={"relative z-40 border-b-2 border-ink bg-[#FCFBF9] " + (sticky ? "sticky top-0" : "")}>
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2 md:gap-4 md:px-6 lg:px-10">
        {/* The logo: the wolf's head and the name. It is wider than the mark
            it replaced (the head has its scarf, and "AiM" is text now; the
            old mark carried those letters), so in a crowded bar it is the
            first thing to give way (shrink-[999]): it drops "AiM", and on a
            phone "Dropin" as well, before the row overflows. Where the
            section tabs share the row and room is short by design (768px up
            to 1100px, or to 1440px on a page that adds its own controls) it
            is the head and "Dropin" at the phone's size, which is as wide as
            the old logo was, so the tabs keep the room they had. */}
        <Link
          href="/"
          aria-label="AiM Dropin - home"
          className={
            "-my-0.5 flex min-w-[59px] shrink-[999] items-center gap-2 font-display text-2xl leading-none tracking-tight transition-colors hover:text-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral md:my-0 md:min-w-[auto] " +
            (extra ? "min-[1440px]:text-[1.7rem]" : "min-[1100px]:text-[1.7rem]")
          }
        >
          {/* The wolf's head, drawn 59 by 48 and shown at exactly that size:
              one drawn pixel is one CSS pixel, so it is never resampled. On
              phones the link borrows 2px of the bar's padding above and
              below (-my-0.5), which leaves the bar the height it was with
              the 44px mark. */}
          <img
            src="/assets/wolf-head.svg"
            alt=""
            aria-hidden="true"
            width={59}
            height={48}
            className="h-12 w-[59px] flex-none"
            style={{ imageRendering: "pixelated" }}
          />
          {/* The name, as a wrapping row one line tall that shows only its
              last line. When the link has been squeezed, "AiM" stops fitting
              beside "Dropin" and wraps out of sight. Squeezed further (on
              phones only: from 768px up, min-w-min holds the row at
              "Dropin"), "Dropin" wraps too and the last line is the empty
              item. Words leave whole, never clipped. */}
          <span className="flex h-[1.4em] min-w-0 flex-wrap-reverse content-end overflow-hidden leading-[1.4] md:min-w-min">
            <span className={"text-coral " + (extra ? "md:max-[1439px]:hidden" : "md:max-[1099px]:hidden")}>AiM&nbsp;</span>
            <span>Dropin</span>
            <span aria-hidden="true" className="h-[1.4em] w-0" />
          </span>
        </Link>
        <span aria-hidden="true" className="hidden h-7 w-0.5 bg-ink md:block" />
        <SectionTabs tabs={tabs} active={active} className="hidden md:flex" tight={!!extra} />
        <div className="ml-auto flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] md:gap-3 md:text-[11px]">
          <NavSearch placeholder={`Search ${total >= 1000 ? `${Math.floor(total / 1000).toLocaleString("en-US")},000+` : total} items`} />
          {extra}
          <Link href="/playground" className="btn btn-accent h-10 px-3 py-0 md:px-4">
            <span className="sm:hidden">Open</span>
            <span className="hidden sm:inline">Open playground</span>
          </Link>
        </div>
      </div>
      {/* Phones: the sections get their own full-width row. */}
      <SectionTabs tabs={tabs} active={active} className="flex border-x-0 border-b-0 md:hidden" stretch />
    </header>
  );
}

function SectionTabs({
  tabs,
  active,
  className,
  stretch = false,
  tight = false,
}: {
  tabs: GallerySectionTab[];
  active: GallerySectionId | null;
  className: string;
  stretch?: boolean;
  // The page adds its own controls to the bar: less room for the tabs.
  tight?: boolean;
}) {
  // Four tabs with their counts do not fit everywhere, and a crowded bar
  // gives way in ugly places: the tab row has to be scrolled (which hides a
  // section), the logo loses "AiM", the playground button wraps. So the
  // counts are the first thing to go: they show on phones from 480px, and
  // beside the logo from 1360px (on a page with its own controls, not at
  // all there). "Soon" says the section is not open yet, so it stays
  // wherever there is room for it.
  const countAt = tight ? "hidden min-[480px]:inline md:hidden" : "hidden min-[480px]:inline md:hidden min-[1360px]:inline";
  const soonAt = tight ? "hidden min-[480px]:inline md:hidden min-[1320px]:inline" : "hidden min-[480px]:inline md:hidden lg:inline";
  return (
    <nav aria-label="Sections" className={"min-w-0 overflow-x-auto border-2 border-ink bg-paper " + className}>
      {tabs.map((t, i) => {
        const current = t.id === active;
        return (
          <Link
            key={t.id}
            href={t.href}
            aria-current={current ? "page" : undefined}
            className={
              "group flex items-center justify-center gap-2 whitespace-nowrap px-2 py-2 min-[480px]:px-3 md:px-2 lg:px-3 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-coral lg:px-4 lg:text-[11px] " +
              (stretch ? "flex-1 " : "") +
              (i > 0 ? "border-l-2 border-ink " : "") +
              (current ? "bg-ink text-paper" : "hover:bg-sun")
            }
          >
            <span>{t.id === "landing" ? <><span className="lg:hidden">Pages</span><span className="hidden lg:inline">Landing pages</span></> : t.label}</span>
            <span
              className={
                (t.soon ? soonAt : countAt) +
                " border px-1 py-px text-[9px] tabular-nums tracking-[0.08em] " +
                (current ? "border-paper/40 bg-coral text-paper" : "border-ink/30 text-muted group-hover:border-ink group-hover:text-ink")
              }
            >
              {t.soon ? "Soon" : compact(t.count)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
