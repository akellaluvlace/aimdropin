import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The landing page's sprites (public/sprites) are strips of frames. Their
// frame sizes are written down twice: as CSS classes in app/arcade.css, and in
// the game's pose table in components/landing/WolfPlay.tsx. A size that drifts
// from its image shows as a sprite cut in the wrong place (the frisbee once
// showed "one and a quarter" of itself), so both tables are checked against
// the images here.
//
// And no sprite may ever change its image. Where a wolf changes pose (the game
// of fetch, the jumps on hover) each pose is its own sprite, on the page from
// the start, and one is shown at a time. A sprite whose image was swapped
// instead had to ask the server for the new one, and the wolf was not drawn
// until the answer came: on a real connection it blinked. So every image is
// named exactly once, in its own class, and the script names none.

const root = path.join(__dirname, "..");
const dir = path.join(root, "public/sprites");

// A PNG's size is in its header: width and height at bytes 16 and 20.
function pngSize(name: string) {
  const head = readFileSync(path.join(dir, `${name}.png`)).subarray(0, 24);
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

const css = readFileSync(path.join(root, "app/arcade.css"), "utf8");
const script = readFileSync(path.join(root, "components/landing/WolfPlay.tsx"), "utf8");
const markup = readFileSync(path.join(root, "components/landing/Arcade.tsx"), "utf8");
const files = readdirSync(dir).filter((f) => f.endsWith(".png")).map((f) => f.slice(0, -4));

const classes = [...css.matchAll(/\.px-[\w-]+ \{ --img: url\(\/sprites\/([\w-]+)\.png\); --w: (\d+); --h: (\d+);(?: --n: (\d+);)? \}/g)].map((m) => ({
  name: m[1],
  w: Number(m[2]),
  h: Number(m[3]),
  n: Number(m[4] ?? 1),
}));
const poses = [...script.matchAll(/img: "([\w-]+)",\s*w: (\d+),\s*h: (\d+),\s*n: (\d+)/g)].map((m) => ({
  name: m[1],
  w: Number(m[2]),
  h: Number(m[3]),
  n: Number(m[4]),
}));

describe("landing sprites", () => {
  it("finds the tables it checks", () => {
    expect(classes.length).toBeGreaterThanOrEqual(20);
    expect(poses.length).toBeGreaterThanOrEqual(6);
  });

  it.each(classes)("stylesheet: $name is $n frames of $w by $h", ({ name, w, h, n }) => {
    expect(pngSize(name)).toEqual({ width: w * n, height: h });
  });

  it.each(poses)("game: $name is $n frames of $w by $h", ({ name, w, h, n }) => {
    expect(pngSize(name)).toEqual({ width: w * n, height: h });
  });

  it("game: the frisbee's size matches its image", () => {
    const disc = script.match(/const DISC = \{ w: (\d+), h: (\d+), frames: (\d+) \}/);
    expect(disc).not.toBeNull();
    expect(pngSize("disc")).toEqual({ width: Number(disc![1]) * Number(disc![3]), height: Number(disc![2]) });
  });

  it("names every image once, in its own class: no rule swaps a sprite's image", () => {
    const urls = [...css.matchAll(/url\(\/sprites\/([\w-]+)\.png\)/g)].map((m) => m[1]);
    expect(urls.sort()).toEqual(classes.map((c) => c.name).sort());
    expect(new Set(urls).size).toBe(urls.length);
    // --img is set by the classes and by nothing else
    expect([...css.matchAll(/--img:/g)].length).toBe(classes.length);
  });

  it("game: the script never sets a sprite's image", () => {
    expect(script).not.toMatch(/\/sprites\//);
    expect(script).not.toMatch(/--img/);
    expect(script).not.toMatch(/backgroundImage\s*=/);
  });

  it("game: every pose has its sprite in the markup", () => {
    const list = markup.match(/const YARD_POSES: Sprite\[\] = \[([^\]]+)\]/);
    expect(list).not.toBeNull();
    const inMarkup = [...list![1].matchAll(/"([\w-]+)"/g)].map((m) => m[1]);
    expect(inMarkup.sort()).toEqual(poses.map((p) => p.name).sort());
  });

  it("ships no sprite that nothing names", () => {
    const named = new Set([...css.matchAll(/\/sprites\/([\w-]+)\.png/g), ...script.matchAll(/img: "([\w-]+)"/g)].map((m) => m[1]));
    expect(files.filter((f) => !named.has(f))).toEqual([]);
  });

  it("names no sprite that is missing", () => {
    const named = [...css.matchAll(/\/sprites\/([\w-]+)\.png/g), ...script.matchAll(/img: "([\w-]+)"/g)].map((m) => m[1]);
    expect(named.filter((n) => !files.includes(n))).toEqual([]);
  });
});
