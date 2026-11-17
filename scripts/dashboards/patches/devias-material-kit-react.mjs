// Static export; the demo opens signed in (the fake auth only checks localStorage).
import { replaceOnce } from "./_lib.mjs";
import { staticNextConfig, prefixPublicPaths, fixRscFetchAll } from "./_next.mjs";
staticNextConfig();
prefixPublicPaths(["src"]);
replaceOnce("src/lib/auth/client.ts", "    if (!token) {\n      return { data: null };\n    }\n", "    void token;\n");
fixRscFetchAll();
