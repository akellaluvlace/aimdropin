// Turns the Sum watch's photographed parts (.cache/gsap/sum-masters) into what the demo serves and builds from:
// textures in public/assets/gsap/sum/parts, and the parts' real sizes and outlines in
// components/gsap/sum/watch-parts.ts. Read-only on the masters. No API calls.
//
//   node scripts/gsap/sum/prepare.mjs [only=case,dial,bars,calibre,rotor,caseback,bracelet,worn,poster]
//
// Every part was photographed from straight above, so a part is its photograph plus a thickness: the
// outline of its alpha becomes its side wall. All sizes are in millimetres of a 39 mm watch; +x is
// 3 o'clock, +y is 12 o'clock, +z is toward the crystal. The numbers under MEASURED come from
// measure.mjs and ring.mjs (run them again if a master is replaced). The hands are not photographs:
// they are drawn (gl/hands.ts), and only the poster needs them here.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { assets, masters, root } from './paths.mjs';
import { area, bleed, clone, disc, erase, load, maskRadial, relax, resized, saveWebp, simplify, square, trace } from './lib.mjs';
import { fitCircle } from './measure-lib.mjs';

const only = (process.argv.find(arg => arg.startsWith('only=')) ?? '').slice(5).split(',').filter(Boolean);
const wanted = name => !only.length || only.includes(name);
const out = path.join(assets, 'parts');
fs.mkdirSync(out, { recursive: true });
const master = name => path.join(masters, name);

// ---------- MEASURED (pixels of each 2880 px master) ----------
// `plain` is a radius of bare dial between the hour markers and the minute track: what the dial is carried out with.
const HEAD = { file: 'head-4k.png', cx: 1401.0, cy: 1459.5, r: 1203.6, hole: 1090, dialEdge: 1036, plain: 958 };
const BACK = { file: 'back-edit.png', cx: 1408.0, cy: 1461.0, r: 1199.7, seam: 1152, window: 752 };
const CALIBRE_FRONT = { file: 'calibre-front.png', cx: 1399.8, cy: 1446.2, r: 1408.2 };
const CALIBRE_BACK = { file: 'calibre-back-4k.png', cx: 1426.8, cy: 1460.9, r: 1420.5 };
const ROTOR = { file: 'rotor-tpl.png', cx: 1429.9, cy: 1462.4, r: 1240.5 };

// ---------- The watch, in millimetres ----------
const CASE_R = 19.5;                      // a 39 mm case
const mm = { head: HEAD.r / CASE_R, back: BACK.r / CASE_R };
const HOLE_R = HEAD.hole / mm.head;       // the bezel's inner edge: where the crystal and the dial sit
const CALIBRE_R = 14.8, ROTOR_R = 13.5;
const SEAM_R = BACK.seam / mm.back, WINDOW_R = BACK.window / mm.back;
const half = { case: 24, dial: 17.8, calibre: 15.6, rotor: 13.9, caseback: 18.9 };
const SIZES = { l: 2048, s: 1024 };
const round = value => Math.round(value * 100) / 100;

/** Loops traced from a square texture's alpha, in millimetres, y up: solid areas counter-clockwise, holes clockwise. */
function outlines(image, halfMm, { tolerance = 0.05, minArea = 0.6, level = 128 } = {}) {
  const scale = (2 * halfMm) / image.width;
  return trace(image, level)
    .map(loop => relax(loop, 0.3).map(([x, y]) => [(x - image.width / 2) * scale, (image.height / 2 - y) * scale]))
    .map(loop => simplify(loop, tolerance))
    .filter(loop => loop.length >= 4 && Math.abs(area(loop)) > minArea)
    .sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)))
    .map(loop => loop.flatMap(([x, y]) => [round(x), round(y)]));
}
/** The same for a texture that is not square: `halfX`, `halfY` are what it spans. */
function outlinesRect(image, halfX, halfY, options = {}) {
  const sx = (2 * halfX) / image.width, sy = (2 * halfY) / image.height;
  const { tolerance = 0.05, minArea = 0.4 } = options;
  return trace(image, 128)
    .map(loop => relax(loop, 0.3).map(([x, y]) => [(x - image.width / 2) * sx, (image.height / 2 - y) * sy]))
    .map(loop => simplify(loop, tolerance))
    .filter(loop => loop.length >= 4 && Math.abs(area(loop)) > minArea)
    .sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)))
    .map(loop => loop.flatMap(([x, y]) => [round(x), round(y)]));
}
const save = async (image, name, sizes = SIZES) => {
  const written = {};
  for (const [tag, size] of Object.entries(sizes)) {
    const scaled = image.width === size ? image : await resized(image, size);
    const file = `${name}-${tag}.webp`;
    await saveWebp(bleed(clone(scaled), 4), path.join(out, file));
    written[tag] = `${file} ${scaled.width}x${scaled.height} ${Math.round(fs.statSync(path.join(out, file)).size / 1024)}KB`;
  }
  console.log(`${name}: ${Object.values(written).join(', ')}`);
};

