import type { Metadata } from "next";
import Link from "@/components/site/IntentLink";
import type { CSSProperties, ReactNode } from "react";
import HeroWatermark from "@/components/HeroWatermark";
import MarqueeLanes from "@/components/MarqueeLanes";
import SiteNav from "@/components/site/SiteNav";
import { CardArt, CtaWolf, CtaWolfSmall, FooterSleeper, HeroGround, NightScene, StepsRunner } from "@/components/landing/Arcade";
import WolfPlay from "@/components/landing/WolfPlay";
import HeroStage from "@/components/landing/HeroStage";
import { getLandingData, type Count, type LandingData } from "@/components/landing/data";
import { LinkedInGlyph } from "@/components/landing/icons";
import MotionGroup, { MotionToggle } from "@/components/motion/MotionGroup";
import RevealObserver from "@/components/motion/RevealObserver";
import { getGalleryTabs } from "@/lib/gallery/sections";
import type { GalleryCard } from "@/lib/gallery/types";
import "./arcade.css";
import { REPO_URL, SITE_TITLE, SITE_URL, socialMeta } from "@/lib/site";

const FOUNDER_LINKEDIN = "https://www.linkedin.com/in/nikita-akella-41b728368/";
const COMPANY_LINKEDIN = "https://www.linkedin.com/company/akella-inmotion/";
const STUDIO_URL = "https://akellainmotion.com";

const fmt = (n: number) => n.toLocaleString("en-US");
// Inline CSS custom properties (--d delay, --i stagger index, --rot tilt).
const vars = (v: Record<string, string | number>) => v as CSSProperties;

export async function generateMetadata(): Promise<Metadata> {
  const tabs = await getGalleryTabs();
  const n = (id: string) => tabs.find((t) => t.id === id)?.count ?? 0;
  const description = `${fmt(n("landing"))} landing pages, ${fmt(n("dashboards"))} working dashboards and ${fmt(n("components"))} components, free and MIT-licensed. Preview them live, edit them in your browser, then copy the code or download it. No install, no sign-in.`;
  return {
    title: { absolute: SITE_TITLE },
    description,
    alternates: { canonical: "/" },
    ...socialMeta({ title: SITE_TITLE, description, path: "/" }),
  };
}

// The page reads nothing from the request (no query, no cookies), so it is
// built once per deploy and served from the CDN. Everything on it comes from
// the data files in the repo.
export default async function HomePage() {
  const [tabs, data] = await Promise.all([getGalleryTabs(), getLandingData()]);

  return (
    <main className="w-full font-sans text-ink">
      <JsonLd data={data} />
      <SiteNav tabs={tabs} sticky />
      <Hero data={data} />
      <Ticker data={data} />
      <Libraries data={data} />
      <Taste lanes={data.lanes} />
      <HowItWorks />
      <Trust data={data} />
      <Coming />
      <FinalCta data={data} />
      <Footer />
      <RevealObserver />
      {/* The game of fetch, in the hero and the footer. */}
      <WolfPlay />
    </main>
  );
}

/* ------------------------------------------------------------------------ */
/* Shared bits                                                              */
/* ------------------------------------------------------------------------ */

function SectionLabel({ n, children, tone = "ink" }: { n: string; children: ReactNode; tone?: "ink" | "paper" }) {
  return (
    <p className={"flex items-center gap-3 font-mono text-[11px] font-bold uppercase tracking-[0.28em] " + (tone === "paper" ? "text-sun" : "text-coral")}>
      <span className={"px-1.5 py-0.5 tracking-[0.1em] " + (tone === "paper" ? "bg-sun text-ink" : "bg-ink text-paper")}>{n}</span>
      {children}
    </p>
  );
}

// A big serif heading whose lines rise from behind their own edge.
function Lines({ id, lines, className }: { id?: string; lines: ReactNode[]; className: string }) {
  return (
    <h2 id={id} data-reveal="lines" className={className}>
      {lines.map((line, i) => (
        <span key={i} className="rv-line">
          <span>{line}</span>
        </span>
      ))}
    </h2>
  );
}

