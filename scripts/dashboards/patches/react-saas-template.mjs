// BrowserRouter needs the demo base. The logged-in area (/c/...) is only reached
// through the fake login dialog; add a "Dashboard" link to the landing navbar so
// visitors (and the crawl) can open it directly.
import { addBasename, replaceOnce } from "./_react-cra.mjs";
addBasename("src/App.js");
replaceOnce(
  "src/logged_out/components/navigation/NavBar.js",
  '    {\n      link: "/blog",\n      name: "Blog",',
  '    {\n      link: "/c/dashboard",\n      name: "Dashboard",\n      icon: <HomeIcon className="text-white" />\n    },\n    {\n      link: "/blog",\n      name: "Blog",',
);
// No service worker: demos run in a sandbox where its script can't be registered.
replaceOnce("src/index.js", "serviceWorkerRegistration.register();", "serviceWorkerRegistration.unregister();");
// date-fns only came in transitively through the stale lockfile; declare it.
import { editJson } from "./_react-cra.mjs";
editJson("package.json", (p) => {
  p.dependencies["date-fns"] = "^2.28.0";
});
