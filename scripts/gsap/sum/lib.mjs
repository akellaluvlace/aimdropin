// Image helpers for the Sum demo's parts: raw RGBA buffers, masks by radius, outlines traced from alpha.
import sharp from 'sharp';

/** A photograph as straight RGBA. */
export async function load(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * A square cut from a photograph, centred on (cx, cy), `half` source pixels to each side, resampled to
 * `size` pixels. Outside the photograph is transparent. Bicubic, which keeps machining marks crisp.
 */
export async function square(file, cx, cy, half, size) {
  const side = Math.round(half * 2);
  const left = Math.round(cx - half), top = Math.round(cy - half);
  const { width, height } = await sharp(file).metadata();
  const pad = { left: Math.max(0, -left), top: Math.max(0, -top), right: Math.max(0, left + side - width), bottom: Math.max(0, top + side - height) };
  const cut = { left: Math.max(0, left), top: Math.max(0, top), width: side - pad.left - pad.right, height: side - pad.top - pad.bottom };
  const buffer = await sharp(file).ensureAlpha().extract(cut).extend({ ...pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const { data } = await sharp(buffer).resize(size, size, { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  return { data, width: size, height: size };
}

/** Multiplies alpha by a function of the distance from the centre (in pixels of this image). */
export function maskRadial(image, cx, cy, alphaAt) {
  const { data, width, height } = image;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4 + 3;
    if (!data[i]) continue;
    const keep = alphaAt(Math.hypot(x + 0.5 - cx, y + 0.5 - cy), x, y);
    if (keep < 1) data[i] = Math.round(data[i] * Math.max(0, keep));
  }
  return image;
}
/** A soft step: 1 inside `r`, 0 outside, one pixel wide. `inside` false turns it round. */
export const disc = (r, inside = true) => d => { const t = Math.max(0, Math.min(1, r - d + 0.5)); return inside ? t : 1 - t; };

/** Clears a rectangle (alpha to zero), with a soft pixel at its edges. */
export function erase(image, x0, y0, x1, y1) {
  const { data, width, height } = image;
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(height, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(width, Math.ceil(x1)); x++) data[(y * width + x) * 4 + 3] = 0;
  return image;
}

/** Colour bleeds outward into transparent pixels, so a texture filtered at its edge never shows black or white fringes. */
export function bleed(image, passes = 6) {
  const { data, width, height } = image;
  let known = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) known[i] = data[i * 4 + 3] > 8 ? 1 : 0;
  for (let pass = 0; pass < passes; pass++) {
    const next = known.slice();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (known[i]) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
        const j = yy * width + xx;
        if (!known[j]) continue;
        r += data[j * 4]; g += data[j * 4 + 1]; b += data[j * 4 + 2]; n++;
      }
      if (n) { data[i * 4] = r / n; data[i * 4 + 1] = g / n; data[i * 4 + 2] = b / n; next[i] = 1; }
    }
    known = next;
  }
  return image;
}

/** Mirrors left to right (a part seen from behind). */
export function mirror(image) {
  const { data, width, height } = image;
  const row = Buffer.alloc(width * 4);
  for (let y = 0; y < height; y++) {
    data.copy(row, 0, y * width * 4, (y + 1) * width * 4);
    for (let x = 0; x < width; x++) row.copy(data, (y * width + x) * 4, (width - 1 - x) * 4, (width - x) * 4);
  }
  return image;
}

export const clone = image => ({ data: Buffer.from(image.data), width: image.width, height: image.height });

/** Writes straight RGBA as webp with alpha. */
export async function saveWebp(image, file, quality = 88) {
  await sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } }).webp({ quality, alphaQuality: 92, effort: 6 }).toFile(file);
}
export async function resized(image, size) {
  const { data, info } = await sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } }).resize(size, Math.round(size * image.height / image.width), { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * Closed outlines of everything whose alpha passes `level`, by marching squares, in pixel coordinates
 * (pixel centres at +0.5). Each is a list of [x, y]; solid areas keep their inside on the left
 * (counter-clockwise in a y-up frame once flipped), holes run the other way.
 */
export function trace(image, level = 128) {
  const { data, width, height } = image;
  const W = width + 2, H = height + 2;
  const a = new Float32Array(W * H);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) a[(y + 1) * W + x + 1] = data[(y * width + x) * 4 + 3];
  const lerp = (v0, v1) => (level - v0) / (v1 - v0 || 1e-6);
  // Segments keyed by their start point, so they can be chained.
  const segments = new Map();
  const key = (x, y) => `${Math.round(x * 64)},${Math.round(y * 64)}`;
  const add = (x0, y0, x1, y1) => { const k = key(x0, y0); const list = segments.get(k); const item = [x0, y0, x1, y1]; if (list) list.push(item); else segments.set(k, [item]); };
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const tl = a[y * W + x], tr = a[y * W + x + 1], br = a[(y + 1) * W + x + 1], bl = a[(y + 1) * W + x];
    const code = (tl >= level ? 8 : 0) | (tr >= level ? 4 : 0) | (br >= level ? 2 : 0) | (bl >= level ? 1 : 0);
    if (code === 0 || code === 15) continue;
    // Edge crossings: top, right, bottom, left (in padded coordinates; corners are pixel centres).
    const top = [x + lerp(tl, tr), y], right = [x + 1, y + lerp(tr, br)], bottom = [x + lerp(bl, br), y + 1], left = [x, y + lerp(tl, bl)];
    // Direction: solid on the left of the direction of travel (image coordinates, y down).
    const emit = (from, to) => add(from[0], from[1], to[0], to[1]);
    switch (code) {
      case 1: emit(bottom, left); break;
      case 2: emit(right, bottom); break;
      case 3: emit(right, left); break;
      case 4: emit(top, right); break;
      case 5: emit(top, left); emit(bottom, right); break;
      case 6: emit(top, bottom); break;
      case 7: emit(top, left); break;
      case 8: emit(left, top); break;
      case 9: emit(bottom, top); break;
      case 10: emit(left, bottom); emit(right, top); break;
      case 11: emit(right, top); break;
      case 12: emit(left, right); break;
      case 13: emit(bottom, right); break;
      case 14: emit(left, bottom); break;
    }
  }
  const loops = [];
  for (const [, list] of segments) {
    while (list.length) {
      const first = list.pop();
      const loop = [[first[0], first[1]]];
      let [, , x, y] = first;
      for (let guard = 0; guard < 4e6; guard++) {
        loop.push([x, y]);
        const next = segments.get(key(x, y));
        if (!next || !next.length) break;
        const segment = next.pop();
        x = segment[2]; y = segment[3];
        if (key(x, y) === key(loop[0][0], loop[0][1])) break;
      }
      if (loop.length > 8) loops.push(loop.map(([px, py]) => [px - 0.5, py - 0.5]));
    }
  }
  return loops;
}

