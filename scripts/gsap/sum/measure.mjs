// Measures a part's photograph: the circle its alpha silhouette lies on, the mean brightness along the
// radius (to find rings such as the bezel's inner edge or a caseback's window), and writes an overlay to
// look at. Read-only on the masters.
//
//   node scripts/gsap/sum/measure.mjs <file in .cache/gsap/sum-masters> [arc=left|full|bottom] [rings=0.88,0.95 as shares of R]
//
// arc: which part of the silhouette is a clean circle. A watch head is only round on the side without
// the crown and between the lugs ("left"); a movement or a dial is round all the way ("full"); a rotor is
// round along its lower half ("bottom").
import path from 'node:path';
import sharp from 'sharp';
import { masters } from './paths.mjs';
import { fitCircle } from './measure-lib.mjs';

const [name, arc = 'full', ringsArg = ''] = process.argv.slice(2);
if (!name) throw new Error('Usage: node scripts/gsap/sum/measure.mjs <file> [arc] [rings]');
const file = path.join(masters, name);

const image = sharp(file);
const { width: W, height: H } = await image.metadata();
const { data } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const alpha = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : data[(y * W + x) * 4 + 3]);
const luma = (x, y) => { const i = (y * W + x) * 4; return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; };

// The silhouette's bounding box, then boundary points on the clean arc.
let x0 = W, x1 = 0, y0 = H, y1 = 0;
for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (alpha(x, y) > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
const midX = (x0 + x1) / 2, midY = (y0 + y1) / 2;
const points = [];
const edgeFrom = (startX, startY, dx, dy) => {
  // Walk in from outside the box until the alpha passes half; refine to sub-pixel.
  let x = startX, y = startY;
  for (let i = 0; i < Math.max(W, H); i++) {
    const here = alpha(Math.round(x), Math.round(y));
    if (here > 127) { const before = alpha(Math.round(x - dx), Math.round(y - dy)); const t = (127.5 - before) / Math.max(1, here - before); return [x - dx + dx * t, y - dy + dy * t]; }
    x += dx; y += dy;
  }
  return null;
};
if (arc === 'left' || arc === 'right') {
  // A watch head: the case is only a clean circle near 9 o'clock and, on the crown's side, just above and
  // below the crown. Further round, the lugs' roots take the outline off the circle (a fit that includes
  // them comes out too small and off centre). Both sides together pin the centre down.
  const reach = (y1 - y0) * 0.15, crown = (y1 - y0) * 0.08;
  for (let y = Math.round(midY - reach); y <= midY + reach; y += 4) {
    // "left": the crown is on the right (a head from the front). "right": it is on the left (from behind).
    const crownOnRight = arc === 'left';
    if (crownOnRight || Math.abs(y - midY) > crown) { const left = edgeFrom(0, y, 1, 0); if (left) points.push(left); }
    if (!crownOnRight || Math.abs(y - midY) > crown) { const right = edgeFrom(W - 1, y, -1, 0); if (right) points.push(right); }
  }
}
else if (arc === 'bottom') for (let x = Math.round(x0 + (x1 - x0) * 0.12); x <= x1 - (x1 - x0) * 0.12; x += 4) { const p = edgeFrom(x, H - 1, 0, -1); if (p) points.push(p); }
else for (let k = 0; k < 720; k++) { const a = (k / 720) * Math.PI * 2; const p = edgeFrom(midX + Math.cos(a) * Math.max(W, H), midY + Math.sin(a) * Math.max(W, H), -Math.cos(a), -Math.sin(a)); if (p) points.push(p); }
const circle = fitCircle(points);
const residual = Math.sqrt(points.reduce((sum, [x, y]) => sum + (Math.hypot(x - circle.cx, y - circle.cy) - circle.r) ** 2, 0) / points.length);
console.log(`${name}: ${W}x${H}; box x ${x0}..${x1}, y ${y0}..${y1}`);
console.log(`circle (${arc}, ${points.length} points): centre ${circle.cx.toFixed(1)}, ${circle.cy.toFixed(1)}; radius ${circle.r.toFixed(1)}; residual ${residual.toFixed(2)}px`);

// Mean brightness and its steepest changes along the radius, away from the hour markers (every 30 degrees).
const profile = [];
for (let r = 0; r <= circle.r * 1.02; r += 1) {
  let sum = 0, n = 0;
  for (let k = 0; k < 96; k++) {
    const a = ((k + 0.5) / 96) * Math.PI * 2;
    const away = Math.abs((((a * 180) / Math.PI + 15) % 30) - 15);
    if (away < 6) continue;
    const x = Math.round(circle.cx + Math.cos(a) * r), y = Math.round(circle.cy + Math.sin(a) * r);
    if (alpha(x, y) < 250) continue;
    sum += luma(x, y); n++;
  }
  profile.push(n > 20 ? sum / n : null);
}
const steps = [];
for (let r = 6; r < profile.length - 6; r++) {
  if (profile[r - 5] == null || profile[r + 5] == null) continue;
  steps.push([r, profile[r + 5] - profile[r - 5]]);
}
const strongest = steps.filter(([r]) => r > circle.r * 0.3).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
const picked = [];
for (const [r, d] of strongest) { if (picked.every(([pr]) => Math.abs(pr - r) > 12)) picked.push([r, d]); if (picked.length >= 10) break; }
console.log('steepest changes in brightness (radius px, share of R, change): ' + picked.sort((a, b) => a[0] - b[0]).map(([r, d]) => `${r} (${(r / circle.r).toFixed(3)}, ${d > 0 ? '+' : ''}${d.toFixed(0)})`).join('  '));

// An overlay to look at: the fitted circle, and any rings asked for.
const rings = ringsArg ? ringsArg.split(',').map(Number) : [];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <circle cx="${circle.cx}" cy="${circle.cy}" r="${circle.r}" fill="none" stroke="#ff2d55" stroke-width="3"/>
  ${rings.map(share => `<circle cx="${circle.cx}" cy="${circle.cy}" r="${circle.r * share}" fill="none" stroke="#00b3ff" stroke-width="3"/>`).join('')}
  <path d="M ${circle.cx - 40} ${circle.cy} h 80 M ${circle.cx} ${circle.cy - 40} v 80" stroke="#ff2d55" stroke-width="3"/>
</svg>`;
const out = path.join(masters, `measure-${name.replace(/\.\w+$/, '')}.jpg`);
// (sharp resizes before it composites, so the overlay is made at full size first.)
const full = await sharp(file).flatten({ background: '#cfd4d8' }).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
await sharp(full).resize({ width: 1400 }).jpeg({ quality: 88 }).toFile(out);
// And one edge at the photograph's own pixels, where the rings can be judged.
const crop = { left: Math.max(0, Math.min(W - 900, Math.round(circle.cx + circle.r * 0.62))), top: Math.max(0, Math.min(H - 900, Math.round(circle.cy - 450))), width: Math.min(900, W), height: Math.min(900, H) };
await sharp(full).extract(crop).jpeg({ quality: 92 }).toFile(out.replace('.jpg', '-edge.jpg'));
console.log('overlay:', path.relative(process.cwd(), out));
