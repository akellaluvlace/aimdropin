// Auth, pricing and error pages have no theme toggle; the shared script assumed one.
import { readFileSync, writeFileSync } from "node:fs";
const f = "src/dark-mode.js";
const s = readFileSync(f, "utf8");
const t = s
  .replace(/\b(themeToggle(?:Dark|Light)Icon)\.classList/g, "$1?.classList")
  .replace(/\bthemeToggleBtn\.addEventListener/g, "themeToggleBtn?.addEventListener");
if (!/themeToggleLightIcon\?\.classList/.test(t)) throw new Error("patch: dark-mode.js not as expected");
writeFileSync(f, t);
