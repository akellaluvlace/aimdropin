// Auth pages have no sidebar; the shared script assumed one.
import { readFileSync, writeFileSync } from "node:fs";
const f = "src/sidebar.js";
const s = readFileSync(f, "utf8");
const t = s.replace(/^(toggleSidebarMobileSearch|toggleSidebarMobileEl|sidebarBackdrop)\.addEventListener/gm, "$1?.addEventListener");
if ((t.match(/\?\.addEventListener/g) ?? []).length !== 3) throw new Error("patch: sidebar.js not as expected");
writeFileSync(f, t);
