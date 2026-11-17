// The streets the Meridian demo's van drives, and the van's run along them, from OpenStreetMap
// (© OpenStreetMap contributors, ODbL: the page credits it).
//   node scripts/gsap/meridian/streets.mjs
// Reads .cache/gsap/meridian-data/dublin-streets.json (the Overpass API's answer to queries/streets.overpassql)
// and writes public/assets/gsap/meridian/streets.json: the streets by kind, the
// buildings round the last stop, water, parks, tram lines, and the run (found on the street network,
// one way streets respected) with its stops.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = JSON.parse(fs.readFileSync(path.join(root, '.cache/gsap/meridian-data/dublin-streets.json'), 'utf8'));
const out = path.join(root, 'public/assets/gsap/meridian');
const round = (value, digits = 6) => Number(value.toFixed(digits));
const flat = line => line.flatMap(([lon, lat]) => [round(lon), round(lat)]);

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
const key = point => `${point[0].toFixed(7)},${point[1].toFixed(7)}`;
/** Metres between two places close together. */
const apart = (a, b) => { const k = Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180); return Math.hypot((a[0] - b[0]) * k, a[1] - b[1]) * 111320; };

// ---------- What is drawn ----------
const GROUP = { motorway: 'main', trunk: 'main', primary: 'main', secondary: 'main', tertiary: 'main', unclassified: 'local', residential: 'local', living_street: 'local', pedestrian: 'foot' };
const drawn = { main: [], local: [], foot: [], tram: [], buildings: [], water: [], parks: [] };
const ways = [];
for (const element of source.elements) {
  const tags = element.tags ?? {};
  if (element.type === 'way' && element.geometry) {
    const line = element.geometry.map(point => [point.lon, point.lat]);
    const closed = line.length > 3 && key(line[0]) === key(line[line.length - 1]);
    if (tags.highway) {
      const kind = tags.highway.replace('_link', '');
      const group = GROUP[kind];
      if (!group || tags.tunnel === 'yes') continue;
      // A pedestrian square is an area, not a street.
      if (!(group === 'foot' && (tags.area === 'yes' || closed))) drawn[group].push(line);
      if (group !== 'foot') ways.push({ line, kind, oneway: tags.oneway === 'yes' || tags.junction === 'roundabout' ? 1 : tags.oneway === '-1' ? -1 : 0 });
    } else if (tags.building && closed) drawn.buildings.push(line);
    else if (tags.natural === 'water' && closed) drawn.water.push(line);
    else if (tags.leisure === 'park' && closed) drawn.parks.push(line);
    else if (tags.railway === 'tram') drawn.tram.push(line);
  } else if (element.type === 'relation' && tags.natural === 'water') {
    // A river as a relation: its outer ways, joined end to end into rings.
    const pieces = element.members.filter(member => member.role !== 'inner' && member.geometry).map(member => member.geometry.map(point => [point.lon, point.lat]));
    while (pieces.length) {
      const ring = pieces.shift();
      let grew = true;
      while (grew && key(ring[0]) !== key(ring[ring.length - 1])) {
        grew = false;
        for (let i = 0; i < pieces.length; i++) {
          const piece = pieces[i];
          if (key(piece[0]) === key(ring[ring.length - 1])) ring.push(...piece.slice(1));
          else if (key(piece[piece.length - 1]) === key(ring[ring.length - 1])) ring.push(...piece.slice(0, -1).reverse());
          else continue;
          pieces.splice(i, 1); grew = true; break;
        }
      }
      if (ring.length > 3) drawn.water.push(ring);
    }
  }
}

