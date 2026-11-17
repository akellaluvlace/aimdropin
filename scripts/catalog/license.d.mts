// Type declaration for `license.mjs` (implementation stays .mjs so the
// indexer runs under raw Node with no build step).

import type { AllowedLicense, CatalogLicense } from "../../lib/catalog/types";

export const ALLOWED_LICENSES: readonly AllowedLicense[];
export function isAllowedLicense(spdx: unknown): spdx is AllowedLicense;
export function checkSourceLicense(source: {
  license?: {
    spdx?: string;
    url?: string;
    verifiedAt?: string;
    freeOnly?: boolean;
  } | null;
}): { ok: true; license: CatalogLicense } | { ok: false; reason: string };
export function licenseTextMatches(spdx: string, text: string | null | undefined): boolean;
export const PAID_STATUSES: readonly number[];
