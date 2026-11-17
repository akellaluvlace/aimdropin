import Link from "@/components/site/IntentLink";
import type { ReactNode } from "react";
import SiteNav from "@/components/site/SiteNav";
import type { GallerySectionId, GallerySectionTab } from "@/lib/gallery/types";
import { REPO_URL } from "@/lib/site";

export type { GallerySectionTab };

// Navigation + footer around every gallery section. The page is bounded to
// the viewport on lg+ so the footer pins to the bottom and the card column
// scrolls on its own.
export default function GalleryShell({
  section,
  tabs,
  children,
}: {
  section: GallerySectionId;
  tabs: GallerySectionTab[];
  children: ReactNode;
}) {
  const current = tabs.find((t) => t.id === section);
  return (
    <main className="flex min-h-screen flex-col font-sans text-ink lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <SiteNav tabs={tabs} active={section} />
      <h1 className="sr-only">{current ? `${current.label} gallery` : "Gallery"}</h1>
      <div className="flex-1 lg:min-h-0 lg:overflow-hidden">{children}</div>
      <SiteFooter />
    </main>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-ink bg-[#FCFBF9]">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-6 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted lg:px-10">
        <p>© 2026 AiM Dropin · Made for vibecoders</p>
        <div className="flex gap-6">
          <Link href="/" className="-my-2 py-2 hover:text-coral">
            Home
          </Link>
          <Link href="/playground" className="-my-2 py-2 hover:text-coral">
            Playground
          </Link>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="-my-2 py-2 hover:text-coral">
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
