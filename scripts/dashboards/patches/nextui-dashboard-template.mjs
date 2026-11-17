// NextUI dashboard: static export. The auth middleware goes (the demo opens
// on the dashboard) and the cookie server actions become client no-op-ish
// document.cookie writes.
import { writeFileSync, readFileSync } from "node:fs";
import { remove } from "./_lib.mjs";
import { staticNextConfig, prefixPublicPaths, fixRscFetchAll } from "./_next.mjs";
staticNextConfig(".", { trailingSlash: false });
remove("middleware.ts");
const f = "actions/auth.action.ts";
const s = readFileSync(f, "utf8");
if (!s.includes("export const createAuthCookie") || !s.includes("export const deleteAuthCookie")) throw new Error(`patch: ${f} changed`);
writeFileSync(
  f,
  `export const createAuthCookie = async () => {
  document.cookie = "userAuth=myToken; path=/";
};

export const deleteAuthCookie = async () => {
  document.cookie = "userAuth=; path=/; max-age=0";
};
`,
);
prefixPublicPaths(["app", "components"]);
fixRscFetchAll();
