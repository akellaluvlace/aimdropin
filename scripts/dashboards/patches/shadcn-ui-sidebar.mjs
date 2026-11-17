// Static export under the demo base. The avatar's src="#" made the page load
// itself as an image (blocked by ORB): it falls back to initials instead.
import { replaceOnce } from "./_lib.mjs";
import { staticNextConfig, prefixPublicPaths, fixRscFetchAll } from "./_next.mjs";
staticNextConfig();
replaceOnce("src/components/admin-panel/user-nav.tsx", '<AvatarImage src="#" alt="Avatar" />', "");
prefixPublicPaths(["src"], { skip: ["registry"] });
fixRscFetchAll();
