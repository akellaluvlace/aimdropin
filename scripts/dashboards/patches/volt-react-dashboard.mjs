// HashRouter app: no basename needed. Open on the dashboard overview; the
// product presentation page moves from #/ to #/presentation (the sidebar links to it).
import { replaceOnce } from "./_react-cra.mjs";
replaceOnce("src/routes.js", 'Presentation: { path: "/" }', 'Presentation: { path: "/presentation" }');
replaceOnce(
  "src/pages/HomePage.js",
  "<RouteWithLoader exact path={Routes.Presentation.path} component={Presentation} />",
  '<Redirect exact from="/" to={Routes.DashboardOverview.path} />\n    <RouteWithLoader exact path={Routes.Presentation.path} component={Presentation} />',
);
// The lockfile predates the "sass" dependency; today's ^1.50 resolves to a Sass
// whose CSS output the CRA 3 PostCSS parser rejects. Pin a Sass from the template's own era (Bootstrap 5 beta).
import { editJson } from "./_react-cra.mjs";
editJson("package.json", (p) => {
  p.dependencies.sass = "1.32.13";
});
// The crawler reads a page whose top text says "404 ... Not Found" as a missing
// page; the expanded sidebar's "404 Not Found" link made every page look like one.
replaceOnce("src/components/Sidebar.js", '<NavItem title="404 Not Found"', '<NavItem title="Error 404"');
