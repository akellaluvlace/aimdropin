'use client';

// Plain <img>: the one image in the markup is the picture a reader without JavaScript gets.
/* eslint-disable @next/next/no-img-element */

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import styles from './datum.module.css';
import { alts, brand, cells, described, scenes } from './content';
import { CHAPTERS, SCREENS } from './score';
import { mountDatum } from './mount';

// Datum: a concept site for an architecture practice that does not exist. The page
// is one pinned sheet with one thin red level line across it, the datum, which stays at the same height
// from the first frame to the last. Every picture stands on it. This component only renders the markup;
// mount.ts wires the rest.
//
// It stands on its own: it says it is a concept, and it names, credits and links to nobody. What its
// one call to action does is for whoever hosts the page to decide (`onEnquire`).
//
// Words and picture never share room: the picture is the plate above, the words stand in the strip
// under it, on wide stages and tall ones alike. Only the first words and the last stand on the line
// itself, and only while the plate behind them is bare paper.

/** A line of type behind its own window, so it can rise into place. */
const Line = ({ children }: { children?: ReactNode }) => <span className={styles.line}><span data-line>{children}</span></span>;
/** Words that stand on the datum: one block that moves, a line of type to each line. */
const OnLine = ({ lines }: { lines: string[] }) => <span className={styles.lift} data-lift>{lines.flatMap((line, index) => [index > 0 ? ' ' : null, <span key={line} data-line>{line}</span>])}</span>;
const Arrow = ({ up = false }: { up?: boolean }) => <svg viewBox="0 0 12 12" aria-hidden="true"><path d={up ? 'M6 10.6V1.4M2.2 5.2 6 1.4l3.8 3.8' : 'M6 1.4v9.2M2.2 6.8 6 10.6l3.8-3.8'} /></svg>;

/** One cell of the title block whose entry changes with the scene: every entry once, and which one each scene shows. */
const roll = (key: 'project' | 'drawing' | 'stage') => {
  const rows: string[] = [], steps: number[] = [];
  for (const scene of scenes) { const value = scene.sheet[key]; if (rows[rows.length - 1] !== value) rows.push(value); steps.push(rows.length - 1); }
  return { rows, steps };
};
const ROLLS = { project: roll('project'), drawing: roll('drawing'), stage: roll('stage') };
const Roll = ({ name }: { name: keyof typeof ROLLS }) => (
  <span className={styles.window}>
    <span className={styles.roll} data-roll={name} data-rows={ROLLS[name].rows.length} data-steps={ROLLS[name].steps.join(',')}>
      {ROLLS[name].rows.map((row, index) => <span key={index}>{row}</span>)}
    </span>
  </span>
);

/**
 * The page without JavaScript: no sheet, no line, nothing that needs a script to be seen or to work. The
 * finished house as one photograph, then every scene's words, one under another.
 */
const PLAIN = [
  '[data-veil],[data-plate],[data-drawing],[data-datum-line],[data-rail],[data-pager],[data-block],[data-cue],[data-last],button{display:none!important}',
  '[data-track]{height:auto!important}',
  '[data-stage]{position:static!important;height:auto!important;overflow:visible!important;padding:calc(var(--bar) + 12px) var(--edge) 56px}',
  '[data-bar]{background:var(--paper)}',
  '[data-poster]{display:block!important;width:100%;height:auto;margin:0 0 clamp(20px,4cqh,40px)}',
  '[data-first]{position:static!important;visibility:visible!important;clip-path:none!important;margin:0 0 6px;font-size:clamp(44px,9cqw,120px)!important}',
  '[data-strip]{position:static!important;height:auto!important}',
  '[data-words]{position:static!important;visibility:visible!important;display:block!important;container-type:normal!important;margin:0 0 34px;max-width:620px}',
  '[data-words] h2{font-size:clamp(28px,4cqw,44px)!important;white-space:normal!important;margin:0 0 8px}',
  '[data-words] p{font-size:17px!important;max-width:none!important}',
  '[data-line],[data-lift]{transform:none!important}',
].map(rule => rule.split('}').filter(Boolean).map(part => { const [selectors, body] = part.split('{'); return `${selectors.split(',').map(selector => `[data-datum] ${selector}`).join(',')}{${body}}`; }).join('')).join('');

interface DatumPracticeProps {
  /** Leaves the demo (closes a preview, or goes back to the site). */
  onExit?: () => void;
  /**
   * "Start a project": the site's own call to action. Whoever hosts the page decides what it does.
   * With no handler the button does nothing; it never falls back to leaving the page.
   */
  onEnquire?: () => void;
}

