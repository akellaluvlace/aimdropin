// Vitify Admin: the demo runs in an opaque origin where service workers can't
// register, so the MSW handlers run in-page through msw/native (fetch/XHR
// interception, no worker). Router at the bundler base; starts signed in
// with the mock admin token.
import { replaceOnce } from "./_lib.mjs";
// msw/native's export map hides it from browser builds, so import it by path.
replaceOnce("src/mocks/index.ts", "import { setupWorker } from 'msw/browser'", "import { setupServer as setupWorker } from '../../node_modules/msw/lib/native/index.mjs'");
replaceOnce("src/main.ts", ".worker.start({", ".worker.listen({");
replaceOnce("src/plugins/router.ts", "    mode: 'history',\n", "    mode: 'history',\n    base: import.meta.env.BASE_URL,\n");
replaceOnce("src/stores/user.ts", "token: localStorage.getItem('access') || '',", "token: localStorage.getItem('access') || 'admin',");
