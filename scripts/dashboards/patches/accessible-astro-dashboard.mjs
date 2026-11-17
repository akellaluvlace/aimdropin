// Accessible Astro Dashboard: build under the demo base (root links are fixed
// after the build by root-links-post.mjs). The demo starts signed in; the
// login form returns to the dashboard under the base.
import { replaceOnce, BASE } from "./_lib.mjs";
replaceOnce("astro.config.mjs", "defineConfig({})", `defineConfig({ base: ${JSON.stringify(BASE)} })`);
replaceOnce("src/layouts/DefaultLayout.astro", "let isLoggedIn = await localStorage.getItem('isLoggedIn')", "if (localStorage.getItem('isLoggedIn') === null) localStorage.setItem('isLoggedIn', 'true')\n  let isLoggedIn = await localStorage.getItem('isLoggedIn')");
replaceOnce("src/layouts/DefaultLayout.astro", "window.location.href = '/login'", `window.location.href = ${JSON.stringify(BASE + "login/")}`);
replaceOnce("src/components/LoginForm.astro", "window.location.href = '/'", `window.location.href = ${JSON.stringify(BASE)}`);
