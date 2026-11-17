// Published community pages as library items (server-side). They sit next to
// the catalog with source "community" and ids "community/<uuid>". Nothing is
// returned until Supabase is configured.

import { getServerSupabase } from "@/lib/supabase/client";
import type { LibraryItem } from "@/lib/catalog/library";
import { listPublishedPages, type PageListing } from "./pages";

export const COMMUNITY_SOURCE_ID = "community";

function toItem(p: PageListing): LibraryItem {
  const author = p.author?.username ?? p.author?.displayName ?? null;
  return {
    id: `${COMMUNITY_SOURCE_ID}/${p.id}`,
    src: COMMUNITY_SOURCE_ID,
    name: p.id,
    title: p.title,
    desc: p.description,
    kind: p.kind,
    purpose: p.purpose,
    stack: p.stack === "html" ? "html" : "react-jsx",
    fw: null,
    type: null,
    cats: [p.purpose, ...(p.tier === "featured" ? ["featured"] : [])],
    deps: [],
    regDeps: [],
    heavy: [],
    lic: "MIT",
    licUrl: "https://opensource.org/license/mit",
    freeOnly: false,
    author,
    home: null,
    srcUrl: null,
    install: { method: "editor" },
    thumb: null,
    demo: null,
    ghStars: null,
    preview: "ok",
  };
}

export async function getCommunityItems(): Promise<LibraryItem[]> {
  const sb = getServerSupabase(120);
  if (!sb) return [];
  try {
    return (await listPublishedPages(sb, { limit: 500 })).map(toItem);
  } catch {
    return [];
  }
}

export async function getCommunityItem(
  id: string,
): Promise<{ item: LibraryItem; source: string } | null> {
  const uuid = id.slice(COMMUNITY_SOURCE_ID.length + 1);
  if (!/^[0-9a-f-]{36}$/i.test(uuid)) return null;
  const sb = getServerSupabase(60);
  if (!sb) return null;
  const { data } = await sb
    .from("pages")
    .select(
      "id, title, description, kind, purpose, stack, tier, thumb_path, published_at, source, profiles(username, display_name)",
    )
    .eq("id", uuid)
    .eq("status", "published")
    .maybeSingle();
  if (!data) return null;
  const prof = (
    Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
  ) as { username: string | null; display_name: string | null } | null;
  const item = toItem({
    id: String(data.id),
    title: String(data.title),
    description: (data.description as string | null) ?? null,
    kind: data.kind,
    purpose: data.purpose,
    stack: data.stack,
    tier: data.tier,
    thumbPath: data.thumb_path,
    publishedAt: data.published_at,
    author: prof
      ? { username: prof.username, displayName: prof.display_name }
      : null,
  });
  return { item, source: String(data.source) };
}
