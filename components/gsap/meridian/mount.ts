// Wires the Meridian page together once its markup is in the page: the scroll director, the map and its
// camera, the console (the count, the bars, the scale, the ruler), the words and the entrance. React only
// renders the markup and calls this; nothing in here needs React, so the folder can be used somewhere
// else as it is.

import gsap from 'gsap';
import { createDirector, type Shape } from './director';
import { cameraAt, stops, type Stop } from './camera';
import { createMap, lane, loadMapData, path, seaway, type MapData, type MapEngine, type Path } from './map/engine';
import { lonLat, metres, metresPerPixel, place } from './map/geo';
import { pathAt } from './map/engine';
import { AFTER, BEFORE, GONE, buildWords } from './timeline';
import { DAYS, HUBS, PLACES, SEAWAY, barOf, brand, coordinates, events, levels, scaleOf, search, spanOf, thousands } from './content';
import { LEVELS, RESTS, SCORE, SCREENS, along, glide } from './score';

/** What the note by the parcel says, from each scale on. Before the first of them it counts the days of the journey. */
const NOTES: [number, string][] = [[LEVELS[1].rest - 0.6, '33 days from Shenzhen'], [LEVELS[2].rest - 0.6, 'Feeder ship, 38 h'], [LEVELS[3].rest - 0.6, 'Off the ship 05:12'], [LEVELS[4].rest - 0.6, `${brand.van}, stop 41 next`], [LEVELS[5].rest - 0.6, `${brand.van}, due 14:02`]];
/** How far along the sea route each place in DAYS is, in metres. */
const MILESTONES = (() => {
  const upTo = [0];
  for (let i = 1; i < SEAWAY.length; i++) upTo.push(upTo[i - 1] + metres(place(...SEAWAY[i - 1]), place(...SEAWAY[i])));
  return DAYS.map(([index, day]) => ({ sailed: upTo[index], day }));
})();
/** The day of its journey the parcel is on, so many metres along its way. */
function dayAt(sailed: number): number {
  for (let i = 1; i < MILESTONES.length; i++) {
    const a = MILESTONES[i - 1], b = MILESTONES[i];
    if (sailed <= b.sailed) return Math.round(a.day + (b.day - a.day) * Math.max(0, (sailed - a.sailed) / (b.sailed - a.sailed)));
  }
  return MILESTONES[MILESTONES.length - 1].day;
}

