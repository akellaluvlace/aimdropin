// Datum, a concept architecture practice (components/gsap/datum), on /gallery/gsap/datum.
// Checks: the route (indexed, its own share card, the concept said in the HTML, no dashes); that the site
// stands on its own (it says it is a concept, names, credits and links to nobody, and its call to action
// does only what its host gives it to do); the entrance, and the first words standing on the line; that
// every line of the drawing is drawn, at the pen's pace, with its ticks and its counting figures; that
// the page scrolls an element of its own and never the
// document; that words and picture keep to their own rooms at every rest, with nothing half way, on wide
// stages and tall ones, across a sweep of window sizes; that the sequence's photographs register with each
// other, with the drawing and with the datum; that the figures on the sheet agree with each other and with
// the picture; that the sheet's ink and paper are never the same tone as night falls; the pacing of the
// picture for each screen of scroll; arrow keys, step buttons and the rail; a phone toolbar changing the
// window's height; reduced motion; no JavaScript; engines that validate attribute names the older way; a
// wheel run with no long frames; and, with a playwright-core path, WebKit.
// Run against a production build; BASE_URL defaults to port 3004.
// Optional argument: path to playwright-core/index.mjs for the WebKit pass. QUICK=1 skips the size sweeps;
// SWEEPS=1 runs only them (SWEEPS=wide or SWEEPS=tall, one of them) and lists everything they find;
// ONLY=webkit runs the route, the survey and the WebKit pass (none of these three is a whole run).
// This is not a physical-device smoothness test.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

const base = (process.env.BASE_URL || 'http://localhost:3004').replace(/\/$/, '');
const route = `${base}/gallery/gsap/datum`;
const executablePath = process.env.CHROME_PATH || { darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }[process.platform];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const errors = [];
const GPU = ['--enable-gpu', '--ignore-gpu-blocklist', ...(process.platform === 'darwin' ? ['--use-angle=metal'] : [])];
const quick = process.env.QUICK === '1';
/** The long house as the page has surveyed it, and each photograph's own geometry: asked of the page, below. */
let survey = null;
/**
 * A stretch of wall clear of every opening, as a point of the photograph: the middle of the widest gap
 * between openings, along the row through the middle of the door. Worked out from the survey the page gave.
 */
const clearWall = house => {
  const door = house.openings.find(opening => opening.kind === 'door'), row = door.y + door.h / 2;
  const across = house.openings.filter(opening => row > opening.y - 12 && row < opening.y + opening.h + 12).map(opening => [opening.x, opening.x + opening.w]).sort((a, b) => a[0] - b[0]);
  const gaps = [house.left, ...across.flat(), house.right].reduce((list, edge, index, edges) => (index % 2 ? list : [...list, [edge, edges[index + 1]]]), []);
  const widest = gaps.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
  return [(widest[0] + widest[1]) / 2, row];
};

// The score, as the page has it (components/gsap/datum/score.ts). Kept here in figures on
// purpose: a change to the score has to be made here too, and so gets looked at.
const SCREENS = 21.1;
const REST = { line: 0, site: 1.1, setout: 2.85, drawing: 4.4, structure: 5.9, building: 7.1, evening: 8.85, ground: 10.1, first: 11.25, board: 12.65, slate: 13.7, lime: 14.75, oak: 15.8, coast: 17.35, studio: 18.6, pavilion: 19.85, start: 21.1 };
const RESTS = Object.values(REST);
// What stands on the plate at each rest: the photographs, by name. The first sheet and the last are bare paper.
const ON_PLATE = { line: [], site: ['site'], setout: ['site'], drawing: ['site'], structure: ['build'], building: ['house'], evening: ['dusk'], ground: ['ground'], first: ['first'], board: ['slate', 'lime', 'oak'], slate: ['slate', 'lime', 'oak'], lime: ['lime', 'oak'], oak: ['oak'], coast: ['coast'], studio: ['studio'], pavilion: ['pavilion'], start: [] };
// The long house, as its drawing gives it (millimetres): scripts/gsap/datum/house.json, through survey.ts.
const HOUSE = { length: 24000, bays: 6, eaves: 5005, ridge: 7780, floor: 2700, openings: 10 };