const parts = {};
const WORK = 2048; // every square part is worked on at this size

// The spring bars between the lugs: found, cut out as parts of their own, and cleared from the case.
// Left in the case's photograph they would stand at the height of the bezel, across thin air.
function springBars(image, halfMm) {
  const { data, width, height } = image;
  const perMm = width / (2 * halfMm), c = width / 2;
  const alphaAt = (x, y) => data[(y * width + x) * 4 + 3];
  const found = [];
  for (const side of [-1, 1]) {
    // The first row beyond the case that only the two lugs cross: in the slot between the case and the bar.
    let runs = [], row = 0;
    for (let beyondMm = 0.15; beyondMm < 1.2 && runs.length !== 2; beyondMm += 0.05) {
      row = Math.round(c + side * (CASE_R + beyondMm) * perMm);
      runs = []; let start = -1;
      for (let x = 0; x < width; x++) { const solid = alphaAt(x, row) > 127; if (solid && start < 0) start = x; if (!solid && start >= 0) { runs.push([start, x - 1]); start = -1; } }
    }
    if (runs.length !== 2) throw new Error(`Lugs not found near row ${row} (${runs.length} runs)`);
    const gapFrom = runs[0][1] + 2, gapTo = runs[runs.length - 1][0] - 2;
    // Outward from that row along the middle of the gap, the first solid run is the bar's thickness.
    let y = row, y0 = -1, y1 = -1;
    const middle = Math.round((gapFrom + gapTo) / 2);
    for (let guard = 0; guard < height && y > 0 && y < height - 1; guard++, y += side) {
      const solid = alphaAt(middle, y) > 40;
      if (solid && y0 < 0) y0 = y;
      if (solid) y1 = y;
      if (!solid && y0 >= 0) break;
    }
    if (y0 < 0) throw new Error('Spring bar not found');
    found.push({ side, gapFrom, gapTo, x0: gapFrom, x1: gapTo, y0: Math.min(y0, y1), y1: Math.max(y0, y1), perMm, c });
  }
  return found;
}

