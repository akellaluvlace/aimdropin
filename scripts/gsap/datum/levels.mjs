// The level lines in a picture: node scripts/gsap/datum/levels.mjs <master file> [from row] [to row] [from column] [to column]
// Every picture on the page stands on the datum by one row of its own: a ground line, a floor line, a
// joint between two materials, a course of slate. This lists the rows where a level edge runs most of
// the way across, strongest first, so that row can be chosen and written into prepare.mjs.
import path from 'node:path';
import { load, luma, median } from './lib.mjs';
import { masters } from './paths.mjs';

const [name, from = '0', to, c0 = '0', c1] = process.argv.slice(2);
if (!name) throw new Error('Usage: node scripts/gsap/datum/levels.mjs <master file> [from row] [to row] [from column] [to column]');
const image = await load(path.join(masters, name));
const { width: W, height: H } = image;
const l = luma(image);
const top = Math.max(3, Number(from)), bottom = Math.min(H - 4, Number(to ?? H)), left = Number(c0), right = Math.min(W, Number(c1 ?? W));
const rows = [];
for (let y = top; y <= bottom; y++) {
  // How strong the step is across this row, in the middle of the columns: a line that runs right across scores high.
  const steps = [];
  for (let x = left + 2; x < right - 2; x += 4) steps.push(Math.abs(l[(y + 2) * W + x] - l[(y - 2) * W + x]));
  rows.push([y, median(steps)]);
}
// Keep each peak once.
const peaks = rows.filter(([, v], i) => v >= (rows[i - 1]?.[1] ?? 0) && v >= (rows[i + 1]?.[1] ?? 0) && v > 4).sort((a, b) => b[1] - a[1]);
const kept = [];
for (const peak of peaks) if (!kept.some(other => Math.abs(other[0] - peak[0]) < 8)) kept.push(peak);
console.log(`${name}: ${W}x${H}, rows ${top} to ${bottom}`);
for (const [y, v] of kept.slice(0, 14).sort((a, b) => a[0] - b[0])) console.log(`  row ${String(y).padStart(4)} (${((y / H) * 100).toFixed(1)}% down)  step ${v.toFixed(1)}`);
