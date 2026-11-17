// shadcn-vue-admin: router at the demo base; public logos follow it.
import { replaceOnce } from "./_lib.mjs";
import { historyAtBase } from "./_vue.mjs";
historyAtBase("src/router/index.ts", "createWebHistory()");
replaceOnce("src/config/site.ts", "light: '/logo-dark.svg'", "light: `${import.meta.env.BASE_URL}logo-dark.svg`");
replaceOnce("src/config/site.ts", "dark: '/logo.svg'", "dark: `${import.meta.env.BASE_URL}logo.svg`");
