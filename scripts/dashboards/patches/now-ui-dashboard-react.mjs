// BrowserRouter needs the demo base; react/react-dom ">=16.8.0" would now pull
// React 19, which drops findDOMNode that reactstrap/react-bootstrap still use.
import { addBasename, pinReact18 } from "./_react-cra.mjs";
addBasename("src/index.js");
pinReact18();
import { dropGoogleMaps } from "./_react-cra.mjs";
dropGoogleMaps("src/views/Maps.js");