// Installed before the page's own scripts: count every write to the document's scroll.
const instrument = () => {
  window.__writes = 0;
  const count = original => function (...args) { window.__writes++; return original.apply(this, args); };
  window.scrollTo = count(window.scrollTo);
  window.scroll = count(window.scroll);
  window.scrollBy = count(window.scrollBy);
};
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
  page.on('pageerror', error => errors.push(`${label}: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error' && !/favicon|Failed to load resource/.test(message.text())) errors.push(`${label} console: ${message.text().slice(0, 200)}`); });
};
const enter = async (page, url = route) => {
  await page.goto(url, { waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-datum][data-entered="true"]', { timeout: 30000 });
  await pause(400);
};
/** Put the page at a place in the score (screens of scroll), let it come to rest there, and wait for the pictures it wants. */
const seek = async (page, at, wait = 650, wanted = []) => {
  await page.evaluate(at => { const scroller = document.querySelector('[data-datum] [data-scroller]'); scroller.scrollTop = at * scroller.clientHeight; }, at);
  await pause(wait);
  if (wanted.length) await page.waitForFunction(ids => { const plate = document.querySelector('[data-datum]').datumPlate; return ids.every(id => plate.ready(id)); }, { timeout: 20000 }, wanted).then(() => pause(160));
};
const atRest = (page, name, wait) => seek(page, REST[name], wait, ON_PLATE[name]);
const place = page => page.evaluate(() => { const scroller = document.querySelector('[data-datum] [data-scroller]'); return scroller.scrollTop / scroller.clientHeight; });
/** The screen as numbers: raw RGB, in device px. */
const shot = async page => { const { data, info } = await sharp(await page.screenshot({ type: 'png' })).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, width: info.width, height: info.height, scale: page.viewport().deviceScaleFactor || 1 }; };
const pixel = (image, x, y) => { const i = (Math.round(y) * image.width + Math.round(x)) * 3; return [image.data[i], image.data[i + 1], image.data[i + 2]]; };
const lumaOf = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
/** How bright a colour is, for a contrast ratio (WCAG). */
const lightness = colour => { const [r, g, b] = colour.map(value => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [hi, lo] = [lightness(a), lightness(b)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
const colourOf = text => (text.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

/**
 * What is on the sheet right now, as boxes: every piece of text a reader can see, the chrome, the figures
 * on the drawing and the photographs on the plate. Read in the page, so it is what the browser laid out.
 */
const layout = () => {
  const root = document.querySelector('[data-datum]');
  const box = element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
  const stage = box(root), plateEl = root.querySelector('[data-plate]'), plate = box(plateEl), strip = box(root.querySelector('[data-strip]'));
  const seen = element => { for (let node = element; node && node !== root; node = node.parentElement) { const style = getComputedStyle(node); if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.5) return false; } return true; };
  // The glyphs' own box, cut to the window they are shown through (a line that has risen out of its window is not there).
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
  // Anything half way: a piece of text part faded, a line part risen, a stroke part drawn, an entry part rolled. At a rest there should be none.
  const half = [];
  const opacityOf = element => { let value = 1; for (let node = element; node && node !== root; node = node.parentElement) value *= Number(getComputedStyle(node).opacity); return value; };
  for (const heading of root.querySelectorAll('[data-first], [data-last]')) {
    if (getComputedStyle(heading).visibility === 'hidden') continue;
    const name = heading.hasAttribute('data-first') ? 'the first words' : 'the last words', lift = heading.querySelector('[data-lift]');
    const shift = Math.abs(new DOMMatrixReadOnly(getComputedStyle(lift).transform).m42), cut = Number(getComputedStyle(heading).getPropertyValue('--cut') || 0);
    if (shift > 1 && shift < lift.offsetHeight * 1.02) half.push(`${name}: ${Math.round(shift)}px into the line`);
    if (cut > 0.03 && cut < 0.97) half.push(`${name}: their window part open (${cut.toFixed(2)})`);
  }
  for (const block of root.querySelectorAll('[data-words]')) {
    if (getComputedStyle(block).visibility === 'hidden' || getComputedStyle(block).display === 'none') continue;
    const name = block.dataset.words;
    for (const piece of block.querySelectorAll('[data-fade], [data-cue]')) { if (getComputedStyle(piece).display === 'none') continue; const o = opacityOf(piece); if (o > 0.03 && o < 0.97) half.push(`${name}: "${piece.textContent.slice(0, 28)}" at ${o.toFixed(2)}`); }
    for (const line of block.querySelectorAll('[data-line]')) { if (!line.textContent || getComputedStyle(line).display === 'none') continue; const shift = Math.abs(new DOMMatrixReadOnly(getComputedStyle(line).transform).m42), height = line.offsetHeight || 1; if (shift > 1 && shift < height * 1.05) half.push(`${name}: line "${line.textContent.slice(0, 28)}" ${Math.round(shift)}px off`); }
  }
  // (A line's dash slides from the whole of its nominal length to nothing: how far it has got is a share of that length.)
  for (const stroke of root.querySelectorAll('[data-drawing] [data-draw]')) { const style = getComputedStyle(stroke); if (style.visibility === 'hidden' || !stroke.getAttribute('d')) continue; const offset = parseFloat(style.strokeDashoffset) / Number(stroke.getAttribute('pathLength')); if (offset > 0.02 && offset < 0.98) half.push(`the drawing: ${stroke.dataset.draw} ${stroke.dataset.i ?? ''} drawn to ${(1 - offset).toFixed(2)}`); }
  for (const mark of root.querySelectorAll('[data-drawing] [data-pop], [data-drawing] [data-count]')) { const o = Number(getComputedStyle(mark).opacity); if (o > 0.03 && o < 0.97) half.push(`the drawing: ${mark.dataset.pop ?? mark.dataset.count} at ${o.toFixed(2)}`); }
  for (const cell of root.querySelectorAll('[data-roll]')) { const rows = Number(cell.dataset.rows), moved = -new DOMMatrixReadOnly(getComputedStyle(cell).transform).m42 / (cell.offsetHeight / rows); if (Math.abs(moved - Math.round(moved)) > 0.04) half.push(`the title block: ${cell.dataset.roll} between two entries (${moved.toFixed(2)})`); }
  const view = root.datumPlate.view;
  for (const [key, value] of Object.entries(view)) if (!['street', 'len', 'rise', 'level', 'night'].includes(key) && value > 0.004 && value < 0.996) half.push(`the plate: ${key} at ${value.toFixed(3)}`);
  if (Math.abs(view.street - Math.round(view.street)) > 0.004) half.push(`the plate: between two buildings (${view.street.toFixed(3)})`);
  if (view.night > 0.004 && view.night < 0.996) half.push(`the sheet: between day and night (${view.night.toFixed(3)})`);

  // A line of a heading that is wider than the window it is shown through is cut off at its end.
  // (Its type is measured: a line's window is a little wider than its column by design, and on a close-set strip a heading's lines stand side by side.)
  const typeWidth = element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT), range = document.createRange();
    let left = Infinity, right = -Infinity;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) { range.selectNodeContents(node); for (const rect of range.getClientRects()) { if (rect.width < 0.5) continue; left = Math.min(left, rect.left); right = Math.max(right, rect.right); } }
    return right > left ? right - left : 0;
  };
  const cut = [...root.querySelectorAll('[data-words] h2')].filter(seen).filter(heading => typeWidth(heading) > heading.clientWidth + 2).map(heading => `"${heading.textContent}" (${Math.round(typeWidth(heading))} in ${heading.clientWidth})`);
  const words = [];
  for (const block of root.querySelectorAll('[data-words]')) {
    if (!seen(block)) continue;
    // Piece by piece (a heading, a paragraph): one box round a whole block would claim room nothing stands in.
    for (const piece of [...block.querySelectorAll('[data-line], [data-fade], [data-cue]')].filter(seen)) {
      if (piece.matches('[data-fade]') && piece.querySelector('button')) { for (const button of piece.querySelectorAll('button')) words.push({ name: block.dataset.words, ...box(button) }); continue; }
      const found = textBox(piece); if (found) words.push({ name: block.dataset.words, ...found });
    }
  }
  // Words on the line: each line's glyphs, cut to the window the block moves in (which ends at the line while it is shut).
  const onLine = [];
  for (const heading of root.querySelectorAll('[data-first], [data-last]')) {
    if (!seen(heading)) continue;
    const window = heading.getBoundingClientRect(), size = parseFloat(getComputedStyle(heading).fontSize), foot = window.bottom - Number(getComputedStyle(heading).getPropertyValue('--cut') || 0) * 0.3725 * size;
    for (const line of heading.querySelectorAll('[data-line]')) {
      const found = textBox(line);
      if (!found) continue;
      const cutTo = { left: found.left, right: found.right, top: Math.max(found.top, window.top), bottom: Math.min(found.bottom, foot) };
      if (cutTo.bottom - cutTo.top > 2) onLine.push({ name: heading.hasAttribute('data-first') ? 'first words' : 'last words', ...cutTo });
    }
  }
  // The figures on the drawing: what is lettered there and can be seen.
  const figures = [...root.querySelectorAll('[data-drawing] text')].filter(text => { const style = getComputedStyle(text); return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0.5 && text.getAttribute('display') !== 'none'; }).map(text => ({ name: `${text.dataset.pop ?? text.dataset.count} "${text.textContent}"`, text: text.textContent, kind: text.dataset.pop ?? text.dataset.count, ...box(text) }));
  // The title block: each entry that is showing, and whether it had to be cut short.
  const block = root.querySelector('[data-block]'), blockSeen = seen(block) && getComputedStyle(block).display !== 'none';
  const entries = {};
  if (blockSeen) for (const cell of block.querySelectorAll(':scope > div')) {
    if (getComputedStyle(cell).display === 'none') continue;
    const label = cell.querySelector('dt').textContent, window = cell.querySelector('dd > span'), roll = window.querySelector('[data-roll]');
    const row = roll ? roll.children[Math.round(-new DOMMatrixReadOnly(getComputedStyle(roll).transform).m42 / (roll.offsetHeight / roll.children.length))] : window.firstElementChild;
    entries[label] = { text: row.textContent, cut: row.scrollWidth > row.clientWidth + 1 };
  }
  const boxOf = selector => { const element = root.querySelector(selector); return element && seen(element) && getComputedStyle(element).display !== 'none' ? box(element) : null; };
  const onSheet = b => ({ name: b.id, left: b.left + plate.left, right: b.right + plate.left, top: b.top + plate.top, bottom: b.bottom + plate.top });
  const pictures = root.datumPlate.boxes.map(onSheet);
  // What the picture is about at this moment (the house, the samples, another building): the page says where it is.
  const subjects = root.datumPlate.subjects().map(onSheet);
  const datum = root.querySelector('[data-datum-line]').getBoundingClientRect().top;
  return {
    shape: root.dataset.shape, give: root.dataset.give ?? '', stage, plate, strip, datum, words, onLine, figures, pictures, subjects, half, entries, cut,
    // A material that has been opened has the whole plate: the samples still standing in front of it are then not all the picture is about.
    opened: view.mat0 > 0 || view.mat1 > 0 || view.mat2 > 0,
    block: blockSeen ? box(block) : null, rail: boxOf('[data-rail]'), pager: boxOf('[data-pager]'), level: boxOf('[data-level-mark]'), levelText: root.querySelector('[data-level]').textContent, scale: root.querySelector('[data-scale]').textContent,
    wordmark: boxOf('[data-bar] > span'), tools: boxOf('[data-bar] > div'), concept: boxOf('[data-bar] [data-concept]'), conceptText: root.querySelector('[data-bar] [data-concept]')?.textContent, canvas: [plateEl.width, plateEl.height], stageVar: root.style.getPropertyValue('--stage'),
  };
};
const overlap = (a, b, gap = 0) => a && b && a.left < b.right + gap && b.left < a.right + gap && a.top < b.bottom + gap && b.top < a.bottom + gap;
const fmt = box => (box ? `[${Math.round(box.left)},${Math.round(box.top)} ${Math.round(box.right)},${Math.round(box.bottom)}]` : 'none');
/** Words and picture each in their own room, and nothing over anything else: the rule the layout is built on. */
const roomy = (found, label) => {
  const { stage, plate, strip, words, onLine, figures, pictures, block, rail, pager, level, wordmark, tools, entries } = found;
  assert.deepEqual(found.half, [], `${label}: nothing is half way at a rest`);
  assert.deepEqual(found.cut, [], `${label}: no line of a heading is cut off`);
  // The strip is the words' room: every word is in it, under the plate, clear of the title block, the rail and the step buttons.
  for (const piece of words) {
    assert.ok(piece.left >= stage.left + 4 && piece.right <= stage.right - 4, `${label}: ${piece.name} stays inside the sheet across ${fmt(piece)}`);
    assert.ok(piece.top >= plate.bottom - 0.5 && piece.top >= strip.top - 0.5, `${label}: ${piece.name} ${fmt(piece)} stands under the plate, which ends at ${Math.round(plate.bottom)}`);
    assert.ok(piece.bottom <= stage.bottom - 2, `${label}: ${piece.name} stays inside the sheet down ${fmt(piece)} of ${fmt(stage)}`);
    assert.ok(!overlap(piece, block, 4), `${label}: ${piece.name} ${fmt(piece)} clear of the title block ${fmt(block)}`);
    assert.ok(!overlap(piece, rail, 1), `${label}: ${piece.name} ${fmt(piece)} clear of the rail ${fmt(rail)}`);
    assert.ok(!overlap(piece, pager, 2), `${label}: ${piece.name} ${fmt(piece)} clear of the step buttons ${fmt(pager)}`);
  }
  // Pieces of one block are laid out by the browser one beside or under the other; it is blocks that could run into each other.
  for (let i = 0; i < words.length; i++) for (let j = i + 1; j < words.length; j++) if (words[i].name !== words[j].name) assert.ok(!overlap(words[i], words[j], 1), `${label}: ${words[i].name} ${fmt(words[i])} clear of ${words[j].name} ${fmt(words[j])}`);
  // The plate is the picture's room: every photograph is inside it, and so is every figure on the drawing.
  for (const picture of pictures) assert.ok(picture.left >= plate.left - 0.5 && picture.right <= plate.right + 0.5 && picture.top >= plate.top - 0.5 && picture.bottom <= plate.bottom + 0.5, `${label}: the ${picture.name} photograph ${fmt(picture)} stays on the plate ${fmt(plate)}`);
  for (const figure of figures) {
    assert.ok(figure.left >= plate.left + 1 && figure.right <= plate.right - 1 && figure.top >= plate.top + 1 && figure.bottom <= plate.bottom - 1, `${label}: the figure ${figure.name} ${fmt(figure)} stays on the plate ${fmt(plate)}`);
    assert.ok(!overlap(figure, level, 1), `${label}: the figure ${figure.name} ${fmt(figure)} clear of the datum's level ${fmt(level)}`);
  }
  for (let i = 0; i < figures.length; i++) for (let j = i + 1; j < figures.length; j++) assert.ok(!overlap(figures[i], figures[j], 0), `${label}: the figures ${figures[i].name} ${fmt(figures[i])} and ${figures[j].name} ${fmt(figures[j])} do not run into each other`);
  // Words stand on the line only while the plate behind them is bare paper.
  for (const line of onLine) {
    assert.ok(line.left >= stage.left + 4 && line.right <= stage.right - 4, `${label}: the ${line.name} fit the sheet across ${fmt(line)}`);
    assert.ok(line.top >= plate.top + 2, `${label}: the ${line.name} ${fmt(line)} stay under the bar`);
    for (const picture of pictures) assert.ok(!overlap(line, picture), `${label}: the ${line.name} ${fmt(line)} are not over the ${picture.name} photograph ${fmt(picture)}`);
    assert.ok(!overlap(line, level, 2), `${label}: the ${line.name} ${fmt(line)} clear of the datum's level ${fmt(level)}`);
    for (const piece of words) assert.ok(!overlap(line, piece, 2), `${label}: the ${line.name} ${fmt(line)} clear of ${piece.name} ${fmt(piece)}`);
  }
  if (onLine.length) assert.deepEqual(pictures, [], `${label}: no photograph on the plate while words stand on the line`);
  // The datum's level hangs from the line inside the plate; the bar is bare paper above it.
  assert.ok(level && level.top >= found.datum - 1 && level.bottom <= plate.bottom + 0.5 && level.right <= stage.right - 2, `${label}: the datum's level ${fmt(level)} hangs from the line at ${Math.round(found.datum)}, on the plate`);
  for (const item of [wordmark, tools]) assert.ok(item && item.bottom <= plate.top + 0.5 && item.left >= stage.left + 4 && item.right <= stage.right - 4, `${label}: the bar ${fmt(item)} stays above the plate, which starts at ${Math.round(plate.top)}`);
  // What this is, is in the bar at every size and at every rest: it is the one thing the site says about
  // itself on every screen. (It used to go on any stage under 340px wide.)
  assert.ok(found.concept && found.concept.right - found.concept.left > 40 && found.conceptText === 'Concept practice', `${label}: the bar says what this is ("${found.conceptText}" ${fmt(found.concept)})`);
  assert.ok(found.concept.left >= wordmark.right + 8 && found.concept.right <= stage.right - 4, `${label}: "Concept practice" ${fmt(found.concept)} has its own room beside the wordmark ${fmt(wordmark)}`);
  if (block) {
    assert.ok(block.top >= strip.top - 0.5 && block.bottom <= stage.bottom - 2 && block.left >= stage.left + 4 && block.right <= stage.right - 4, `${label}: the title block ${fmt(block)} stays in the strip`);
    assert.ok(!overlap(block, rail, 1) && !overlap(block, pager, 2), `${label}: the title block ${fmt(block)} clear of the rail ${fmt(rail)} and the step buttons ${fmt(pager)}`);
    for (const [name, entry] of Object.entries(entries)) assert.ok(!entry.cut, `${label}: the title block's ${name} is not cut short ("${entry.text}")`);
  }
  assert.ok(rail && pager && !overlap(rail, pager, 4) && rail.bottom <= stage.bottom && pager.bottom <= stage.bottom, `${label}: the rail ${fmt(rail)} and the step buttons ${fmt(pager)} each have their place`);
  // The rail and the step buttons stand in the strip, never over the plate.
  assert.ok(rail.top >= plate.bottom - 0.5 && pager.top >= plate.bottom - 0.5, `${label}: the rail ${fmt(rail)} and the step buttons ${fmt(pager)} stand under the plate, which ends at ${Math.round(plate.bottom)}`);
  // Nothing laid over the plate covers what the picture is about at that moment: not the datum's level, not
  // the title block, not the chrome. (Where that is, the page says: see `subjects` in plate.ts.)
  for (const subject of found.subjects) for (const [name, over] of [["the datum's level", level], ['the title block', block], ['the rail', rail], ['the step buttons', pager], ['the wordmark', wordmark], ['the tools', tools]]) assert.ok(!overlap(subject, over), `${label}: ${name} ${fmt(over)} does not cover the ${subject.name} ${fmt(subject)}`);
  // And the words have not taken the picture's room: what it is about is still a fair part of the plate,
  // and the plate a fair part of the sheet.
  const area = box => Math.max(0, box.right - box.left) * Math.max(0, box.bottom - box.top);
  if (found.subjects.length && !found.opened) assert.ok(found.subjects.reduce((sum, subject) => sum + area(subject), 0) >= area(plate) * 0.08, `${label}: what the picture is about (${found.subjects.map(subject => `${subject.name} ${fmt(subject)}`).join(', ')}) is a fair part of the plate ${fmt(plate)}`);
  assert.ok(area(plate) >= area(stage) * 0.4, `${label}: the plate ${fmt(plate)} is a fair part of the sheet ${fmt(stage)}`);
};

