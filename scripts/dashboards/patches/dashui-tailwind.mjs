// imagemin's optimizers are native binaries fetched by install scripts,
// which stay blocked; copy images unoptimized instead.
import { readFileSync, writeFileSync } from "node:fs";
const f = "gulpfile.js";
let s = readFileSync(f, "utf8");
const before = s;
s = s.replace(/const imagemin = require\("gulp-imagemin"\);\s*const jpegrecompress = require\("imagemin-jpeg-recompress"\);\s*const pngquant = require\("imagemin-pngquant"\);/, "");
s = s.replace(/\.pipe\(\s*imagemin\(\[[\s\S]*?\]\),\s*\)/, "");
if (s === before || /imagemin/.test(s)) throw new Error("patch: imagemin code not found as expected");
writeFileSync(f, s);
