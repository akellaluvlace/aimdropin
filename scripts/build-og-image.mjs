// Builds public/assets/og.jpg, the 1200x630 card shown when a link to the
// site is shared (lib/site.ts SITE_IMAGE): a tilted wall of real gallery
// thumbnails behind the site's headline.
//
//   node scripts/build-og-image.mjs
//
// Needs the dev dependencies (puppeteer, sharp) and a network connection for
// the three fonts, which load from Google Fonts while the card is drawn.
// Rerun it when the thumbnails or the headline change.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "assets", "og.jpg");
const thumb = (...parts) => pathToFileURL(path.join(ROOT, "public", "thumbs", ...parts)).href;

// Two landing pages to every dashboard, picked for contrast.
const LANDING = ["103-acid-glass-studio", "79-neo-brutalism", "101-luxury-watch-editorial", "52-swiss-minimalist", "98.op-art-bendaydots", "4-ai-product-landing", "57-bauhaus", "107-y2k-vaporwave-grid", "49-three-js", "90-risograph-print", "108-ethereal-fashion-noir", "74-acid-graphics", "54-synthwave", "75-hand-drawn", "07-bento-grid-landing", "60-aurora-gradients", "65-typographic-swiss-poster", "16-subscription-box-landing", "12-minimalist-product-store", "104-halftone-pop-art", "50-cyberpunk-high-tech", "73-abstract-3d", "28-creative-agency", "94-solarpunk", "55-y2k-web-1-0", "1-aether", "78-liquid-metal", "92-art-noveau", "08-apple-style-hero", "51-glassmorphism"];
const DASHBOARDS = ["angular-tailwind", "spur", "adminlte-3-html", "devias-material-kit-react", "hope-ui-html", "material-dashboard-shadcn", "black-dashboard-html", "coreui-free", "flowbite-react-admin-dashboard", "notus-react", "paper-dashboard-react", "now-ui-dashboard-react", "material-angular-dashboard", "react-saas-template", "volt-react-dashboard", "vuestic-admin"];
const tiles = [];
for (let i = 0; i < 48; i++) {
  tiles.push(i % 3 === 2 ? thumb("dashboards", `${DASHBOARDS[Math.floor(i / 3) % DASHBOARDS.length]}.webp`) : thumb(`${LANDING[(i - Math.floor(i / 3) + 3) % LANDING.length]}.webp`));
}

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;1,9..144,500&family=Instrument+Sans:wght@500;600&family=JetBrains+Mono:wght@700&display=block" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1200px; height: 630px; overflow: hidden; background: #0F0F0F; font-family: 'Instrument Sans', system-ui, sans-serif; }
.wall { position: absolute; inset: -330px -200px -330px 260px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; transform: rotate(-9deg); }
.wall img { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; object-position: top; border-radius: 5px; display: block; }
.fade { position: absolute; inset: 0; background: linear-gradient(90deg, #0F0F0F 0%, rgba(15,15,15,.82) 30%, rgba(15,15,15,0) 62%); }
.pill { position: absolute; left: 56px; top: 46px; background: #0F0F0F; color: #F5F1EA; font: 700 21px/1 'JetBrains Mono', monospace; letter-spacing: .06em; padding: 13px 18px; border: 3px solid #F5F1EA; }
.tag { position: absolute; right: 48px; top: 46px; background: #FFD23F; color: #0F0F0F; font: 700 19px/1 'JetBrains Mono', monospace; letter-spacing: .12em; padding: 13px 16px; border: 3px solid #0F0F0F; }
.panel { position: absolute; left: 56px; top: 118px; width: 668px; background: #F5F1EA; border: 5px solid #0F0F0F; box-shadow: 14px 14px 0 #FFD23F; padding: 38px 42px 40px; }
.chip { font: 700 17px/1 'JetBrains Mono', monospace; letter-spacing: .16em; text-transform: uppercase; color: #FF4D2E; }
h1 { margin-top: 20px; font: 500 78px/0.95 'Fraunces', serif; letter-spacing: -0.035em; color: #0F0F0F; font-variation-settings: "opsz" 144; }
h1 i { color: #FF4D2E; font-style: italic; }
.lead { margin-top: 24px; font: 500 25px/1.32 'Instrument Sans', sans-serif; color: #0F0F0F; letter-spacing: -0.005em; }
.lead b { font-weight: 600; }
</style></head><body>
<div class="wall">${tiles.map((t) => `<img src="${t}" alt="">`).join("")}</div>
<div class="fade"></div>
<div class="pill">aimdropin.com</div>
<div class="tag">FREE · OPEN SOURCE</div>
<div class="panel">
  <div class="chip">For vibecoders</div>
  <h1>Drop in.<br><i>Remix anything.</i><br>Ship it.</h1>
  <p class="lead"><b>Landing pages, live dashboards and UI components.</b> Preview them, edit them in your browser, take the code.</p>
</div>
</body></html>`;

const tmp = mkdtempSync(path.join(os.tmpdir(), "aimdropin-og-"));
const page = path.join(tmp, "og.html");
writeFileSync(page, html);

const browser = await puppeteer.launch({ headless: "shell", args: ["--allow-file-access-from-files"] });
try {
  const tab = await browser.newPage();
  await tab.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await tab.goto(pathToFileURL(page).href, { waitUntil: "networkidle0" });
  await tab.evaluate(() => document.fonts.ready);
  const state = await tab.evaluate(() => ({
    fonts: new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, ""))).size,
    images: [...document.images].filter((i) => i.naturalWidth > 0).length,
    total: document.images.length,
  }));
  if (state.fonts < 3 || state.images < state.total) {
    throw new Error(`not everything loaded (fonts ${state.fonts}/3, images ${state.images}/${state.total}); nothing written`);
  }
  const png = await tab.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await sharp(png).jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: "4:4:4" }).toFile(OUT);
  console.log(`wrote ${path.relative(ROOT, OUT)}`);
} finally {
  await browser.close();
  rmSync(tmp, { recursive: true, force: true });
}
