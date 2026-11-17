"use client";

// One API for studio projects: in the account (Supabase `pages`) when signed
// in, in this browser when not. Version history always lives in the browser.

import { getBrowserSupabase } from "@/lib/supabase/client";
import { deletePage, getPage, listMyPages, savePage, PAGE_SOURCE_MAX_BYTES, type SavedPage } from "@/lib/community/pages";
import { creditsFor, originFromCredits } from "./origin";
import { historyGet, historyRecord, isLocalId, localCreate, localDelete, localGet, localList, localSave } from "./local-store";
import type { NewProject, Project, ProjectPatch } from "./types";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

async function signedInUserId(): Promise<string | null> {
  const sb = getBrowserSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user.id ?? null;
}

function fromSaved(p: SavedPage, versions: Project["versions"] = []): Project {
  return {
    id: p.id,
    local: false,
    title: p.title,
    description: p.description,
    stack: p.stack,
    source: p.source,
    origin: originFromCredits(p.credits),
    credits: p.credits,
    purpose: p.purpose,
    status: p.status,
    visibility: p.visibility,
    createdAt: Date.parse(p.createdAt),
    updatedAt: Date.parse(p.updatedAt),
    versions,
  };
}

function tooBig(source: string): boolean {
  return new TextEncoder().encode(source).length > PAGE_SOURCE_MAX_BYTES;
}

export async function createProject(input: NewProject): Promise<Result<Project>> {
  if (tooBig(input.source)) return { ok: false, error: "This code is over 1 MB. Remove inline images or large data first." };
  const sb = getBrowserSupabase();
  if (sb && (await signedInUserId())) {
    const r = await savePage(sb, {
      title: input.title.trim() || "Untitled",
      description: input.description ?? null,
      kind: "page",
      purpose: input.purpose ?? "landing",
      stack: input.stack,
      source: input.source || " ",
      credits: creditsFor(input.origin),
      visibility: "private",
    });
    return r.ok ? { ok: true, value: fromSaved(r.page) } : { ok: false, error: r.error };
  }
  return { ok: true, value: await localCreate(input) };
}

export async function loadProject(id: string): Promise<Project | null> {
  if (isLocalId(id)) return localGet(id);
  const sb = getBrowserSupabase();
  if (!sb) return null;
  const page = await getPage(sb, id);
  if (!page) return null;
  return fromSaved(page, await historyGet(id).catch(() => []));
}

export async function listProjects(): Promise<{ account: Project[]; browser: Project[]; signedIn: boolean }> {
  const sb = getBrowserSupabase();
  const signedIn = !!(sb && (await signedInUserId()));
  const [account, browser] = await Promise.all([
    signedIn && sb ? listMyPages(sb).then((ps) => ps.map((p) => fromSaved(p))) : Promise.resolve([]),
    localList().catch(() => [] as Project[]),
  ]);
  return { account, browser, signedIn };
}

export async function saveProject(project: Project, patch: ProjectPatch): Promise<Result<Project>> {
  if (patch.source !== undefined && tooBig(patch.source)) {
    return { ok: false, error: "This page is over 1 MB, so it can't be saved. Remove inline images or large data." };
  }
  if (project.local) {
    const next = await localSave(project.id, patch);
    return next ? { ok: true, value: next } : { ok: false, error: "This draft no longer exists in this browser." };
  }
  const sb = getBrowserSupabase();
  if (!sb) return { ok: false, error: "Accounts aren't set up on this site." };
  const row: Record<string, unknown> = {};
  if (patch.source !== undefined) row.source = patch.source || " ";
  if (patch.stack !== undefined) row.stack = patch.stack;
  if (patch.title !== undefined) row.title = patch.title.trim() || "Untitled";
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.purpose !== undefined) row.purpose = patch.purpose;
  const { data, error } = await sb.from("pages").update(row).eq("id", project.id).select("*").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Couldn't save." };
  const versions =
    patch.source !== undefined || patch.stack !== undefined
      ? await historyRecord(project.id, project, { source: patch.source ?? project.source, stack: patch.stack ?? project.stack }).catch(() => project.versions)
      : project.versions;
  const saved = await getPage(sb, project.id);
  return saved ? { ok: true, value: fromSaved(saved, versions) } : { ok: true, value: { ...project, ...patch, versions, updatedAt: Date.now() } };
}

export async function removeProject(project: Project): Promise<boolean> {
  if (project.local) {
    await localDelete(project.id);
    return true;
  }
  const sb = getBrowserSupabase();
  return sb ? deletePage(sb, project.id) : false;
}

/** After signing in: copy this browser's drafts into the account. */
export async function moveBrowserDraftsToAccount(): Promise<number> {
  const sb = getBrowserSupabase();
  if (!sb || !(await signedInUserId())) return 0;
  let moved = 0;
  for (const p of await localList()) {
    const r = await savePage(sb, {
      title: p.title,
      description: p.description,
      kind: "page",
      purpose: p.purpose,
      stack: p.stack,
      source: p.source || " ",
      credits: p.credits,
      visibility: "private",
    });
    if (r.ok) {
      await localDelete(p.id);
      moved++;
    }
  }
  return moved;
}

export type PublishOutcome =
  | { ok: true; status: "published" | "pending_review" | "rejected"; findings: Array<{ level: string; rule: string; detail: string }> }
  | { ok: false; error: string; need?: "username" | "signin" };

export async function publishProject(
  project: Project,
  body: { title: string; description: string | null; purpose: string; visibility: "public" | "unlisted"; license: boolean; username?: string },
): Promise<PublishOutcome> {
  if (project.local) return { ok: false, error: "Sign in to publish. Your draft moves into your account.", need: "signin" };
  const sb = getBrowserSupabase();
  const { data } = sb ? await sb.auth.getSession() : { data: { session: null } };
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "Sign in to publish.", need: "signin" };
  const res = await fetch(`/api/pages/${project.id}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as { status?: string; findings?: []; error?: string; need?: string };
  if (!res.ok) return { ok: false, error: j.error ?? `Couldn't publish (${res.status}).`, need: j.need === "username" ? "username" : undefined };
  return { ok: true, status: j.status as "published" | "pending_review" | "rejected", findings: j.findings ?? [] };
}

/** Hide a published page again (it stays in your studio). */
export async function unpublishProject(project: Project): Promise<boolean> {
  const sb = getBrowserSupabase();
  if (!sb || project.local) return false;
  const { error } = await sb.from("pages").update({ visibility: "private" }).eq("id", project.id);
  return !error;
}
