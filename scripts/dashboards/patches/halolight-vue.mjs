// HaloLight Vue: built in mock mode (VITE_MOCK in the entry's env; MockJS
// answers the API in the page). The demo signs in with the repo's demo
// account on first navigation instead of showing the login page.
import { replaceOnce } from "./_lib.mjs";
replaceOnce(
  "src/router/index.ts",
  "router.beforeEach((to, _from, next) => {\n  const auth = useAuthStore()\n",
  `router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore()
  if (!auth.isAuthenticated) {
    try {
      await auth.login({ email: import.meta.env.VITE_DEMO_EMAIL, password: import.meta.env.VITE_DEMO_PASSWORD })
    } catch {}
  }
`,
);
