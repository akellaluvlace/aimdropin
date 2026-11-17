"use client";

import Link from "@/components/site/IntentLink";
import { useEffect, useRef, useState, type CSSProperties } from "react";

export interface StageDashboard {
  slug: string;
  title: string;
  thumb: string;
  stack: string;
  ui: string;
  pages: number;
}

export interface StageCard {
  title: string;
  thumb: string;
  href: string;
  label: string;
}

// How long each dashboard stays up. The coral bar under the window counts
// it down; when the bar's animation ends, the next dashboard comes in. So
// pausing the bar (Pause button, hover, offscreen) pauses the slideshow,
// and with reduced motion (no animation) it never advances on its own.
const SLIDE_MS = 4200;

// The hero's set piece: a browser window cycling through live dashboards,
// with a landing page and a component peeking out behind it.
export default function HeroStage({
  dashboards,
  landing,
  component,
}: {
  dashboards: StageDashboard[];
  landing: StageCard | null;
  component: StageCard | null;
}) {
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1];
      if (last) setOffscreen(!last.isIntersecting);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (dashboards.length === 0) return null;
  const d = dashboards[index % dashboards.length];
  const paused = userPaused || hovering || offscreen;
  const next = () => setIndex((n) => (n + 1) % dashboards.length);

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[640px] lg:pb-14 lg:pl-12 lg:pr-10 lg:pt-12" data-paused={paused ? "true" : "false"}>
      {landing ? (
        <BackCard
          card={landing}
          className="left-0 top-0 w-[54%]"
          style={{ "--rot": "-7deg", "--fx": "-40px", "--fy": "30px", "--d": "380ms" } as CSSProperties}
          chipSide="top"
        />
      ) : null}
      {component ? (
        <BackCard
          card={component}
          className="bottom-0 right-0 w-[44%]"
          style={{ "--rot": "6deg", "--fx": "40px", "--fy": "40px", "--d": "500ms" } as CSSProperties}
          chipSide="bottom"
        />
      ) : null}

      <div
        className="hero-card relative z-10 border-2 border-ink bg-card shadow-brut-lg"
        style={{ "--d": "160ms" } as CSSProperties}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onFocus={() => setHovering(true)}
        onBlur={() => setHovering(false)}
      >
        {/* Window chrome */}
        <div className="flex items-center gap-3 border-b-2 border-ink bg-paper px-3 py-2">
          <span className="flex shrink-0 gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 border-2 border-ink bg-coral" />
            <span className="h-2.5 w-2.5 border-2 border-ink bg-sun" />
            <span className="h-2.5 w-2.5 border-2 border-ink bg-card" />
          </span>
          <span className="min-w-0 flex-1 truncate border-2 border-ink bg-card px-2 py-0.5 font-mono text-[10px] tracking-[0.04em] text-ink/80">
            dropin / d / <span key={d.slug} className="lp-swap inline-block text-ink">{d.slug}</span>
          </span>
          <button
            type="button"
            onClick={() => setUserPaused((p) => !p)}
            aria-label={userPaused ? "Play the dashboard slideshow" : "Pause the dashboard slideshow"}
            className="lp-motion-control flex h-7 w-7 shrink-0 items-center justify-center border-2 border-ink bg-card transition-colors hover:bg-ink hover:text-paper"
          >
            {userPaused ? (
              <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M1 0.5v9l8-4.5z" />
              </svg>
            ) : (
              <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <rect x="1" y="0.5" width="3" height="9" />
                <rect x="6" y="0.5" width="3" height="9" />
              </svg>
            )}
          </button>
        </div>

        {/* Countdown to the next dashboard */}
        <div className="relative h-1 overflow-hidden bg-ink/10" aria-hidden="true">
          <span
            key={index}
            className="lp-stage-progress absolute inset-0 bg-coral"
            style={{ "--dur": `${SLIDE_MS}ms` } as CSSProperties}
            onAnimationEnd={next}
          />
        </div>

        <Link
          href={`/d/${d.slug}`}
          className="relative block aspect-[16/10] overflow-hidden bg-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-coral"
          aria-label={`Open the ${d.title} dashboard: live demo, code and download`}
        >
          {dashboards.map((x, k) => (
            <span key={x.slug} className="lp-slide absolute inset-0" data-active={k === index ? "true" : "false"} aria-hidden={k === index ? undefined : true}>
              <img
                src={x.thumb}
                alt={k === index ? `${x.title}: ${x.stack} dashboard` : ""}
                width={1280}
                height={800}
                loading={k === 0 ? "eager" : "lazy"}
                decoding="async"
                className="h-full w-full object-cover object-top"
              />
            </span>
          ))}
          <span className="sticker absolute right-3 top-3 z-10">
            <span aria-hidden="true" className="inline-block h-1.5 w-1.5 bg-coral" />
            Live · {d.pages} pages
          </span>
        </Link>

        <div className="flex items-center justify-between gap-3 border-t-2 border-ink px-3 py-2.5">
          <p key={d.slug} className="lp-swap min-w-0 truncate font-display text-lg leading-none tracking-tight md:text-xl">
            {d.title}
          </p>
          <p className="flex shrink-0 gap-1">
            <span className="chip chip-accent">{d.stack}</span>
            <span className="chip hidden sm:inline-flex">{d.ui}</span>
          </p>
        </div>
      </div>

      {/* Pager */}
      <div className="relative z-10 mt-4 flex items-center gap-2.5" role="group" aria-label="Choose a dashboard">
        {dashboards.map((x, k) => (
          <button
            key={x.slug}
            type="button"
            onClick={() => {
              setIndex(k);
              setUserPaused(true);
            }}
            aria-label={`Show ${x.title}`}
            aria-current={k === index ? "true" : undefined}
            className={
              // The square stays 14px; the invisible ::before makes the tap area 24px.
              "relative h-3.5 w-3.5 border-2 border-ink transition-colors before:absolute before:-inset-[5px] before:content-[''] " +
              (k === index ? "bg-coral" : "bg-paper hover:bg-sun")
            }
          />
        ))}
        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {String(index + 1).padStart(2, "0")} / {String(dashboards.length).padStart(2, "0")} · {d.stack}
        </span>
      </div>
    </div>
  );
}

function BackCard({
  card,
  className,
  style,
  chipSide,
}: {
  card: StageCard;
  className: string;
  style: CSSProperties;
  chipSide: "top" | "bottom";
}) {
  return (
    <Link
      href={card.href}
      tabIndex={-1}
      aria-hidden="true"
      className={"hero-card lp-tilt absolute z-0 hidden border-2 border-ink bg-card shadow-brut lg:block " + className}
      style={style}
    >
      <span className={"chip chip-accent absolute z-10 " + (chipSide === "top" ? "left-2 top-2" : "bottom-2 right-2")}>{card.label}</span>
      <span className="block aspect-[4/3] overflow-hidden bg-soft">
        <img src={card.thumb} alt="" width={640} height={480} loading="eager" decoding="async" className="h-full w-full object-cover object-top" />
      </span>
    </Link>
  );
}