// ---------- Case: the head from the front (top face) and from behind (bottom face) ----------
if (wanted('case') || wanted('dial') || wanted('bars')) {
  const per = WORK / (2 * half.case);
  const head = await square(master(HEAD.file), HEAD.cx, HEAD.cy, half.case * mm.head, WORK);
  const bars = springBars(head, half.case);
  if (wanted('bars')) {
    parts.bars = [];
    for (const [index, bar] of bars.entries()) {
      const pad = 2, w = bar.x1 - bar.x0 + 1, h = bar.y1 - bar.y0 + 1 + pad * 2;
      const cut = { data: Buffer.alloc(w * h * 4), width: w, height: h };
      for (let y = 0; y < h; y++) head.data.copy(cut.data, y * w * 4, ((bar.y0 - pad + y) * WORK + bar.x0) * 4, ((bar.y0 - pad + y) * WORK + bar.x0 + w) * 4);
      const name = `bar-${index ? 'b' : 'a'}`;
      await saveWebp(bleed(clone(cut), 3), path.join(out, `${name}.webp`));
      parts.bars.push({ texture: name, x: round(((bar.x0 + bar.x1 + 1) / 2 - WORK / 2) / per), y: round((WORK / 2 - (bar.y0 + bar.y1 + 1) / 2) / per), halfX: round(w / 2 / per), halfY: round(h / 2 / per) });
    }
    console.log('bars:', JSON.stringify(parts.bars));
  }
  // Clear the bars from the case (and a little round them: their soft edges).
  const cleared = clone(head);
  for (const bar of bars) erase(cleared, bar.gapFrom, bar.y0 - 6, bar.gapTo + 1, bar.y1 + 7);
  if (wanted('case')) {
    const outer = outlines(cleared, half.case, { tolerance: 0.02, minArea: 20 }).slice(0, 1);
    const top = maskRadial(clone(cleared), WORK / 2, WORK / 2, disc(HOLE_R * per, false));
    await save(top, 'case-top');
    // From behind: the same watch, turned over. Its outline is the front's, mirrored, so the walls meet both faces.
    const backPer = WORK / (2 * half.case);
    const back = await square(master(BACK.file), BACK.cx, BACK.cy, half.case * mm.back, WORK);
    const backBars = springBars(back, half.case);
    for (const bar of backBars) erase(back, bar.gapFrom, bar.y0 - 6, bar.gapTo + 1, bar.y1 + 7);
    // Keep the ring outside the caseback; carry its steel inward to the bore, where the caseback covers it.
    const seam = SEAM_R * backPer, bore = HOLE_R * backPer;
    for (let y = 0; y < WORK; y++) for (let x = 0; x < WORK; x++) {
      const dx = x + 0.5 - WORK / 2, dy = y + 0.5 - WORK / 2, d = Math.hypot(dx, dy);
      if (d >= seam + 3 || d < bore - 2) continue;
      const k = (seam + 6) / d, sx = Math.round(WORK / 2 + dx * k - 0.5), sy = Math.round(WORK / 2 + dy * k - 0.5);
      back.data.copy(back.data, (y * WORK + x) * 4, (sy * WORK + sx) * 4, (sy * WORK + sx) * 4 + 4);
    }
    maskRadial(back, WORK / 2, WORK / 2, disc(bore, false));
    await save(back, 'case-bottom', { l: 1536, s: 768 });
    parts.case = { half: half.case, outer, hole: round(HOLE_R) };
    console.log(`case: outline ${outer[0].length / 2} points; bezel opening ${HOLE_R.toFixed(2)} mm`);
  }
  // ---------- Dial: everything inside the bezel, carried out to the bore under the crystal's rim ----------
  // Three faces: the head as photographed, and two where only the dial's colour was changed (an edit of the
  // same photograph, so every marker is where it was: checked with measure.mjs, within two pixels).
  if (wanted('dial')) for (const [face, file] of [['silver', HEAD.file], ['salmon', 'head-salmon.png'], ['ink', 'head-ink.png']]) {
    const perDial = WORK / (2 * half.dial);
    const dial = await square(master(file), HEAD.cx, HEAD.cy, half.dial * mm.head, WORK);
    const edge = (HEAD.dialEdge / mm.head) * perDial, bore = HOLE_R * perDial, plain = (HEAD.plain / mm.head) * perDial;
    for (let y = 0; y < WORK; y++) for (let x = 0; x < WORK; x++) {
      const dx = x + 0.5 - WORK / 2, dy = y + 0.5 - WORK / 2, d = Math.hypot(dx, dy);
      if (d <= edge - 2 || d > bore + 3) continue;
      // From the bare ring inside the minute track, on the same direction: the sunray carries on, the ticks do not smear.
      const k = plain / d, sx = Math.round(WORK / 2 + dx * k - 0.5), sy = Math.round(WORK / 2 + dy * k - 0.5);
      const blend = Math.max(0, Math.min(1, (d - (edge - 2)) / 5));
      for (let ch = 0; ch < 3; ch++) dial.data[(y * WORK + x) * 4 + ch] = Math.round(dial.data[(y * WORK + x) * 4 + ch] * (1 - blend) + dial.data[(sy * WORK + sx) * 4 + ch] * blend);
      dial.data[(y * WORK + x) * 4 + 3] = 255;
    }
    maskRadial(dial, WORK / 2, WORK / 2, disc(bore));
    await save(dial, `dial-${face}`);
    parts.dial = { half: half.dial, r: round(HOLE_R), track: round(HEAD.dialEdge / mm.head) };
  }
}

// ---------- Calibre: dial side up (top), bridges underneath (bottom) ----------
if (wanted('calibre')) {
  const front = await square(master(CALIBRE_FRONT.file), CALIBRE_FRONT.cx, CALIBRE_FRONT.cy, half.calibre * (CALIBRE_FRONT.r / CALIBRE_R), WORK);
  await save(front, 'calibre-top');
  const back = await square(master(CALIBRE_BACK.file), CALIBRE_BACK.cx, CALIBRE_BACK.cy, half.calibre * (CALIBRE_BACK.r / CALIBRE_R), WORK);
  await save(back, 'calibre-bottom');
  parts.calibre = { half: half.calibre, r: CALIBRE_R };
}