export default function DatumPractice({ onExit, onEnquire }: DatumPracticeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => (rootRef.current ? mountDatum(rootRef.current) : undefined), []);
  const first = scenes[0], last = scenes[scenes.length - 1];
  const cue = <><span className={styles.cueMouse}>Scroll, or hold</span><span className={styles.cueTouch}>Swipe, or tap</span><i><Arrow /></i><span>to set it out</span></>;

  return (
    <div ref={rootRef} className={styles.root} data-datum data-shape="wide" data-entered="false">
      <div className={styles.scroller} data-scroller tabIndex={0} role="region" aria-label={`${brand.name}, a concept architecture practice`}>
        <div className={styles.track} data-track style={{ '--screens': SCREENS } as CSSProperties}>
          <div className={styles.stage} data-stage>
            {/* The plate: every photograph, on one canvas. Without JavaScript it is this one picture. */}
            <canvas className={styles.plate} data-plate aria-hidden="true" />
            {/* (Lazy: with scripts on it is never laid out, so it is never fetched; with scripts off a browser fetches lazy images at once.) */}
            <img className={styles.poster} data-poster src={`${brand.assets}/poster.webp`} alt={alts.poster} loading="lazy" decoding="async" />
            {/* The drawing over it: built and placed by drawing.ts from the house as measured. */}
            <svg className={styles.drawing} data-drawing data-clip="datum-unbuilt" aria-hidden="true" />
            <p className={styles.srOnly}>{described}</p>

            {/* The datum: one level line, at the same height on the sheet from the first frame to the last. */}
            <div className={styles.datum} data-datum-line aria-hidden="true">
              <i data-datum-stroke />
              <span className={styles.level} data-level-mark><svg viewBox="0 0 10 8"><path d="M1 1h8L5 7z" /></svg><b data-level>0.000</b></span>
            </div>

            {/* The first words and the last stand on the line, while the plate is bare paper. Each rises out of the line, and sinks back into it, as one block. */}
            <h1 className={styles.onLine} data-first><OnLine lines={first.title} /></h1>
            <h2 className={styles.onLine} data-last><OnLine lines={last.title} /></h2>

            {/* The strip under the plate: what is said, one block for each scene, all in the same place. */}
            <div className={styles.strip} data-strip>
              {scenes.map((scene, index) => (
                <section key={scene.id} className={index > 0 && index < scenes.length - 1 ? styles.words : `${styles.words} ${styles.plain}`} data-words={scene.id}>
                  {/* (The space between two lines is for a low stage, where a heading is set on one.) */}
                  {index > 0 && index < scenes.length - 1 && <h2 className={styles.display}>{scene.title.flatMap((line, at) => [at > 0 ? ' ' : null, <Line key={line}>{line}</Line>])}</h2>}
                  <div className={styles.copy}>
                    <p className={styles.body} data-fade>{scene.body}</p>
                    {/* How to go on. */}
                    {index === 0 && <p className={styles.cue} data-cue>{cue}</p>}
                    {index === scenes.length - 1 && (
                      <div className={styles.actions} data-fade>
                        <button type="button" className={styles.primary} data-enquire onClick={onEnquire}>Start a project</button>
                        <button type="button" className={styles.ghost} data-replay>Watch it again</button>
                      </div>
                    )}
                  </div>
                </section>
              ))}

              {/* The title block: what this sheet is, as a drawing says it. It changes with the scene. */}
              <dl className={styles.block} data-block data-chrome aria-hidden="true">
                <div className={styles.cellProject}><dt>{cells.project}</dt><dd><Roll name="project" /></dd></div>
                <div className={styles.cellDrawing}><dt>{cells.drawing}</dt><dd><Roll name="drawing" /></dd></div>
                <div><dt>{cells.scale}</dt><dd><span className={styles.window}><span data-scale>1:100</span></span></dd></div>
                <div><dt>{cells.stage}</dt><dd><Roll name="stage" /></dd></div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <header className={styles.bar} data-bar>
        <span className={styles.wordmark} data-chrome>{brand.name}</span>
        <div className={styles.tools} data-chrome>
          <span className={styles.concept} data-concept>{brand.concept}</span>
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

      {/* Without JavaScript nothing would lift the veil or move the sheet: the page is then a plain one, read top to bottom. */}
      <noscript><style>{PLAIN}</style></noscript>
      <div className={styles.veil} data-veil aria-hidden="true" />
    </div>
  );
}
