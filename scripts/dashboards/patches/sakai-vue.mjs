// Sakai Vue: router at the demo base. /demo/** public images in JS strings
// and bound attributes follow the base (static src="/demo/..." attributes are
// already rewritten by Vite).
import { BASE } from "./_lib.mjs";
import { historyAtBase, replaceInTree } from "./_vue.mjs";
historyAtBase("src/router/index.js", "createWebHistory()");
replaceInTree("src", /(?<!\bsrc=)(["'`])\/demo\//g, (_m, q) => `${q}${BASE}demo/`, { exts: [".js", ".ts", ".vue"] });
