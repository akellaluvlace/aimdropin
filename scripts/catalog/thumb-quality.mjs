#!/usr/bin/env node
// Measure how much of each catalog thumbnail is actual content, to catch
// previews that "rendered" but show next to nothing (a dialog that only
// shows its trigger button, an empty shell, a missing-image grid).
//
//   node scripts/catalog/thumb-quality.mjs
//
// Writes .cache/catalog/thumb-quality.json: { "<thumb path>": coverage },
// where coverage is the share of pixels (0-1) that differ clearly from the
// image's dominant colour. publish-catalog drops items below the threshold.

import { existsSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const DIRS = [
  "public/catalog-thumbs/r",
  "public/catalog-thumbs",
  "public/component-thumbs",
];
const OUT = path.join(ROOT, ".cache/catalog/thumb-quality.json");

export async function coverage(file) {
  const { data, info } = await sharp(file)
    .resize(96, 60, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const px = info.width * info.height;
  // Dominant colour = most common colour after coarse quantisation.
  const counts = new Map();
  for (let i = 0; i < data.length; i += 3) {
    const key =
      ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let bestKey = 0;
  let best = -1;
  for (const [k, n] of counts) if (n > best) [best, bestKey] = [n, k];
  const br = ((bestKey >> 8) & 15) * 16 + 8;
  const bg = ((bestKey >> 4) & 15) * 16 + 8;
  const bb = (bestKey & 15) * 16 + 8;
  let differ = 0;
  for (let i = 0; i < data.length; i += 3) {
    if (
      Math.abs(data[i] - br) > 28 ||
      Math.abs(data[i + 1] - bg) > 28 ||
      Math.abs(data[i + 2] - bb) > 28
    )
      differ++;
  }
  return differ / px;
}

const out = {};
for (const dir of DIRS) {
  const abs = path.join(ROOT, dir);
  if (!existsSync(abs)) continue;
  for (const f of readdirSync(abs)) {
    if (!f.endsWith(".webp")) continue;
    out[`/${dir.replace(/^public\//, "")}/${f}`] = Number(
      (await coverage(path.join(abs, f))).toFixed(4),
    );
  }
}
writeFileSync(OUT, JSON.stringify(out));
const vals = Object.values(out);
const low = vals.filter((v) => v < 0.04).length;
console.log(
  `${vals.length} thumbnails measured, ${low} under 4% content → ${path.relative(ROOT, OUT)}`,
);
