// Vue Light Bootstrap Dashboard: publicPath and history routing at the demo
// base. vue2-google-maps loads Google Maps on startup, which can't run in the
// demo sandbox: the Maps page shows a static placeholder card instead.
import { writeFileSync } from "node:fs";
import { replaceOnce } from "./_lib.mjs";
import { vueCliPublicPath, vueRouter3History } from "./_vue.mjs";
vueCliPublicPath();
vueRouter3History("src/main.js");
replaceOnce("src/pages/Maps.vue", "import * as VueGoogleMaps from 'vue2-google-maps'", "");
writeFileSync(
  "src/pages/Maps.vue",
  `<template>
  <div class="content"><div class="container-fluid"><div class="card"><div class="card-body" style="height:420px;display:flex;align-items:center;justify-content:center;background:#e5e3df;color:#666">
    Google Maps (needs an API key): 40.748817, -73.985428
  </div></div></div></div>
</template>
<script>
  export default {}
</script>
`,
);
// Public images are referenced relative to the page ("img/x.png"), which
// breaks below the root with history routing: anchor them at the base.
import { BASE } from "./_lib.mjs";
import { replaceInTree } from "./_vue.mjs";
replaceInTree("src", /(["'])img\//g, (_m, q) => `${q}${BASE}img/`, { exts: [".vue", ".js"], min: 3 });
