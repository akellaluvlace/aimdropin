// Material Angular Dashboard (CreativeIT): node-sass 4 can't install on a
// current toolchain, so Sass compiles with dart-sass (Angular 10 falls back to
// it when node-sass is absent). History routing, no Google Maps script, map
// page guarded.
import { editJson } from "./_lib.mjs";
import { dropUseHash, dropGoogleMapsScript, guardMapsInit, dropBudgets } from "./_angular.mjs";
editJson("package.json", (p) => {
  if (!p.devDependencies["node-sass"]) throw new Error("patch: node-sass not in devDependencies");
  delete p.devDependencies["node-sass"];
  p.devDependencies.sass = "1.32.13";
});
dropUseHash("src/app/app-routing.module.ts");
dropGoogleMapsScript();
guardMapsInit("src/app/pages/maps/map/map.component.ts", "ngAfterViewInit");
dropBudgets();

// node-sass tolerated three "@import '/...'" typos in the theme; dart-sass needs "./".
import { replaceOnce } from "./_lib.mjs";
for (const p of ["components/sidebar/sidebar.component", "components/toggle/toggle.component", "directives/tooltip/tooltip.component"]) {
  replaceOnce("src/theme/styles.scss", `@import '/${p}';`, `@import './${p}';`);
}
