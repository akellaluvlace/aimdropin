// Flowbite React admin: router basename, public /images/ paths under the demo
// base, and the sidebar's plain <a href="/..."> links (not router links) too.
import { replaceOnce, BASE, BASE_NOSLASH } from "./_lib.mjs";
import { prefixPublicPaths, replaceInTree } from "./_react-vite.mjs";
replaceOnce("src/index.tsx", "<BrowserRouter>", `<BrowserRouter basename=${JSON.stringify(BASE_NOSLASH)}>`);
prefixPublicPaths("src", ["images"], { min: 10 });
replaceInTree("src", /href="\/(e-commerce|users|authentication)\//g, `href="${BASE}$1/`, { min: 4 });
replaceInTree("src", /href="\/"/g, `href="${BASE}"`, { min: 1 });
