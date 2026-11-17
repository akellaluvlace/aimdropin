// HashRouter app: webpack publicPath is hard-coded for GitHub Pages; point it
// at the demo base. Open signed in as the mock admin (the login is mocked).
import { replaceOnce, BASE } from "./_react-cra.mjs";
replaceOnce("config-overrides.js", '? "/react-antd-admin-template/"', `? ${JSON.stringify(BASE)}`);
replaceOnce("src/utils/auth.js", "return Cookies.get(TokenKey)\n", 'return Cookies.get(TokenKey) || "admin-token"\n');
// The lockfile resolves every tarball from registry.npm.taobao.org (retired,
// expired certificate); point the same tarballs (same integrity) at npmjs.org.
import { readFileSync, writeFileSync } from "node:fs";
const lock = readFileSync("package-lock.json", "utf8");
const fixed = lock.replace(
  /https?:\/\/registry\.npm\.taobao\.org\/((?:@[^/"]+\/)?[^/"]+)\/download\/(?:@[^/"]+\/)?([^/"?]+\.tgz)(?:\?[^"]*)?/g,
  "https://registry.npmjs.org/$1/-/$2",
);
if (fixed === lock) throw new Error("patch: package-lock.json has no taobao URLs");
writeFileSync("package-lock.json", fixed);
