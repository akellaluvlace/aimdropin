import { getGsapSite } from "@/lib/gsap/sites";
import { socialMeta } from "@/lib/site";

/**
 * Metadata for a GSAP site's own page: the site's own title and description
 * (it is a concept and says so), itself as the canonical address, and a
 * screen of its own as the share card. The title is absolute, so the layout's
 * "%s · AiM Dropin" is not added: each site stands on its own, and its check
 * (scripts/gsap/verify-<slug>.mjs) reads the title as the site's own words.
 */
export function gsapSiteMeta({ slug, title, description }: { slug: string; title: string; description: string }) {
  const site = getGsapSite(slug);
  const path = `/gallery/gsap/${slug}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    ...socialMeta({
      title,
      description,
      path,
      image: site ? { url: site.thumb, width: 1200, height: 750, alt: `${site.title}: ${site.blurb}` } : null,
    }),
  };
}
