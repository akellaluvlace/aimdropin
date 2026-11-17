// Meridian, a concept for delivery tracking software (components/gsap/meridian), on /gallery/gsap/meridian. Checks: the route (indexed, its own share card, what it says first,
// readable without JavaScript); the entrance; that the page scrolls an element of its own and never the
// document; every scale the map stops at (how much ground is in the picture, that the map is drawn and
// names its places, that the stop the page follows is in the picture and clear of the console); the count
// at each scale and that the five states add up to it; that words keep inside their part of the console
// and nothing is half way at a rest, a name on the map included; the camera's pace all the way through;
// the search (empty where the page begins and ends, the parcel's number and its state between) and the
// cards that say what the software did, each at its own scale and clear of everything else on the map;
// the proof of delivery in both its forms, and that the door is never under it; arrow keys, step buttons
// and the rail; a phone, and its toolbar changing the window's height; a sweep of window sizes; reduced
// motion; no JavaScript; engines that validate attribute names the older way; a wheel run with no long
// frames; and, with a playwright-core path, WebKit.
// Run against a production build; BASE_URL defaults to port 3001.
// Optional argument: path to playwright-core/index.mjs for the WebKit pass. QUICK=1 skips the size
// sweeps; SWEEPS=1 (or wide, or tall) runs only them.
// This is not a physical-device smoothness test.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

