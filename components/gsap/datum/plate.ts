// The plate: everything photographic on the Datum sheet, drawn on one canvas.
//
// Every picture stands on the datum by one row of its own (its level: a ground line, a floor, a joint, a
// course of slate), so the red line is in the same place on the screen in all of them. The long house's
// six states are edits of one photograph, registered to the pixel (scripts/gsap/datum/register.mjs), so one
// can be opened over another along any edge and nothing moves.
//
// What is drawn is a pure function of `view` (numbers the page's timeline sets from the scroll) and the
// layout: nothing here runs in its own time. Pictures arrive solid, through a straight edge (out of the
// datum, down from the ridge, out from a sample or from an opening's own glass, or along the line), never
// by fading in over what was there; the one cross-fade is dusk falling, which is light changing and not a
// picture arriving.

import { HOUSE, PICTURES, type FileSize, type PictureId } from './survey';
import type { Shape } from './director';

/** The plate's box, in CSS px, and where the datum is in it. */
export interface Layout { width: number; height: number; datum: number; shape: Shape; dpr: number; small: boolean;
  /** A touch screen: memory is shorter there, so the largest files are left alone. */
  lean: boolean; edge: number;
  /** Room to keep clear beside the house, each side, for what hangs from the datum's end (px). */
  keep: number }
/** A camera: CSS px to a pixel of the master, and the master's column that stands in the middle of the plate. */
export interface Camera { s: number; fx: number }
export interface Box { id: string; left: number; top: number; right: number; bottom: number }

/** The long house's openings that have a light behind them: all but the door. */
export const LIT = HOUSE.openings.map((opening, index) => (opening.kind === 'door' ? -1 : index)).filter(index => index >= 0);
/** The strips the building goes up in: left of the first grid line, the six bays, right of the last. */
export const STRIPS = 8;
const GRID = Array.from({ length: 7 }, (_, index) => HOUSE.left + ((HOUSE.right - HOUSE.left) * index) / 6);
export const gridLines = GRID;

/** Everything the timeline sets. All run 0 to 1 except `street` (-1 to 3) and the figures. */
export const createView = () => ({
  /** The site opens out of the datum, up and down. */
  open: 0,
  /** Tracing paper, unrolled across it from the left. */
  veil: 0,
  bay0: 0, bay1: 0, bay2: 0, bay3: 0, bay4: 0, bay5: 0, bay6: 0, bay7: 0,
  /** The finished house comes down over the building site, from the top. */
  settle: 0,
  /** From the whole house to close by (a tall stage walks up to it). */
  zoom: 0,
  /** Dusk; each opening's light; and the last of the evening light that is not from any one window. */
  dusk: 0,
  lit0: 0, lit1: 0, lit2: 0, lit3: 0, lit4: 0, lit5: 0, lit6: 0, lit7: 0, lit8: 0, lit9: 0,
  glow: 0,
  /** In through the tall opening, up a floor, and the room closes back into the line. */
  enter: 0, climb: 0, leave: 0,
  /** Three samples come up; each opens to the whole plate; the last closes into the line. */
  sample0: 0, sample1: 0, sample2: 0, mat0: 0, mat1: 0, mat2: 0, shut: 0,
  /** Where the page is along the line of other work: 0, 1 and 2 are the three buildings. */
  street: -1,
  /** The sheet itself: 0 by day, 1 at night. */
  night: 0,
  /** Figures that count as their lines are drawn (millimetres). */
  len: 0, rise: 0, level: 0,
});
export type View = ReturnType<typeof createView>;
type Key = keyof View;

/** The sheet's colours, by day and at night: night is the dusk sky's own blue, so the sky runs out into the sheet. */
export const DAY = { paper: [232, 234, 240], ink: [21, 23, 28], soft: [88, 94, 106], red: [221, 58, 28] } as const;
export const NIGHT = { paper: [42, 87, 174], ink: [244, 242, 236], soft: [205, 216, 240], red: [255, 132, 100] } as const;
export const mix = (a: readonly number[], b: readonly number[], t: number) => a.map((value, index) => Math.round(value + (b[index] - value) * t));
/**
 * Whether the ink has turned from dark to light as night falls. The paper changes all the way through
 * dusk; the ink turns at once, at the one moment the paper is as far from dark ink as it is from light
 * (about four to one either way), so what is written is never the tone of what it is written on. A
 * gradual turn has to pass through that tone, and for a moment the whole sheet went blank.
 */
export const TURN = 0.785;
export const inkTurn = (night: number) => (night >= TURN ? 1 : 0);
/**
 * The sheet's quieter tone (body text, the title block's labels) through dusk. It is nearer the paper than
 * the ink is, so left alone it sinks into the paper before the turn (1.5 to 1 at worst). It leans on the
 * ink instead: it darkens toward the ink as the paper darkens, turns with it, and eases back from the light
 * ink to its own night tone as the paper goes on darkening. It never has less than the ink's four to one.
 */
export const softTone = (night: number) => (night >= TURN ? mix(NIGHT.ink, NIGHT.soft, (night - TURN) / (1 - TURN)) : mix(DAY.soft, DAY.ink, night / TURN));
const rgb = (colour: readonly number[], alpha = 1) => (alpha >= 1 ? `rgb(${colour[0]} ${colour[1]} ${colour[2]})` : `rgb(${colour[0]} ${colour[1]} ${colour[2]} / ${alpha})`);

