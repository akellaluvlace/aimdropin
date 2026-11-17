// TailAdmin React v1: BrowserRouter needs the demo base path.
import { replaceOnce, BASE_NOSLASH } from "./_lib.mjs";
replaceOnce("src/main.tsx", "<Router>", `<Router basename=${JSON.stringify(BASE_NOSLASH)}>`);
