"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardPage } from "@/lib/dashboards/types";
import { demoPageUrl } from "@/lib/dashboards/urls";
import FullscreenLink from "@/components/fullscreen/FullscreenLink";

type Device = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTH: Record<Device, number | null> = { desktop: null, tablet: 834, mobile: 390 };

// Same flags as the demo's CSP sandbox: scripts run, but in an opaque
// origin that can't reach this site's storage or session.
const SANDBOX = "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads";

interface DemoFrameProps {
  slug: string;
  spa: boolean;
  entry: string;
  title: string;
  pages: DashboardPage[];
  // Fill the parent's height (full-screen view) instead of a fixed height.
  fill?: boolean;
  // Fill the parent's height on desktop only (the dashboard page); phones
  // keep a fixed-height frame in normal page flow.
  fillOnDesktop?: boolean;
  initialPage?: string;
  // Reports the page the visitor is on (demo-relative path).
  onNavigate?: (path: string) => void;
  // The full-screen view of this demo (/d/<slug>/live); shown as a button in
  // the toolbar, opening on the page the visitor is on.
  fullscreenHref?: string;
}

export default function DemoFrame({ slug, spa, entry, title, pages, fill = false, fillOnDesktop = false, initialPage = "", onNavigate, fullscreenHref }: DemoFrameProps) {
  const target = useMemo(() => ({ slug, spa, entry }), [slug, spa, entry]);
  const [src, setSrc] = useState(() => demoPageUrl(target, initialPage));
  const [current, setCurrent] = useState(initialPage);
  const [device, setDevice] = useState<Device>("desktop");
  const [loading, setLoading] = useState(true);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // The demo's shim posts its location on every page load and route change.
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.source !== frameRef.current?.contentWindow) return;
      const d = ev.data as { __aimDemo?: boolean; type?: string; slug?: string; path?: string } | null;
      if (!d || d.__aimDemo !== true || d.type !== "demo:location" || d.slug !== slug) return;
      const path = typeof d.path === "string" ? d.path : "";
      setCurrent(path);
      setLoading(false);
      onNavigate?.(path);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [slug, onNavigate]);

  const command = useCallback((cmd: "back" | "forward" | "reload") => {
    frameRef.current?.contentWindow?.postMessage({ __aimDemoCmd: cmd }, "*");
  }, []);

  const go = useCallback(
    (path: string) => {
      setLoading(true);
      const next = demoPageUrl(target, path);
      // Same URL twice wouldn't reload the frame; add a harmless marker.
      setSrc((prev) => (prev === next ? `${next}${next.includes("?") ? "&" : "?"}_r=${Date.now()}` : next));
      setCurrent(path);
    },
    [target],
  );

  // Until the demo reports where it is, it's on its start page: "" for apps,
  // the entry file for plain HTML.
  const shown = current || (spa ? "" : entry);
  const known = pages.some((p) => p.path === shown);
  const width = DEVICE_WIDTH[device];

  return (
    <div className={"flex flex-col border-2 border-ink bg-card " + (fill ? "h-full min-h-0" : fillOnDesktop ? "lg:min-h-0 lg:flex-1" : "")}>
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-ink bg-paper px-2 py-2">
        <div className="flex border-2 border-ink">
          {(
            [
              ["back", "←", "Back"],
              ["forward", "→", "Forward"],
              ["reload", "↻", "Reload"],
            ] as const
          ).map(([cmd, glyph, label], i) => (
            <button
              key={cmd}
              type="button"
              onClick={() => command(cmd)}
              aria-label={label}
              title={label}
              className={"h-8 w-8 font-mono text-sm hover:bg-ink hover:text-paper " + (i > 0 ? "border-l-2 border-ink" : "")}
            >
              {glyph}
            </button>
          ))}
        </div>
        <label className="relative order-last min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-0">
          <span className="sr-only">Page</span>
          <select
            value={known ? shown : "__current"}
            onChange={(e) => go(e.target.value)}
            className="h-9 w-full min-w-0 appearance-none border-2 border-ink bg-paper px-3 pr-9 font-mono text-[11px] tracking-[0.04em] text-ink focus:outline-none focus:ring-2 focus:ring-coral"
          >
            {!known && <option value="__current">/{current || "(start)"}</option>}
            {pages.map((p) => (
              <option key={p.path} value={p.path}>
                {p.title} - /{p.path}
              </option>
            ))}
          </select>
          <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px]">
            ▾
          </span>
        </label>
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted xl:inline">{pages.length} pages</span>
        <div className="hidden border-2 border-ink sm:flex" role="group" aria-label="Preview width">
          {(["desktop", "tablet", "mobile"] as const).map((d, i) => (
            <button
              key={d}
              type="button"
              aria-pressed={device === d}
              onClick={() => setDevice(d)}
              className={
                "h-8 px-2.5 font-mono text-[10px] uppercase tracking-[0.15em] " +
                (i > 0 ? "border-l-2 border-ink " : "") +
                (device === d ? "bg-ink text-paper" : "hover:bg-soft")
              }
            >
              {d}
            </button>
          ))}
        </div>
        <a
          href={demoPageUrl(target, current)}
          target="_blank"
          rel="noopener"
          className="flex h-9 items-center border-2 border-ink px-3 font-mono text-[10px] uppercase tracking-[0.15em] hover:bg-ink hover:text-paper"
        >
          New tab ↗
        </a>
        {fullscreenHref ? (
          <FullscreenLink
            href={`${fullscreenHref}${current ? `?page=${encodeURIComponent(current)}` : ""}`}
            iconOnly
            className="flex h-9 w-9 items-center justify-center border-2 border-ink bg-ink text-paper transition-colors hover:bg-sun hover:text-ink"
            iconClassName="h-4 w-4"
          />
        ) : null}
      </div>
      <div className={"relative flex justify-center overflow-auto bg-soft " + (fill ? "min-h-0 flex-1" : fillOnDesktop ? "h-[72vh] min-h-[480px] lg:h-auto lg:min-h-0 lg:flex-1" : "h-[72vh] min-h-[520px]")}>
        {loading && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 overflow-hidden bg-ink/10" aria-hidden="true">
            <div className="h-full w-1/3 animate-pulse bg-coral" />
          </div>
        )}
        <iframe
          ref={frameRef}
          key={slug}
          src={src}
          title={`${title} live demo`}
          sandbox={SANDBOX}
          referrerPolicy="no-referrer"
          onLoad={() => setLoading(false)}
          className="h-full border-0 bg-white"
          style={{ width: width ? `${width}px` : "100%", maxWidth: "100%", boxShadow: width ? "0 0 0 2px #0F0F0F" : undefined }}
        />
      </div>
    </div>
  );
}