/** CSS px to a metre at 1:1, at the 96 px to the inch a CSS px is defined by. */
const PX_PER_METRE = 96 / 0.0254;
/** The nearest scale a drawing would be given: 1:85, 1:135, 1:325. */
const stepOf = (ratio: number) => (ratio < 400 ? 5 : ratio < 1000 ? 10 : 25);
export const niceScale = (ratio: number) => { const step = stepOf(ratio); return Math.max(step, Math.round(ratio / step) * step); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface Layer { image: CanvasImageSource; rect: readonly [number, number, number, number] }
type Entry = { status: 'loading' | 'ready' | 'failed'; layer?: Layer; bitmap?: ImageBitmap };

/** When each picture is on the sheet, in screens: it is fetched some way ahead of that. */
const NEEDED: Record<PictureId, [number, number]> = {
  site: [0, 5.8], build: [4.5, 7], house: [6, 8.1], duskoff: [7.2, 8.8], dusk: [7.9, 10],
  ground: [9, 11.2], first: [10.2, 12.1], slate: [12, 14.7], lime: [12, 15.7], oak: [12, 16.6],
  coast: [16.2, 18.5], studio: [17.5, 19.8], pavilion: [18.7, 21],
};
const ORDER = Object.keys(NEEDED) as PictureId[];
const WORK: PictureId[] = ['coast', 'studio', 'pavilion'];
const MATERIAL: PictureId[] = ['slate', 'lime', 'oak'];

export interface Plate {
  resize(layout: Layout): void;
  draw(view: View): void;
  /** Fetch what the page will want near these places (screens), and let go of what is far from all of them. */
  want(...places: number[]): void;
  /** The camera on the long house for a view, and the two it moves between. */
  camera(view: View): Camera;
  readonly overview: Camera;
  readonly closeUp: Camera;
  /** Where a point of the long house's photograph is on the plate, in CSS px, seen whole. */
  project(mx: number, my: number): { x: number; y: number };
  /**
   * The scales the pictures are drawn at, as a drawing gives them (the 85 of 1:85): the long house seen whole
   * and from close by, and each of the other buildings.
   */
  ratios(): { overview: number; close: number; coast: number; studio: number; pavilion: number };
  /** What the last draw put on the plate: for the checks. */
  readonly boxes: Box[];
  ready(id: PictureId): boolean;
  /** The strips' edges on the plate, left to right (nine of them), for cutting the drawing where the building stands. */
  strips(): number[];
  /**
   * Every edge and corner that moves on the plate, in px, always in the same order: for measuring how far
   * the picture travels for a screen of scroll (scripts/gsap/verify-datum.mjs).
   */
  edges(view: View): number[];
  /**
   * What the picture is about at this moment, as boxes on the plate: the long house, the samples still
   * standing, one of the other buildings. Nothing laid over the plate may cover these (scripts/gsap/verify-datum.mjs
   * asks for them; it does not work them out for itself). A room, or a material that has the whole plate, has none.
   */
  subjects(view: View): Box[];
  destroy(): void;
}

export function createPlate(canvas: HTMLCanvasElement, base: string, onChange: () => void): Plate {
  const ctx = canvas.getContext('2d', { alpha: true })!;
  let layout: Layout = { width: 1, height: 1, datum: 1, shape: 'wide', dpr: 1, small: false, lean: false, edge: 16, keep: 0 };
  let overview: Camera = { s: 0.5, fx: (HOUSE.left + HOUSE.right) / 2 }, closeUp: Camera = overview;
  let alive = true;
  const boxes: Box[] = [];
  const entries = new Map<string, Entry>();
  let recipes = new Map<PictureId, FileSize[]>();
  const works = new Map<PictureId, { s: number; ratio: number }>();

  // ---------- Pictures: fetched ahead of when they are due, a few at a time, decoded off the main thread ----------
  let loading = 0, queue: [PictureId, FileSize][] = [];
  const pump = () => {
    while (alive && loading < 3 && queue.length) {
      const [id, size] = queue.shift()!;
      const key = `${id}-${size}`;
      if (entries.has(key)) continue;
      const entry: Entry = { status: 'loading' };
      entries.set(key, entry);
      loading++;
      const url = `${base}/${PICTURES[id].dir}/${id}-${size}.webp`, rect = PICTURES[id].files[size]!;
      const settle = () => { loading--; pump(); };
      const done = (image: CanvasImageSource, bitmap?: ImageBitmap) => {
        settle();
        // Let go at once of anything that arrives after it has stopped being wanted.
        if (!alive || entries.get(key) !== entry) { bitmap?.close(); return; }
        entry.status = 'ready'; entry.layer = { image, rect }; entry.bitmap = bitmap;
        patches.clear();
        onChange();
      };
      // A picture that could not be fetched is forgotten after a moment, so that it is asked for again as the page moves on.
      const failed = () => { entry.status = 'failed'; settle(); window.setTimeout(() => { if (entries.get(key) === entry) entries.delete(key); }, 2500); };
      const plain = () => { const image = new Image(); image.decoding = 'async'; image.onload = () => done(image); image.onerror = failed; image.src = url; };
      if (typeof createImageBitmap === 'function' && typeof fetch === 'function') fetch(url).then(response => (response.ok ? response.blob() : Promise.reject(new Error(String(response.status))))).then(blob => createImageBitmap(blob)).then(bitmap => done(bitmap, bitmap)).catch(plain);
      else plain();
    }
  };
  const drop = (id: PictureId) => {
    for (const size of ['l', 'm', 's', 'c'] as FileSize[]) { const key = `${id}-${size}`, entry = entries.get(key); if (entry) { entry.bitmap?.close(); entries.delete(key); } }
  };
  const layersOf = (id: PictureId): Layer[] | null => {
    const sizes = recipes.get(id);
    if (!sizes) return null;
    const first = entries.get(`${id}-${sizes[0]}`);
    if (!first || first.status !== 'ready') return null;
    const layers = [first.layer!];
    for (const size of sizes.slice(1)) { const entry = entries.get(`${id}-${size}`); if (entry?.status === 'ready') layers.push(entry.layer!); }
    return layers;
  };
  const want = (...places: number[]) => {
    // How far each picture's time is from any of the places asked about (where the page is, and where it is going).
    const far = (id: PictureId) => Math.min(...places.map(at => { const [from, to] = NEEDED[id]; return at < from ? from - at : at > to ? at - to : 0; }));
    const ahead = layout.small ? 2.6 : 3.6, behind = layout.lean ? 4.5 : 6.5;
    // Nearest first: a picture whose time is further off waits for the ones that are due.
    queue = [];
    for (const id of [...ORDER].sort((a, b) => far(a) - far(b))) {
      // Decoded photographs are large: only what is near is held, and the rest is fetched again when it is.
      if (far(id) > behind) drop(id);
      else if (far(id) <= ahead) for (const size of recipes.get(id) ?? []) if (!entries.has(`${id}-${size}`)) queue.push([id, size]);
    }
    pump();
  };

  // ---------- Cameras ----------
  /** A picture set on the datum by its level and filling the plate: the smallest size that covers it. */
  const cover = (id: PictureId): Camera => {
    const { level, focus } = PICTURES[id], { width, height, datum } = layout, w = HOUSE.size[0], h = PICTURES[id].files.l?.[3] ?? HOUSE.size[1];
    const s = Math.max(width / w, datum / level, (height - datum) / (h - level));
    const half = width / (2 * s);
    return { s, fx: Math.min(Math.max(focus, half), w - half) };
  };
  const frame = () => {
    const { width, datum, shape } = layout;
    const wide = HOUSE.right - HOUSE.left, high = HOUSE.ground - HOUSE.ridge, centre = (HOUSE.left + HOUSE.right) / 2;
    const ratioOf = (s: number) => PX_PER_METRE / (s * HOUSE.perMetre), scaleOf = (ratio: number) => PX_PER_METRE / (ratio * HOUSE.perMetre);
    // Seen whole: the house across three quarters of the plate, and no taller than leaves the grid's letters room above it.
    const above = Math.min(84, Math.max(34, datum * 0.16));
    const fit = Math.min((width * (shape === 'tall' ? 0.78 : 0.75)) / wide, (width - 2 * layout.keep) / wide, (datum - above) / high);
    let ratio = niceScale(ratioOf(fit));
    // The nearest round scale; where that would leave the photograph short of the plate's sides and a
    // larger one still fits the house, the larger one.
    const step = stepOf(ratio);
    if (scaleOf(ratio) * wide > width - 2 * layout.keep) ratio += step;
    else if (scaleOf(ratio) * HOUSE.size[0] < width && scaleOf(ratio - step) * wide <= Math.min(width * 0.9, width - 2 * layout.keep) && scaleOf(ratio - step) * high <= datum - above * 0.6) ratio -= step;
    overview = { s: scaleOf(ratio), fx: centre };
    // Close by: a tall stage walks up to the house, as far as leaves some sky over the ridge. It stops where
    // both ends of the house are well off the plate, seen from where a phone stands (between the tall
    // opening and the door); on a stage too low for that, where the house stands whole about its own middle.
    // An end left standing just inside the plate's edge, or just outside it, reads as a mistake. A wide
    // stage stays where it is.
    if (shape === 'tall') {
      const room = (datum * 0.86) / high;
      const reach = (width / 2 + 24) / Math.min(HOUSE.close - HOUSE.left, HOUSE.right - HOUSE.close);
      const aim = Math.min(room, Math.max(overview.s * 1.25, (datum * 0.53) / high, reach));
      // (The nearest round scale may be a little nearer than the aim: never nearer than the ridge allows.)
      let near = niceScale(ratioOf(aim));
      if (scaleOf(near) > room * 1.03) near += stepOf(near);
      let s = scaleOf(near);
      /** How far the house's nearer end is beyond the plate's side, looking at `fx`. */
      const off = (fx: number) => Math.min(-(width / 2 + (HOUSE.left - fx) * s), width / 2 + (HOUSE.right - fx) * s - width);
      let fx = HOUSE.close;
      if (off(fx) < 16) {
        fx = centre;
        // About its middle the house must not end at the plate's very edge either: it steps back until it stands clear inside.
        if (Math.abs(off(fx)) < 14) { near = Math.ceil(ratioOf((width - 32) / wide) / stepOf(near)) * stepOf(near); s = scaleOf(near); }
      } else {
        // The same goes for an opening. The plate's side may fall on bare wall, or cut an opening through
        // with a good part of it to each side; it may not leave four pixels of a lit window at the edge, or
        // a window whole with its frame touching it. Where it would, the camera steps aside, the least it
        // can (a few pixels), without bringing an end of the house back toward the plate.
        const half = width / 2 / s, piece = PICTURES.house.files.c;
        const clean = (at: number) => [-1, 1].every(side => HOUSE.openings.every(o => {
          const edge = at + side * half, from = o.x - 2, to = o.x + o.w + 2;
          const shown = (side < 0 ? to - edge : edge - from) * s, hidden = (side < 0 ? edge - from : to - edge) * s;
          return shown <= -1 || hidden <= -6 || (shown >= 16 && hidden >= 12);
        }));
        // (Nor past the sharper piece of the photograph a phone draws this view from.)
        const home = fx, within = (at: number) => !piece || (at - half >= piece[0] && at + half <= piece[2]);
        const held = (at: number) => off(at) >= 16 && (within(at) || !within(home));
        if (!clean(fx)) {
          for (let step = 2, most = (width * 0.16) / s; step <= most; step += 2) {
            const aside = [fx - step, fx + step].filter(at => held(at) && clean(at)).sort((a, b) => off(b) - off(a));
            if (aside.length) { fx = aside[0]; break; }
          }
        }
      }
      closeUp = s <= overview.s * 1.08 ? overview : { s, fx };
    } else closeUp = overview;
    // Other work: each photograph as wide as the plate, unless its building would then stand taller than the room above the line.
    for (const id of WORK) {
      const { span, length, level } = PICTURES[id], top = PICTURES[id].top!;
      const metre = (span![1] - span![0]) / length!;
      const fill = Math.min(width / HOUSE.size[0], (datum - above * 0.5) / (level - top));
      // A round scale no smaller than that fit, so the photograph still reaches the plate's sides where it can.
      const exact = PX_PER_METRE / (fill * metre);
      let round = Math.floor(exact / stepOf(exact)) * stepOf(exact);
      if (PX_PER_METRE / (round * metre) * (level - top) > datum - above * 0.4) round = Math.ceil(exact / stepOf(exact)) * stepOf(exact);
      works.set(id, { s: PX_PER_METRE / (round * metre), ratio: round });
    }
  };
  const camera = (view: View): Camera => {
    let s = overview.s * Math.pow(closeUp.s / overview.s, view.zoom), fx = lerp(overview.fx, closeUp.fx, view.zoom);
    if (view.enter > 0) {
      // Stepping in: the house comes a little nearer, about the foot of the tall opening.
      const about = TALL.x + TALL.w / 2, nearer = s * (1 + 0.16 * view.enter);
      fx = about - ((about - fx) * s) / nearer;
      s = nearer;
    }
    return { s, fx };
  };
  const TALL = HOUSE.openings.find(opening => opening.kind === 'glazed')!;

  /** Which files a picture is drawn from on this stage: the smallest that are sharp enough. */
  const choose = () => {
    const next = new Map<PictureId, FileSize[]>();
    const { dpr, small, width } = layout;
    const full = (id: PictureId, need: number, largest = !layout.lean): FileSize => {
      const files = PICTURES[id].files;
      const sizes = (['s', 'm', 'l'] as FileSize[]).filter(size => files[size] && files[size]![2] - files[size]![0] === HOUSE.size[0] && (largest || size !== 'l'));
      const res: Record<string, number> = { s: 0.5, m: 0.75, l: 1 };
      // No file is drawn larger than it is (but for a hair): a photograph enlarged is a photograph gone soft.
      return sizes.find(size => res[size] >= need * 0.985) ?? sizes[sizes.length - 1];
    };
    for (const id of ORDER) {
      const meta = PICTURES[id];
      if (meta.dir === 'seq') {
        // The three a tall stage walks up to (the finished house, by day and at dusk) are needed sharp from
        // close by; the site and the building site are only ever seen whole. A phone draws the whole house
        // from the small file and, once it has walked up, the part of it in view from a piece at full size.
        // A tablet held upright has no such piece and takes the largest file for those three alone.
        const near = !!meta.files.c;
        if (small) next.set(id, near ? ['s', 'c'] : ['s']);
        else next.set(id, [full(id, (near ? Math.max(overview.s, closeUp.s) : overview.s) * dpr, near || !layout.lean)]);
      } else if (meta.dir === 'work') next.set(id, [full(id, (works.get(id)?.s ?? 0.5) * dpr)]);
      else {
        const cam = cover(id), piece = meta.files.s, half = width / (2 * cam.s);
        // The middle of the picture, kept larger, where that covers all the stage shows.
        const covers = piece && cam.fx - half >= piece[0] && cam.fx + half <= piece[2];
        next.set(id, [small && covers ? 's' : full(id, cam.s * dpr)]);
      }
    }
    // A change of files lets go of the ones no longer used.
    for (const [id, sizes] of recipes) for (const size of sizes) if (!next.get(id)?.includes(size)) { const key = `${id}-${size}`; entries.get(key)?.bitmap?.close(); entries.delete(key); }
    recipes = next;
    patches.clear();
  };

  // ---------- Drawing ----------
  type Rect = { x: number; y: number; w: number; h: number };
  let paper: number[] = [...DAY.paper];
  const snap = (value: number) => Math.round(value * layout.dpr) / layout.dpr;
  /**
   * One picture, set on the datum by `level`, through a window. Where its top is open sky the sky runs out
   * into the sheet, and so do its sides where the plate is wider than the photograph.
   */
  const picture = (id: PictureId, cam: Camera, clip: Rect | null, alpha = 1, shift = 0, lift = 0): boolean => {
    const layers = layersOf(id);
    if (!layers) return false;
    const meta = PICTURES[id], { width, height, datum } = layout;
    const X = (mx: number) => width / 2 + shift + (mx - cam.fx) * cam.s, Y = (my: number) => datum + lift + (my - meta.level) * cam.s;
    const window = clip ?? { x: 0, y: 0, w: width, h: height };
    if (window.w <= 0 || window.h <= 0) return true;
    ctx.save();
    ctx.beginPath(); ctx.rect(window.x, window.y, window.w, window.h); ctx.clip();
    ctx.globalAlpha = alpha;
    layers.forEach((layer, index) => {
      const [left, top, right, bottom] = layer.rect;
      const over = layers[index + 1];
      if (alpha < 1 && over) {
        // Half-transparent, a picture made of a whole and a sharper piece would lie twice as thick where the
        // piece is: the whole is drawn everywhere but there. Both are cut on the same device pixels.
        const [l, t, r, b] = over.rect, hole = { x: snap(X(l)), y: snap(Y(t)), r: snap(X(r)), b: snap(Y(b)) };
        ctx.save();
        ctx.beginPath(); ctx.rect(window.x, window.y, window.w, window.h); ctx.rect(hole.x, hole.y, hole.r - hole.x, hole.b - hole.y); ctx.clip('evenodd');
        ctx.drawImage(layer.image, X(left), Y(top), (right - left) * cam.s, (bottom - top) * cam.s);
        ctx.restore();
        return;
      }
      if (alpha < 1 && index > 0) {
        ctx.save();
        ctx.beginPath(); ctx.rect(snap(X(left)), snap(Y(top)), snap(X(right)) - snap(X(left)), snap(Y(bottom)) - snap(Y(top))); ctx.clip();
        ctx.drawImage(layer.image, X(left), Y(top), (right - left) * cam.s, (bottom - top) * cam.s);
        ctx.restore();
        return;
      }
      ctx.drawImage(layer.image, X(left), Y(top), (right - left) * cam.s, (bottom - top) * cam.s);
    });
    const whole = layers[0].rect, left = X(whole[0]), right = X(whole[2]), top = Y(whole[1]), bottom = Y(whole[3]);
    if (meta.sky) {
      const fade = (x0: number, y0: number, x1: number, y1: number, box: Rect) => { const gradient = ctx.createLinearGradient(x0, y0, x1, y1); gradient.addColorStop(0, rgb(paper)); gradient.addColorStop(1, rgb(paper, 0)); ctx.fillStyle = gradient; ctx.fillRect(box.x, box.y, box.w, box.h); };
      // From the photograph's own top where that is on the plate, and from the plate's top where it is not.
      const start = Math.max(top, 0), reach = Math.min(top > -1 ? 110 : 76, Math.max(30, (datum + lift - start) * (top > -1 ? 0.3 : 0.16)));
      if (start < datum + lift) fade(0, start, 0, start + reach, { x: left - 2, y: start - 1, w: right - left + 4, h: reach + 1 });
      const side = Math.min(120, (right - left) * 0.09);
      if (left > 0.5) fade(left, 0, left + side, 0, { x: left - 1, y: top - 1, w: side + 1, h: bottom - top + 2 });
      if (right < width - 0.5) fade(right, 0, right - side, 0, { x: right - side, y: top - 1, w: side + 1, h: bottom - top + 2 });
    }
    ctx.restore();
    const box = { id, left: Math.max(window.x, left, 0), top: Math.max(window.y, top, 0), right: Math.min(window.x + window.w, right, width), bottom: Math.min(window.y + window.h, bottom, height) };
    if (alpha > 0.02 && box.right - box.left > 0.5 && box.bottom - box.top > 0.5) boxes.push(box);
    return true;
  };
  /** A window that opens out of the datum: its top goes up to the plate's top and its bottom down to its foot. */
  const fromDatum = (amount: number, left = 0, right = layout.width): Rect => ({ x: left, y: layout.datum * (1 - amount), w: right - left, h: layout.datum * amount + (layout.height - layout.datum) * amount });

  // The lights: each opening's share of the lit photograph, cut out with soft edges once, then laid over the
  // unlit one as its light comes on. Cut again whenever the camera, the plate or the photograph changes.
  // They are cut one a frame while dusk is falling, so that none of the cutting lands on the frame a light
  // comes on: heavy work at the moment something starts to move is seen as a stall.
  type Patch = { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number };
  const patches = { key: '', list: [] as (Patch | null)[], clear() { this.key = ''; this.list = []; } };
  /** The patches for this camera, in the order of LIT, after cutting up to `most` of those still missing. */
  const lightPatches = (cam: Camera, most: number): (Patch | null)[] | null => {
    const layers = layersOf('dusk');
    if (!layers) return null;
    const key = `${cam.s.toFixed(5)}|${cam.fx.toFixed(2)}|${layout.width}|${layout.height}|${layout.dpr}`;
    if (patches.key !== key) { patches.key = key; patches.list = LIT.map(() => null); }
    for (let order = 0; order < LIT.length && most > 0; order++) if (!patches.list[order]) { patches.list[order] = cutPatch(cam, layers, LIT[order]); most--; }
    // Any still to cut are cut in the frames that follow, whether or not the page moves.
    if (patches.list.includes(null)) onChange();
    return patches.list;
  };
  const cutPatch = (cam: Camera, layers: Layer[], index: number): Patch => {
    const { width, datum, dpr } = layout;
    const X = (mx: number) => width / 2 + (mx - cam.fx) * cam.s, Y = (my: number) => datum + (my - HOUSE.ground) * cam.s;
    const o = HOUSE.openings[index];
    // A ground floor window lights the grass in front of it, in a pool wider than itself with no edge to
    // speak of; one upstairs only the wall round it. (Ground floor: its sill is within 2.3 m of the ground.
    // The first floor is 2.7 m up.)
    const low = HOUSE.ground - (o.y + o.h) < 2.3 * HOUSE.perMetre, reachOut = low ? 170 : 96, soften = low ? 126 : 54;
    const region = { left: o.x - reachOut, top: o.y - (low ? 130 : 70), right: o.x + o.w + reachOut, bottom: low ? HOUSE.ground + 210 : o.y + o.h + 84 };
    const x = Math.floor(X(region.left)), y = Math.floor(Y(region.top)), w = Math.ceil(X(region.right)) - x, h = Math.ceil(Y(region.bottom)) - y;
    const patch = document.createElement('canvas');
    patch.width = Math.max(1, Math.round(w * dpr)); patch.height = Math.max(1, Math.round(h * dpr));
    const p = patch.getContext('2d')!;
    p.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const layer of layers) { const [left, top, right, bottom] = layer.rect; p.drawImage(layer.image, X(left) - x, Y(top) - y, (right - left) * cam.s, (bottom - top) * cam.s); }
    // Soft edges: what is kept fades out over the margin, so no patch has a side.
    const soft = Math.min(Math.max(6, soften * cam.s), w / 2 - 1, h / 2 - 1), mask = document.createElement('canvas');
    mask.width = patch.width; mask.height = patch.height;
    const m = mask.getContext('2d')!;
    m.setTransform(dpr, 0, 0, dpr, 0, 0);
    // One gradient across the whole patch, times one down it: each a smooth ramp in from the edge. (Pieced
    // together from a middle, four sides and four corners, the mask had a hairline seam wherever two
    // pieces met on a fraction of a pixel, and the seams showed as lines in the lit grass.)
    const ramp = (length: number, x1: number, y1: number) => {
      const gradient = m.createLinearGradient(0, 0, x1, y1), share = soft / length;
      for (const [t, alpha] of [[0, 0], [0.25, 0.156], [0.5, 0.5], [0.75, 0.844], [1, 1]]) { gradient.addColorStop(share * t, `rgb(0 0 0 / ${alpha})`); gradient.addColorStop(1 - share * t, `rgb(0 0 0 / ${alpha})`); }
      return gradient;
    };
    m.fillStyle = ramp(w, w, 0);
    m.fillRect(0, 0, w, h);
    m.globalCompositeOperation = 'destination-in';
    m.fillStyle = ramp(h, 0, h);
    m.fillRect(0, 0, w, h);
    // A light is one room's: every other opening its pool reaches is cut out of it, lining and all, so a
    // window is dark until its own turn comes. The cut is on the lining's outer edge, where the picture
    // has an edge of its own.
    m.globalCompositeOperation = 'destination-out';
    m.fillStyle = '#000';
    for (const other of LIT) {
      if (other === index) continue;
      const q = HOUSE.openings[other];
      m.fillRect(X(q.x - 2) - x, Y(q.y - 2) - y, (q.w + 4) * cam.s, (q.h + 4) * cam.s);
    }
    p.setTransform(1, 0, 0, 1, 0, 0);
    p.globalCompositeOperation = 'destination-in';
    p.drawImage(mask, 0, 0);
    return { canvas: patch, x, y, w, h };
  };

  const draw = (view: View) => {
    const { width, height, datum, dpr } = layout;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    boxes.length = 0;
    paper = mix(DAY.paper, NIGHT.paper, view.night);
    const all = { x: 0, y: 0, w: width, h: height };
    const bays = [view.bay0, view.bay1, view.bay2, view.bay3, view.bay4, view.bay5, view.bay6, view.bay7];

    // ---------- The long house, from the bare site to its first evening ----------
    if (view.open > 0 && view.enter < 1) {
      const cam = camera(view);
      const built = Math.min(...bays), started = Math.max(...bays);
      if (view.settle < 1) {
        if (built < 1) {
          const window = fromDatum(view.open);
          picture('site', cam, window);
          if (view.veil > 0) {
            // Tracing paper: the photograph shows through it, faintly, and the house is drawn on top.
            const edge = snap(width * view.veil);
            ctx.fillStyle = rgb(paper, 0.86);
            ctx.fillRect(window.x, window.y, Math.min(edge, window.w), window.h);
            if (view.veil < 1) { ctx.fillStyle = rgb(DAY.ink, 0.22); ctx.fillRect(edge - 1, window.y, 1, window.h); }
          }
        }
        if (started > 0) {
          const edges = strips();
          for (let index = 0; index < STRIPS; index++) if (bays[index] > 0 && edges[index + 1] > edges[index]) picture('build', cam, fromDatum(bays[index], edges[index], edges[index + 1]));
        }
      }
      if (view.settle > 0 && view.dusk < 1) picture('house', cam, view.settle < 1 ? { x: 0, y: 0, w: width, h: snap(height * view.settle) } : all);
      if (view.dusk > 0) {
        const lit = LIT.map(index => view[`lit${index}` as Key]);
        if (view.glow < 1) picture('duskoff', cam, all, view.dusk);
        if (view.glow < 1) {
          // One patch is cut in each frame while dusk falls. Should a light be on with patches still to cut
          // (the page was put here at once), they are all cut now.
          const on = Math.max(...lit) > 0, list = lightPatches(cam, on ? LIT.length : 1);
          if (list && on) list.forEach((patch, index) => { if (!patch || lit[index] <= 0) return; ctx.globalAlpha = lit[index]; ctx.drawImage(patch.canvas, patch.x, patch.y, patch.w, patch.h); ctx.globalAlpha = 1; });
        }
        if (view.glow > 0) picture('dusk', cam, all, view.glow);
      }
    }

    // ---------- Inside: through the tall opening, and up a floor ----------
    if (view.enter > 0 && view.leave < 1) {
      const cam = camera(view), glass = TALL.glass!;
      const X = (mx: number) => width / 2 + (mx - cam.fx) * cam.s, Y = (my: number) => datum + (my - HOUSE.ground) * cam.s;
      // The window the room is seen through grows from the opening's own glass to the whole plate.
      const from = { left: X(glass[0]), top: Y(glass[1]), right: X(glass[0] + glass[2]), bottom: datum };
      const e = view.enter;
      let window: Rect = { x: lerp(from.left, 0, e), y: lerp(from.top, 0, e), w: 0, h: 0 };
      window.w = lerp(from.right, width, e) - window.x; window.h = lerp(from.bottom, height, e) - window.y;
      // Then it closes back into the line.
      if (view.leave > 0) window = { x: 0, y: datum * view.leave, w: width, h: height - datum * view.leave - (height - datum) * view.leave };
      const climb = view.climb;
      if (climb < 1) picture('ground', cover('ground'), { x: window.x, y: Math.max(window.y, snap(height * climb)), w: window.w, h: window.y + window.h - Math.max(window.y, snap(height * climb)) }, 1, 0, height * climb);
      if (climb > 0) picture('first', cover('first'), { x: window.x, y: window.y, w: window.w, h: Math.min(window.h, snap(height * climb) - window.y) }, 1, 0, -height * (1 - climb));
    }

    // ---------- Other work: along the line ----------
    if (view.street > -1 && view.street < 3) {
      const pitch = width * 1.1;
      WORK.forEach((id, index) => {
        const shift = (index - view.street) * pitch;
        if (shift > width || shift < -width) return;
        picture(id, workCamera(id), { x: shift, y: 0, w: width, h: height }, 1, shift);
      });
    }

    // ---------- Materials: three samples on the line, each opening to the whole plate ----------
    const samples = [view.sample0, view.sample1, view.sample2], opened = [view.mat0, view.mat1, view.mat2];
    if (Math.max(...samples) > 0 && view.shut < 1) {
      const places = sampleBoxes();
      const shutTo = (window: Rect): Rect => (view.shut > 0 ? { x: window.x, y: Math.max(window.y, datum * view.shut), w: window.w, h: Math.min(window.y + window.h, height - (height - datum) * view.shut) - Math.max(window.y, datum * view.shut) } : window);
      // The opened ones first, in their order, each over the one before.
      MATERIAL.forEach((id, index) => {
        if (opened[index] <= 0) return;
        if (opened[index + 1] >= 1) return;
        const from = places[index], t = opened[index];
        picture(id, cover(id), shutTo({ x: lerp(from.x, 0, t), y: lerp(from.y, 0, t), w: lerp(from.w, width, t), h: lerp(from.h, height, t) }));
      });
      // Then the samples still waiting, standing in front on the line, each with a hairline round it.
      MATERIAL.forEach((id, index) => {
        if (opened[index] > 0 || samples[index] <= 0) return;
        const box = places[index], r = samples[index];
        // It comes up out of the line: its top rises and its foot goes down from it.
        const window = { x: box.x, y: datum - (datum - box.y) * r, w: box.w, h: (datum - box.y) * r + (box.y + box.h - datum) * r };
        picture(id, cover(id), window);
        ctx.strokeStyle = rgb(mix(DAY.ink, NIGHT.ink, inkTurn(view.night)), 0.28);
        ctx.lineWidth = 1;
        ctx.strokeRect(snap(window.x) + 0.5, snap(window.y) + 0.5, Math.max(0, snap(window.w) - 1), Math.max(0, snap(window.h) - 1));
      });
    }
  };
  /** The camera on one of the other buildings: it in the middle, unless that would leave the photograph short of a side it could reach. */
  const workCamera = (id: PictureId): Camera => {
    const s = works.get(id)!.s, half = layout.width / (2 * s);
    return { s, fx: half * 2 >= HOUSE.size[0] ? HOUSE.size[0] / 2 : Math.min(Math.max(PICTURES[id].focus, half), HOUSE.size[0] - half) };
  };
  /**
   * Where the three samples stand: squares through the line, most of each above it. The row keeps clear of
   * what hangs from the datum's end (its level), and of as much at the other end, so no sample stands under it.
   */
  const sampleBoxes = (): Rect[] => {
    const { width, datum, height, edge, keep } = layout;
    const gap = Math.max(10, width * 0.014);
    // As large as the plate allows on every side, and no fixed size: on a large screen a sample of a
    // fixed size is a postage stamp.
    const size = Math.min(datum * 0.56, (height - datum) / 0.22, (width - 2 * Math.max(edge, keep) - 2 * gap) / 3, height * 0.46);
    const total = size * 3 + gap * 2, left = (width - total) / 2;
    return [0, 1, 2].map(index => ({ x: snap(left + index * (size + gap)), y: snap(datum - size * 0.78), w: snap(size), h: snap(size) }));
  };
  const strips = (): number[] => {
    const { width } = layout;
    const X = (mx: number) => width / 2 + (mx - overview.fx) * overview.s;
    return [0, ...GRID.map(line => Math.min(width, Math.max(0, snap(X(line))))), width];
  };

  return {
    resize(next) {
      layout = next;
      canvas.width = Math.max(1, Math.round(next.width * next.dpr));
      canvas.height = Math.max(1, Math.round(next.height * next.dpr));
      frame();
      choose();
    },
    draw,
    want,
    camera,
    get overview() { return overview; },
    get closeUp() { return closeUp; },
    project: (mx, my) => ({ x: layout.width / 2 + (mx - overview.fx) * overview.s, y: layout.datum + (my - HOUSE.ground) * overview.s }),
    ratios() {
      const of = (cam: Camera) => niceScale(PX_PER_METRE / (cam.s * HOUSE.perMetre));
      return { overview: of(overview), close: of(closeUp), coast: works.get('coast')!.ratio, studio: works.get('studio')!.ratio, pavilion: works.get('pavilion')!.ratio };
    },
    boxes,
    ready: id => !!layersOf(id),
    strips,
    edges(view) {
      const { width, height, datum } = layout;
      const cam = camera(view), X = (mx: number) => width / 2 + (mx - cam.fx) * cam.s, Y = (my: number) => datum + (my - HOUSE.ground) * cam.s;
      const bays = [view.bay0, view.bay1, view.bay2, view.bay3, view.bay4, view.bay5, view.bay6, view.bay7];
      const glass = TALL.glass!, e = view.enter, places = sampleBoxes();
      const opened = [view.mat0, view.mat1, view.mat2], samples = [view.sample0, view.sample1, view.sample2];
      return [
        datum * (1 - view.open), datum + (height - datum) * view.open, width * view.veil,
        ...bays.map(up => datum * (1 - up)), height * view.settle,
        // The camera on the house: its two ends and its ridge.
        X(HOUSE.left), X(HOUSE.right), Y(HOUSE.ridge),
        // The window into the room, the floor going by, and the room closing.
        lerp(X(glass[0]), 0, e), lerp(Y(glass[1]), 0, e), lerp(X(glass[0] + glass[2]), width, e), lerp(datum, height, e), height * view.climb, datum * view.leave, height - (height - datum) * view.leave,
        ...samples.map((up, index) => datum - (datum - places[index].y) * up),
        ...opened.flatMap((t, index) => { const from = places[index]; return [lerp(from.x, 0, t), lerp(from.y, 0, t), lerp(from.x + from.w, width, t), lerp(from.y + from.h, height, t)]; }),
        datum * view.shut, height - (height - datum) * view.shut,
        -view.street * width * 1.1,
      ];
    },
    subjects(view) {
      const { width, height, datum } = layout, out: Box[] = [];
      const add = (id: string, left: number, top: number, right: number, bottom: number) => { const box = { id, left: Math.max(0, left), top: Math.max(0, top), right: Math.min(width, right), bottom: Math.min(height, bottom) }; if (box.right - box.left > 1 && box.bottom - box.top > 1) out.push(box); };
      if (view.street > -1 && view.street < 3) {
        WORK.forEach((id, index) => {
          const cam = workCamera(id), shift = (index - view.street) * width * 1.1, meta = PICTURES[id];
          add(id, width / 2 + shift + (meta.span![0] - cam.fx) * cam.s, datum + (meta.top! - meta.level) * cam.s, width / 2 + shift + (meta.span![1] - cam.fx) * cam.s, datum);
        });
        return out;
      }
      const samples = [view.sample0, view.sample1, view.sample2], opened = [view.mat0, view.mat1, view.mat2];
      if (Math.max(...samples) > 0 && view.shut < 1) {
        sampleBoxes().forEach((box, index) => { if (opened[index] <= 0 && samples[index] > 0) add(MATERIAL[index], box.x, box.y, box.x + box.w, box.y + box.h); });
        return out;
      }
      if (view.open > 0 && view.enter <= 0) {
        const cam = camera(view);
        add('house', width / 2 + (HOUSE.left - cam.fx) * cam.s, datum + (HOUSE.ridge - HOUSE.ground) * cam.s, width / 2 + (HOUSE.right - cam.fx) * cam.s, datum);
      }
      return out;
    },
    destroy() {
      alive = false;
      for (const entry of entries.values()) entry.bitmap?.close();
      entries.clear();
      patches.clear();
    },
  };
}
