// Static export under the demo base instead of the upstream GitHub Pages base.
import { replaceOnce, BASE_NOSLASH } from "./_lib.mjs";
import { staticNextConfig, fixRscFetchAll } from "./_next.mjs";
replaceOnce("next.config.ts", '  basePath: "/admin-one-react-tailwind",\n', "");
staticNextConfig();
replaceOnce("app/layout.tsx", '"/admin-one-react-tailwind/favicon.png"', JSON.stringify(BASE_NOSLASH + "/favicon.png"));
fixRscFetchAll();
// Google Analytics goes: the demo route strips tracker scripts, and with the
// app router that also strips the RSC payload chunk quoting the snippet.
replaceOnce("app/layout.tsx", /\s*<Script\s+src="https:\/\/www\.googletagmanager\.com[\s\S]*?<\/Script>\n/, "\n");