const base = (process.env.BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const route = `${base}/gallery/gsap/meridian`;
const executablePath = process.env.CHROME_PATH || { darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }[process.platform];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const errors = [];
const GPU = ['--enable-gpu', '--ignore-gpu-blocklist', ...(process.platform === 'darwin' ? ['--use-angle=metal'] : [])];
const quick = process.env.QUICK === '1';

// The score and the facts, as the page has them (score.ts, content.ts, camera.ts). Kept here in figures on
// purpose: a change there has to be made here too, and so gets looked at.
const SCREENS = 16.4;
const REST = { planet: 0, lane: 3.1, crossing: 5.1, city: 7.1, run: 9.3, street: 11.3, door: 12.9, all: 15.9 };
const COUNT = { planet: 41207, lane: 9312, crossing: 1204, city: 318, run: 86, street: 1, door: 1, all: 41207 };
const ACROSS = { planet: 14_816_300, lane: 3_500_000, crossing: 600_000, city: 23_000, run: 6_400, street: 640, door: 170, all: 14_816_300 };
const MINE = { planet: 3, lane: 3, crossing: 3, city: 3, run: 3, street: 3, door: 4, all: 4 };
// The search: empty where the page begins and ends, the parcel's number and its state between.
const PARCEL = 'MRD 4471 0926 41';
const FOUND = { lane: 'Out for delivery, 14:02', crossing: 'Out for delivery, 14:02', city: 'Out for delivery, 14:02', run: 'Out for delivery, 14:02', street: 'Out for delivery, 14:02', door: 'Delivered, 14:02' };
// What the software does by itself: a card at these scales, and at no other.
const UPDATE = { city: /between 13:30 and 14:30/, run: /A quay is closed/, street: /4 minutes away/ };
// A place the map names at each scale (content.ts, PLACES), where it has one in the picture.
const NAMED = { planet: 'Shenzhen', lane: 'Rotterdam', crossing: 'Dublin', city: 'Dublin', run: 'Smithfield', street: 'Smithfield', all: 'Shenzhen' };

const instrument = () => {
  window.__writes = 0;
  const count = original => function (...args) { window.__writes++; return original.apply(this, args); };
  window.scrollTo = count(window.scrollTo);
  window.scroll = count(window.scroll);
  window.scrollBy = count(window.scrollBy);
};
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
  page.on('pageerror', error => errors.push(`${label}: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error' && !/favicon|Failed to load resource/.test(message.text())) errors.push(`${label} console: ${message.text().slice(0, 200)}`); });
};
const enter = async (page, url = route) => {
  await page.goto(url, { waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-meridian][data-entered="true"]', { timeout: 30000 });
  await pause(500);
};
const seek = async (page, at, wait = 700) => {
  await page.evaluate(at => { const scroller = document.querySelector('[data-meridian] [data-scroller]'); scroller.scrollTop = at * scroller.clientHeight; }, at);
  await pause(wait);
};
const place = page => page.evaluate(() => { const scroller = document.querySelector('[data-meridian] [data-scroller]'); return scroller.scrollTop / scroller.clientHeight; });
const patch = async (page, x, y, w = 0.04, h = 0.04) => {
  const viewport = page.viewport();
  const scale = viewport.deviceScaleFactor || 1;
  const { data } = await sharp(await page.screenshot({ type: 'png' })).extract({ left: Math.round(x * viewport.width * scale), top: Math.round(y * viewport.height * scale), width: Math.max(1, Math.round(w * viewport.width * scale)), height: Math.max(1, Math.round(h * viewport.height * scale)) }).resize(1, 1).raw().toBuffer({ resolveWithObject: true });
  return { r: data[0], g: data[1], b: data[2] };
};

/** What is on the stage right now, read in the page: the console, its words, the map's furniture, the camera. */
const layout = () => {
  const root = document.querySelector('[data-meridian]');
  const box = element => { if (!element) return null; const style = getComputedStyle(element); if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.5) return null; const r = element.getBoundingClientRect(); return r.width && r.height ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null; };
  const seen = element => { for (let node = element; node && node !== root; node = node.parentElement) { const style = getComputedStyle(node); if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.5) return false; } return true; };
  const textBox = element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const rects = [...range.getClientRects()].filter(rect => rect.width > 0.5 && rect.height > 0.5);
    if (!rects.length) return null;
    let found = { left: Math.min(...rects.map(r => r.left)), right: Math.max(...rects.map(r => r.right)), top: Math.min(...rects.map(r => r.top)), bottom: Math.max(...rects.map(r => r.bottom)) };
    const mask = element.hasAttribute('data-line') ? element.parentElement : null;
    if (mask) { const m = mask.getBoundingClientRect(); found = { left: Math.max(found.left, m.left), right: Math.min(found.right, m.right), top: Math.max(found.top, m.top), bottom: Math.min(found.bottom, m.bottom) }; if (found.bottom - found.top < 2) return null; }
    return found;
  };
  const words = [], fading = [];
  const opacityOf = element => { let value = 1; for (let node = element; node && node !== root; node = node.parentElement) value *= Number(getComputedStyle(node).opacity); return value; };
  for (const block of root.querySelectorAll('[data-words]')) {
    if (getComputedStyle(block).visibility === 'hidden') continue;
    for (const piece of block.querySelectorAll('[data-fade]')) { const o = opacityOf(piece); if (o > 0.03 && o < 0.97) fading.push(`${block.dataset.words}: "${piece.textContent.slice(0, 24)}" at ${o.toFixed(2)}`); }
    for (const line of block.querySelectorAll('[data-line]')) { const shift = Math.abs(new DOMMatrixReadOnly(getComputedStyle(line).transform).m42), height = line.offsetHeight || 1; if (shift > 1 && shift < height * 1.05) fading.push(`${block.dataset.words}: line "${line.textContent.slice(0, 24)}" ${Math.round(shift)}px off`); }
    for (const piece of [...block.querySelectorAll('[data-line], [data-fade]')].filter(seen)) { const found = textBox(piece); if (found) words.push({ name: block.dataset.words, ...found }); }
  }
  const stage = root.getBoundingClientRect(), canvas = root.querySelector('[data-map]').getBoundingClientRect(), waybill = root.querySelector('[data-waybill]').getBoundingClientRect();
  // The part of the console the words have: from its top down to whatever is shown under them.
  const told = root.querySelector('[class*="told"]').getBoundingClientRect();
  const handle = root.meridianMap, view = handle?.view();
  const states = [...root.querySelectorAll('[data-state]')].map(row => ({ value: Number(row.querySelector('[data-state-count]').textContent.replace(/,/g, '')), mine: row.hasAttribute('data-mine'), share: Number(row.querySelector('[data-state-bar]').style.getPropertyValue('--share')) }));
  // The proof of delivery: a card on the map of a wide stage, part of what the console says on a tall one.
  const proof = root.querySelector(root.dataset.shape === 'tall' ? '[data-receipt]' : '[data-proof]');
  // The search: what is typed in it, whether its hint shows, and the pill that says what was found.
  const searchEl = root.querySelector('[data-search]'), pill = root.querySelector('[data-pill]'), hint = searchEl.querySelector('[class*="hint"]');
  const search = { box: box(searchEl), typed: root.querySelector('[data-typed]').textContent, hint: getComputedStyle(hint).display !== 'none', found: Number(getComputedStyle(pill).opacity), pill: pill.textContent, pillBox: box(pill), done: pill.hasAttribute('data-done') };
  // What the software does by itself: the cards, how much of each is to be seen, and where.
  const updates = [...root.querySelectorAll('[data-update]')].map(card => { const style = getComputedStyle(card), r = card.getBoundingClientRect(); return { level: card.dataset.update, text: card.textContent, opacity: style.visibility === 'hidden' ? 0 : Number(style.opacity), shift: Math.abs(new DOMMatrixReadOnly(style.transform).m42), box: { left: r.left, right: r.right, top: r.top, bottom: r.bottom } }; });
  const legend = box(root.querySelector('[data-legend]')), credit = box(root.querySelector('[class*="credit"]'));
  return {
    shape: root.dataset.shape, words, fading, search, updates, legend, credit,
    stage: { left: stage.left, right: stage.right, top: stage.top, bottom: stage.bottom }, canvas: { left: canvas.left, right: canvas.right, top: canvas.top, bottom: canvas.bottom },
    waybill: { left: waybill.left, right: waybill.right, top: waybill.top, bottom: waybill.bottom }, told: { left: told.left, right: told.right, top: told.top, bottom: told.bottom },
    count: root.querySelector('[data-count]').textContent, countBox: box(root.querySelector('[data-count]')), states, statesBox: box(root.querySelector('[data-states]')),
    scale: root.querySelector('[data-scale]').textContent, centre: root.querySelector('[data-centre]').textContent, bar: root.querySelector('[data-scalebar-text]').textContent, barBox: box(root.querySelector('[data-scalebar]')),
    rail: box(root.querySelector('[data-rail]')), pager: box(root.querySelector('[data-pager]')), tools: box(root.querySelector('[data-tools]')), cue: box(root.querySelector('[data-cue]')),
    proof: box(proof), proofLoaded: proof ? [...proof.querySelectorAll('img')].every(img => img.complete && img.naturalWidth > 0) : false, note: box(root.querySelector('[data-note] span')),
    across: view?.across ?? 0, centreAt: view ? [view.lon, view.lat] : null, points: handle?.points() ?? 0, names: handle ? [...handle.names()] : [], fadingNames: handle ? [...handle.fading()] : [], room: handle ? { ...handle.room } : null,
    // Where the stop the page follows is on the map's canvas, and the middle of the building it delivers to.
    stop: handle?.stop() ?? null, building: handle?.building() ?? null,
  };
};
const overlap = (a, b, gap = 0) => a && b && a.left < b.right + gap && b.left < a.right + gap && a.top < b.bottom + gap && b.top < a.bottom + gap;
const fmt = box => (box ? `[${Math.round(box.left)},${Math.round(box.top)} ${Math.round(box.right)},${Math.round(box.bottom)}]` : 'none');
/** Map and words each in their own room, and nothing over anything else. */
const roomy = (found, label) => {
  assert.deepEqual(found.fading, [], `${label}: nothing is half way at a rest`);
  assert.deepEqual(found.fadingNames, [], `${label}: no name on the map is half way at a rest`);
  for (const piece of [...found.words, ...(found.countBox ? [{ name: 'count', ...found.countBox }] : [])]) {
    assert.ok(piece.left >= found.waybill.left + 2 && piece.right <= found.waybill.right - 2, `${label}: ${piece.name} ${fmt(piece)} keeps inside the console ${fmt(found.waybill)} across`);
    assert.ok(piece.top >= found.told.top - 1 && piece.bottom <= found.told.bottom + 1, `${label}: ${piece.name} ${fmt(piece)} keeps to the words' part of the console ${fmt(found.told)}`);
    for (const other of [found.statesBox, found.rail, found.pager, found.tools, found.cue]) assert.ok(!overlap(piece, other, 1), `${label}: ${piece.name} ${fmt(piece)} clear of ${fmt(other)}`);
  }
  if (found.shape === 'tall') assert.ok(found.waybill.top >= found.canvas.bottom - 1, `${label}: the console stands under the map`);
  if (found.shape === 'tall' && found.proof) assert.ok(found.proof.top >= found.told.top && found.proof.bottom <= found.told.bottom + 1 && found.proof.left >= found.waybill.left && found.proof.right <= found.waybill.right, `${label}: the proof of delivery ${fmt(found.proof)} is in the words' part of the console ${fmt(found.told)}`);
  for (const thing of [found.barBox, found.shape === 'wide' ? found.proof : null, found.note]) {
    if (!thing) continue;
    assert.ok(!overlap(thing, found.waybill, 0), `${label}: ${fmt(thing)} is on the map, not over the console ${fmt(found.waybill)}`);
    assert.ok(thing.left >= found.stage.left && thing.right <= found.stage.right + 1 && thing.top >= found.stage.top, `${label}: ${fmt(thing)} is on the stage`);
  }
  assert.ok(!overlap(found.proof, found.tools, 2) && !overlap(found.proof, found.pager, 2), `${label}: the proof ${fmt(found.proof)} is clear of the buttons`);
  // A card that says what the software did is on the map, in a corner of its own: over nothing else that is
  // laid there, and not over the parcel's own tag.
  for (const card of found.updates.filter(candidate => candidate.opacity > 0.5)) {
    assert.ok(card.box.left >= found.canvas.left && card.box.right <= found.canvas.right && card.box.top >= found.canvas.top && card.box.bottom <= found.canvas.bottom, `${label}: the card ${fmt(card.box)} is on the map ${fmt(found.canvas)}`);
    for (const [what, other] of [['the console', found.shape === 'wide' ? found.waybill : null], ['the tools', found.tools], ['the step buttons', found.pager], ['the proof of delivery', found.shape === 'wide' ? found.proof : null], ['the key', found.legend], ['the scale bar', found.barBox], ["the parcel's tag", found.note]]) assert.ok(!overlap(card.box, other, 2), `${label}: the card ${fmt(card.box)} is clear of ${what} ${fmt(other)}`);
  }
  // The parcel's tag is on the map and clear of what else is laid there.
  if (found.note) for (const [what, other] of [['the scale bar', found.barBox], ['the credit', found.credit], ['the key', found.legend], ['the tools', found.tools], ['the step buttons', found.pager]]) assert.ok(!overlap(found.note, other, 1), `${label}: the parcel's tag ${fmt(found.note)} is clear of ${what} ${fmt(other)}`);
  // The search and what it found keep inside the console.
  if (found.search.pillBox) assert.ok(found.search.pillBox.right <= found.waybill.right - 2 && found.search.pillBox.left >= found.waybill.left + 2, `${label}: the search's pill ${fmt(found.search.pillBox)} keeps inside the console`);
  // The door (the stop, and the middle of the building) is shown beside the proof of delivery, never under
  // it, and in the map's own room.
  if (found.proof) for (const [what, spot] of [['stop', found.stop], ['building', found.building]]) {
    assert.ok(spot, `${label}: the page knows where the ${what} is`);
    const x = found.canvas.left + spot.x, y = found.canvas.top + spot.y;
    assert.ok(x < found.proof.left - 8 || x > found.proof.right + 8 || y < found.proof.top - 8 || y > found.proof.bottom + 8, `${label}: the ${what} (${Math.round(x)}, ${Math.round(y)}) is beside the proof of delivery ${fmt(found.proof)}, not under it`);
    assert.ok(x > found.canvas.left + 16 && x < found.canvas.right - 16 && y > found.canvas.top + 16 && y < found.canvas.bottom - 16 && !(found.shape === 'wide' && x < found.waybill.right + 16), `${label}: the ${what} (${Math.round(x)}, ${Math.round(y)}) is in the picture`);
  }
  assert.ok(!overlap(found.rail, found.pager, 2), `${label}: the rail ${fmt(found.rail)} is clear of the step buttons ${fmt(found.pager)}`);
};
/** What is true of the page at a scale: the ground in the picture, the count, the states. */
const facts = (found, name, label) => {
  assert.ok(Math.abs(found.across / ACROSS[name] - 1) < 0.01, `${label}: ${Math.round(found.across)} m across the picture (${ACROSS[name]} wanted)`);
  assert.equal(found.count, COUNT[name].toLocaleString('en-IE'), `${label}: the count`);
  assert.equal(found.states.reduce((sum, state) => sum + state.value, 0), COUNT[name], `${label}: the five states add up to the count`);
  assert.ok(Math.abs(found.states.reduce((sum, state) => sum + state.share, 0) - 1) < 0.001, `${label}: the bars add up to the whole`);
  assert.equal(found.states.findIndex(state => state.mine), MINE[name], `${label}: the state this parcel is in`);
  assert.deepEqual([...new Set(found.words.map(piece => piece.name))], [name], `${label}: the words of this scale and no other`);
  assert.match(found.scale, /^1 : [\d,]+$/, `${label}: the scale reads as a map's does`);
  assert.ok(found.points > 800, `${label}: the map is drawn (${found.points} points)`);
  if (NAMED[name]) assert.ok(found.names.includes(NAMED[name]), `${label}: the map names ${NAMED[name]} (it names ${found.names.join(', ') || 'nothing'})`);
  // The search: empty with its hint where the page begins and ends, the parcel's number and its state between.
  if (found.search.box) {
    if (FOUND[name]) {
      assert.equal(found.search.typed, PARCEL, `${label}: the parcel's number is in the search`);
      assert.ok(!found.search.hint && found.search.found > 0.99, `${label}: and the search says what it found`);
      // The time beside the state is left out where the field is narrow.
      assert.ok(found.search.pill === FOUND[name] && found.search.done === (name === 'door'), `${label}: the parcel's state (${found.search.pill})`);
    } else assert.ok(found.search.typed === '' && found.search.hint && found.search.found < 0.01, `${label}: the search is empty, with its hint`);
  }
  // What the software does by itself: its card at this scale and no other, whole.
  const up = found.updates.filter(card => card.opacity > 0.01);
  if (UPDATE[name]) {
    assert.deepEqual(up.map(card => card.level), [name], `${label}: one card, this scale's`);
    assert.ok(up[0].opacity > 0.99 && up[0].shift < 0.5 && UPDATE[name].test(up[0].text), `${label}: and it is whole (${up[0].opacity}, ${up[0].shift}px off)`);
  } else assert.deepEqual(up.map(card => card.level), [], `${label}: no card here`);
};

/** The most the picture may travel for a screen of scroll, in its shorter sides (the way back out is the fastest part). */
const PACE_LIMIT = 6;
const KEY = ['planet', 'lane', 'city', 'run', 'street', 'door', 'all'];
const findings = [];
const sweepCheck = (found, label) => { try { roomy(found, label); } catch (error) { findings.push(error.message); } };
async function sweepWide(browser) {
  const page = await browser.newPage();
  watchPage(page, 'sweep');
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await enter(page);
  const sizes = [];
  for (let height = 420; height <= 1120; height += 20) sizes.push([1440, height]);
  for (let width = 960; width <= 2000; width += 80) sizes.push([width, 800]);
  sizes.push([844, 390], [932, 430], [1024, 768], [1180, 820], [1920, 1080], [2560, 1440], [1100, 1000]);
  for (const [width, height] of sizes) {
    if (width / height < 1.05) continue;
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await pause(350);
    for (const name of KEY) { await seek(page, REST[name], name === 'planet' ? 1300 : 560); sweepCheck(await page.evaluate(layout), `${width}x${height} ${name}`); }
  }
  await page.close();
  assert.deepEqual(findings.splice(0), [], 'wide stages: map and words keep their rooms at every size');
  console.log(`wide stages: ok (${sizes.length} window sizes)`);
}
async function sweepTall(browser) {
  const sizes = [[320, 568], [360, 640], [375, 667], [430, 932], [768, 1024], [820, 1180]];
  for (let height = 560; height <= 940; height += 20) sizes.push([390, height]);
  for (const [width, height] of sizes) {
    const page = await browser.newPage();
    watchPage(page, `${width}x${height}`);
    await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await enter(page);
    await pause(600);
    for (const name of KEY) { await seek(page, REST[name], name === 'planet' ? 700 : 560); sweepCheck(await page.evaluate(layout), `${width}x${height} ${name}`); }
    await page.close();
  }
  assert.deepEqual(findings.splice(0), [], 'tall stages: map and words keep their rooms at every size');
  console.log(`tall stages: ok (${sizes.length} window sizes)`);
}

const browser = await puppeteer.launch({ executablePath, headless: true, args: GPU });
try {
  if (process.env.SWEEPS) {
    const found = [];
    for (const sweep of process.env.SWEEPS === 'tall' ? [sweepTall] : process.env.SWEEPS === 'wide' ? [sweepWide] : [sweepWide, sweepTall]) { try { await sweep(browser); } catch (error) { found.push(...(Array.isArray(error.actual) ? error.actual : [error.message])); } }
    if (found.length) { console.log(found.join('\n')); throw new Error(`${found.length} findings in the window-size sweeps`); }
    console.log('Meridian: sweeps passed');
    process.exit(0);
  }

  // ---------- The route ----------
  {
    const response = await fetch(route);
    assert.equal(response.status, 200, 'The route answers');
    const html = (await response.text()).replace(/<!-- -->/g, '');
    assert.doesNotMatch(html, /<meta name="robots" content="noindex/, 'It may be found by search engines here');
    assert.match(html, /<title>Meridian, a concept for delivery tracking<\/title>/, 'Its own title, with nobody else\'s name on it');
    assert.match(html, /property="og:image" content="[^"]*\/thumbs\/gsap\/meridian\.webp/, 'A share card of its own: a screen from the site');
    assert.match(html, /<link rel="canonical" href="[^"]*\/gallery\/gsap\/meridian"/, 'It names its own address');
    assert.match(html, /parcels are on their way\./, 'The headline is in the HTML');
    assert.match(html, /Someone has just asked where theirs is\. Meridian is how a carrier answers: every parcel on one map, down to the door\. Scroll to look it up\./, 'It begins with its premise, and says what it is');
    assert.match(html, /Delivery tracking for carriers\. A concept\./, 'And names what kind of thing it is while it loads');
    assert.match(html, /Search 41,207 parcels/, 'The search it begins with is in the HTML');
    assert.match(html, /Van 12 is 4 minutes away\./, 'And what the software tells the customer');
    assert.match(html, /Meridian is a concept: there is no such product, and no such parcel\./, 'It says it is a concept');
    assert.match(html, /Book a demo/, 'And ends on a call to action of its own');
    assert.match(html, /OpenStreetMap contributors/, 'The map data is credited');
    assert.doesNotMatch(html.replace(/<script[\s\S]*?<\/script>/g, ''), /[\u2013\u2014]/, 'No en or em dashes in its copy');
    console.log('route: ok');
  }

  // ---------- Desktop ----------
  const desk = await browser.newPage();
  watchPage(desk, 'desktop');
  await desk.evaluateOnNewDocument(instrument);
  await desk.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await desk.goto(route, { waitUntil: 'domcontentloaded' });
  assert.equal(await desk.$eval('[data-meridian]', root => root.dataset.entered), 'false', 'Not entered while loading');
  await desk.waitForSelector('[data-meridian][data-entered="true"]', { timeout: 30000 });
  assert.equal(await desk.$eval('[data-load-count]', el => el.textContent), '41,207', 'The loader counted every parcel in');
  // It is made for a library of pages people can use: nothing in it names or sells whoever made it. (Only
  // the demo's own element is read: the site it is looked at on puts its own name in the document's head.)
  {
    const said = await desk.$eval('[data-meridian]', root => `${root.textContent} ${[...root.querySelectorAll('[aria-label], [alt], [title]')].map(el => `${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('alt') ?? ''} ${el.getAttribute('title') ?? ''}`).join(' ')}`);
    assert.doesNotMatch(said, /akella|inmotion|start a project/i, 'Nothing in the demo names or sells a studio');
    assert.equal(await desk.$$eval('[data-meridian] a[href]', links => links.length), 0, 'And nothing in it links out');
  }
  assert.equal(await desk.$eval('[data-veil]', el => getComputedStyle(el).display), 'none', 'The veil is gone');
  await pause(900);
  // The picture: sea and land of the earth to the right of the console, and the console's own paper.
  const sea = await patch(desk, 0.5, 0.82, 0.02, 0.02), paper = await patch(desk, 0.1, 0.5, 0.03, 0.03);
  assert.ok(sea.b > sea.r + 8 && sea.r > 180, `The sea is the chart's pale tint (${sea.r}, ${sea.g}, ${sea.b})`);
  assert.ok(paper.r > 250 && paper.g > 250, 'The console is paper');
  const said = {};
  for (const [name, at] of Object.entries(REST)) {
    await seek(desk, at, name === 'planet' ? 900 : 800);
    const found = await desk.evaluate(layout);
    roomy(found, `desktop ${name}`);
    facts(found, name, `desktop ${name}`);
    said[name] = found;
  }
  // The map closes in, scale by scale, and the scale bar with it.
  const fractions = Object.keys(REST).slice(0, 7).map(name => Number(said[name].scale.replace(/[^\d]/g, '')));
  for (let i = 1; i < fractions.length; i++) assert.ok(fractions[i] < fractions[i - 1], `The scale grows from one stop to the next (1 : ${fractions[i - 1]} then 1 : ${fractions[i]})`);
  assert.match(said.planet.bar, /km$/); assert.match(said.door.bar, /^\d+ m$/, 'At the door the scale bar is in metres');
  // From the city on, the stop the page follows is in the picture, and right of the console.
  for (const name of ['city', 'run', 'street', 'door']) {
    const { stop, room, canvas } = said[name];
    assert.ok(stop && stop.x > room.left + 20 && stop.x < canvas.right - canvas.left - 20 && stop.y > 20 && stop.y < canvas.bottom - canvas.top - 20, `desktop ${name}: the stop is in the picture, clear of the console (${Math.round(stop.x)}, ${Math.round(stop.y)}; the map's room starts at ${Math.round(room.left)})`);
  }
  assert.ok(Math.abs(said.street.centreAt[0] + 6.278) < 0.002 && Math.abs(said.street.centreAt[1] - 53.3486) < 0.002, 'At the street the camera is on Smithfield');
  // The door is in the middle of what the proof of delivery leaves free: between the console and the card.
  {
    const { stop, building, proof, waybill, canvas } = said.door, middle = (waybill.right + proof.left) / 2, seen = canvas.left + (stop.x + building.x) / 2;
    assert.ok(Math.abs(seen - middle) < 24, `At the door the camera looks between the console and the proof of delivery (${Math.round(seen)} against ${Math.round(middle)})`);
  }
  // The proof of delivery: at the door only, with its photograph, signed.
  assert.ok(said.door.proof && said.door.proofLoaded, 'The proof of delivery is up at the door, with its photograph');
  assert.ok(!said.street.proof && !said.all.proof, 'And only there');
  await seek(desk, REST.door, 800);
  assert.ok(Math.abs(await desk.$eval('[data-signature]', path => Number(getComputedStyle(path).strokeDashoffset.replace('px', '')))) < 1, 'The signature is written');
  assert.equal(await desk.$eval('[data-meridian]', root => root.dataset.last), 'false');
  await seek(desk, REST.all, 900);
  assert.equal(await desk.$eval('[data-meridian]', root => root.dataset.last), 'true');
  // Pacing: how far the picture travels for a screen of scroll, all the way through. For a point at the
  // picture's edge that is half the change in the logarithm of the scale, and how far the centre moved
  // against the ground in the picture; in the picture's shorter sides. No move is to be much faster than
  // the rest, and where the page rests the camera is still.
  const pace = await desk.evaluate(screens => {
    const handle = document.querySelector('[data-meridian]').meridianMap, EARTH = 6371008.8, rad = Math.PI / 180, step = 0.02, out = [];
    let before = handle.camera(0);
    for (let at = step; at <= screens + 1e-9; at += step) {
      const now = handle.camera(at);
      const zoom = Math.abs(Math.log(now.across / before.across)) / 2;
      const a = Math.sin(((now.lat - before.lat) * rad) / 2) ** 2 + Math.cos(now.lat * rad) * Math.cos(before.lat * rad) * Math.sin(((now.lon - before.lon) * rad) / 2) ** 2;
      const moved = (2 * EARTH * Math.asin(Math.min(1, Math.sqrt(a)))) / Math.min(now.across, before.across);
      out.push({ at: Number(at.toFixed(2)), travel: (zoom + moved) / step });
      before = now;
    }
    return out;
  }, SCREENS);
  const fastest = pace.reduce((most, sample) => (sample.travel > most.travel ? sample : most));
  assert.ok(fastest.travel <= PACE_LIMIT, `No part of the camera's move is rushed: ${fastest.travel.toFixed(2)} shorter sides for a screen of scroll at ${fastest.at} (limit ${PACE_LIMIT})`);
  for (const [name, at] of Object.entries(REST)) {
    const near = pace.filter(sample => Math.abs(sample.at - at) <= 0.1).reduce((most, sample) => Math.max(most, sample.travel), 0);
    assert.ok(near < 0.05, `The camera is still where the page rests at ${name} (${near.toFixed(3)})`);
  }
  console.log(`pacing: ok (fastest ${fastest.travel.toFixed(2)} shorter sides for a screen of scroll, at ${fastest.at})`);
  console.log('desktop scales, counts and proof: ok');

  // Keys, the step buttons, the rail.
  await seek(desk, 0, 700);
  await desk.focus('[data-scroller]');
  // A step travels at reading pace, about a screen a second: three screens take a while.
  await desk.keyboard.press('ArrowDown');
  await pause(4600);
  assert.ok(Math.abs((await place(desk)) - REST.lane) < 0.03, `Arrow down goes on to the next scale (${(await place(desk)).toFixed(2)})`);
  await desk.keyboard.press('ArrowUp');
  await pause(4600);
  assert.ok((await place(desk)) < 0.03, 'Arrow up goes back');
  const next = await (await desk.$('[data-step="1"]')).boundingBox();
  await desk.mouse.click(next.x + next.width / 2, next.y + next.height / 2);
  await pause(4600);
  assert.ok(Math.abs((await place(desk)) - REST.lane) < 0.03, 'A tap on the button goes on a scale');
  await desk.mouse.move(next.x + next.width / 2, next.y + next.height / 2);
  await desk.mouse.down();
  await pause(2200);
  const held = await place(desk);
  await desk.mouse.up();
  assert.ok(held > REST.lane + 0.5, `A hold plays on (${held.toFixed(2)})`);
  await pause(1400);
  await desk.$$eval('[data-rail-item]', items => items[4].click());
  await pause(3400);
  assert.ok(Math.abs((await place(desk)) - REST.run) < 0.03, `The rail goes to a scale (${(await place(desk)).toFixed(2)})`);
  assert.equal(await desk.$$eval('[data-rail-item]', items => items.findIndex(item => item.getAttribute('aria-current') === 'true')), 4);
  await seek(desk, REST.all, 900);
  await desk.click('[data-replay]');
  await pause(5200);
  assert.ok((await place(desk)) < 0.05, 'Find it again goes back to the start');
  assert.equal(await desk.evaluate(() => window.__writes), 0, 'Nothing wrote to the document scroll');
  assert.equal(await desk.evaluate(() => window.scrollY), 0, 'The document did not scroll');
  await Promise.all([desk.waitForFunction(() => location.pathname === '/gallery/gsap', { timeout: 15000 }), desk.click('button[aria-label="Exit preview"]')]);
  console.log('keys, step buttons, rail and leaving: ok');
  await desk.close();

  if (!quick) await sweepWide(browser);

  // ---------- A phone: the map above, the console below ----------
  const phone = await browser.newPage();
  watchPage(phone, 'phone');
  await phone.evaluateOnNewDocument(instrument);
  await phone.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await enter(phone);
  await pause(900);
  assert.equal(await phone.$eval('[data-meridian]', root => root.dataset.shape), 'tall');
  assert.equal(await phone.$eval('[data-meridian]', root => root.style.getPropertyValue('--stage')), '844px');
  for (const [name, at] of Object.entries(REST)) {
    await seek(phone, at, 800);
    const found = await phone.evaluate(layout);
    roomy(found, `phone ${name}`);
    facts(found, name, `phone ${name}`);
    if (['city', 'run', 'street', 'door'].includes(name)) assert.ok(found.stop.x > 12 && found.stop.x < 378 && found.stop.y > 12 && found.stop.y < found.canvas.bottom - 12, `phone ${name}: the stop is in the picture`);
    if (name === 'door') assert.ok(found.proof && found.proofLoaded, 'phone door: the proof of delivery is in the console, with its photograph');
    else assert.ok(!found.proof, `phone ${name}: no proof of delivery but at the door`);
  }
  const session = await phone.target().createCDPSession();
  await seek(phone, 0, 700);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 620 }] });
  for (let i = 1; i <= 10; i++) { await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 620 - i * 45 }] }); await pause(16); }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pause(1400);
  assert.ok((await place(phone)) > 0.3, 'A swipe scrolls the demo');
  assert.equal(await phone.evaluate(() => window.scrollY), 0, 'And not the document');
  await seek(phone, 0, 700);
  const tap = await (await phone.$('[data-step="1"]')).boundingBox();
  assert.ok(tap.width >= 44 && tap.height >= 44, 'A step button is a finger wide');
  await phone.touchscreen.tap(tap.x + tap.width / 2, tap.y + tap.height / 2);
  await pause(4800);
  assert.ok(Math.abs((await place(phone)) - REST.lane) < 0.03, `A tap goes on to the next scale (${(await place(phone)).toFixed(2)})`);
  // A toolbar changing the window's height changes nothing on the stage.
  await seek(phone, REST.street, 800);
  const before = await phone.evaluate(layout);
  await phone.setViewport({ width: 390, height: 758, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await pause(700);
  const after = await phone.evaluate(layout);
  assert.equal(await phone.$eval('[data-meridian]', root => root.style.getPropertyValue('--stage')), '844px', 'A moving toolbar does not resize the stage');
  assert.ok(Math.abs(after.stop.x - before.stop.x) < 0.5 && Math.abs(after.stop.y - before.stop.y) < 0.5 && Math.abs(after.across - before.across) < 0.01, 'Nor move the map');
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
    await enter(page);
    await seek(page, REST.city, 300);
    const found = await page.evaluate(layout);
    facts(found, 'city', 'reduced motion city');
    await page.keyboard.press('ArrowDown');
    await pause(500);
    assert.ok(Math.abs((await place(page)) - REST.run) < 0.03, 'A step is a jump, not a glide');
    await page.close();
    console.log('reduced motion: ok');
  }

  // ---------- No JavaScript: nothing hides the page ----------
  {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await page.goto(route, { waitUntil: 'networkidle2' });
    assert.equal(await page.$eval('[data-veil]', el => getComputedStyle(el).display), 'none', 'No veil without JavaScript');
    assert.equal(await page.$eval('[data-count]', el => el.textContent), '41,207');
    await page.close();
    console.log('no JavaScript: ok');
  }

  // ---------- Older engines ----------
  for (const [label, viewport] of [['desktop', { width: 1280, height: 800, deviceScaleFactor: 1 }], ['phone', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    const page = await browser.newPage();
    watchPage(page, `older engine ${label}`);
    await page.evaluateOnNewDocument(older);
    await page.setViewport(viewport);
    await enter(page);
    for (let at = 0; at <= SCREENS; at += 0.3) await seek(page, at, 120);
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
    for (let moved = 0; moved < (SCREENS + 0.5) * 900; moved += 60) { await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 900, y: 450, deltaX: 0, deltaY: 60 }); await pause(12); }
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
      await page.waitForSelector('[data-meridian][data-entered="true"]', { timeout: 30000 });
      await pause(1200);
      for (const [name, at] of Object.entries(REST)) {
        await page.evaluate(at => { const scroller = document.querySelector('[data-meridian] [data-scroller]'); scroller.scrollTop = at * scroller.clientHeight; }, at);
        await pause(850);
        const found = await page.evaluate(layout);
        roomy(found, `webkit ${label} ${name}`);
        facts(found, name, `webkit ${label} ${name}`);
      }
      assert.deepEqual(await page.evaluate(() => window.__refused), [], `No refused call in WebKit (${label})`);
      await context.close();
    }
    console.log('webkit: ok');
  } finally {
    await wk.close();
  }
} else console.log('webkit: skipped (pass a playwright-core path to run it)');

assert.deepEqual(errors, [], 'No runtime errors');
console.log('Meridian: all checks passed');
