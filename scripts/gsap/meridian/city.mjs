// Dublin for the Meridian demo's map: main roads, coast, river and railway, from OpenStreetMap
// (© OpenStreetMap contributors, ODbL: the page credits it).
//   node scripts/gsap/meridian/city.mjs
// Reads .cache/gsap/meridian-data/dublin-roads.json (the Overpass API's answer to queries/roads.overpassql; that
// file was written again from the answer, the one first sent was not kept) and writes
// public/assets/gsap/meridian/city.json: for each kind of line, a list of [lon, lat, lon, lat, ...] in degrees.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = JSON.parse(fs.readFileSync(path.join(root, '.cache/gsap/meridian-data/dublin-roads.json'), 'utf8'));
const out = path.join(root, 'public/assets/gsap/meridian');

const simplify = (points, tolerance) => {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  // A ring ends where it starts, so its two ends give no line to measure from: it is cut in two at the
  // point farthest from them first.
  if (points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1]) {
    let far = 0, most = -1;
    for (let i = 1; i < points.length - 1; i++) { const d = Math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1]); if (d > most) { most = d; far = i; } }
    keep[far] = 1;
    stack.length = 0;
    stack.push([0, far], [far, points.length - 1]);
  }
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a], [bx, by] = points[b], dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy) || 1e-12;
    let far = -1, most = tolerance;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((points[i][0] - ax) * dy - (points[i][1] - ay) * dx) / length; if (d > most) { most = d; far = i; } }
    if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return points.filter((_, i) => keep[i]);
};
/** Ways that share an end are joined into longer lines: fewer strokes, and no gaps at the joins. */
const join = ways => {
  const key = p => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
  const lines = ways.map(way => way.slice());
  const ends = new Map();
  const note = (index) => { for (const end of [lines[index][0], lines[index][lines[index].length - 1]]) { const k = key(end); if (!ends.has(k)) ends.set(k, new Set()); ends.get(k).add(index); } };
  lines.forEach((_, index) => note(index));
  const gone = new Set();
  for (let index = 0; index < lines.length; index++) {
    if (gone.has(index)) continue;
    let grew = true;
    while (grew) {
      grew = false;
      const line = lines[index], tail = key(line[line.length - 1]);
      const others = [...(ends.get(tail) ?? [])].filter(other => other !== index && !gone.has(other));
      // Only where exactly two lines meet: a junction of three is a junction, and stays one.
      if (others.length !== 1) break;
      const other = others[0], next = lines[other];
      const forward = key(next[0]) === tail;
      if (!forward && key(next[next.length - 1]) !== tail) break;
      const add = forward ? next.slice(1) : next.slice(0, -1).reverse();
      ends.get(tail).delete(index); ends.get(tail).delete(other);
      const far = key(add[add.length - 1]);
      ends.get(far)?.delete(other);
      line.push(...add);
      if (!ends.has(far)) ends.set(far, new Set());
      ends.get(far).add(index);
      gone.add(other);
      grew = true;
    }
  }
  return lines.filter((_, index) => !gone.has(index));
};
const kinds = { motorway: [], trunk: [], primary: [], secondary: [], tertiary: [], river: [], coast: [], rail: [] };
for (const element of source.elements) {
  if (element.type !== 'way' || !element.geometry) continue;
  const tags = element.tags ?? {};
  const kind = tags.highway ? tags.highway.replace('_link', '') : tags.waterway === 'river' ? 'river' : tags.natural === 'coastline' ? 'coast' : tags.railway === 'rail' ? 'rail' : null;
  if (!kind || !kinds[kind]) continue;
  // Tunnels are left out of what is drawn on the ground.
  if (tags.tunnel === 'yes' && kind !== 'river') continue;
  kinds[kind].push(element.geometry.map(point => [point.lon, point.lat]));
}
const tolerance = { motorway: 0.00004, trunk: 0.00004, primary: 0.00004, secondary: 0.00005, tertiary: 0.00006, river: 0.00005, coast: 0.00004, rail: 0.00006 };
const result = {};
for (const [kind, ways] of Object.entries(kinds)) {
  const lines = join(ways).map(line => simplify(line, tolerance[kind])).filter(line => line.length > 1);
  result[kind] = lines.map(line => line.flatMap(([lon, lat]) => [Number(lon.toFixed(5)), Number(lat.toFixed(5))]));
  console.log(`${kind}: ${ways.length} ways joined into ${lines.length} lines, ${lines.reduce((sum, line) => sum + line.length, 0)} points`);
}
// The sea, as an area. The coast here is one long line from south to north with the sea on its east
// (OpenStreetMap draws a coast with the land on its left), so the area is that line closed well out to sea.
// Rocks too small to keep their shape are left out.
const mainland = result.coast.reduce((longest, line) => (line.length > longest.length ? line : longest), []);
const east = -5.85;
result.sea = [[...mainland, east, mainland[mainland.length - 1], east, mainland[1], mainland[0], mainland[1]]];
result.islands = result.coast.filter(line => line !== mainland && line.length >= 8 && line[0] === line[line.length - 2] && line[1] === line[line.length - 1]);
delete result.coast;
console.log(`sea: ${result.sea[0].length / 2} points; islands: ${result.islands.length}`);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'city.json'), JSON.stringify(result));
console.log(`city.json: ${Math.round(fs.statSync(path.join(out, 'city.json')).size / 1024)}KB`);
