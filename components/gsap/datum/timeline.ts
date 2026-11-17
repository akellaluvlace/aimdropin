// The Datum page's one timeline: a second of it for every screen of scroll (score.ts), set to the scroll's
// position each frame. It moves three things together, so they cannot drift apart: the numbers the plate
// is drawn from (`view`), the lines of the drawing, and the words. Nothing in it runs in its own time, so
// the page reads the same forwards and backwards.
//
// Words leave as the picture starts to leave, never before, and the next ones arrive a third of a screen
// later: at every place the page can rest, what is said is whole.

import gsap from 'gsap';
import { LIT, type View } from './plate';
import { PEN } from './drawing';
import { house } from './content';
import { GOING, MATERIALS, MOVES, SCENES, SCORE, WORKS } from './score';

export interface Timeline { seek(at: number): void; destroy(): void }

const RISE = 0.3, FALL = 0.22;
/**
 * How the picture moves through a move: up to speed over the first fifth, steady through the middle, and
 * down again over the last fifth. Scroll is the clock here, so an ease with a long slow start and end
 * leaves stretches of scroll where almost nothing happens and a middle where everything does. With this
 * one the fastest moment is only a quarter quicker than the average.
 */
const EDGE = 0.2;
export const steady = (t: number) => { const speed = 1 / (1 - EDGE); return t <= 0 ? 0 : t >= 1 ? 1 : t < EDGE ? (speed * t * t) / (2 * EDGE) : t > 1 - EDGE ? 1 - (speed * (1 - t) * (1 - t)) / (2 * EDGE) : speed * (t - EDGE / 2); };
/**
 * The same curve read the other way round: how far through its time a line is when the pen has got a
 * share of the way along it. Ticks and figures are timed with it, so each is there as the pen reaches it
 * and never before.
 */
const reached = (share: number) => { const speed = 1 / (1 - EDGE), turn = (speed * EDGE) / 2; return share <= 0 ? 0 : share >= 1 ? 1 : share < turn ? Math.sqrt((2 * EDGE * share) / speed) : share > 1 - turn ? 1 - Math.sqrt((2 * EDGE * (1 - share)) / speed) : share / speed + EDGE / 2; };
/** The order the lights come on in: the tall opening first, then round the house, as someone would walk through it. */
const LIGHTS = [5, 2, 8, 1, 4, 7, 0, 3, 9].filter(index => LIT.includes(index));

