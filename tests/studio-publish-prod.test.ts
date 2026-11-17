// lib/studio/publish-rules.ts - what a publish request may set and what the
// automatic checks' verdict turns into.

import { describe, it, expect } from "vitest";
import { parsePublishRequest, statusForVerdict } from "@/lib/studio/publish-rules";

const good = { title: " My page ", description: "", purpose: "landing", visibility: "public", license: true };

describe("parsePublishRequest", () => {
  it("accepts a complete request and trims it", () => {
    expect(parsePublishRequest(good)).toEqual({
      ok: true,
      value: { title: "My page", description: null, purpose: "landing", visibility: "public", username: undefined },
    });
    const withName = parsePublishRequest({ ...good, username: "Ada-Lovelace" });
    expect(withName.ok && withName.value.username).toBe("ada-lovelace");
  });

  it("requires a title, a purpose, a visibility and the MIT confirmation", () => {
    expect(parsePublishRequest({ ...good, title: "  " })).toMatchObject({ ok: false });
    expect(parsePublishRequest({ ...good, purpose: "casino" })).toMatchObject({ ok: false });
    expect(parsePublishRequest({ ...good, visibility: "private" })).toMatchObject({ ok: false });
    expect(parsePublishRequest({ ...good, license: "yes" })).toMatchObject({ ok: false });
    expect(parsePublishRequest(null)).toMatchObject({ ok: false });
  });

  it("rejects bad usernames and overlong text", () => {
    for (const username of ["-x", "a", "has space", "x".repeat(40), "émile"]) {
      expect(parsePublishRequest({ ...good, username })).toMatchObject({ ok: false });
    }
    expect(parsePublishRequest({ ...good, title: "t".repeat(121) })).toMatchObject({ ok: false });
    expect(parsePublishRequest({ ...good, description: "d".repeat(501) })).toMatchObject({ ok: false });
  });
});

describe("statusForVerdict", () => {
  it("publishes clean pages, holds flagged ones and refuses blocked ones", () => {
    expect(statusForVerdict("pass")).toBe("published");
    expect(statusForVerdict("review")).toBe("pending_review");
    expect(statusForVerdict("reject")).toBe("rejected");
  });
});
