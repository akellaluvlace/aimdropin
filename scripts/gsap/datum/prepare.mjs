// Makes everything the Datum page serves from the masters: node scripts/gsap/datum/prepare.mjs [only=id,id]
// - the web copies of every picture, in public/assets/gsap/datum (a few sizes each, and for the long house a
//   close piece at full size, for phones);
// - components/gsap/datum/survey.ts: the long house as measured (house.json), every
//   picture's level (the row of it that stands on the datum) and which file shows which part of it.
// The masters are in .cache/gsap/datum-masters (not in git). Run measure.mjs and register.mjs first: this uses
// house.json and the registered copies they leave. Nothing here talks to fal or costs anything.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { assets, here, masters, root } from './paths.mjs';

const only = process.argv.find(arg => arg.startsWith('only='))?.slice(5).split(',');
const house = JSON.parse(fs.readFileSync(path.join(here, 'house.json'), 'utf8'));
const [W, H] = house.size;
const round = (value, places = 1) => Math.round(value * 10 ** places) / 10 ** places;

// The long house is 24 m long: that fixes how many pixels of its photograph a metre is, and every other
// figure on the page follows from it.
const LENGTH = 24;
const perMetre = (house.right - house.left) / LENGTH;
const centre = (house.left + house.right) / 2;
// Where a phone stands when it has walked up to the house: between the tall opening and the door.
const tall = house.openings.find(o => o.kind === 'glazed'), door = house.openings.find(o => o.kind === 'door');
const close = Math.round((tall.x + door.x + door.w) / 2);

/**
 * Every picture. `level` is the row that stands on the datum; `focus` the column that stands in the middle
 * of the plate; `rows` what is kept of the master's height; `sky` says the top of the picture is open sky,
 * which runs out into the sheet. `sizes` are widths of the whole picture; `piece` is a part of it kept at a
 * size of its own: [left, top, right, bottom, width].
 */
const SEQUENCE = { dir: 'seq', level: house.ground, focus: centre, rows: [0, 1800], sky: true, sizes: { l: 2880, m: 2160, s: 1440 } };
// The piece a phone draws the house from once it has walked up to it, at the photograph's own size. From
// where a phone stands it never sees further than the nearer end of the house and as far the other way
// (plate.ts walks up until both ends are off the plate), so the piece is that wide, and a little more.
const reach = Math.ceil(Math.min(close - house.left, house.right - close) / 10) * 10 + 20;
const CLOSE = { c: [close - reach, 560, Math.min(W, close + reach), 1560, Math.min(W, close + reach) - (close - reach)] };
const PICTURES = [
  { id: 'site', from: 'site.png', ...SEQUENCE },
  { id: 'build', from: 'build-a-reg.png', ...SEQUENCE },
  { id: 'house', from: house.master, ...SEQUENCE, pieces: CLOSE },
  { id: 'duskoff', from: 'dusk-off-reg.png', ...SEQUENCE, pieces: CLOSE, quality: 88 },
  { id: 'dusk', from: 'dusk-reg.png', ...SEQUENCE, pieces: CLOSE, quality: 88 },
  // Inside: the floor is the level. A phone is given the middle of each, at a larger size.
  { id: 'ground', from: 'in-ground.png', dir: 'in', level: 1542, focus: 1440, rows: [0, 1920], sizes: { l: 2880, m: 2160 }, pieces: { s: [540, 0, 2340, 1920, 1440] } },
  { id: 'first', from: 'in-first.png', dir: 'in', level: 1624, focus: 1750, rows: [0, 1920], sizes: { l: 2880, m: 2160 }, pieces: { s: [850, 0, 2650, 1920, 1440] } },
  // Materials: a course of slate, the joint of lime and oak, the top of a sill.
  { id: 'slate', from: 'mat-slate.png', dir: 'mat', level: 1454, focus: 1440, rows: [0, 1920], sizes: { l: 2880, m: 2160 }, pieces: { s: [540, 0, 2340, 1920, 1440] } },
  { id: 'lime', from: 'mat-lime.png', dir: 'mat', level: 1581, focus: 1440, rows: [0, 1920], sizes: { l: 2880, m: 2160 }, pieces: { s: [540, 0, 2340, 1920, 1440] } },
  { id: 'oak', from: 'mat-oak.png', dir: 'mat', level: 1384, focus: 1240, rows: [0, 1920], sizes: { l: 2880, m: 2160 }, pieces: { s: [340, 0, 2140, 1920, 1440] } },
  // Other work: each stands on its own ground line. `span` is the building, end to end, `length` what that is
  // in metres, and `top` the row of its highest point.
  { id: 'coast', from: 'x-house-coast.png', dir: 'work', level: 1315, focus: 1441, rows: [0, 1800], sky: true, sizes: { l: 2880, m: 2160, s: 1440 }, span: [230, 2653], length: 28, top: 922 },
  { id: 'studio', from: 'x-studio-water.png', dir: 'work', level: 1375, focus: 1379, rows: [0, 1920], sky: true, sizes: { l: 2880, m: 2160, s: 1440 }, span: [468, 2290], length: 14, top: 612 },
  { id: 'pavilion', from: 'x-pavilion-wood.png', dir: 'work', level: 1488, focus: 1441, rows: [0, 1800], sky: true, sizes: { l: 2880, m: 2160, s: 1440 }, span: [148, 2735], length: 30, top: 1095 },
];

