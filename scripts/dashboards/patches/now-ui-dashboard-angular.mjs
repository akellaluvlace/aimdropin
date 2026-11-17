// Now UI Dashboard Angular: no Google Maps script, maps page guarded.
import { dropGoogleMapsScript, guardMapsInit, dropBudgets } from "./_angular.mjs";
dropGoogleMapsScript();
guardMapsInit("src/app/maps/maps.component.ts");
dropBudgets();
