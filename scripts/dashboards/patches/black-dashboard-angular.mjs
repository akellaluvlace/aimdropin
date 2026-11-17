// Black Dashboard Angular: history routing, no Google Maps script, map page guarded.
import { dropUseHash, dropGoogleMapsScript, guardMapsInit, dropBudgets } from "./_angular.mjs";
dropUseHash("src/app/app-routing.module.ts");
dropGoogleMapsScript();
guardMapsInit("src/app/pages/map/map.component.ts");
dropBudgets();