const written = [];
const save = async (image, file, quality) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const info = await image.webp({ quality, effort: 6, smartSubsample: true }).toFile(file);
  written.push([path.relative(assets, file), info.width, info.height, info.size]);
  return info;
};
const survey = {};
for (const picture of PICTURES) {
  const source = path.join(masters, picture.from);
  const [top, bottom] = picture.rows;
  const files = {};
  const skip = only && !only.includes(picture.id);
  if (!skip && !fs.existsSync(source)) throw new Error(`${picture.from} is not in .cache/gsap/datum-masters`);
  for (const [size, width] of Object.entries(picture.sizes)) {
    const file = path.join(assets, picture.dir, `${picture.id}-${size}.webp`);
    if (!skip) await save(sharp(source).extract({ left: 0, top, width: W, height: bottom - top }).resize({ width, kernel: 'lanczos3' }), file, picture.quality ?? 84);
    files[size] = [0, top, W, bottom];
  }
  for (const [size, [left, pieceTop, right, pieceBottom, width]] of Object.entries(picture.pieces ?? {})) {
    const file = path.join(assets, picture.dir, `${picture.id}-${size}.webp`);
    if (!skip) await save(sharp(source).extract({ left, top: pieceTop, width: right - left, height: pieceBottom - pieceTop }).resize({ width, kernel: 'lanczos3' }), file, picture.quality ?? 84);
    files[size] = [left, pieceTop, right, pieceBottom];
  }
  survey[picture.id] = { dir: picture.dir, level: picture.level, focus: Math.round(picture.focus), sky: !!picture.sky, files, ...(picture.span ? { span: picture.span, length: picture.length, top: picture.top } : {}) };
}
// Without JavaScript the page shows one photograph: the finished house, as the wide stage frames it.
if (!only || only.includes('poster')) await save(sharp(path.join(masters, house.master)).extract({ left: 0, top: 380, width: W, height: 1150 }).resize({ width: 1920 }), path.join(assets, 'poster.webp'), 82);

// ---------- survey.ts ----------
const metres = px => px / perMetre;
const figures = {
  /** Millimetres, to the nearest 5. */
  length: LENGTH * 1000,
  eaves: Math.round((metres(house.ground - house.eaves) * 1000) / 5) * 5,
  ridge: Math.round((metres(house.ground - house.ridge) * 1000) / 5) * 5,
  bays: 6,
};
const openings = house.openings.map(o => ({ kind: o.kind, x: o.x, y: o.y, w: o.w, h: o.h, ...(o.glass ? { glass: [o.glass.x, o.glass.y, o.glass.w, o.glass.h] } : {}) }));
const source = `// Generated by scripts/gsap/datum/prepare.mjs from scripts/gsap/datum/house.json. Do not edit by hand: measure again
// (scripts/gsap/datum/measure.mjs) and run prepare.mjs. Everything is in pixels of the master photographs.

/** An opening in the long house's wall: the hole, and for a window its glass ([x, y, width, height]). */
export interface Opening { kind: 'window' | 'glazed' | 'door'; x: number; y: number; w: number; h: number; glass?: readonly [number, number, number, number] }

/** The long house, as measured from its photograph: the page's drawing and its figures are made from this. */
export const HOUSE: { size: readonly [number, number]; ground: number; eaves: number; ridge: number; left: number; right: number; roof: readonly (readonly [number, number])[]; perMetre: number; close: number; openings: readonly Opening[] } = {
  size: [${W}, ${H}],
  /** The ground line: the row that stands on the datum. */
  ground: ${house.ground},
  eaves: ${house.eaves},
  ridge: ${house.ridge},
  left: ${house.left},
  right: ${house.right},
  /** The roof's corners: eaves left, ridge left, ridge right, eaves right. */
  roof: ${JSON.stringify(house.roof)},
  /** Pixels of the photograph to a metre of the house: it is ${LENGTH} m long. */
  perMetre: ${round(perMetre, 3)},
  /** Where a phone stands once it has walked up to the house. */
  close: ${close},
  openings: ${JSON.stringify(openings)},
};

/** The same, in millimetres, as the dimensions on the page give them. They follow from the photograph and the length. */
export const FIGURES = ${JSON.stringify(figures)} as const;

export type PictureId = ${PICTURES.map(p => `'${p.id}'`).join(' | ')};
export type FileSize = 'l' | 'm' | 's' | 'c';
/**
 * Every picture: the row that stands on the datum (level), the column that stands in the middle of the plate
 * (focus), whether its top is open sky, and which part of it each file holds ([left, top, right, bottom]).
 */
export const PICTURES: Record<PictureId, { dir: string; level: number; focus: number; sky: boolean; files: Partial<Record<FileSize, readonly [number, number, number, number]>>; span?: readonly [number, number]; length?: number; top?: number }> = ${JSON.stringify(survey, null, 1)};
`;
fs.writeFileSync(path.join(root, 'components/gsap/datum/survey.ts'), source);

for (const [file, width, height, size] of written) console.log(`${file.padEnd(26)} ${String(width).padStart(4)} x ${String(height).padEnd(4)} ${String(Math.round(size / 1024)).padStart(5)} KB`);
console.log(`${written.length} files, ${(written.reduce((sum, entry) => sum + entry[3], 0) / 1048576).toFixed(1)} MB; wrote survey.ts`);
console.log(`a metre is ${round(perMetre, 2)} px; eaves ${figures.eaves} mm, ridge ${figures.ridge} mm above the datum`);
