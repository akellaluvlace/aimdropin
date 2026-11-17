// Static export under the demo base (the "/" redirect goes; the entry is the first page).
import { staticNextConfig, prefixPublicPaths, fixRscFetchAll } from "./_next.mjs";
staticNextConfig();
prefixPublicPaths(["src"]);
fixRscFetchAll();
// The mock transactions end in October 2025 and the report ranges count back
// from today, so every chart came up empty: count back from the data's end.
import { replaceOnce } from "./_lib.mjs";
replaceOnce("src/app/(dashboard)/reports/_components/TransactionChart.tsx", "    const currentDate = new Date()\n", '    const currentDate = new Date("2025-10-08T00:00:00Z")\n');
