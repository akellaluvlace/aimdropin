// How well a variant of the master photograph lies over it, and the correction that puts it right:
//   node scripts/gsap/datum/register.mjs <variant file> [write] [move] [lines] [only=wall,opening,around] [reach=14]
// The variants (the bare site, the building under construction, dusk) are edits of one photograph, so they
// should register; a big edit can drift. This matches small patches of the master in the variant, at the
// building's corners and openings and at fixed things round it (trees, hills), by the strength of their
// edges, which survives a change of light or material. It prints each patch's shift and the best
// correction (a scale and a move, each direction on its own), and with `write` saves the corrected
// picture as <name>-reg.png and notes the correction in scripts/gsap/datum/registration.json.
// `move` fits a move only (no scale). `only=` chooses which groups of patches the correction is made from.
// The wall's own corners and edges are the default: an opening looks too different from one state to the
// next (glass by day, glass at night, a hole in blockwork) for its patches to be trusted, and fitting from
// them once left the unlit dusk two pixels out at its east end. The bare site has no building to go by,
// so it is fitted from what stands round it (only=around).
import fs from 'node:fs';
import path from 'node:path';
import { edge, fitLine, fitShift, gradient, greenness, load, luma, match, savePng, warp } from './lib.mjs';
import { here, masters } from './paths.mjs';

const args = process.argv.slice(2);
const name = args[0];
if (!name) throw new Error('Usage: node scripts/gsap/datum/register.mjs <variant file> [write] [move] [only=wall,opening,around] [reach=14]');
const write = args.includes('write'), move = args.includes('move');
const option = key => args.find(arg => arg.startsWith(`${key}=`))?.slice(key.length + 1);
const reach = Number(option('reach') ?? 14);
const only = (option('only') ?? 'wall').split(',');
const house = JSON.parse(fs.readFileSync(path.join(here, 'house.json'), 'utf8'));
const master = await load(path.join(masters, house.master));
const variant = await load(path.join(masters, name));
if (master.width !== variant.width || master.height !== variant.height) throw new Error(`${name} is ${variant.width}x${variant.height}, the master ${master.width}x${master.height}`);
const { width: W, height: H } = master;
const a = gradient(luma(master), W, H), b = gradient(luma(variant), W, H);

// Where to look, and what each place can tell: a corner both ways, a level edge only up and down.
const points = [];
const add = (group, label, x, y, use = 'xy', half = 34) => points.push({ group, label, x, y, use, half });
add('wall', 'ground left', house.left, house.ground); add('wall', 'ground right', house.right, house.ground);
add('wall', 'eaves left', house.left, house.eaves); add('wall', 'eaves right', house.right, house.eaves);
add('wall', 'ridge left', house.roof[1][0], house.ridge); add('wall', 'ridge right', house.roof[2][0], house.ridge);
for (const x of [600, 900, 1330, 1700, 2100, 2300]) { add('wall', `eaves at ${x}`, x, house.eaves, 'y'); add('wall', `ridge at ${x}`, x, house.ridge, 'y'); }
for (const x of [660, 1100, 1380, 1730, 1930, 2120]) add('wall', `ground at ${x}`, x, house.ground, 'y');
for (const y of [960, 1100, 1240]) { add('wall', `left end at ${y}`, house.left, y, 'x'); add('wall', `right end at ${y}`, house.right, y, 'x'); }
house.openings.forEach((o, index) => {
  add('opening', `${index} top left`, o.x, o.y, 'xy', 26); add('opening', `${index} top right`, o.x + o.w, o.y, 'xy', 26);
  if (o.y + o.h < house.ground - 20) { add('opening', `${index} bottom left`, o.x, o.y + o.h, 'xy', 26); add('opening', `${index} bottom right`, o.x + o.w, o.y + o.h, 'xy', 26); }
});
for (const [label, x, y] of [['tree trunk a', 150, 1235], ['tree trunk b', 318, 1250], ['tree fork', 96, 1160], ['tree crown', 160, 900], ['tree crown b', 330, 1010], ['tree top', 70, 860], ['stone wall', 215, 1292], ['hills right a', 2600, 1085], ['hills right b', 2790, 1050], ['fields right a', 2700, 1170], ['fields right b', 2560, 1150], ['fields far right', 2820, 1160], ['hills left', 60, 1150], ['far edge right', 2650, 1262], ['far edge far right', 2800, 1255]]) add('around', label, x, y, 'xy', 48);

