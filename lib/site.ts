// The site's public address, for canonical links, the sitemap, robots.txt
// and social cards. NEXT_PUBLIC_SITE_URL overrides it (local dev, a staging
// domain); without it every build points at the live site.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.aimdropin.com").replace(/\/+$/, "");

export const SITE_NAME = "AiM Dropin";
// The open-source repository.
export const REPO_URL = "https://github.com/akellaluvlace/aimdropin";
export const SITE_TITLE = "AiM Dropin - free landing pages, live dashboards and UI components";
export const SITE_DESCRIPTION =
  "Free landing pages, working admin dashboards and UI components. Preview them live, remix them in your browser, then copy the code or download it. MIT-style licences only, no install, no sign-in.";

// Shared card image when a page has no picture of its own: a wide 1200x630
// card (the size link previews are built for), not the square logo.
export const SITE_IMAGE = {
  url: "/assets/og.jpg",
  width: 1200,
  height: 630,
  alt: "AiM Dropin: free landing pages, live dashboards and UI components",
};

/**
 * Social card metadata for one page: its own title, description, address and
 * picture (a gallery thumbnail when there is one, so a shared link shows the
 * thing itself rather than the site card).
 */
export function socialMeta({
  title,
  description,
  path,
  image,
}: {
  title: string;
  description: string;
  path: string;
  image?: { url: string; width?: number; height?: number; alt: string } | null;
}) {
  const img = image ?? SITE_IMAGE;
  return {
    openGraph: {
      type: "website" as const,
      locale: "en_US",
      siteName: SITE_NAME,
      url: path,
      title,
      description,
      images: [img],
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
      images: [img.url],
    },
  };
}

/**
 * Metadata for a page that is one fixed address (the galleries, the
 * playground, the builder): its title and description, itself as the
 * canonical address, and a share card that says the same.
 */
export function pageMeta({ title, description, path }: { title: string; description: string; path: string }) {
  return {
    title,
    description,
    alternates: { canonical: path },
    ...socialMeta({ title, description, path }),
  };
}
