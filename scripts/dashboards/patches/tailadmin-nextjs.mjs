// TailAdmin (Next.js): static export; public images get the demo base.
import { staticNextConfig, prefixPublicPaths, fixRscFetchAll } from "./_next.mjs";
staticNextConfig();
prefixPublicPaths(["src"]);
fixRscFetchAll();
// The auth layout's logo is page-relative ("./images/..."): make it absolute.
import { replaceOnce, BASE_NOSLASH } from "./_lib.mjs";
replaceOnce("src/app/(full-width-pages)/(auth)/layout.tsx", 'src="./images/logo/auth-logo.svg"', `src="${BASE_NOSLASH}/images/logo/auth-logo.svg"`);
// "Forgot password?" points at a page the free version doesn't ship.
replaceOnce("src/components/auth/SignInForm.tsx", 'href="/reset-password"', 'href="/signin"');
