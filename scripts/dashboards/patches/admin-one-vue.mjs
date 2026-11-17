// Admin One Vue: history routing at the demo base; sample JSON is fetched
// relative to the page, so anchor it at the base.
import { replaceOnce } from "./_lib.mjs";
import { hashToHistory } from "./_vue.mjs";
hashToHistory("src/router/index.js");
replaceOnce("src/stores/main.js", ".get(`data-sources/clients.json?v=3`)", ".get(`${import.meta.env.BASE_URL}data-sources/clients.json?v=3`)");
replaceOnce("src/stores/main.js", ".get(`data-sources/history.json`)", ".get(`${import.meta.env.BASE_URL}data-sources/history.json`)");
// The root route is a style picker that moves on by click only: open the
// dashboard at the root and keep the picker at /style.
replaceOnce("src/router/index.js", "    path: '/',\n    name: 'style',", "    path: '/style',\n    name: 'style',");
replaceOnce("src/router/index.js", "const routes = [\n", "const routes = [\n  { path: '/', redirect: '/dashboard' },\n");
// Menu items pass href=null to RouterLink, which strips its real href: only
// plain links get an href attribute.
import { replaceInTree } from "./_vue.mjs";
replaceInTree("src/components", ':href="item.href ?? null"', 'v-bind="item.to ? {} : { href: item.href ?? null }"', { exts: [".vue"] });
