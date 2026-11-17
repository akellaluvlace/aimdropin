"use client";

import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

// A wrapper for anything that loops (marquees, tickers, slideshows). It
// sets data-paused="true" while the visitor has pressed Pause or while the
// group is offscreen; CSS in app/motion.css pauses the loops inside.
// <MotionToggle> anywhere inside renders the Pause / Play button (WCAG
// 2.2.2: moving content needs a way to stop it, hover alone doesn't count).

interface MotionState {
  paused: boolean;
  toggle: () => void;
  label: string;
}

const MotionContext = createContext<MotionState | null>(null);

export default function MotionGroup({
  children,
  label,
  className,
  style,
}: {
  children: ReactNode;
  // What's moving, for the button label ("the dashboard lanes").
  label: string;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [offscreen, setOffscreen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      // A batch can hold several entries; the last one is the current state.
      const last = entries[entries.length - 1];
      if (last) setOffscreen(!last.isIntersecting);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <MotionContext.Provider value={{ paused: userPaused, toggle: () => setUserPaused((p) => !p), label }}>
      <div ref={ref} className={className} style={style} data-paused={userPaused || offscreen ? "true" : "false"}>
        {children}
      </div>
    </MotionContext.Provider>
  );
}

export function MotionToggle({ className = "", showText = true }: { className?: string; showText?: boolean }) {
  const state = useContext(MotionContext);
  if (!state) return null;
  const { paused, toggle, label } = state;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={paused ? `Play ${label}` : `Pause ${label}`}
      className={"lp-motion-control inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] " + className}
    >
      {paused ? (
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <path d="M1 0.5v9l8-4.5z" />
        </svg>
      ) : (
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <rect x="1" y="0.5" width="3" height="9" />
          <rect x="6" y="0.5" width="3" height="9" />
        </svg>
      )}
      {showText ? <span aria-hidden="true">{paused ? "Play" : "Pause"}</span> : null}
    </button>
  );
}
