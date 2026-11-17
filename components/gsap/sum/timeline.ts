// The words on the Sum page: one GSAP timeline, a second long for every screen of scroll (score.ts), set
// to the scroll's position each frame. Lines rise through their windows and leave the way they came;
// nothing here runs in its own time, so the page reads the same forwards and backwards.

import gsap from 'gsap';
import { SCORE, STOPS } from './score';

export interface Words { seek(at: number): void; destroy(): void }

const RISE = 0.3, FALL = 0.22;
/**
 * Words leave as the picture starts to leave, never before: they are whole at every place the page can
 * rest. A block that is to be gone by `to` starts going 0.3 of a screen earlier, so `to` is given as the
 * moment the picture moves on, plus this.
 */
const GOING = 0.3;

export function buildWords(root: HTMLElement): Words {
  const one = (selector: string) => root.querySelector<HTMLElement>(selector);
  const all = (scope: Element | null, selector: string) => (scope ? Array.from(scope.querySelectorAll<HTMLElement>(selector)) : []);
  let timeline: gsap.core.Timeline | null = null;

  const context = gsap.context(() => {
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
    timeline = tl;
    const block = (name: string) => one(`[data-words="${name}"]`);

    /** A block of words arrives at `from` and has gone by `to`. */
    const show = (el: HTMLElement | null, from: number, to: number, lines = all(el, '[data-line]'), fades = all(el, '[data-fade]')) => {
      if (!el) return;
      tl.set(el, { visibility: 'visible' }, from);
      if (lines.length) tl.fromTo(lines, { yPercent: 112 }, { yPercent: 0, duration: RISE, ease: 'power3.out', stagger: 0.05 }, from);
      if (fades.length) tl.fromTo(fades, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.22, stagger: 0.04 }, from + 0.12);
      if (lines.length) tl.to(lines, { yPercent: -112, duration: FALL, ease: 'power2.in', stagger: 0.03 }, to - FALL - 0.06);
      if (fades.length) tl.to(fades, { autoAlpha: 0, duration: 0.14 }, to - FALL - 0.08);
      tl.set(el, { visibility: 'hidden' }, to);
    };

    // Now: on the stage from the start. The entrance (mount.ts) brings its lines up in its own time, so
    // these only take them away, each from where it rests: nothing here touches them before the first scroll.
    const now = block('now');
    if (now) {
      const gone = SCORE.strapOff[0] + 0.32;
      gsap.set(now, { visibility: 'visible' });
      tl.fromTo(all(now, '[data-line]'), { yPercent: 0 }, { yPercent: -112, duration: FALL, ease: 'power2.in', stagger: 0.03, immediateRender: false }, gone - FALL - 0.06);
      tl.fromTo(all(now, '[data-fade]'), { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.14, immediateRender: false }, gone - FALL - 0.08);
      tl.set(now, { visibility: 'hidden' }, gone);
    }
    const cues = all(root, '[data-cue]');
    if (cues.length) tl.fromTo(cues, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.12, immediateRender: false }, 0.06);

    // Apart: said first, narrow, while the camera steps back. Then the heading widens as the watch opens,
    // and each part gets its name.
    show(block('apart'), SCORE.ready[0] + 0.12, STOPS[0].from + GOING);
    const apart = one('[data-words="apart"] [data-stretch]');
    if (apart) tl.fromTo(apart, { '--wdth': 66 }, { '--wdth': 125, duration: SCORE.burst[1] - SCORE.burst[0] - 0.1, ease: 'power3.out' }, SCORE.burst[0]);
    const labels = all(one('[data-labels]'), '[data-label]');
    if (labels.length) {
      tl.fromTo(labels, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.16, stagger: 0.03 }, SCORE.burst[1] - 0.2);
      tl.to(labels, { autoAlpha: 0, duration: 0.12 }, STOPS[0].from + 0.02);
    }

    // The tour.
    for (const stop of STOPS) {
      const part = block(`part-${stop.id}`);
      const turned = all(part, '[data-turned]');
      const first = all(part, '[data-fade]').filter(el => !el.hasAttribute('data-turned'));
      show(part, stop.arrive - GOING, stop.leave + GOING, all(part, '[data-line]'), first);
      if (turned.length) {
        // The calibre is turned over: its second sentence takes the first one's place.
        gsap.set(turned, { autoAlpha: 0 });
        const mid = (SCORE.calibreTurn[0] + SCORE.calibreTurn[1]) / 2;
        tl.to(all(part, '[data-first]'), { autoAlpha: 0, duration: 0.14 }, mid - 0.16);
        tl.to(turned, { autoAlpha: 1, duration: 0.2 }, mid + 0.04);
        tl.to(turned, { autoAlpha: 0, duration: 0.14 }, stop.leave + GOING - FALL - 0.08);
      }
    }
    // The sum is on the stage from the first part until the watch is turned over.
    const ledger = one('[data-ledger]');
    if (ledger) {
      tl.fromTo(ledger, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, STOPS[0].arrive - GOING);
      tl.to(ledger, { autoAlpha: 0, duration: 0.2 }, SCORE.turnOver[0] + 0.06);
    }

    // Whole: the heading closes up as the parts come home.
    show(block('whole'), SCORE.rejoin[1] - 0.22, SCORE.turnOver[0] + GOING + 0.04);
    const whole = one('[data-words="whole"] [data-stretch]');
    if (whole) tl.fromTo(whole, { '--wdth': 125 }, { '--wdth': 104, duration: 0.5, ease: 'power3.out' }, SCORE.rejoin[1] - 0.22);
    show(block('back'), SCORE.turnOver[1] - 0.22, SCORE.turnBack[0] + GOING + 0.04);

    // Faces: one name at a time, changing as the seconds hand comes round.
    const faces = block('faces');
    if (faces) {
      const names = all(faces, '[data-face]'), notes = all(faces, '[data-face-note]'), lead = all(faces, ':scope > [data-fade]');
      // Each name is whole well before the page rests on its face (the rests are SCORE.faces).
      const times = [[SCORE.turnBack[1] - 0.3, SCORE.sweeps[0][0] + 0.42], [SCORE.sweeps[0][0] + 0.42, SCORE.sweeps[1][0] + 0.42], [SCORE.sweeps[1][0] + 0.42, SCORE.wornIn[0] + 0.3]];
      tl.set(faces, { visibility: 'visible' }, times[0][0]);
      tl.fromTo(lead, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, times[0][0] + 0.1);
      names.forEach((name, index) => {
        const line = all(name, '[data-line]');
        tl.fromTo(line, { yPercent: 112 }, { yPercent: 0, duration: RISE, ease: 'power3.out' }, times[index][0]);
        tl.to(line, { yPercent: -112, duration: FALL, ease: 'power2.in' }, times[index][1] - FALL);
        tl.fromTo(notes[index], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, times[index][0] + 0.14);
        tl.to(notes[index], { autoAlpha: 0, duration: 0.14 }, times[index][1] - FALL);
      });
      tl.to(lead, { autoAlpha: 0, duration: 0.14 }, times[2][1] - FALL);
      tl.set(faces, { visibility: 'hidden' }, times[2][1]);
    }

    // Worn: each photograph comes up in slices, the next one over it; the last leaves the same way.
    const photos = one('[data-photos]');
    if (photos) {
      const figures = all(photos, '[data-photo]');
      // A photograph comes up 0.3 of a screen after the rest on the one before, and its caption is whole
      // well before its own rest.
      const starts = [SCORE.wornIn[0], SCORE.worn[0] + 0.3, SCORE.worn[1] + 0.3];
      const leaves = SCORE.wornOut[0];
      tl.set(photos, { visibility: 'visible' }, starts[0]);
      figures.forEach((figure, index) => {
        const strips = all(figure, '[data-strip]'), caption = figure.querySelector<HTMLElement>('[data-caption]');
        const covered = index < figures.length - 1 ? starts[index + 1] : leaves;
        gsap.set(figure, { visibility: 'hidden' });
        tl.set(figure, { visibility: 'visible' }, starts[index]);
        tl.fromTo(strips, { yPercent: 101 }, { yPercent: 0, duration: 0.3, ease: 'power3.inOut', stagger: 0.022 }, starts[index]);
        if (caption) {
          // A caption says so itself when it is there, so it has to be taken away itself as well.
          const lines = all(caption, '[data-line]'), fades = all(caption, '[data-fade]');
          tl.set(caption, { visibility: 'visible' }, starts[index] + 0.3);
          tl.fromTo(lines, { yPercent: 112 }, { yPercent: 0, duration: RISE, ease: 'power3.out' }, starts[index] + 0.3);
          tl.fromTo(fades, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, starts[index] + 0.4);
          tl.to(lines, { yPercent: -112, duration: 0.16, ease: 'power2.in' }, covered - 0.03);
          tl.to(fades, { autoAlpha: 0, duration: 0.12 }, covered - 0.03);
          tl.set(caption, { visibility: 'hidden' }, covered + 0.14);
        }
        // Covered by the next one: no need to keep it drawn.
        if (index < figures.length - 1) tl.set(figure, { visibility: 'hidden' }, starts[index + 1] + 0.5);
        else tl.to(strips, { yPercent: -101, duration: 0.3, ease: 'power3.inOut', stagger: 0.022 }, leaves);
      });
      tl.set(photos, { visibility: 'hidden' }, SCORE.wornOut[1]);
      // What stands bare on the stage is white while the photographs cover it.
      tl.set(root, { '--chrome': '#ffffff' }, starts[0] + 0.28);
      tl.set(root, { '--chrome': '#0e1226' }, leaves + 0.24);
    }

    // Yours: there to the end.
    const buy = block('yours');
    if (buy) {
      const from = SCORE.wornOut[0] + 0.3;
      tl.set(buy, { visibility: 'visible' }, from);
      tl.fromTo(all(buy, '[data-line]'), { yPercent: 112 }, { yPercent: 0, duration: RISE, ease: 'power3.out' }, from);
      tl.fromTo(all(buy, '[data-fade]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, stagger: 0.05 }, from + 0.08);
    }
    tl.set({}, {}, SCORE.end);
  }, root);

  return {
    seek: at => timeline?.time(Math.max(0, Math.min(SCORE.end, at)), false),
    destroy: () => { context.revert(); root.style.removeProperty('--chrome'); },
  };
}
