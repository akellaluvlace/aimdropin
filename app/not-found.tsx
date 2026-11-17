import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/gallery/GalleryShell";
import { getGalleryTabs } from "@/lib/gallery/sections";

export const metadata = { title: "Not found", robots: { index: false } };

// Any unknown URL: say so plainly and send people back into the libraries.
export default async function NotFound() {
  const tabs = await getGalleryTabs().catch(() => []);
  return (
    <div className="flex min-h-screen flex-col font-sans text-ink">
      {tabs.length ? <SiteNav tabs={tabs} /> : null}
      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col justify-center px-4 py-20 md:px-6 lg:px-10">
        <p className="sticker w-fit">Error 404</p>
        <h1 className="mt-6 font-display text-display-lg">
          This page <span className="italic text-coral">dropped out.</span>
        </h1>
        <p className="mt-4 max-w-xl text-ink/75">
          The link is old or mistyped. Everything that&apos;s live is one click away.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {tabs.filter((t) => !t.soon).map((t) => (
            <Link key={t.id} href={t.href} className="btn">
              {t.label} <span className="text-muted">{t.count.toLocaleString("en-US")}</span>
            </Link>
          ))}
          <Link href="/" className="btn btn-accent">
            Home
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
