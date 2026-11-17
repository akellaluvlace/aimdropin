// Material Tailwind Dashboard: router basename and public /img/ paths under the demo base.
import { replaceOnce, BASE_NOSLASH } from "./_lib.mjs";
import { prefixPublicPaths } from "./_react-vite.mjs";
replaceOnce("src/main.jsx", "<BrowserRouter>", `<BrowserRouter basename=${JSON.stringify(BASE_NOSLASH)}>`);
prefixPublicPaths("src", ["img"], { min: 20 });
