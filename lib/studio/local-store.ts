// Studio projects kept in this browser (IndexedDB): every project while
// signed out, and the version history of account projects.

import { openDB, type IDBPDatabase } from "idb";
import { creditsFor } from "./origin";
import { nextVersions } from "./versions";
import type { NewProject, Project, ProjectPatch, ProjectVersion } from "./types";

const DB_NAME = "aimdropin-studio";
const PROJECTS = "projects";
const HISTORY = "history";

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(d) {
        const s = d.createObjectStore(PROJECTS, { keyPath: "id" });
        s.createIndex("updatedAt", "updatedAt");
        d.createObjectStore(HISTORY, { keyPath: "id" });
      },
    }).catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

function newId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return `local-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function isLocalId(id: string): boolean {
  return id.startsWith("local-");
}

export async function localCreate(input: NewProject): Promise<Project> {
  const now = Date.now();
  const p: Project = {
    id: newId(),
    local: true,
    title: input.title.trim() || "Untitled",
    description: input.description ?? null,
    stack: input.stack,
    source: input.source,
    origin: input.origin,
    credits: creditsFor(input.origin),
    purpose: input.purpose ?? "landing",
    status: "draft",
    visibility: "private",
    createdAt: now,
    updatedAt: now,
    versions: [],
  };
  await (await db()).put(PROJECTS, p);
  return p;
}

export async function localGet(id: string): Promise<Project | null> {
  return ((await (await db()).get(PROJECTS, id)) as Project | undefined) ?? null;
}

export async function localList(): Promise<Project[]> {
  const all = (await (await db()).getAllFromIndex(PROJECTS, "updatedAt")) as Project[];
  return all.reverse();
}

export async function localSave(id: string, patch: ProjectPatch): Promise<Project | null> {
  const d = await db();
  const prev = (await d.get(PROJECTS, id)) as Project | undefined;
  if (!prev) return null;
  const now = Date.now();
  const next: Project = {
    ...prev,
    ...patch,
    title: patch.title !== undefined ? patch.title.trim() || "Untitled" : prev.title,
    updatedAt: now,
    versions:
      patch.source !== undefined || patch.stack !== undefined
        ? nextVersions(prev.versions, prev, { source: patch.source ?? prev.source, stack: patch.stack ?? prev.stack }, now)
        : prev.versions,
  };
  await d.put(PROJECTS, next);
  return next;
}

export async function localDelete(id: string): Promise<void> {
  const d = await db();
  await d.delete(PROJECTS, id);
  await d.delete(HISTORY, id);
}

// Version history for account projects (the account stores only the latest).
export async function historyGet(id: string): Promise<ProjectVersion[]> {
  const row = (await (await db()).get(HISTORY, id)) as { id: string; versions: ProjectVersion[] } | undefined;
  return row?.versions ?? [];
}

export async function historyRecord(
  id: string,
  prev: { source: string; stack: Project["stack"] },
  next: { source: string; stack: Project["stack"] },
): Promise<ProjectVersion[]> {
  const d = await db();
  const versions = nextVersions(await historyGet(id), prev, next, Date.now());
  await d.put(HISTORY, { id, versions });
  return versions;
}
