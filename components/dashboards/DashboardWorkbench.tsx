"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import DemoFrame from "./DemoFrame";
import RepoCodeView from "./RepoCodeView";
import FullscreenLink from "@/components/fullscreen/FullscreenLink";
import RatingStars from "@/components/community/RatingStars";
import { trackUsage } from "@/lib/community/usage";
import type { DashboardRecord } from "@/lib/dashboards/types";
import { frameworkLabel, uiLabel } from "@/lib/gallery/cards";
import { repoUrl, zipUrl } from "@/lib/dashboards/urls";

type Tab = "demo" | "code" | "about";

interface DashboardWorkbenchProps {
  // The site navigation, rendered on the server.
  nav: React.ReactNode;
  dashboard: DashboardRecord;
  files: Array<[string, number]>;
  // Static HTML dashboards can be edited page by page in the playground.
  editable: boolean;
}

export default function DashboardWorkbench({ nav, dashboard: d, files, editable }: DashboardWorkbenchProps) {
  const [tab, setTab] = useState<Tab>("demo");
  const [page, setPage] = useState("");
  const onNavigate = useCallback((p: string) => setPage(p), []);
  const stack = frameworkLabel(d.framework);
  const ui = uiLabel(d.ui);
  const editPage = page || (d.spa ? "" : d.entry);

  return (
    // Desktop: an app-sized screen. The navigation, title bar and tabs stay
    // put and the demo (or code) fills the rest, so scrolling inside the demo
    // never fights the page. Phones keep normal page flow.
    <div className="flex min-h-screen flex-col font-sans text-ink lg:h-screen lg:min-h-0 lg:overflow-hidden">
      {nav}

      <div className="border-b-2 border-ink bg-paper">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 md:px-6 lg:flex-nowrap lg:px-10">
          <Link
            href="/gallery/dashboards"
            className="hidden h-10 shrink-0 items-center gap-2 border-2 border-ink bg-paper px-3 font-mono text-[10px] uppercase tracking-[0.18em] shadow-brut-sm transition-colors hover:bg-ink hover:text-paper sm:inline-flex"
          >
            <span aria-hidden="true">←</span> All dashboards
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl leading-none tracking-tight md:text-3xl" title={d.title}>
              {d.title}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              <span className="chip chip-accent">{stack}</span>
              <span className="chip">{ui}</span>
              <span>
                {d.pages.length} {d.pages.length === 1 ? "page" : "pages"}
              </span>
              <span>{d.license.spdx}</span>
              <span className="normal-case tracking-normal">by {d.author}</span>
              <RatingStars targetType="dashboard" targetId={d.slug} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={zipUrl(d)} className="btn btn-accent h-10 py-0" download onClick={() => trackUsage("dashboard", d.slug, "export")}>
              Download ZIP
            </a>
            <FullscreenLink href={`/d/${d.slug}/live${page ? `?page=${encodeURIComponent(page)}` : ""}`} />
            {editable ? (
              <Link href={`/d/${d.slug}/edit?page=${encodeURIComponent(editPage)}`} className="btn h-10 py-0">
                Edit this page
              </Link>
            ) : (
              <a href={`https://stackblitz.com/github/${d.repo}/tree/${d.sha}`} target="_blank" rel="noreferrer" className="btn h-10 py-0">
                StackBlitz ↗
              </a>
            )}
            <a href={repoUrl(d)} target="_blank" rel="noreferrer" className="btn h-10 py-0">
              GitHub ↗
            </a>
          </div>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-[1400px] flex-col px-4 pb-10 pt-4 md:px-6 lg:min-h-0 lg:flex-1 lg:px-10 lg:pb-4">
        <div className="flex overflow-x-auto border-2 border-b-0 border-ink bg-paper" role="tablist" aria-label="Dashboard views">
          {(
            [
              ["demo", "Live demo"],
              ["code", `Code · ${files.length.toLocaleString("en-US")} files`],
              ["about", "About & license"],
            ] as const
          ).map(([id, label], i) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={
                "flex-1 whitespace-nowrap px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors md:flex-none md:px-5 md:text-[11px] " +
                (i > 0 ? "border-l-2 border-ink " : "") +
                (tab === id ? "bg-ink text-paper" : "hover:bg-sun")
              }
            >
              {label}
            </button>
          ))}
          <p className="ml-auto hidden max-w-[44ch] self-center truncate px-4 text-xs text-ink/60 xl:block" title={d.description}>
            {d.description}
          </p>
        </div>

        {/* The demo stays mounted while other tabs are open, so switching
            back doesn't reload it or lose the page you were on. */}
        <div hidden={tab !== "demo"} className={tab === "demo" ? "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col" : undefined}>
          <DemoFrame
            slug={d.slug}
            spa={d.spa}
            entry={d.entry}
            title={d.title}
            pages={d.pages}
            onNavigate={onNavigate}
            fillOnDesktop
            fullscreenHref={`/d/${d.slug}/live`}
          />
        </div>
        {tab === "code" && (
          <div className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
            <RepoCodeView repo={d.repo} sha={d.sha} entry={d.entry} files={files} fillOnDesktop />
          </div>
        )}
        {tab === "about" && (
          <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            <About d={d} stack={stack} ui={ui} />
          </div>
        )}
      </main>
    </div>
  );
}

function About({ d, stack, ui }: { d: DashboardRecord; stack: string; ui: string }) {
  const rows: Array<[string, React.ReactNode]> = [
    ["Stack", stack],
    ["UI kit", ui],
    ["Pages", `${d.pages.length} working pages${d.check ? `, checked ${d.check.checkedAt.slice(0, 10)}` : ""}`],
    [
      "License",
      <a key="l" href={d.license.url} target="_blank" rel="noreferrer" className="underline decoration-coral underline-offset-4 hover:text-coral">
        {d.license.spdx} - read the license text
      </a>,
    ],
    [
      "Source",
      <a key="s" href={repoUrl(d)} target="_blank" rel="noreferrer" className="break-all underline decoration-coral underline-offset-4 hover:text-coral">
        github.com/{d.repo} @ {d.sha.slice(0, 10)}
      </a>,
    ],
    ["Author", d.author],
  ];
  if (d.demoUrl) {
    rows.push([
      "Original demo",
      <a key="o" href={d.demoUrl} target="_blank" rel="noreferrer" className="break-all underline decoration-coral underline-offset-4 hover:text-coral">
        {d.demoUrl}
      </a>,
    ]);
  }
  return (
    <div className="grid gap-6 border-2 border-ink bg-card p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:p-8">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="space-y-3 text-sm text-ink/80">
        <h2 className="font-display text-2xl text-ink">Using it</h2>
        <p>
          {d.title} is free and open source under the {d.license.spdx} license. You can use it in personal and
          commercial projects. Keep the license notice from the download in your copy.
        </p>
        <p>
          The download is the author&apos;s original source at the commit shown here. The live demo runs that same
          code, with analytics scripts removed.
        </p>
      </div>
    </div>
  );
}
