// Tokyo Free White (Next 12 pages router): built with `next export`; public
// assets get the demo base.
import { staticNextConfig, prefixPublicPaths } from "./_next.mjs";
staticNextConfig();
prefixPublicPaths(["src", "pages"]);
