// Saved and published pages ("Save your page", then share it to Landing
// pages / Dashboards / Sections / Components for others to use).
//
// Saving is private by default. Publishing is two steps the database
// enforces: the owner calls submit_page() (draft → pending_review, owner
// confirms they own the work and license it MIT), then the checker or a
// moderator sets it published. Owners can never self-publish or self-feature.

import type { SupabaseClient } from "@supabase/supabase-js";

export type PageKind = "page" | "section" | "component";
export type PagePurpose =
  | "landing"
  | "dashboard"
  | "auth"
  | "ecommerce"
  | "blog"
  | "docs"
  | "general";
export type PageStack = "html" | "jsx";
export type PageVisibility = "private" | "unlisted" | "public";
export type PageStatus = "draft" | "pending_review" | "published" | "rejected";

export interface PageCredit {
  id: string;
  title: string;
  sourceUrl: string | null;
  license: string;
}

export interface SavedPage {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  kind: PageKind;
  purpose: PagePurpose;
  stack: PageStack;
  source: string;
  credits: PageCredit[];
  remixedFrom: string | null;
  visibility: PageVisibility;
  status: PageStatus;
  tier: "community" | "featured";
  thumbPath: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface PageListing {
  id: string;
  title: string;
  description: string | null;
  kind: PageKind;
  purpose: PagePurpose;
  stack: PageStack;
  tier: "community" | "featured";
  thumbPath: string | null;
  publishedAt: string | null;
  author: { username: string | null; displayName: string | null } | null;
}

// Mirrors the CHECK constraints in the migration so the UI can explain a
// problem before the database rejects it.
export const PAGE_TITLE_MAX = 120;
export const PAGE_DESCRIPTION_MAX = 500;
export const PAGE_SOURCE_MAX_BYTES = 1024 * 1024;

export type PageDraft = {
  title: string;
  description?: string | null;
  kind: PageKind;
  purpose: PagePurpose;
  stack: PageStack;
  source: string;
  credits?: PageCredit[];
  remixedFrom?: string | null;
  visibility?: PageVisibility;
};

export function validateDraft(d: PageDraft): string | null {
  const title = d.title.trim();
  if (!title) return "Give your page a title.";
  if (title.length > PAGE_TITLE_MAX)
    return `Keep the title under ${PAGE_TITLE_MAX} characters.`;
  if ((d.description?.length ?? 0) > PAGE_DESCRIPTION_MAX) {
    return `Keep the description under ${PAGE_DESCRIPTION_MAX} characters.`;
  }
  if (!d.source.trim()) return "There's no code to save yet.";
  if (new TextEncoder().encode(d.source).length > PAGE_SOURCE_MAX_BYTES) {
    return "This page is over 1 MB. Remove inline images or large data first.";
  }
  return null;
}

function fromRow(r: Record<string, unknown>): SavedPage {
  return {
    id: String(r.id),
    ownerId: String(r.owner_id),
    title: String(r.title),
    description: (r.description as string | null) ?? null,
    kind: r.kind as PageKind,
    purpose: r.purpose as PagePurpose,
    stack: r.stack as PageStack,
    source: String(r.source ?? ""),
    credits: Array.isArray(r.credits) ? (r.credits as PageCredit[]) : [],
    remixedFrom: (r.remixed_from as string | null) ?? null,
    visibility: r.visibility as PageVisibility,
    status: r.status as PageStatus,
    tier: r.tier as "community" | "featured",
    thumbPath: (r.thumb_path as string | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    publishedAt: (r.published_at as string | null) ?? null,
  };
}

export type SaveResult =
  | { ok: true; page: SavedPage }
  | { ok: false; error: string };

export async function savePage(
  sb: SupabaseClient,
  draft: PageDraft,
  existingId?: string,
): Promise<SaveResult> {
  const problem = validateDraft(draft);
  if (problem) return { ok: false, error: problem };
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sign in to save pages." };
  const row = {
    title: draft.title.trim(),
    description: draft.description?.trim() || null,
    kind: draft.kind,
    purpose: draft.purpose,
    stack: draft.stack,
    source: draft.source,
    credits: draft.credits ?? [],
    remixed_from: draft.remixedFrom ?? null,
    ...(draft.visibility ? { visibility: draft.visibility } : {}),
  };
  const q = existingId
    ? sb.from("pages").update(row).eq("id", existingId).select().single()
    : sb
        .from("pages")
        .insert({ ...row, owner_id: auth.user.id })
        .select()
        .single();
  const { data, error } = await q;
  if (error || !data)
    return { ok: false, error: error?.message ?? "Couldn't save the page." };
  return { ok: true, page: fromRow(data) };
}

export async function listMyPages(sb: SupabaseClient): Promise<SavedPage[]> {
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];
  const { data } = await sb
    .from("pages")
    .select("*")
    .eq("owner_id", auth.user.id)
    .order("updated_at", { ascending: false })
    .limit(200);
  return (data ?? []).map(fromRow);
}

export async function getPage(
  sb: SupabaseClient,
  id: string,
): Promise<SavedPage | null> {
  const { data } = await sb
    .from("pages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? fromRow(data) : null;
}

export async function deletePage(
  sb: SupabaseClient,
  id: string,
): Promise<boolean> {
  const { error } = await sb.from("pages").delete().eq("id", id);
  return !error;
}

// Owner confirms they made it (or have the rights) and license it MIT.
export async function submitPage(
  sb: SupabaseClient,
  id: string,
  visibility: "public" | "unlisted",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const vis = await sb.from("pages").update({ visibility }).eq("id", id);
  if (vis.error) return { ok: false, error: vis.error.message };
  const { error } = await sb.rpc("submit_page", { page_id: id });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function listPublishedPages(
  sb: SupabaseClient,
  opts: { kind?: PageKind; purpose?: PagePurpose; limit?: number } = {},
): Promise<PageListing[]> {
  let q = sb
    .from("pages")
    .select(
      "id, title, description, kind, purpose, stack, tier, thumb_path, published_at, profiles(username, display_name)",
    )
    .eq("status", "published")
    .eq("visibility", "public")
    .order("published_at", { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.purpose) q = q.eq("purpose", opts.purpose);
  const { data } = await q;
  return (data ?? []).map((r: Record<string, unknown>) => {
    const p = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as
      | { username: string | null; display_name: string | null }
      | null
      | undefined;
    return {
      id: String(r.id),
      title: String(r.title),
      description: (r.description as string | null) ?? null,
      kind: r.kind as PageKind,
      purpose: r.purpose as PagePurpose,
      stack: r.stack as PageStack,
      tier: r.tier as "community" | "featured",
      thumbPath: (r.thumb_path as string | null) ?? null,
      publishedAt: (r.published_at as string | null) ?? null,
      author: p ? { username: p.username, displayName: p.display_name } : null,
    };
  });
}
