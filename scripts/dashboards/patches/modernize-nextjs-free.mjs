// Modernize (Next.js): static export from package/.
import { staticNextConfig, prefixPublicPaths, fixRscFetchAll } from "./_next.mjs";
process.chdir("package");
staticNextConfig();
prefixPublicPaths(["src"]);
fixRscFetchAll();
