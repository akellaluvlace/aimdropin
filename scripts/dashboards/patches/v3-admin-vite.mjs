// V3 Admin Vite: base and history mode come from VITE_PUBLIC_PATH /
// VITE_ROUTER_HISTORY in the entry's env; data comes from the project's public
// Apifox mock. The demo starts signed in with the mock admin token.
import { replaceOnce } from "./_lib.mjs";
replaceOnce("src/common/utils/local-storage.ts", "  return localStorage.getItem(CacheKey.TOKEN)\n", "  return localStorage.getItem(CacheKey.TOKEN) || \"token-admin\"\n");
