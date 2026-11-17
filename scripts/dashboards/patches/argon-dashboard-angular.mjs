// Argon Dashboard Angular: history routing, no Google Maps script, maps page guarded.
import { dropUseHash, dropGoogleMapsScript, guardMapsInit, dropBudgets } from "./_angular.mjs";
dropUseHash("src/app/app.routing.ts");
dropGoogleMapsScript();
guardMapsInit("src/app/pages/maps/maps.component.ts");
dropBudgets();