// ---------- By lines: for a variant whose surfaces have changed too much for patches to find themselves ----------
// The building under construction is the same box in other materials. Its ground line (where green begins),
// its ridge (over the part that is slated) and the two ends of its wall are read in both pictures the same
// way, and the correction is whatever puts the variant's four lines on the master's.
if (args.includes('lines')) {
  const read = image => {
    const l = luma(image), green = greenness(image);
    const steps = (from, to, step) => { const out = []; for (let t = from; t <= to; t += step) out.push(t); return out; };
    const line = (field, axis, positions, range, sign, min) => fitLine(positions.map(p => { const hit = edge(field, W, H, axis, p, Math.round(range[0]), Math.round(range[1]), sign); return hit.strength >= min ? [p, hit.at] : null; }).filter(Boolean));
    return {
      ground: line(green, 'y', steps(430, 2450, 6), [house.ground - 32, house.ground + 38], 1, 4),
      ridge: line(l, 'y', steps(480, 980, 5), [house.ridge - 25, house.ridge + 29], -1, 8),
      left: line(l, 'x', steps(900, 1010, 3), [house.left - 18, house.left + 26], -1, 6),
      right: line(l, 'x', steps(900, 1010, 3), [house.right - 24, house.right + 24], 1, 6),
    };
  };
  const m = read(master), v = read(variant);
  for (const key of ['ground', 'ridge', 'left', 'right']) console.log(`${key.padEnd(7)} master ${m[key].at.toFixed(2)}, variant ${v[key].at.toFixed(2)}: out by ${(v[key].at - m[key].at).toFixed(2)} px (${v[key].count} readings, spread ${v[key].spread.toFixed(2)})`);
  const sy = (v.ground.at - v.ridge.at) / (m.ground.at - m.ridge.at), sx = (v.right.at - v.left.at) / (m.right.at - m.left.at);
  const fit = { sx, sy, tx: v.left.at - sx * m.left.at, ty: v.ground.at - sy * m.ground.at };
  console.log(`correction: scale ${fit.sx.toFixed(5)} x ${fit.sy.toFixed(5)}, move ${fit.tx.toFixed(2)}, ${fit.ty.toFixed(2)}`);
  if (write) {
    const out = name.replace(/\.[a-z]+$/, '-reg.png');
    await savePng(warp(variant, fit), path.join(masters, out));
    const again = read(await load(path.join(masters, out)));
    const leftOver = ['ground', 'ridge', 'left', 'right'].map(key => Number((again[key].at - m[key].at).toFixed(2)));
    console.log(`after it: ground ${leftOver[0]}, ridge ${leftOver[1]}, left ${leftOver[2]}, right ${leftOver[3]} px`);
    const file = path.join(here, 'registration.json');
    const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    all[name] = { from: 'lines: ground, ridge, wall ends', sx: Number(fit.sx.toFixed(6)), sy: Number(fit.sy.toFixed(6)), tx: Number(fit.tx.toFixed(3)), ty: Number(fit.ty.toFixed(3)), leftOver, out };
    fs.writeFileSync(file, JSON.stringify(all, null, 1) + '\n');
    console.log(`wrote .cache/gsap/datum-masters/${out} and noted the correction`);
  }
  process.exit(0);
}

const found = [];
for (const point of points) {
  const hit = match(a, b, W, H, point.x, point.y, point.half, reach);
  if (hit) found.push({ ...point, ...hit });
}
const show = p => `${p.group.padEnd(8)} ${p.label.padEnd(20)} at ${String(Math.round(p.x)).padStart(4)}, ${String(Math.round(p.y)).padStart(4)}   shift ${(p.use.includes('x') ? p.dx.toFixed(2) : '').padStart(6)}  ${(p.use.includes('y') ? p.dy.toFixed(2) : '').padStart(6)}   agreement ${p.score.toFixed(2)}${p.edge ? '  (at the edge of the search)' : ''}`;
for (const p of found) console.log(show(p));
// Only patches that clearly found themselves count: landscape is softer than masonry, so it is asked for less.
const good = found.filter(p => only.includes(p.group) && p.score >= (p.group === 'around' ? 0.3 : 0.45) && !p.edge);
console.log(`\n${good.length} patches of ${only.join(', ')} agree well enough to use`);
if (good.length < 4) { console.log('Too few to fit a correction.'); process.exit(0); }
const fit = fitShift(good, { move });
const middle = values => { const sorted = [...values].sort((p, q) => p - q); return sorted[sorted.length >> 1]; };
console.log(`as it came: across ${middle(fit.x.used.map(p => p.dx)).toFixed(2)} px (middle of ${fit.x.used.length}), down ${middle(fit.y.used.map(p => p.dy)).toFixed(2)} px (middle of ${fit.y.used.length})`);
console.log(`correction: scale ${fit.sx.toFixed(5)} x ${fit.sy.toFixed(5)}, move ${fit.tx.toFixed(2)}, ${fit.ty.toFixed(2)}`);
console.log(`left over after it: across ${fit.x.rms.toFixed(2)} px rms (worst ${fit.x.worst.toFixed(2)}), down ${fit.y.rms.toFixed(2)} px rms (worst ${fit.y.worst.toFixed(2)})`);
// What the correction amounts to at the building's four corners: how far each was out.
for (const [label, x, y] of [['ground left', house.left, house.ground], ['ground right', house.right, house.ground], ['ridge left', house.roof[1][0], house.ridge], ['ridge right', house.roof[2][0], house.ridge]]) console.log(`  ${label.padEnd(13)} was out by ${(fit.sx * x + fit.tx - x).toFixed(2)}, ${(fit.sy * y + fit.ty - y).toFixed(2)}`);

if (write) {
  const out = name.replace(/\.[a-z]+$/, '-reg.png');
  await savePng(warp(variant, fit), path.join(masters, out));
  const file = path.join(here, 'registration.json');
  const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  all[name] = { from: only.join(', '), sx: Number(fit.sx.toFixed(6)), sy: Number(fit.sy.toFixed(6)), tx: Number(fit.tx.toFixed(3)), ty: Number(fit.ty.toFixed(3)), patches: [fit.x.used.length, fit.y.used.length], leftOver: [Number(fit.x.rms.toFixed(3)), Number(fit.y.rms.toFixed(3))], out };
  fs.writeFileSync(file, JSON.stringify(all, null, 1) + '\n');
  console.log(`wrote .cache/gsap/datum-masters/${out} and noted the correction`);
}
