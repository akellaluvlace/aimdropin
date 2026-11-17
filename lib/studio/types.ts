// Projects people build in their studio (/me). Signed in, a project is a row
// in Supabase `pages`; signed out it lives in this browser (IndexedDB).

import type { PageCredit, PagePurpose, PageStatus, PageVisibility } from "@/lib/community/pages";

export type ProjectStack = "html" | "jsx";

export type ProjectOriginType = "template" | "dashboard" | "component" | "community" | "paste" | "blank" | "ai";

export interface ProjectOrigin {
  type: ProjectOriginType;
  // template slug, "<dashboard slug>/<page path>", catalog id, community page id
  id?: string;
  title?: string;
  license?: string;
  sourceUrl?: string | null;
}

export interface ProjectVersion {
  source: string;
  stack: ProjectStack;
  at: number;
}

export interface Project {
  id: string;
  // true = stored in this browser only
  local: boolean;
  title: string;
  description: string | null;
  stack: ProjectStack;
  source: string;
  origin: ProjectOrigin | null;
  credits: PageCredit[];
  purpose: PagePurpose;
  status: PageStatus;
  visibility: PageVisibility;
  createdAt: number;
  updatedAt: number;
  // Newest first; earlier states of `source`.
  versions: ProjectVersion[];
}

export interface NewProject {
  title: string;
  stack: ProjectStack;
  source: string;
  origin: ProjectOrigin | null;
  purpose?: PagePurpose;
  description?: string | null;
}

export interface ProjectPatch {
  title?: string;
  description?: string | null;
  stack?: ProjectStack;
  source?: string;
  purpose?: PagePurpose;
}
