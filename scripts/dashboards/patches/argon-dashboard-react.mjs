// BrowserRouter needs the demo base (PUBLIC_URL is set in the build command).
import { addBasename } from "./_react-cra.mjs";
addBasename("src/index.js");
import { dropGoogleMaps } from "./_react-cra.mjs";
dropGoogleMaps("src/views/examples/Maps.js");
