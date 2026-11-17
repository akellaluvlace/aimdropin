import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoStoreError, fetchDemoFile, readDemoText, retryDelayMs } from "@/lib/dashboards/demo-store";

// Storage mode: every demo file is read from the bucket at DEMO_STORAGE_URL.
const BASE = "https://bucket.test/storage/v1/object/public/demos";

function reply(status: number, body = "", headers: Record<string, string> = {}) {
  return new Response(body, { status, headers });
}

describe("demo storage reads", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.stubEnv("DEMO_STORAGE_URL", BASE);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("asks again after a 429 and returns the file", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(429, "slow down", { "retry-after": "0.01" }))
      .mockResolvedValueOnce(reply(200, "<html>ok</html>"));
    await expect(readDemoText("demo", "index.html")).resolves.toBe("<html>ok</html>");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/demo/index.html`);
  });

  it("gives up after three retries with a storage error, not a missing file", async () => {
    fetchMock.mockImplementation(async () => reply(429, "slow down", { "retry-after": "0.01" }));
    await expect(readDemoText("demo", "index.html")).rejects.toBeInstanceOf(DemoStoreError);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("asks again after a 500 from the bucket", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(500, "internal error", { "retry-after": "0.01" }))
      .mockResolvedValueOnce(reply(200, "body{}"));
    const file = await fetchDemoFile("demo", "app.css", "GET", null);
    expect(file?.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("asks again after a dropped connection", async () => {
    fetchMock
      .mockRejectedValueOnce(Object.assign(new TypeError("fetch failed"), { name: "TypeError" }))
      .mockResolvedValueOnce(reply(200, "<html>back</html>"));
    await expect(readDemoText("demo", "index.html")).resolves.toBe("<html>back</html>");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a missing file", async () => {
    fetchMock.mockResolvedValue(reply(404, "not found"));
    await expect(readDemoText("demo", "nope.html")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the Range header when it retries a partial read", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(503, "busy", { "retry-after": "0.01" }))
      .mockResolvedValueOnce(reply(206, "x".repeat(10), { "content-range": "bytes 0-9/100", "content-length": "10" }));
    const file = await fetchDemoFile("demo", "media/clip.mp4", "GET", "bytes=0-9");
    expect(file?.status).toBe(206);
    expect(file?.headers["Content-Range"]).toBe("bytes 0-9/100");
    for (const call of fetchMock.mock.calls) expect(call[1].headers.range).toBe("bytes=0-9");
  });
});

describe("retryDelayMs", () => {
  it("follows Retry-After when the bucket sends one", () => {
    const d = retryDelayMs("1", 0);
    expect(d).toBeGreaterThanOrEqual(750);
    expect(d).toBeLessThanOrEqual(1250);
  });

  it("backs off from 250 ms and never waits more than 2 s", () => {
    for (let i = 0; i < 50; i++) {
      expect(retryDelayMs(null, 0)).toBeLessThanOrEqual(312.5);
      expect(retryDelayMs(null, 0)).toBeGreaterThanOrEqual(187.5);
      expect(retryDelayMs(null, 2)).toBeLessThanOrEqual(1250);
      expect(retryDelayMs("120", 0)).toBe(2000);
      expect(retryDelayMs("junk", 5)).toBeLessThanOrEqual(2000);
    }
  });
});
