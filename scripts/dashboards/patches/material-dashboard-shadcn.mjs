// Material Dashboard Shadcn: browser history under the demo base instead of
// HashRouter (the demo root is served without its trailing slash, which hash
// links don't survive).
import { replaceOnce, BASE_NOSLASH } from "./_lib.mjs";
replaceOnce("client/src/App.tsx", 'import { HashRouter, Routes, Route } from "react-router-dom";', 'import { BrowserRouter as HashRouter, Routes, Route } from "react-router-dom";');
replaceOnce("client/src/App.tsx", "<HashRouter>", `<HashRouter basename=${JSON.stringify(BASE_NOSLASH)}>`);
