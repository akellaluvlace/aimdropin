// Shared by the Datum demo's measuring and registering scripts: load a picture as numbers, find an edge
// along a row or a column, match a patch of one picture in another, fit and apply a correction.
// Nothing here talks to fal or costs anything.
import sharp from 'sharp';

/** A picture as raw RGB. */
export async function load(file) {
  const { data, info } = await sharp(file).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}
/** Its luminance, one float a pixel. */
export function luma({ data, width, height, channels }) {
  const out = new Float32Array(width * height);
  for (let i = 0, j = 0; i < out.length; i++, j += channels) out[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
  return out;
}
/** How green each pixel is: where grass begins against a wall of any tone, this is the edge that shows. */
export function greenness({ data, width, height, channels }) {
  const out = new Float32Array(width * height);
  for (let i = 0, j = 0; i < out.length; i++, j += channels) out[i] = data[j + 1] - (data[j] + data[j + 2]) / 2;
  return out;
}
/** How strong the edge is at each pixel (Sobel), whichever way the light falls: it is what survives a change of light or of material. */
export function gradient(l, width, height) {
  const out = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx = l[i - width + 1] + 2 * l[i + 1] + l[i + width + 1] - l[i - width - 1] - 2 * l[i - 1] - l[i + width - 1];
      const gy = l[i + width - 1] + 2 * l[i + width] + l[i + width + 1] - l[i - width - 1] - 2 * l[i - width] - l[i - width + 1];
      out[i] = Math.hypot(gx, gy);
    }
  }
  return out;
}
export const median = values => { const sorted = [...values].sort((a, b) => a - b); const mid = sorted.length >> 1; return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; };
/** A straight line through points [t, v], with the far-off ones left out: v = at + slope * (t - mid). */
export function fitLine(points, keep = 2.5) {
  let used = points;
  let line = { at: median(points.map(p => p[1])), slope: 0, mid: 0, spread: 0, count: points.length };
  for (let pass = 0; pass < 3; pass++) {
    const mid = used.reduce((s, p) => s + p[0], 0) / used.length;
    const mean = used.reduce((s, p) => s + p[1], 0) / used.length;
    let num = 0, den = 0;
    for (const [t, v] of used) { num += (t - mid) * (v - mean); den += (t - mid) * (t - mid); }
    const slope = den ? num / den : 0;
    const residuals = used.map(([t, v]) => v - (mean + slope * (t - mid)));
    const spread = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length);
    line = { at: mean, slope, mid, spread, count: used.length };
    const next = points.filter(([t, v]) => Math.abs(v - (mean + slope * (t - mid))) <= keep);
    if (next.length === used.length || next.length < 8) break;
    used = next;
  }
  return line;
}
/**
 * Where the strongest edge of one sign is along a column (axis 'y') or a row (axis 'x'), between from and to,
 * to a fraction of a pixel. `sign` +1 looks for dark to light in the direction of travel, -1 for light to dark.
 * The profile is averaged over `band` pixels either side, across the direction of travel.
 */
export function edge(l, width, height, axis, fixed, from, to, sign, band = 2) {
  const at = t => {
    let sum = 0, n = 0;
    for (let o = -band; o <= band; o++) {
      const x = axis === 'y' ? fixed + o : t, y = axis === 'y' ? t : fixed + o;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      sum += l[y * width + x]; n++;
    }
    return sum / n;
  };
  let best = -Infinity, where = from;
  const d = t => sign * (at(t + 2) - at(t - 2));
  for (let t = from; t <= to; t++) { const v = d(t); if (v > best) { best = v; where = t; } }
  // The top of a parabola through the peak and its neighbours.
  const a = d(where - 1), b = best, c = d(where + 1), den = a - 2 * b + c;
  return { at: where + (den < 0 ? 0.5 * (a - c) / den : 0), strength: best / 4 };
}

/**
 * Where the patch of picture `a` centred on (cx, cy) lies in picture `b`: the shift (dx, dy), to a fraction of
 * a pixel, at which the two agree best (normalised cross-correlation), looked for up to `reach` pixels away.
 */
export function match(a, b, width, height, cx, cy, half, reach) {
  cx = Math.round(cx); cy = Math.round(cy);
  if (cx - half - reach < 1 || cy - half - reach < 1 || cx + half + reach >= width - 1 || cy + half + reach >= height - 1) return null;
  const n = (2 * half + 1) ** 2;
  let sumA = 0, sumAA = 0;
  for (let y = cy - half; y <= cy + half; y++) for (let x = cx - half; x <= cx + half; x++) { const v = a[y * width + x]; sumA += v; sumAA += v * v; }
  const varA = sumAA - (sumA * sumA) / n;
  if (varA <= 1e-6) return null;
  const size = 2 * reach + 1, scores = new Float32Array(size * size);
  let best = -2, bx = 0, by = 0;
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      let sumB = 0, sumBB = 0, sumAB = 0;
      for (let y = cy - half; y <= cy + half; y++) {
        const ra = y * width, rb = (y + dy) * width + dx;
        for (let x = cx - half; x <= cx + half; x++) { const va = a[ra + x], vb = b[rb + x]; sumB += vb; sumBB += vb * vb; sumAB += va * vb; }
      }
      const varB = sumBB - (sumB * sumB) / n;
      const score = varB > 1e-6 ? (sumAB - (sumA * sumB) / n) / Math.sqrt(varA * varB) : -1;
      scores[(dy + reach) * size + dx + reach] = score;
      if (score > best) { best = score; bx = dx; by = dy; }
    }
  }
  const s = (dx, dy) => (Math.abs(dx) > reach || Math.abs(dy) > reach ? best - 1 : scores[(dy + reach) * size + dx + reach]);
  const peak = (lo, mid, hi) => { const den = lo - 2 * mid + hi; return den < 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (lo - hi) / den)) : 0; };
  return { dx: bx + peak(s(bx - 1, by), best, s(bx + 1, by)), dy: by + peak(s(bx, by - 1), best, s(bx, by + 1)), score: best, edge: Math.abs(bx) === reach || Math.abs(by) === reach };
}

