// Modernize React Lite (package/): createBrowserRouter needs the demo base path.
import { replaceOnce, BASE_NOSLASH } from "./_lib.mjs";
replaceOnce("package/src/routes/Router.js", "const router = createBrowserRouter(Router);", `const router = createBrowserRouter(Router, { basename: ${JSON.stringify(BASE_NOSLASH)} });`);