export function buildTimeline(root: HTMLElement, view: View): Timeline {
  const one = (selector: string) => root.querySelector<HTMLElement>(selector);
  const all = (scope: Element | null, selector: string) => (scope ? Array.from(scope.querySelectorAll<HTMLElement>(selector)) : []);
  let timeline: gsap.core.Timeline | null = null;

  const context = gsap.context(() => {
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
    timeline = tl;
    /** A number of the view goes from one value to another over a move. */
    const set = (key: keyof View, [from, to]: readonly [number, number], value: number, ease: string | ((t: number) => number) = steady, start?: number) => tl.fromTo(view, { [key]: start ?? view[key] }, { [key]: value, duration: to - from, ease, immediateRender: false }, from);

    // ---------- The picture ----------
    set('open', SCORE.open, 1, steady, 0);
    set('veil', SCORE.veil, 1, steady, 0);
    // Eight strips, west to east, each going up as the one before nears its top.
    const each = 0.56, lag = (SCORE.rise[1] - SCORE.rise[0] - each) / 7;
    for (let index = 0; index < 8; index++) set(`bay${index}` as keyof View, [SCORE.rise[0] + lag * index, SCORE.rise[0] + lag * index + each], 1, steady, 0);
    set('settle', SCORE.settle, 1, steady, 0);
    set('zoom', SCORE.approach, 1, steady, 0);
    set('dusk', SCORE.dusk, 1, 'sine.inOut', 0);
    set('night', SCORE.dusk, 1, 'sine.inOut', 0);
    const on = 0.1, between = (SCORE.lights[1] - SCORE.lights[0] - on) / (LIGHTS.length - 1);
    LIGHTS.forEach((opening, order) => set(`lit${opening}` as keyof View, [SCORE.lights[0] + between * order, SCORE.lights[0] + between * order + on], 1, 'power1.out', 0));
    set('glow', SCORE.glow, 1, 'none', 0);
    set('enter', SCORE.enter, 1, steady, 0);
    set('climb', SCORE.climb, 1, steady, 0);
    set('level', SCORE.climb, house.floor, steady, 0);
    set('leave', SCORE.leave, 1, steady, 0);
    tl.fromTo(view, { night: 1 }, { night: 0, duration: SCORE.day[1] - SCORE.day[0], ease: 'sine.inOut', immediateRender: false }, SCORE.day[0]);
    tl.fromTo(view, { level: house.floor }, { level: 0, duration: 0.01, immediateRender: false }, SCORE.leave[1]);
    const up = 0.3, apart = (SCORE.samples[1] - SCORE.samples[0] - up) / 2;
    [0, 1, 2].forEach(index => set(`sample${index}` as keyof View, [SCORE.samples[0] + apart * index, SCORE.samples[0] + apart * index + up], 1, steady, 0));
    MATERIALS.forEach((material, index) => set(`mat${index}` as keyof View, material.open, 1, steady, 0));
    set('shut', SCORE.shut, 1, steady, 0);
    // Along the line: each building comes to the middle of the plate, and the last one goes off the end of it.
    WORKS.forEach((work, index) => set('street', work.arrive, index, steady, index - 1));
    set('street', SCORE.away, WORKS.length, steady, WORKS.length - 1);

    // ---------- The drawing ----------
    const sheet = one('[data-drawing]');
    const lines = (name: string) => all(sheet, `[data-draw="${name}"]`), marks = (name: string) => all(sheet, `[data-pop="${name}"]`);
    /**
     * Lines are drawn one after another over a move: each from its start to its end, as a pen would, and at
     * the pace the picture moves at (`steady`). With a slow start and a slow end the pen went twice as fast
     * in the middle as on average, and a line across the house was over in a notch of the wheel.
     */
    const drawn = (targets: HTMLElement[], [from, to]: readonly [number, number], share = 0.6, ease: string | ((t: number) => number) = steady) => {
      if (!targets.length) return;
      const length = (to - from) * (targets.length > 1 ? share : 1), step = targets.length > 1 ? (to - from - length) / (targets.length - 1) : 0;
      gsap.set(targets, { strokeDasharray: PEN, strokeDashoffset: PEN, visibility: 'hidden' });
      targets.forEach((target, index) => {
        tl.set(target, { visibility: 'visible' }, from + step * index);
        // (Not rounded to whole px: see PEN.)
        tl.fromTo(target, { strokeDashoffset: PEN }, { strokeDashoffset: 0, duration: length, ease, immediateRender: false, autoRound: false }, from + step * index);
      });
    };
    /** Small things that are simply there once their line has reached them: a figure over a twentieth of a screen, a tick at once. */
    const pop = (targets: HTMLElement[], times: number[], over = 0.05) => { gsap.set(targets, { autoAlpha: 0 }); targets.forEach((target, index) => tl.fromTo(target, { autoAlpha: 0 }, { autoAlpha: 1, duration: over, immediateRender: false }, times[index] ?? times[times.length - 1])); };
    const TICK = 0.012;
    const spread = (count: number, [from, to]: readonly [number, number]) => Array.from({ length: count }, (_, index) => from + ((to - from) * index) / Math.max(1, count - 1));

    // Setting out: the grid rises from the line, bay by bay; then the string of dimensions; then the levels.
    // Each bubble is begun as its line arrives at it, and its letter is there as the bubble closes.
    const [g0, g1] = SCORE.grid, gridEach = 0.3, round = 0.12, gridTimes = spread(7, [g0, g1 - gridEach - round - 0.01]);
    lines('grid').forEach((target, index) => drawn([target], [gridTimes[index], gridTimes[index] + gridEach], 1));
    lines('bubble').forEach((target, index) => drawn([target], [gridTimes[index] + gridEach, gridTimes[index] + gridEach + round], 1, 'none'));
    pop(marks('letter'), gridTimes.map(time => time + gridEach + round - 0.05));
    // The bays' string first, a tick as it passes each grid line and each bay's figure once it has crossed it;
    // then the whole length under it, counted as it is drawn. (The pen runs from the first tick to the last,
    // so the tick a sixth of the way along the house is a sixth of the way along the line: drawing.ts.)
    const [l0, l1] = SCORE.length, bays: [number, number] = [l0, l0 + (l1 - l0) * 0.66], whole: [number, number] = [l0 + (l1 - l0) * 0.36, l1];
    drawn(lines('len'), bays);
    const passes = (share: number) => bays[0] + (bays[1] - bays[0]) * reached(share);
    pop(marks('len-tick'), Array.from({ length: 7 }, (_, index) => passes(index / 6)), TICK);
    pop(marks('bay'), Array.from({ length: 6 }, (_, index) => passes((index + 0.75) / 6)));
    drawn(lines('all'), whole);
    pop(marks('all-tick'), [whole[0], whole[1]], TICK);
    // A figure counts with its line: over the same stretch of scroll and at the same pace, so it is the
    // length its pen has drawn so far.
    set('len', whole, house.length, steady, 0);
    set('rise', SCORE.height, house.ridge, steady, 0);
    const counts = all(sheet, '[data-count]');
    gsap.set(counts, { autoAlpha: 0 });
    tl.fromTo(all(sheet, '[data-count="len"]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.05, immediateRender: false }, whole[0] + 0.04);
    drawn(lines('rise'), SCORE.height);
    const climbs = (share: number) => SCORE.height[0] + (SCORE.height[1] - SCORE.height[0]) * reached(share);
    pop(marks('rise-tick'), [climbs(0), climbs(house.eaves / house.ridge), climbs(1)], TICK);
    pop(marks('eaves'), [climbs(house.eaves / house.ridge) + 0.01]);
    tl.fromTo(all(sheet, '[data-count="ridge"]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.05, immediateRender: false }, SCORE.height[0] + 0.04);

    // The elevation: the wall and the eaves in one stroke, the roof over them, each opening, then the fine lines.
    drawn(lines('wall'), SCORE.wall);
    drawn(lines('roof'), SCORE.roof);
    drawn(lines('opening'), SCORE.openings, 0.34);
    drawn(lines('glass'), [SCORE.openings[0] + 0.14, SCORE.openings[1] + 0.06], 0.36);
    // (The courses are the longest lines of all, eleven of them. They are begun as the roof is closed, and
    // each has most of the time there is, a little behind the one below it.)
    drawn(lines('course'), [SCORE.roof[1], SCORE.detail[1]], 0.62);
    drawn(lines('board'), [SCORE.detail[0] + 0.06, SCORE.detail[1] - 0.06], 0.5);
    drawn(lines('glint'), [SCORE.detail[0] + 0.16, SCORE.detail[1]], 0.6);
    pop(marks('latch'), [SCORE.detail[1] - 0.05]);

    // ---------- The words ----------
    const block = (name: string) => one(`[data-words="${name}"]`);
    /** A block of words arrives at `from` and has gone by `to`. Its lines rise through their windows; the rest fades. */
    const show = (el: HTMLElement | null, from: number, to: number | null) => {
      if (!el) return;
      const heads = all(el, '[data-line]'), fades = all(el, '[data-fade]');
      tl.set(el, { visibility: 'visible' }, from);
      if (heads.length) tl.fromTo(heads, { yPercent: 112 }, { yPercent: 0, duration: RISE, ease: 'power3.out', stagger: 0.05 }, from);
      if (fades.length) tl.fromTo(fades, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, stagger: 0.03 }, from + 0.1);
      if (to === null) return;
      if (heads.length) tl.to(heads, { yPercent: -112, duration: FALL, ease: 'power2.in', stagger: 0.03 }, to - FALL - 0.06);
      if (fades.length) tl.to(fades, { autoAlpha: 0, duration: 0.14 }, to - FALL - 0.08);
      tl.set(el, { visibility: 'hidden' }, to);
    };
    SCENES.forEach((scene, index) => {
      const el = block(scene.id);
      if (!el) return;
      const gone = index < MOVES.length ? MOVES[index] + GOING : null;
      if (index === 0) {
        // On the sheet from the start: the entrance (mount.ts) brings these up in its own time, so the
        // timeline only takes them away, each from where it rests.
        gsap.set(el, { visibility: 'visible' });
        tl.fromTo(all(el, '[data-fade]'), { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.14, immediateRender: false }, gone! - FALL - 0.08);
        tl.set(el, { visibility: 'hidden' }, gone!);
        return;
      }
      show(el, MOVES[index - 1] + GOING, gone);
    });
    const cues = all(root, '[data-cue]');
    if (cues.length) tl.fromTo(cues, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.12, immediateRender: false }, 0.05);

    // The first words stand on the line and sink back into it; the last ones rise out of it. Both are there
    // only while the plate behind them is bare paper. The window they move in closes to the line itself
    // (--cut) while they move, so they are seen to go into the line and come out of it, not past it.
    const first = one('[data-first]'), last = one('[data-last]');
    if (first) {
      const [from, to] = SCORE.firstGone;
      gsap.set(first, { visibility: 'visible' });
      tl.fromTo(first, { '--cut': 0 }, { '--cut': 1, duration: 0.05, immediateRender: false }, from);
      tl.fromTo(all(first, '[data-lift]'), { yPercent: 0 }, { yPercent: 104, duration: to - from - 0.02, ease: 'power2.in', immediateRender: false }, from + 0.02);
      tl.set(first, { visibility: 'hidden' }, to + 0.04);
    }
    if (last) {
      const [from, to] = SCORE.last;
      gsap.set(last, { '--cut': 1 });
      tl.set(last, { visibility: 'visible' }, from);
      tl.fromTo(all(last, '[data-lift]'), { yPercent: 104 }, { yPercent: 0, duration: to - from - 0.07, ease: 'power3.out' }, from);
      tl.fromTo(last, { '--cut': 1 }, { '--cut': 0, duration: 0.06 }, to - 0.07);
    }

    // ---------- The title block: each cell rolls to its next entry as the scene changes ----------
    for (const cell of all(root, '[data-roll]')) {
      const rows = Number(cell.dataset.rows), steps = (cell.dataset.steps ?? '').split(',').map(Number);
      steps.forEach((row, index) => {
        if (index === 0 || row === steps[index - 1]) return;
        tl.fromTo(cell, { yPercent: (-100 * steps[index - 1]) / rows }, { yPercent: (-100 * row) / rows, duration: 0.2, ease: 'power2.inOut', immediateRender: false }, MOVES[index - 1] + 0.12);
      });
    }
    tl.set({}, {}, SCORE.end);
  }, root);

  return {
    seek: at => timeline?.time(Math.max(0, Math.min(SCORE.end, at)), false),
    destroy: () => context.revert(),
  };
}
