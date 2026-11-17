// Sum, a concept shop for one watch (components/gsap/sum), on /gallery/gsap/sum.
// Checks: the route (indexed, its own share card, readable without JavaScript, a title and a
// description of its own); the entrance; that the page scrolls an element of its own and never the
// document; the time in the headline, for long times too; that words and picture keep to their own
// room at every rest, on wide stages and tall ones, across a sweep of window sizes; the sum (it
// adds up to 147 on the page, and in the head's description); the hands (drawn, apart at their own
// stop, geared to the scroll), the steel bracelet and the crystal (glass, where it is on its own);
// the pacing of the picture for each screen of scroll; arrow keys, step buttons and the rail; the
// three faces, the photographs, the bag; that Sum stands on its own (it says it is a concept, and
// nothing it says, labels or links to names or sells whoever hosts it); a phone toolbar changing
// the window's height; reduced motion; no WebGL; a lost WebGL context; engines that validate
// attribute names the older way; and, with a playwright-core path, WebKit.
// Run against a production build; BASE_URL defaults to port 3001.
// Optional argument: path to playwright-core/index.mjs for the WebKit pass. QUICK=1 skips the size sweeps.
// This is not a physical-device smoothness test.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

const base = (process.env.BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const route = `${base}/gallery/gsap/sum`;
const executablePath = process.env.CHROME_PATH || { darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }[process.platform];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const errors = [];
const GPU = ['--enable-gpu', '--ignore-gpu-blocklist', ...(process.platform === 'darwin' ? ['--use-angle=metal'] : [])];
const quick = process.env.QUICK === '1';

// The score, as the page has it (components/gsap/sum/score.ts). Kept here in figures on
// purpose: a change to the score has to be made here too, and so gets looked at.
const SCREENS = 22.95;
const REST = { now: 0, apart: 2.3, crystal: 3.4, hands: 4.5, dial: 5.65, case: 6.9, calibre: 8.05, turned: 9.35, rotor: 10.6, caseback: 11.8, whole: 13.85, back: 15.15, silver: 16.1, salmon: 17.15, ink: 18.25, cuff: 19.15, bench: 20.15, rail: 21.15, yours: 22.95 };
const RESTS = Object.values(REST);

// Installed before the page's own scripts: count every write to the document's scroll.
const instrument = () => {
  window.__writes = 0;
  const count = original => function (...args) { window.__writes++; return original.apply(this, args); };
  window.scrollTo = count(window.scrollTo);
  window.scroll = count(window.scroll);
  window.scrollBy = count(window.scrollBy);
};
// A fixed time of day that keeps running: 27 minutes past 11, the longest the headline has to set.
const clock = (hours, minutes) => [(h, m) => {
  const Real = Date, fixed = new Real(2026, 10, 16, h, m, 40).getTime(), started = Real.now();
  class Fixed extends Real { constructor(...args) { if (args.length) super(...args); else super(fixed + (Real.now() - started)); } static now() { return fixed + (Real.now() - started); } }
  window.Date = Fixed;
}, hours, minutes];
// Engines that still validate attribute names against the XML Name production (see verify-older-engines.mjs).
const older = () => {
  window.__refused = [];
  const NAME = /^[A-Za-z_:\u00C0-\uFFFF][-.0-9A-Za-z_:\u00B7\u00C0-\uFFFF]*$/;
  for (const method of ['setAttribute', 'toggleAttribute']) {
    const original = Element.prototype[method];
    Element.prototype[method] = function (name, ...rest) {
      if (!NAME.test(String(name))) { window.__refused.push(`${method}(${JSON.stringify(String(name))})`); throw new DOMException(`'${name}' is not a valid attribute name.`, 'InvalidCharacterError'); }
      return original.call(this, name, ...rest);
    };
  }
};
const watchPage = (page, label) => {
  // A tab that is lost (its process dies) is said at once: what follows is a "detached Frame" from whatever asked next.
  page.on('error', error => { errors.push(`${label}: the tab was lost (${error.message})`); console.log(`${label}: the tab was lost (${error.message})`); });
  page.on('pageerror', error => errors.push(`${label}: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error' && !/favicon|Failed to load resource/.test(message.text())) errors.push(`${label} console: ${message.text().slice(0, 200)}`); });
};
const enter = async (page, url = route) => {
  await page.goto(url, { waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-sum][data-entered="true"]', { timeout: 30000 });
  await pause(500);
};
/** Put the page at a place in the score (screens of scroll) and let it come to rest there. */
const seek = async (page, at, wait = 700) => {
  await page.evaluate(at => { const scroller = document.querySelector('[data-sum] [data-scroller]'); scroller.scrollTop = at * scroller.clientHeight; }, at);
  await pause(wait);
};
const place = page => page.evaluate(() => { const scroller = document.querySelector('[data-sum] [data-scroller]'); return scroller.scrollTop / scroller.clientHeight; });
// Mean colour of a patch of what is on screen, as shares of the viewport.
const patch = async (page, x, y, w = 0.06, h = 0.06) => {
  const viewport = page.viewport();
  const scale = viewport.deviceScaleFactor || 1;
  const { data } = await sharp(await page.screenshot({ type: 'png' })).extract({ left: Math.round(x * viewport.width * scale), top: Math.round(y * viewport.height * scale), width: Math.max(1, Math.round(w * viewport.width * scale)), height: Math.max(1, Math.round(h * viewport.height * scale)) }).resize(1, 1).raw().toBuffer({ resolveWithObject: true });
  return { r: data[0], g: data[1], b: data[2], luma: Math.round(0.299 * data[0] + 0.587 * data[1] + 0.114 * data[2]) };
};

/**
 * What is in a part of the screen (shares of the viewport) besides paper: how much blued steel, how much red
 * lacquer, and how much of anything grey. In CSS pixels, whatever the screen's own are.
 */
const inks = async (page, x, y, w, h) => {
  const viewport = page.viewport(), scale = viewport.deviceScaleFactor || 1;
  const { data, info } = await sharp(await page.screenshot({ type: 'png' })).extract({ left: Math.round(x * viewport.width * scale), top: Math.round(y * viewport.height * scale), width: Math.round(w * viewport.width * scale), height: Math.round(h * viewport.height * scale) }).raw().toBuffer({ resolveWithObject: true });
  let blue = 0, red = 0, grey = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2], most = Math.max(r, g, b), least = Math.min(r, g, b);
    if (b > 90 && b > r * 1.9 && b > g * 1.35) blue++; else if (r > 120 && r > g * 2.2 && r > b * 1.6) red++; else if (most > 110 && most < 205 && most - least < 30) grey++;
  }
  return { blue: Math.round(blue / scale ** 2), red: Math.round(red / scale ** 2), grey: Math.round(grey / scale ** 2) };
};

/**
 * The crystal as it is on the screen now, read at sixteen places round it: the picture just inside its rim
 * less the backdrop just outside it (lightness, of 255). Glass on its own has a body and mirrors the room, so
 * its inside is not the backdrop's colour, and is not one colour all the way round. An empty ring gives
 * differences of one or two.
 */
const crystalRead = async (page, scale = page.viewport().deviceScaleFactor || 1) => {
  const spots = await page.$eval('[data-sum]', root => {
    const handle = root.sumWatch, canvas = root.querySelector('[data-watch]').getBoundingClientRect();
    // On its upper face: 14.2 mm from its middle is inside the ground band, 20.6 mm is clear of its edge.
    const place = (radius, angle) => { const p = handle.project('crystal', Math.cos(angle) * radius, Math.sin(angle) * radius, 0.35); return [p.x + canvas.left, p.y + canvas.top]; };
    return Array.from({ length: 16 }, (_, i) => { const angle = ((i + 0.5) / 16) * Math.PI * 2; return { inside: place(14.2, angle), outside: place(20.6, angle) }; });
  });
  const { data, info } = await sharp(await page.screenshot({ type: 'png' })).raw().toBuffer({ resolveWithObject: true });
  // The mean over seven CSS pixels square.
  const lightness = ([x, y]) => {
    let sum = 0, count = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const px = Math.round((x + dx) * scale), py = Math.round((y + dy) * scale);
      if (px < 0 || py < 0 || px >= info.width || py >= info.height) return NaN;
      const i = (py * info.width + px) * info.channels;
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; count++;
    }
    return sum / count;
  };
  const pairs = spots.map(spot => ({ inside: lightness(spot.inside), outside: lightness(spot.outside) })).filter(pair => !Number.isNaN(pair.inside) && !Number.isNaN(pair.outside));
  const differences = pairs.map(pair => pair.inside - pair.outside);
  return {
    places: pairs.length,
    differing: differences.filter(difference => Math.abs(difference) >= 4).length,
    mean: differences.reduce((sum, difference) => sum + Math.abs(difference), 0) / Math.max(1, pairs.length),
    spread: Math.max(...pairs.map(pair => pair.inside)) - Math.min(...pairs.map(pair => pair.inside)),
    said: differences.map(difference => difference.toFixed(0)).join(' '),
  };
};
/** At its own stop the crystal reads as glass: see crystalRead. (As an empty ring it gave 2 of 16, 1.5 and 5.) */
const glassy = (read, label) => {
  assert.equal(read.places, 16, `${label}: the crystal and the backdrop round it are in the picture`);
  assert.ok(read.differing >= 10, `${label}: inside its rim the crystal is not the backdrop's colour (${read.differing} of 16 places differ by 4 or more: ${read.said})`);
  assert.ok(read.mean >= 3.5, `${label}: by ${read.mean.toFixed(1)} on average`);
  assert.ok(read.spread >= 9, `${label}: and a reflection crosses it (its inside varies by ${read.spread.toFixed(1)})`);
};

/**
 * What is on the stage right now, as boxes: every piece of text a reader can see, the chrome, and the
 * watch's parts that are in the picture. Read in the page, so it is what the browser laid out.
 */
const layout = () => {
  const root = document.querySelector('[data-sum]');
  const stage = root.getBoundingClientRect();
  const canvasEl = root.querySelector('[data-watch]');
  const canvas = canvasEl.getBoundingClientRect();
  const seen = element => { for (let node = element; node && node !== root; node = node.parentElement) { const style = getComputedStyle(node); if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.5) return false; } return true; };
  // The glyphs' own box, cut to the window they are shown through (a line that has risen out of its window is not there).
  const textBox = element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const rects = [...range.getClientRects()].filter(rect => rect.width > 0.5 && rect.height > 0.5);
    if (!rects.length) return null;
    let box = { left: Math.min(...rects.map(r => r.left)), right: Math.max(...rects.map(r => r.right)), top: Math.min(...rects.map(r => r.top)), bottom: Math.max(...rects.map(r => r.bottom)) };
    const mask = element.closest('[class*="line"]');
    if (mask && element.hasAttribute('data-line')) { const m = mask.getBoundingClientRect(); box = { left: Math.max(box.left, m.left), right: Math.min(box.right, m.right), top: Math.max(box.top, m.top), bottom: Math.min(box.bottom, m.bottom) }; if (box.bottom - box.top < 2) return null; }
    return box;
  };
  const union = boxes => (boxes.length ? { left: Math.min(...boxes.map(b => b.left)), right: Math.max(...boxes.map(b => b.right)), top: Math.min(...boxes.map(b => b.top)), bottom: Math.max(...boxes.map(b => b.bottom)) } : null);
  // Anything half way: a piece of text part faded, or a line part risen. At a rest there should be none.
  const fading = [];
  const opacityOf = element => { let value = 1; for (let node = element; node && node !== root; node = node.parentElement) value *= Number(getComputedStyle(node).opacity); return value; };
  for (const block of root.querySelectorAll('[data-words], [data-caption]')) {
    if (getComputedStyle(block).visibility === 'hidden' || getComputedStyle(block).display === 'none') continue;
    for (const piece of block.querySelectorAll('[data-fade], [data-face-note], [data-turned]')) { if (getComputedStyle(piece).display === 'none') continue; const o = opacityOf(piece); if (o > 0.03 && o < 0.97) fading.push(`${block.dataset.words ?? 'caption'}: "${piece.textContent.slice(0, 28)}" at ${o.toFixed(2)}`); }
    for (const line of block.querySelectorAll('[data-line]')) { if (!line.textContent || getComputedStyle(line).display === 'none' || getComputedStyle(line).visibility === 'hidden') continue; const shift = Math.abs(new DOMMatrixReadOnly(getComputedStyle(line).transform).m42), height = line.offsetHeight || 1; if (shift > 1 && shift < height * 1.05) fading.push(`${block.dataset.words ?? 'caption'}: line "${line.textContent.slice(0, 28)}" ${Math.round(shift)}px off`); }
  }
  const words = [];
  for (const block of root.querySelectorAll('[data-words]')) {
    if (!seen(block)) continue;
    // (The line that says how to go on is looked at on its own, below: on a phone it stands inside this block.)
    // Piece by piece (a heading, a paragraph): one box round a whole block would claim room nothing stands in.
    for (const piece of [...block.querySelectorAll('[data-line], [data-fade], [data-face-note]')].filter(seen)) { const box = textBox(piece); if (box) words.push({ name: block.dataset.words, ...box }); }
  }
  const boxOf = selector => { const element = root.querySelector(selector); if (!element || !seen(element)) return null; const r = element.getBoundingClientRect(); return r.width ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null; };
  const cue = [...root.querySelectorAll('[data-cue]')].filter(seen).map(el => el.getBoundingClientRect()).filter(r => r.width).map(r => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom }))[0] ?? null;
  const labels = [...root.querySelectorAll('[data-label]')].filter(seen).map(el => { const r = el.getBoundingClientRect(); return { name: el.dataset.label, left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });
  const captions = [...root.querySelectorAll('[data-caption]')].filter(seen).map(el => union([...el.querySelectorAll('[data-line], [data-fade]')].filter(seen).map(textBox).filter(Boolean))).filter(Boolean);
  // The parts in the picture: the box of the points on each part's edge that fall inside the canvas.
  // The case is as wide as its 39 mm (and its crown, at 3 o'clock) and as tall as its lugs.
  const reach = { crystal: [17.7, 17.7], hands: [15, 15], dial: [17.7, 17.7], case: [19.7, 23.6], calibre: [14.8, 14.8], rotor: [13.5, 13.5], caseback: [18.7, 18.7] };
  const parts = [];
  const handle = root.sumWatch;
  if (handle) {
    for (const [id, [across, along]] of Object.entries(reach)) {
      if (!handle.state.parts[id].visible) continue;
      // The hands are three, each as long as it is, and at their own stop each stands at a height of its own:
      // the circle each could sweep, where it is. (The seconds hand goes all the way round there.)
      const rings = id === 'hands' ? [[9.1, 9.1, -handle.state.hands.drop], [13.5, 13.5, 0], [across, along, handle.state.hands.lift]] : [[across, along, 0]];
      const points = [];
      for (const [wide, tall, height] of rings) for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; const p = handle.project(id, Math.cos(a) * (id === 'case' && Math.cos(a) > 0.92 ? 21.9 : wide), Math.sin(a) * tall, height); if (!p.behind) points.push([p.x + canvas.left, p.y + canvas.top]); }
      const inside = points.filter(([x, y]) => x > canvas.left && x < canvas.right && y > canvas.top && y < canvas.bottom);
      if (inside.length < 3) continue;
      parts.push({ name: id, left: Math.min(...inside.map(p => p[0])), right: Math.max(...inside.map(p => p[0])), top: Math.min(...inside.map(p => p[1])), bottom: Math.max(...inside.map(p => p[1])) });
    }
  }
  const photos = seen(root.querySelector('[data-photos]'));
  return {
    shape: root.dataset.shape, stage: { left: stage.left, right: stage.right, top: stage.top, bottom: stage.bottom }, canvas: { left: canvas.left, right: canvas.right, top: canvas.top, bottom: canvas.bottom },
    words, cue, labels, captions, parts, photos, fading,
    equation: boxOf('[data-ledger]'), rail: boxOf('[data-rail]'), pager: boxOf('[data-pager]'), tools: boxOf('[class*="tools"]'), wordmark: boxOf('[class*="wordmark"]'),
  };
};
const overlap = (a, b, gap = 0) => a && b && a.left < b.right + gap && b.left < a.right + gap && a.top < b.bottom + gap && b.top < a.bottom + gap;
const fmt = box => (box ? `[${Math.round(box.left)},${Math.round(box.top)} ${Math.round(box.right)},${Math.round(box.bottom)}]` : 'none');
/** Words and picture each in their own room, and nothing over anything else: the rule the layout is built on. */
const roomy = (found, label) => {
  const { shape, stage, canvas, words, cue, labels, captions, parts, photos, equation, rail, pager, tools, wordmark } = found;
  assert.deepEqual(found.fading, [], `${label}: nothing is half way at a rest`);
  const text = [...words, ...(cue ? [{ name: 'cue', ...cue }] : []), ...(equation ? [{ name: 'equation', ...equation }] : [])];
  for (const box of [...text, ...captions.map(c => ({ name: 'caption', ...c }))]) {
    assert.ok(box.left >= stage.left + 4 && box.right <= stage.right - 4, `${label}: ${box.name} stays inside the stage across ${fmt(box)}`);
    assert.ok(box.top >= stage.top + 4 && box.bottom <= stage.bottom - 2, `${label}: ${box.name} stays inside the stage down ${fmt(box)} of ${fmt(stage)}`);
    assert.ok(!overlap(box, tools, 2), `${label}: ${box.name} ${fmt(box)} clear of the tools ${fmt(tools)}`);
    assert.ok(!overlap(box, wordmark, 2), `${label}: ${box.name} ${fmt(box)} clear of the wordmark ${fmt(wordmark)}`);
    assert.ok(!overlap(box, rail, 1), `${label}: ${box.name} ${fmt(box)} clear of the rail ${fmt(rail)}`);
    assert.ok(!overlap(box, pager, 2), `${label}: ${box.name} ${fmt(box)} clear of the step buttons ${fmt(pager)}`);
  }
  // Pieces of one block are laid out by the browser one under the other; it is blocks that could run into each other.
  for (let i = 0; i < text.length; i++) for (let j = i + 1; j < text.length; j++) if (text[i].name !== text[j].name) assert.ok(!overlap(text[i], text[j], 1), `${label}: ${text[i].name} ${fmt(text[i])} clear of ${text[j].name} ${fmt(text[j])}`);
  if (photos) return;
  if (shape === 'tall') {
    // Under the picture, all of it.
    for (const box of text) assert.ok(box.top >= canvas.bottom - 1, `${label}: ${box.name} ${fmt(box)} stands under the picture, which ends at ${Math.round(canvas.bottom)}`);
  } else {
    for (const box of text) for (const part of parts) assert.ok(!overlap(box, part, 4), `${label}: ${box.name} ${fmt(box)} clear of the ${part.name} ${fmt(part)}`);
  }
  for (const name of labels) {
    assert.ok(name.left >= canvas.left + 2 && name.right <= canvas.right - 2 && name.bottom <= canvas.bottom - 2, `${label}: the name "${name.name}" stays in the picture ${fmt(name)}`);
    for (const box of text) assert.ok(!overlap(name, box, 2), `${label}: the name "${name.name}" ${fmt(name)} clear of ${box.name} ${fmt(box)}`);
    assert.ok(!overlap(name, rail, 2) && !overlap(name, tools, 2) && !overlap(name, wordmark, 2) && !overlap(name, pager, 2), `${label}: the name "${name.name}" ${fmt(name)} clear of the chrome (rail ${fmt(rail)})`);
  }
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) assert.ok(!overlap(labels[i], labels[j], 1), `${label}: the names "${labels[i].name}" and "${labels[j].name}" do not run into each other`);
};

