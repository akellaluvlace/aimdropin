// License gate for the catalog. Hard rule: a source is indexed only when a
// human or agent has read its LICENSE file and recorded a permissive SPDX id
// plus the URL they read in `sources.json`. Unverified, copyleft (GPL/AGPL),
// share-alike, non-commercial, attribution-only, custom and "free for personal
// use" licenses are all rejected - users must be able to drop the code into
// any project, and we must be able to cache and preview it.

export const ALLOWED_LICENSES = Object.freeze([
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "0BSD",
  "Unlicense",
  "CC0-1.0",
]);

/** @param {unknown} spdx */
export function isAllowedLicense(spdx) {
  return typeof spdx === "string" && ALLOWED_LICENSES.includes(spdx);
}

/**
 * Validate a source's recorded license. Returns `{ ok: true, license }` with
 * the CatalogLicense to stamp on every item, or `{ ok: false, reason }`.
 *
 * @param {{ license?: { spdx?: string, url?: string, verifiedAt?: string, freeOnly?: boolean } | null }} source
 */
export function checkSourceLicense(source) {
  const lic = source.license;
  if (!lic) return { ok: false, reason: "no license recorded" };
  if (!isAllowedLicense(lic.spdx)) {
    return { ok: false, reason: `license "${lic.spdx ?? "?"}" is not on the allowlist` };
  }
  if (typeof lic.url !== "string" || !/^https:\/\//.test(lic.url)) {
    return { ok: false, reason: "license has no verification URL" };
  }
  if (typeof lic.verifiedAt !== "string" || Number.isNaN(Date.parse(lic.verifiedAt))) {
    return { ok: false, reason: "license has no verification date" };
  }
  return {
    ok: true,
    license: {
      spdx: lic.spdx,
      url: lic.url,
      verifiedAt: lic.verifiedAt,
      freeOnly: lic.freeOnly === true,
    },
  };
}

// Fingerprints of each allowlisted license's text. Used to re-check, on every
// index, that a repo's LICENSE file still says what sources.json recorded -
// licenses do change, and a relicensed repo must drop out automatically.
const LICENSE_FINGERPRINTS = {
  MIT: [/permission is hereby granted, free of charge/i],
  "Apache-2.0": [/apache license/i, /version 2\.0/i],
  "BSD-2-Clause": [/redistribution and use in source and binary forms/i],
  "BSD-3-Clause": [/redistribution and use in source and binary forms/i, /neither the name/i],
  ISC: [/permission to use, copy, modify, and\/or distribute this software/i],
  "0BSD": [/permission to use, copy, modify, and\/or distribute this software/i],
  Unlicense: [/this is free and unencumbered software released into the public domain/i],
  "CC0-1.0": [/cc0 1\.0 universal/i],
};

/**
 * @param {string} spdx
 * @param {string | null | undefined} text
 */
export function licenseTextMatches(spdx, text) {
  const prints = LICENSE_FINGERPRINTS[spdx];
  if (!prints || typeof text !== "string") return false;
  // Extra terms appended to a permissive header are not what we approved:
  // copyleft, Creative Commons, fair-use riders, and "MIT + Commons Clause"
  // (React Bits, Animate UI) which forbids redistributing the components.
  if (/gnu (affero )?general public license|creative commons|fair use license|commons clause/i.test(text)) {
    return false;
  }
  return prints.every((re) => re.test(text));
}

// HTTP statuses that mean "this item is paid or private" on freemium
// registries. Such items are skipped, never indexed.
export const PAID_STATUSES = Object.freeze([401, 402, 403]);
