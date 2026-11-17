// Airframe: node-sass needs its (blocked) install script, so build Sass with
// dart-sass instead (sass-loader 10 picks it up); no inline source maps in the
// production bundle. The base path comes from BASE_PATH (publicPath + basename).
import { editJson, replaceOnce } from "./_lib.mjs";
editJson("package.json", (p) => {
  if (!p.devDependencies["node-sass"]) throw new Error("patch: node-sass is no longer a devDependency");
  delete p.devDependencies["node-sass"];
  p.devDependencies.sass = "1.32.13";
  // No lockfile: react-draggable 4.5+ (required by react-resizable 3.1+) ships
  // .mjs chunks webpack 4 cannot parse; keep both on their 2024 releases.
  p.overrides = { ...(p.overrides ?? {}), "react-resizable": "3.0.5", "react-draggable": "4.4.6" };
});
replaceOnce("build/webpack.config.client.prod.js", "devtool: 'inline-source-map',", "devtool: false,");