export function mountMeridian(root: HTMLElement): () => void {
  const one = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector);
  const all = <T extends HTMLElement = HTMLElement>(selector: string) => Array.from(root.querySelectorAll<T>(selector));
  const scroller = one('[data-scroller]')!, track = one('[data-track]')!;
  const canvas = one<HTMLCanvasElement>('[data-map]')!, waybill = one('[data-waybill]')!, furniture = one('[data-furniture]')!;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cleanups: (() => void)[] = [];
  const listen = (target: EventTarget | null | undefined, type: string, handler: (event: never) => void, options?: AddEventListenerOptions) => {
    if (!target) return;
    target.addEventListener(type, handler as EventListener, options);
    cleanups.push(() => target.removeEventListener(type, handler as EventListener, options));
  };

  const director = createDirector(root, scroller);
  const words = buildWords(root);
  let at = 0, shape: Shape = director.shape, dirty = true, alive = true;

  // ---------- The console's room ----------
  // The words come first. What gives way to them is measured, and the stylesheet reads the answer from the
  // root. In the order it goes: the time chart, the bars, the label's small print (its fields, the line
  // that says how to go on, the barcode's row; on a tall stage the search, which is its first line there),
  // and last, on a wide stage with very little height, the search and then the name. A guess from the
  // window's size leaves gaps between its thresholds; a measurement does not.
  // Two screens say more than the others and are measured by themselves: the door (on a tall stage the
  // proof of delivery is in the console there) and the last one.
  const DROPS = ['', 'time', 'time states', 'time states small', 'time states small search', 'time states small search head'];
  const GROUPS = ['time', 'states', 'small', 'search', 'head'];
  const says = one('[data-says]'), blocks = all('[data-words]');
  const drops = { film: '', door: '', last: '' };
  /** While the door's words are on the stage, and from where the last ones arrive. */
  const DOOR = [LEVELS[6].rest - BEFORE - 0.02, LEVELS[6].rest + AFTER + GONE], LAST = LEVELS[7].rest - BEFORE - 0.02;
  const fitConsole = () => {
    if (!says || blocks.length < LEVELS.length) return;
    const fits = (which: HTMLElement[]) => { const room = says.clientHeight; return which.every(block => block.offsetHeight <= room); };
    /** How much has to go for these words to fit: the first of DROPS that does it, looking from `from` on. */
    const least = (which: HTMLElement[], from: number, upTo = DROPS.length - 1) => {
      let index = from;
      for (; index < upTo; index++) { root.dataset.drop = DROPS[index]; if (fits(which)) break; }
      root.dataset.drop = DROPS[index];
      return index;
    };
    const block = (id: string) => blocks.filter(candidate => candidate.dataset.words === id);
    const film = least(blocks.filter(candidate => candidate.dataset.words !== 'door' && candidate.dataset.words !== 'all'), 0, 3);
    drops.film = DROPS[film];
    drops.door = DROPS[least(block('door'), film)];
    drops.last = DROPS[least(block('all'), film)];
    root.dataset.drop = dropAt();
  };
  /** What has given way at this place in the score. */
  const dropAt = () => (at >= LAST ? drops.last : at >= DOOR[0] && at < DOOR[1] ? drops.door : drops.film);
  const showing: Record<string, string> = {};
  /** Shows what has given way, and fades what is about to (or has just come back). */
  const giveWay = () => {
    const drop = dropAt();
    if (root.dataset.drop !== drop) root.dataset.drop = drop;
    for (const group of GROUPS) {
      const forDoor = drops.door.includes(group) && !drops.film.includes(group) ? along(at, DOOR[0] - 0.24, DOOR[0] - 0.04) * (1 - along(at, DOOR[1], DOOR[1] + 0.2)) : 0;
      const forLast = drops.last.includes(group) && !drops.film.includes(group) ? along(at, LAST - 0.24, LAST - 0.04) : 0;
      const see = (1 - Math.max(forDoor, forLast)).toFixed(3);
      if (showing[group] !== see) { showing[group] = see; root.style.setProperty(`--see-${group}`, see); }
    }
  };

  // ---------- The map ----------
  let data: MapData | null = null, map: MapEngine | null = null, journey: Path | null = null, where: Record<string, Stop> | null = null;
  // Where the map's own room is on its canvas: all of it on a tall stage; right of the console on a wide one.
  const room = { width: 1, height: 1, left: 0, shorter: 1, shiftX: 0 };
  // On a wide stage the proof of delivery lies on the map, at its right, and at the door the camera puts the
  // stop in the middle of what the card leaves free: `beside` is how far the picture's middle moves for
  // that, in shares of half the canvas. (On a tall stage the proof is in the console, and the map is all
  // the door's.)
  const proofCard = one('[data-proof]');
  let beside = 0;
  // On a tall stage the cards that say what the software did lie along the top of the map. While one can be
  // up (in Dublin) the picture's middle is the middle of what is left under them: `under` is how far it moves
  // down for that, in shares of half the canvas.
  const cards = all('[data-update]');
  let under = 0;
  const fit = () => {
    fitConsole();
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    const base = canvas.getBoundingClientRect();
    const left = shape === 'wide' ? waybill.getBoundingClientRect().right - base.left + 8 : 0;
    Object.assign(room, { width, height, left, shorter: Math.min(width - left, height), shiftX: left / width });
    // The card's place as laid out: GSAP's own move of it is left out of this.
    const lies = furniture.getBoundingClientRect();
    beside = shape === 'wide' && proofCard ? (lies.left - base.left + proofCard.offsetLeft - 12 - width) / width : 0;
    under = shape === 'tall' && cards.length ? -(lies.top - base.top + Math.max(...cards.map(card => card.offsetTop + card.offsetHeight)) + 8) / height : 0;
    map?.resize(width, height);
  };
  const ready = loadMapData(brand.assets).then(loaded => {
    if (!alive) return;
    data = loaded;
    const door: [number, number] = [loaded.stops[loaded.followed].lon, loaded.stops[loaded.followed].lat];
    // The run's own middle, for the scale at which all of it is in the picture.
    const middle = lonLat(pathAt({ shape: loaded.run, along: runLengths(loaded), length: loaded.runMetres }, loaded.stops[loaded.followed].metres * 0.55));
    where = stops(door, middle);
    journey = path(seaway(SEAWAY));
    const lanes = [];
    for (let i = 0; i < HUBS.length; i++) for (let j = i + 1; j < HUBS.length; j++) if ((i * 7 + j * 13) % 5 === 0) lanes.push(lane(HUBS[i], HUBS[j], i * 31 + j));
    map = createMap(canvas, loaded, { labels: PLACES, lanes, font: "'Overpass', 'Helvetica Neue', Arial, sans-serif", door, maxRatio: fine ? 2 : 2.5 });
    // At the door the picture is of the stop and the building together: it looks between them.
    const building = map.doorPlace;
    if (building) where.door = { ...where.door, lon: (door[0] + building[0]) / 2, lat: (door[1] + building[1]) / 2 };
    fit();
    dirty = true;
  });
  /** The run's length up to each of its points, in metres. */
  const runLengths = (loaded: MapData) => {
    const { xyz, count } = loaded.run, lengths = new Float64Array(count);
    for (let i = 1; i < count; i++) { const d = Math.acos(Math.max(-1, Math.min(1, xyz[i * 3 - 3] * xyz[i * 3] + xyz[i * 3 - 2] * xyz[i * 3 + 1] + xyz[i * 3 - 1] * xyz[i * 3 + 2]))); lengths[i] = lengths[i - 1] + d * 6371008.8; }
    return lengths;
  };

  // ---------- The console ----------
  const countEl = one('[data-count]'), scaleEl = one('[data-scale]'), centreEl = one('[data-centre]');
  const stateRows = all('[data-state]'), stateBars = all('[data-state-bar]'), stateCounts = all('[data-state-count]');
  const barLine = one('[data-scalebar-line]'), barText = one('[data-scalebar-text]');
  const note = one('[data-note]'), noteText = one('[data-note-text]');
  const railItems = all('[data-rail-item]'), pager = one('[data-pager]');
  const rulerCanvas = one<HTMLCanvasElement>('[data-ruler-canvas]'), rulerTitle = one('[data-ruler-title]');
  const searchEl = one('[data-search]'), typedEl = one('[data-typed]'), pill = one('[data-pill]'), pillState = one('[data-pill-state]');
  const shown = { count: '', scale: '', centre: '', bar: '', note: '', span: '', mine: -1, typed: -1, found: '', state: '' };
  /** How far the note stands from its point, and how wide it is now (measured when its words change). */
  const NOTE_GAP = 14;
  let noteWidth = 0;
  /** Between which two scales the page is, and how far from the first to the second (as the camera moves). */
  const between = () => {
    for (let i = 0; i < LEVELS.length - 1; i++) {
      const next = LEVELS[i + 1];
      const [a, b] = next.id === 'all' ? [SCORE.out[0], SCORE.out[1]] : [LEVELS[i].rest + 0.25, next.rest - 0.15];
      if (at < b) return { from: i, to: i + 1, t: glide(along(at, a, b)) };
    }
    return { from: LEVELS.length - 1, to: LEVELS.length - 1, t: 0 };
  };
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  const grow = (a: number, b: number, t: number) => Math.exp(mix(Math.log(a), Math.log(b), t));

  const drawRuler = (minutes: number) => {
    if (!rulerCanvas) return;
    const width = rulerCanvas.clientWidth, height = rulerCanvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (rulerCanvas.width !== Math.round(width * ratio)) { rulerCanvas.width = Math.round(width * ratio); rulerCanvas.height = Math.round(height * ratio); }
    const ctx = rulerCanvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const axis = height - 15, right = width - 1;
    const x = (before: number) => right - (before / minutes) * (right - 1);
    // Ticks a round length of time apart: the smallest that leaves them room.
    const STEPS = [1, 5, 15, 60, 180, 360, 720, 1440, 2880, 7200, 14400];
    const step = STEPS.find(candidate => (candidate / minutes) * width >= 40) ?? STEPS[STEPS.length - 1];
    ctx.strokeStyle = '#101820'; ctx.fillStyle = '#55626c'; ctx.lineWidth = 1;
    ctx.font = "500 10px 'Overpass Mono', ui-monospace, monospace"; ctx.textBaseline = 'top';
    ctx.beginPath(); ctx.moveTo(0, axis + 0.5); ctx.lineTo(width, axis + 0.5); ctx.stroke();
    ctx.beginPath();
    for (let before = 0; before <= minutes; before += step) { const px = Math.round(x(before)) + 0.5; ctx.moveTo(px, axis - 4); ctx.lineTo(px, axis + 1); }
    ctx.stroke();
    ctx.textAlign = 'center';
    for (let before = step; before <= minutes; before += step) {
      const px = x(before);
      if (px < 16) break;
      ctx.fillText(step >= 1440 ? `${before / 1440} d` : step >= 60 ? `${before / 60} h` : `${before} min`, px, axis + 4);
    }
    ctx.textAlign = 'right'; ctx.fillStyle = '#d6007e'; ctx.fillText(brand.delivered, right, axis + 4);
    // What happened to the parcel, where there is room to say it.
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    let free = -Infinity;
    for (const event of [...events].reverse().filter(event => event.minutes <= minutes).reverse()) {
      const px = x(event.minutes);
      ctx.fillStyle = '#d6007e'; ctx.beginPath(); ctx.arc(px, axis + 0.5, 2.6, 0, Math.PI * 2); ctx.fill();
      const text = event.text, wide = ctx.measureText(text).width;
      const start = Math.min(px + 5, right - wide);
      if (start >= free && start >= 0) { ctx.fillStyle = '#101820'; ctx.fillText(text, start, axis - 8); free = start + wide + 10; }
    }
  };

  const follow = () => {
    const { from, to, t } = between();
    const a = levels[from], b = levels[to];
    // How many parcels are in the picture: it narrows as the scale does.
    const count = thousands(Math.round(grow(a.count, b.count, t)));
    if (countEl && count !== shown.count) { shown.count = count; countEl.textContent = count; }
    stateRows.forEach((row, index) => {
      const share = mix(a.states[index] / a.count, b.states[index] / b.count, t), value = Math.round(mix(a.states[index], b.states[index], t));
      stateBars[index]?.style.setProperty('--share', share.toFixed(4));
      const text = thousands(value);
      if (stateCounts[index] && stateCounts[index].textContent !== text) stateCounts[index].textContent = text;
    });
    // The search: the parcel's number is typed into it as the page starts to scroll, and taken out again on
    // the way back out. Between the two it says what state the parcel it found is in.
    const typed = Math.round(brand.parcel.length * (along(at, SCORE.search[0], SCORE.search[1]) - along(at, SCORE.cleared[0], SCORE.cleared[1])));
    if (typedEl && typed !== shown.typed) { shown.typed = typed; typedEl.textContent = brand.parcel.slice(0, typed); searchEl?.toggleAttribute('data-typing', typed > 0); }
    const found = (along(at, SCORE.search[1] + 0.02, SCORE.search[1] + 0.1) * (1 - along(at, SCORE.cleared[0] - 0.12, SCORE.cleared[0] - 0.02))).toFixed(3);
    if (pill && found !== shown.found) { shown.found = found; pill.style.setProperty('--found', found); }
    const state = at >= SCORE.proof[0] ? search.done : search.out;
    if (pill && pillState && state !== shown.state) { shown.state = state; pillState.textContent = state; pill.toggleAttribute('data-done', state === search.done); }
    // The state this parcel is in: out for delivery, until it is delivered.
    const mine = at >= SCORE.proof[0] ? 4 : 3;
    if (mine !== shown.mine) { shown.mine = mine; stateRows.forEach((row, index) => row.toggleAttribute('data-mine', index === mine)); }
    const minutes = grow(a.minutes, b.minutes, t), span = spanOf(minutes);
    drawRuler(minutes);
    if (rulerTitle && span !== shown.span) { shown.span = span; rulerTitle.textContent = span; }
    railItems.forEach((item, index) => {
      const start = LEVELS[index].from, end = LEVELS[index].to;
      item.setAttribute('aria-current', String(at >= start - 0.0005 && (at < end || index === LEVELS.length - 1)));
      item.style.setProperty('--fill', along(at, start, end).toFixed(3));
    });
    if (pager) pager.dataset.end = at <= 0.002 ? 'top' : at >= SCREENS - 0.002 ? 'bottom' : '';
    // From where the last words arrive (the checks read this).
    const last = String(at >= LAST);
    if (root.dataset.last !== last) root.dataset.last = last;
    giveWay();
    // The note by the parcel: the day of its journey while that is drawn, then what each scale has to say.
    const sailed = journey ? journey.length * glide(along(at, SCORE.journey[0], SCORE.journey[1])) : 0, days = MILESTONES[MILESTONES.length - 1].day;
    const text = [...NOTES].reverse().find(([from]) => at >= from)?.[1] ?? `Day ${dayAt(sailed)} of ${days}`;
    if (noteText && text !== shown.note) { shown.note = text; noteText.textContent = text; noteWidth = 0; }
  };

  // ---------- One loop: the scroll's place, then whatever runs in its own time ----------
  let raf = 0, visible = true, started = 0;
  const draw = (now: number) => {
    if (!map || !data || !journey || !where) return;
    const view = cameraAt(at, where, room.shorter);
    const mpp = metresPerPixel(view);
    const drawn = journey.length * glide(along(at, SCORE.journey[0], SCORE.journey[1]));
    const driven = data.stops[data.followed].metres * glide(along(at, SCORE.drive[0], SCORE.drive[1]));
    // At the door the picture's middle is the middle of what the proof of delivery leaves free: it goes there
    // with the camera's last move in, and comes back as the camera starts out.
    const atDoor = glide(along(at, LEVELS[5].rest + 0.25, LEVELS[6].rest - 0.15)) * (1 - glide(along(at, SCORE.out[0], SCORE.out[0] + 0.6)));
    // In Dublin (from the move in to it until the move in to the door) a tall stage keeps its top for the cards.
    const inDublin = glide(along(at, LEVELS[2].rest + 0.25, LEVELS[3].rest - 0.15)) * (1 - glide(along(at, LEVELS[5].rest + 0.25, LEVELS[6].rest - 0.15)));
    map.render({ view, detail: view.across / 900, shiftX: room.shiftX + beside * atDoor, shiftY: under * inDublin, journey, drawn, parcel: drawn, run: at >= SCORE.planned[0] ? driven : -1, van: at >= SCORE.drive[0] ? driven : -1, time: reduced ? 0 : (now - started) / 1000, traffic: 1, labels: 1, door: along(at, SCORE.door[0], SCORE.door[1]) });
    // The console's two readings of the map, and the map's own scale bar.
    const scale = scaleOf(mpp), centre = coordinates(view.lon, view.lat, mpp), bar = barOf(mpp, shape === 'wide' ? 150 : 110);
    if (scaleEl && scale !== shown.scale) { shown.scale = scale; scaleEl.textContent = scale; }
    if (centreEl && centre !== shown.centre) { shown.centre = centre; centreEl.textContent = centre; }
    if (barText && bar.text !== shown.bar) { shown.bar = bar.text; barText.textContent = bar.text; }
    barLine?.style.setProperty('--length', `${bar.pixels.toFixed(1)}px`);
    // The note stands by the parcel: by the van once it is on one.
    if (note) {
      const here = at >= SCORE.drive[0] ? pathAt({ shape: data.run, along: lengths ??= runLengths(data), length: data.runMetres }, driven) : pathAt(journey, drawn);
      const [lon, lat] = lonLat(here), spot = map.locate(lon, lat), box = furniture.getBoundingClientRect(), base = canvas.getBoundingClientRect();
      // To the right of it; where that would run off the map (a narrow phone) it slides back, and rises
      // clear of the point as it does.
      noteWidth ||= noteText?.offsetWidth ?? 0;
      const over = Math.max(0, spot.x + NOTE_GAP + noteWidth - (room.width - 8)), lift = Math.min(1, over / 24) * 24;
      note.style.transform = `translate(${(spot.x + NOTE_GAP - over + base.left - box.left).toFixed(1)}px, ${(spot.y - lift + base.top - box.top).toFixed(1)}px)`;
    }
    return mpp;
  };
  let lengths: Float64Array | null = null;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    // Other parcels move on the globe in their own time: while the earth is a ball, every frame is drawn.
    const moving = !reduced && at < LEVELS[1].rest - 0.6 || (!reduced && at > SCORE.out[1] - 0.5);
    if (!dirty && !moving) return;
    if (dirty) { words.seek(at); follow(); }
    dirty = false;
    draw(now);
  };
  const run = () => { if (!raf && visible && !document.hidden && alive) { started ||= performance.now(); raf = requestAnimationFrame(frame); } };
  const halt = () => { cancelAnimationFrame(raf); raf = 0; };
  const seen = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); if (visible) { dirty = true; run(); } else halt(); });
  seen.observe(root);
  listen(document, 'visibilitychange', () => { if (document.hidden) halt(); else { dirty = true; run(); } });

  // The whole page is one scene: its progress is the place in the score.
  let entrance: gsap.core.Timeline | null = null;
  const remove = director.add({
    el: track,
    last: true,
    stops: RESTS.map(rest => rest / SCREENS),
    update: measure => {
      at = measure.live * SCREENS; shape = measure.shape; dirty = true;
      if (entrance && at > 0.01) { entrance.progress(1); entrance = null; }
    },
  });
  director.onLayout(next => { shape = next; fit(); dirty = true; });

  // ---------- Entrance: the parcels are counted in, then the veil lifts ----------
  const veil = one('[data-veil]'), loadCount = one('[data-load-count]');
  const heroLines = all('[data-words="planet"] [data-line]'), heroFades = [...all('[data-words="planet"] [data-fade]'), ...all('[data-cue]')], chrome = all('[data-chrome]');
  const prepared = gsap.context(() => {
    gsap.set(heroLines, { yPercent: 112 });
    gsap.set([...heroFades, ...chrome], { autoAlpha: 0 });
  }, root);
  const counting = { value: 0 };
  const counter = gsap.to(counting, { value: levels[0].count, duration: reduced ? 0.01 : 1.5, ease: 'power2.out', onUpdate: () => { if (loadCount) loadCount.textContent = thousands(counting.value); } });
  const fonts = Promise.all([document.fonts.load("800 40px 'Overpass'"), document.fonts.load("500 12px 'Overpass Mono'")]).catch(() => undefined);
  const enter = () => {
    if (!alive) return;
    fit();
    dirty = true;
    run();
    const done = () => { root.dataset.entered = 'true'; if (veil) veil.style.display = 'none'; entrance = null; };
    const tl = gsap.timeline({ onComplete: done, delay: reduced ? 0 : 0.2 });
    // The number that was counted is the number on the waybill: it goes to its place there as the veil
    // clears, and the waybill's own figure takes over under it.
    const target = countEl?.getBoundingClientRect(), source = loadCount?.getBoundingClientRect();
    if (veil && loadCount && target && source && source.height > 0 && !reduced) {
      gsap.set(loadCount, { transformOrigin: '0 0' });
      // Only one of the two is ever seen: the waybill's own waits until the other has landed on it.
      tl.set(countEl, { autoAlpha: 0 }, 0);
      tl.to(loadCount, { x: target.left - source.left, y: target.top - source.top, scale: target.height / source.height, duration: 0.95, ease: 'power3.inOut' }, 0);
      tl.set(countEl, { autoAlpha: 1 }, 0.95);
      tl.set(loadCount, { autoAlpha: 0 }, 0.95);
      tl.to(all('[data-veil] [data-veil-fade]'), { autoAlpha: 0, duration: 0.3 }, 0);
      tl.to(veil, { backgroundColor: 'rgba(238, 241, 243, 0)', duration: 0.75, ease: 'power2.inOut' }, 0.15);
    } else if (veil) tl.to(veil, { autoAlpha: 0, duration: 0.01 }, 0);
    tl.to(heroLines, { yPercent: 0, duration: reduced ? 0.01 : 0.9, ease: 'expo.out', stagger: reduced ? 0 : 0.08 }, reduced ? 0 : 0.6);
    tl.to(heroFades, { autoAlpha: 1, duration: reduced ? 0.01 : 0.6, stagger: reduced ? 0 : 0.1 }, reduced ? 0 : 0.9);
    tl.to(chrome, { autoAlpha: 1, duration: reduced ? 0.01 : 0.5, stagger: reduced ? 0 : 0.06 }, reduced ? 0 : 0.7);
    entrance = tl;
    cleanups.push(() => tl.kill());
  };
  // The map's data and the typefaces, and the count seen to its end, before anything is shown.
  Promise.allSettled([ready, fonts, new Promise(resolve => counter.eventCallback('onComplete', resolve))]).then(() => window.setTimeout(enter, reduced ? 0 : 260));

  // ---------- Chrome: the rail, the step buttons, replay ----------
  listen(one('[data-rail]'), 'click', (event: MouseEvent) => {
    const item = (event.target as Element).closest<HTMLElement>('[data-rail-item]');
    if (item) director.goTo(0, LEVELS[railItems.indexOf(item)].rest / SCREENS);
  });
  listen(one('[data-replay]'), 'click', () => director.goTo(0, 0));
  const stepOf = (event: Event) => { const button = (event.target as Element).closest<HTMLElement>('[data-step]'); return button ? { button, direction: (Number(button.dataset.step) > 0 ? 1 : -1) as 1 | -1 } : null; };
  const pagerUp = (event: Event) => { const hit = stepOf(event); if (!hit || !hit.button.dataset.down) return; delete hit.button.dataset.down; director.release(); };
  listen(pager, 'pointerdown', (event: PointerEvent) => {
    const hit = stepOf(event);
    if (!hit || event.button > 0) return;
    hit.button.setPointerCapture?.(event.pointerId);
    hit.button.dataset.down = 'true';
    director.press(hit.direction);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(pager, type, pagerUp);
  // A click with no pointer behind it is the keyboard (Enter or Space on the button).
  listen(pager, 'click', (event: MouseEvent) => { const hit = stepOf(event); if (hit && event.detail === 0) director.step(hit.direction); });
  listen(pager, 'contextmenu', (event: Event) => event.preventDefault());

  // For the checks (scripts/gsap/verify-meridian.mjs): where the camera is, and where a place is on the stage.
  Object.defineProperty(root, 'meridianMap', { configurable: true, value: { view: () => (where ? cameraAt(at, where, room.shorter) : null), camera: (place: number) => (where ? cameraAt(place, where, room.shorter) : null), stop: () => (map && data ? map.locate(data.stops[data.followed].lon, data.stops[data.followed].lat) : null), building: () => (map?.doorPlace ? map.locate(map.doorPlace[0], map.doorPlace[1]) : null), locate: (lon: number, lat: number) => map?.locate(lon, lat) ?? null, points: () => map?.drawnPoints ?? 0, names: () => map?.drawnNames ?? [], fading: () => map?.fadingNames ?? [], room } });

  // Keys scroll the demo from the moment it opens.
  scroller.focus({ preventScroll: true });

  return () => {
    alive = false;
    halt();
    seen.disconnect();
    cleanups.forEach(cleanup => cleanup());
    remove();
    counter.kill();
    prepared.revert();
    words.destroy();
    director.destroy();
    delete (root as { meridianMap?: unknown }).meridianMap;
  };
}