/** In a sweep, every size is looked at before anything fails: the list is what tells where a breakpoint is wrong. */
const findings = [];
const sweepCheck = (found, label) => { try { roomy(found, label); } catch (error) { findings.push(error.message); } };
const sweepDone = what => { assert.deepEqual(findings.splice(0), [], `${what}: words and picture keep their rooms at every size`); };
// The rests the sweeps look at: the ones with the most on the sheet, and every kind of picture something could be laid over.
const KEY = ['line', 'site', 'setout', 'drawing', 'building', 'evening', 'ground', 'board', 'slate', 'lime', 'studio', 'pavilion', 'start'];
/** What the strip had to give up at each size, counted: "full" where nothing had to. */
const given = sizes => { const count = {}; for (const give of sizes) count[give || 'full'] = (count[give || 'full'] ?? 0) + 1; return Object.entries(count).map(([give, times]) => `${times} ${give}`).join(', '); };
/** Wide stages: one page, resized. Heights in 20px steps (a few sample sizes miss the gaps between breakpoints), then widths. */
async function sweepWide(browser) {
  const sweep = await browser.newPage();
  watchPage(sweep, 'sweep');
  await sweep.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await enter(sweep);
  const sizes = [];
  for (let height = 400; height <= 1120; height += 20) sizes.push([1440, height]);
  for (let width = 960; width <= 2000; width += 80) sizes.push([width, 800]);
  sizes.push([844, 390], [932, 430], [1024, 768], [1180, 820], [1366, 768], [1536, 864], [1920, 1080], [2560, 1440], [1100, 1000]);
  const gave = [];
  for (const [width, height] of sizes) {
    if (width / height < 1.05) continue;
    await sweep.setViewport({ width, height, deviceScaleFactor: 1 });
    await pause(350);
    let give = '';
    for (const name of KEY) {
      // (The first rest follows a jump back from the end of the page: it is given longer to arrive.)
      await atRest(sweep, name, name === 'line' ? 1100 : 480);
      const found = await sweep.evaluate(layout);
      assert.equal(found.shape, 'wide');
      sweepCheck(found, `${width}x${height} ${name}`);
      give = found.give;
    }
    gave.push(give);
  }
  await sweep.close();
  sweepDone('wide stages');
  console.log(`wide stages: ok (${gave.length} window sizes: ${given(gave)})`);
}
/**
 * Where the plate's sides fall across the house once a tall stage has walked up to it. A side may fall
 * on bare wall, or cut an opening through with a good part of it to each side. It may not leave a few
 * pixels of a window at the plate's edge (lit, at dusk, that is a bright hairline down the side of the
 * picture), nor a window whole with its frame touching the edge. The page is asked for its camera and its
 * openings; what comes back is every opening left that way, in px of the screen.
 */
const edgesOfTheCloseView = page => page.$eval('[data-datum]', root => {
  const plate = root.datumPlate, cams = plate.cameras(), width = plate.layout().width, { s, fx } = cams.close;
  if (cams.close.s === cams.overview.s) return [];
  const half = width / 2 / s, found = [];
  plate.survey.house.openings.forEach((o, index) => {
    for (const side of [-1, 1]) {
      const edge = fx + side * half, shown = (side < 0 ? o.x + o.w - edge : edge - o.x) * s, hidden = (side < 0 ? edge - o.x : o.x + o.w - edge) * s;
      if (shown <= 0 || hidden <= -4 || (shown >= 14 && hidden >= 10)) continue;
      found.push(`opening ${index} at the ${side < 0 ? 'west' : 'east'} side of the plate, ${shown.toFixed(1)}px of it showing and ${hidden.toFixed(1)}px cut off`);
    }
  });
  return found;
});
/** Tall stages: phones and tablets held upright. Each is loaded as its own page (a phone ignores a change of height alone). */
async function sweepTall(browser) {
  // Phones as they are held, which is not the size of their screens: with the browser's bars showing, a
  // 390 by 844 phone has about 390 by 664 (Safari) to 750 (Chrome) to show a page in. Heights in 20px steps
  // across that and beyond, the smallest phones, and tablets held upright.
  const sizes = [[320, 568], [360, 640], [360, 780], [375, 548], [375, 667], [390, 664], [390, 750], [393, 852], [412, 915], [430, 932], [600, 960], [768, 1024], [820, 1180]];
  for (let height = 560; height <= 940; height += 20) sizes.push([390, height]);
  const gave = [];
  for (const [width, height] of sizes) {
    const page = await browser.newPage();
    watchPage(page, `${width}x${height}`);
    await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await enter(page);
    let give = '';
    for (const name of KEY) {
      await atRest(page, name, name === 'line' ? 700 : 480);
      const found = await page.evaluate(layout);
      assert.equal(found.shape, 'tall');
      sweepCheck(found, `${width}x${height} ${name}`);
      give = found.give;
    }
    for (const sliver of await edgesOfTheCloseView(page)) findings.push(`${width}x${height} close by: ${sliver}`);
    gave.push(give);
    await page.close();
  }
  sweepDone('tall stages');
  console.log(`tall stages: ok (${sizes.length} window sizes: ${given(gave)})`);
}
/** Both sweeps, each to its end, so one run lists everything there is to fix. */
const sweeps = async browser => {
  const found = [];
  for (const sweep of process.env.SWEEPS === 'tall' ? [sweepTall] : process.env.SWEEPS === 'wide' ? [sweepWide] : [sweepWide, sweepTall]) { try { await sweep(browser); } catch (error) { found.push(...(Array.isArray(error.actual) ? error.actual : [error.message])); } }
  if (found.length) { console.log(found.join('\n')); throw new Error(`${found.length} findings in the window-size sweeps`); }
};

/**
 * Where an edge of the photograph is on the screen: along a row or a column of a screenshot, the place the
 * tone changes most, to a fraction of a CSS px. `channel` picks what is looked at: how light, or how green.
 */
const edgeIn = (image, axis, fixed, from, to, channel = 'luma', band = 3) => {
  const value = (x, y) => { const [r, g, b] = pixel(image, x, y); return channel === 'green' ? g - (r + b) / 2 : lumaOf([r, g, b]); };
  const s = image.scale, at = t => { let sum = 0; for (let o = -band; o <= band; o++) sum += axis === 'y' ? value(fixed * s + o, t) : value(t, fixed * s + o); return sum / (2 * band + 1); };
  const step = t => Math.abs(at(t + 2) - at(t - 2));
  let best = 0, where = from * s;
  for (let t = Math.round(from * s); t <= Math.round(to * s); t++) { const here = step(t); if (here > best) { best = here; where = t; } }
  // The top of a parabola through the peak and its neighbours.
  const a = step(where - 1), c = step(where + 1), bend = a - 2 * best + c;
  return { at: (where + (bend < 0 ? (0.5 * (a - c)) / bend : 0)) / s, strength: best };
};

