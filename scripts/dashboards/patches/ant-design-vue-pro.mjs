// Ant Design Vue Pro: built in "preview" mode (mockjs2 mocks kept); publicPath
// and history routing at the demo base; starts signed in with the mock token.
import { replaceOnce } from "./_lib.mjs";
import { vueCliPublicPath } from "./_vue.mjs";
vueCliPublicPath();
replaceOnce("src/router/index.js", "    mode: 'history',\n", "    mode: 'history',\n    base: process.env.BASE_URL,\n");
replaceOnce("src/permission.js", "const token = storage.get(ACCESS_TOKEN)", "const token = storage.get(ACCESS_TOKEN) || '4291d7da9005377ec9aec4a71ea837f'");
// The workplace activity mock lists '@image(64x64)' avatars that MockJS never
// expands (broken images upstream too): use the avatar the other entries use.
import { replaceInTree } from "./_vue.mjs";
replaceInTree("src/mock/services", "'@image(64x64)'", "'https://gw.alipayobjects.com/zos/rmsportal/jZUIxmJycoymBprLOUbT.png'", { exts: [".js"], min: 3 });
