// K-WD hardcodes its GitHub Pages base; serve it from the demo base instead.
import { replaceOnce, BASE } from "./_lib.mjs";
replaceOnce("src/support/index.js", "export const baseUrl = '/kwd-dashboard/'", `export const baseUrl = ${JSON.stringify(BASE)}`);
