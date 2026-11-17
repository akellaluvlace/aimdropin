// The lockfile installs noUiSlider 15, which moved its files from distribute/ to dist/.
import { replaceOnce } from "./_lib.mjs";
replaceOnce("src/partials/_scripts.html", "vendor/nouislider/distribute/nouislider.min.js", "vendor/nouislider/dist/nouislider.min.js");
