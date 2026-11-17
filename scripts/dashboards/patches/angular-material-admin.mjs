// Angular Material Admin: history routing, "/" opens the dashboard and the
// demo starts signed in (the template's login just stores a dummy token).
import { replaceOnce } from "./_lib.mjs";
import { dropUseHash, dropBudgets } from "./_angular.mjs";
const f = "src/app/app-routing.module.ts";
dropUseHash(f);
replaceOnce(f, "const routes: Routes = [", "const routes: Routes = [\n  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },");
replaceOnce("src/main.ts", "if (environment.production) {", "if (!localStorage.getItem('token')) localStorage.setItem('token', 'token');\n\nif (environment.production) {");
dropBudgets();

// AuthModule is imported eagerly, so its '' route wins over the redirect:
// send the demo root to the dashboard before bootstrapping.
import { BASE } from "./_lib.mjs";
replaceOnce(
  "src/main.ts",
  "if (!localStorage.getItem('token'))",
  `if (location.pathname === ${JSON.stringify(BASE)} || location.pathname === ${JSON.stringify(BASE.slice(0, -1))}) history.replaceState(null, '', ${JSON.stringify(BASE + "dashboard")});\nif (!localStorage.getItem('token'))`,
);
// Google Maps can't load in the demo sandbox: the map page shows a placeholder.
replaceOnce(
  "src/app/pages/ui-elements/containers/map-page/map-page.component.html",
  /<agm-map[\s\S]*?<\/agm-map>/,
  '<div class="agm-map" style="display:flex;align-items:center;justify-content:center;background:#e5e3df;color:#777">Google Maps is not available in this demo.</div>',
);

// Sidebar items are <mat-list-item routerLink> (no href); a hidden nav with the
// same routes makes the pages linkable for the demo crawler.
import { readFileSync as readF, writeFileSync as writeF } from "node:fs";
const sb = "src/app/shared/sidebar/sidebar.component.html";
const html = readF(sb, "utf8");
const n = (html.match(/routerLink="\{\{routes\.[A-Z_]+\}\}"/g) ?? []).length;
if (n < 7) throw new Error(`patch: expected 7 sidebar routes, found ${n}`);
writeF(sb, `${html}\n<nav hidden aria-hidden="true">${["/dashboard", "/typography", "/tables", "/notification", "/ui/icons", "/ui/charts", "/ui/map"].map((r) => `<a routerLink="${r}"></a>`).join("")}</nav>\n`);
