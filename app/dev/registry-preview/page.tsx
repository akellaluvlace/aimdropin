// Temporary dev page for checking registry previews by hand and from the
// puppeteer checker (scripts/catalog/check-previews.mjs). Not available in
// production builds unless AIMDROPIN_PREVIEW_CHECK=1.
//   /dev/registry-preview?url=<item url>[&theme=dark]  one item, full size
//   /dev/registry-preview                               a few samples

import { notFound } from "next/navigation";
import RegistryPreviewDev from "./RegistryPreviewDev";

export const dynamic = "force-dynamic";

const SAMPLES = [
  "https://ui.shadcn.com/r/styles/new-york-v4/dashboard-01.json",
  "https://ui.shadcn.com/r/styles/new-york-v4/login-03.json",
  "https://ui.shadcn.com/r/styles/new-york-v4/sidebar-07.json",
  "https://ui.shadcn.com/r/styles/new-york-v4/button.json",
  "https://magicui.design/r/marquee",
  "https://kokonutui.com/r/ai-prompt.json",
];

export default async function Page(
  props: {
    searchParams?: Promise<{ url?: string; theme?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  // Hidden in production unless the preview checker asks for it on a local
  // production build (AIMDROPIN_PREVIEW_CHECK=1 next start), which is much
  // lighter on memory than the dev server.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.AIMDROPIN_PREVIEW_CHECK !== "1"
  )
    notFound();
  const url = searchParams?.url;
  return (
    <RegistryPreviewDev
      urls={url ? [url] : SAMPLES}
      single={!!url}
      theme={searchParams?.theme === "dark" ? "dark" : "light"}
    />
  );
}
