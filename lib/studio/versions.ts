// Version history: autosave writes often, so an earlier state is kept at
// most every couple of minutes, newest first, capped.

import type { ProjectStack, ProjectVersion } from "./types";

export const VERSION_EVERY_MS = 2 * 60_000;
export const MAX_VERSIONS = 20;

export function nextVersions(
  versions: ProjectVersion[],
  prev: { source: string; stack: ProjectStack },
  next: { source: string; stack: ProjectStack },
  now: number,
): ProjectVersion[] {
  if (prev.source === next.source && prev.stack === next.stack) return versions;
  const last = versions[0];
  if (last && now - last.at < VERSION_EVERY_MS) return versions;
  return [{ source: prev.source, stack: prev.stack, at: now }, ...versions].slice(0, MAX_VERSIONS);
}
