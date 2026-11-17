// GitHub template adapter: one CatalogItem per whole-app template repo
// (TailAdmin, shadcn-admin, AstroWind…). For each repo it:
//   1. pins the current HEAD commit (`git ls-remote`, no API rate limit),
//   2. re-reads the LICENSE file AT THAT COMMIT and checks its text still
//      matches the SPDX id recorded in sources.json - a relicensed repo
//      drops out automatically,
//   3. reads package.json at that commit to tell Next / React / Astro / HTML.
// Code is not cached here; installs are a pinned `degit` of the commit.

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { licenseTextMatches } from "../license.mjs";
import { classifyPurpose, detectHeavyDeps, titleFromName } from "../classify.mjs";

const run = promisify(execFile);
const LICENSE_FILES = [
  "LICENSE",
  "LICENSE.md",
  "LICENSE.txt",
  "LICENCE",
  "LICENCE.md",
  "License.md",
  "license",
  "license.md",
  "LICENSE-MIT",
];

/**
 * Read a repo's LICENSE file at `ref` and check it still reads as `spdx`.
 * Shared with build-catalog.mjs, which runs it for registries that publish
 * their source on GitHub (`licenseRepo` in sources.json).
 */
export async function verifyRepoLicense({ repo, ref, spdx, http }) {
  for (const f of LICENSE_FILES) {
    const r = await http.getText(raw(repo, ref, f));
    if (!r.text) continue;
    if (!licenseTextMatches(spdx, r.text)) {
      return { ok: false, reason: `${repo}/${f} at ${ref.slice(0, 7)} no longer reads as plain ${spdx}` };
    }
    return { ok: true, file: f, text: r.text };
  }
  return { ok: false, reason: `no LICENSE file in ${repo} at ${ref.slice(0, 7)}` };
}

export async function headCommit(repo) {
  const { stdout } = await run("git", ["ls-remote", `https://github.com/${repo}.git`, "HEAD"], { timeout: 30000 });
  const sha = stdout.split(/\s+/)[0];
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`no HEAD for ${repo}`);
  return sha;
}

function raw(repo, sha, file) {
  return `https://raw.githubusercontent.com/${repo}/${sha}/${file}`;
}

/** @param {Record<string, string>} deps merged dependencies + devDependencies */
export function detectFramework(deps) {
  if (!deps) return "html";
  if (deps.next) return "next";
  if (deps.astro) return "astro";
  if (deps.react) return "react";
  return "html";
}

/**
 * @param {object} opts
 * @param {object} opts.source   sources.json entry: name, repo, purpose, title?
 * @param {import("../../../lib/catalog/types").CatalogLicense} opts.license
 * @param {{ getJson: Function, getText: Function }} opts.http
 * @returns {Promise<{ item?: import("../../../lib/catalog/types").CatalogItem, reject?: string }>}
 */
export async function indexGithubTemplate({ source, license, http }) {
  const sha = await headCommit(source.repo);
  const lic = await verifyRepoLicense({ repo: source.repo, ref: sha, spdx: license.spdx, http });
  if (!lic.ok) return { reject: lic.reason };
  const { text: licenseText, file: licenseFile } = lic;

  const pkg = (await http.getJson(raw(source.repo, sha, "package.json"))).json;
  const deps = pkg ? { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) } : null;
  const framework = detectFramework(deps);
  const depNames = Object.keys(pkg?.dependencies ?? {});
  const repoName = source.repo.split("/")[1];

  return {
    item: {
      id: `${source.name}/${repoName}`,
      sourceId: source.name,
      sourceKind: "github-template",
      name: repoName,
      title: source.title ?? titleFromName(repoName),
      description: source.description ?? pkg?.description ?? null,
      kind: "page",
      purpose: source.purpose ?? classifyPurpose({ name: repoName, description: pkg?.description }),
      registryType: null,
      stack: framework === "html" ? "html" : framework === "astro" ? null : deps?.typescript ? "react-tsx" : "react-jsx",
      framework,
      dependencies: depNames,
      registryDependencies: [],
      heavyDeps: detectHeavyDeps(depNames),
      categories: [],
      license: {
        ...license,
        url: `https://github.com/${source.repo}/blob/${sha}/${licenseFile}`,
        textHash: createHash("sha1").update(licenseText).digest("hex"),
      },
      author: source.repo.split("/")[0],
      homepage: source.demoUrl ?? `https://github.com/${source.repo}`,
      sourceUrl: `https://github.com/${source.repo}`,
      install: {
        method: "clone",
        command: `npx degit ${source.repo}#${sha} my-app`,
        repo: source.repo,
        commit: sha,
      },
      previewStatus: "unknown",
      contentHash: sha,
      indexedAt: new Date().toISOString(),
    },
  };
}
