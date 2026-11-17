// NG-ALAIN: production build keeps the in-page @delon/mock data (the demo has
// no backend), uses history routing and starts signed in as the mock admin.
import { readFileSync, writeFileSync } from "node:fs";
import { replaceOnce } from "./_lib.mjs";
const dev = readFileSync("src/environments/environment.ts", "utf8");
if (!dev.includes("mockInterceptor")) throw new Error("patch: environment.ts has no mock setup");
writeFileSync(
  "src/environments/environment.prod.ts",
  dev.replace("production: false", "production: true").replace("useHash: true", "useHash: false"),
);
replaceOnce(
  "src/main.ts",
  "bootstrapApplication(App, appConfig)",
  `if (!localStorage.getItem('_token')) {
  localStorage.setItem('_token', JSON.stringify({ token: '123456789', name: 'admin', email: 'admin@qq.com', id: 10000, time: +new Date() }));
}

bootstrapApplication(App, appConfig)`,
);

// No lockfile: ng-zorro-antd 22.2.0 (2026-11-04) dropped NZ_DATE_LOCALE, which
// @delon 22.2.0 still imports; stay on the 22.1 line it was built against.
import { editJson } from "./_lib.mjs";
editJson("package.json", (p) => {
  if (!p.dependencies["ng-zorro-antd"]) throw new Error("patch: ng-zorro-antd missing");
  p.dependencies["ng-zorro-antd"] = "22.1.2";
});

// Skip the onboarding tour, and open every sidebar group so all pages are linked.
replaceOnce("src/main.ts", "if (!localStorage.getItem('_token')) {", "localStorage.setItem('on-boarding', '1');\nif (!localStorage.getItem('_token')) {");
editJson("src/assets/tmp/app-data.json", (d) => {
  const open = (items) => items.forEach((m) => {
    if (m.children?.length) {
      if (!m.group) m.open = true;
      open(m.children);
    }
  });
  open(d.menu);
});

// @delon's sidebar items are click handlers without hrefs; a hidden nav with
// the same routes makes every page linkable for the demo crawler.
import { readFileSync as readF } from "node:fs";
const links = [];
const walkMenu = (items) => items.forEach((m) => {
  if (typeof m.link === "string" && m.link.startsWith("/") && !m.externalLink) links.push(m.link);
  if (m.children) walkMenu(m.children);
});
walkMenu(JSON.parse(readF("src/assets/tmp/app-data.json", "utf8")).menu);
if (links.length < 20) throw new Error(`patch: only ${links.length} menu links`);
replaceOnce(
  "src/app/layout/basic/basic.ts",
  "<router-outlet />\n      </ng-template>",
  `<router-outlet />\n        <nav hidden aria-hidden="true">${[...new Set(links)].map((l) => `<a routerLink="${l}"></a>`).join("")}</nav>\n      </ng-template>`,
);
