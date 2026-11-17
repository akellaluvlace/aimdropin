// Demo build: the bundle visualizer must not try to open a browser in the
// container, and react-admin runs under browser history at the demo base
// (it uses an enclosing router instead of its default HashRouter).
import { replaceOnce, BASE_NOSLASH } from "./_lib.mjs";
replaceOnce("vite.demo.config.ts", 'open: process.env.NODE_ENV !== "CI",', "open: false,");
replaceOnce("demo/main.tsx", 'import App from "./App.tsx";', 'import App from "./App.tsx";\nimport { BrowserRouter } from "react-router";');
replaceOnce("demo/main.tsx", "<App />", `<BrowserRouter basename=${JSON.stringify(BASE_NOSLASH)}><App /></BrowserRouter>`);
