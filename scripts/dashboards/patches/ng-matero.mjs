// NG-Matero: the demo starts signed in as the template's demo user (the
// in-memory web API accepts the same unsigned token its fake login issues).
import { replaceOnce } from "./_lib.mjs";
replaceOnce(
  "src/main.ts",
  "bootstrapApplication(App, appConfig)",
  `import { base64 } from '@core/authentication';
if (!localStorage.getItem('ng-matero-token')) {
  const user = { id: 1, username: 'ng-matero', name: 'Zongbin', email: 'nzb329@163.com', avatar: 'images/avatar.jpg' };
  const access_token = [
    base64.encode(JSON.stringify({ typ: 'JWT', alg: 'HS256' })),
    base64.encode(JSON.stringify({ user })),
    base64.encode('ng-matero'),
  ].join('.');
  localStorage.setItem('ng-matero-token', JSON.stringify({ access_token, token_type: 'bearer' }));
}

bootstrapApplication(App, appConfig)`,
);

// Static JSON (i18n, menu) is fetched cross-origin from the demo sandbox:
// keep those plain GETs (no Authorization/credentials, no X-Requested-With)
// so they need no CORS preflight.
replaceOnce(
  "src/app/core/interceptors/token-interceptor.ts",
  "const shouldAppendToken = (url: string) => !hasHttpScheme(url) || includeBaseUrl(url);",
  "const shouldAppendToken = (url: string) => !/\\.json(\\?|$)/.test(url) && (!hasHttpScheme(url) || includeBaseUrl(url));",
);
replaceOnce(
  "src/app/shared/in-mem/in-mem-data.service.ts",
  "ajax('data/menu.json?_t=' + Date.now())",
  "ajax({ url: 'data/menu.json?_t=' + Date.now(), crossDomain: true })",
);
