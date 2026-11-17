// The drawing on the Datum sheet: the setting out (grid lines, a string of dimensions, levels) and the
// elevation of the long house, as SVG lines over the plate.
//
// Every line is made from the house as measured in its own photograph (survey.ts) and put where the
// plate's camera puts that photograph, so the drawing lies over the building it becomes. The lines are
// written in px of the stage; each path is given the same nominal length (pathLength, PEN below), so the
// timeline can draw any of them by sliding its dash from PEN to 0 whatever size the stage is.
//
// This file builds the elements once and places them on each layout. When they appear is the
// timeline's business (timeline.ts): it finds them by their data-draw and data-pop names.

import { HOUSE } from './survey';
import { gridLines, STRIPS } from './plate';
import { house, length as asLength, level as asLevel } from './content';

const NS = 'http://www.w3.org/2000/svg';
/**
 * The nominal length of every line that is drawn. A thousand, not one: GSAP rounds a length in px to a
 * whole number unless told not to, and with a length of 1 a line was either not there or all there. It
 * came in at once, half way through the time it had to be drawn in.
 */
export const PEN = 1000;
type Point = { x: number; y: number };
export interface Sheet { width: number; height: number; datum: number; narrow: boolean;
  /** Where the tag that hangs from the datum's east end begins: the dimensions stop short of it. */
  tag: number }

export interface Drawing {
  /** Put every line where the camera puts the house. */
  layout(project: (mx: number, my: number) => Point, sheet: Sheet): void;
  /** Cut the drawing away where the building has gone up: `edges` are the strips' sides, `bays` how far each has risen. */
  cut(edges: number[], bays: number[]): void;
  /** The figures that count as their lines are drawn (millimetres). */
  count(len: number, rise: number): void;
  destroy(): void;
}

const LETTERS = 'ABCDEFG';

