"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import FullscreenIcon from "./FullscreenIcon";
import { canUseBrowserFullscreen, enterBrowserFullscreen, exitBrowserFullscreen, isBrowserFullscreen, previousPageIsHere } from "@/lib/fullscreen";

export interface FullscreenTarget {
  href: string;
  title: string;
}

function typingIn(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}

/**
 * Previous / next item in the gallery without leaving full screen (also the
 * ← and → keys). Steps replace the history entry, so Close and the browser's
 * Back still return to the page the visitor opened full screen from.
 */
export function FullscreenSteps({ prev, next, noun }: { prev?: FullscreenTarget | null; next?: FullscreenTarget | null; noun: string }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || typingIn(e.target)) return;
      const to = e.key === "ArrowLeft" ? prev : e.key === "ArrowRight" ? next : null;
      if (!to) return;
      e.preventDefault();
      router.replace(to.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, router]);

  if (!prev && !next) return null;
  const step = (to: FullscreenTarget | null | undefined, dir: "prev" | "next") => {
    const label = dir === "prev" ? `Previous ${noun}` : `Next ${noun}`;
    const cls =
      "flex h-8 items-center gap-1.5 px-2.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors " +
      (dir === "next" ? "border-l-2 border-ink " : "");
    if (!to) {
      return (
        <span className={cls + "text-ink/30"} aria-hidden="true">
          {dir === "prev" ? "←" : "→"}
        </span>
      );
    }
    return (
      <Link
        href={to.href}
        replace
        aria-label={`${label}: ${to.title}`}
        title={`${label}: ${to.title} (${dir === "prev" ? "←" : "→"} key)`}
        className={cls + "hover:bg-ink hover:text-paper focus-visible:bg-ink focus-visible:text-paper focus-visible:outline-none"}
      >
        {dir === "prev" ? <span aria-hidden="true">←</span> : null}
        <span className="hidden md:inline">{dir === "prev" ? "Prev" : "Next"}</span>
        {dir === "next" ? <span aria-hidden="true">→</span> : null}
      </Link>
    );
  };
  return (
    <nav aria-label={`Browse ${noun}s`} className="flex shrink-0 border-2 border-ink bg-paper">
      {step(prev, "prev")}
      {step(next, "next")}
    </nav>
  );
}

/**
 * The bar across the top of every full-screen view. Close (or Esc) goes back
 * to where the visitor came from; the corner button (or F) fills the whole
 * screen where the browser allows it; `primary` is the way to the item's own
 * page (code, download, install).
 */
export default function FullscreenBar({
  title,
  kind,
  fallbackHref,
  prev,
  next,
  noun,
  primary,
  children,
}: {
  title: string;
  kind?: string;
  // Where Close goes when there's no page to go back to (a shared link).
  fallbackHref: string;
  prev?: FullscreenTarget | null;
  next?: FullscreenTarget | null;
  noun?: string;
  primary?: { href: string; label: string; shortLabel?: string };
  children?: ReactNode;
}) {
  const router = useRouter();
  const [canFill, setCanFill] = useState(false);
  const [filled, setFilled] = useState(false);
  const leftAt = useRef(0);

  useEffect(() => {
    setCanFill(canUseBrowserFullscreen());
    const sync = () => {
      const on = isBrowserFullscreen();
      if (!on) leftAt.current = Date.now();
      setFilled(on);
    };
    setFilled(isBrowserFullscreen());
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const close = useCallback(() => {
    exitBrowserFullscreen();
    if (previousPageIsHere()) router.back();
    else router.push(fallbackHref);
  }, [router, fallbackHref]);

  const toggleFill = useCallback(() => {
    if (isBrowserFullscreen()) exitBrowserFullscreen();
    else enterBrowserFullscreen();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || typingIn(e.target)) return;
      if (e.key === "Escape") {
        // The Esc that takes the browser out of full screen shouldn't also
        // close the view; the next one does.
        if (isBrowserFullscreen() || Date.now() - leftAt.current < 500) return;
        e.preventDefault();
        close();
      } else if ((e.key === "f" || e.key === "F") && canFill && !e.shiftKey) {
        e.preventDefault();
        toggleFill();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, toggleFill, canFill]);

  return (
    <header className="flex shrink-0 items-center gap-2 border-b-2 border-ink bg-paper px-2 py-2 sm:gap-3 sm:px-3">
      <button
        type="button"
        onClick={close}
        title="Close full screen (Esc)"
        className="inline-flex h-9 shrink-0 items-center gap-2 border-2 border-ink bg-paper px-2.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors hover:bg-ink hover:text-paper focus-visible:bg-ink focus-visible:text-paper focus-visible:outline-none sm:px-3"
      >
        <span aria-hidden="true" className="text-[13px] leading-none">✕</span>
        <span>Close</span>
        <span aria-hidden="true" className="hidden border border-current px-1 py-px text-[8px] leading-none opacity-60 lg:inline">
          Esc
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-base leading-tight sm:text-lg" title={title}>
          {title}
        </p>
        {kind ? (
          <p className="hidden truncate font-mono text-[9px] uppercase tracking-[0.2em] text-muted sm:block">{kind}</p>
        ) : null}
      </div>
      <FullscreenSteps prev={prev} next={next} noun={noun ?? "item"} />
      {children}
      {canFill ? (
        <button
          type="button"
          onClick={toggleFill}
          aria-pressed={filled}
          aria-label={filled ? "Leave browser full screen" : "Fill the whole screen"}
          title={filled ? "Leave browser full screen (F)" : "Fill the whole screen (F)"}
          className="hidden h-9 w-9 shrink-0 items-center justify-center border-2 border-ink bg-paper transition-colors hover:bg-ink hover:text-paper focus-visible:bg-ink focus-visible:text-paper focus-visible:outline-none sm:inline-flex"
        >
          <FullscreenIcon exit={filled} className="h-4 w-4" />
        </button>
      ) : null}
      {primary ? (
        <Link
          href={primary.href}
          onClick={() => exitBrowserFullscreen()}
          className="btn btn-accent h-9 shrink-0 px-3 py-0 text-[10px] sm:px-4"
        >
          {primary.shortLabel ? (
            <>
              <span className="sm:hidden">{primary.shortLabel}</span>
              <span className="hidden sm:inline">{primary.label}</span>
            </>
          ) : (
            primary.label
          )}
        </Link>
      ) : null}
    </header>
  );
}
