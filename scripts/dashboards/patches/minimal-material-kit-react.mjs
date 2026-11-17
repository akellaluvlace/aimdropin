// Minimal Material Kit: router basename, public /assets/ paths under the demo
// base, and no type-check/lint pass inside the build.
import { replaceOnce, BASE_NOSLASH } from "./_lib.mjs";
import { prefixPublicPaths } from "./_react-vite.mjs";
replaceOnce("src/main.tsx", "]);\n\nconst root", `], { basename: ${JSON.stringify(BASE_NOSLASH)} });\n\nconst root`);
replaceOnce("vite.config.ts", "checker({", "checker({\n      enableBuild: false,");
prefixPublicPaths("src", ["assets"], { min: 10 });
