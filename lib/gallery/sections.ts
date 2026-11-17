import "server-only";
import { getAllTemplates } from "@/lib/templates";
import { getDashboards } from "@/lib/dashboards";
import { queryComponents } from "@/lib/catalog/components";
import { getCommunityPages } from "@/lib/community/listing";
import { supabaseConfigured } from "@/lib/supabase/client";
import { GSAP_SITES } from "@/lib/gsap/sites";
import type { GallerySectionTab } from "./types";

// Section tabs with live counts. A section shows once it has something in it.
// The GSAP sites are the exception: announced before the first one is in, so
// their tab shows from the start, marked "Soon".
export async function getGalleryTabs(): Promise<GallerySectionTab[]> {
  const [templates, dashboards, components] = await Promise.all([
    getAllTemplates(),
    getDashboards(),
    queryComponents({ pageSize: 1 }).catch(() => null),
  ]);
  const community = supabaseConfigured() ? await getCommunityPages({ limit: 500 }).catch(() => []) : [];
  const tabs: GallerySectionTab[] = [
    { id: "landing", label: "Landing pages", href: "/gallery", count: templates.length },
    { id: "dashboards", label: "Dashboards", href: "/gallery/dashboards", count: dashboards.length },
    { id: "components", label: "Components", href: "/gallery/components", count: components?.counts.all ?? 0 },
    { id: "gsap", label: "GSAP", href: "/gallery/gsap", count: GSAP_SITES.length, soon: GSAP_SITES.length === 0 },
    { id: "community", label: "Community", href: "/gallery/community", count: community.length },
  ];
  // Community shows as soon as accounts are on, so people find where to share.
  return tabs.filter((t) => t.id === "landing" || t.count > 0 || t.soon || (t.id === "community" && supabaseConfigured()));
}
