// pure-admin family: the demo starts signed in as the mock "admin" user (the
// same data the mock /login returns). Base path and history mode come from
// VITE_PUBLIC_PATH / VITE_ROUTER_HISTORY in the entry's env.
import { replaceOnce } from "./_lib.mjs";

export function demoLogin(guardStart) {
  replaceOnce(
    "src/router/index.ts",
    guardStart,
    `import { setToken as demoSetToken } from "@/utils/auth";
${guardStart}
  if (!(Cookies.get(multipleTabsKey) && storageLocal().getItem(userKey))) {
    demoSetToken({
      avatar: "https://avatars.githubusercontent.com/u/44761321",
      username: "admin",
      nickname: "admin",
      roles: ["admin"],
      permissions: ["*:*:*"],
      accessToken: "eyJhbGciOiJIUzUxMiJ9.admin",
      refreshToken: "eyJhbGciOiJIUzUxMiJ9.adminRefresh",
      expires: new Date("2030/10/30 00:00:00")
    } as any);
  }`,
  );
}
