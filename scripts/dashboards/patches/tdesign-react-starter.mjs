// TDesign React Starter: list pages read /api/get-list, which only the dev
// mock server answers. Build in "mock" mode (API host '') and serve the same
// mock in the browser through vite-plugin-mock's mockjs-based prod server;
// router basename = demo base.
import { replaceOnce, BASE_NOSLASH } from "./_lib.mjs";
replaceOnce("mock/api/getList.js", "const Mock = require('mockjs');", "import Mock from 'mockjs';");
replaceOnce(
  "src/main.tsx",
  "import App from 'layouts/index';",
  "import App from 'layouts/index';\nimport { createProdMockServer } from 'vite-plugin-mock/es/createProdMockServer';\nimport mocks from '../mock';\n\ncreateProdMockServer([...mocks]);",
);
replaceOnce("src/main.tsx", "const baseRouterName = env === 'site' ? '/starter/react/' : '';", `const baseRouterName = ${JSON.stringify(BASE_NOSLASH)}; void env;`);
// Menu items navigate by onClick only, so the pages have no links to follow.
// Wrap each title in a real link (default prevented: navigation stays the same).
const link = (pathVar) =>
  `<a href={${JSON.stringify(BASE_NOSLASH)} + ${pathVar}} onClick={(e) => e.preventDefault()} style={{ color: 'inherit', textDecoration: 'none' }}>{title}</a>`;
replaceOnce("src/layouts/components/Menu.tsx", "          {title}\n        </MenuItem>", `          ${link("routerPath")}\n        </MenuItem>`);
replaceOnce("src/layouts/components/Menu.tsx", "            {title}\n          </MenuItem>", `            ${link("singlePath")}\n          </MenuItem>`);
