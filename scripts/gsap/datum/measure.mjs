// The long house, measured from its photograph: node scripts/gsap/datum/measure.mjs [master file] [overlay file]
// Finds the ground line, the eaves, the ridge, the two ends of the wall, the two verges of the roof and
// every opening (its hole in the wall and its glass), in pixels of the master, and writes them to
// scripts/gsap/datum/house.json. The page's drawing, its dimensions and its figures are all made from that
// file (prepare.mjs turns it into house.ts), so the drawing lies over the photograph because it was
// taken from it. With an overlay file, the findings are drawn over the photograph, to be looked at.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { edge, fitLine, load, luma, median } from './lib.mjs';
import { here, masters } from './paths.mjs';

const file = path.resolve(masters, process.argv[2] ?? 'x-house-gable.png');
const overlay = process.argv[3];
const image = await load(file);
const { width: W, height: H, data, channels: C } = image;
const l = luma(image);
const round = (value, places = 1) => Math.round(value * 10 ** places) / 10 ** places;

// Where to look. Rough numbers read off the photograph; the script finds the lines within them.
const LOOK = { ground: [1290, 1365], eaves: [868, 918], ridge: [628, 682], left: [384, 428], right: [2456, 2504], wallRows: [930, 1300], wallColumns: [430, 2450], vergeLeft: [392, 470], vergeRight: [2412, 2494] };

const along = (from, to, step) => { const out = []; for (let t = from; t <= to; t += step) out.push(t); return out; };
const lineOf = (axis, positions, range, sign, min = 12) => {
  const points = positions.map(p => { const found = edge(l, W, H, axis, p, range[0], range[1], sign); return found.strength >= min ? [p, found.at] : null; }).filter(Boolean);
  return fitLine(points);
};

// The level lines, each from a few hundred columns: the middle value, and how far it tilts end to end.
const ground = lineOf('y', along(...LOOK.wallColumns, 6), LOOK.ground, -1);
const eaves = lineOf('y', along(...LOOK.wallColumns, 6), LOOK.eaves, 1);
const ridge = lineOf('y', along(470, 2410, 6), LOOK.ridge, -1);
// The two ends of the wall, from rows between the eaves and the ground.
const left = lineOf('x', along(...LOOK.wallRows, 5), LOOK.left, 1, 6);
const right = lineOf('x', along(...LOOK.wallRows, 5), LOOK.right, -1, 6);
// The verges: where the slate ends against the sky, row by row from just under the ridge to just over the eaves.
const vergeRows = along(Math.round(ridge.at) + 14, Math.round(eaves.at) - 14, 4);
const vergeLeft = lineOf('x', vergeRows, LOOK.vergeLeft, -1);
const vergeRight = lineOf('x', vergeRows, LOOK.vergeRight, 1);
const vergeAt = (verge, y) => verge.at + verge.slope * (y - verge.mid);

const house = {
  ground: round(ground.at), eaves: round(eaves.at), ridge: round(ridge.at),
  left: round(left.at), right: round(right.at),
  // The roof's four corners: the verges are a little off vertical, as the ridge stands further from the camera than the eaves.
  roof: [[round(vergeAt(vergeLeft, eaves.at)), round(eaves.at)], [round(vergeAt(vergeLeft, ridge.at)), round(ridge.at)], [round(vergeAt(vergeRight, ridge.at)), round(ridge.at)], [round(vergeAt(vergeRight, eaves.at)), round(eaves.at)]],
};
const tilt = line => round(line.slope * (line.count * 6), 2);
console.log(`ground ${house.ground} (tilt ${tilt(ground)} px end to end, spread ${round(ground.spread, 2)}, ${ground.count} columns)`);
console.log(`eaves  ${house.eaves} (tilt ${tilt(eaves)}, spread ${round(eaves.spread, 2)}, ${eaves.count} columns)`);
console.log(`ridge  ${house.ridge} (tilt ${tilt(ridge)}, spread ${round(ridge.spread, 2)}, ${ridge.count} columns)`);
console.log(`left   ${house.left} (spread ${round(left.spread, 2)}, ${left.count} rows)   right ${house.right} (spread ${round(right.spread, 2)}, ${right.count} rows)`);
console.log(`roof   ${JSON.stringify(house.roof)}`);

