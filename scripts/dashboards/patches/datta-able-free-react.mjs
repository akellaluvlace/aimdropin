// Datta Able: collapsed sidebar groups unmount their links, so the crawler
// (and the page list) never sees most pages. Keep the submenu in the DOM and
// hide it while closed; it looks and behaves the same.
import { replaceOnce } from "./_lib.mjs";
replaceOnce(
  "src/layout/Dashboard/Drawer/DrawerContent/Navigation/NavCollapse.jsx",
  "{open === true && <ul className=\"pc-submenu\">{navCollapse}</ul>}",
  "<ul className=\"pc-submenu\" style={open === true ? undefined : { display: 'none' }}>{navCollapse}</ul>",
);
