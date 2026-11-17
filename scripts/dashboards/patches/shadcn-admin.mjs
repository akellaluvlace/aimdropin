// TanStack Router needs the demo base path.
import { replaceOnce, BASE_NOSLASH } from "./_lib.mjs";
replaceOnce("src/main.tsx", "const router = createRouter({\n  routeTree,", `const router = createRouter({\n  basepath: ${JSON.stringify(BASE_NOSLASH)},\n  routeTree,`);
