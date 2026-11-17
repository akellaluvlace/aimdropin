// Static export; the root layout's cookies() read becomes a constant.
import { replaceOnce } from "./_lib.mjs";
import { staticNextConfig, prefixPublicPaths, fixRscFetchAll } from "./_next.mjs";
staticNextConfig();
prefixPublicPaths(["src"]);
const layout = "src/app/layout.tsx";
replaceOnce(layout, 'import { cookies } from "next/headers"\n', "");
replaceOnce(layout, '  const cookieStore = await cookies()\n  const defaultOpen = cookieStore.get("sidebar:state")?.value === "true"\n', "  const defaultOpen = true\n");
fixRscFetchAll();
