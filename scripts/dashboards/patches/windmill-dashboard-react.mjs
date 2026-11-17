// Router needs the demo base; open on the dashboard instead of the login form.
import { addBasename, replaceOnce } from "./_react-cra.mjs";
addBasename("src/App.js", "Router");
replaceOnce("src/App.js", '<Redirect exact from="/" to="/login" />', '<Redirect exact from="/" to="/app/dashboard" />');
// No service worker: demos run in a sandbox where its script can't be registered.
replaceOnce("src/index.js", "serviceWorker.register()", "serviceWorker.unregister()");