/** In a sweep, every size is looked at before anything fails: the list is what tells where a breakpoint is wrong. */
const findings = [];
const sweepCheck = (found, label) => { try { roomy(found, label); } catch (error) { findings.push(error.message); } };
const sweepDone = what => { assert.deepEqual(findings.splice(0), [], `${what}: words and picture keep their rooms at every size`); };

// The rests the sweeps look at: the ones with the most on the stage.
const KEY = ['now', 'apart', 'hands', 'calibre', 'turned', 'whole', 'back', 'salmon', 'cuff', 'yours'];
/** Wide stages: one page, resized. Heights in 20px steps (a few sample sizes miss the gaps between breakpoints), then widths. */
async function sweepWide(browser) {
  const sweep = await browser.newPage();
  watchPage(sweep, 'sweep');
  await sweep.evaluateOnNewDocument(...clock(11, 27));
  await sweep.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await enter(sweep);
  // Heights in 20px steps (a few sample sizes miss the gaps between breakpoints), then widths.
  const sizes = [];
  for (let height = 400; height <= 1120; height += 20) sizes.push([1440, height]);
  for (let width = 960; width <= 2000; width += 80) sizes.push([width, 800]);
  sizes.push([844, 390], [932, 430], [1024, 768], [1180, 820], [1920, 1080], [2560, 1440], [1100, 1000]);
  for (const [width, height] of sizes) {
    if (width / height < 1.05) continue;
    await sweep.setViewport({ width, height, deviceScaleFactor: 1 });
    await pause(350);
    for (const name of KEY) {
      // (The first rest follows a jump back from the end of the page: it is given longer to arrive.)
      await seek(sweep, REST[name], name === 'now' ? 1300 : 520);
      const found = await sweep.evaluate(layout);
      assert.equal(found.shape, 'wide');
      sweepCheck(found, `${width}x${height} ${name}`);
    }
    const lines = await sweep.$$eval('[data-words="now"] [data-line]', all => all.filter(line => line.textContent).map(line => [line.textContent, line.scrollWidth, line.parentElement.clientWidth]));
    for (const [text, wide, room] of lines) if (wide > room + 1) findings.push(`${width}x${height}: "${text}" does not fit its column (${wide} of ${room})`);
  }
  await sweep.close();
  sweepDone('wide stages');
  console.log(`wide stages: ok (${sizes.length} window sizes)`);
}
/** Tall stages: phones and tablets held upright. */
async function sweepTall(browser) {
  // Phone and tablet sizes, each loaded as its own page (a phone ignores a change of height alone).
  const sizes = [[320, 568], [360, 640], [375, 667], [430, 932], [768, 1024], [820, 1180]];
  for (let height = 560; height <= 940; height += 20) sizes.push([390, height]);
  for (const [width, height] of sizes) {
    const page = await browser.newPage();
    watchPage(page, `${width}x${height}`);
    await page.evaluateOnNewDocument(...clock(11, 27));
    await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await enter(page);
    await pause(700);
    for (const name of KEY) {
      await seek(page, REST[name], name === 'now' ? 700 : 520);
      const found = await page.evaluate(layout);
      assert.equal(found.shape, 'tall');
      sweepCheck(found, `${width}x${height} ${name}`);
    }
    const lines = await page.$$eval('[data-words="now"] [data-line]', all => all.filter(line => line.textContent).map(line => [line.textContent, line.scrollWidth, line.parentElement.clientWidth]));
    for (const [text, wide, room] of lines) if (wide > room + 1) findings.push(`${width}x${height}: "${text}" does not fit its column (${wide} of ${room})`);
    await page.close();
  }
  sweepDone('tall stages');
  console.log(`tall stages: ok (${sizes.length} window sizes)`);
}
/** Both sweeps, each to its end, so one run lists everything there is to fix. */
const sweeps = async browser => {
  const found = [];
  for (const sweep of process.env.SWEEPS === 'tall' ? [sweepTall] : process.env.SWEEPS === 'wide' ? [sweepWide] : [sweepWide, sweepTall]) { try { await sweep(browser); } catch (error) { found.push(...(Array.isArray(error.actual) ? error.actual : [error.message])); } }
  if (found.length) { console.log(found.join('\n')); throw new Error(`${found.length} findings in the window-size sweeps`); }
};

