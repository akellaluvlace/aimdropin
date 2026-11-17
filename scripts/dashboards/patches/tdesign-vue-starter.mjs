// TDesign Vue Next Starter: list, detail and menu data come from mock/ which
// only the dev server serves. Serve the same mocks in the page through
// vite-plugin-mock's client (MockJS XHR interception) and call the local
// paths. Base path from VITE_BASE_URL (entry env).
import { replaceOnce } from "./_lib.mjs";
replaceOnce(
  "src/main.ts",
  "import './permission';",
  "import './permission';\nimport { createProdMockServer } from 'vite-plugin-mock/client';\nimport demoMocks from '../mock';\n\nconst demoMockReady = createProdMockServer([...demoMocks]);",
);
replaceOnce(
  "src/utils/request/index.ts",
  "const host = env === 'mock' || import.meta.env.VITE_IS_REQUEST_PROXY !== 'true' ? '' : import.meta.env.VITE_API_URL;",
  "const host = ''; void env;",
);
// The mock server installs itself asynchronously (it lazy-loads MockJS):
// start the app, and so its first menu request, only once it's ready.
replaceOnce("src/main.ts", "const app = createApp(App);", "async function demoStart() {\nawait demoMockReady;\nconst app = createApp(App);");
replaceOnce("src/main.ts", "app.mount('#app');", "app.mount('#app');\n}\ndemoStart();");