const browser = await puppeteer.launch({ executablePath, headless: true, args: GPU });
try {
  // ---------- The route: a page of its own, readable as HTML ----------
  {
    const response = await fetch(route);
    assert.equal(response.status, 200, 'The route answers');
    // React leaves comment markers between pieces of text: they are not part of what is read.
    const html = (await response.text()).replace(/<!-- -->/g, '');
    assert.doesNotMatch(html, /<meta name="robots" content="noindex/, 'It may be found by search engines here');
    assert.match(html, /<title>Datum, a concept architecture practice<\/title>/, 'Its own title, with nobody else\'s name on it');
    assert.match(html, /property="og:image" content="[^"]*\/thumbs\/gsap\/datum\.webp/, 'A share card of its own: a screen from the site');
    assert.match(html, /<link rel="canonical" href="[^"]*\/gallery\/gsap\/datum"/, 'It names its own address');
    assert.match(html, /data-datum/, 'The demo is in the HTML');
    assert.match(html, /First,<\/span>/, 'The headline is in the HTML');
    assert.match(html, /Datum is a concept\. The practice and its buildings do not exist, and every photograph here was generated\./, 'It says it is a concept, in plain words');
    assert.match(html, /Concept practice/, 'And says so in the bar');
    const copy = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
    assert.doesNotMatch(copy, /[\u2013\u2014]|&mdash;|&ndash;/, 'No en or em dashes in its copy');
    assert.doesNotMatch(copy.replace(/<[^>]+>/g, ' '), /\u00b7/, 'No middle dots between its words');
    // What this route says about the page describes the page and nobody else: the site is made to stand
    // on its own somewhere else, and does not name, credit or sell whoever made it. (Only these three are
    // looked at here. The rest of the head is the host's layout, which has the host's name in it; what
    // the page itself says is read from its own root in a browser, further down.)
    const meta = name => (html.match(new RegExp(`<meta (?:name|property)="${name}" content="([^"]*)"`)) ?? [])[1];
    for (const name of ['description', 'og:title', 'og:description']) {
      assert.ok(meta(name), `The route has its ${name}`);
      assert.doesNotMatch(meta(name), /akella|inmotion|gsap|built by/i, `Its ${name} describes the page and names nobody ("${meta(name)}")`);
    }
    assert.equal(meta('og:title'), 'Datum, a concept architecture practice', 'The share title is the page\'s own');
    const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
    assert.match(sitemap, /\/gallery\/gsap\/datum</, 'And it is in the sitemap');
    console.log('route: ok');
  }

  // SWEEPS=1 runs only the window-size sweeps (for working on the layout); SWEEPS=wide or SWEEPS=tall, one of them.
  if (process.env.SWEEPS) {
    await sweeps(browser);
    console.log('Datum: sweeps passed');
    process.exit(0);
  }

  // ---------- The survey: the page is asked where the house is ----------
  // Everything below that looks for a part of the house, in a served file or on the screen, takes its place
  // from the page's own survey (survey.ts, through the handle mount.ts leaves on the root), never from a
  // number typed into this file: a check that carries its own coordinates reports on the wrong point the
  // day the photograph is measured again.
  survey = await (async () => { const page = await browser.newPage(); await enter(page); const found = await page.$eval('[data-datum]', root => root.datumPlate.survey); await page.close(); return found; })();
  const H = survey.house;
  assert.ok(H.ground > H.eaves && H.eaves > H.ridge && H.right > H.left && H.openings.length > 0, 'The page knows where its house is');

  // ONLY=webkit goes straight to the WebKit pass (for working on that pass; it is not a whole run).
  chrome: {
  if (process.env.ONLY === 'webkit') { console.log('Chrome: skipped (ONLY=webkit)'); break chrome; }
  /** How far each served variant of the house lies from the finished house, read like for like, in px of the photograph. */
  const served = {};

  // ---------- The photographs themselves: the long house's five states lie over each other ----------
  // The served files, measured the way scripts/gsap/datum/register.mjs measures the masters: the ground line
  // (where green begins under the wall) and the two ends of the wall, in px of the photograph.
  {
    /** A served file, and how its pixels stand to the photograph's (the survey says which part of it the file holds). */
    const read = async name => {
      const rect = survey.pictures[name].files.l;
      const { data, info } = await sharp(Buffer.from(await (await fetch(`${base}/assets/gsap/datum/${survey.pictures[name].dir}/${name}-l.webp`)).arrayBuffer())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const k = info.width / (rect[2] - rect[0]);
      assert.ok(Math.abs(info.height / (rect[3] - rect[1]) - k) < 0.002, `${name}: the file is the part of the photograph the survey says it is`);
      return { data, width: info.width, height: info.height, scale: 1, x: mx => (mx - rect[0]) * k, y: my => (my - rect[1]) * k, mx: x => x / k + rect[0], my: y => y / k + rect[1] };
    };
    const middle = values => values.sort((a, b) => a - b)[values.length >> 1];
    // Columns along the wall and rows just under the eaves, where each end of the wall stands against the sky.
    const columns = []; for (let x = H.left + 40; x <= H.right - 40; x += 20) columns.push(x);
    const rows = []; for (let y = H.eaves + 12; y <= H.eaves + 112; y += 5) rows.push(y);
    /** A picture's three lines. Where grass begins is read by how green it is by day, and by how dark at dusk. */
    const linesOf = (image, how) => ({
      ground: middle(columns.map(x => edgeIn(image, 'y', image.x(x), image.y(H.ground - 30), image.y(H.ground + 35), how, 2)).filter(found => found.strength > 10).map(found => image.my(found.at))),
      left: middle(rows.map(y => edgeIn(image, 'x', image.y(y), image.x(H.left - 18), image.x(H.left + 24), 'luma', 2)).filter(found => found.strength > 10).map(found => image.mx(found.at))),
      right: middle(rows.map(y => edgeIn(image, 'x', image.y(y), image.x(H.right - 22), image.x(H.right + 22), 'luma', 2)).filter(found => found.strength > 10).map(found => image.mx(found.at))),
    });
    const finished = await read('house');
    // The survey's own lines are where this photograph has them: the check and the page agree on where the house is.
    const own = linesOf(finished, 'green');
    assert.ok(Math.abs(own.ground - H.ground) <= 2 && Math.abs(own.left - H.left) <= 2.5 && Math.abs(own.right - H.right) <= 2.5, `The survey's ground line and wall ends (${H.ground}, ${H.left}, ${H.right}) are where the photograph has them (${own.ground.toFixed(1)}, ${own.left.toFixed(1)}, ${own.right.toFixed(1)})`);
    const lines = {};
    for (const [name, how] of [['build', 'green'], ['duskoff', 'luma'], ['dusk', 'luma']]) {
      const image = await read(name), here = linesOf(image, how), there = linesOf(finished, how);
      lines[name] = here.ground - there.ground;
      served[name] = { ground: here.ground - there.ground };
      // (The wall's ends are soft edges against sky and scaffolding: they are held to two pixels, the ground line to one and a half.)
      assert.ok(Math.abs(here.ground - there.ground) <= 1.5, `The ${name} photograph's ground line (${here.ground.toFixed(2)}) lies on the finished house's (${there.ground.toFixed(2)}), within a pixel and a half`);
      for (const key of ['left', 'right']) assert.ok(Math.abs(here[key] - there[key]) <= 2, `The ${name} photograph's ${key} end (${here[key].toFixed(2)}) lies on the finished house's (${there[key].toFixed(2)}), within two pixels`);
    }
    // The bare site has no building to go by: the hawthorns, which stand on the ground just west of the
    // house's west end, stand where they stand in the finished photograph.
    const site = await read('site'), house = finished;
    const patch = (image, dx, dy) => { const values = []; for (let y = H.ground - 177; y < H.ground - 37; y += 2) for (let x = 60; x < H.left - 72; x += 2) values.push(lumaOf(pixel(image, image.x(x) + dx, image.y(y) + dy))); return values; };
    const agreement = (a, b) => { const n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n; let ab = 0, aa = 0, bb = 0; for (let i = 0; i < n; i++) { ab += (a[i] - ma) * (b[i] - mb); aa += (a[i] - ma) ** 2; bb += (b[i] - mb) ** 2; } return ab / Math.sqrt(aa * bb); };
    const reference = patch(house, 0, 0);
    let best = { score: -1, dx: 0, dy: 0 };
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const score = agreement(reference, patch(site, dx, dy)); if (score > best.score) best = { score, dx, dy }; }
    assert.ok(best.score > 0.8 && Math.abs(best.dx) <= 1 && Math.abs(best.dy) <= 1, `The bare site's hawthorns stand where the finished photograph's do (best fit ${best.dx}, ${best.dy} px, agreement ${best.score.toFixed(2)})`);
    console.log(`photographs: ok (ground lines out by ${Object.entries(lines).map(([name, out]) => `${name} ${out.toFixed(2)}`).join(', ')} px; the site's hawthorns by ${best.dx}, ${best.dy})`);
  }

  // ---------- Desktop: the entrance, the first words on the line ----------
  const desk = await browser.newPage();
  watchPage(desk, 'desktop');
  await desk.evaluateOnNewDocument(instrument);
  await desk.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await desk.goto(route, { waitUntil: 'domcontentloaded' });
  // Until the type is in, the sheet is bare; then the line is drawn across it and the first words rise out of it.
  assert.equal(await desk.$eval('[data-datum]', root => root.dataset.entered), 'false', 'Not entered while loading');
  assert.notEqual(await desk.$eval('[data-veil]', el => getComputedStyle(el).display), 'none', 'The sheet is bare until it enters');
  // They come up out of the line itself: on the way, their window is shut at the datum, and nothing of them shows under it.
  await desk.waitForFunction(() => { const lift = document.querySelector('[data-first] [data-lift]'); const y = new DOMMatrixReadOnly(getComputedStyle(lift).transform).m42; return y > 4 && y < lift.offsetHeight * 0.8; }, { timeout: 30000, polling: 'raf' });
  const rising = await desk.evaluate(() => { const heading = document.querySelector('[data-first]'), datum = document.querySelector('[data-datum-line]').getBoundingClientRect().top; return { cut: Number(getComputedStyle(heading).getPropertyValue('--cut')), clip: getComputedStyle(heading).clipPath, foot: heading.getBoundingClientRect().bottom - 0.3725 * parseFloat(getComputedStyle(heading).fontSize), datum }; });
  assert.ok(rising.cut === 1 && /inset/.test(rising.clip) && Math.abs(rising.foot - rising.datum) < 0.6, `While the first words rise, their window ends at the line (${rising.foot.toFixed(1)} and ${rising.datum}, ${rising.clip})`);
  await desk.waitForSelector('[data-datum][data-entered="true"]', { timeout: 30000 });
  assert.equal(await desk.$eval('[data-veil]', el => getComputedStyle(el).display), 'none', 'The veil is gone');
  await pause(500);
  const hero = await desk.evaluate(layout);
  roomy(hero, 'desktop first sheet');
  assert.deepEqual(await desk.$$eval('[data-first] [data-line]', lines => lines.map(line => line.textContent)), ['First,', 'a line.'], 'The first words');
  assert.equal(new Set(hero.onLine.map(line => Math.round(line.top))).size, 1, 'On a wide sheet the first words are one line');
  const stroke = await desk.$eval('[data-datum-stroke]', el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, colour: getComputedStyle(el).backgroundColor }; });
  assert.ok(stroke.left <= 0.5 && stroke.right >= 1439.5, 'The datum runs from one side of the sheet to the other');
  assert.deepEqual(colourOf(stroke.colour), [221, 58, 28], 'And it is the red of the line');
  assert.equal(hero.levelText, '0.000', 'Its level is 0.000');
  assert.equal(await desk.$eval('[data-datum]', root => getComputedStyle(root).fontFamily.split(',')[0].replace(/["']/g, '')), 'Jost');
  assert.ok(await desk.evaluate(() => document.fonts.check('300 40px Jost')), 'The typeface is loaded');
  // The first words stand on the line: the foot of their letters is on the datum, as a house's ground line is.
  {
    const image = await shot(desk);
    const first = hero.onLine[0];
    let foot = 0;
    // The "F" is the first tenth of the first word: the lowest ink in it is its foot.
    for (let x = first.left + 2; x < first.left + (first.right - first.left) * 0.1; x++) for (let y = hero.datum - 30; y < hero.datum + 12; y++) if (lumaOf(pixel(image, x, y)) < 90) foot = Math.max(foot, y);
    assert.ok(Math.abs(foot + 1 - hero.datum) <= 1.6, `The first words stand on the line (their foot is at ${foot + 1}, the datum at ${hero.datum})`);
  }
  assert.match(await desk.$eval('[data-words="line"] [data-fade]', el => el.textContent), /Datum is an architecture practice\. Every building it makes starts the same way: one level line/, 'What it is');
  assert.match(await desk.$$eval('[data-cue]', cues => cues.filter(cue => getComputedStyle(cue).display !== 'none').map(cue => [...cue.children].filter(child => getComputedStyle(child).display !== 'none').map(child => child.textContent).join(' ')).join('|')), /^Scroll, or hold\s+to set it out$/, 'One cue, for a mouse');
  // The first sheet is a line and a few words: no photograph has to arrive before it can be read, and the
  // picture kept for readers without scripts is not fetched by a reader with them.
  const fetched = await desk.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name).filter(name => name.includes('/assets/gsap/datum/')));
  assert.ok(!fetched.some(name => name.endsWith('poster.webp')), 'The poster is not fetched when scripts run');
  assert.ok(fetched.some(name => name.includes('jost-latin.woff2')), 'The typeface is the page\'s own file');
  console.log('desktop entrance: ok');

  // ---------- Every rest: words and picture in their own rooms, and what the sheet says there ----------
  const said = {};
  for (const name of Object.keys(REST)) {
    await atRest(desk, name, name === 'line' ? 900 : 750);
    const found = await desk.evaluate(layout);
    roomy(found, `desktop ${name}`);
    said[name] = found;
    assert.deepEqual([...new Set(found.words.map(piece => piece.name))], [name], `At ${name} the strip says ${name} and nothing else`);
    assert.deepEqual([...new Set(found.pictures.map(picture => picture.name))].sort(), [...ON_PLATE[name]].sort(), `At ${name} the plate holds ${ON_PLATE[name].join(', ') || 'nothing'}`);
  }
  assert.ok(said.line.onLine.length === 2 && said.start.onLine.length === 2, 'Words stand on the line on the first sheet and the last');
  for (const name of Object.keys(REST)) if (name !== 'line' && name !== 'start') assert.equal(said[name].onLine.length, 0, `No words on the line at ${name}`);
  // The title block follows the scenes.
  const entry = (name, cell) => said[name].entries[cell].text;
  assert.deepEqual(['line', 'drawing', 'building', 'slate', 'studio', 'start'].map(name => entry(name, 'Drawing')), ['000 Datum', '100 South elevation', '300 As built', '501 Slate', '100 South elevation', '000 Datum']);
  assert.deepEqual(['line', 'coast', 'studio', 'pavilion', 'start'].map(name => entry(name, 'Project')), ['Long house', 'Coast house', 'Tide studio', 'Reading pavilion', 'Yours']);
  assert.deepEqual(['line', 'site', 'setout', 'drawing', 'structure', 'building', 'evening', 'board', 'coast', 'start'].map(name => entry(name, 'Stage')), ['Brief', 'Survey', 'Setting out', 'Design', 'Construction', 'Complete', 'In use', 'Specification', 'Complete', 'Not started']);
  for (const name of ['ground', 'first', 'board', 'slate', 'lime', 'oak']) assert.equal(said[name].scale, 'Not to scale', `A photograph of a room or a surface has no scale (${name})`);
  assert.equal(said.start.scale, '1:1', 'The last sheet is the size it is');
  // The level the line stands at: 0.000, until the page goes up a floor.
  assert.equal(said.ground.levelText, '0.000'); assert.equal(said.first.levelText, `+${(HOUSE.floor / 1000).toFixed(3)}`, 'One floor up, the line stands at the first floor'); assert.equal(said.board.levelText, '0.000');
  console.log('desktop rests: ok');

  // ---------- The figures: they agree with each other, and with the picture ----------
  {
    const setout = said.setout.figures, drawing = said.drawing.figures;
    const bays = setout.filter(figure => figure.kind === 'bay').map(figure => figure.text);
    assert.deepEqual(bays, Array(HOUSE.bays).fill('4 000'), 'Six bays of 4 000');
    assert.equal(setout.find(figure => figure.kind === 'len').text, '24 000', 'The whole length reads 24 000');
    assert.equal(bays.reduce((sum, text) => sum + Number(text.replace(/\s/g, '')), 0), HOUSE.length, 'The bays add up to it');
    assert.equal(setout.find(figure => figure.kind === 'ridge').text, '+7.780'); assert.equal(setout.find(figure => figure.kind === 'eaves').text, '+5.005');
    assert.deepEqual(setout.filter(figure => figure.kind === 'letter').map(figure => figure.text).join(''), 'ABCDEFG', 'Seven grid lines, lettered');
    assert.equal(drawing.length, setout.length, 'The drawing keeps its setting out');
    const body = await desk.$eval('[data-words="setout"] [data-fade]', el => el.textContent);
    assert.match(body, /Seven grid lines, four metres apart: twenty-four metres, end to end\. Eaves at 5\.005 above the line, ridge at 7\.780\./, 'The words give the same figures');
    assert.match(await desk.$eval('[data-words="drawing"] [data-fade]', el => el.textContent), /Ten openings/, 'And the same count of openings');
    // The scale in the title block is true: at 96 px to the inch, 24 m at that scale is as long as the house is drawn.
    const geometry = await desk.evaluate(() => { const root = document.querySelector('[data-datum]'), plate = root.querySelector('[data-plate]').getBoundingClientRect(), box = root.querySelector('[data-drawing] [data-draw="wall"]').getBBox(), ticks = [...root.querySelectorAll('[data-drawing] [data-pop="len-tick"]')].map(tick => Number(tick.dataset.at.split(' ')[0])); return { wall: { left: box.x + plate.left, right: box.x + box.width + plate.left, top: box.y + plate.top, bottom: box.y + box.height + plate.top }, roofTop: root.querySelector('[data-drawing] [data-draw="roof"]').getBBox().y + plate.top, ticks: ticks.map(x => x + plate.left), ratios: root.datumPlate.ratios(), openings: root.querySelectorAll('[data-drawing] [data-draw="opening"]').length }; });
    const ratio = Number(said.drawing.scale.split(':')[1]), metre = 96 / 0.0254 / ratio;
    assert.equal(ratio, geometry.ratios.overview);
    assert.ok(Math.abs((geometry.wall.right - geometry.wall.left) / metre - 24) < 0.03, `The house is drawn ${((geometry.wall.right - geometry.wall.left) / metre).toFixed(3)} m long at ${said.drawing.scale}`);
    assert.ok(Math.abs((geometry.wall.bottom - geometry.wall.top) / metre - HOUSE.eaves / 1000) < 0.03, `Its eaves are drawn ${((geometry.wall.bottom - geometry.wall.top) / metre).toFixed(3)} m up`);
    assert.ok(Math.abs((geometry.wall.bottom - geometry.roofTop) / metre - HOUSE.ridge / 1000) < 0.03, `Its ridge is drawn ${((geometry.wall.bottom - geometry.roofTop) / metre).toFixed(3)} m up`);
    assert.equal(geometry.ticks.length, 7); assert.equal(geometry.openings, HOUSE.openings);
    for (let i = 1; i < 7; i++) assert.ok(Math.abs((geometry.ticks[i] - geometry.ticks[i - 1]) / metre - 4) < 0.03, 'The ticks are four metres apart');
    // The drawing stands on the datum.
    assert.ok(Math.abs(geometry.wall.bottom - said.drawing.datum) < 0.6, `The drawn wall's foot (${geometry.wall.bottom.toFixed(1)}) is on the datum (${said.drawing.datum})`);

    // And the photographs lie under it, as they are drawn on the screen. Two things are asked.
    // That the finished house (the photograph the survey was taken from) is where the drawing is: its ground
    // line on the datum, its east end and its eaves where the drawn wall has them. A reading of "where the
    // grass begins" is not quite the line the survey measured, so this is held to a pixel and a bit.
    // And that the building site and dusk lie on the finished house: each line read the same way in both
    // frames and the two readings compared, which is like for like. (A reading against the datum alone let
    // a photograph 4 px of itself out go by: at this scale that is 2 px on the screen, and the allowance
    // had to be 1.5.)
    const wall = geometry.wall, middle = values => values.sort((a, b) => a - b)[values.length >> 1];
    const columns = []; for (let x = wall.left + 40; x < wall.right - 40; x += 24) columns.push(x);
    const rows = []; for (let y = wall.top + 8; y < wall.top + 60; y += 4) rows.push(y);
    const read = {};
    for (const name of ['building', 'structure', 'evening']) {
      await atRest(desk, name, 800);
      // (The red line lies exactly where the photograph's ground line is looked for: it is taken off for the reading.)
      await desk.$eval('[data-datum-line]', el => { el.style.visibility = 'hidden'; });
      const image = await shot(desk);
      await desk.$eval('[data-datum-line]', el => { el.style.visibility = ''; });
      const line = (positions, axis, near, channel, least) => middle(positions.map(p => edgeIn(image, axis, p, near - 14, near + 14, channel)).filter(found => found.strength > least).map(found => found.at));
      read[name] = { green: line(columns, 'y', said[name].datum, 'green', 10), dark: line(columns, 'y', said[name].datum, 'luma', 10), east: line(rows, 'x', wall.right, 'luma', 10), eaves: line(columns, 'y', wall.top, 'luma', 20), datum: said[name].datum };
    }
    const house = read.building;
    assert.ok(Math.abs(house.green - house.datum) <= 1.2, `The finished house's ground line (${house.green.toFixed(2)}) is on the datum (${house.datum})`);
    assert.ok(Math.abs(house.east - wall.right) <= 1, `The finished house's east end (${house.east.toFixed(2)}) is where the drawing has it (${wall.right.toFixed(2)})`);
    assert.ok(Math.abs(house.eaves - wall.top) <= 1, `The finished house's eaves (${house.eaves.toFixed(2)}) are where the drawing has them (${wall.top.toFixed(2)})`);
    // The building site is read by where green begins (its wall is grey, the house's white); dusk by where it
    // gets dark. The ground reading is held against what the served files say that photograph's own offset is
    // (the building site's ground line really is three quarters of a pixel of the photograph low), so an
    // error shows as much one way as the other: held to half a pixel of the screen, which is one of the
    // photograph at this scale. At dusk the light on the grass moves the ground reading a little by itself,
    // so it is allowed three quarters there; the eaves, which the light does not touch, hold dusk to a half
    // up and down. The east end and the eaves are compared as they are read: the files' own east ends are
    // soft edges, read to no better than a pixel, and taking that off would add more than it removes.
    const scale = await desk.$eval('[data-datum]', root => root.datumPlate.cameras().overview.s);
    const out = {};
    for (const [name, file, ground, lines] of [['structure', 'build', 'green', ['east']], ['evening', 'dusk', 'dark', ['east', 'eaves']]]) {
      out[name] = { ground: read[name][ground] - house[ground] - served[file].ground * scale, ...Object.fromEntries(lines.map(key => [key, read[name][key] - house[key]])) };
      for (const [key, by] of Object.entries(out[name])) assert.ok(Math.abs(by) <= (name === 'evening' && key === 'ground' ? 0.75 : 0.5), `${name}: the photograph's ${key === 'ground' ? 'ground line' : key === 'east' ? 'east end' : 'eaves'} lies on the finished house's on the screen (out by ${by.toFixed(2)} px${key === 'ground' ? ' more than the file itself is' : ''})`);
    }
    const outBy = name => Object.entries(out[name]).map(([key, by]) => `${key} ${by.toFixed(2)}`).join(', ');
    console.log(`figures and registration: ok (${said.drawing.scale}, the house ${Math.round(wall.right - wall.left)} px long; on the screen the building site lies on the finished house to within ground ${out.structure.ground.toFixed(2)}, east ${out.structure.east.toFixed(2)} px, and dusk to within ${outBy('evening')} px, the ground lines beyond what the files themselves are out by)`);
  }

  // ---------- The moves between the rests ----------
  // The site opens out of the line: a band of photograph with the datum inside it.
  await seek(desk, 0.6, 700, ['site']);
  let moving = await desk.evaluate(layout);
  assert.ok(moving.pictures.length === 1 && moving.pictures[0].top > moving.plate.top + 20 && moving.pictures[0].top < moving.datum && moving.pictures[0].bottom > moving.datum && moving.pictures[0].bottom < moving.plate.bottom - 2, `Half way, the site is a band about the datum ${fmt(moving.pictures[0])}`);
  assert.equal(moving.onLine.length, 0, 'And the first words have gone back into the line before it opened');
  // The building goes up bay by bay, and the drawing gives way exactly where it stands.
  await seek(desk, 5.1, 800, ['build']);
  moving = await desk.evaluate(layout);
  const risen = await desk.$eval('[data-datum]', root => { const view = root.datumPlate.view; return [0, 1, 2, 3, 4, 5, 6, 7].map(index => view[`bay${index}`]); });
  assert.ok(risen[0] > 0.9 && risen[7] === 0 && risen.every((value, index) => index === 0 || value <= risen[index - 1]), `The bays go up west to east (${risen.map(value => value.toFixed(2)).join(', ')})`);
  const cuts = await desk.$$eval('[data-drawing] clipPath rect', rects => rects.map(rect => ['x', 'y', 'width', 'height'].map(name => Number(rect.getAttribute(name)))));
  const strips = moving.pictures.filter(picture => picture.name === 'build');
  assert.equal(cuts.length, 16); assert.ok(strips.length >= 3, 'Several strips of the building are up');
  for (const [index, strip] of strips.entries()) { const above = cuts[index * 2]; assert.ok(Math.abs(above[1] + above[3] + moving.plate.top - strip.top) < 2.6, `The drawing in strip ${index} stops where the building's top is (${(above[1] + above[3] + moving.plate.top).toFixed(1)} and ${strip.top.toFixed(1)})`); }
  // Dusk: nothing written on the sheet ever has the tone of the paper it is on. Not the ink, and not the
  // quieter tone the sentences and the title block's labels are set in, which is nearer the paper to begin with.
  {
    const worst = await desk.evaluate(() => {
      const root = document.querySelector('[data-datum]'), parse = text => (text.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const light = colour => { const [r, g, b] = colour.map(value => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const least = { ink: { ratio: 99, at: 0 }, soft: { ratio: 99, at: 0 } };
      for (const [from, to] of [[7.2, 8.1], [11.4, 12.1]]) for (let at = from; at <= to; at += 0.005) {
        root.datumPlate.pose(at);
        const style = getComputedStyle(root), paper = light(parse(style.getPropertyValue('--paper')));
        for (const name of ['ink', 'soft']) { const [hi, lo] = [light(parse(style.getPropertyValue(`--${name}`))), paper].sort((a, b) => b - a), ratio = (hi + 0.05) / (lo + 0.05); if (ratio < least[name].ratio) least[name] = { ratio, at }; }
      }
      root.datumPlate.pose();
      return least;
    });
    for (const [name, what] of [['ink', 'the ink'], ['soft', 'the sentences']]) assert.ok(worst[name].ratio >= 3.5, `As night falls and lifts ${what} stay readable on the paper (least ${worst[name].ratio.toFixed(2)} to 1, at ${worst[name].at.toFixed(2)})`);
    await atRest(desk, 'evening', 700);
    const night = await desk.$eval('[data-datum]', root => { const style = getComputedStyle(root); return { paper: style.getPropertyValue('--paper'), ink: style.getPropertyValue('--ink'), body: getComputedStyle(root.querySelector('[data-words="evening"] [data-fade]')).color }; });
    assert.ok(contrast(colourOf(night.body), colourOf(night.paper)) >= 4.5, `At night the words read on the blue sheet (${contrast(colourOf(night.body), colourOf(night.paper)).toFixed(1)} to 1)`);
    assert.ok(colourOf(night.paper)[2] > 150 && colourOf(night.paper)[0] < 80, 'And the sheet is the blue of the dusk sky');
    // The lights come on one room at a time. Which opening is which is the survey's to say: the tall one is
    // the glazed one, and the door has no light.
    const tallIndex = H.openings.findIndex(opening => opening.kind === 'glazed'), doorIndex = H.openings.findIndex(opening => opening.kind === 'door');
    let most = 0;
    for (const at of [8.1, 8.25, 8.42]) {
      await seek(desk, at, 700, ['duskoff', 'dusk']);
      const lit = await desk.$eval('[data-datum]', root => { const view = root.datumPlate.view; return root.datumPlate.survey.house.openings.map((_, index) => view[`lit${index}`]); });
      const on = lit.filter(value => value > 0.999).length, off = lit.filter((value, index) => value === 0 && index !== doorIndex).length;
      assert.ok(lit[tallIndex] > 0.999 && on > most && off >= 2 && lit[doorIndex] === 0, `At ${at} some rooms are lit and some are not, more than before, and the tall opening was first (${lit.join(' ')})`);
      most = on;
      // Every window is looked at, in the middle of its glass (the page says where that is on the screen): one
      // whose light is on glows, and one whose turn has not come is dark, whatever is lit beside or above it.
      const image = await shot(desk);
      const glass = await desk.$eval('[data-datum]', (root, middles) => { const plate = root.querySelector('[data-plate]').getBoundingClientRect(); return middles.map(middle => { if (!middle) return null; const p = root.datumPlate.at(...middle); return [p.x + plate.left, p.y + plate.top]; }); }, H.openings.map(opening => (opening.glass ? [opening.glass[0] + opening.glass[2] / 2, opening.glass[1] + opening.glass[3] / 2] : null)));
      const warmth = ([x, y]) => { let sum = 0, n = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const [r, , b] = pixel(image, x + dx, y + dy); sum += r - b; n++; } return sum / n; };
      H.openings.forEach((opening, index) => {
        if (!opening.glass) return;
        if (lit[index] > 0.999) assert.ok(warmth(glass[index]) > 30, `At ${at} opening ${index}'s light is on and it glows (${warmth(glass[index]).toFixed(0)})`);
        if (lit[index] === 0) assert.ok(warmth(glass[index]) < 10, `At ${at} opening ${index}'s turn has not come and it is still dark (${warmth(glass[index]).toFixed(0)}), whatever is lit beside it`);
      });
    }
  }
  // In through the tall opening: the room is seen through a window that grows from the opening's own glass.
  await seek(desk, 9.3, 800, ['dusk', 'ground']);
  moving = await desk.evaluate(layout);
  const room = moving.pictures.find(picture => picture.name === 'ground');
  assert.ok(room && room.left > moving.plate.left + 100 && room.right < moving.plate.right - 100 && room.top > moving.plate.top + 20 && Math.abs(room.bottom - moving.datum) < (moving.plate.bottom - moving.datum) * 0.5, `The room opens from the tall opening ${fmt(room)}`);
  // Along the line: between two buildings there is bare paper, and the datum goes on.
  await seek(desk, 18.0, 800, ['coast', 'studio']);
  moving = await desk.evaluate(layout);
  assert.deepEqual(moving.pictures.map(picture => picture.name), ['coast', 'studio'], 'Two buildings on the plate between two rests');
  assert.ok(moving.pictures[1].left - moving.pictures[0].right > 60, 'With paper between them');
  // What is said to be drawn is drawn. "Nothing half way at a rest" is true of a thing that is never half
  // way at all: every line of the drawing was once either not there or all there (its length was rounded
  // to a whole pixel of a length of one), so it came in at once and no rest could catch it. So the other
  // half is asked too: on its way, every line takes many lengths, and the windows the words on the line
  // move in take many widths. And once lines are really drawn, three more things can be wrong that could
  // not be seen while they were not: a pen that crosses the sheet in a notch of the wheel, a tick that is
  // there before its line has reached it, and a figure that does not say what its line has drawn so far.
  // The page is asked for all of it: where each tick's line crosses it (data-at), how long each line is,
  // how much of it is drawn, and what the figure reads.
  let pen;
  {
    await seek(desk, 1.2, 700, ['site']);
    const drawn = await desk.evaluate(() => {
      const root = document.querySelector('[data-datum]'), sheet = root.querySelector('[data-scroller]').clientHeight;
      const strokes = [...root.querySelectorAll('[data-drawing] [data-draw]')].filter(stroke => stroke.getAttribute('d'));
      const name = el => `${el.dataset.draw ?? el.dataset.pop} ${el.dataset.i ?? ''}`.trim();
      const totals = new Map(strokes.map(stroke => [stroke, stroke.getTotalLength()]));
      const share = stroke => 1 - parseFloat(getComputedStyle(stroke).strokeDashoffset) / Number(stroke.getAttribute('pathLength'));
      const shown = el => { const style = getComputedStyle(el); return style.visibility === 'hidden' ? 0 : Number(style.opacity); };
      const lengths = new Map(strokes.map(stroke => [stroke, new Set()])), last = new Map(), cuts = new Set(), rolls = new Set(), risen = new Set();
      const roll = root.querySelector('[data-roll="drawing"]'), heading = root.querySelector('[data-words="setout"] [data-line]');
      // Each tick, the line that makes it, and how far along that line the pen has to come to reach it.
      const lineOf = { 'len-tick': 'len', 'all-tick': 'all', 'rise-tick': 'rise' };
      const ticks = [...root.querySelectorAll('[data-drawing] [data-pop][data-at]')].filter(tick => tick.getAttribute('d') && lineOf[tick.dataset.pop]).map(tick => {
        const line = root.querySelector(`[data-drawing] [data-draw="${lineOf[tick.dataset.pop]}"]`), [x, y] = tick.dataset.at.split(' ').map(Number), start = line.getPointAtLength(0);
        return { tick, line, along: Math.hypot(x - start.x, y - start.y), reached: null, whole: null, ahead: null };
      });
      // Each figure that counts, the line it counts, and what it reads once that line is drawn.
      const number = el => Number(el.textContent.replace(/[^\d]/g, ''));
      const figures = [['len', 'all', 10], ['ridge', 'rise', 5]].map(([count, line, step]) => ({ count, step, el: root.querySelector(`[data-drawing] [data-count="${count}"]`), line: root.querySelector(`[data-drawing] [data-draw="${line}"]`), worst: 0, at: 0, seen: 0 })).filter(figure => figure.el && figure.line?.getAttribute('d'));
      root.datumPlate.pose(4.4);
      for (const figure of figures) figure.final = number(figure.el);
      let fastest = { rate: 0 };
      const STEP = 0.005;
      for (let at = 1.2; at <= 4.4 + 1e-6; at += STEP) {
        root.datumPlate.pose(at);
        for (const stroke of strokes) {
          const now = share(stroke), before = last.get(stroke);
          lengths.get(stroke).add(now.toFixed(2));
          if (before !== undefined) { const rate = (Math.abs(now - before) * totals.get(stroke)) / STEP / sheet; if (rate > fastest.rate) fastest = { rate, at, name: name(stroke) }; }
          last.set(stroke, now);
        }
        for (const item of ticks) {
          const there = getComputedStyle(item.line).visibility !== 'hidden' && share(item.line) * totals.get(item.line) >= item.along - 0.75, opacity = shown(item.tick);
          if (there && item.reached === null) item.reached = at;
          if (opacity > 0.02 && !there && item.ahead === null) item.ahead = at;
          if (opacity >= 0.99 && item.whole === null) item.whole = at;
        }
        for (const figure of figures) {
          if (shown(figure.el) < 0.5) continue;
          const out = Math.abs(number(figure.el) - share(figure.line) * figure.final);
          figure.seen++;
          if (out > figure.worst) { figure.worst = out; figure.at = at; }
        }
        rolls.add(new DOMMatrixReadOnly(getComputedStyle(roll).transform).m42.toFixed(1));
        risen.add(new DOMMatrixReadOnly(getComputedStyle(heading).transform).m42.toFixed(1));
      }
      for (let at = 20.7; at <= 21.1; at += 0.004) { root.datumPlate.pose(at); cuts.add(Number(getComputedStyle(root.querySelector('[data-last]')).getPropertyValue('--cut')).toFixed(2)); }
      root.datumPlate.pose();
      const popped = strokes.filter(stroke => lengths.get(stroke).size < 6).map(name);
      return { strokes: strokes.length, fewest: Math.min(...strokes.map(stroke => lengths.get(stroke).size)), popped, cuts: cuts.size, rolls: rolls.size, risen: risen.size, fastest,
        ticks: ticks.map(item => ({ name: name(item.tick), reached: item.reached, whole: item.whole, ahead: item.ahead })),
        figures: figures.map(figure => ({ count: figure.count, step: figure.step, final: figure.final, worst: figure.worst, at: figure.at, seen: figure.seen })) };
    });
    assert.ok(drawn.strokes >= 50, `The drawing has its lines (${drawn.strokes})`);
    assert.deepEqual(drawn.popped, [], `Every line of the drawing is drawn along its length, not put there at once (the fewest lengths any took on the way: ${drawn.fewest})`);
    assert.ok(drawn.cuts >= 6 && drawn.rolls >= 6 && drawn.risen >= 6, `The window of the words on the line, a title block entry and a heading all move through the places between (${drawn.cuts}, ${drawn.rolls} and ${drawn.risen} of them)`);
    // The pen. A line is a hair wide, and its tip may go faster than a photograph's edge; but not so fast
    // that a line across the house is over in a notch of the wheel (it was 13.8 before it was looked at).
    pen = drawn.fastest;
    assert.ok(pen.rate < 6.5, `The pen is not hurried: its fastest is ${pen.rate.toFixed(1)} sheet heights a screen (${pen.name}, at ${pen.at.toFixed(2)})`);
    // The ticks: seven on the bays' string, two on the whole length, three on the levels.
    assert.equal(drawn.ticks.length, 12, `The strings have their ticks, and each says where its line crosses it (${drawn.ticks.length})`);
    for (const tick of drawn.ticks) {
      assert.equal(tick.ahead, null, `${tick.name} is not there before its line has reached it (it was, at ${tick.ahead})`);
      assert.ok(tick.reached !== null && tick.whole !== null && tick.whole - tick.reached <= 0.03, `${tick.name} is there as the pen passes it (reached at ${tick.reached}, there at ${tick.whole})`);
    }
    // The figures: each reads what its line has drawn so far, to the 10 mm or 5 mm it is rounded to.
    assert.equal(drawn.figures.length, 2, 'The whole length and the ridge level are counted');
    for (const figure of drawn.figures) {
      assert.ok(figure.seen >= 20, `The ${figure.count} figure is read while it counts (${figure.seen} times)`);
      assert.ok(figure.worst <= figure.step / 2 + 1, `The ${figure.count} figure says what its line has drawn so far (out by ${figure.worst.toFixed(0)} mm of ${figure.final} at ${figure.at.toFixed(2)})`);
    }
  }
  // Words on the line and a photograph are never on the plate together, on the way either: the first words
  // have gone into the line before the site opens out of it, and the last come out of it only once the last
  // building has passed where they stand.
  for (const [from, to, wanted] of [[0, 1.1, ['site']], [19.85, 21.1, ['pavilion']]]) {
    await seek(desk, from, 700, wanted);
    for (let at = from; at <= to + 1e-6; at += 0.02) {
      const found = await desk.evaluate(at => {
        const root = document.querySelector('[data-datum]'), plate = root.querySelector('[data-plate]').getBoundingClientRect();
        root.datumPlate.pose(at);
        const pictures = root.datumPlate.boxes.map(b => ({ left: b.left + plate.left, right: b.right + plate.left, top: b.top + plate.top, bottom: b.bottom + plate.top }));
        const lines = [];
        for (const heading of root.querySelectorAll('[data-first], [data-last]')) {
          if (getComputedStyle(heading).visibility === 'hidden') continue;
          const window = heading.getBoundingClientRect(), foot = window.bottom - Number(getComputedStyle(heading).getPropertyValue('--cut') || 0) * 0.3725 * parseFloat(getComputedStyle(heading).fontSize);
          for (const line of heading.querySelectorAll('[data-line]')) { const r = line.getBoundingClientRect(), box = { left: r.left, right: r.right, top: Math.max(r.top, window.top), bottom: Math.min(r.bottom, foot) }; if (box.bottom - box.top > 1) lines.push(box); }
        }
        root.datumPlate.pose();
        return { pictures, lines };
      }, at);
      for (const line of found.lines) for (const picture of found.pictures) assert.ok(!overlap(line, picture), `At ${at.toFixed(2)} the words on the line ${fmt(line)} are not over a photograph ${fmt(picture)}`);
    }
  }
  console.log('moves: ok');

  // ---------- Pacing: how far the picture travels for a screen of scroll ----------
  {
    await seek(desk, 0, 500);
    const pace = await desk.evaluate(screens => {
      const root = document.querySelector('[data-datum]'), plate = root.datumPlate, stage = root.querySelector('[data-scroller]').clientHeight;
      const rates = [];
      let before = plate.pose(0);
      for (let at = 0.02; at <= screens + 1e-6; at += 0.02) {
        const now = plate.pose(at);
        let most = 0;
        for (let i = 0; i < now.length; i++) most = Math.max(most, Math.abs(now[i] - before[i]) / stage);
        rates.push([Number(at.toFixed(2)), most / 0.02]);
        before = now;
      }
      plate.pose();
      return rates;
    }, SCREENS);
    const fastest = pace.reduce((a, b) => (b[1] > a[1] ? b : a));
    // Each move's peak: the most sheet heights any edge of the picture crosses for a screen of scroll.
    const MOVES = { 'the site opens': [0.32, 1], 'tracing paper': [1.3, 2.12], 'the bays go up': [4.6, 5.75], 'the house comes down': [6.1, 6.95], 'in through the opening': [9.05, 9.95], 'up a floor': [10.3, 11.1], 'the room closes': [11.45, 12.02], 'samples': [12.02, 12.5], 'slate opens': [12.85, 13.55], 'lime opens': [13.9, 14.6], 'oak opens': [14.95, 15.65], 'oak closes': [16.0, 16.28], 'to the coast': [16.3, 17.2], 'to the studio': [17.55, 18.45], 'to the pavilion': [18.8, 19.7], 'off the end': [20.0, 20.9] };
    const peaks = Object.entries(MOVES).map(([name, [from, to]]) => [name, Math.max(...pace.filter(([at]) => at >= from && at <= to).map(([, rate]) => rate))]);
    const summary = `fastest ${fastest[1].toFixed(1)} sheet heights a screen, at ${fastest[0]}; peaks: ${peaks.map(([name, peak]) => `${name} ${peak.toFixed(1)}`).join(', ')}`;
    // The moves all peak between one and three. A move far outside that is one that was given too little scroll.
    assert.ok(fastest[1] < 3.4, `Nothing in the picture lurches (${summary})`);
    for (const rest of RESTS) {
      const near = pace.filter(([at]) => Math.abs(at - rest) <= 0.05).map(([, rate]) => rate);
      if (near.length) assert.ok(Math.max(...near) < 0.05, `A rest is still: ${rest} moves at ${Math.max(...near).toFixed(2)}`);
    }
    const large = peaks.filter(([name]) => !['samples', 'the room closes', 'oak closes'].includes(name)).map(([, peak]) => peak);
    assert.ok(Math.max(...large) / Math.min(...large) < 3.2, `The moves are of a kind (${summary})`);
    console.log(`pacing: ok (${summary}; the pen's fastest ${pen.rate.toFixed(1)}, on ${pen.name} at ${pen.at.toFixed(2)})`);
  }

  // ---------- Another way through: keys, the step buttons, the rail ----------
  await seek(desk, 0, 700);
  await desk.focus('[data-scroller]');
  await desk.keyboard.press('ArrowDown');
  await pause(2400);
  assert.ok(Math.abs((await place(desk)) - REST.site) < 0.03, `Arrow down goes on to the next rest (${(await place(desk)).toFixed(2)})`);
  await desk.keyboard.press('ArrowDown');
  await pause(3000);
  assert.ok(Math.abs((await place(desk)) - REST.setout) < 0.03, 'And on to the one after');
  roomy(await desk.evaluate(layout), 'after two steps');
  await desk.keyboard.press('ArrowUp');
  await pause(3000);
  assert.ok(Math.abs((await place(desk)) - REST.site) < 0.03, 'Arrow up goes back a rest');
  // A tap on a step button is one step; a hold plays until it is let go.
  const next = await desk.$('[data-step="1"]');
  const nextBox = await next.boundingBox();
  await desk.mouse.click(nextBox.x + nextBox.width / 2, nextBox.y + nextBox.height / 2);
  await pause(3000);
  assert.ok(Math.abs((await place(desk)) - REST.setout) < 0.03, 'A tap on the button goes on a rest');
  await desk.mouse.move(nextBox.x + nextBox.width / 2, nextBox.y + nextBox.height / 2);
  await desk.mouse.down();
  await pause(2600);
  const held = await place(desk);
  await desk.mouse.up();
  assert.ok(held > REST.setout + 0.5, `A hold plays on (${held.toFixed(2)})`);
  await pause(1700);
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
  assert.ok((await place(desk)) < 0.5, 'A wheel takes the page back from a step');
  // The rail goes to a chapter's first rest.
  await desk.$$eval('[data-rail-item]', items => items[5].click());
  await pause(3600);
  assert.ok(Math.abs((await place(desk)) - REST.board) < 0.03, `The rail goes to the materials (${(await place(desk)).toFixed(2)})`);
  assert.equal(await desk.$$eval('[data-rail-item]', items => items.findIndex(item => item.getAttribute('aria-current') === 'true')), 5, 'And marks the chapter');
  await desk.waitForFunction(() => ['slate', 'lime', 'oak'].every(id => document.querySelector('[data-datum]').datumPlate.ready(id)), { timeout: 20000 });
  await pause(200);
  roomy(await desk.evaluate(layout), 'after the rail');
  // Home and End go to the ends.
  await desk.focus('[data-scroller]');
  await desk.keyboard.press('End');
  await pause(3200);
  assert.ok((await place(desk)) > SCREENS - 0.02, 'End goes to the last sheet');
  assert.equal(await desk.$eval('[data-pager]', pager => pager.dataset.end), 'bottom', 'Where the step on has nowhere to go');
  // Keyboard focus can be seen.
  await desk.keyboard.press('Tab');
  const focused = await desk.evaluate(() => { const element = document.activeElement, style = getComputedStyle(element); return { tag: element.tagName, text: element.textContent.trim(), outline: style.outlineStyle, width: parseFloat(style.outlineWidth) }; });
  assert.ok(focused.tag === 'BUTTON' && focused.outline !== 'none' && focused.width >= 2, `Tab reaches a button and shows where it is (${focused.text}: ${focused.outline} ${focused.width}px)`);
  console.log('keys, step buttons and rail: ok');

  // ---------- The last sheet: what this is, and the ways on ----------
  await atRest(desk, 'start', 800);
  assert.match(await desk.$eval('[data-words="start"] [data-fade]', el => el.textContent), /^Datum is a concept\. The practice and its buildings do not exist, and every photograph here was generated\.$/, 'The last sheet says what this is, and nothing else');
  // The site stands on its own. Everything inside its own root is read (text, labels, alternative text,
  // addresses): it says it is a concept, and it names, credits and links to nobody. Not the whole
  // document: the host's layout has the host's name in its head.
  {
    const own = await desk.$eval('[data-datum]', root => ({ text: root.textContent, html: root.outerHTML, links: [...root.querySelectorAll('a[href], [href], form[action]')].map(link => link.outerHTML.slice(0, 120)) }));
    assert.match(own.text, /Datum is a concept\. The practice and its buildings do not exist, and every photograph here was generated\./, 'The site says it is a concept');
    assert.match(own.text, /Concept practice/, 'And says so in the bar');
    assert.doesNotMatch(own.text, /akella|inmotion/i, 'Nothing a visitor can read in the site names the studio');
    assert.doesNotMatch(own.html, /akella|inmotion/i, 'Nor does anything else in it: no label, no alternative text, no address');
    assert.doesNotMatch(own.text, /built by|made by|built it|built to show|gsap/i, 'It carries no credit, and does not say what it was built to show');
    assert.deepEqual(own.links, [], 'And it links to nowhere');
  }
  assert.deepEqual(await desk.$$eval('[data-last] [data-line]', lines => lines.map(line => line.textContent)), ['Yours starts', 'the same way.']);
  await desk.click('[data-replay]');
  await pause(3400);
  assert.ok((await place(desk)) < 0.05, 'Watch it again goes back to the start');
  roomy(await desk.evaluate(layout), 'after watching it again');
  // The page scrolled an element of its own, never the document.
  assert.equal(await desk.evaluate(() => window.__writes), 0, 'Nothing wrote to the document scroll');
  assert.equal(await desk.evaluate(() => window.scrollY), 0, 'The document did not scroll');
  // "Start a project" is the site's own call to action, and what it does is for whoever hosts the page to
  // decide. This host gives it nothing to do, so it does nothing: it does not leave the page, it does not
  // move it, and it does not stand in for Close. Close is the host's, and goes back to the site.
  await atRest(desk, 'start', 800);
  {
    const state = async () => ({ path: await desk.evaluate(() => location.pathname + location.hash), place: await place(desk), pages: (await browser.pages()).length });
    const was = await state();
    await desk.click('[data-words="start"] [data-enquire]');
    await pause(900);
    const is = await state();
    assert.equal(await desk.$eval('[data-words="start"] [data-enquire]', button => button.textContent), 'Start a project', 'The call to action reads as the practice\'s own');
    assert.equal(is.path, '/gallery/gsap/datum', `Start a project does not leave the page (${is.path})`);
    assert.ok(Math.abs(is.place - was.place) < 0.01 && is.pages === was.pages, 'Nor move it, nor open another');
    assert.equal(await desk.evaluate(() => window.__writes), 0, 'Nor write to the document scroll');
  }
  await Promise.all([desk.waitForFunction(() => location.pathname === '/gallery/gsap', { timeout: 15000 }), desk.click('button[aria-label="Exit preview"]')]);
  console.log('the last sheet, and leaving: ok');
  await desk.close();

  // ---------- Window sizes: words and picture keep their rooms everywhere ----------
  if (!quick) await sweepWide(browser);

  // ---------- A phone: the same three rows, and a walk up to the house ----------
  const phone = await browser.newPage();
  watchPage(phone, 'phone');
  await phone.evaluateOnNewDocument(instrument);
  await phone.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await enter(phone);
  assert.equal(await phone.$eval('[data-datum]', root => root.dataset.shape), 'tall');
  const phoneSaid = {};
  for (const name of Object.keys(REST)) {
    await atRest(phone, name, 750);
    const found = await phone.evaluate(layout);
    roomy(found, `phone ${name}`);
    phoneSaid[name] = found;
    assert.deepEqual([...new Set(found.pictures.map(picture => picture.name))].sort(), [...ON_PLATE[name]].sort(), `On a phone, at ${name} the plate holds ${ON_PLATE[name].join(', ') || 'nothing'}`);
  }
  assert.equal(phoneSaid.line.stageVar, '844px');
  assert.equal(new Set(phoneSaid.line.onLine.map(line => Math.round(line.top))).size, 2, 'On a phone the first words are two lines');
  assert.equal(new Set(Object.values(phoneSaid).map(found => Math.round(found.datum))).size, 1, 'The datum is at the same height at every rest');
  // It sees the house whole while it is drawn and built, and from close by once it is finished.
  const whole = Number(phoneSaid.drawing.scale.split(':')[1]), near = Number(phoneSaid.building.scale.split(':')[1]);
  assert.ok(near < whole * 0.6 && phoneSaid.evening.scale === phoneSaid.building.scale && phoneSaid.structure.scale === phoneSaid.drawing.scale, `A phone walks up to the finished house (${phoneSaid.drawing.scale} to ${phoneSaid.building.scale})`);
  const ends = await phone.$eval('[data-datum]', root => { const plate = root.datumPlate, house = plate.survey.house, cams = plate.cameras(), width = plate.layout().width; const at = cam => [width / 2 + (house.left - cam.fx) * cam.s, width / 2 + (house.right - cam.fx) * cam.s]; return { whole: at(cams.overview), near: at(cams.close), width }; });
  assert.ok(ends.whole[0] > 30 && ends.whole[1] < ends.width - 30, `Seen whole, the house has the sheet's margins either side (${ends.whole.map(Math.round).join(' to ')})`);
  assert.ok(ends.near[0] < 0 && ends.near[1] > ends.width, 'From close by it runs off both sides of the plate, as a photograph would');
  assert.deepEqual(await edgesOfTheCloseView(phone), [], 'And no opening is left as a sliver at the plate\'s side');
  // The cue names the finger.
  await seek(phone, 0, 800);
  assert.match(await phone.$$eval('[data-cue]', cues => cues.filter(cue => getComputedStyle(cue).display !== 'none').map(cue => [...cue.children].filter(child => getComputedStyle(child).display !== 'none').map(child => child.textContent).join(' ')).join('|')), /^Swipe, or tap\s+to set it out$/, 'One cue, for a finger');
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
  assert.ok(Math.abs((await place(phone)) - REST.site) < 0.03, `A tap goes on to the next rest (${(await place(phone)).toFixed(2)})`);
  // A toolbar changing the window's height changes nothing on the sheet.
  await atRest(phone, 'drawing', 800);
  const steady = () => phone.evaluate(() => { const root = document.querySelector('[data-datum]'), top = selector => root.querySelector(selector).getBoundingClientRect().top; return { stage: root.style.getPropertyValue('--stage'), canvas: [root.querySelector('[data-plate]').width, root.querySelector('[data-plate]').height], datum: top('[data-datum-line]'), words: top('[data-words="drawing"]'), wall: root.querySelector('[data-drawing] [data-draw="wall"]').getBoundingClientRect().toJSON(), block: top('[data-block]'), camera: root.datumPlate.camera() }; });
  const before = await steady();
  await phone.setViewport({ width: 390, height: 758, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await pause(700);
  const after = await steady();
  assert.equal(after.stage, '844px', 'A moving toolbar does not resize the sheet');
  assert.deepEqual(after.canvas, before.canvas, 'Nor redraw the plate at another size');
  assert.deepEqual(after.camera, before.camera, 'Nor move the camera');
  assert.ok(Math.abs(after.datum - before.datum) < 0.5 && Math.abs(after.words - before.words) < 0.5 && Math.abs(after.block - before.block) < 0.5 && Math.abs(after.wall.x - before.wall.x) < 0.5 && Math.abs(after.wall.y - before.wall.y) < 0.5, 'Nor move the datum, the drawing or the words');
  assert.equal(await phone.evaluate(() => window.__writes), 0, 'Nothing wrote to the document scroll on the phone');
  await phone.close();
  console.log(`phone: ok (${phoneSaid.drawing.scale}, then ${phoneSaid.building.scale})`);

  if (!quick) await sweepTall(browser);

  // ---------- Reduced motion ----------
  {
    const page = await browser.newPage();
    watchPage(page, 'reduced motion');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await page.goto(route, { waitUntil: 'networkidle2' });
    await page.waitForSelector('[data-datum][data-entered="true"]', { timeout: 30000 });
    await pause(300);
    const lifted = await page.$eval('[data-first] [data-lift]', lift => new DOMMatrixReadOnly(getComputedStyle(lift).transform).m42);
    assert.ok(Math.abs(lifted) < 0.5, 'The first words are in place at once');
    assert.equal(await page.$eval('[data-cue] > i', el => getComputedStyle(el).animationName), 'none', 'Nothing nods');
    await atRest(page, 'drawing', 300);
    assert.ok(Math.abs((await place(page)) - REST.drawing) < 0.01, 'The page still scrolls');
    roomy(await page.evaluate(layout), 'reduced motion, the drawing');
    await page.keyboard.press('ArrowDown');
    await pause(500);
    assert.ok(Math.abs((await place(page)) - REST.structure) < 0.03, 'A step is a jump, not a glide');
    await page.close();
    console.log('reduced motion: ok');
  }

  // ---------- No JavaScript: a plain page, read from top to bottom ----------
  {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await page.goto(route, { waitUntil: 'networkidle2' });
    assert.equal(await page.$eval('[data-veil]', el => getComputedStyle(el).display), 'none', 'No veil without JavaScript');
    const poster = await page.$eval('[data-poster]', img => ({ shown: getComputedStyle(img).display !== 'none' && getComputedStyle(img).visibility === 'visible', loaded: img.complete && img.naturalWidth > 1000, wide: img.getBoundingClientRect().width }));
    assert.ok(poster.shown && poster.loaded && poster.wide > 600, 'The finished house is shown as a photograph');
    const read = await page.$$eval('[data-words]', blocks => blocks.map(block => { const r = block.getBoundingClientRect(), style = getComputedStyle(block); return { name: block.dataset.words, shown: style.visibility === 'visible' && style.display !== 'none' && r.height > 20, top: r.top + document.querySelector('[data-scroller]').scrollTop, lines: [...block.querySelectorAll('[data-line]')].every(line => Math.abs(new DOMMatrixReadOnly(getComputedStyle(line).transform).m42) < 0.5) }; }));
    assert.equal(read.length, 17); assert.ok(read.every(block => block.shown && block.lines), 'Every scene can be read');
    assert.ok(read.every((block, index) => index === 0 || block.top > read[index - 1].top + 20), 'One under another, in order');
    assert.equal(await page.$eval('[data-first]', el => getComputedStyle(el).visibility), 'visible', 'With the headline at the top');
    const reach = await page.$eval('[data-scroller]', scroller => ({ scrolls: scroller.scrollHeight > scroller.clientHeight + 200, last: scroller.querySelector('[data-words="start"]').textContent }));
    assert.ok(reach.scrolls, 'The page scrolls'); assert.match(reach.last, /Datum is a concept/, 'Down to what it is');
    // (Read this way too, the site names nobody: what is on the page without scripts is what the server sent.)
    assert.doesNotMatch(await page.$eval('[data-datum]', root => root.outerHTML), /akella|inmotion/i, 'Nothing in the site names the studio without JavaScript either');
    await page.close();
    console.log('no JavaScript: ok');
  }

  // ---------- Older engines: the whole page, with attribute names validated the older way ----------
  for (const [label, viewport] of [['desktop', { width: 1280, height: 800, deviceScaleFactor: 1 }], ['phone', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    const page = await browser.newPage();
    watchPage(page, `older engine ${label}`);
    await page.evaluateOnNewDocument(older);
    await page.setViewport(viewport);
    await enter(page);
    for (let at = 0; at <= SCREENS; at += 0.35) await seek(page, at, 130);
    await atRest(page, 'start', 600);
    roomy(await page.evaluate(layout), `older engine ${label}, the last sheet`);
    await page.$eval('[data-replay]', button => button.click());
    await pause(900);
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
    // Everything fetched first, as it would be for someone reading at reading pace: this is about drawing, not the network.
    for (const name of Object.keys(REST)) await atRest(page, name, 260);
    await seek(page, 0, 900);
    await page.evaluate(() => { window.__frames = []; let last = performance.now(); const tick = now => { window.__frames.push(now - last); last = now; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    const cdp = await page.target().createCDPSession();
    for (let moved = 0; moved < (SCREENS + 0.5) * 900; moved += 60) { await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 450, deltaX: 0, deltaY: 60 }); await pause(12); }
    await pause(1200);
    const frames = (await page.evaluate(() => window.__frames)).slice(10);
    const long = frames.filter(ms => ms > 50).length;
    assert.ok((await place(page)) > SCREENS - 0.05, 'The wheel reaches the end');
    assert.ok(long <= 3, `No stalls while scrolling through (${long} frames over 50ms of ${frames.length})`);
    await page.close();
    console.log(`playback: ok (${frames.length} frames, ${long} over 50ms)`);
  }
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
      await page.waitForSelector('[data-datum][data-entered="true"]', { timeout: 30000 });
      await pause(600);
      assert.equal(await page.$eval('[data-datum]', root => root.dataset.shape), label === 'phone' ? 'tall' : 'wide');
      const scale = label === 'phone' ? 2 : 1;
      for (const [name, at] of Object.entries(REST)) {
        await page.evaluate(at => { const scroller = document.querySelector('[data-datum] [data-scroller]'); scroller.scrollTop = at * scroller.clientHeight; }, at);
        await pause(700);
        if (ON_PLATE[name].length) { await page.waitForFunction(ids => ids.every(id => document.querySelector('[data-datum]').datumPlate.ready(id)), ON_PLATE[name], { timeout: 20000 }); await pause(200); }
        const found = await page.evaluate(layout);
        roomy(found, `webkit ${label} ${name}`);
        assert.deepEqual([...new Set(found.pictures.map(picture => picture.name))].sort(), [...ON_PLATE[name]].sort(), `WebKit ${label}: at ${name} the plate holds ${ON_PLATE[name].join(', ') || 'nothing'}`);
        if (name === 'drawing' || name === 'building' || name === 'evening') {
          // The picture is really there: ink where the drawn wall is, white lime by day and warm light at night where the house is.
          const { data, info } = await sharp(await page.screenshot({ type: 'png' })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
          const image = { data, width: info.width, height: info.height, scale };
          // Where to look is asked of the page: a stretch of wall clear of every opening, the middle of the tall opening's glass, the west end of the wall.
          const house = survey.house, [gx, gy, gw, gh] = house.openings.find(opening => opening.kind === 'glazed').glass;
          // (Playwright hands a page function one argument: the three places go in one object.)
          const spot = await page.$eval('[data-datum]', (root, places) => { const plate = root.querySelector('[data-plate]').getBoundingClientRect(); return Object.fromEntries(Object.entries(places).map(([name, [mx, my]]) => { const p = root.datumPlate.at(mx, my); return [name, [plate.left + p.x, plate.top + p.y]]; })); }, { wall: clearWall(house), glass: [gx + gw / 2, gy + gh / 2], end: [house.left, (house.eaves + house.ground) / 2] });
          if (name === 'drawing') { let ink = 255; for (let dx = -3; dx <= 3; dx += 0.5) ink = Math.min(ink, lumaOf(pixel(image, (spot.end[0] + dx) * scale, spot.end[1] * scale))); assert.ok(ink < 120, `WebKit ${label}: the wall is drawn in ink (${Math.round(ink)})`); }
          if (name === 'building') assert.ok(lumaOf(pixel(image, spot.wall[0] * scale, spot.wall[1] * scale)) > 190, `WebKit ${label}: white lime where the wall is`);
          if (name === 'evening') { const [r, , b] = pixel(image, spot.glass[0] * scale, spot.glass[1] * scale); assert.ok(r - b > 40, `WebKit ${label}: warm light in the tall opening`); }
        }
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
console.log(process.env.ONLY ? `Datum: ${process.env.ONLY} passed (not a whole run)` : quick ? 'Datum: all checks passed (the window-size sweeps were skipped: QUICK=1)' : 'Datum: all checks passed');