// ---------- Rotor ----------
if (wanted('rotor')) {
  const rotor = await square(master(ROTOR.file), ROTOR.cx, ROTOR.cy, half.rotor * (ROTOR.r / ROTOR_R), WORK);
  await save(rotor, 'rotor', { l: 1536, s: 768 });
  const loops = outlines(rotor, half.rotor, { tolerance: 0.02, minArea: 1.2 });
  parts.rotor = { half: half.rotor, r: ROTOR_R, loops };
  console.log(`rotor: ${loops.length} loops (${loops.map(loop => loop.length / 2).join(', ')} points)`);
}

// ---------- Caseback: the disc inside the seam, with its window open ----------
if (wanted('caseback')) {
  const per = WORK / (2 * half.caseback);
  const back = await square(master(BACK.file), BACK.cx, BACK.cy, half.caseback * mm.back, WORK);
  maskRadial(back, WORK / 2, WORK / 2, d => disc(SEAM_R * per)(d) * disc(WINDOW_R * per, false)(d));
  await save(back, 'caseback');
  parts.caseback = { half: half.caseback, r: round(SEAM_R), window: round(WINDOW_R) };
}

// ---------- Bracelet: two lengths of steel links, each from its end link (y = 0) outward ----------
// A bracelet's end link is cut to the case it meets. The photographs come close to this case; here each
// is eased onto the case's real edge between its lugs (a few tenths of a millimetre, taken up over the
// link's first millimetres), so the steel meets all the way across and its polished bevel follows the case.
if (wanted('bracelet') || wanted('poster')) {
  parts.bracelet = {};
  const TUCK = 0.1, EASE = 5; // how far an end link goes in under the case's edge; over how much of its length the fit is taken up (mm)
  const head = await square(master(HEAD.file), HEAD.cx, HEAD.cy, half.case * mm.head, WORK);
  const perHead = WORK / (2 * half.case);
  /** The case's edge between a pair of lugs, as a circle: x across the watch, y outward from its middle (mm). `side` is 1 at 12 o'clock, -1 at 6. */
  const caseArc = side => {
    const points = [];
    for (let x = -8.5; x <= 8.5; x += 0.25) {
      const column = Math.floor(WORK / 2 + x * perHead);
      const alphaAt = k => head.data[((side > 0 ? WORK / 2 - 1 - k : WORK / 2 + k) * WORK + column) * 4 + 3];
      // Outward from inside the bezel to the first clear pixel: the slot between the case and its spring bar.
      for (let k = Math.round(15 * perHead); k < WORK / 2; k++) {
        if (alphaAt(k) >= 128) continue;
        points.push([x, (k - 1 + (alphaAt(k - 1) - 127.5) / Math.max(1, alphaAt(k - 1) - alphaAt(k)) + 0.5) / perHead]);
        break;
      }
    }
    return fitCircle(points);
  };
  for (const [name, file, side] of [['clasp', 'bracelet-clasp.png', 1], ['plain', 'bracelet-plain.png', -1]]) {
    const image = await load(master(file));
    const { data, width, height } = image;
    const alphaAt = (x, y) => data[(y * width + x) * 4 + 3];
    const box = () => { let x0 = width, x1 = 0, y0 = height, y1 = 0; for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (alphaAt(x, y) > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x0, x1, y0, y1 }; };
    const runAt = y => { let a = -1, b = -1; for (let x = 0; x < width; x++) if (alphaAt(x, y) > 127) { if (a < 0) a = x; b = x; } return [a, b]; };
    let { x0, x1, y0, y1 } = box();
    // It is 20 mm across where it meets the lugs: the widest it is near that end.
    let lug = 0, centre = 0;
    for (let y = y0; y < y0 + (y1 - y0) * 0.1; y++) { const [a, b] = runAt(y); if (b - a + 1 > lug) { lug = b - a + 1; centre = (a + b + 1) / 2; } }
    const per = lug / 20;

    // ---------- Fit the end link to the case ----------
    // The photograph's own hollow edge, as a circle (rows down from the top; its corners are left out).
    const edge = [];
    for (let x = Math.round(centre - lug * 0.42); x <= centre + lug * 0.42; x += 2) for (let y = y0; y < y1; y++) if (alphaAt(x, y) > 127) { edge.push([x + 0.5, y - (alphaAt(x, y) - 127.5) / Math.max(1, alphaAt(x, y) - alphaAt(x, y - 1))]); break; }
    const own = fitCircle(edge), arc = caseArc(side);
    // (Hollow: the edge is the lower arc of a circle whose middle is above the photograph.)
    const ownRow = x => own.cy + Math.sqrt(Math.max(0, own.r ** 2 - (x + 0.5 - own.cx) ** 2));
    // Where the case's edge is at `u` mm across the bracelet, mm from the watch's middle. The length at 12 is
    // turned half round on the watch, so its right is the watch's left.
    const caseAt = u => arc.cy + Math.sqrt(arc.r ** 2 - (-side * u - arc.cx) ** 2) - TUCK;
    const middleRow = ownRow(Math.round(centre) - 0.5);
    const fitted = clone(image);
    const span = Math.ceil((EASE + 6) * per);
    let most = 0;
    for (let x = x0; x <= x1; x++) {
      const u = (x + 0.5 - centre) / per;
      // The edge in this column goes from where the photograph has it to where the case is: nothing moves in the middle.
      const shift = middleRow + (caseAt(u) - caseAt(0)) * per - ownRow(x);
      most = Math.max(most, Math.abs(shift) / per);
      const edgeRow = ownRow(x) + shift;
      for (let y = Math.max(1, y0 - 12); y < y0 + span; y++) {
        const t = Math.max(0, Math.min(1, (y - edgeRow) / (EASE * per)));
        const from = y - shift * (1 - t * t * (3 - 2 * t));
        const top = Math.floor(from), k = from - top;
        const o = (y * width + x) * 4;
        if (top < 0 || top + 1 >= height) { fitted.data[o + 3] = 0; continue; }
        // Between two rows of the photograph, weighted by how solid each is.
        const a = (top * width + x) * 4, b = a + width * 4, wa = data[a + 3] * (1 - k), wb = data[b + 3] * k, alpha = wa + wb;
        for (let ch = 0; ch < 3; ch++) fitted.data[o + ch] = alpha > 0 ? Math.round((data[a + ch] * wa + data[b + ch] * wb) / alpha) : data[a + ch];
        fitted.data[o + 3] = Math.round(alpha);
      }
    }
    data.set(fitted.data);
    ({ x0, x1, y0, y1 } = box());
    // How far from the watch's middle its end is: the middle of the hollow edge is on the case.
    let hollow = y0;
    while (alphaAt(Math.round(centre), hollow) <= 127) hollow++;
    const at = caseAt(0) - (hollow - y0) / per;

    // The joints between its outer links, mm from the end: where the seams of its sides are.
    const strip = [];
    for (let y = y0; y <= y1; y++) {
      const [a] = runAt(y);
      let sum = 0, n = 0;
      for (let x = a + Math.round(lug * 0.05); x <= a + Math.round(lug * 0.16); x += 2) if (alphaAt(x, y) > 200) { const i = (y * width + x) * 4; sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; n++; }
      strip.push(n ? sum / n : 255);
    }
    const dark = [...strip].sort((p, q) => p - q)[Math.floor(strip.length / 2)] * 0.6;
    const joints = [];
    for (let i = 2; i < strip.length - 2; i++) if (strip[i] < dark && strip[i] <= strip[i - 1] && strip[i] <= strip[i + 1] && (!joints.length || i - joints[joints.length - 1] > 4 * per) && i < strip.length - 1.5 * per) joints.push(i);

    const halfX = Math.ceil(Math.max(centre - x0, x1 + 1 - centre) / per * 10 + 4) / 10, length = (y1 - y0 + 1) / per;
    // Cut to the piece's own box, centred on the bracelet's middle.
    const w = Math.round(halfX * 2 * per), h = y1 - y0 + 1, left = Math.round(centre - w / 2);
    const cut = { data: Buffer.alloc(w * h * 4), width: w, height: h };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const sx = left + x; if (sx < 0 || sx >= width) continue; data.copy(cut.data, (y * w + x) * 4, ((y0 + y) * width + sx) * 4, ((y0 + y) * width + sx) * 4 + 4); }
    // No wider than the bracelet is ever drawn (about 480 device pixels on a 1440 by 900 screen at 2x; a
    // phone's picture is drawn at 2x at most, and is smaller).
    const large = await resized(cut, Math.min(w, 704)), small = await resized(cut, 400);
    await saveWebp(bleed(clone(large), 4), path.join(out, `bracelet-${name}-l.webp`), 86);
    await saveWebp(bleed(clone(small), 4), path.join(out, `bracelet-${name}-s.webp`), 86);
    const loops = outlinesRect(await resized(cut, 384), halfX, length / 2, { tolerance: 0.05, minArea: 0.5 });
    parts.bracelet[name] = { halfX: round(halfX), length: round(length), at: round(at), joints: joints.map(row => round(row / per)), loops, texture: [large.width, large.height] };
    const kb = tag => Math.round(fs.statSync(path.join(out, `bracelet-${name}-${tag}.webp`)).size / 1024);
    console.log(`bracelet-${name}: ${large.width}x${large.height} ${kb('l')}KB, small ${kb('s')}KB (${per.toFixed(1)} px per mm in the master); ${halfX * 2} x ${length.toFixed(1)} mm, its end ${at.toFixed(2)} mm from the middle; end link eased by up to ${most.toFixed(2)} mm (its own arc ${(own.r / per).toFixed(2)} mm, the case's ${arc.r.toFixed(2)} mm); ${joints.length} joints; ${loops.length} loops (${loops.map(loop => loop.length / 2).join(', ')} points)`);
  }
}

