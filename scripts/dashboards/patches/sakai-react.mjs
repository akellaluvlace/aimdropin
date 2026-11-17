// Sakai React (PrimeReact, Next 13 app router): static export; theme CSS,
// demo JSON and images in public/ get the demo base.
import { staticNextConfig, prefixPublicPaths, fixRscFetchAll } from "./_next.mjs";
staticNextConfig();
prefixPublicPaths(["app", "layout", "demo", "types", "styles"]);
fixRscFetchAll();
