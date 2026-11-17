// Git blob shas for files on disk. A file whose sha matches a blob in the
// repo at the pinned commit is identical to what jsDelivr serves for that
// path, so the pipeline doesn't need to store it.

import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const SKIP_DIRS = new Set([".git", "node_modules"]);

/** sha1("blob <size>\0" + content), exactly what `git hash-object` prints. */
export function gitBlobSha(buf) {
  const h = createHash("sha1");
  h.update(`blob ${buf.length}\0`);
  h.update(buf);
  return h.digest("hex");
}

/**
 * Every regular file under `root` (symlinks skipped, so nothing outside the
 * folder is ever read), sorted by path.
 * @param {string} root
 * @returns {Array<{ path: string, size: number, sha: string }>}
 */
export function listFiles(root) {
  const out = [];
  const walk = (rel) => {
    const abs = rel ? path.join(root, rel) : root;
    for (const name of readdirSync(abs)) {
      const childRel = rel ? `${rel}/${name}` : name;
      const st = lstatSync(path.join(abs, name));
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) {
        if (!SKIP_DIRS.has(name)) walk(childRel);
      } else if (st.isFile()) {
        const buf = readFileSync(path.join(abs, name));
        out.push({ path: childRel, size: st.size, sha: gitBlobSha(buf) });
      }
    }
  };
  walk("");
  out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return out;
}