function CountList({ items, className = "" }: { items: Count[]; className?: string }) {
  return (
    <ul className={"flex flex-wrap gap-2 " + className}>
      {items.map((c) => (
        <li key={c.label}>
          {c.href ? (
            <Link
              href={c.href}
              className="inline-flex items-center gap-2 border-2 border-ink bg-card px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors hover:bg-sun"
            >
              {c.label}
              <span className="tabular-nums text-coral">{fmt(c.count)}</span>
            </Link>
          ) : (
            <span className="inline-flex items-center gap-2 border-2 border-ink/25 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em]">
              {c.label}
              <span className="tabular-nums text-muted">{fmt(c.count)}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Thumb({ card, ratio = "aspect-[4/3]", sizes = { w: 640, h: 480 } }: { card: GalleryCard; ratio?: string; sizes?: { w: number; h: number } }) {
  return (
    <span className={"lp-zoom relative block overflow-hidden bg-soft " + ratio}>
      {card.thumb ? (
        <img
          src={card.thumb}
          alt={`${card.title}: ${card.subtitle}`}
          width={sizes.w}
          height={sizes.h}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-top"
        />
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/* Hero                                                                     */
/* ------------------------------------------------------------------------ */

function Hero({ data }: { data: LandingData }) {
  const { counts } = data;
  const stats = [
    { value: fmt(counts.landing), label: "Landing pages", href: "/gallery", isNew: false },
    { value: fmt(counts.dashboards), label: "Live dashboards", href: "/gallery/dashboards", isNew: true },
    { value: fmt(counts.components), label: "Components", href: "/gallery/components", isNew: false },
  ];
  return (
    <section aria-labelledby="hero-heading" className="relative overflow-x-clip border-b-2 border-ink">
      {/* The bottom padding is the wolf's strip of ground (HeroGround). */}
      <div className="relative mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-12 px-4 pb-28 pt-10 sm:px-6 sm:pt-14 lg:min-h-[calc(100dvh-68px)] lg:grid-cols-12 lg:gap-8 lg:px-10 lg:pb-24 lg:pt-12">
        <div className="relative isolate lg:col-span-6">
          <HeroWatermark />
          <div className="hero-rise flex flex-wrap items-center gap-2" style={vars({ "--d": "0ms" })}>
            <span className="sticker">New · {fmt(counts.dashboards)} live dashboards</span>
            <span className="chip">MIT-style licences</span>
            <span className="chip">No sign-in</span>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="chip relative transition-colors before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:bg-sun">
              Open source
            </a>
          </div>

          <h1
            id="hero-heading"
            className="mt-7 font-display text-[clamp(2.6rem,12.4vw,4.75rem)] leading-[0.9] tracking-[-0.035em] sm:text-[clamp(4.5rem,11vw,6rem)] lg:text-[clamp(4.5rem,6.4vw,6.9rem)]"
          >
            <span className="hero-line rv-line">
              <span style={vars({ "--d": "70ms" })}>Drop in.</span>
            </span>
            <span className="hero-line rv-line" style={{ paddingBottom: "0.3em", marginBottom: "-0.3em" }}>
              <span style={vars({ "--d": "160ms" })}>
                <em className="pr-[0.06em] text-coral">Remix anything.</em>
              </span>
            </span>
            <span className="hero-line rv-line">
              <span style={vars({ "--d": "250ms" })}>Ship it.</span>
            </span>
          </h1>

          <p className="hero-rise mt-8 max-w-[35rem] text-base leading-relaxed text-ink/80 sm:text-lg" style={vars({ "--d": "360ms" })}>
            <strong className="font-semibold text-ink">A free UI library for vibecoders.</strong> Landing pages, complete dashboards and
            components you can preview live, edit in your browser, then copy or download. MIT-licensed. No install, no sign-in.
          </p>

          <ul className="hero-rise mt-8 grid max-w-[36rem] grid-cols-3 gap-3 sm:gap-4" style={vars({ "--d": "440ms" })}>
            {stats.map((s) => (
              <li key={s.label}>
                <Link
                  href={s.href}
                  className="lp-lift relative flex h-full flex-col justify-between border-2 border-ink bg-card p-3 shadow-brut sm:p-4"
                >
                  {s.isNew ? (
                    <span className="sticker hero-pop lp-tilt absolute -right-3 -top-3 z-10" style={vars({ "--rot": "7deg", "--d": "950ms" })}>
                      New
                    </span>
                  ) : null}
                  <span className="font-display text-[1.9rem] leading-none tracking-tight tabular-nums sm:text-4xl xl:text-5xl">{s.value}</span>
                  <span className="mt-3 flex items-end justify-between gap-1 font-mono text-[9px] uppercase leading-tight tracking-[0.16em] text-ink/70 sm:text-[10px]">
                    {s.label}
                    <span className="lp-arrow text-sm leading-none text-coral" aria-hidden="true">
                      ↗
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="hero-rise mt-9 flex flex-wrap items-center gap-3" style={vars({ "--d": "520ms" })}>
            <Link href="/gallery" className="btn btn-accent">
              Browse the gallery <span className="lp-arrow" aria-hidden="true">→</span>
            </Link>
            {/* The editor needs a real screen; phones start from the gallery. */}
            <Link href="/playground" className="btn hidden sm:inline-flex">
              Open playground
            </Link>
          </div>
        </div>

        <div className="lg:col-span-6">
          <HeroStage dashboards={data.stage.dashboards} landing={data.stage.landing} component={data.stage.component} />
        </div>
      </div>
      <HeroGround />
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Ticker                                                                   */
/* ------------------------------------------------------------------------ */

function Ticker({ data }: { data: LandingData }) {
  const { counts } = data;
  const items: ReactNode[] = [
    <>
      <b className="font-display text-2xl font-normal normal-case tracking-tight text-sun">{fmt(counts.dashboards)}</b> live dashboards
    </>,
    <>
      <b className="font-display text-2xl font-normal normal-case tracking-tight text-sun">{fmt(counts.dashboardPages)}</b> clickable pages
    </>,
    <>
      <b className="font-display text-2xl font-normal normal-case tracking-tight text-sun">{fmt(counts.landing)}</b> landing pages
    </>,
    <>
      <b className="font-display text-2xl font-normal normal-case tracking-tight text-sun">{fmt(counts.components)}</b> components
    </>,
    <>MIT · Apache · BSD</>,
    <>No sign-in</>,
    <>Copy · download · ship</>,
  ];
  // Two identical halves; the track slides by exactly one half per loop.
  const half = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {[...items, ...items].map((item, i) => (
        <li key={i} className="flex shrink-0 items-center whitespace-nowrap font-mono text-xs uppercase tracking-[0.22em]">
          <span className="flex items-baseline gap-2.5 px-6">{item}</span>
          <span className="text-lg text-coral" aria-hidden="true">
            ✶
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <MotionGroup label="the ticker" className="relative overflow-hidden border-b-2 border-ink bg-ink py-3.5 text-paper">
      <div className="lp-ticker-track" style={vars({ "--dur": "70s" })}>
        {half(false)}
        {half(true)}
      </div>
      <div className="absolute inset-y-0 right-0 flex items-center bg-gradient-to-l from-ink from-60% to-transparent pl-10 pr-3">
        <MotionToggle
          showText={false}
          className="h-8 w-8 justify-center border-2 border-paper/80 text-paper transition-colors hover:border-sun hover:bg-sun hover:text-ink"
        />
      </div>
    </MotionGroup>
  );
}

/* ------------------------------------------------------------------------ */
/* The three libraries                                                      */
/* ------------------------------------------------------------------------ */

function Libraries({ data }: { data: LandingData }) {
  const { counts, dashboards, landing, components } = data;
  return (
    <section aria-labelledby="libraries-heading" className="border-b-2 border-ink">
      <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <SectionLabel n="01">The library</SectionLabel>
            <Lines
              id="libraries-heading"
              className="mt-5 font-display text-[clamp(2.6rem,6vw,5rem)] leading-[0.95] tracking-[-0.03em]"
              lines={["Three libraries.", <em key="e" className="text-coral">One playground.</em>]}
            />
          </div>
          <p data-reveal="rise" className="text-base leading-relaxed text-ink/75 lg:col-span-5 lg:pb-2 lg:text-lg">
            Everything opens in the same place: preview it live, change it in the editor, then copy the code or download the files.
            Free for personal and commercial work.
          </p>
        </div>
        <div data-reveal="draw" className="mt-10 h-[3px] origin-left bg-ink" aria-hidden="true" />

        {/* Dashboards: the headline */}
        <div data-reveal="rise" className="mt-12">
          <article className="grid border-2 border-ink bg-card shadow-brut-lg lg:grid-cols-12">
            <div className="flex flex-col border-b-2 border-ink p-6 sm:p-8 lg:col-span-5 lg:border-b-0 lg:border-r-2 lg:p-10">
              <p className="flex items-center gap-3">
                <span className="sticker">New</span>
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.28em]">Dashboards</span>
              </p>
              <h3 className="mt-5 font-display text-[clamp(2.2rem,4.2vw,3.6rem)] leading-[0.95] tracking-[-0.03em]">
                <span className="tabular-nums">{fmt(counts.dashboards)}</span> full dashboards.{" "}
                <em className="text-coral">Every page clickable.</em>
              </h3>
              <p className="mt-5 leading-relaxed text-ink/75">
                Not screenshots: real admin apps running live, {fmt(counts.dashboardPages)} pages in all. Click through every page,
                switch to tablet or mobile, read each source file, then download the original ZIP.
              </p>
              <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.28em] text-muted">Built with</p>
              <CountList items={dashboards.stacks} className="mt-3" />
              <p className="mt-5 text-sm leading-relaxed text-ink/60">
                {dashboards.uiKits.map((k) => `${k.label} ${k.count}`).join(" · ")}
              </p>
              <div className="mt-8 flex flex-wrap gap-3 lg:mt-auto lg:pt-8">
                <Link href="/gallery/dashboards" className="btn btn-accent">
                  Browse dashboards <span className="lp-arrow" aria-hidden="true">→</span>
                </Link>
                <Link href="/d/adminlte-4-html" className="btn">
                  Try one live
                </Link>
              </div>
            </div>
            <div className="bg-soft p-5 sm:p-8 lg:col-span-7 lg:p-10">
              <ul data-reveal="stagger" className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {dashboards.mosaic.map((c, i) => (
                  <li key={c.key} style={vars({ "--i": i })}>
                    <Link href={c.selectHref} className="lp-lift block border-2 border-ink bg-card shadow-brut">
                      <span className="relative block border-b-2 border-ink">
                        <Thumb card={c} ratio="aspect-[16/10]" sizes={{ w: 1280, h: 800 }} />
                        <span className="absolute left-2 top-2 flex gap-1">
                          {c.chips.map((chip) => (
                            <span key={chip.label} className={"chip " + (chip.accent ? "chip-accent" : "")}>
                              {chip.label}
                            </span>
                          ))}
                        </span>
                      </span>
                      <span className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <span className="truncate font-display text-lg leading-none tracking-tight">{c.title}</span>
                        <span className="lp-arrow shrink-0 text-coral" aria-hidden="true">
                          ↗
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-8">
          {/* Landing pages */}
          <div data-reveal="rise">
            <article className="flex h-full flex-col border-2 border-ink bg-card shadow-brut-lg">
              <Link href="/gallery" className="lp-fan relative block h-[200px] overflow-hidden border-b-2 border-ink bg-soft sm:h-[290px]" aria-label="Browse the landing pages">
                {landing.fan.map((c) => (
                  <span
                    key={c.key}
                    className="lp-fan-card absolute border-2 border-ink bg-card shadow-brut"
                  >
                    <Thumb card={c} sizes={{ w: 1280, h: 800 }} />
                  </span>
                ))}
              </Link>
              <div className="flex flex-1 flex-col p-6 sm:p-8">
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.28em]">Landing pages</p>
                <h3 className="mt-4 font-display text-[clamp(2rem,3.4vw,3rem)] leading-[0.95] tracking-[-0.03em]">
                  <span className="tabular-nums">{fmt(counts.landing)}</span> landing pages. <em className="text-coral">Made in‑house.</em>
                </h3>
                <p className="mt-4 leading-relaxed text-ink/75">
                  Our own templates in JSX and HTML: SaaS, shops, portfolios, blogs and more. Click any text, image or colour in the
                  playground to change it.
                </p>
                <CountList items={landing.categories.slice(0, 5)} className="mt-6" />
                <p className="mt-4 text-sm text-ink/60">Styles: {landing.styles.map((s) => `${s.label} ${s.count}`).join(" · ")}</p>
                <div className="mt-8 lg:mt-auto lg:pt-8">
                  <Link href="/gallery" className="btn btn-accent">
                    Browse landing pages <span className="lp-arrow" aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            </article>
          </div>

          {/* Components */}
          <div data-reveal="rise" style={vars({ "--d": "120ms" })}>
            <article className="flex h-full flex-col border-2 border-ink bg-card shadow-brut-lg">
              <ul data-reveal="stagger" className="grid h-[240px] grid-cols-3 grid-rows-2 gap-3 overflow-hidden border-b-2 border-ink bg-soft p-4 sm:h-[290px] sm:gap-4 sm:p-5">
                {components.grid.map((c, i) => (
                  <li key={c.key} className="min-h-0" style={vars({ "--i": i })}>
                    <Link href={c.selectHref} className="lp-lift block h-full overflow-hidden border-2 border-ink bg-card shadow-brut-sm" title={c.title}>
                      <span className="lp-zoom block h-full overflow-hidden">
                        {c.thumb ? (
                          <img src={c.thumb} alt={c.title} width={640} height={480} loading="lazy" decoding="async" className="h-full w-full object-cover object-center" />
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="flex flex-1 flex-col p-6 sm:p-8">
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.28em]">Components</p>
                <h3 className="mt-4 font-display text-[clamp(2rem,3.4vw,3rem)] leading-[0.95] tracking-[-0.03em]">
                  <span className="tabular-nums">{fmt(counts.components)}</span> components.{" "}
                  <em className="text-coral">From {counts.sources} open-source kits.</em>
                </h3>
                <p className="mt-4 leading-relaxed text-ink/75">
                  Buttons, cards, heroes, pricing tables, footers and whole screens. Each one has a live preview, its code and an
                  install command.
                </p>
                <CountList items={components.types.map((t) => ({ ...t, href: undefined }))} className="mt-6" />
                <p className="mt-4 text-sm text-ink/60">
                  From {components.sources.slice(0, 6).map((s) => s.label).join(", ")} and more.
                </p>
                <div className="mt-8 lg:mt-auto lg:pt-8">
                  <Link href="/gallery/components" className="btn btn-accent">
                    Browse components <span className="lp-arrow" aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* A taste of the gallery (all three libraries in moving lanes)             */
/* ------------------------------------------------------------------------ */

function Taste({ lanes }: { lanes: GalleryCard[][] }) {
  return (
    <section aria-labelledby="taste-heading" className="border-b-2 border-ink bg-[#FCFBF9]">
      <MotionGroup label="the gallery lanes" className="lp-marquee">
        <div className="mx-auto max-w-[1400px] px-4 pt-20 sm:px-6 lg:px-10 lg:pt-28">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <SectionLabel n="02">Featured</SectionLabel>
              <Lines
                id="taste-heading"
                className="mt-5 font-display text-[clamp(2.6rem,6vw,5rem)] leading-[0.95] tracking-[-0.03em]"
                lines={["A taste of", <em key="e" className="text-coral">the gallery.</em>]}
              />
              <p data-reveal="rise" className="mt-5 max-w-xl text-ink/70">
                Dashboards on top, landing pages in the middle, components below. Open any tile to see it live.
              </p>
            </div>
            <div data-reveal="rise" className="flex flex-wrap items-center gap-3">
              <MotionToggle className="h-[42px] border-2 border-ink bg-card px-4 shadow-brut-sm transition-colors hover:bg-sun" />
              <Link href="/gallery" className="btn">
                Open the gallery <span className="lp-arrow" aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
        {/* Full-bleed lanes. */}
        <div className="mt-12 w-full pb-20 lg:pb-28">
          <MarqueeLanes rows={lanes} reverseLanes={[1]} durations={["150s", "175s", "160s"]} tileWidthPx={260} className="space-y-5" />
        </div>
      </MotionGroup>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* How it works                                                             */
/* ------------------------------------------------------------------------ */

const STEPS = [
  { n: "01", title: "Pick", body: "Browse landing pages, dashboards and components, or search all of them at once.", art: "pick" },
  { n: "02", title: "Preview", body: "Everything runs live. Click through a dashboard's pages and try it at tablet or phone size.", art: "preview" },
  { n: "03", title: "Remix", body: "Change text, colours and images in the playground. Or paste your own AI-made HTML or JSX.", art: "remix" },
  { n: "04", title: "Ship", body: "Copy the code, download the file or grab the original ZIP. No account, no lock-in.", art: "ship" },
] as const;

function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="border-b-2 border-ink">
      <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <SectionLabel n="03">How it works</SectionLabel>
        <Lines
          id="how-heading"
          // Above the wolf (StepsRunner), which hops up just under the second line.
          className="relative z-[1] mt-5 font-display text-[clamp(2.6rem,6vw,5rem)] leading-[0.95] tracking-[-0.03em]"
          lines={["From pick to shipped.", <em key="e" className="text-coral">No setup.</em>]}
        />
        <div className="relative mt-14">
          {/* The rule that joins the four steps draws across behind them. */}
          <div data-reveal="draw" className="absolute left-0 right-0 top-[58px] hidden h-[3px] origin-left bg-ink lg:block" aria-hidden="true" />
          <ol data-reveal="stagger" className="relative grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {STEPS.map((s, i) => (
              <li key={s.n} style={vars({ "--i": i })}>
                <div className="lp-lift lp-lift-coral flex h-full flex-col border-2 border-ink bg-card p-6 shadow-brut">
                  <div className="flex items-center justify-between gap-4">
                    <span className="step-tile flex h-[72px] w-[72px] items-center justify-center border-2 border-ink bg-sun font-display text-4xl leading-none tracking-tight">
                      {s.n}
                    </span>
                    <CardArt name={s.art} className="step-art" />
                  </div>
                  <h3 className="mt-6 font-display text-3xl leading-none tracking-tight">{s.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink/75">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <StepsRunner />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Trust                                                                    */
/* ------------------------------------------------------------------------ */

function Trust({ data }: { data: LandingData }) {
  const tiles = [
    {
      title: "MIT-style licences only",
      body: "MIT, Apache-2.0, BSD and ISC. We read every licence and leave out anything that asks for credit links, payment or a sign-up.",
      art: "licence",
    },
    {
      title: "Checked in a real browser",
      body: `Before a dashboard is listed, a browser opens all of its pages (${fmt(data.counts.dashboardPages)} so far) and checks for broken files, errors and blank screens.`,
      art: "checked",
    },
    {
      title: "No trackers",
      body: "Analytics and ad scripts are stripped from every demo, and demos run sandboxed, away from your data.",
      art: "trackers",
    },
    {
      title: "The real source",
      body: "Download the original project at its exact version, licence included, or copy a single file.",
      art: "source",
    },
  ] as const;
  return (
    <section aria-labelledby="trust-heading" className="border-b-2 border-ink bg-ink text-paper">
      <div className="mx-auto grid max-w-[1400px] gap-12 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-10 lg:py-28">
        <div className="lg:col-span-5">
          <SectionLabel n="04" tone="paper">
            The fine print
          </SectionLabel>
          <Lines
            id="trust-heading"
            className="mt-5 font-display text-[clamp(2.6rem,6vw,5rem)] leading-[0.95] tracking-[-0.03em]"
            lines={["Free means free.", <em key="e" className="text-coral">No catches.</em>]}
          />
          <p data-reveal="rise" className="mt-6 max-w-md leading-relaxed text-paper/70">
            Use anything here in personal and commercial projects. Here&apos;s how we keep it that way.
          </p>
          <NightScene />
        </div>
        <ul data-reveal="stagger" className="grid gap-5 sm:grid-cols-2 lg:col-span-7">
          {tiles.map((t, i) => (
            <li key={t.title} style={vars({ "--i": i })}>
              <div className="lp-lift lp-lift-sun h-full border-2 border-paper bg-ink p-6 shadow-[4px_4px_0_0_#FF4D2E]">
                <CardArt name={t.art} className="print-art" />
                <h3 className="mt-5 font-display text-2xl leading-tight tracking-tight">{t.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-paper/70">{t.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* What's coming                                                            */
/* ------------------------------------------------------------------------ */

function Coming() {
  // `wide`: a card that takes a whole row (the new library leads the list, and
  // the six that follow keep their two rows of three). It is the one thing
  // here that is already open, so its badge says "New".
  const cards: Array<{ title: string; body: string; badge: "New" | "Soon" | "Beta" | "Ongoing"; mock: ReactNode; wide?: boolean; link?: { href: string; label: string; external?: boolean } }> = [
    {
      wide: true,
      title: "GSAP sites, the fourth library",
      body: "Three complete websites built with GSAP: a watch that comes apart into its 147 parts, a map that zooms from the whole earth to one door, a drawing that becomes a house. Free like the rest, to open, study and remix.",
      badge: "New",
      mock: (
        <div className="flex h-full flex-col justify-between font-mono text-[10px] uppercase tracking-[0.14em]">
          <div className="flex items-center gap-2">
            <span className="shrink-0">Scroll</span>
            <span className="relative h-0.5 flex-1 bg-ink/20" aria-hidden="true">
              <span className="absolute inset-y-0 left-0 w-3/5 bg-coral" />
              <span className="absolute left-[60%] top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 border-2 border-ink bg-sun" />
            </span>
            <span className="shrink-0 tabular-nums text-muted">03 / 06</span>
          </div>
          <div className="flex gap-1.5">
            <span className="chip chip-accent">GSAP</span>
            <span className="chip">WebGL</span>
            <span className="chip">Full sites</span>
          </div>
        </div>
      ),
      link: { href: "/gallery/gsap", label: "Open the GSAP sites" },
    },
    {
      title: "Your own studio",
      body: "A free account and a place for everything you make. Drafts save as you type, every version is kept, and you can start from any page, dashboard or component, or paste your own code.",
      badge: "Soon",
      mock: (
        <div className="flex h-full flex-col justify-between font-mono text-[10px] uppercase tracking-[0.14em]">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate normal-case tracking-normal">my-launch-page.html</span>
            <span className="flex shrink-0 items-center gap-1.5 text-coral">
              <span className="h-1.5 w-1.5 bg-coral" aria-hidden="true" /> Saved
            </span>
          </div>
          <div className="flex gap-1.5">
            <span className="chip chip-accent">v3</span>
            <span className="chip">v2</span>
            <span className="chip">v1</span>
          </div>
        </div>
      ),
    },
    {
      title: "Publish to the community",
      body: "Share the pages you build in a public community gallery, each with its own link people can open, rate and remix.",
      badge: "Soon",
      mock: (
        <div className="flex h-full flex-col justify-between">
          <span className="truncate border-2 border-ink bg-paper px-2 py-1 font-mono text-[10px]">aimdropin.com/p/your-page</span>
          <span className="flex gap-1.5">
            <span className="chip chip-accent">Published</span>
            <span className="chip">Remix</span>
          </span>
        </div>
      ),
    },
    {
      title: "Ratings that rank",
      body: "Star ratings and view counts on every landing page, dashboard and component, so the best of the library rises to the top.",
      badge: "Soon",
      mock: (
        <div className="flex h-full flex-col justify-between">
          <span className="lp-stars flex gap-1 text-2xl leading-none text-ink/25" aria-hidden="true">
            <span>★</span>
            <span>★</span>
            <span>★</span>
            <span>★</span>
            <span>★</span>
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">4.8 · 1,204 views · top rated</span>
        </div>
      ),
    },
    {
      title: "Community picks join the library",
      body: "Pages the community rates highly get promoted into the main gallery, right next to ours.",
      badge: "Soon",
      mock: (
        <div className="flex h-full flex-col justify-between font-mono text-[10px] uppercase tracking-[0.14em]">
          <div className="flex items-center gap-2">
            <span className="border-2 border-dashed border-ink px-2 py-1">Community</span>
            <span className="relative flex-1 border-t-2 border-ink" aria-hidden="true">
              <span className="absolute -right-0.5 -top-[7px] text-[11px] leading-none">▶</span>
            </span>
            <span className="border-2 border-ink bg-sun px-2 py-1">Library</span>
          </div>
          <span className="font-bold text-coral">10+ ratings · 4★ average</span>
        </div>
      ),
    },
    {
      title: "Build with your own AI",
      body: "Pick pieces into a kit, describe the page you want, and your own AI assembles it. Already in beta, getting better every week.",
      badge: "Beta",
      link: { href: "/build", label: "Try the beta" },
      mock: (
        <div className="flex h-full flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em]">
          <span className="chip">Hero</span>
          <span aria-hidden="true">+</span>
          <span className="chip">Pricing</span>
          <span aria-hidden="true">+</span>
          <span className="chip">Footer</span>
          <span className="text-coral" aria-hidden="true">
            →
          </span>
          <span className="chip chip-accent">Your page</span>
        </div>
      ),
    },
    {
      title: "A library that keeps growing",
      body: "We keep adding free dashboards and components as we find and check them. Follow along on LinkedIn and tell us what to add next.",
      badge: "Ongoing",
      link: { href: COMPANY_LINKEDIN, label: "Follow on LinkedIn", external: true },
      mock: (
        <div className="flex h-full items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-ink bg-ink text-paper">
            <LinkedInGlyph />
          </span>
          <span className="font-display text-xl leading-tight">Akella inMotion</span>
        </div>
      ),
    },
  ];
  return (
    <section aria-labelledby="coming-heading" className="border-b-2 border-ink">
      <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <SectionLabel n="05">What&apos;s coming</SectionLabel>
            <Lines
              id="coming-heading"
              className="mt-5 font-display text-[clamp(2.6rem,6vw,5rem)] leading-[0.95] tracking-[-0.03em]"
              lines={["Already built.", <em key="e" className="text-coral">Switching on soon.</em>]}
            />
          </div>
          <p data-reveal="rise" className="leading-relaxed text-ink/75 lg:col-span-5 lg:pb-2 lg:text-lg">
            A fourth library, of GSAP sites, has just opened. Accounts, a personal studio and a community gallery are done and being tested. Here&apos;s what they add.
          </p>
        </div>
        <ul data-reveal="stagger" className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((c, i) => (
            <li key={c.title} className={c.wide ? "md:col-span-2 lg:col-span-3" : undefined} style={vars({ "--i": i })}>
              <article
                className={
                  "lp-lift relative flex h-full flex-col border-2 border-dashed border-ink bg-[#FCFBF9] p-6 hover:border-solid hover:bg-card" +
                  (c.wide ? " lg:flex-row lg:items-center lg:gap-10" : "")
                }
              >
                <span
                  data-reveal="stamp"
                  className={"sticker lp-tilt absolute -right-3 -top-3 z-10 " + (c.badge === "Beta" ? "bg-coral text-paper" : c.badge === "Ongoing" ? "bg-ink text-paper" : "")}
                  style={vars({ "--rot": i % 2 ? "-5deg" : "5deg", "--d": `${250 + Math.min(i, 6) * 70}ms` })}
                >
                  {c.badge}
                </span>
                <div className={"h-[92px] border-2 border-ink bg-card p-3" + (c.wide ? " lg:w-[30%] lg:flex-none" : "")}>{c.mock}</div>
                <div className={c.wide ? "lg:flex-1" : "contents"}>
                  <h3 className={"mt-6 font-display text-2xl leading-tight tracking-tight" + (c.wide ? " lg:mt-0" : "")}>{c.title}</h3>
                  <p className={"mt-2 text-sm leading-relaxed text-ink/75" + (c.wide ? " lg:max-w-2xl" : "")}>{c.body}</p>
                </div>
                {c.link ? (
                  <div className={"mt-auto pt-5" + (c.wide ? " lg:mt-0 lg:flex-none lg:pt-0" : "")}>
                    {c.link.external ? (
                      <a
                        href={c.link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="lp-arrow-host inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em] underline decoration-coral decoration-2 underline-offset-4 hover:text-coral"
                      >
                        {c.link.label} <span className="lp-arrow" aria-hidden="true">↗</span>
                      </a>
                    ) : (
                      <Link
                        href={c.link.href}
                        className="lp-arrow-host inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em] underline decoration-coral decoration-2 underline-offset-4 hover:text-coral"
                      >
                        {c.link.label} <span className="lp-arrow" aria-hidden="true">→</span>
                      </Link>
                    )}
                  </div>
                ) : null}
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Final call to action                                                     */
/* ------------------------------------------------------------------------ */

function FinalCta({ data }: { data: LandingData }) {
  const total = data.counts.landing + data.counts.dashboards + data.counts.components;
  return (
    <section aria-labelledby="cta-heading" className="cta-band border-b-2 border-ink bg-coral">
      <div className="relative mx-auto grid max-w-[1400px] gap-10 px-4 pb-24 pt-20 sm:px-6 lg:grid-cols-12 lg:items-end lg:px-10 lg:py-24">
        <CtaWolfSmall />
        <div className="lg:col-span-8">
          <p data-reveal="rise" className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-ink">
            {fmt(total)} things, all free
          </p>
          <Lines
            id="cta-heading"
            className="mt-5 font-display text-[clamp(2.8rem,7vw,6rem)] leading-[0.92] tracking-[-0.035em] text-ink"
            lines={["Start with something", <em key="e">that already works.</em>]}
          />
        </div>
        <div data-reveal="rise" className="relative flex flex-wrap gap-3 lg:col-span-4 lg:justify-end">
          <CtaWolf />
          <Link href="/gallery" className="btn border-ink bg-ink text-paper hover:bg-paper hover:text-ink">
            Browse the gallery <span className="lp-arrow" aria-hidden="true">→</span>
          </Link>
          <Link href="/playground" className="btn bg-paper">
            Open playground
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Footer                                                                   */
/* ------------------------------------------------------------------------ */

function Footer() {
  return (
    <footer className="relative w-full bg-[#FCFBF9]">
      <FooterSleeper />
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-6 pb-16 pt-12 md:grid-cols-2 md:items-center md:gap-6 md:pb-12 lg:px-10">
        <div className="flex items-center gap-5">
          <Link href="/" aria-label="AiM Dropin - back to the top" className="inline-flex shrink-0">
            <img
              src="/assets/logo.png"
              alt="AiM Dropin · a project by Akella inMotion"
              width={112}
              height={112}
              loading="lazy"
              decoding="async"
              className="h-24 w-24 object-contain sm:h-28 sm:w-28"
            />
          </Link>
          <div className="flex flex-col gap-1">
            <p className="font-display text-xl leading-tight">
              <span className="text-coral">AiM</span> Dropin
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">© 2026 · Built for vibecoders</p>
            <nav aria-label="Footer" className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.2em]">
              <Link href="/gallery" className="-my-2 py-2 hover:text-coral">
                Landing pages
              </Link>
              <Link href="/gallery/dashboards" className="-my-2 py-2 hover:text-coral">
                Dashboards
              </Link>
              <Link href="/gallery/components" className="-my-2 py-2 hover:text-coral">
                Components
              </Link>
              <Link href="/playground" className="-my-2 py-2 hover:text-coral">
                Playground
              </Link>
              <Link href="/build" className="-my-2 py-2 hover:text-coral">
                AI builder
              </Link>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="-my-2 py-2 hover:text-coral">
                GitHub
              </a>
            </nav>
          </div>
        </div>

        <div className="flex flex-col items-start gap-4 md:items-end md:text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">Made by</p>
          <a
            href={STUDIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Akella inMotion - opens in a new tab"
            className="link-thick lp-arrow-host font-display text-3xl leading-tight tracking-tight transition-colors hover:text-coral md:text-4xl"
          >
            Akella inMotion
            <span aria-hidden="true" className="lp-arrow ml-2">
              ↗
            </span>
          </a>
          <nav aria-label="Akella inMotion social links" className="flex flex-wrap items-center gap-3 md:justify-end">
            <a
              href={COMPANY_LINKEDIN}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Akella inMotion on LinkedIn - company page"
              className="inline-flex items-center gap-2 border-2 border-ink bg-card px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] shadow-brut-sm transition-colors hover:bg-ink hover:text-paper"
            >
              <LinkedInGlyph />
              Company
            </a>
            <a
              href={FOUNDER_LINKEDIN}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Nikita Akella on LinkedIn - founder profile"
              className="inline-flex items-center gap-2 border-2 border-ink bg-card px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] shadow-brut-sm transition-colors hover:bg-ink hover:text-paper"
            >
              <LinkedInGlyph />
              Founder
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------------ */
/* Structured data                                                          */
/* ------------------------------------------------------------------------ */

function JsonLd({ data }: { data: LandingData }) {
  const { counts } = data;
  const json = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#org`,
        name: "Akella inMotion",
        url: STUDIO_URL,
        logo: `${SITE_URL}/assets/logo.png`,
        sameAs: [STUDIO_URL, COMPANY_LINKEDIN, FOUNDER_LINKEDIN],
        founder: { "@type": "Person", name: "Nikita Akella", url: FOUNDER_LINKEDIN },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#site`,
        url: SITE_URL,
        name: "AiM Dropin",
        description: `Free landing pages, live dashboards and UI components: ${counts.landing} landing pages, ${counts.dashboards} dashboards and ${counts.components} components, MIT-licensed.`,
        publisher: { "@id": `${SITE_URL}/#org` },
        inLanguage: "en-US",
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE_URL}/gallery/search?q={query}`,
          "query-input": "required name=query",
        },
      },
      {
        "@type": "WebApplication",
        name: "AiM Dropin Playground",
        url: `${SITE_URL}/playground`,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Any",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": `${SITE_URL}/#org` },
        description: "Live preview and editor for HTML and JSX: edit any of the library's pages or paste your own AI-generated code.",
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}
