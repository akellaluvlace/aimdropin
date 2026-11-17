// scripts/dashboards/git-blob.mjs - git blob shas let the pipeline skip
// storing files that are byte-identical to a file in the repo (those are
// served from jsDelivr instead).

import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gitBlobSha, listFiles } from "../scripts/dashboards/git-blob.mjs";

describe("gitBlobSha", () => {
  it("matches git hash-object for known blobs", () => {
    // `printf '' | git hash-object --stdin` and `echo hello | git hash-object --stdin`
    expect(gitBlobSha(Buffer.from(""))).toBe("e69de29bb2d1d6434b8b29ae775ad8c2e48c5391");
    expect(gitBlobSha(Buffer.from("hello\n"))).toBe("ce013625030ba8dba906f756967f9e9ca394464a");
  });
});

describe("listFiles", () => {
  it("lists every regular file with a posix path, size and blob sha, sorted", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dash-blob-"));
    mkdirSync(path.join(dir, "css", "deep"), { recursive: true });
    writeFileSync(path.join(dir, "index.html"), "hello\n");
    writeFileSync(path.join(dir, "css", "deep", "a.css"), "");
    const files = listFiles(dir);
    expect(files).toEqual([
      { path: "css/deep/a.css", size: 0, sha: "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391" },
      { path: "index.html", size: 6, sha: "ce013625030ba8dba906f756967f9e9ca394464a" },
    ]);
  });

  it("skips .git, node_modules and symlinks", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dash-blob-"));
    mkdirSync(path.join(dir, ".git"));
    mkdirSync(path.join(dir, "node_modules", "x"), { recursive: true });
    writeFileSync(path.join(dir, ".git", "HEAD"), "ref");
    writeFileSync(path.join(dir, "node_modules", "x", "i.js"), "x");
    writeFileSync(path.join(dir, "real.txt"), "hello\n");
    symlinkSync("/etc/hosts", path.join(dir, "link.txt"));
    expect(listFiles(dir).map((f) => f.path)).toEqual(["real.txt"]);
  });
});
