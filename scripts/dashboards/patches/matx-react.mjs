// MatX: use the bundled JWT auth (axios-mock-adapter fake API) instead of
// Firebase, sign the demo user in on load, set the router basename and keep
// public /assets/ paths under the demo base.
import { replaceOnce, BASE_NOSLASH } from "./_lib.mjs";
import { prefixPublicPaths } from "./_react-vite.mjs";
replaceOnce("src/app/App.jsx", 'from "./contexts/FirebaseAuthContext"', 'from "./contexts/JWTAuthContext"');
replaceOnce("src/app/hooks/useAuth.js", 'from "app/contexts/FirebaseAuthContext"', 'from "app/contexts/JWTAuthContext"');
replaceOnce(
  "src/app/contexts/JWTAuthContext.jsx",
  "payload: { isAuthenticated: false, user: null }",
  'payload: { isAuthenticated: true, user: (await axios.post("/api/auth/login", { email: "jason@ui-lib.com", password: "demo" })).data.user }',
);
replaceOnce("src/main.jsx", "<BrowserRouter>", `<BrowserRouter basename=${JSON.stringify(BASE_NOSLASH)}>`);
prefixPublicPaths("src", ["assets"], { min: 20 });
// Pro-only menu links land on the image-only 404 page; give it a 404 title
// (no visual change) so they read as dead links rather than empty pages.
replaceOnce("src/app/views/sessions/NotFound.jsx", "export default function NotFound() {\n", 'export default function NotFound() {\n  useEffect(() => { const t = document.title; document.title = "404 - Page not found"; return () => { document.title = t; }; }, []);\n');
replaceOnce("src/app/views/sessions/NotFound.jsx", "import ", 'import { useEffect } from "react";\nimport ');