// ---------- The street network, for the van ----------
const nodes = new Map();                 // key -> { point, edges: [{ to, metres }] }
const node = point => { const k = key(point); if (!nodes.has(k)) nodes.set(k, { point, edges: [] }); return nodes.get(k); };
// A van keeps to bigger streets where it can: a metre of lane counts for more than a metre of main road.
const COST = { motorway: 0.8, trunk: 0.8, primary: 0.8, secondary: 0.85, tertiary: 0.95, unclassified: 1.15, residential: 1.3, living_street: 2 };
for (const way of ways) for (let i = 0; i < way.line.length - 1; i++) {
  const a = node(way.line[i]), b = node(way.line[i + 1]), metres = apart(a.point, b.point), cost = metres * (COST[way.kind] ?? 1.2);
  if (way.oneway >= 0) a.edges.push({ to: b, metres, cost });
  if (way.oneway <= 0) b.edges.push({ to: a, metres, cost });
}
const list = [...nodes.values()];
const nearest = point => list.reduce((best, candidate) => (candidate.edges.length && apart(candidate.point, point) < apart(best.point, point) ? candidate : best), list.find(candidate => candidate.edges.length));
/** The cheapest way from one node to another: Dijkstra, with a binary heap. */
const routeBetween = (from, to) => {
  const cost = new Map([[from, 0]]), came = new Map(), heap = [[0, from]];
  const push = item => { heap.push(item); for (let i = heap.length - 1; i > 0;) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; for (let i = 0; ;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) {
    const [reached, at] = pop();
    if (at === to) break;
    if (reached > (cost.get(at) ?? Infinity)) continue;
    for (const edge of at.edges) { const next = reached + edge.cost; if (next < (cost.get(edge.to) ?? Infinity)) { cost.set(edge.to, next); came.set(edge.to, at); push([next, edge.to]); } }
  }
  if (!came.has(to) && from !== to) return null;
  const line = [to.point];
  for (let at = to; at !== from;) { at = came.get(at); line.push(at.point); }
  return line.reverse();
};
// The run: out of the depot by the port, through the north inner city, to the stop the page follows, and on.
const DEPOT = [-6.2135, 53.3497];
const STOPS = [
  [-6.2296, 53.3541], [-6.2392, 53.3586], [-6.2470, 53.3566], [-6.2573, 53.3571], [-6.2627, 53.3534], [-6.2655, 53.3497],
  [-6.2700, 53.3482], [-6.2746, 53.3489], [-6.2786, 53.3484],
  [-6.2812, 53.3506], [-6.2855, 53.3527], [-6.2893, 53.3511],
];
const FOLLOWED = 8;                       // the stop the page ends at: the ninth on this list
const at = [nearest(DEPOT), ...STOPS.map(nearest)];
const run = [], marks = [];
let metres = 0;
for (let i = 0; i < at.length - 1; i++) {
  const leg = routeBetween(at[i], at[i + 1]);
  if (!leg) throw new Error(`No way from stop ${i} to stop ${i + 1}`);
  for (let j = run.length ? 1 : 0; j < leg.length; j++) { if (run.length) metres += apart(run[run.length - 1], leg[j]); run.push(leg[j]); }
  marks.push({ lon: round(at[i + 1].point[0]), lat: round(at[i + 1].point[1]), metres: Math.round(metres) });
}

// ---------- Out ----------
const lines = (list, tolerance) => list.map(line => simplify(line, tolerance)).filter(line => line.length > 1).map(flat);
const result = {
  main: lines(drawn.main, 0.000012), local: lines(drawn.local, 0.000012), foot: lines(drawn.foot, 0.000012), tram: lines(drawn.tram, 0.000015),
  buildings: lines(drawn.buildings, 0.000004), water: lines(drawn.water, 0.00001), parks: lines(drawn.parks, 0.00001),
  run: flat(run), depot: [round(at[0].point[0]), round(at[0].point[1])], stops: marks, followed: FOLLOWED, runMetres: Math.round(metres),
};
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'streets.json'), JSON.stringify(result));
for (const [name, value] of Object.entries(result)) if (Array.isArray(value) && Array.isArray(value[0])) console.log(`${name}: ${value.length} shapes, ${value.reduce((sum, line) => sum + line.length / 2, 0)} points`);
console.log(`run: ${run.length} points, ${(metres / 1000).toFixed(2)} km, ${marks.length} stops; the followed stop is at ${(marks[FOLLOWED].metres / 1000).toFixed(2)} km`);
console.log(`streets.json: ${Math.round(fs.statSync(path.join(out, 'streets.json')).size / 1024)}KB`);
