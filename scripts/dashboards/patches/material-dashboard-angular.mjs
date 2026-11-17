// Material Dashboard Angular: history routing, no Google Maps script, maps page guarded.
import { dropUseHash, dropGoogleMapsScript, guardMapsInit, dropBudgets, relativeAssets } from "./_angular.mjs";
dropUseHash("src/app/app.routing.ts");
dropGoogleMapsScript();
guardMapsInit("src/app/maps/maps.component.ts");
dropBudgets();
// Sidebar logo uses a root-relative /assets/ URL.
relativeAssets("src");
