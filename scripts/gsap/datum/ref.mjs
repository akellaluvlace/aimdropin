// A JPEG copy of a master, to send as the reference of an edit job (a 10 MB PNG is too much to post):
//   node scripts/gsap/datum/ref.mjs <master file> <ref name> [width]
// Both are files in .cache/gsap/datum-masters. It is a plain copy at the master's own size unless a width is given.
import path from 'node:path';
import sharp from 'sharp';
import { masters } from './paths.mjs';

const [from, to, width] = process.argv.slice(2);
if (!from || !to) throw new Error('Usage: node scripts/gsap/datum/ref.mjs <master file> <ref name> [width]');
let image = sharp(path.join(masters, from));
if (width) image = image.resize({ width: Number(width) });
const info = await image.jpeg({ quality: 93, chromaSubsampling: '4:4:4' }).toFile(path.join(masters, to));
console.log(`${to}: ${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB`);