// ---------- The openings: everything inside the wall that is not wall ----------
const x0 = Math.ceil(house.left) + 8, x1 = Math.floor(house.right) - 8, y0 = Math.ceil(house.eaves) + 8, y1 = Math.floor(house.ground) - 3;
const w = x1 - x0 + 1, h = y1 - y0 + 1;
// The wall's own colour, from a clear stretch of it.
const sample = (ax, ay, bx, by) => { const r = [], g = [], b = []; for (let y = ay; y < by; y += 2) for (let x = ax; x < bx; x += 2) { const i = (y * W + x) * C; r.push(data[i]); g.push(data[i + 1]); b.push(data[i + 2]); } return [median(r), median(g), median(b)]; };
const wall = sample(1260, 936, 1400, 1080);
console.log(`wall colour ${wall.join(', ')}`);
const notWall = new Uint8Array(w * h);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const i = ((y + y0) * W + x + x0) * C;
  const dr = data[i] - wall[0], dg = data[i + 1] - wall[1], db = data[i + 2] - wall[2];
  const chroma = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
  notWall[y * w + x] = Math.abs(0.299 * dr + 0.587 * dg + 0.114 * db) > 34 || chroma > 30 ? 1 : 0;
}
// Connected regions of not-wall, by flood fill.
const seen = new Uint8Array(w * h), regions = [];
const stack = new Int32Array(w * h);
for (let start = 0; start < w * h; start++) {
  if (!notWall[start] || seen[start]) continue;
  let top = 0, minX = w, maxX = 0, minY = h, maxY = 0, area = 0;
  stack[top++] = start; seen[start] = 1;
  while (top) {
    const at = stack[--top], x = at % w, y = (at - x) / w;
    area++;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    for (const next of [at - 1, at + 1, at - w, at + w]) {
      if (next < 0 || next >= w * h || seen[next] || !notWall[next]) continue;
      if ((next === at - 1 && x === 0) || (next === at + 1 && x === w - 1)) continue;
      seen[next] = 1; stack[top++] = next;
    }
  }
  if (maxX - minX > 36 && maxY - minY > 36 && area > 1500) regions.push({ minX: minX + x0, maxX: maxX + x0, minY: minY + y0, maxY: maxY + y0 });
}
regions.sort((a, b) => a.minX - b.minX);

