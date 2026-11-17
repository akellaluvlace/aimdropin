'use client';

// Plain <img>: the file is already the size and format it is shown at.
/* eslint-disable @next/next/no-img-element */

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import styles from './meridian.module.css';
import { STATES, brand, levels, proof, search, thousands, updates } from './content';
import { SCREENS } from './score';
import { mountMeridian } from './mount';

// Meridian: a concept for delivery tracking software, one of three sites made for
// a library of pages people can use. Nothing in it names or sells whoever made it. The page is one pinned
// stage and one move: a map that goes from the whole earth down to a door, following one parcel, while
// the console beside it counts how many parcels are in the picture: 41,207, then fewer, then one. This
// component only renders the markup; mount.ts wires the rest.
//
// Map and words never share room. On a wide stage the console is a label down the left and the map has
// the rest; on a tall one (a phone) the map has the top of the stage and the console stands under it.

/** A line of type behind its own window, so it can rise into place. */
const Line = ({ children }: { children?: ReactNode }) => <span className={styles.line}><span data-line>{children}</span></span>;
const Arrow = ({ up = false }: { up?: boolean }) => <svg viewBox="0 0 12 12" aria-hidden="true"><path d={up ? 'M6 10.6V1.4M2.2 5.2 6 1.4l3.8 3.8' : 'M6 1.4v9.2M2.2 6.8 6 10.6l3.8-3.8'} /></svg>;
// The parcel's number as bars: each character's code decides a group of four widths. Not a real symbology;
// it is the same every time, which is all a picture of a barcode has to be.
const bars = [...brand.parcel.replace(/\s/g, '')].flatMap((character, index) => { const code = character.charCodeAt(0) + index * 7; return [1 + (code % 3), 1 + ((code >> 2) % 2), 1 + ((code >> 3) % 3), 1 + ((code >> 5) % 2)]; });

