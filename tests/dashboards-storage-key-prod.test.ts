// scripts/dashboards/storage-key.mjs - demo file paths → storage object keys.
// Supabase Storage rejects most punctuation and all non-ASCII in keys, while
// built apps ship paths like `_next/static/chunks/app/[slug]/page.js`.

import { describe, it, expect } from "vitest";
import { storageKey } from "@/scripts/dashboards/storage-key.mjs";

const SAFE = /^[A-Za-z0-9._!/-]+$/;

describe("storageKey", () => {
  it("keeps plain paths readable", () => {
    expect(storageKey("sb-admin-2", "vendor/jquery/jquery.min.js")).toBe("sb-admin-2/vendor/jquery/jquery.min.js");
  });

  it("encodes brackets, spaces, unicode and other punctuation into safe characters", () => {
    for (const rel of [
      "_next/static/chunks/app/[slug]/page-abc.js",
      "_next/static/chunks/app/(dashboard)/[...rest]/page.js",
      "audio/海阔天空.mp3",
      "img/a b+c@2x.png",
      "assets/~tilde's*(x).css",
      "fonts/100%.woff2",
    ]) {
      const key = storageKey("demo", rel);
      expect(key, rel).toMatch(SAFE);
      expect(key.startsWith("demo/")).toBe(true);
      expect(key.split("/").length).toBe(rel.split("/").length + 1);
    }
  });

  it("is one-to-one: different paths never share a key", () => {
    const paths = ["a!b", "a%21b", "a~b", "a%7Eb", "a b", "a%20b", "a!20b", "[x]", "%5Bx%5D", "!5Bx!5D"];
    const keys = paths.map((p) => storageKey("s", p));
    expect(new Set(keys).size).toBe(paths.length);
  });
});
