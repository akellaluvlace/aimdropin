// Land for the Meridian demo's map, at three levels of detail, from Natural Earth (public domain):
// the whole world coarse, Europe finer, Ireland and the Irish Sea finest.
//   node scripts/gsap/meridian/land.mjs
// Reads .cache/gsap/meridian-data/ne_110m_land.geojson, ne_50m_land.geojson and ne_10m_land.geojson (download them
// from the natural-earth-vector repository's geojson folder) and writes public/assets/gsap/meridian/land-*.json:
// closed rings of [lon, lat, lon, lat, ...] in degrees.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const data = path.join(root, '.cache/gsap/meridian-data'), out = path.join(root, 'public/assets/gsap/meridian');
const read = name => JSON.parse(fs.readFileSync(path.join(data, `${name}.geojson`), 'utf8'));

/** Douglas and Peucker: drop the points a line can do without, to within `tolerance` degrees. */
const simplify = (points, tolerance) => {
  if (points.length < 5 || !tolerance) return points;
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
const rings = (collection, { box, digits, tolerance = 0, smallest = 0 }) => {
  const result = [];
  for (const feature of collection.features) {
    const g = feature.geometry;
    const polygons = !g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const polygon of polygons) for (const ring of polygon) {
      if (box && !ring.some(([lon, lat]) => lon >= box[0] && lon <= box[2] && lat >= box[1] && lat <= box[3])) continue;
      // An island too small to see at this level is left out.
      let west = 180, east = -180, south = 90, north = -90;
      for (const [lon, lat] of ring) { if (lon < west) west = lon; if (lon > east) east = lon; if (lat < south) south = lat; if (lat > north) north = lat; }
      if (Math.max(east - west, north - south) < smallest) continue;
      const kept = simplify(ring, tolerance);
      if (kept.length < 4) continue;
      const flat = [];
      for (const [lon, lat] of kept) flat.push(Number(lon.toFixed(digits)), Number(lat.toFixed(digits)));
      result.push(flat);
    }
  }
  return result;
};
fs.mkdirSync(out, { recursive: true });
const levels = {
  world: rings(read('ne_110m_land'), { digits: 2 }),
  europe: rings(read('ne_50m_land'), { box: [-30, 28, 48, 72], digits: 3, tolerance: 0.012, smallest: 0.08 }),
  isles: rings(read('ne_10m_land'), { box: [-11.2, 50.6, -2.4, 56.2], digits: 4, tolerance: 0.0012, smallest: 0.01 }),
};
for (const [name, list] of Object.entries(levels)) {
  const file = path.join(out, `land-${name}.json`);
  fs.writeFileSync(file, JSON.stringify(list));
  console.log(`${name}: ${list.length} rings, ${list.reduce((sum, ring) => sum + ring.length / 2, 0)} points, ${Math.round(fs.statSync(file).size / 1024)}KB`);
}
