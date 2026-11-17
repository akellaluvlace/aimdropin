// CoreUI: browser history under the demo base instead of HashRouter (the demo
// root is served without its trailing slash, which hash links don't survive).
import { replaceOnce, BASE_NOSLASH } from "./_lib.mjs";
replaceOnce("src/App.jsx", "import { HashRouter, Route, Routes } from 'react-router-dom'", "import { BrowserRouter as HashRouter, Route, Routes } from 'react-router-dom'");
replaceOnce("src/App.jsx", "<HashRouter>", `<HashRouter basename=${JSON.stringify(BASE_NOSLASH)}>`);
