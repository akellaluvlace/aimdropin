// Static export under the demo base; mock JSON and static images get the base prefix.
import { staticNextConfig, prefixPublicPaths, fixRscFetchAll } from "./_next.mjs";
staticNextConfig();
prefixPublicPaths(["src"]);
fixRscFetchAll();
// Prerendered in UTC, hydrated in the viewer's zone: pin the zone so the
// block-time column hydrates without a text mismatch.
import { replaceOnce } from "./_lib.mjs";
replaceOnce("src/components/Dashboard/TransactionCard.tsx", "new Date(row.block_time * 1000).toLocaleString()", 'new Date(row.block_time * 1000).toLocaleString("en-US", { timeZone: "UTC" })');
