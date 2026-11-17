// The words on the Meridian page: one GSAP timeline, a second long for every screen of scroll (score.ts),
// set to the scroll's position each frame. Nothing here runs in its own time, so the page reads the
// same forwards and backwards.
//
// Words leave as the picture starts to leave, never before, and are whole well before the page rests:
// at every rest there is nothing half way (the check looks for that).

import gsap from 'gsap';
import { LEVELS, SCORE } from './score';

export interface Words { seek(at: number): void; destroy(): void }

const RISE = 0.3, FALL = 0.22;
/** A sentence is whole this long before its rest, and starts to go this long after it (when the camera moves on). */
export const BEFORE = 0.6, AFTER = 0.25;
/** How long after it starts to go a sentence is off the stage. */
export const GONE = 0.3;

export function buildWords(root: HTMLElement): Words {
  const one = (selector: string) => root.querySelector<HTMLElement>(selector);
  const all = (scope: Element | null, selector: string) => (scope ? Array.from(scope.querySelectorAll<HTMLElement>(selector)) : []);
  let timeline: gsap.core.Timeline | null = null;

  const context = gsap.context(() => {
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
    timeline = tl;

    LEVELS.forEach((level, index) => {
      const block = one(`[data-words="${level.id}"]`);
      if (!block) return;
      const lines = all(block, '[data-line]'), fades = all(block, '[data-fade]');
      if (index === 0) {
        // On the stage from the start: the entrance (mount.ts) brings it up in its own time, so these only take it away.
        gsap.set(block, { visibility: 'visible' });
      } else {
        const from = level.rest - BEFORE;
        tl.set(block, { visibility: 'visible' }, from);
        tl.fromTo(lines, { yPercent: 112 }, { yPercent: 0, duration: RISE, ease: 'power3.out', stagger: 0.05 }, from);
        tl.fromTo(fades, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, stagger: 0.05 }, from + 0.12);
      }
      if (index === LEVELS.length - 1) return;
      const going = level.rest + AFTER;
      tl.fromTo(lines, { yPercent: 0 }, { yPercent: -112, duration: FALL, ease: 'power2.in', stagger: 0.03, immediateRender: false }, going + 0.04);
      tl.fromTo(fades, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.14, immediateRender: false }, going);
      tl.set(block, { visibility: 'hidden' }, going + GONE);
    });

    // On the two long ways between scales (in from the earth, and back out to it) the number still says
    // what it counts. It is on the stage only while no sentence is.
    const passing = one('[data-words="between"]');
    if (passing) {
      const lines = all(passing, '[data-line]');
      for (const [from, to] of [[LEVELS[0].rest + AFTER + GONE + 0.05, LEVELS[1].rest - BEFORE - 0.3], [LEVELS[6].rest + AFTER + GONE + 0.05, LEVELS[7].rest - BEFORE - 0.3]]) {
        tl.set(passing, { visibility: 'visible' }, from);
        tl.fromTo(lines, { yPercent: 112 }, { yPercent: 0, duration: RISE, ease: 'power3.out', immediateRender: false }, from);
        tl.fromTo(lines, { yPercent: 0 }, { yPercent: -112, duration: FALL, ease: 'power2.in', immediateRender: false }, to);
        tl.set(passing, { visibility: 'hidden' }, to + FALL + 0.02);
      }
    }

    const cues = all(root, '[data-cue]');
    if (cues.length) tl.fromTo(cues, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.14, immediateRender: false }, 0.08);

    // The key says "other parcels" only while there are other parcels' lines to see.
    const others = one('[data-others]');
    if (others) {
      tl.fromTo(others, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.3, immediateRender: false }, LEVELS[1].rest - 0.9);
      tl.to(others, { autoAlpha: 1, duration: 0.3 }, SCORE.out[1] - 0.4);
    }

    // What the software does by itself in Dublin: a card for each, on the stage with its scale's words (a
    // little after them), and gone with them.
    for (const card of all(root, '[data-update]')) {
      const level = LEVELS.find(candidate => candidate.id === card.dataset.update);
      if (!level) continue;
      tl.fromTo(card, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.26, ease: 'power3.out' }, level.rest - BEFORE + 0.14);
      tl.to(card, { autoAlpha: 0, duration: 0.14 }, level.rest + AFTER);
    }

    // The note by the parcel: there from the moment it sets out, gone at the door (the proof says the rest).
    const note = one('[data-note]');
    if (note) {
      tl.fromTo(note, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12 }, SCORE.journey[0] + 0.02);
      tl.to(note, { autoAlpha: 0, duration: 0.2 }, SCORE.door[0] - 0.1);
    }

    // The proof of delivery: the card comes up, then the signature is written.
    // (On a tall stage the proof is in the console, and comes and goes with the door's words.)
    const proof = one('[data-proof]'), signature = root.querySelector<SVGPathElement>('[data-signature]');
    if (proof) {
      tl.fromTo(proof, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, SCORE.proof[0]);
      if (signature) {
        const length = Math.ceil(signature.getTotalLength()) + 2;
        gsap.set(signature, { strokeDasharray: length, strokeDashoffset: length });
        tl.to(signature, { strokeDashoffset: 0, duration: 0.3, ease: 'power1.inOut' }, SCORE.proof[0] + 0.24);
      }
      tl.to(proof, { autoAlpha: 0, duration: 0.2 }, SCORE.out[0] + 0.05);
    }
    tl.set({}, {}, SCORE.end);
  }, root);

  return {
    seek: at => timeline?.time(Math.max(0, Math.min(SCORE.end, at)), false),
    destroy: () => context.revert(),
  };
}
