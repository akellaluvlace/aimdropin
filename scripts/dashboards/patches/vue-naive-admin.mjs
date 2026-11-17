// Vue Naive Admin: base and history mode from VITE_PUBLIC_PATH / VITE_USE_HASH
// (entry env); user, menus and tables come from the project's public Apifox
// mock. Starts signed in.
import { replaceOnce } from "./_lib.mjs";
replaceOnce("src/store/modules/auth.js", "    accessToken: undefined,", "    accessToken: 'demo-token',");
