// Submenu toggle referenced an undefined variable; vendor demo pages link unminified CSS.
import { replaceOnce } from "./_lib.mjs";
replaceOnce("src/assets/js/vendors/sidebarnav.js", "submenuDropdown.classList.toggle('show', isVisible);", "submenuDropdown.classList.toggle('show');");
replaceOnce("gulpfile.js", "src(npmDist(), { base: paths.base.node })", "src(npmDist({ copyUnminified: true }), { base: paths.base.node })");
