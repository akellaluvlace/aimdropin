// Helpers for the vue batch patches. Like _lib.mjs, everything fails loudly
// when the code it expects isn't there.
import { replaceOnce } from "./_lib.mjs";
export { replaceInTree, prefixPublicPaths } from "./_react-vite.mjs";

/** Point a vue-router history at the bundler base (import.meta.env.BASE_URL). */
export function historyAtBase(file, search) {
  replaceOnce(file, search, "createWebHistory(import.meta.env.BASE_URL)");
}

/** Switch createWebHashHistory to createWebHistory at the bundler base. */
export function hashToHistory(file, call = /createWebHashHistory\([^)]*\)/) {
  replaceOnce(file, call, "createWebHistory(import.meta.env.BASE_URL)");
  replaceOnce(file, /(import\s*\{[^}]*)\bcreateWebHashHistory\b/, "$1createWebHistory");
}

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { BASE } from "./_lib.mjs";

/** Vue CLI: serve the build from the demo base (publicPath). */
export function vueCliPublicPath(file = "vue.config.js") {
  if (!existsSync(file)) {
    writeFileSync(file, `module.exports = { publicPath: ${JSON.stringify(BASE)} };\n`);
    return;
  }
  const s = readFileSync(file, "utf8");
  if (!s.includes("module.exports")) throw new Error(`patch: ${file} has no module.exports`);
  writeFileSync(file, `${s}\nmodule.exports.publicPath = ${JSON.stringify(BASE)};\n`);
}

/** vue-router 3: history mode at the Vue CLI base (process.env.BASE_URL). */
export function vueRouter3History(file) {
  replaceOnce(file, "new VueRouter({", "new VueRouter({\n  mode: 'history',\n  base: process.env.BASE_URL,");
}

/** Google Maps can't load in the demo sandbox: drop its <script> tag. */
export function dropGoogleMapsScript(file = "public/index.html") {
  replaceOnce(file, /<script[^>]*?\s+src="https:\/\/maps\.googleapis\.com[^"]*"[^>]*>\s*<\/script>/, "");
}

/** Make a Maps page skip map setup when Google Maps isn't loaded. */
export function guardMapsMounted(file) {
  replaceOnce(file, /mounted\s*\(\)\s*\{/, "mounted() {\n    if (!window.google || !window.google.maps) return;");
}
