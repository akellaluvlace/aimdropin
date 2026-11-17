// Auth and error pages have no theme switcher; the shared color-mode script assumed one.
import { replaceOnce } from "./_lib.mjs";
replaceOnce(
  "src/js/color-modes.js",
  "const svgOfActiveBtn = btnToActive.querySelector('svg')",
  "if (!btnToActive) return\n    const svgOfActiveBtn = btnToActive.querySelector('svg')",
);
