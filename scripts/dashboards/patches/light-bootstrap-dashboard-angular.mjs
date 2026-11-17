// Light Bootstrap Dashboard Angular: history routing. Google Maps can't load in
// the demo sandbox, so the maps page shows a plain placeholder instead of <ngui-map>.
import { replaceOnce } from "./_lib.mjs";
import { dropUseHash, dropBudgets, relativeAssets } from "./_angular.mjs";
dropUseHash("src/app/app.routing.ts");
replaceOnce(
  "src/app/maps/maps.component.html",
  /<ngui-map[\s\S]*?<\/ngui-map>/,
  '<div style="margin-top:60px;height:100%;width:100%;position:absolute;top:0;left:0;background-color:rgb(229,227,223);display:flex;align-items:center;justify-content:center;color:#777">Google Maps is not available in this demo.</div>',
);
dropBudgets();
// Sidebar logo uses a root-relative /assets/ URL.
relativeAssets("src");
