"use client";

import { useEffect } from "react";

// One IntersectionObserver for every [data-reveal] element on the page.
//
// Content is visible by default: in the server HTML, without JavaScript and
// under prefers-reduced-motion nothing is ever hidden. On mount this arms
// only the elements that start below the fold (.rv-armed puts them in their
// start state, see app/motion.css) and reveals each one once (.rv-in) as it
// scrolls into view. Elements already on screen are left alone; the hero
// has its own CSS entrance.
//
// Variants (data-reveal="…"): rise, fade, stagger (children step in by
// their --i), lines (masked .rv-line headings), draw (scaleX rule), stamp
// (stickers). Render this once per page, after the content.
export default function RevealObserver() {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("rv-in");
          io.unobserve(entry.target);
        }
      },
      // Trigger a little before the element's top reaches the bottom edge.
      { rootMargin: "0px 0px -8% 0px", threshold: 0 },
    );

    const fold = window.innerHeight * 0.92;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"))) {
      if (el.classList.contains("rv-in")) continue;
      // Armed by an earlier run (React re-runs effects in development):
      // keep watching it, whatever its position now.
      if (!el.classList.contains("rv-armed")) {
        const box = el.getBoundingClientRect();
        if (box.top < fold && box.bottom > 0) continue;
        el.classList.add("rv-armed");
      }
      io.observe(el);
    }

    return () => io.disconnect();
  }, []);

  return null;
}
