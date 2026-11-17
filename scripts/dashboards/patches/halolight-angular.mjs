// HaloLight Angular: the demo starts signed in as an admin (the template's
// auth service reads its token/user from localStorage).
import { replaceOnce } from "./_lib.mjs";
replaceOnce(
  "src/main.ts",
  "bootstrapApplication(App, appConfig)",
  `if (!localStorage.getItem('auth_token')) {
  localStorage.setItem('auth_token', 'demo-token');
  localStorage.setItem('auth_user', JSON.stringify({ id: '1', email: 'admin@halolight.h7ml.cn', name: 'Admin', role: 'admin', permissions: ['*'] }));
}

bootstrapApplication(App, appConfig)`,
);
