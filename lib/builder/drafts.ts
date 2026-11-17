"use client";

// Builder drafts: every generated page is kept in this browser (IndexedDB)
// with its brief and a short version history, so a refresh or a bad refine
// never loses work. Saving to an account (Supabase) is a separate, explicit
// step.

import { openDB, type IDBPDatabase } from "idb";
import type { BuildBrief, BuildOutput } from "./prompt";
import type { PageCredit } from "@/lib/community/pages";

export interface DraftVersion {
  code: string;
  label: string;
  at: number;
}

export interface BuilderDraft {
  id: string;
  title: string;
  output: BuildOutput;
  code: string;
  brief: BuildBrief;
  credits: PageCredit[];
  // Newest first; versions[0] is the current code.
  versions: DraftVersion[];
  model: string;
  costUsd: number | null;
  // Set once saved to the user's account.
  remotePageId: string | null;
  createdAt: number;
  updatedAt: number;
}

export const MAX_VERSIONS = 12;

const DB_NAME = "aimdropin-builder";
const STORE = "drafts";

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(d) {
        const s = d.createObjectStore(STORE, { keyPath: "id" });
        s.createIndex("updatedAt", "updatedAt");
      },
    }).catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

export function newDraftId(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export async function putDraft(d: BuilderDraft): Promise<void> {
  await (await db()).put(STORE, d);
}

export async function getDraft(id: string): Promise<BuilderDraft | null> {
  return (
    ((await (await db()).get(STORE, id)) as BuilderDraft | undefined) ?? null
  );
}

export async function listDrafts(): Promise<BuilderDraft[]> {
  const all = (await (
    await db()
  ).getAllFromIndex(STORE, "updatedAt")) as BuilderDraft[];
  return all.reverse();
}

export async function deleteDraft(id: string): Promise<void> {
  await (await db()).delete(STORE, id);
}

// versions[0] is always the current code; older ones follow, newest first,
// and drop off past MAX_VERSIONS.
export function withVersion(
  d: BuilderDraft,
  code: string,
  label: string,
): BuilderDraft {
  const now = Date.now();
  return {
    ...d,
    code,
    versions: [{ code, label, at: now }, ...d.versions].slice(0, MAX_VERSIONS),
    updatedAt: now,
  };
}

export function titleFromCode(code: string, fallback: string): string {
  const t =
    code.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ??
    code.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const clean = t
    ?.replace(/<[^>]+>/g, "")
    .replace(/\{[^}]*\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean && clean.length >= 2 ? clean.slice(0, 120) : fallback;
}
