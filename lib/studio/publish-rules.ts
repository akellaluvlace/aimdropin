// What a publish request may set, and what the automatic checks decide.

import type { PagePurpose } from "@/lib/community/pages";

export const USERNAME_RE = /^[a-z0-9][a-z0-9-]{1,38}$/;
export const PUBLISH_PURPOSES: PagePurpose[] = ["landing", "dashboard", "auth", "ecommerce", "blog", "docs", "general"];

export interface PublishRequest {
  title: string;
  description: string | null;
  purpose: PagePurpose;
  visibility: "public" | "unlisted";
  username?: string;
}

export type ParsedPublish = { ok: true; value: PublishRequest } | { ok: false; error: string };

export function parsePublishRequest(body: unknown): ParsedPublish {
  const b = (body ?? {}) as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) return { ok: false, error: "Give your page a title." };
  if (title.length > 120) return { ok: false, error: "Keep the title under 120 characters." };
  const description = typeof b.description === "string" && b.description.trim() ? b.description.trim() : null;
  if (description && description.length > 500) return { ok: false, error: "Keep the description under 500 characters." };
  const purpose = PUBLISH_PURPOSES.includes(b.purpose as PagePurpose) ? (b.purpose as PagePurpose) : null;
  if (!purpose) return { ok: false, error: "Pick what kind of page it is." };
  const visibility = b.visibility === "unlisted" ? "unlisted" : b.visibility === "public" ? "public" : null;
  if (!visibility) return { ok: false, error: "Pick who can see it." };
  if (b.license !== true) return { ok: false, error: "Confirm the page is yours to share under MIT." };
  const username = typeof b.username === "string" && b.username ? b.username.trim().toLowerCase() : undefined;
  if (username !== undefined && !USERNAME_RE.test(username)) {
    return { ok: false, error: "Usernames are 2-39 lowercase letters, digits or dashes, starting with a letter or digit." };
  }
  return { ok: true, value: { title, description, purpose, visibility, username } };
}

// pass → live now; review → waits for the site owner; reject → refused.
export function statusForVerdict(verdict: "pass" | "review" | "reject"): "published" | "pending_review" | "rejected" {
  return verdict === "pass" ? "published" : verdict === "review" ? "pending_review" : "rejected";
}
