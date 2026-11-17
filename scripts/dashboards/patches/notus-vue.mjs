// Vue Notus: publicPath and router history at the demo base.
import { replaceOnce } from "./_lib.mjs";
import { vueCliPublicPath } from "./_vue.mjs";
vueCliPublicPath();
replaceOnce("src/main.js", "history: createWebHistory(),", "history: createWebHistory(process.env.BASE_URL),");
// Google Maps can't load in the demo sandbox.
import { dropGoogleMapsScript, guardMapsMounted } from "./_vue.mjs";
dropGoogleMapsScript();
guardMapsMounted("src/components/Maps/MapExample.vue");
// Open the admin dashboard at the root; the UI-kit index page moves to /index.
replaceOnce("src/main.js", '    path: "/",\n    component: Index,', '    path: "/",\n    redirect: "/admin/dashboard",\n  },\n  {\n    path: "/index",\n    component: Index,');
