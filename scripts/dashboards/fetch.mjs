// Network side of the dashboard pipeline: download a repo at a pinned commit
// and ask jsDelivr which of its files it serves. Downloads are untrusted
// data: they land in their own folder under .cache/dashboards/<slug>/ and
// nothing in them is executed outside Docker (see build.mjs).

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

export const CACHE_ROOT = path.join(process.cwd(), ".cache", "dashboards");

/** base64 sha256, the format jsDelivr's data API uses for file hashes. */
export function sha256b64(buf) {
  return createHash("sha256").update(buf).digest("base64");
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"], ...opts });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err.slice(-600)}`))));
    if (opts.input) {
      opts.input.pipe(p.stdin);
    } else {
      p.stdin.end();
    }
  });
}

/**
 * Download github.com/<repo> at <sha> into `dest` (replacing it), unless a
 * previous download of the same sha is already there.
 */
export async function fetchRepo(repo, sha, dest) {
  const marker = path.join(dest, ".aim-sha");
  if (existsSync(marker) && readFileSync(marker, "utf8").trim() === sha) return false;
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  const url = `https://codeload.github.com/${repo}/tar.gz/${sha}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`download ${url} failed: HTTP ${res.status}`);
  const { Readable } = await import("node:stream");
  // bsdtar/gnutar both refuse absolute paths and ".." members by default.
  await run("tar", ["-xzf", "-", "-C", dest, "--strip-components=1"], {
    input: Readable.fromWeb(res.body),
  });
  writeFileSync(marker, sha);
  return true;
}

/**
 * Files jsDelivr serves for <repo>@<sha>, keyed by repo path (no leading
 * slash), or null when jsDelivr can't serve the repo (too large, missing).
 * @returns {Promise<Map<string, { size: number, hash: string }> | null>}
 */
export async function jsdelivrFiles(repo, sha) {
  const url = `https://data.jsdelivr.com/v1/packages/gh/${repo}@${sha}?structure=flat`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (res.status === 403 || res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (!Array.isArray(body.files)) return null;
      const map = new Map();
      for (const f of body.files) {
        if (typeof f.name === "string" && typeof f.hash === "string") {
          map.set(f.name.replace(/^\//, ""), { size: f.size, hash: f.hash });
        }
      }
      return map;
    } catch (e) {
      if (attempt === 2) throw new Error(`jsDelivr listing for ${repo}@${sha} failed: ${e.message}`);
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  return null;
}

/** jsDelivr URL prefix for a repo at a commit, ending in "/". */
export function cdnBase(repo, sha) {
  return `https://cdn.jsdelivr.net/gh/${repo}@${sha}/`;
}
