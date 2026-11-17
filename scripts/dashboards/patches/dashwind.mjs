// DashWind: router base, demo login, base-relative logo and redirects, and a
// local Leads list (reqres.in now wants an API key for /api/users).
import { addBasename, replaceOnce, replaceAll, prefixPublicPaths, BASE_NOSLASH } from "./_react-cra.mjs";

addBasename("src/App.js", "Router");
// Open signed in, on the dashboard (the login is fake: any token will do).
replaceOnce("src/App.js", '<Navigate to={token ? "/app/welcome" : "/login"} replace />', '<Navigate to={token ? "/app/dashboard" : "/login"} replace />');
replaceOnce("src/app/auth.js", 'const TOKEN = localStorage.getItem("token")', 'const TOKEN = localStorage.getItem("token") || "DumyTokenHere"');
replaceOnce("src/app/auth.js", "window.location.href = '/login'", `window.location.href = ${JSON.stringify(BASE_NOSLASH + "/login")}`);
for (const f of ["src/features/user/Login.js", "src/features/user/Register.js"]) {
  replaceOnce(f, "window.location.href = '/app/welcome'", `window.location.href = ${JSON.stringify(BASE_NOSLASH + "/app/welcome")}`);
}
replaceOnce("src/containers/Header.js", "window.location.href = '/'", `window.location.href = ${JSON.stringify(BASE_NOSLASH + "/")}`);
prefixPublicPaths(["src/containers/LeftSidebar.js", "src/features/user/LandingIntro.js"], ["/logo192.png"]);

const leads = [
  [7, "michael.lawson@reqres.in", "Michael", "Lawson"],
  [8, "lindsay.ferguson@reqres.in", "Lindsay", "Ferguson"],
  [9, "tobias.funke@reqres.in", "Tobias", "Funke"],
  [10, "byron.fields@reqres.in", "Byron", "Fields"],
  [11, "george.edwards@reqres.in", "George", "Edwards"],
  [12, "rachel.howell@reqres.in", "Rachel", "Howell"],
].map(([id, email, first_name, last_name]) => ({ id, email, first_name, last_name, avatar: `https://reqres.in/img/faces/${id}-image.jpg` }));
replaceOnce(
  "src/features/leads/leadSlice.js",
  "const response = await axios.get('/api/users?page=2', {})\n\treturn response.data;",
  `return { data: ${JSON.stringify(leads)} };`,
);
// axios is otherwise unused in the slice now; keep the import harmless.
replaceAll("src/features/leads/leadSlice.js", "import axios from 'axios'", "");