// ---------- Worn: three photographs, each cut wide and tall from one square ----------
if (wanted('worn')) {
  const dir = path.join(assets, 'worn');
  fs.mkdirSync(dir, { recursive: true });
  // Where each crop is centred, as shares of the square: the watch is in both. (The photographs with the
  // bracelet are edits of the first three, which had a leather strap: worn-cuff.png and so on.)
  const shots = [['cuff', 'worn-cuff-steel.png', 0.5, 0.5], ['bench', 'worn-bench-steel.png', 0.5, 0.5], ['rail', 'worn-rail-steel.png', 0.5, 0.56]];
  for (const [name, file, fx, fy] of shots) {
    const { width: W, height: H } = await sharp(master(file)).metadata();
    const wide = { width: W, height: Math.round(W * 9 / 16) }, tall = { width: Math.round(H * 0.47), height: H };
    const top = Math.max(0, Math.min(H - wide.height, Math.round(H * fy - wide.height / 2))), left = Math.max(0, Math.min(W - tall.width, Math.round(W * fx - tall.width / 2)));
    await sharp(master(file)).extract({ left: 0, top, ...wide }).resize({ width: 2400 }).webp({ quality: 80, effort: 6 }).toFile(path.join(dir, `${name}-wide.webp`));
    await sharp(master(file)).extract({ left, top: 0, ...tall }).resize({ height: 2200 }).webp({ quality: 80, effort: 6 }).toFile(path.join(dir, `${name}-tall.webp`));
    console.log(`worn ${name}: wide ${Math.round(fs.statSync(path.join(dir, `${name}-wide.webp`)).size / 1024)}KB, tall ${Math.round(fs.statSync(path.join(dir, `${name}-tall.webp`)).size / 1024)}KB`);
  }
}