/** Signed area (positive when counter-clockwise in a y-up frame, so negative for y-down image loops that keep solid on the left... callers flip y first). */
export const area = loop => { let sum = 0; for (let i = 0; i < loop.length; i++) { const [x0, y0] = loop[i], [x1, y1] = loop[(i + 1) % loop.length]; sum += x0 * y1 - x1 * y0; } return sum / 2; };

/** Ramer-Douglas-Peucker on a closed loop. */
export function simplify(loop, tolerance) {
  if (loop.length < 8) return loop;
  // Start from the two points furthest apart, then simplify each half as an open line.
  let far = 0, best = 0;
  for (let i = 1; i < loop.length; i++) { const d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]); if (d > best) { best = d; far = i; } }
  const open = points => {
    const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
    const stack = [[0, points.length - 1]];
    while (stack.length) {
      const [from, to] = stack.pop();
      const [ax, ay] = points[from], [bx, by] = points[to];
      const length = Math.hypot(bx - ax, by - ay) || 1e-9;
      let worst = 0, index = -1;
      for (let i = from + 1; i < to; i++) { const d = Math.abs((points[i][0] - ax) * (by - ay) - (points[i][1] - ay) * (bx - ax)) / length; if (d > worst) { worst = d; index = i; } }
      if (worst > tolerance && index > 0) { keep[index] = 1; stack.push([from, index], [index, to]); }
    }
    return points.filter((_, i) => keep[i]);
  };
  const first = open(loop.slice(0, far + 1)), second = open([...loop.slice(far), loop[0]]);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

/** A smoothing pass (Chaikin would round corners; this only averages neighbours a little). */
export function relax(loop, amount = 0.25) {
  return loop.map((point, i) => { const a = loop[(i - 1 + loop.length) % loop.length], b = loop[(i + 1) % loop.length]; return [point[0] * (1 - amount) + (a[0] + b[0]) * amount / 2, point[1] * (1 - amount) + (a[1] + b[1]) * amount / 2]; });
}
