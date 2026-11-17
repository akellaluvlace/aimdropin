// react-admin runs under browser history at the demo base (it uses an
// enclosing router instead of its default HashRouter).
import { replaceOnce, BASE_NOSLASH } from "./_lib.mjs";
replaceOnce("src/main.tsx", 'import App from "./demo/App.tsx";', 'import App from "./demo/App.tsx";\nimport { BrowserRouter } from "react-router";');
replaceOnce("src/main.tsx", "<App />", `<BrowserRouter basename=${JSON.stringify(BASE_NOSLASH)}><App /></BrowserRouter>`);
