// The earth as the map draws it: places as unit vectors, one orthographic camera, and the cutting of
// shapes to the picture. Seen close, an orthographic view of a sphere is a flat map of the ground under
// it, so the same camera serves from the whole earth down to a door: only its scale changes.

export const EARTH = 6371008.8;                      // metres, mean radius
const DEG = Math.PI / 180;

export type Vec = [number, number, number];
/** A place on the earth as a unit vector: x east at the prime meridian's quarter turn, y north, z out of 0, 0. */
export const place = (lon: number, lat: number): Vec => { const a = lon * DEG, b = lat * DEG, c = Math.cos(b); return [c * Math.sin(a), Math.sin(b), c * Math.cos(a)]; };
export const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** The great circle from one place to another, `t` of the way along. */
export function between(a: Vec, b: Vec, t: number): Vec {
  const angle = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
  if (angle < 1e-9) return a;
  const s = Math.sin(angle), p = Math.sin((1 - t) * angle) / s, q = Math.sin(t * angle) / s;
  return [a[0] * p + b[0] * q, a[1] * p + b[1] * q, a[2] * p + b[2] * q];
}
export const lonLat = (v: Vec): [number, number] => [Math.atan2(v[0], v[2]) / DEG, Math.asin(Math.max(-1, Math.min(1, v[1]))) / DEG];
/** Metres along the ground between two places. */
export const metres = (a: Vec, b: Vec) => Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * EARTH;

/** A line or the edge of an area: its points as unit vectors, and the cap of the earth that holds it. */
export interface Shape { xyz: Float64Array; count: number; mid: Vec; reach: number }
/** From [lon, lat, lon, lat, ...] in degrees. */
export function shape(flat: ArrayLike<number>): Shape {
  const count = flat.length >> 1, xyz = new Float64Array(count * 3);
  let sx = 0, sy = 0, sz = 0;
  for (let i = 0; i < count; i++) { const v = place(flat[i * 2], flat[i * 2 + 1]); xyz[i * 3] = v[0]; xyz[i * 3 + 1] = v[1]; xyz[i * 3 + 2] = v[2]; sx += v[0]; sy += v[1]; sz += v[2]; }
  const length = Math.hypot(sx, sy, sz) || 1, mid: Vec = [sx / length, sy / length, sz / length];
  let least = 1;
  for (let i = 0; i < count; i++) least = Math.min(least, xyz[i * 3] * mid[0] + xyz[i * 3 + 1] * mid[1] + xyz[i * 3 + 2] * mid[2]);
  return { xyz, count, mid, reach: Math.acos(Math.max(-1, Math.min(1, least))) };
}

/** Where the camera looks, and how many CSS pixels the earth's radius is. */
export interface View { lon: number; lat: number; scale: number }
export const metresPerPixel = (view: View) => EARTH / view.scale;
/** The scale at which a pixel is this many metres. */
export const scaleFor = (metresAPixel: number) => EARTH / metresAPixel;

/** The camera's three axes on the earth: east and north across the picture, and out toward the eye. */
export interface Basis { east: Vec; north: Vec; out: Vec }
export function basis(view: View): Basis {
  const a = view.lon * DEG, b = view.lat * DEG, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  return { east: [ca, 0, -sa], north: [-sb * sa, cb, -sb * ca], out: [cb * sa, sb, cb * ca] };
}

/**
 * Cut a closed outline (x0, y0, x1, y1, ...) to a rectangle: Sutherland and Hodgman. Close to the ground
 * most of an island is far outside the picture, and a canvas cannot hold coordinates in the millions.
 * `work` is two scratch arrays, reused.
 */
export function clipArea(points: Float64Array, count: number, left: number, top: number, right: number, bottom: number, work: [Float64Array, Float64Array]): { points: Float64Array; count: number } {
  let from = points, n = count, to = work[0], flip = 0;
  for (let side = 0; side < 4 && n > 2; side++) {
    let m = 0;
    const inside = (x: number, y: number) => (side === 0 ? x >= left : side === 1 ? x <= right : side === 2 ? y >= top : y <= bottom);
    let px = from[(n - 1) * 2], py = from[(n - 1) * 2 + 1], pin = inside(px, py);
    for (let i = 0; i < n; i++) {
      const x = from[i * 2], y = from[i * 2 + 1], now = inside(x, y);
      if (now !== pin) {
        // Where the edge crosses this side of the rectangle.
        const t = side < 2 ? ((side === 0 ? left : right) - px) / (x - px) : ((side === 2 ? top : bottom) - py) / (y - py);
        to[m * 2] = side < 2 ? (side === 0 ? left : right) : px + (x - px) * t;
        to[m * 2 + 1] = side < 2 ? py + (y - py) * t : (side === 2 ? top : bottom);
        m++;
      }
      if (now) { to[m * 2] = x; to[m * 2 + 1] = y; m++; }
      px = x; py = y; pin = now;
    }
    from = to; n = m; flip = 1 - flip; to = work[flip];
  }
  return { points: from, count: n };
}
/** Cut one stroke of a line to a rectangle: Liang and Barsky. Returns null where it misses it. */
export function clipStroke(x0: number, y0: number, x1: number, y1: number, left: number, top: number, right: number, bottom: number): [number, number, number, number] | null {
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dy = y1 - y0;
  for (const [p, q] of [[-dx, x0 - left], [dx, right - x0], [-dy, y0 - top], [dy, bottom - y0]] as const) {
    if (p === 0) { if (q < 0) return null; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return [x0 + dx * t0, y0 + dy * t0, x0 + dx * t1, y0 + dy * t1];
}
