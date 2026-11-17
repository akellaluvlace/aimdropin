// Fits a circle to a ring inside a photograph: for each direction from a first-guess centre, the darkest
// (or brightest) point between two radii. Rings inside a part (a bezel's inner edge, a caseback's window)
// are round all the way, which a watch head's outline is not.
//   node scripts/gsap/sum/ring.mjs <file> <cx> <cy> <r from> <r to> [min|max|edge+|edge-]
import path from 'node:path';
import sharp from 'sharp';
import { masters } from './paths.mjs';
import { fitCircle } from './measure-lib.mjs';
const [name, cxArg, cyArg, fromArg, toArg, mode = 'min'] = process.argv.slice(2);
const cx = Number(cxArg), cy = Number(cyArg), from = Number(fromArg), to = Number(toArg);
const image = sharp(path.join(masters, name));
const { width: W, height: H } = await image.metadata();
const { data } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const luma = (x, y) => { const xi = Math.max(0, Math.min(W - 1, Math.round(x))), yi = Math.max(0, Math.min(H - 1, Math.round(y))); const i = (yi * W + xi) * 4; return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; };
const smooth = (a, r) => { let s = 0; for (let k = -2; k <= 2; k++) s += luma(cx + Math.cos(a + k * 0.002) * r, cy + Math.sin(a + k * 0.002) * r); return s / 5; };
const points = [];
for (let k = 0; k < 720; k++) {
  const a = (k / 720) * Math.PI * 2;
  let best = null, bestValue = 0;
  for (let r = from; r <= to; r += 0.5) {
    const value = mode === 'min' ? -smooth(a, r) : mode === 'max' ? smooth(a, r) : mode === 'edge+' ? smooth(a, r + 2) - smooth(a, r - 2) : smooth(a, r - 2) - smooth(a, r + 2);
    if (best === null || value > bestValue) { best = r; bestValue = value; }
  }
  points.push([cx + Math.cos(a) * best, cy + Math.sin(a) * best]);
}
// Twice, dropping the points furthest from the first fit (markers, lugs and reflections pull single directions off).
let circle = fitCircle(points);
const kept = points.map(p => [p, Math.abs(Math.hypot(p[0] - circle.cx, p[1] - circle.cy) - circle.r)]).sort((a, b) => a[1] - b[1]).slice(0, Math.round(points.length * 0.75)).map(([p]) => p);
circle = fitCircle(kept);
const residual = Math.sqrt(kept.reduce((sum, [x, y]) => sum + (Math.hypot(x - circle.cx, y - circle.cy) - circle.r) ** 2, 0) / kept.length);
console.log(`${name} ring ${mode} ${from}..${to}: centre ${circle.cx.toFixed(1)}, ${circle.cy.toFixed(1)}; radius ${circle.r.toFixed(1)}; residual ${residual.toFixed(2)}px (${kept.length} of ${points.length} directions)`);
