// The proof-of-delivery photograph for the Meridian demo, from its generated master.
//   node scripts/gsap/meridian/prepare.mjs
// Reads .cache/gsap/meridian-masters/proof-counter.png (made by `node scripts/gsap/meridian/gen.mjs
// scripts/gsap/meridian/jobs/proof.json`, which spends fal credit) and writes public/assets/gsap/meridian/proof.webp,
// the size the card shows it at on a screen of two device pixels to one.
import path from 'node:path';
import sharp from 'sharp';
import { assets, masters } from './paths.mjs';

const from = path.join(masters, 'proof-counter.png'), to = path.join(assets, 'proof.webp');
const { size } = await sharp(from).resize(1200, 900, { fit: 'cover' }).webp({ quality: 84 }).toFile(to);
console.log(`${path.relative(process.cwd(), to)}: 1200 x 900, ${Math.round(size / 1024)} KB`);
