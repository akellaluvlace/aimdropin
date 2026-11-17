import Link from "@/components/site/IntentLink";
import GalleryShell from "@/components/gallery/GalleryShell";
import { getGalleryTabs } from "@/lib/gallery/sections";
import { GSAP_SITES } from "@/lib/gsap/sites";
import { REPO_URL, pageMeta } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = {
  ...pageMeta({
    title: "GSAP sites",
    description:
      GSAP_SITES.length === 0
        ? "Complete websites built with GSAP and WebGL: scroll-driven scenes, pinned stages and assembled images, free to open, study and remix. Coming soon."
        : "Complete websites built with GSAP, WebGL and canvas: a watch that comes apart into its parts, a map that zooms from the whole earth to one door, a drawing that becomes a house. Free to open, study and remix.",
    path: "/gallery/gsap",
  }),
  // Nothing to index until the first site is in.
  ...(GSAP_SITES.length === 0 ? { robots: { index: false, follow: true } } : {}),
};

const COMING = [
  {
    title: "Whole sites, not snippets",
    body: "Each one is a complete website with a story to it: an entrance, scenes that pin and hand over to each other, and an ending.",
  },
  {
    title: "Motion you can read",
    body: "Scroll-driven timelines, masked and layered images, type that moves with the page, and WebGL where a scene needs it. Each site's own code comes with it. GSAP itself is free to use under its own licence.",
  },
  {
    title: "Phones too",
    body: "Every site has its own layout and its own pacing on a phone, and holds still for people who ask for less motion.",
  },
];

// What all the sites share, under the cards.
const SHARED = [
  {
    title: "One idea each",
    body: "Every site is one sentence acted out by the scroll. The page reads the same forwards and backwards, and comes to rest on still frames.",
  },
  {
    title: "Scroll, or step",
    body: "Scroll at your own pace, or use the step buttons and the arrow keys: a tap goes on to the next rest, a hold plays.",
  },
  {
    title: "Phones too",
    body: "On a phone the picture stands on top and the words under it. People who ask for less motion get jumps in place of glides.",
  },
];

export default async function GsapGalleryPage() {
  const tabs = await getGalleryTabs();
  const open = GSAP_SITES.length > 0;
  return (
    <GalleryShell section="gsap" tabs={tabs}>
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-coral">The fourth library</p>
          {open ? (
            <>
              <h2 className="mt-5 max-w-4xl font-display text-[clamp(2.6rem,6vw,5rem)] leading-[0.95] tracking-[-0.03em]">
                Full websites, built with GSAP.
              </h2>
              <p className="mt-6 max-w-2xl leading-relaxed text-ink/75 lg:text-lg">
                Complete sites made to move, each with its own story, its own layout on a phone and its code beside it. They are concepts: the brands, products and
                buildings in them do not exist. Open one and scroll it.
              </p>
              <ul className="mt-12 grid gap-8 lg:grid-cols-3">
                {GSAP_SITES.map((s) => (
                  <li key={s.slug}>
                    <article className="card-pop flex h-full flex-col">
                      <Link href={s.liveHref} aria-label={`Open ${s.title}`} className="block border-b-2 border-ink bg-card">
                        <img src={s.thumb} alt={`A screen from ${s.title}`} width={1200} height={750} loading="lazy" decoding="async" className="aspect-[16/10] w-full object-cover" />
                      </Link>
                      <div className="flex flex-1 flex-col p-6">
                        <h3 className="font-display text-3xl leading-tight tracking-tight">{s.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-ink/75">{s.blurb}</p>
                        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="What it shows">
                          {s.techniques.map((t) => (
                            <li key={t} className="chip">
                              {t}
                            </li>
                          ))}
                        </ul>
                        <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-6">
                          <Link href={s.liveHref} className="btn btn-accent">
                            Open the site
                          </Link>
                          <a
                            href={`${REPO_URL}/tree/main/components/gsap/${s.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] underline decoration-coral decoration-2 underline-offset-4 hover:text-coral"
                          >
                            Code <span aria-hidden="true">↗</span>
                          </a>
                        </div>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
              <ul className="mt-14 grid gap-6 md:grid-cols-3">
                {SHARED.map((c) => (
                  <li key={c.title} className="border-2 border-dashed border-ink bg-[#FCFBF9] p-6">
                    <h3 className="font-display text-2xl leading-tight tracking-tight">{c.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink/75">{c.body}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-10 max-w-3xl text-sm leading-relaxed text-ink/75">
                Each site&apos;s own code is MIT, like the rest of the project. GSAP itself is free to use under{" "}
                <a href="https://gsap.com/standard-license" target="_blank" rel="noopener noreferrer" className="underline decoration-coral decoration-2 underline-offset-4 hover:text-coral">
                  its own licence
                </a>
                . Every photograph in them was generated, and the map in Meridian is drawn from Natural Earth and OpenStreetMap data.
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-5 max-w-4xl font-display text-[clamp(2.6rem,6vw,5rem)] leading-[0.95] tracking-[-0.03em]">
                Full websites, built with GSAP. <em className="text-coral">Soon.</em>
              </h2>
              <p className="mt-6 max-w-2xl leading-relaxed text-ink/75 lg:text-lg">
                Landing pages, dashboards and components are here today. Next come complete sites made to move, built with GSAP and WebGL, free to open, study and remix. The first three are being built now.
              </p>
              <ul className="mt-12 grid gap-6 md:grid-cols-3">
                {COMING.map((c) => (
                  <li key={c.title} className="border-2 border-dashed border-ink bg-[#FCFBF9] p-6">
                    <h3 className="font-display text-2xl leading-tight tracking-tight">{c.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink/75">{c.body}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="mt-12 flex flex-wrap gap-3">
            <Link href="/gallery" className={open ? "btn" : "btn btn-accent"}>
              Browse landing pages
            </Link>
            <Link href="/gallery/dashboards" className="btn">
              Browse dashboards
            </Link>
            <Link href="/gallery/components" className="btn">
              Browse components
            </Link>
          </div>
        </div>
      </div>
    </GalleryShell>
  );
}