// Each opening's four edges, sharpened: the strongest edge near each side of its region, as the middle of many readings.
// Oak, lit or in the shade of its own lining: warm, and redder than it is green.
const isOak = (x, y) => { const i = (y * W + x) * C; return data[i] - data[i + 2] > 26 && data[i] > 72 && data[i] >= data[i + 1]; };
const refine = region => {
  const { minX, maxX, minY, maxY } = region;
  const rows = along(minY + 12, maxY - 12, 3), columns = along(minX + 12, maxX - 12, 3);
  const side = (axis, positions, near, sign) => median(positions.map(p => edge(l, W, H, axis, p, near - 7, near + 7, sign, 1)).filter(found => found.strength > 5).map(found => found.at));
  // Wall is lighter than oak: going in from the left the edge is light to dark.
  const outer = { left: side('x', rows, minX, -1), right: side('x', rows, maxX, 1), top: side('y', columns, minY, -1), bottom: Math.min(house.ground, side('y', columns, maxY, 1)) };
  let oak = 0, all = 0;
  for (let y = minY + 3; y <= maxY - 3; y++) for (let x = minX + 3; x <= maxX - 3; x++) { all++; if (isOak(x, y)) oak++; }
  // The glass: walking in from each side of the hole, where the oak of the lining ends. A lining shows more
  // of itself on the side the camera looks along, so each side is read on its own, as the middle of many walks.
  const walk = (px, py, stepX, stepY, limit) => {
    let steps = 0, run = 0, gap = 0, begun = false;
    for (; steps < limit; steps++) {
      const hit = isOak(Math.round(px + stepX * steps), Math.round(py + stepY * steps));
      if (hit) { run++; gap = 0; if (run >= 2) begun = true; } else if (begun) { if (++gap >= 3) return steps - gap + 1; } else if (steps > 9) return 0;
    }
    return limit;
  };
  const wide = maxX - minX, tall = maxY - minY;
  const depth = (positions, start) => median(positions.map(start));
  const midRows = along(Math.round(minY + tall * 0.3), Math.round(maxY - tall * 0.3), 2), midColumns = along(Math.round(minX + wide * 0.3), Math.round(maxX - wide * 0.3), 2);
  const glass = {
    left: outer.left + depth(midRows, y => walk(Math.round(outer.left), y, 1, 0, wide >> 1)),
    right: outer.right - depth(midRows, y => walk(Math.round(outer.right) - 1, y, -1, 0, wide >> 1)),
    top: outer.top + depth(midColumns, x => walk(x, Math.round(outer.top), 0, 1, tall >> 1)),
    bottom: outer.bottom - depth(midColumns, x => walk(x, Math.round(outer.bottom) - 1, 0, -1, tall >> 1)),
  };
  return { outer, glass, oak: oak / all };
};
const openings = regions.map(region => {
  const { outer, glass, oak } = refine(region);
  const reachesGround = house.ground - outer.bottom < 14 || !Number.isFinite(outer.bottom);
  const box = { x: round(outer.left), y: round(outer.top), w: round(outer.right - outer.left), h: round((reachesGround ? house.ground : outer.bottom) - outer.top) };
  // A door is oak all over; a window has glass inside its lining.
  if (oak > 0.82) return { kind: 'door', ...box };
  return { kind: reachesGround ? 'glazed' : 'window', ...box, glass: { x: round(glass.left), y: round(glass.top), w: round(glass.right - glass.left), h: round(glass.bottom - glass.top) } };
});
for (const opening of openings) console.log(`${opening.kind.padEnd(7)} ${opening.x}, ${opening.y}  ${opening.w} x ${opening.h}${opening.glass ? `   glass ${opening.glass.x}, ${opening.glass.y}  ${opening.glass.w} x ${opening.glass.h}` : ''}`);
house.openings = openings;
house.size = [W, H];
house.master = path.basename(file);
fs.writeFileSync(path.join(here, 'house.json'), JSON.stringify(house, null, 1) + '\n');
console.log(`wrote scripts/gsap/datum/house.json: ${openings.length} openings`);

if (overlay) {
  const line = (x1, y1, x2, y2, colour = '#ff2a00') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colour}" stroke-width="1"/>`;
  const rect = (b, colour) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="${colour}" stroke-width="1"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${line(0, house.ground, W, house.ground)}${line(house.left - 60, house.eaves, house.right + 60, house.eaves)}${line(house.left - 60, house.ridge, house.right + 60, house.ridge)}${line(house.left, house.eaves - 40, house.left, house.ground + 40)}${line(house.right, house.eaves - 40, house.right, house.ground + 40)}<polygon points="${house.roof.map(p => p.join(',')).join(' ')}" fill="none" stroke="#00c8ff" stroke-width="1"/>${openings.map(o => rect(o, '#ff2a00') + (o.glass ? rect(o.glass, '#00c8ff') : '')).join('')}</svg>`;
  await sharp(file).composite([{ input: Buffer.from(svg) }]).png().toFile(path.resolve(overlay));
  console.log(`overlay: ${overlay}`);
}
