// DashUI (Next.js 13.4 app router): static export without trailing slashes
// (13.4's client asks for "<page>.txt" payloads); public assets get the base.
import { readFileSync, writeFileSync } from "node:fs";
import { staticNextConfig, prefixPublicPaths, fixRscFetchAll } from "./_next.mjs";
staticNextConfig(".", { trailingSlash: false });
prefixPublicPaths(["app", "components", "layouts", "sub-components", "widgets", "styles", "data", "routes", "hooks"]);
// The notification menu's "View all" links to a page the free version doesn't ship.
const qm = "layouts/QuickMenu.js";
const s = readFileSync(qm, "utf8");
if (!s.includes('href="/dashboard/notification-history"')) throw new Error(`patch: ${qm} changed`);
writeFileSync(qm, s.replaceAll('href="/dashboard/notification-history"', 'href="#"'));
fixRscFetchAll();
