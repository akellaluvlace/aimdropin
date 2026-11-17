// Static export under the demo base (the "/" redirect goes; the entry is the first page).
import { staticNextConfig, prefixPublicPaths, fixRscFetchAll } from "./_next.mjs";
staticNextConfig();
prefixPublicPaths(["src"]);
fixRscFetchAll();
// "/" was a server redirect to /overview: give it a page so 404s and links to
// the root have an RSC payload to load.
import { writeFileSync } from "node:fs";
writeFileSync("src/app/page.tsx", 'import { redirect } from "next/navigation"\n\nexport default function Home() {\n  redirect("/overview")\n}\n');