// ---------- The poster: the watch whole, for a browser without WebGL and for the bag ----------
if (wanted('poster')) {
  const S = 1100, span = 60, per = S / span, c = S / 2;
  const at = async (file, halfX, halfY, x = 0, y = 0, turn = 0) => {
    const w = Math.round(halfX * 2 * per), h = Math.round(halfY * 2 * per);
    let image = sharp(path.join(out, file)).resize(w, h, { fit: 'fill' });
    if (turn) image = image.rotate(turn);
    const left = Math.round(c + x * per - w / 2), top = Math.round(c - y * per - h / 2);
    // Cut to the canvas: sharp will not composite what hangs over an edge.
    const cut = { left: Math.max(0, -left), top: Math.max(0, -top), width: Math.min(w, S - left) - Math.max(0, -left), height: Math.min(h, S - top) - Math.max(0, -top) };
    return { input: await image.extract(cut).png().toBuffer(), left: Math.max(0, left), top: Math.max(0, top) };
  };
  const { clasp, plain } = parts.bracelet;
  // The hands are the demo's own shapes (gl/hands.ts: TypeScript with no imports, so its types are taken
  // off and it is loaded as it stands), at eight minutes past ten, as watches are photographed.
  const ts = (await import('typescript')).default;
  const source = fs.readFileSync(path.join(root, 'components/gsap/sum/gl/hands.ts'), 'utf8');
  const { HANDS, handOutline } = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}`);
  const outlinePath = points => `${points.map(([x, y], i) => `${i ? 'L' : 'M'}${(c + x * per).toFixed(2)} ${(c - y * per).toFixed(2)}`).join('')}Z`;
  const pairs = loop => loop.reduce((list, value, i) => (i % 2 ? (list[list.length - 1].push(value), list) : (list.push([value]), list)), []);
  const drawn = (name, angle, shadow) => {
    const shape = HANDS[name], points = pairs(handOutline(shape)), turn = `transform="rotate(${angle} ${c} ${c})"`;
    if (shadow) return `<path d="${outlinePath(points)}" ${turn}/>`;
    if (shape.kind === 1) return `<g ${turn}><path d="${outlinePath(points)}" fill="#c91d45"/><circle cx="${c}" cy="${c}" r="${shape.rivet * per}" fill="#d6d9df" stroke="#7b808c" stroke-width="0.6"/></g>`;
    // Two facets: the one that faces the light is the brighter.
    const a = (angle * Math.PI) / 180, lit = -Math.cos(a) - Math.sin(a) > 0 ? 1 : -1;
    const facet = [...points.filter(([x]) => x * lit >= 0), [0, -shape.tail]];
    return `<g ${turn}><path d="${outlinePath(points)}" fill="#111e62"/><path d="${outlinePath(facet)}" fill="#2a4bc2"/><circle cx="${c}" cy="${c}" r="${shape.hub * per}" fill="#2140a9"/></g>`;
  };
  const TIME = [['hour', 304], ['minute', 48], ['second', 200]];
  const hands = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><defs><filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${(0.16 * per).toFixed(2)}"/></filter></defs>
    <g filter="url(#soft)" fill="#0a1020" opacity="0.26" transform="translate(${(0.3 * per).toFixed(2)} ${(0.36 * per).toFixed(2)})">${TIME.map(([name, angle]) => drawn(name, angle, true)).join('')}</g>
    ${TIME.map(([name, angle]) => drawn(name, angle, false)).join('')}</svg>`;
  const layers = [
    await at('bracelet-clasp-l.webp', clasp.halfX, clasp.length / 2, 0, clasp.at + clasp.length / 2, 180),
    await at('bracelet-plain-l.webp', plain.halfX, plain.length / 2, 0, -(plain.at + plain.length / 2)),
    await at('dial-silver-l.webp', half.dial, half.dial),
    await at('case-top-l.webp', half.case, half.case),
    { input: Buffer.from(hands), left: 0, top: 0 },
  ];
  await sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers).webp({ quality: 86, alphaQuality: 90 }).toFile(path.join(assets, 'poster.webp'));
  console.log(`poster: ${Math.round(fs.statSync(path.join(assets, 'poster.webp')).size / 1024)}KB`);
}

// ---------- The module the demo builds the watch from ----------
const moduleFile = path.join(root, 'components/gsap/sum/watch-parts.ts');
if (!only.length) {
  fs.mkdirSync(path.dirname(moduleFile), { recursive: true });
  const body = `// Generated by scripts/gsap/sum/prepare.mjs from the photographed parts. Do not edit by hand: change the script
// (or a master) and run it again. Sizes are millimetres of a 39 mm watch; +x is 3 o'clock, +y is 12 o'clock.
// Outlines are closed loops [x0, y0, x1, y1, ...]: solid areas counter-clockwise, holes clockwise.

export const CASE_R = ${CASE_R};
export const MEASURED = ${JSON.stringify(parts, null, 1).replace(/"(\w+)":/g, '$1:').replace(/\[\s+([^\[\]]*?)\s+\]/gs, (_, inner) => `[${inner.replace(/\s+/g, ' ')}]`)} as const;
`;
  fs.writeFileSync(moduleFile, body);
  console.log('wrote', path.relative(root, moduleFile), `${Math.round(body.length / 1024)}KB`);
}
