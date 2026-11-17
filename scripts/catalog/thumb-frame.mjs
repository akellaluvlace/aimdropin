// Turn a preview screenshot into a card thumbnail that shows the item, not
// the empty canvas around it: trim the uniform background, then fit the
// content into an 800×500 card on that same background, with breathing room.
// Full pages that fill the frame are just cropped from the top.

import sharp from "sharp";

export const THUMB_W = 800;
export const THUMB_H = 500;
// Never blow small content up more than this (it gets blurry).
const MAX_UPSCALE = 2.5;

// Ignore this many pixels at each edge: iframe borders and scrollbars would
// otherwise make every capture look "full" and stop the trim.
const EDGE = 10;

export async function frameThumb(png) {
  const meta = await sharp(png).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (W <= EDGE * 4 || H <= EDGE * 4) return null;
  const inner = await sharp(png)
    .extract({ left: EDGE, top: EDGE, width: W - EDGE * 2, height: H - EDGE * 2 })
    .png()
    .toBuffer();
  const { data: corner } = await sharp(inner)
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const background = { r: corner[0], g: corner[1], b: corner[2] };

  let trimmed;
  let info;
  try {
    const r = await sharp(inner)
      .trim({ background, threshold: 18 })
      .toBuffer({ resolveWithObject: true });
    trimmed = r.data;
    info = r.info;
  } catch {
    // Completely uniform image: nothing rendered.
    return null;
  }
  const fill = (info.width * info.height) / ((W - EDGE * 2) * (H - EDGE * 2));
  if (fill > 0.6) {
    return sharp(png)
      .resize(THUMB_W, THUMB_H, { fit: "cover", position: "top" })
      .webp({ quality: 72 })
      .toBuffer();
  }
  const boxW = Math.round(THUMB_W * 0.84);
  const boxH = Math.round(THUMB_H * 0.8);
  const scale = Math.min(boxW / info.width, boxH / info.height, MAX_UPSCALE);
  const w = Math.max(1, Math.round(info.width * scale));
  const h = Math.max(1, Math.round(info.height * scale));
  const content = await sharp(trimmed).resize(w, h).toBuffer();
  return sharp({
    create: { width: THUMB_W, height: THUMB_H, channels: 3, background },
  })
    .composite([
      {
        input: content,
        left: Math.round((THUMB_W - w) / 2),
        top: Math.round((THUMB_H - h) / 2),
      },
    ])
    .webp({ quality: 72 })
    .toBuffer();
}
