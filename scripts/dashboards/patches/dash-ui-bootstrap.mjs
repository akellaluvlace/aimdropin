// Pages link unminified vendor CSS that gulp-npm-dist skips by default.
import { replaceOnce } from "./_lib.mjs";
replaceOnce("gulpfile.js", "src(npmDist(), { base: paths.base.node })", "src(npmDist({ copyUnminified: true }), { base: paths.base.node })");
