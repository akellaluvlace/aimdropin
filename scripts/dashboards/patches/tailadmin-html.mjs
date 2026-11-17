// Auth and error pages have no search button; the shared script assumed one.
import { replaceOnce } from "./_lib.mjs";
replaceOnce("src/js/index.js", 'searchButton.addEventListener("click", focusSearchInput);', 'searchButton?.addEventListener("click", focusSearchInput);');
