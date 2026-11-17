'use client';

// Plain <img>: every file is already the size and format it is shown at.
/* eslint-disable @next/next/no-img-element */

import { Fragment, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import styles from './sum.module.css';
import { brand, euros, faces, parts, specs, total, worn } from './content';
import { CHAPTERS, SCREENS } from './score';
import { mountSum } from './mount';

// Sum: a concept shop for a watch brand that does not exist, selling one watch.
// It stands on its own: nothing in it names, credits or links to whoever hosts it.
// The page is one pinned stage. The watch on it is drawn in WebGL from photographs of its parts and
// stays there from the first frame to the last; the scroll takes it apart, looks at each part, puts it
// back and sells it. This component only renders the markup; mount.ts wires the rest.
//
// Words and picture never share room. On a wide stage the words keep the left and the watch the right;
// on a tall one (a phone) the watch has the top of the stage and the words are under it.

const STRIPS = 9;
const assets = brand.assets;

/** A line of type behind its own window, so it can rise into place. */
const Line = ({ children, ...rest }: { children?: ReactNode } & Record<string, unknown>) => <span className={styles.line}><span data-line {...rest}>{children}</span></span>;
const Arrow = ({ up = false }: { up?: boolean }) => <svg viewBox="0 0 12 12" aria-hidden="true"><path d={up ? 'M6 10.6V1.4M2.2 5.2 6 1.4l3.8 3.8' : 'M6 1.4v9.2M2.2 6.8 6 10.6l3.8-3.8'} /></svg>;

interface SumStoreProps {
  /** Leaves Sum. What that means is the host's business: closing a preview, or going back to its own pages. */
  onExit?: () => void;
}

export default function SumStore({ onExit }: SumStoreProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => (rootRef.current ? mountSum(rootRef.current) : undefined), []);
  const tour = parts.filter(part => part.id !== 'strap');
  const cue = <><span className={styles.cueMouse}>Scroll, or hold</span><span className={styles.cueTouch}>Swipe, or tap</span><i><Arrow /></i><span>to take it apart</span></>;

  return (
    <div ref={rootRef} className={styles.root} data-sum data-shape="wide" data-entered="false" data-webgl="pending" data-bag="closed">
      <div className={styles.scroller} data-scroller tabIndex={0} role="region" aria-label="Sum, a concept watch shop">
        <div className={styles.track} data-track style={{ '--screens': SCREENS } as CSSProperties}>
          <div className={styles.stage} data-stage>
            <canvas className={styles.watch} data-watch aria-hidden="true" />
            {/* Without WebGL, or without JavaScript, the watch is this photograph. */}
            <img className={styles.poster} data-poster src={`${assets}/poster.webp`} alt="" decoding="async" />
            <p className={styles.srOnly}>A steel wristwatch with a silver dial, blued hands, a red seconds hand and a steel bracelet. As the page scrolls it comes apart into its crystal, hands, dial, case, movement, rotor and caseback, each is shown on its own, and it goes back together.</p>

            {/* ---------- Now: the watch, running, and the time it tells ---------- */}
            <div className={`${styles.words} ${styles.now}`} data-words="now">
              <h1 className={styles.display}><Line>It is</Line><Line data-time="0">eight minutes</Line><Line data-time="1">past ten.</Line><Line data-time="2" /></h1>
              <p className={styles.body} data-fade>{brand.name} makes one watch, from {total} parts. Right now it is telling you the time<span data-city></span>.</p>
              <p className={styles.small} data-fade>{brand.model}, automatic. {euros(brand.price)}.</p>
              {/* How to go on. Under a picture it follows the words; on a wide stage it stands above the rail (below). */}
              <p className={`${styles.cue} ${styles.cueFlow}`} data-cue>{cue}</p>
            </div>
            <p className={styles.cue} data-cue>{cue}</p>

            {/* ---------- Apart: all of it at once ---------- */}
            <div className={`${styles.words} ${styles.apart}`} data-words="apart">
              <h2 className={styles.display} data-stretch><Line>Take it apart.</Line></h2>
              <p className={styles.body} data-fade>Everything a {brand.name} is made of, in the order it comes out. Count as you go.</p>
            </div>
            <div className={styles.labels} data-labels aria-hidden="true">
              {tour.map(part => <span key={part.id} className={styles.label} data-label={part.id}><i />{part.name}</span>)}
            </div>

            {/* ---------- The tour: one part at a time ---------- */}
            {tour.map(part => (
              <div key={part.id} className={`${styles.words} ${styles.part}`} data-words={`part-${part.id}`}>
                <p className={styles.plus} data-fade><b>+ {part.count}</b><span>{part.made}</span></p>
                <h2 className={styles.display}><Line>{part.name}</Line></h2>
                <div className={styles.copy}>
                  <p className={styles.body} data-fade data-first>{part.id === 'hands' ? <>Three, and they stopped at <span data-stopped>ten past ten</span>, when you opened the case. Scroll, and the red one goes round once for you. The minute hand moves on a minute.</> : part.line}</p>
                  {part.turned && <p className={styles.body} data-fade data-turned>{part.turned}</p>}
                </div>
              </div>
            ))}

            {/* The sum, as it is added up: one term for each part, lit as the tour reaches it. */}
            <p className={styles.equation} data-ledger aria-label="The parts counted so far">
              {parts.map((part, index) => <Fragment key={part.id}>{index > 0 && <i aria-hidden="true">+</i>}<span data-term={part.id}><span className={styles.srOnly}>{part.name}: </span>{part.count}</span></Fragment>)}
              <i aria-hidden="true">=</i><b data-total>0</b>
            </p>

            {/* ---------- Whole again ---------- */}
            <div className={`${styles.words} ${styles.whole}`} data-words="whole">
              <h2 className={styles.display} data-stretch><Line>{total} parts.</Line><Line>One {brand.name}.</Line></h2>
              <p className={styles.body} data-fade>Put back by one watchmaker, in a day: last out, first in. The bracelet makes six more.</p>
            </div>
            <div className={`${styles.words} ${styles.back}`} data-words="back">
              <h2 className={styles.display}><Line>Turn it over.</Line></h2>
              <p className={styles.body} data-fade>The back is a window. The rotor behind it swings when you move, and winds the watch as it goes. Scroll: you are winding it now.</p>
            </div>

            {/* ---------- Faces ---------- */}
            <div className={`${styles.words} ${styles.faces}`} data-words="faces">
              <p className={styles.small} data-fade>Three faces. The same {total} parts behind each.</p>
              <div className={styles.faceNames}>
                {faces.map((face, index) => <h2 key={face.id} className={styles.display} data-face={index}><Line>{face.name}.</Line></h2>)}
              </div>
              <div className={styles.faceNotes}>{faces.map((face, index) => <p key={face.id} className={styles.body} data-face-note={index}>{face.note}</p>)}</div>
            </div>

            {/* ---------- Yours ---------- */}
            <div className={`${styles.words} ${styles.buy}`} data-words="yours" data-buy>
              <p className={styles.small} data-fade><span data-buy-time>It is ten past ten</span>. A good time to choose.</p>
              <div className={styles.buyHead}>
                <h2 className={styles.display}><Line>{brand.model}</Line></h2>
                <p className={styles.price} data-fade><b>{euros(brand.price)}</b><span>Ten euro a part.</span></p>
              </div>
              <div className={styles.pick} data-fade role="group" aria-label="Face">
                {faces.map((face, index) => <button key={face.id} type="button" data-pick={face.id} aria-pressed={index === 0}><i data-swatch={face.id} />{face.name}</button>)}
              </div>
              <dl className={styles.specs} data-fade>{specs.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
              <div className={styles.actions} data-fade>
                <button type="button" className={styles.primary} data-add>Add to bag</button>
                <button type="button" className={styles.ghost} data-replay>Watch it again</button>
              </div>
            </div>

            {/* ---------- Worn: three photographs, over everything ---------- */}
            <div className={styles.photos} data-photos>
              {worn.map(photo => (
                <figure key={photo.id} className={styles.photo} data-photo={photo.id}>
                  {Array.from({ length: STRIPS }, (_, index) => (
                    <span key={index} className={styles.strip} data-strip style={{ '--i': index, '--n': STRIPS } as CSSProperties}>
                      <picture>
                        <source media="(max-aspect-ratio: 21/20)" srcSet={`${assets}/worn/${photo.id}-tall.webp`} />
                        <img src={`${assets}/worn/${photo.id}-wide.webp`} alt={index === 0 ? photo.alt : ''} aria-hidden={index === 0 ? undefined : true} loading="lazy" decoding="async" />
                      </picture>
                    </span>
                  ))}
                  <figcaption className={styles.caption} data-caption><span className={styles.display}><Line>{photo.line}</Line></span><span className={styles.body} data-fade>{photo.note}</span></figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </div>

      <header className={styles.bar}>
        <span className={styles.wordmark} data-chrome>{brand.name}</span>
        {/* On a surface of its own, so it reads over steel and photographs alike. */}
        <div className={styles.tools} data-chrome data-tools>
          <span className={styles.concept}>{brand.concept}</span>
          <button type="button" className={styles.bagButton} data-bag-open aria-label="Open your bag"><span>Bag</span><b data-bag-count>0</b></button>
          <button type="button" className={styles.exit} onClick={onExit} aria-label="Exit preview"><span>Close</span><i aria-hidden="true" /></button>
        </div>
      </header>
      <nav className={styles.rail} data-rail data-chrome aria-label="Chapters">
        {CHAPTERS.map(chapter => <button key={chapter.id} type="button" className={styles.railItem} data-rail-item aria-current="false" aria-label={chapter.label}><i aria-hidden="true"><b /></i><span aria-hidden="true">{chapter.label}</span></button>)}
      </nav>
      {/* Another way through, on every device: a tap goes on to the next rest, a hold plays. The arrow keys do the same. */}
      <div className={styles.pager} data-pager data-chrome>
        <button type="button" data-step="-1" aria-label="Back a step. Hold to play backwards." title="Back (hold to play)"><Arrow up /></button>
        <button type="button" data-step="1" aria-label="On a step. Hold to play." title="On (hold to play)"><Arrow /></button>
      </div>

      {/* The bag. Nothing is sold here, and it says so: that Sum is a concept is all it says about itself. */}
      <aside className={styles.bag} data-bag-panel aria-label="Your bag" aria-hidden="true">
        <div className={styles.bagHead}><h2>Your bag</h2><button type="button" data-bag-close aria-label="Close your bag"><i aria-hidden="true" /></button></div>
        <p className={styles.bagEmpty} data-bag-empty>Nothing in it yet. The watch is one scroll away.</p>
        <div className={styles.bagItem} data-bag-item hidden>
          <img src={`${assets}/poster.webp`} alt="" />
          <p><b>{brand.model}</b><span data-bag-face>Silver</span></p>
          <b>{euros(brand.price)}</b>
        </div>
        <p className={styles.bagNote}>{brand.name} is a concept, so there is nothing to pay for.</p>
        <div className={styles.bagActions}>
          <button type="button" className={styles.primary} data-bag-close>Keep looking</button>
        </div>
        <p className={styles.bagFoot}>Photographs generated for this demo. GSAP, WebGL, native scroll.</p>
      </aside>

      {/* Without JavaScript nothing would lift the veil. */}
      <noscript><style>{`[data-sum] [data-veil] { display: none; } [data-sum] [data-poster] { opacity: 1 !important; visibility: visible !important; }`}</style></noscript>
      <div className={styles.veil} data-veil aria-hidden="true">
        <div className={styles.loading}><b data-load-count>0</b><span>of {total} parts</span><i data-load-line /></div>
        <p className={styles.loadingFoot}><span>{brand.name}</span><span>Winding</span></p>
      </div>
    </div>
  );
}
