// The three hands, as shapes. They are drawn, not photographed: a hand is looked at from a hand's width
// away at its own stop, and a drawing stays sharp at any size. Each is an outline (walked here, for its
// side wall and for the poster) and the same outline as a distance in the shader (shaders.ts,
// HAND_FRAGMENT), so the two cannot drift apart: both are built from the numbers below.
//
// Millimetres, in the hand's own frame: the pivot is the origin and +y runs to the tip. The holes are a
// real calibre's (1.50 mm for the hour wheel, 0.90 mm for the cannon pinion), and the seconds hand has
// the long tube it is pressed onto its pinion by.
//
// No imports: scripts/gsap/sum/prepare.mjs reads this file for the poster's hands.

/** Hour and minute: a blued steel blade with two facets, a hub round its hole, a short tail. */
export interface Blade {
  kind: 0;
  /** Behind the pivot, and from the pivot to the point. */
  tail: number; length: number;
  /** The boss round the pivot, and the hole it is pressed on by (radii). */
  hub: number; hole: number;
  /** Half the blade's width where it leaves the hub and where the point begins; how long the point is. */
  root: number; shoulder: number; point: number;
  /** Half the tail's width at its end. */
  heel: number;
  thick: number;
  /** The collar under the hub: its radius and how far it reaches down. */
  pipe: [radius: number, length: number];
}
/** Seconds: a lacquered needle with a counterweight, on a steel tube riveted through its hub. */
export interface Needle {
  kind: 1;
  tail: number; length: number;
  /** The boss, and the end of the tube that shows in its middle (radii). */
  hub: number; rivet: number;
  /** Half the needle's width at the hub and at its tip. */
  root: number; end: number;
  /** The counterweight on the tail (radius), and half the stem's width where it meets it. */
  weight: number; stem: number;
  thick: number;
  pipe: [radius: number, length: number];
}
export type HandShape = Blade | Needle;
export type HandName = 'hour' | 'minute' | 'second';

export const HANDS: { hour: Blade; minute: Blade; second: Needle } = {
  hour: { kind: 0, tail: 2.3, length: 9.0, hub: 1.28, hole: 0.75, root: 0.74, shoulder: 0.43, point: 1.5, heel: 0.50, thick: 0.16, pipe: [0.88, 0.40] },
  minute: { kind: 0, tail: 2.8, length: 13.4, hub: 1.02, hole: 0.45, root: 0.57, shoulder: 0.29, point: 1.7, heel: 0.37, thick: 0.14, pipe: [0.58, 0.44] },
  second: { kind: 1, tail: 4.4, length: 14.9, hub: 0.66, rivet: 0.27, root: 0.135, end: 0.055, weight: 0.56, stem: 0.16, thick: 0.09, pipe: [0.22, 1.40] },
};

/** The two vectors the shader takes a hand's shape as (see HAND_FRAGMENT). */
export const handUniforms = (hand: HandShape): [[number, number, number, number], [number, number, number, number]] =>
  hand.kind === 0
    ? [[hand.tail, hand.length, hand.hub, hand.hole], [hand.root, hand.shoulder, hand.point, hand.heel]]
    : [[hand.tail, hand.length, hand.hub, hand.rivet], [hand.root, hand.end, hand.weight, hand.stem]];

/** How far a hand reaches to each side of its own line: the quad it is drawn on is this wide. */
export const handHalfWidth = (hand: HandShape) => (hand.kind === 0 ? hand.hub : Math.max(hand.hub, hand.weight));

// Every piece of a hand is symmetric about its line, so the outline is one curve: half the width at each
// place along the line, the widest of the pieces there. `[from, to, half-width at from, at to]` is a
// straight-sided piece; `[centre, radius]` a disc.
type Piece = [number, number, number, number] | [number, number];
const piecesOf = (hand: HandShape): Piece[] =>
  hand.kind === 0
    ? [[-hand.tail, 0, hand.heel, hand.root], [0, hand.length - hand.point, hand.root, hand.shoulder], [hand.length - hand.point, hand.length, hand.shoulder, 0], [0, hand.hub]]
    : [[-(hand.tail - hand.weight), 0, hand.stem, hand.root], [0, hand.length, hand.root, hand.end], [0, hand.hub], [-(hand.tail - hand.weight), hand.weight]];
const halfWidthAt = (pieces: Piece[], y: number) => {
  let widest = 0;
  for (const piece of pieces) {
    if (piece.length === 2) { const [centre, radius] = piece, off = y - centre; if (Math.abs(off) < radius) widest = Math.max(widest, Math.sqrt(radius * radius - off * off)); }
    else { const [from, to, a, b] = piece; if (y >= from && y <= to) widest = Math.max(widest, a + ((b - a) * (y - from)) / (to - from)); }
  }
  return widest;
};
/** Drops the points of an open line that lie within `tolerance` of the line through their neighbours (Ramer, Douglas, Peucker). */
function thin(points: [number, number][], tolerance: number): [number, number][] {
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [from, to] = stack.pop()!;
    const [ax, ay] = points[from], [bx, by] = points[to], length = Math.hypot(bx - ax, by - ay) || 1e-9;
    let worst = 0, index = -1;
    for (let i = from + 1; i < to; i++) { const d = Math.abs((points[i][0] - ax) * (by - ay) - (points[i][1] - ay) * (bx - ax)) / length; if (d > worst) { worst = d; index = i; } }
    if (worst > tolerance && index > 0) { keep[index] = 1; stack.push([from, index], [index, to]); }
  }
  return points.filter((_, i) => keep[i]);
}

/**
 * A hand's outline as a closed loop [x0, y0, x1, y1, ...], counter-clockwise, as the walls are built
 * from (watch.ts, buildWall). The hole is not part of it: it has a wall of its own.
 */
export function handOutline(hand: HandShape): number[] {
  const pieces = piecesOf(hand);
  // Fine steps along the line, and finer where a disc closes: there the width changes fastest.
  const places = new Set<number>();
  for (let y = -hand.tail; y <= hand.length + 1e-9; y += 0.01) places.add(Math.round(y * 1e4) / 1e4);
  for (const piece of pieces) {
    if (piece.length === 2) for (let step = 0; step <= 96; step++) places.add(Math.round((piece[0] - piece[1] * Math.cos((step / 96) * Math.PI)) * 1e4) / 1e4);
    else { places.add(piece[0]); places.add(piece[1]); }
  }
  const side = thin([...places].filter(y => y >= -hand.tail - 1e-9 && y <= hand.length + 1e-9).sort((a, b) => a - b).map(y => [halfWidthAt(pieces, y), y] as [number, number]), 0.0015);
  // Up the right side from the tail to the tip, and down the left: counter-clockwise.
  const loop: number[] = [];
  for (const [x, y] of side) loop.push(x, y);
  for (let i = side.length - 1; i >= 0; i--) { const [x, y] = side[i]; if (x > 1e-6) loop.push(-x, y); }
  return loop;
}