/** What the proof of delivery says under its photograph. */
const ProofFacts = () => (
  <figcaption>
    <b>{proof.title}</b>
    <dl>{proof.rows.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
  </figcaption>
);

interface MeridianSiteProps {
  /** Leaves the demo (closes a preview, or goes back to the site). */
  onExit?: () => void;
  /** The product's own call to action, "Book a demo". Whoever hosts the page decides what it does; with no handler it does nothing. */
  onDemo?: () => void;
}

export default function MeridianSite({ onExit, onDemo }: MeridianSiteProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => (rootRef.current ? mountMeridian(rootRef.current) : undefined), []);

  return (
    <div ref={rootRef} className={styles.root} data-meridian data-shape="wide" data-entered="false">
      <div className={styles.scroller} data-scroller tabIndex={0} role="region" aria-label="Meridian, a concept for delivery tracking">
        <div className={styles.track} data-track style={{ '--screens': SCREENS } as CSSProperties}>
          <div className={styles.stage} data-stage>
            <canvas className={styles.map} data-map aria-hidden="true" />
            <p className={styles.srOnly}>A customer has asked where their parcel is. A search field is filled with its number, and a map that starts with the whole earth and that parcel&apos;s route from Shenzhen to Dublin closes in as the page scrolls: Europe, Ireland, Dublin, a van&apos;s run through its streets, one street, one door. On the way the customer is answered with a delivery window, the van&apos;s route is planned again when a quay closes, and the customer is told when the van is four minutes away. Then the map goes back out to the whole earth.</p>

            {/* What belongs to the map: its scale, a note by the parcel, the proof, and whose data it is. */}
            <div className={styles.furniture} data-furniture>
              {/* What the two kinds of line on the map are. */}
              <p className={styles.legend} data-legend><span><i data-mine />This parcel</span><span data-others><i />Other parcels</span></p>
              <p className={styles.scaleBar} data-scalebar><i data-scalebar-line /><span data-scalebar-text>2,000 km</span></p>
              <p className={styles.note} data-note><span data-note-text>{brand.parcel}</span></p>
              {/* The proof of delivery, laid on the map of a wide stage. (On a tall one it is in the console: below.) */}
              <figure className={styles.proof} data-proof>
                <div className={styles.proofPhoto}><img src={`${brand.assets}/proof.webp`} alt={proof.alt} loading="lazy" decoding="async" /></div>
                <ProofFacts />
                {/* A signature, written as the page scrolls. */}
                <svg className={styles.signature} viewBox="0 0 220 64" aria-hidden="true"><path data-signature d="M8 44c10-18 18-30 24-30 5 0 2 14-2 28-2 7 3 4 8-6 6-12 11-20 14-18 3 2-4 16-3 22 1 5 6 0 10-8 3-6 6-9 8-8 3 1-1 9 1 12 2 3 6-1 10-7 5-8 10-12 13-10 4 3-6 14-3 17 3 3 10-6 16-10 5-3 8 0 6 5-2 6 5 4 12-1 8-6 20-12 44-13M150 22c8 2 20 3 34 2" /></svg>
              </figure>
              {/* What the software does by itself in Dublin, said as it happens: one card at a time. */}
              {updates.map(update => (
                <div key={update.level} className={styles.update} data-update={update.level}>
                  <p className={styles.updateKind}><b>{update.time}</b><span>{update.kind}</span></p>
                  <p className={styles.updateText}>{update.text}</p>
                </div>
              ))}
              <p className={styles.credit}>Land: Natural Earth. Dublin: &copy; OpenStreetMap contributors.</p>
            </div>

            {/* The console: a waybill. What it says is the words' room. */}
            <section className={styles.waybill} data-waybill aria-label="The parcel">
              <header className={styles.head}>
                <span className={styles.wordmark}>{brand.name}</span>
                <span className={styles.concept}>{brand.concept}</span>
              </header>
              {/* The product's own way in: a search. It is a picture of one, not one that works: the page types the
                  parcel's number into it as it starts to scroll, and it says what state the parcel it found is in. */}
              <div className={styles.search} data-search aria-hidden="true">
                <div className={styles.field}>
                  <svg className={styles.glass} viewBox="0 0 12 12"><circle cx="5" cy="5" r="3.7" /><path d="M7.9 7.9 11 11" /></svg>
                  <p className={styles.query}><span data-typed /><i className={styles.caret} /><span className={styles.hint}>Search {thousands(levels[0].count)} parcels</span></p>
                  <p className={styles.pill} data-pill><span data-pill-state>{search.out}</span><span className={styles.due}>, {brand.delivered}</span></p>
                </div>
              </div>
              <dl className={styles.fields}>
                <div><dt>Map scale</dt><dd data-scale>1 : 60,000,000</dd></div>
                <div><dt>Map centre</dt><dd data-centre>20.0&deg; N  58.0&deg; E</dd></div>
              </dl>
              <div className={styles.told}>
                <p className={styles.count} aria-live="off"><b data-count>{thousands(levels[0].count)}</b></p>
                <div className={styles.says} data-says>
                  {levels.map((level, index) => (
                    <div key={level.id} className={styles.say} data-words={level.id}>
                      {index === 0 ? <h1 className={styles.counted}><Line>{level.counted}</Line></h1> : <h2 className={styles.counted}><Line>{level.counted}</Line></h2>}
                      <p className={styles.body} data-fade>{level.line}</p>
                      {/* On a tall stage the proof of delivery is part of what the console says at the door, and the map stays clear. */}
                      {level.id === 'door' && (
                        <figure className={styles.receipt} data-receipt data-fade>
                          <div className={styles.proofPhoto}><img src={`${brand.assets}/proof.webp`} alt="" loading="lazy" decoding="async" /></div>
                          <ProofFacts />
                        </figure>
                      )}
                      {level.id === 'all' && (
                        <div className={styles.close} data-fade>
                          <div className={styles.actions}>
                            <button type="button" className={styles.primary} onClick={onDemo}>Book a demo</button>
                            <button type="button" className={styles.ghost} data-replay>Find it again</button>
                          </div>
                          {/* Said where its call to action is, so nobody waits for an answer to one. */}
                          <p>{brand.name} is a concept: there is no such product, and no such parcel.</p>
                        </div>
                      )}
                    </div>
                  ))}
                  {/* On the two long ways between scales the number still says what it counts. */}
                  <div className={styles.say} data-words="between"><p className={`${styles.counted} ${styles.passing}`}><Line>are in the picture.</Line></p></div>
                </div>
              </div>
              <div className={styles.chart}>
                <p className={styles.chartTitle} id="meridian-states">What the parcels in the picture are doing</p>
                <ul className={styles.states} data-states aria-labelledby="meridian-states">
                  {STATES.map((state, index) => <li key={state} data-state={index}><span>{state}</span><i aria-hidden="true"><b data-state-bar /></i><em data-state-count>{thousands(levels[0].states[index])}</em></li>)}
                </ul>
              </div>
              {/* Time, zoomed as the map is: from a month to a minute, ending at the delivery. */}
              <div className={`${styles.chart} ${styles.timeChart}`} data-time-chart aria-hidden="true">
                <p className={styles.chartTitle}>This parcel&apos;s last <span data-ruler-title>34 days</span></p>
                <div className={styles.ruler} data-ruler><canvas data-ruler-canvas /></div>
              </div>
              <p className={styles.cue} data-cue><span className={styles.cueMouse}>Scroll, or hold</span><span className={styles.cueTouch}>Swipe, or tap</span><i><Arrow /></i><span>to look it up</span></p>
              <footer className={styles.foot} aria-hidden="true">
                <span className={styles.barcode}>{bars.map((width, index) => <i key={index} style={{ width: `${width}px`, opacity: index % 2 ? 0 : 1 }} />)}</span>
                <span>{brand.parcel}</span>
              </footer>
            </section>
          </div>
        </div>
      </div>

      <header className={styles.bar}>
        <span className={styles.barMark} data-chrome>{brand.name}</span>
        <div className={styles.tools} data-chrome data-tools>
          <span className={styles.concept}>{brand.concept}</span>
          <button type="button" className={styles.exit} onClick={onExit} aria-label="Exit preview"><span>Close</span><i aria-hidden="true" /></button>
        </div>
      </header>
      <nav className={styles.rail} data-rail data-chrome aria-label="Scales">
        {levels.map(level => <button key={level.id} type="button" className={styles.railItem} data-rail-item aria-current="false" aria-label={level.name}><i aria-hidden="true"><b /></i><span aria-hidden="true">{level.name}</span></button>)}
      </nav>
      {/* Another way through, on every device: a tap goes on to the next scale, a hold plays. The arrow keys do the same. */}
      <div className={styles.pager} data-pager data-chrome>
        <button type="button" data-step="-1" aria-label="Back a step. Hold to play backwards." title="Back (hold to play)"><Arrow up /></button>
        <button type="button" data-step="1" aria-label="On a step. Hold to play." title="On (hold to play)"><Arrow /></button>
      </div>

      {/* Without JavaScript nothing would lift the veil. */}
      <noscript><style>{`[data-meridian] [data-veil] { display: none; }`}</style></noscript>
      <div className={styles.veil} data-veil aria-hidden="true">
        <p className={styles.loading}><b data-load-count>0</b><span data-veil-fade>parcels on their way</span></p>
        <p className={styles.loadingFoot} data-veil-fade><span>{brand.name}</span><span>{brand.kind}. A concept.</span></p>
      </div>
    </div>
  );
}
