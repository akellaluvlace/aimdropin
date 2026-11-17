// Notus Angular: the demo opens on the admin dashboard; the UI-kit index page
// moves to /index. No Google Maps script; maps page guarded.
import { replaceOnce } from "./_lib.mjs";
import { dropGoogleMapsScript, guardMapsInit, dropBudgets } from "./_angular.mjs";
const f = "src/app/app-routing.module.ts";
replaceOnce(f, '{ path: "", component: IndexComponent },', '{ path: "index", component: IndexComponent },\n  { path: "", redirectTo: "admin/dashboard", pathMatch: "full" },');
replaceOnce(f, '{ path: "**", redirectTo: "", pathMatch: "full" }', '{ path: "**", redirectTo: "admin/dashboard", pathMatch: "full" }');
dropGoogleMapsScript();
guardMapsInit("src/app/components/maps/map-example/map-example.component.ts");
dropBudgets();
