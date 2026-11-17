// Where a project started, stored as its first page credit
// ({ id: "<type>:<id>", … }) so the source's MIT notice travels with it.

import type { PageCredit } from "@/lib/community/pages";
import type { ProjectOrigin, ProjectOriginType } from "./types";

const CREDITED: ProjectOriginType[] = ["template", "dashboard", "component", "community"];

export function originCredit(o: ProjectOrigin): PageCredit {
  return {
    id: `${o.type}:${o.id ?? ""}`,
    title: o.title ?? o.id ?? o.type,
    sourceUrl: o.sourceUrl ?? null,
    license: o.license ?? "MIT",
  };
}

export function originFromCredits(credits: PageCredit[]): ProjectOrigin | null {
  const first = credits[0];
  if (!first) return null;
  const m = first.id.match(/^(template|dashboard|component|community):(.+)$/);
  if (!m) return null;
  return {
    type: m[1] as ProjectOriginType,
    id: m[2],
    title: first.title,
    license: first.license,
    sourceUrl: first.sourceUrl,
  };
}

export function creditsFor(o: ProjectOrigin | null): PageCredit[] {
  return o && CREDITED.includes(o.type) && o.id ? [originCredit(o)] : [];
}

export function originHref(o: ProjectOrigin): string | null {
  if (!o.id) return null;
  switch (o.type) {
    case "template":
      return `/t/${o.id}`;
    case "dashboard":
      return `/d/${o.id.split("/")[0]}`;
    case "component":
      return `/c/${o.id.split("/").map(encodeURIComponent).join("/")}`;
    case "community":
      return `/p/${o.id}`;
    default:
      return null;
  }
}