export function buildDrawing(svg: SVGSVGElement, clipId: string): Drawing {
  const make = <K extends keyof SVGElementTagNameMap>(tag: K, parent: Element, attrs: Record<string, string | number> = {}) => {
    const element = document.createElementNS(NS, tag);
    for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, String(value));
    parent.appendChild(element);
    return element;
  };
  /** A line the timeline can draw: its dash is its whole length. */
  const line = (parent: Element, name: string, index?: number) => make('path', parent, { 'data-draw': name, pathLength: PEN, ...(index === undefined ? {} : { 'data-i': index }) });
  const mark = (parent: Element, name: string, index?: number) => make('path', parent, { 'data-pop': name, ...(index === undefined ? {} : { 'data-i': index }) });
  const text = (parent: Element, attrs: Record<string, string | number>, content = '') => { const element = make('text', parent, attrs); element.textContent = content; return element; };

  const empty = () => { while (svg.firstChild) svg.removeChild(svg.firstChild); };
  empty();
  const defs = make('defs', svg), clip = make('clipPath', defs, { id: clipId, clipPathUnits: 'userSpaceOnUse' });
  const cuts = Array.from({ length: STRIPS * 2 }, () => make('rect', clip));
  const unbuilt = make('g', svg, { 'clip-path': `url(#${clipId})` });

  // ---------- The setting out, in the red of the line ----------
  const set = make('g', unbuilt, { 'data-set': '' });
  const grid = gridLines.map((_, index) => ({ line: line(set, 'grid', index), bubble: line(set, 'bubble', index), letter: text(set, { 'data-pop': 'letter', 'data-i': index, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, LETTERS[index]) }));
  // Two strings of dimensions: the bays, and under them the whole length.
  const lenLine = line(set, 'len');
  const lenTicks = gridLines.map((_, index) => mark(set, 'len-tick', index));
  const bayFigures = gridLines.slice(1).map((_, index) => text(set, { 'data-pop': 'bay', 'data-i': index, 'text-anchor': 'middle' }, asLength(house.bay)));
  const allLine = line(set, 'all');
  const allTicks = [0, 1].map(index => mark(set, 'all-tick', index));
  const lenFigure = text(set, { 'data-count': 'len', 'text-anchor': 'middle' }, asLength(0));
  const riseLine = line(set, 'rise');
  const riseTicks = [0, 1, 2].map(index => mark(set, 'rise-tick', index));
  const eavesFigure = text(set, { 'data-pop': 'eaves' }, `+${asLevel(house.eaves)}`);
  const ridgeFigure = text(set, { 'data-count': 'ridge' }, `+${asLevel(0)}`);

  // ---------- The elevation, in ink ----------
  const ink = make('g', unbuilt, { 'data-elevation': '' });
  const COURSES = 11, BOARDS = 5;
  const courses = Array.from({ length: COURSES }, (_, index) => line(ink, 'course', index));
  const wall = line(ink, 'wall'), roof = line(ink, 'roof');
  const openings = HOUSE.openings.map((_, index) => line(ink, 'opening', index));
  const glass = HOUSE.openings.map((opening, index) => (opening.glass ? line(ink, 'glass', index) : null));
  const door = HOUSE.openings.find(opening => opening.kind === 'door')!;
  const boards = Array.from({ length: BOARDS }, (_, index) => line(ink, 'board', index));
  const latch = mark(ink, 'latch');
  // Two short strokes across the glass of the three largest panes: how a drawing says glass.
  const panes = HOUSE.openings.map((opening, index) => ({ opening, index })).filter(item => item.opening.glass).sort((a, b) => b.opening.glass![2] * b.opening.glass![3] - a.opening.glass![2] * a.opening.glass![3]).slice(0, 3);
  const glints = panes.map((_, index) => line(ink, 'glint', index));

  let sheet: Sheet = { width: 1, height: 1, datum: 1, narrow: false, tag: 1 };
  const f = (value: number) => (Math.round(value * 100) / 100).toString();

  return {
    layout(project, next) {
      sheet = next;
      const { width, height, datum, narrow } = next;
      svg.setAttribute('viewBox', `0 0 ${f(width)} ${f(height)}`);
      svg.toggleAttribute('data-narrow', narrow);
      const P = (mx: number, my: number) => project(mx, my);
      const left = P(HOUSE.left, HOUSE.ground).x, right = P(HOUSE.right, HOUSE.ground).x, eaves = P(0, HOUSE.eaves).y, ridge = P(0, HOUSE.ridge).y;

      // Grid: each line rises from the datum to a lettered bubble over the roof.
      const radius = narrow ? 7 : 10;
      const bubble = Math.max(radius + 3, ridge - (narrow ? 12 : 24) - radius);
      gridLines.forEach((mx, index) => {
        const x = P(mx, 0).x, item = grid[index];
        item.line.setAttribute('d', `M${f(x)} ${f(datum)}V${f(bubble + radius)}`);
        item.bubble.setAttribute('d', `M${f(x)} ${f(bubble + radius)}a${radius} ${radius} 0 1 1 0 ${-2 * radius}a${radius} ${radius} 0 1 1 0 ${2 * radius}`);
        item.letter.setAttribute('x', f(x)); item.letter.setAttribute('y', f(bubble));
      });

      // Under the line: a string for the bays, with a tick at every grid line and each bay's length over it,
      // and under that a string for the whole, with its figure over it. Where the plate has little room
      // below the datum there is one string, and the whole length under it.
      const below = height - datum, tight = below < 50;
      const first = datum + (tight ? below * 0.36 : Math.min(30, below * 0.34)), second = datum + Math.min(58, below * 0.66);
      // Each string runs a little past its last tick, and never as far as the datum's level. What the pen
      // draws runs from the first tick to the last and no further, so a share of the line is the same share
      // of the house on a sheet of any size: the ticks and the figures are timed from that (timeline.ts).
      // The little that runs past belongs to the end ticks, and is there when they are.
      const past = Math.max(0, Math.min(10, next.tag - 5 - right));
      const ends = (index: number, last: number, y: number) => (index === 0 ? `M${f(left - past)} ${f(y)}H${f(left)}` : index === last ? `M${f(right)} ${f(y)}H${f(right + past)}` : '');
      /** Where a tick's line crosses it: what the pen has to reach before the tick is there. */
      const crosses = (tick: SVGPathElement, x: number, y: number) => tick.setAttribute('data-at', `${f(x)} ${f(y)}`);
      lenLine.setAttribute('d', `M${f(left)} ${f(first)}H${f(right)}`);
      gridLines.forEach((mx, index) => {
        const x = P(mx, 0).x;
        lenTicks[index].setAttribute('d', `M${f(x)} ${f(datum + 5)}V${f(first + 6)}M${f(x - 4)} ${f(first + 4)}L${f(x + 4)} ${f(first - 4)}${ends(index, gridLines.length - 1, first)}`);
        crosses(lenTicks[index], x, first);
      });
      bayFigures.forEach((figure, index) => {
        figure.setAttribute('x', f((P(gridLines[index], 0).x + P(gridLines[index + 1], 0).x) / 2)); figure.setAttribute('y', f(first - 5));
        if (tight) figure.setAttribute('display', 'none'); else figure.removeAttribute('display');
      });
      allLine.setAttribute('d', tight ? '' : `M${f(left)} ${f(second)}H${f(right)}`);
      [left, right].forEach((x, index) => {
        allTicks[index].setAttribute('d', tight ? '' : `M${f(x)} ${f(first + 6)}V${f(second + 6)}M${f(x - 4)} ${f(second + 4)}L${f(x + 4)} ${f(second - 4)}${ends(index, 1, second)}`);
        crosses(allTicks[index], x, second);
      });
      lenFigure.setAttribute('x', f((left + right) / 2)); lenFigure.setAttribute('y', f(tight ? first + (narrow ? 12 : 14) : second - 5));

      // Levels: the line rises from the datum to the ridge, past the eaves. Beside the east end on a wide
      // sheet, with each level lettered beside it; beside the west end on a phone, where the east end is
      // the datum's own level, and with room only for the ridge's, over its top.
      const out = narrow ? Math.min(16, Math.max(9, left - 12)) : Math.min(42, Math.max(14, (width - right) * 0.3));
      const x = narrow ? left - out : right + out, from = narrow ? left - 5 : right + 5, to = narrow ? x - 6 : x + 6;
      // (The pen stops at the ridge, as the strings stop at their last ticks: the little above it is the ridge tick's.)
      riseLine.setAttribute('d', `M${f(x)} ${f(datum)}V${f(ridge)}`);
      [datum, eaves, ridge].forEach((at, index) => {
        riseTicks[index].setAttribute('d', `${index ? `M${f(from)} ${f(at)}H${f(to)}` : ''}M${f(x - 4)} ${f(at + 4)}L${f(x + 4)} ${f(at - 4)}${index === 2 ? `M${f(x)} ${f(ridge)}V${f(ridge - 8)}` : ''}`);
        crosses(riseTicks[index], x, at);
      });
      if (narrow) {
        // Its figure ends short of the first grid letter.
        ridgeFigure.setAttribute('text-anchor', 'end'); ridgeFigure.setAttribute('x', f(left - radius - 4)); ridgeFigure.setAttribute('y', f(ridge - 13));
        eavesFigure.setAttribute('display', 'none');
      } else {
        ridgeFigure.setAttribute('text-anchor', 'start'); ridgeFigure.setAttribute('x', f(x + 11)); ridgeFigure.setAttribute('y', f(ridge + 4));
        eavesFigure.removeAttribute('display'); eavesFigure.setAttribute('text-anchor', 'start'); eavesFigure.setAttribute('x', f(x + 11)); eavesFigure.setAttribute('y', f(eaves + 4));
      }

      // The elevation. The wall goes up its west end, along the eaves and down its east end; the ground is the datum itself.
      const at = (point: readonly [number, number]) => { const p = P(point[0], point[1]); return `${f(p.x)} ${f(p.y)}`; };
      wall.setAttribute('d', `M${at([HOUSE.left, HOUSE.ground])}L${at([HOUSE.left, HOUSE.eaves])}L${at([HOUSE.right, HOUSE.eaves])}L${at([HOUSE.right, HOUSE.ground])}`);
      roof.setAttribute('d', `M${at(HOUSE.roof[0])}L${at(HOUSE.roof[1])}L${at(HOUSE.roof[2])}L${at(HOUSE.roof[3])}`);
      HOUSE.openings.forEach((opening, index) => {
        const a = P(opening.x, opening.y), b = P(opening.x + opening.w, opening.y + opening.h);
        // An opening that comes down to the ground stands on the line and needs no sill drawn.
        const grounded = opening.kind !== 'window';
        openings[index].setAttribute('d', grounded ? `M${f(a.x)} ${f(datum)}V${f(a.y)}H${f(b.x)}V${f(datum)}` : `M${f(a.x)} ${f(b.y)}V${f(a.y)}H${f(b.x)}V${f(b.y)}Z`);
        const pane = glass[index];
        if (pane && opening.glass) {
          const [gx, gy, gw, gh] = opening.glass, c = P(gx, gy), d = P(gx + gw, gy + gh);
          pane.setAttribute('d', grounded ? `M${f(c.x)} ${f(datum)}V${f(c.y)}H${f(d.x)}V${f(datum)}` : `M${f(c.x)} ${f(d.y)}V${f(c.y)}H${f(d.x)}V${f(d.y)}Z`);
        }
      });
      // Courses of slate, closer toward the ridge, each from verge to verge.
      const verge = (side: 0 | 1, my: number) => { const [low, high] = side ? [HOUSE.roof[3], HOUSE.roof[2]] : [HOUSE.roof[0], HOUSE.roof[1]]; return low[0] + ((high[0] - low[0]) * (low[1] - my)) / (low[1] - high[1]); };
      const shown = narrow ? 6 : COURSES;
      courses.forEach((course, index) => {
        if (index >= shown) { course.setAttribute('d', ''); return; }
        const share = (index + 1) / (shown + 1), my = HOUSE.eaves - (HOUSE.eaves - HOUSE.ridge) * (share * (1.18 - 0.18 * share));
        course.setAttribute('d', `M${at([verge(0, my), my])}L${at([verge(1, my), my])}`);
      });
      // The door's boards and its latch.
      const planks = narrow ? 2 : BOARDS;
      boards.forEach((board, index) => {
        if (index >= planks) { board.setAttribute('d', ''); return; }
        const p = P(door.x + (door.w * (index + 1)) / (planks + 1), door.y);
        board.setAttribute('d', `M${f(p.x)} ${f(datum)}V${f(p.y)}`);
      });
      const hand = P(door.x + door.w * 0.86, door.y + door.h * 0.56);
      latch.setAttribute('d', narrow ? '' : `M${f(hand.x - 3.5)} ${f(hand.y)}H${f(hand.x + 2)}`);
      glints.forEach((glint, index) => {
        const [gx, gy, gw, gh] = panes[index].opening.glass!;
        const a = P(gx + gw * 0.62, gy + gh * 0.3), size = Math.max(5, Math.min(13, (P(gx + gw, 0).x - P(gx, 0).x) * 0.16));
        glint.setAttribute('d', narrow ? '' : `M${f(a.x)} ${f(a.y + size)}l${f(size)} ${f(-size)}M${f(a.x + size * 0.55)} ${f(a.y + size * 1.25)}l${f(size * 0.7)} ${f(-size * 0.7)}`);
      });
    },
    cut(edges, bays) {
      const { height, datum } = sheet;
      for (let index = 0; index < STRIPS; index++) {
        const x = edges[index], w = Math.max(0, edges[index + 1] - x), up = bays[index] ?? 0;
        // What is still drawing in this strip: above the building's top, and below its foot. A hair wider
        // than the strip, so a line that crosses two strips has no gap where they meet.
        const above = cuts[index * 2], under = cuts[index * 2 + 1];
        above.setAttribute('x', f(x - 0.4)); above.setAttribute('y', '-2'); above.setAttribute('width', f(w + 0.8)); above.setAttribute('height', f(Math.max(0, datum * (1 - up) + 2)));
        under.setAttribute('x', f(x - 0.4)); under.setAttribute('y', f(datum + (height - datum) * up)); under.setAttribute('width', f(w + 0.8)); under.setAttribute('height', f(Math.max(0, (height - datum) * (1 - up) + 2)));
      }
    },
    count(len, rise) {
      const whole = asLength(Math.round(len / 10) * 10), up = `+${asLevel(Math.round(rise / 5) * 5)}`;
      if (lenFigure.textContent !== whole) lenFigure.textContent = whole;
      if (ridgeFigure.textContent !== up) ridgeFigure.textContent = up;
    },
    destroy: empty,
  };
}