/**
 * The correction that best explains a set of shifts: a point (x, y) of the master is found at
 * (sx * x + tx, sy * y + ty) in the other picture. Each direction is fitted on its own, from the patches
 * that can tell it: a patch on a level edge knows how far it moved up or down and nothing about sideways
 * (`use: 'y'`), a corner knows both. Readings more than `keep` px from the fit are left out and it is
 * fitted again. With `move`, the scale is held at 1 and only a move is fitted.
 */
export function fitShift(points, { keep = 1.6, move = false } = {}) {
  const solve = list => { // v = s * t + o, from [t, v] pairs
    const n = list.length;
    if (!n) return { s: 1, o: 0, n: 0 };
    const mt = list.reduce((a, p) => a + p[0], 0) / n, mv = list.reduce((a, p) => a + p[1], 0) / n;
    let num = 0, den = 0;
    for (const [t, v] of list) { num += (t - mt) * (v - mv); den += (t - mt) ** 2; }
    const s = move || !den || n < 4 ? 1 : num / den;
    return { s, o: mv - s * mt, n };
  };
  const axis = (key, shift, letter) => {
    let used = points.filter(p => (p.use ?? 'xy').includes(letter));
    let fit = solve(used.map(p => [p[key], p[key] + p[shift]]));
    for (let pass = 0; pass < 4; pass++) {
      const next = used.filter(p => Math.abs(p[key] + p[shift] - (fit.s * p[key] + fit.o)) <= keep);
      if (next.length === used.length || next.length < 3) break;
      used = next;
      fit = solve(used.map(p => [p[key], p[key] + p[shift]]));
    }
    const left = used.map(p => p[key] + p[shift] - (fit.s * p[key] + fit.o));
    return { ...fit, used, rms: Math.sqrt(left.reduce((s, r) => s + r * r, 0) / Math.max(1, left.length)), worst: Math.max(0, ...left.map(Math.abs)) };
  };
  const fx = axis('x', 'dx', 'x'), fy = axis('y', 'dy', 'y');
  return { sx: fx.s, sy: fy.s, tx: fx.o, ty: fy.o, x: fx, y: fy };
}

/**
 * A picture redrawn so that it lies over the master: output pixel (x, y) is taken from the source at
 * (sx * x + tx, sy * y + ty), with a Catmull-Rom filter. Edges repeat.
 */
export function warp(image, { sx, sy, tx, ty }) {
  const { data, width, height, channels } = image;
  const out = Buffer.alloc(width * height * channels);
  const weights = t => { const t2 = t * t, t3 = t2 * t; return [-0.5 * t3 + t2 - 0.5 * t, 1.5 * t3 - 2.5 * t2 + 1, -1.5 * t3 + 2 * t2 + 0.5 * t, 0.5 * t3 - 0.5 * t2]; };
  const clampX = x => (x < 0 ? 0 : x >= width ? width - 1 : x), clampY = y => (y < 0 ? 0 : y >= height ? height - 1 : y);
  const columns = new Array(width);
  for (let x = 0; x < width; x++) { const fx = sx * x + tx, ix = Math.floor(fx); columns[x] = { at: [clampX(ix - 1), clampX(ix), clampX(ix + 1), clampX(ix + 2)], w: weights(fx - ix) }; }
  for (let y = 0; y < height; y++) {
    const fy = sy * y + ty, iy = Math.floor(fy), wy = weights(fy - iy);
    const rows = [clampY(iy - 1), clampY(iy), clampY(iy + 1), clampY(iy + 2)].map(r => r * width * channels);
    for (let x = 0; x < width; x++) {
      const { at, w } = columns[x];
      for (let c = 0; c < channels; c++) {
        let sum = 0;
        for (let j = 0; j < 4; j++) { const row = rows[j]; sum += wy[j] * (w[0] * data[row + at[0] * channels + c] + w[1] * data[row + at[1] * channels + c] + w[2] * data[row + at[2] * channels + c] + w[3] * data[row + at[3] * channels + c]); }
        out[(y * width + x) * channels + c] = sum < 0 ? 0 : sum > 255 ? 255 : Math.round(sum);
      }
    }
  }
  return { data: out, width, height, channels };
}
/** Save raw RGB as a PNG. */
export const savePng = (image, file) => sharp(image.data, { raw: { width: image.width, height: image.height, channels: image.channels } }).png({ compressionLevel: 6 }).toFile(file);