/** Whoever hosts Sum. Sum is made to stand on its own: nothing in it names, credits, links to or sells them. */
const HOST = /akella|inmotion/i;
/** What the head's description says the parts come to: it has to be the sum the page adds up to. */
let described = NaN;

const browser = await puppeteer.launch({ executablePath, headless: true, args: GPU });
try {
  // ---------- The route: a page of its own, readable as HTML ----------
  {
    const response = await fetch(route);
    assert.equal(response.status, 200, 'The route answers');
    // React leaves comment markers between pieces of text: they are not part of what is read.
    const html = (await response.text()).replace(/<!-- -->/g, '');
    assert.doesNotMatch(html, /<meta name="robots" content="noindex/, 'It may be found by search engines here');
    // Its title and description are its own. The host's layout puts the host's name elsewhere in the head (the
    // site's name, the card's address), and that is the host's business: only what Sum says of itself is read here.
    const meta = name => new RegExp(`<meta (?:name|property)="${name}" content="([^"]*)"`).exec(html)?.[1];
    const title = /<title>([^<]*)<\/title>/.exec(html)?.[1];
    assert.equal(title, 'Sum, a concept shop for one watch', 'Its own title, with nothing after it');
    assert.equal(meta('og:title'), title, 'And the same title on a shared link');
    assert.equal(meta('description'), 'A concept shop for a watch brand that does not exist: one watch, taken apart into its 147 parts and put back.', 'What it is, in a sentence');
    assert.equal(meta('og:description'), meta('description'), 'And the same sentence on a shared link');
    for (const name of ['twitter:title', 'twitter:description']) assert.doesNotMatch(meta(name) ?? '', HOST, `${name} does not name the host`);
    described = Number(/into its (\d+) parts/.exec(meta('description'))?.[1]);
    assert.match(html, /property="og:image" content="[^"]*\/thumbs\/gsap\/sum\.webp/, 'A share card of its own: a screen from the site');
    assert.match(html, /<link rel="canonical" href="[^"]*\/gallery\/gsap\/sum"/, 'It names its own address');
    assert.match(html, /data-sum/, 'The demo is in the HTML');
    assert.match(html, /It is<\/span>/, 'The headline is in the HTML');
    assert.match(html, /Sum is a concept, so there is nothing to pay for\./, 'It says it is a concept');
    // The demo's own markup, as it is served (what is read without JavaScript): from its root to the end of
    // the page's main element.
    const served = /<div[^>]*\sdata-sum[\s=>][\s\S]*?<\/main>/.exec(html)?.[0] ?? '';
    assert.ok(served.length > 5000, 'The demo is served whole');
    assert.doesNotMatch(served, HOST, 'As it is served, the demo does not name whoever hosts it');
    assert.doesNotMatch(html.replace(/<script[\s\S]*?<\/script>/g, ''), /[\u2013\u2014]/, 'No en or em dashes in its copy');
    console.log('route: ok');
  }

  // SWEEPS=1 runs only the window-size sweeps (for working on the layout); SWEEPS=wide or SWEEPS=tall, one of them.
  if (process.env.SWEEPS) {
    await sweeps(browser);
    console.log('Sum: sweeps passed');
    process.exit(0);
  }

  // ---------- Desktop: entrance, the time, the score ----------
  const desk = await browser.newPage();
  watchPage(desk, 'desktop');
  await desk.evaluateOnNewDocument(instrument);
  await desk.evaluateOnNewDocument(...clock(11, 27));
  await desk.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await desk.goto(route, { waitUntil: 'domcontentloaded' });
  // The veil is up until the parts are in, and counts them.
  assert.equal(await desk.$eval('[data-sum]', root => root.dataset.entered), 'false', 'Not entered while loading');
  await desk.waitForSelector('[data-sum][data-entered="true"]', { timeout: 30000 });
  assert.equal(await desk.$eval('[data-load-count]', el => el.textContent), '147', 'The loader counted every part in');
  assert.equal(await desk.$eval('[data-veil]', el => getComputedStyle(el).display), 'none', 'The veil is gone');
  assert.equal(await desk.$eval('[data-sum]', root => root.dataset.webgl), 'true', 'The watch is drawn in WebGL');
  await pause(1600);
  // The headline is the time on the device, in words, and long times are broken where they fit.
  const hero = await desk.$$eval('[data-words="now"] [data-line]', lines => lines.filter(line => line.textContent).map(line => ({ text: line.textContent, wide: line.scrollWidth, room: line.parentElement.clientWidth })));
  assert.deepEqual(hero.map(line => line.text), ['It is', 'twenty-seven', 'minutes', 'past eleven.'], 'The time in words, set in lines');
  for (const line of hero) assert.ok(line.wide <= line.room + 1, `"${line.text}" fits its column (${line.wide} of ${line.room})`);
  assert.match(await desk.$eval('[data-words="now"] [data-fade]', el => el.textContent), /from 147 parts\. Right now it is telling you the time/, 'What it is');
  // The hands show that time: the hour hand between 11 and 12, the minute hand at 27 and a bit.
  const hands = await desk.$eval('[data-sum]', root => root.sumWatch.state.hands);
  const turn = angle => ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  assert.ok(Math.abs(turn(hands.minute) - (27.7 / 60) * Math.PI * 2) < 0.03, `The minute hand is at 27 minutes (${turn(hands.minute).toFixed(3)})`);
  assert.ok(Math.abs(turn(hands.hour) - ((11 + 27.7 / 60) / 12) * Math.PI * 2) < 0.02, 'The hour hand is between 11 and 12');
  // The picture is there: steel where the case is, the bracelet's steel above it, paper to the left.
  const links = await patch(desk, 0.655, 0.02, 0.02, 0.03), beside = await patch(desk, 0.5, 0.02, 0.02, 0.03);
  assert.ok(links.luma < beside.luma - 30 && links.luma > 95, `The bracelet runs off the top of the stage, in steel (${links.luma} beside paper at ${beside.luma})`);
  assert.ok((await patch(desk, 0.2, 0.9, 0.04, 0.04)).luma > 215, 'Paper on the words side');
  const second = await desk.$eval('[data-sum]', root => root.sumWatch.state.hands.second);
  await pause(1200);
  assert.notEqual(await desk.$eval('[data-sum]', root => root.sumWatch.state.hands.second), second, 'The seconds hand is running');
  roomy(await desk.evaluate(layout), 'desktop hero');
  // With a mouse the watch leans toward the pointer, a few degrees, and only where it lies whole and face up.
  const elevation = () => desk.$eval('[data-sum]', root => (root.sumWatch.state.camera.el * 180) / Math.PI);
  assert.ok(Math.abs((await elevation()) - 90) < 0.01, 'Seen from straight above until the pointer moves');
  await desk.mouse.move(1300, 200);
  await desk.mouse.move(1320, 180);
  await pause(1600);
  const leant = await elevation();
  assert.ok(leant < 89 && leant > 82, `The watch leans toward the pointer (${leant.toFixed(1)} degrees)`);
  roomy(await desk.evaluate(layout), 'desktop hero, leaning');
  await seek(desk, REST.dial, 900);
  assert.ok(Math.abs((await elevation()) - 68) < 12 && Math.abs((await desk.$eval('[data-sum]', root => root.sumWatch.state.camera.az)) + Math.PI / 2) < 0.01, 'The lean is gone once the page has moved on');
  await seek(desk, 0, 900);
  console.log('desktop entrance and time: ok');

  // Every rest: words and picture in their own room, and what the page says there.
  const said = {};
  for (const [name, at] of Object.entries(REST)) {
    await seek(desk, at, name === 'now' ? 900 : 750);
    const found = await desk.evaluate(layout);
    roomy(found, `desktop ${name}`);
    said[name] = { words: [...new Set(found.words.map(piece => piece.name))], equation: !!found.equation, labels: found.labels.length, photos: found.photos, parts: found.parts.map(part => part.name) };
  }
  assert.deepEqual(said.now.words, ['now']);
  assert.deepEqual(said.apart.words, ['apart']);
  assert.equal(said.apart.labels, 7, 'Seven names under the seven parts');
  assert.equal(said.apart.parts.length, 7, 'All seven parts are in the picture when it is apart');
  for (const id of ['crystal', 'hands', 'dial', 'case', 'rotor', 'caseback']) {
    assert.deepEqual(said[id].words, [`part-${id}`], `The ${id} has the stage`);
    assert.deepEqual(said[id].parts, [id], `Only the ${id} is in the picture at its stop`);
    assert.ok(said[id].equation, 'The sum is on the stage through the tour');
  }
  assert.deepEqual(said.calibre.parts, ['calibre']);
  assert.deepEqual(said.turned.parts, ['calibre'], 'The close-up is of the calibre alone');
  assert.deepEqual(said.whole.words, ['whole']);
  assert.deepEqual(said.back.words, ['back']);
  for (const name of ['silver', 'salmon', 'ink']) assert.deepEqual(said[name].words, ['faces']);
  for (const name of ['cuff', 'bench', 'rail']) assert.ok(said[name].photos, `A photograph covers the stage at ${name}`);
  assert.deepEqual(said.yours.words, ['yours']);
  console.log('desktop rests: ok');

  // The sum adds up, on the page.
  await seek(desk, REST.whole);
  const sum = await desk.$$eval('[data-ledger] [data-term]', terms => terms.map(term => ({ value: Number(term.lastChild.textContent), on: term.hasAttribute('data-on') })));
  assert.equal(sum.length, 8, 'Eight terms: seven parts and the bracelet');
  assert.equal(sum.reduce((total, term) => total + term.value, 0), 147, 'The terms add up to 147');
  assert.equal(described, 147, 'And the description in the head counts the same parts');
  assert.ok(sum.every(term => term.on), 'Every term is counted once the watch is whole');
  assert.equal(await desk.$eval('[data-total]', el => el.textContent), '147', 'The total reads 147');
  assert.match(await desk.$eval('[data-words="whole"] h2', el => el.textContent), /147 parts\.One Sum\./);
  await seek(desk, REST.calibre);
  assert.equal(await desk.$eval('[data-total]', el => el.textContent), '129', 'At the calibre the sum stands at 129');
  assert.deepEqual(await desk.$$eval('[data-ledger] [data-term]', terms => terms.map(term => term.hasAttribute('data-now'))), [false, false, false, false, true, false, false, false], 'The newest term is marked');
  // The hands stopped when the case was opened, and the page says when.
  await seek(desk, REST.hands);
  assert.match(await desk.$eval('[data-stopped]', el => el.textContent), /^11:2[78]:\d\d$/, 'The time the hands stopped at');
  console.log('the sum: ok');

  // ---------- The hands: drawn, three of them, apart at their own stop, and geared to the scroll ----------
  {
    // Blued steel and red lacquer are in the picture there, and next to nothing grey (a shadow with no dial to fall on would be).
    const drawn = await inks(desk, 0.5, 0.1, 0.5, 0.78);
    assert.ok(drawn.blue > 2000 && drawn.red > 500, `The hands are drawn at their stop: blued steel and red lacquer (${drawn.blue} and ${drawn.red} pixels)`);
    assert.ok(drawn.grey < 2500, `And nothing grey is with them but their tubes (${drawn.grey} pixels)`);
    const { blue, red } = drawn;
    const handsAt = async at => { await seek(desk, at, 900); return desk.$eval('[data-sum]', root => ({ ...root.sumWatch.state.hands })); };
    // They come into the picture as they sit on the watch, and are apart before the page rests on them.
    const coming = await handsAt(4.08), resting = await handsAt(REST.hands);
    assert.ok(coming.lift < 0.05 && coming.drop < 0.05, `The hands come into the picture one above the other (${coming.lift.toFixed(2)} and ${coming.drop.toFixed(2)} mm apart)`);
    assert.ok(resting.lift > 6.4 && resting.lift === (await handsAt(REST.hands - 0.05)).lift && resting.drop === resting.lift, `Where the page rests on them they stand apart along the axis, and have stopped (${resting.lift.toFixed(2)} and ${resting.drop.toFixed(2)} mm)`);
    const start = await handsAt(4.3), middle = await handsAt(4.55), end = await handsAt(4.8);
    assert.ok(start.lift > start.drop && start.drop > 1, `The seconds hand is lifted off first, the hour hand let down after it (${start.lift.toFixed(1)} and ${start.drop.toFixed(1)} mm as the tour arrives)`);
    assert.ok(Math.abs(middle.second - start.second - Math.PI) < 0.05, 'Half way through the stop the seconds hand is half way round');
    assert.ok(Math.abs(end.second - start.second - Math.PI * 2) < 0.02, 'By its end it has gone once round');
    assert.ok(Math.abs(end.minute - start.minute - (Math.PI * 2) / 60) < 0.004, `And the minute hand has moved on a minute, as it is geared to (${(end.minute - start.minute).toFixed(4)})`);
    assert.ok(Math.abs(end.hour - start.hour - (Math.PI * 2) / 720) < 0.002, 'The hour hand a twelfth of that');
    const together = await handsAt(REST.whole);
    assert.ok(together.lift === 0 && together.drop === 0, 'On the watch they are one above the other');
    assert.match(await desk.$eval('[data-words="part-hands"]', el => el.textContent), /the red one goes round once for you\. The minute hand moves on a minute\./, 'The page says what the scroll does to them');
    console.log(`the hands: ok (${blue} blue and ${red} red pixels at their stop)`);
  }

  // ---------- The bracelet: steel, two lengths, counted as six ----------
  {
    assert.equal(await desk.$eval('[data-ledger] [data-term="strap"]', term => term.textContent), 'Bracelet: 6', 'The last term of the sum is the bracelet');
    assert.match(await desk.$eval('[data-words="whole"]', el => el.textContent), /The bracelet makes six more\./, 'And the page says so');
    // Nothing a visitor reads or hears still says leather.
    const read = await desk.$eval('[data-sum]', root => [root.textContent, ...[...root.querySelectorAll('[alt], [aria-label], [title]')].map(el => ['alt', 'aria-label', 'title'].map(name => el.getAttribute(name) ?? '').join(' '))].join(' '));
    assert.doesNotMatch(read, /leather|strap|buckle/i, 'The watch is on a bracelet everywhere it is described');
    // Its two lengths are off the watch while it is apart, and on it where it is whole.
    const lengths = async at => { await seek(desk, at); return desk.$eval('[data-sum]', root => ['strapTop', 'strapBottom'].map(id => root.sumWatch.state.parts[id].visible)); };
    assert.deepEqual(await lengths(REST.apart), [false, false], 'The bracelet is off while the watch is apart');
    assert.deepEqual(await lengths(REST.whole), [true, true], 'And on again when it is whole');
    // Seen edge on, half way through the turn, its side is a row of steel links: bright, where a strap was black.
    await seek(desk, 14.45, 900);
    const flank = await patch(desk, 0.678, 0.02, 0.012, 0.05);
    assert.ok(flank.luma > 120, `The bracelet's side is steel (${flank.luma})`);
    console.log('the bracelet: ok');
  }

  // ---------- The crystal: on its own it is a disc of glass, not an empty ring ----------
  {
    await seek(desk, REST.crystal, 900);
    const read = await crystalRead(desk);
    glassy(read, 'desktop');
    // It is drawn that way only away from the watch: seated, it is what it always was.
    const apartness = async at => { await seek(desk, at); return desk.$eval('[data-sum]', root => { const { crystal, case: head } = root.sumWatch.state.parts; return Math.hypot(crystal.x - head.x, crystal.y - head.y, crystal.z - head.z); }); };
    assert.ok((await apartness(REST.crystal)) > 12, 'At its stop the crystal is well away from the watch');
    for (const name of ['now', 'whole', 'silver', 'salmon', 'ink', 'yours']) assert.equal(await apartness(REST[name]), 0, `At ${name} the crystal is in its seat`);
    console.log(`the crystal: ok (inside less backdrop, round its rim: ${read.said})`);
  }

  // ---------- The case: in at an angle, as the dial went out, and out straight on ----------
  {
    // How far it is turned about its own axis, and how high the camera stands over its face (90 is straight on).
    const caseAt = async at => { await seek(desk, at, 700); return desk.$eval('[data-sum]', root => { const { parts, camera } = root.sumWatch.state; return { turned: Math.abs(parts.case.rz) * 180 / Math.PI, el: camera.el * 180 / Math.PI }; }); };
    const arriving = await caseAt(6.6), resting = await caseAt(REST.case), leaving = await caseAt(7.3);
    const said = pose => `turned ${pose.turned.toFixed(0)}, seen from ${pose.el.toFixed(0)}`;
    assert.ok(arriving.turned > 30 && arriving.el < 30, `The case comes in turned, seen from low down (${said(arriving)})`);
    assert.ok(resting.turned < 0.5 && resting.el > 75, `It faces the visitor where the page rests on it (${said(resting)})`);
    assert.ok(leaving.turned < 0.5 && leaving.el >= resting.el, `And it is left straight on (${said(leaving)})`);
    console.log(`the case: ok (in ${said(arriving)}; at rest ${said(resting)}; out ${said(leaving)})`);
  }

  // The faces follow the scroll, both ways.
  const face = async () => desk.$eval('[data-sum]', root => root.sumWatch.state.dial.face);
  await seek(desk, REST.silver); assert.equal(await face(), 'dial-silver');
  await seek(desk, REST.salmon); assert.equal(await face(), 'dial-salmon');
  await seek(desk, REST.ink); assert.equal(await face(), 'dial-ink');
  await seek(desk, 16.65);
  const sweeping = await desk.$eval('[data-sum]', root => root.sumWatch.state.dial);
  assert.ok(sweeping.sweep > 0.5 && sweeping.sweep < 6 && sweeping.next === 'dial-salmon', 'Half way, the seconds hand is sweeping salmon in');
  await seek(desk, REST.silver); assert.equal(await face(), 'dial-silver', 'And back again');
  // The photographs: loaded, in slices, and what stands bare on the stage turns white over them.
  await seek(desk, REST.cuff, 1000);
  const photo = await desk.$eval('[data-photo="cuff"]', figure => ({ strips: figure.querySelectorAll('[data-strip]').length, loaded: [...figure.querySelectorAll('img')].every(img => img.complete && img.naturalWidth > 1000), caption: figure.querySelector('[data-caption]').textContent }));
  assert.equal(photo.strips, 9); assert.ok(photo.loaded, 'The photograph is loaded'); assert.match(photo.caption, /It is 9\.6 mm high\./);
  assert.equal(await desk.$eval('[data-sum]', root => getComputedStyle(root).getPropertyValue('--chrome').trim()), '#ffffff', 'White over the photographs');
  assert.ok((await patch(desk, 0.3, 0.3, 0.1, 0.1)).luma < 190, 'A photograph is on the stage');
  await seek(desk, REST.bench, 900);
  assert.equal(await desk.$eval('[data-photo="cuff"] [data-caption]', el => getComputedStyle(el).visibility), 'hidden', 'A covered photograph takes its caption with it');
  await seek(desk, REST.yours, 900);
  assert.equal(await desk.$eval('[data-photos]', el => getComputedStyle(el).visibility), 'hidden', 'The photographs are gone at the end');
  assert.notEqual(await desk.$eval('[data-sum]', root => getComputedStyle(root).getPropertyValue('--chrome').trim()), '#ffffff', 'And the chrome is ink again');
  console.log('faces and photographs: ok');

  // ---------- Pacing: how much the picture moves for a screen of scroll ----------
  {
    await seek(desk, 0, 400);
    const pace = await desk.evaluate(screens => {
      const root = document.querySelector('[data-sum]'), handle = root.sumWatch, canvas = root.querySelector('[data-watch]');
      const H = canvas.clientHeight, W = canvas.clientWidth;
      const ids = ['crystal', 'hands', 'dial', 'case', 'calibre', 'rotor', 'caseback'];
      // The middle of each part and two points off it (so a turn counts). The rotor's middle only: it swings by itself.
      const sample = at => { handle.pose(at); return ids.flatMap(id => (id === 'rotor' ? [[0, 0]] : [[0, 0], [12, 0], [0, 12]]).map(([x, y]) => { const p = handle.project(id, x, y, 0); return p.behind || p.x < 0 || p.x > W || p.y < 0 || p.y > H ? null : [p.x, p.y]; })); };
      const rates = [];
      let before = sample(0);
      for (let at = 0.02; at <= screens + 1e-6; at += 0.02) {
        const now = sample(at);
        let most = 0;
        for (let i = 0; i < now.length; i++) if (before[i] && now[i]) most = Math.max(most, Math.hypot(now[i][0] - before[i][0], now[i][1] - before[i][1]) / H);
        rates.push([Number(at.toFixed(2)), most / 0.02]);
        before = now;
      }
      return rates;
    }, SCREENS);
    const fastest = pace.reduce((a, b) => (b[1] > a[1] ? b : a));
    // Stage heights a point in the picture crosses for a screen of scroll. The hand-overs all peak near 6.
    assert.ok(fastest[1] < 8.5, `Nothing in the picture lurches: the fastest is ${fastest[1].toFixed(1)} at ${fastest[0]}`);
    for (const rest of RESTS) {
      const near = pace.filter(([at]) => Math.abs(at - rest) <= 0.04).map(([, rate]) => rate);
      if (near.length) assert.ok(Math.max(...near) < 0.9, `A rest is nearly still: ${rest} moves at ${Math.max(...near).toFixed(2)}`);
    }
    console.log(`pacing: ok (fastest ${fastest[1].toFixed(1)} stage heights a screen, at ${fastest[0]})`);
  }

  // ---------- Another way through: keys, the step buttons, the rail ----------
  await seek(desk, 0, 700);
  await desk.focus('[data-scroller]');
  await desk.keyboard.press('ArrowDown');
  await pause(2600);
  assert.ok(Math.abs((await place(desk)) - REST.apart) < 0.03, `Arrow down goes on to the next rest (${(await place(desk)).toFixed(2)})`);
  await desk.keyboard.press('ArrowDown');
  await pause(2200);
  assert.ok(Math.abs((await place(desk)) - REST.crystal) < 0.03, 'And on to the one after');
  await desk.keyboard.press('ArrowUp');
  await pause(2200);
  assert.ok(Math.abs((await place(desk)) - REST.apart) < 0.03, 'Arrow up goes back a rest');
  // A tap on a step button is one step; a hold plays until it is let go.
  const next = await desk.$('[data-step="1"]');
  const nextBox = await next.boundingBox();
  await desk.mouse.click(nextBox.x + nextBox.width / 2, nextBox.y + nextBox.height / 2);
  await pause(2200);
  assert.ok(Math.abs((await place(desk)) - REST.crystal) < 0.03, 'A tap on the button goes on a rest');
  await desk.mouse.move(nextBox.x + nextBox.width / 2, nextBox.y + nextBox.height / 2);
  await desk.mouse.down();
  await pause(2400);
  const held = await place(desk);
  await desk.mouse.up();
  assert.ok(held > REST.crystal + 0.5, `A hold plays on (${held.toFixed(2)})`);
  await pause(1500);
  const settled = await place(desk);
  await pause(600);
  assert.ok(Math.abs((await place(desk)) - settled) < 0.01, 'And stops when it is let go');
  // A wheel takes over from a step at once.
  await seek(desk, 0, 600);
  await desk.keyboard.press('ArrowDown');
  await pause(300);
  await desk.mouse.move(700, 450);
  await desk.mouse.wheel({ deltaY: -200 });
  await pause(1500);
  assert.ok((await place(desk)) < 0.6, 'A wheel takes the page back from a step');
  // The rail goes to a chapter's first rest.
  await desk.$$eval('[data-rail-item]', items => items[3].click());
  await pause(3200);
  assert.ok(Math.abs((await place(desk)) - REST.silver) < 0.03, `The rail goes to the faces (${(await place(desk)).toFixed(2)})`);
  assert.equal(await desk.$$eval('[data-rail-item]', items => items.findIndex(item => item.getAttribute('aria-current') === 'true')), 3, 'And marks the chapter');
  console.log('keys, step buttons and rail: ok');

  // ---------- Yours: a face is chosen, the bag says what this is ----------
  await seek(desk, REST.yours, 900);
  await desk.click('[data-pick="dial-salmon"]');
  await pause(1300);
  assert.equal(await face(), 'dial-salmon', 'The chosen face is swept in');
  assert.equal(await desk.$eval('[data-pick="dial-salmon"]', el => el.getAttribute('aria-pressed')), 'true');
  assert.equal(await desk.$eval('[data-bag-panel]', el => el.inert), true, 'The bag is out of reach while it is shut');
  await desk.click('[data-add]');
  await pause(1700);
  assert.equal(await desk.$eval('[data-sum]', root => root.dataset.bag), 'open', 'Adding opens the bag');
  assert.equal(await desk.$eval('[data-bag-count]', el => el.textContent), '1');
  assert.equal(await desk.$eval('[data-bag-face]', el => el.textContent), 'Salmon');
  // Sum stands on its own. With the bag open, everything the demo's own root says: what is read, what is heard
  // (labels, alternative text), where it links, and what the bag offers. (Not the whole document: the host's
  // layout puts the host's name in the head.)
  const says = await desk.$eval('[data-sum]', root => ({
    read: root.textContent,
    heard: [...root.querySelectorAll('[alt], [aria-label], [title]')].map(el => ['alt', 'aria-label', 'title'].map(name => el.getAttribute(name) ?? '').join(' ')).join(' '),
    links: [...root.querySelectorAll('a[href]')].map(link => link.getAttribute('href')),
    buttons: [...root.querySelectorAll('button')].map(button => button.textContent.trim()),
    bag: [...root.querySelectorAll('[data-bag-panel] button')].map(button => ({ says: button.textContent.trim() || button.getAttribute('aria-label'), shuts: button.hasAttribute('data-bag-close') })),
  }));
  assert.match(says.read, /Concept store/, 'The bar says it is a concept');
  assert.match(await desk.$eval('[data-bag-panel]', el => el.textContent), /Sum is a concept, so there is nothing to pay for\./, 'And so does the bag, where a shop takes money');
  assert.match(await desk.$eval('[data-bag-panel]', el => el.textContent), /Photographs generated for this demo\./, 'Which also says the photographs were generated');
  assert.doesNotMatch(`${says.read} ${says.heard}`, HOST, 'Nothing the demo says or labels names whoever hosts it');
  assert.deepEqual(says.links, [], 'It links nowhere: leaving it is the host\'s business');
  assert.ok(!says.buttons.some(text => /start a project/i.test(text)), 'No button sells anybody a project');
  assert.deepEqual(says.bag, [{ says: 'Close your bag', shuts: true }, { says: 'Keep looking', shuts: true }], 'The bag has two buttons, and each only shuts it');
  // Its one action carries on with the page, and goes nowhere.
  await desk.$$eval('[data-bag-panel] button', buttons => buttons.find(button => button.textContent.trim() === 'Keep looking').click());
  await pause(700);
  assert.equal(await desk.$eval('[data-sum]', root => root.dataset.bag), 'closed', 'Keep looking shuts the bag');
  assert.equal(await desk.evaluate(() => location.pathname + location.hash), '/gallery/gsap/sum', 'And leaves the visitor where they were');
  await desk.click('[data-bag-open]');
  await pause(900);
  assert.equal(await desk.$eval('[data-sum]', root => root.dataset.bag), 'open', 'The bar opens the bag again');
  await desk.keyboard.press('Escape');
  await pause(700);
  assert.equal(await desk.$eval('[data-sum]', root => root.dataset.bag), 'closed', 'Escape shuts the bag');
  assert.equal(new URL(desk.url()).pathname, '/gallery/gsap/sum', 'And only the bag');
  await desk.click('[data-replay]');
  await pause(4200);
  assert.ok((await place(desk)) < 0.05, 'Watch it again goes back to the start');
  // The page scrolled an element of its own, never the document.
  assert.equal(await desk.evaluate(() => window.__writes), 0, 'Nothing wrote to the document scroll');
  assert.equal(await desk.evaluate(() => window.scrollY), 0, 'The document did not scroll');
  // Leaving goes back to the site.
  await Promise.all([desk.waitForFunction(() => location.pathname === '/gallery/gsap', { timeout: 15000 }), desk.click('button[aria-label="Exit preview"]')]);
  console.log('the bag, and leaving: ok');
  await desk.close();

  // ---------- Window sizes: words and picture keep their rooms everywhere ----------
  if (!quick) await sweepWide(browser);

  // ---------- A phone: the picture above, the words below ----------
  const phone = await browser.newPage();
  watchPage(phone, 'phone');
  await phone.evaluateOnNewDocument(instrument);
  await phone.evaluateOnNewDocument(...clock(11, 27));
  await phone.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await enter(phone);
  await pause(1200);
  assert.equal(await phone.$eval('[data-sum]', root => root.dataset.shape), 'tall');
  const stageBefore = await phone.$eval('[data-sum]', root => ({ stage: root.style.getPropertyValue('--stage'), canvas: [root.querySelector('[data-watch]').width, root.querySelector('[data-watch]').height], words: root.querySelector('[data-words="now"]').getBoundingClientRect().top }));
  assert.equal(stageBefore.stage, '844px');
  for (const [name, at] of Object.entries(REST)) {
    await seek(phone, at, 750);
    roomy(await phone.evaluate(layout), `phone ${name}`);
    if (name === 'crystal') glassy(await crystalRead(phone), 'phone');
    if (name !== 'hands') continue;
    // The hands at their own stop, in a picture of their own: drawn, and with no shadow, for there is no dial under them.
    const drawn = await inks(phone, 0, 0.08, 1, 0.54);
    assert.ok(drawn.blue > 600 && drawn.red > 120, `The hands are drawn at their stop on a phone (${drawn.blue} blue and ${drawn.red} red pixels)`);
    assert.ok(drawn.grey < 900, `With nothing grey beside them (${drawn.grey} pixels)`);
  }
  // The hero's cue names the finger. And with no pointer to lean toward, the watch sways a little by itself.
  await seek(phone, 0, 900);
  const sway = [];
  for (let i = 0; i < 4; i++) { sway.push(await phone.$eval('[data-sum]', root => (root.sumWatch.state.camera.el * 180) / Math.PI)); await pause(700); }
  assert.ok(Math.max(...sway) - Math.min(...sway) > 0.05 && Math.min(...sway) > 85.5, `A slow sway on a phone (${sway.map(v => v.toFixed(2)).join(', ')})`);
  assert.match(await phone.$$eval('[data-cue]', cues => cues.filter(cue => getComputedStyle(cue).display !== 'none').map(cue => [...cue.children].filter(child => getComputedStyle(child).display !== 'none').map(child => child.textContent).join(' ')).join('|')), /^Swipe, or tap\s+to take it apart$/, 'One cue, for a finger');
  // A swipe scrolls the demo, not the document.
  const session = await phone.target().createCDPSession();
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 640 }] });
  for (let i = 1; i <= 10; i++) { await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 640 - i * 45 }] }); await pause(16); }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pause(1400);
  assert.ok((await place(phone)) > 0.3, 'A swipe scrolls the demo');
  assert.equal(await phone.evaluate(() => window.scrollY), 0, 'And not the document');
  // A tap on a step button goes on a rest.
  await seek(phone, 0, 700);
  const tap = await (await phone.$('[data-step="1"]')).boundingBox();
  assert.ok(tap.width >= 40 && tap.height >= 40, 'A step button is a finger wide');
  await phone.touchscreen.tap(tap.x + tap.width / 2, tap.y + tap.height / 2);
  await pause(3000);
  assert.ok(Math.abs((await place(phone)) - REST.apart) < 0.03, `A tap goes on to the next rest (${(await place(phone)).toFixed(2)})`);
  // A toolbar changing the window's height changes nothing on the stage.
  await seek(phone, REST.dial, 700);
  const dialBefore = await phone.$eval('[data-sum]', root => { const p = root.sumWatch.project('dial', 0, 0, 0); return { x: p.x, y: p.y, words: root.querySelector('[data-words="part-dial"]').getBoundingClientRect().top, canvas: [root.querySelector('[data-watch]').width, root.querySelector('[data-watch]').height] }; });
  await phone.setViewport({ width: 390, height: 758, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await pause(700);
  const dialAfter = await phone.$eval('[data-sum]', root => { const p = root.sumWatch.project('dial', 0, 0, 0); return { x: p.x, y: p.y, stage: root.style.getPropertyValue('--stage'), words: root.querySelector('[data-words="part-dial"]').getBoundingClientRect().top, canvas: [root.querySelector('[data-watch]').width, root.querySelector('[data-watch]').height] }; });
  assert.equal(dialAfter.stage, '844px', 'A moving toolbar does not resize the stage');
  assert.deepEqual(dialAfter.canvas, dialBefore.canvas, 'Nor redraw the picture at another size');
  assert.ok(Math.abs(dialAfter.x - dialBefore.x) < 0.5 && Math.abs(dialAfter.y - dialBefore.y) < 0.5 && Math.abs(dialAfter.words - dialBefore.words) < 0.5, 'Nor move anything on it');
  assert.equal(await phone.evaluate(() => window.__writes), 0, 'Nothing wrote to the document scroll on the phone');
  await phone.close();
  console.log('phone: ok');

  if (!quick) await sweepTall(browser);

  // ---------- Reduced motion ----------
  {
    const page = await browser.newPage();
    watchPage(page, 'reduced motion');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await page.goto(route, { waitUntil: 'networkidle2' });
    await page.waitForSelector('[data-sum][data-entered="true"]', { timeout: 30000 });
    await pause(400);
    const lines = await page.$$eval('[data-words="now"] [data-line]', all => all.filter(line => line.textContent).map(line => { const m = new DOMMatrixReadOnly(getComputedStyle(line).transform); return m.m42; }));
    assert.ok(lines.every(y => Math.abs(y) < 0.5), 'The headline is in place at once');
    await seek(page, REST.dial, 300);
    assert.ok(Math.abs((await place(page)) - REST.dial) < 0.01, 'The page still scrolls');
    assert.equal(await page.$eval('[data-words="part-dial"]', el => getComputedStyle(el).visibility), 'visible', 'And follows the scroll');
    await page.keyboard.press('ArrowDown');
    await pause(500);
    assert.ok(Math.abs((await place(page)) - REST.case) < 0.03, 'A step is a jump, not a glide');
    await page.close();
    console.log('reduced motion: ok');
  }

  // ---------- No WebGL: the watch is a photograph, and the page still reads ----------
  {
    const page = await browser.newPage();
    watchPage(page, 'no webgl');
    await page.evaluateOnNewDocument(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return /webgl/.test(type) ? null : original.call(this, type, ...rest); }; });
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await enter(page);
    assert.equal(await page.$eval('[data-sum]', root => root.dataset.webgl), 'false');
    const poster = await page.$eval('[data-poster]', img => ({ shown: getComputedStyle(img).visibility === 'visible' && getComputedStyle(img).opacity === '1', loaded: img.complete && img.naturalWidth > 0, box: img.getBoundingClientRect().toJSON() }));
    assert.ok(poster.shown && poster.loaded && poster.box.width > 200, 'The photograph stands in for the watch');
    await seek(page, REST.calibre, 500);
    assert.equal(await page.$eval('[data-words="part-calibre"]', el => getComputedStyle(el).visibility), 'visible', 'The words still follow the scroll');
    await seek(page, REST.yours, 500);
    await page.click('[data-add]');
    await pause(1700);
    assert.equal(await page.$eval('[data-sum]', root => root.dataset.bag), 'open', 'And the bag still opens');
    await page.close();
    console.log('no WebGL: ok');
  }

  // ---------- No JavaScript: nothing hides the page ----------
  {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await page.goto(route, { waitUntil: 'networkidle2' });
    assert.equal(await page.$eval('[data-veil]', el => getComputedStyle(el).display), 'none', 'No veil without JavaScript');
    assert.equal(await page.$eval('[data-poster]', el => getComputedStyle(el).visibility), 'visible', 'The photograph is shown');
    await page.close();
    console.log('no JavaScript: ok');
  }

  // ---------- A lost WebGL context comes back ----------
  {
    const page = await browser.newPage();
    watchPage(page, 'context loss');
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await enter(page);
    await pause(1200);
    // Steel that does not move with the time: the bracelet, at the top of the stage. (This used to be read at the
    // middle of the dial, off the cap. There are hands there now, and the seconds hand crossing them moved the
    // reading by 13 in two seconds: measured, after it failed once at 49 seconds past the minute.)
    const steel = () => patch(page, 0.66, 0.02, 0.02, 0.04);
    // The hands have a program and walls of their own to get back: how much blued steel is in the picture.
    // (1,200 to 2,400 pixels here through the day; none at all while the context is lost.)
    const blued = async () => (await inks(page, 0.5, 0.2, 0.4, 0.6)).blue;
    const before = await steel(), handsBefore = await blued();
    assert.ok(before.luma < 200 && handsBefore > 600, `The bracelet and the hands are in the picture (${before.luma}, ${handsBefore} blue pixels)`);
    await page.$eval('[data-watch]', canvas => { window.__lose = canvas.getContext('webgl2').getExtension('WEBGL_lose_context'); window.__lose.loseContext(); });
    await pause(500);
    await page.evaluate(() => window.__lose.restoreContext());
    await pause(1500);
    const after = await steel(), handsAfter = await blued();
    assert.ok(Math.abs(after.luma - before.luma) < 12, `The watch is drawn again after the context comes back (${before.luma} then ${after.luma})`);
    assert.ok(handsAfter > handsBefore * 0.7, `And so are its hands (${handsBefore} then ${handsAfter} blue pixels)`);
    await seek(page, REST.dial, 900);
    assert.ok((await patch(page, 0.66, 0.5, 0.05, 0.05)).luma < 232, 'And goes on being drawn');
    await page.close();
    console.log('context loss: ok');
  }

  // ---------- Older engines: the whole page, with attribute names validated the older way ----------
  for (const [label, viewport] of [['desktop', { width: 1280, height: 800, deviceScaleFactor: 1 }], ['phone', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    const page = await browser.newPage();
    watchPage(page, `older engine ${label}`);
    await page.evaluateOnNewDocument(older);
    await page.setViewport(viewport);
    await enter(page);
    for (let at = 0; at <= SCREENS; at += 0.35) await seek(page, at, 130);
    await seek(page, REST.yours, 600);
    await page.$eval('[data-pick="dial-ink"]', button => button.click());
    await page.$eval('[data-add]', button => button.click());
    await pause(1600);
    assert.deepEqual(await page.evaluate(() => window.__refused), [], `No call an older engine refuses (${label})`);
    await page.close();
  }
  console.log('older engines: ok');

  // ---------- A wheel all the way through: no long frames (a smoke check, not a device test) ----------
  {
    const page = await browser.newPage();
    watchPage(page, 'playback');
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await enter(page);
    await pause(800);
    await page.evaluate(() => { window.__frames = []; let last = performance.now(); const tick = now => { window.__frames.push(now - last); last = now; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    const cdp = await page.target().createCDPSession();
    for (let moved = 0; moved < (SCREENS + 0.5) * 900; moved += 60) { await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 450, deltaX: 0, deltaY: 60 }); await pause(12); }
    await pause(1200);
    const frames = (await page.evaluate(() => window.__frames)).slice(10);
    const long = frames.filter(ms => ms > 50).length;
    assert.ok((await place(page)) > SCREENS - 0.05, 'The wheel reaches the end');
    assert.ok(long <= 2, `No stalls while scrolling through (${long} frames over 50ms of ${frames.length})`);
    await page.close();
    console.log(`playback: ok (${frames.length} frames, ${long} over 50ms)`);
  }
} finally {
  await browser.close();
}

// ---------- WebKit ----------
const playwrightPath = process.argv[2];
if (playwrightPath) {
  const { webkit } = await import(pathToFileURL(playwrightPath).href);
  const wk = await webkit.launch();
  try {
    for (const [label, options] of [['desktop', { viewport: { width: 1280, height: 800 } }], ['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
      const context = await wk.newContext(options);
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(`webkit ${label}: ${error.message}`));
      page.on('console', message => { if (message.type() === 'error' && !/favicon|Failed to load resource/.test(message.text())) errors.push(`webkit ${label} console: ${message.text().slice(0, 200)}`); });
      await page.addInitScript(older);
      await page.goto(route, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-sum][data-entered="true"]', { timeout: 30000 });
      await pause(1500);
      assert.equal(await page.$eval('[data-sum]', root => root.dataset.webgl), 'true', `WebKit draws the watch (${label})`);
      assert.equal(await page.$eval('[data-sum]', root => root.dataset.shape), label === 'phone' ? 'tall' : 'wide');
      for (const [name, at] of Object.entries(REST)) {
        await page.evaluate(at => { const scroller = document.querySelector('[data-sum] [data-scroller]'); scroller.scrollTop = at * scroller.clientHeight; }, at);
        await pause(750);
        roomy(await page.evaluate(layout), `webkit ${label} ${name}`);
        // The crystal's glass is two programs of its own: WebKit has to draw them as well.
        if (name === 'crystal') glassy(await crystalRead(page, label === 'phone' ? 2 : 1), `webkit ${label}`);
      }
      // The picture is there: something darker than paper where the watch is.
      await page.evaluate(() => { const scroller = document.querySelector('[data-sum] [data-scroller]'); scroller.scrollTop = 0; });
      await pause(1200);
      const size = page.viewportSize(), capture = await page.screenshot({ type: 'png' });
      const tone = async (x, y, side) => (await sharp(capture).extract({ left: Math.round(x), top: y, width: side, height: side }).resize(1, 1).raw().toBuffer())[0];
      // The bracelet at the top of the picture, and the paper beside it.
      const [steel, paper] = label === 'phone' ? [await tone(size.width * 0.44 * 2, 4, 40), await tone(size.width * 0.22 * 2, 4, 40)] : [await tone(size.width * 0.655, 6, 24), await tone(size.width * 0.5, 6, 24)];
      assert.ok(steel < paper - 30 && steel > 95, `WebKit shows the bracelet (${label}: ${steel} beside paper at ${paper})`);
      assert.deepEqual(await page.evaluate(() => window.__refused), [], `No refused call in WebKit (${label})`);
      await context.close();
    }
    console.log('webkit: ok');
  } finally {
    await wk.close();
  }
} else console.log('webkit: skipped (pass a playwright-core path to run it)');

assert.deepEqual(errors, [], 'No runtime errors');
console.log('Sum: all checks passed');
