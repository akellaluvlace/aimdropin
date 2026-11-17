// Geeker Admin: history routing at the base (VITE_PUBLIC_PATH / VITE_ROUTER_MODE
// in the entry's env). Menus and button permissions use the repo's local JSON;
// tables still read the project's public Apifox mock. Starts signed in.
import { replaceOnce } from "./_lib.mjs";
replaceOnce("src/routers/index.ts", "history: () => createWebHistory()", "history: () => createWebHistory(import.meta.env.BASE_URL)");
replaceOnce("src/api/modules/login.ts", "  return http.get<Menu.MenuOptions[]>(PORT1 + `/menu/list`, {}, { loading: false });\n", "");
replaceOnce("src/api/modules/login.ts", "  return http.get<Login.ResAuthButtons>(PORT1 + `/auth/buttons`, {}, { loading: false });\n", "");
replaceOnce("src/stores/modules/user.ts", 'const token = ref<string>("");', 'const token = ref<string>("bqddxxwqmfncffacvbpkuxvwvqrhln");');
