// Wires the Sum page together once its markup is in the page: the scroll director, the watch and its
// choreography, the words, the chrome, the bag and the entrance. React only renders the markup and
// calls this; nothing in here needs React, so the folder can be used somewhere else as it is.

import gsap from 'gsap';
import { createDirector, type Shape } from './director';
import { createWatch, type PartId, type Watch } from './gl/watch';
import { MEASURED } from './watch-parts';
import { createRig } from './rig';
import { buildWords } from './timeline';
import { brand, cityOfZone, faces, parts, timeInFigures, timeInWords, timeParts, total } from './content';
import { CHAPTERS, RESTS, SCORE, SCREENS, STOPS, along, type StopId } from './score';

/** The photographs the watch is built from. */
const PHOTOS = ['case-top', 'dial-silver', 'bracelet-clasp', 'bracelet-plain', 'bar-a', 'bar-b', 'case-bottom', 'calibre-top', 'calibre-bottom', 'rotor', 'caseback', 'dial-salmon', 'dial-ink'];
/** Half of each part across the watch's axis, mm: its name stands just clear of that. */
const REACH: Record<StopId, number> = { crystal: 17.7, hands: 6, dial: 17.7, case: 22, calibre: 14.8, rotor: 13.5, caseback: 18.7 };

export function mountSum(root: HTMLElement): () => void {
  const one = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector);
  const all = <T extends HTMLElement = HTMLElement>(selector: string) => Array.from(root.querySelectorAll<T>(selector));
  const scroller = one('[data-scroller]')!, track = one('[data-track]')!;
  const canvas = one<HTMLCanvasElement>('[data-watch]')!;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cleanups: (() => void)[] = [];
  const listen = (target: EventTarget | null | undefined, type: string, handler: (event: never) => void, options?: AddEventListenerOptions) => {
    if (!target) return;
    target.addEventListener(type, handler as EventListener, options);
    cleanups.push(() => target.removeEventListener(type, handler as EventListener, options));
  };

  // ---------- The watch ----------
  // Phones get the small photographs and fewer pixels: the picture is small there, and memory is short.
  const small = !fine || Math.min(root.clientWidth, root.clientHeight) < 620;
  let watch: Watch | null = null;
  try { watch = createWatch(canvas, { base: `${brand.assets}/parts`, detail: small ? 's' : 'l', maxPixels: small ? 3.2e6 : 4.8e6 }); } catch (error) { console.error('Sum: the watch could not be drawn.', error); watch = null; }
  root.dataset.webgl = String(!!watch);
  const rig = watch ? createRig(watch) : null;

  const director = createDirector(root, scroller);
  const words = buildWords(root);
  let at = 0, velocity = 0, shape: Shape = director.shape, aspect = 1.6, dirty = true, alive = true;
  // For the checks (scripts/gsap/verify-sum.mjs): where the watch's parts are on the stage, and the watch put at
  // any place in the score for one frame (the page's own next frame puts it back where the scroll is).
  if (watch && rig) Object.defineProperty(root, 'sumWatch', { configurable: true, value: { state: watch.state, project: watch.project, scale: watch.scale, pose: (place: number) => { rig.update(place, 0, shape, aspect, 1); watch!.render(); } } });
  /** The picture is the canvas's own box: the whole stage when it is wide, the top of it when it is tall. */
  const fit = () => {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    aspect = width / height;
    watch?.resize(width, height);
  };

  // ---------- What follows the scroll besides the watch and the words ----------
  const railItems = all('[data-rail-item]');
  const pager = one('[data-pager]');
  const terms = all('[data-ledger] [data-term]');
  const totalEl = one('[data-total]'), stoppedEl = one('[data-stopped]');
  const labels = new Map(all('[data-label]').map(label => [label.dataset.label as StopId, label]));
  const toolsEl = one('[data-tools]');
  // When each part is counted: as the tour arrives at it, and the bracelet as it goes back on.
  const counted = parts.map(part => ({ count: part.count, at: part.id === 'strap' ? SCORE.strapOn[1] - 0.25 : STOPS.find(stop => stop.id === part.id)!.arrive - 0.1 }));
  let shownTotal = -1, shownStopped = '', shownNow = -2;
  const follow = () => {
    railItems.forEach((item, index) => {
      const from = CHAPTERS[index].from, to = CHAPTERS[index + 1]?.from ?? SCREENS;
      const here = at >= from - 0.0005 && (at < to || index === CHAPTERS.length - 1);
      item.setAttribute('aria-current', String(here));
      item.style.setProperty('--fill', along(at, from, to).toFixed(3));
    });
    if (pager) pager.dataset.end = at <= 0.002 ? 'top' : at >= SCREENS - 0.002 ? 'bottom' : '';
    // The sum: a term lights as its part is reached, and the figure counts up to take it in.
    let sum = 0, newest = -1;
    counted.forEach((part, index) => {
      const reached = along(at, part.at, part.at + 0.2);
      sum += part.count * reached;
      if (reached > 0) newest = index;
    });
    if (newest !== shownNow) {
      shownNow = newest;
      terms.forEach((term, index) => { term.toggleAttribute('data-on', index <= newest); term.toggleAttribute('data-now', index === newest && newest < terms.length - 1); });
    }
    const rounded = Math.round(sum);
    if (totalEl && rounded !== shownTotal) { shownTotal = rounded; totalEl.textContent = String(rounded); }
    const stopped = rig?.stopped ? timeInFigures(rig.stopped) : '';
    if (stoppedEl && stopped && stopped !== shownStopped) { shownStopped = stopped; stoppedEl.textContent = stopped; }
  };
  /**
   * Each part's name, while they are all in view: in one row under a line of parts (a wide stage), or in
   * one column beside a stack of them (a tall picture).
   */
  const placeLabels = () => {
    if (!watch || at < SCORE.burst[1] - 0.3 || at > STOPS[0].from + 0.2) return;
    const mm = watch.scale();
    // How far the names stand from the parts: a little, and less where the picture is small.
    const gap = shape === 'wide' ? Math.max(6, Math.min(22, canvas.clientHeight * 0.024)) : 8;
    let edge = 0;
    const points = new Map<StopId, { x: number; y: number }>();
    for (const id of labels.keys()) {
      const point = watch.project(id as PartId, 0, 0, 0);
      points.set(id, point);
      edge = Math.max(edge, shape === 'wide' ? point.y + REACH[id] * mm : point.x + REACH[id] * mm);
    }
    // Beside a stack the top name would stand under the bag and the way out: the names start below them,
    // and each keeps a line's room from the one above (they are in the stack's order, top to bottom).
    let least = shape === 'tall' ? (toolsEl?.getBoundingClientRect().bottom ?? 0) - canvas.getBoundingClientRect().top + 14 : 0;
    for (const [id, label] of labels) {
      const point = points.get(id)!;
      if (shape === 'wide') { label.style.transform = `translate(${point.x.toFixed(1)}px, ${(edge + gap).toFixed(1)}px) translate(-50%, 0)`; continue; }
      const y = Math.max(point.y, least);
      least = y + 16;
      label.style.transform = `translate(${(edge + gap).toFixed(1)}px, ${y.toFixed(1)}px) translate(0, -50%)`;
    }
  };

  // ---------- One loop: the scroll's place, then whatever runs in its own time ----------
  let raf = 0, lastTime = 0, visible = true, drawn = NaN;
  /** Everything that moves in its own time, as one number: a frame in which it has not changed is not drawn again. */
  const moved = () => { const { hands, rotor, dial, camera } = watch!.state; return hands.hour * 3 + hands.minute * 7 + hands.second * 13 + rotor * 17 + dial.sweep * 19 + camera.el * 23 + camera.az * 29; };
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const seconds = lastTime ? Math.min((now - lastTime) / 1000, 0.1) : 0;
    lastTime = now;
    // Under a finger there is no pointer to lean toward: the watch sways a little by itself, slowly.
    if (rig && !fine && !reduced) rig.lean(3.0 * Math.sin(now * 0.00052), 2.2 * Math.sin(now * 0.00037 + 1));
    if (rig) rig.update(at, reduced ? 0 : velocity, shape, aspect, reduced ? 1 : seconds);
    const state = watch ? moved() : 0;
    if (!dirty && state === drawn) return;
    if (dirty) { words.seek(at); follow(); }
    dirty = false;
    drawn = state;
    watch?.render();
    placeLabels();
  };
  const run = () => { if (!raf && visible && !document.hidden && alive) { lastTime = 0; raf = requestAnimationFrame(frame); } };
  const halt = () => { cancelAnimationFrame(raf); raf = 0; };
  const seen = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); if (visible) { dirty = true; run(); } else halt(); });
  seen.observe(root);
  listen(document, 'visibilitychange', () => { if (document.hidden) halt(); else { dirty = true; run(); } });

  // With a mouse, the watch leans toward the pointer: up to six degrees, where it lies whole and face up.
  if (fine && !reduced && rig) {
    listen(root, 'pointermove', (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      if (!box.width || event.pointerType === 'touch') return;
      const x = Math.max(-1, Math.min(1, (event.clientX - (box.left + box.width / 2)) / (box.width / 2)));
      const y = Math.max(-1, Math.min(1, (event.clientY - (box.top + box.height / 2)) / (box.height / 2)));
      rig.lean(x * 6, -y * 5);
    });
    listen(root, 'pointerleave', () => rig.lean(0, 0));
  }

  // ---------- The time, in words ----------
  const timeLines = [0, 1, 2].map(index => one(`[data-time="${index}"]`));
  const buyTime = one('[data-buy-time]');
  const city = cityOfZone(), cityEl = one('[data-city]');
  if (cityEl && city) cityEl.textContent = ` in ${city}`;
  let minute = -1;
  const tellTime = (again = false) => {
    const now = new Date();
    if (now.getMinutes() === minute && !again) return;
    minute = now.getMinutes();
    const { lead, rest } = timeParts(now);
    const [first, second, third] = timeLines;
    if (first && second && third) {
      // "seventeen minutes" on one line where it fits the column; on two where it does not.
      first.textContent = lead; second.textContent = rest; third.textContent = '';
      const room = first.parentElement!.clientWidth;
      const cut = lead.lastIndexOf(' ');
      if (cut > 0 && room > 0 && first.scrollWidth > room) { first.textContent = lead.slice(0, cut); second.textContent = lead.slice(cut + 1); third.textContent = rest; }
    }
    if (buyTime) buyTime.textContent = `It is ${timeInWords(now)}`;
  };
  const clock = window.setInterval(() => tellTime(), 1000);
  cleanups.push(() => clearInterval(clock));

  // The whole page is one scene: its progress is the place in the score.
  let entrance: gsap.core.Timeline | null = null;
  const remove = director.add({
    el: track,
    last: true,
    stops: RESTS.map(rest => rest / SCREENS),
    update: measure => {
      at = measure.live * SCREENS; velocity = measure.velocity; shape = measure.shape; dirty = true;
      // A visitor who scrolls before the entrance is over gets the page as it rests: the words are the scroll's now.
      if (entrance && at > 0.01) { entrance.progress(1); entrance = null; }
    },
  });
  director.onLayout(next => { shape = next; fit(); tellTime(true); dirty = true; });

  // ---------- The dial's lettering: set in type on each face's photograph ----------
  const letter = () => {
    if (!watch) return;
    for (const face of faces) {
      const image = watch.image(face.id);
      if (!image) continue;
      const size = image.naturalWidth, per = size / (2 * MEASURED.dial.half), middle = size / 2;
      const sheet = document.createElement('canvas');
      sheet.width = sheet.height = size;
      const ctx = sheet.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(image, 0, 0);
      ctx.fillStyle = face.id === 'dial-ink' ? '#d6dae2' : '#161a2c';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      // The wordmark is set wide. A canvas takes the width as a keyword in its font, but does not say so when
      // asked (the font reads back without it), so it is found out by measuring. Where a canvas will not take
      // it, the letters are spread instead.
      const name = 2.05 * per;
      const plainFont = `680 ${name.toFixed(1)}px Archivo, Arial, sans-serif`;
      ctx.font = plainFont;
      const plain = ctx.measureText(brand.name).width;
      ctx.font = `680 expanded ${name.toFixed(1)}px Archivo, Arial, sans-serif`;
      const widthTaken = ctx.measureText(brand.name).width > plain * 1.08;
      if (!widthTaken) ctx.font = plainFont;
      ctx.save();
      ctx.translate(middle, middle - 6.1 * per);
      if (!widthTaken) ctx.scale(1.14, 1);
      ctx.fillText(brand.name, 0, 0);
      ctx.restore();
      ctx.font = `500 ${(0.92 * per).toFixed(1)}px Archivo, Arial, sans-serif`;
      ctx.fillText('Automatic', middle, middle + 7.3 * per);
      watch.setTexture(face.id, sheet);
    }
  };

  // ---------- Entrance: the parts are counted in, then the veil lifts and the hands wind to the time ----------
  const veil = one('[data-veil]'), loadCount = one('[data-load-count]'), loadLine = one('[data-load-line]');
  const heroLines = all('[data-words="now"] [data-line]'), heroFades = [...all('[data-words="now"] [data-fade]'), ...all('[data-cue]')], chrome = all('[data-chrome]');
  const shown = { value: 0 };
  let loaded = 0;
  const jobs: Promise<unknown>[] = [document.fonts.load('680 40px Archivo').catch(() => undefined)];
  if (watch) for (const name of PHOTOS) jobs.push(watch.load([name]).catch(() => undefined));
  const prepared = gsap.context(() => {
    gsap.set(heroLines, { yPercent: 112 });
    gsap.set([...heroFades, ...chrome], { autoAlpha: 0 });
  }, root);
  const tick = () => {
    loaded++;
    if (!alive) return;
    gsap.to(shown, { value: Math.round((loaded / jobs.length) * total), duration: 0.5, ease: 'power2.out', overwrite: true, onUpdate: () => { if (loadCount) loadCount.textContent = String(Math.round(shown.value)); if (loadLine) loadLine.style.setProperty('--fill', (shown.value / total).toFixed(3)); } });
  };
  jobs.forEach(job => job.then(tick));
  const enter = () => {
    if (!alive) return;
    letter();
    fit();
    tellTime(true);
    rig?.wind(reduced ? 0 : 0.95);
    dirty = true;
    run();
    const done = () => { root.dataset.entered = 'true'; if (veil) veil.style.display = 'none'; entrance = null; };
    const tl = gsap.timeline({ onComplete: done, delay: reduced ? 0 : 0.25 });
    if (veil) tl.to(veil, { yPercent: -100, duration: reduced ? 0.01 : 0.95, ease: 'power3.inOut' }, 0);
    tl.to(heroLines, { yPercent: 0, duration: reduced ? 0.01 : 1.0, ease: 'expo.out', stagger: reduced ? 0 : 0.09 }, reduced ? 0 : 0.5);
    tl.to(heroFades, { autoAlpha: 1, duration: reduced ? 0.01 : 0.6, stagger: reduced ? 0 : 0.1 }, reduced ? 0 : 0.95);
    tl.to(chrome, { autoAlpha: 1, duration: reduced ? 0.01 : 0.6, stagger: reduced ? 0 : 0.06 }, reduced ? 0 : 0.8);
    entrance = tl;
    cleanups.push(() => tl.kill());
  };
  Promise.allSettled(jobs).then(() => window.setTimeout(enter, reduced ? 0 : 420));

  // ---------- Chrome: the rail, the step buttons, replay ----------
  const firstRestFrom = (from: number) => RESTS.find(rest => rest >= from - 0.001) ?? from;
  listen(one('[data-rail]'), 'click', (event: MouseEvent) => {
    const item = (event.target as Element).closest<HTMLElement>('[data-rail-item]');
    if (item) director.goTo(0, firstRestFrom(CHAPTERS[railItems.indexOf(item)].from) / SCREENS);
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
  // A finger held on a button is a hold, not a request for the browser's menu.
  listen(pager, 'contextmenu', (event: Event) => event.preventDefault());

  // ---------- The bag ----------
  const panel = one('[data-bag-panel]'), bagCount = one('[data-bag-count]'), bagItem = one('[data-bag-item]'), bagEmpty = one('[data-bag-empty]'), bagFace = one('[data-bag-face]');
  let picked: (typeof faces)[number] = faces[0], returnTo: HTMLElement | null = null;
  const bag = (open: boolean) => {
    root.dataset.bag = open ? 'open' : 'closed';
    panel?.setAttribute('aria-hidden', String(!open));
    if (panel) panel.inert = !open;
    if (open) { returnTo = document.activeElement as HTMLElement | null; panel?.querySelector<HTMLElement>('[data-bag-close]')?.focus({ preventScroll: true }); } else (returnTo ?? scroller).focus?.({ preventScroll: true });
  };
  if (panel) panel.inert = true;
  listen(one('[data-bag-open]'), 'click', () => bag(true));
  all('[data-bag-close]').forEach(button => listen(button, 'click', () => bag(false)));
  // Escape closes the bag first, and only then (from whatever holds the demo) the demo.
  listen(root, 'keydown', (event: KeyboardEvent) => { if (event.key === 'Escape' && root.dataset.bag === 'open') { event.stopPropagation(); bag(false); } }, { capture: true });
  all('[data-pick]').forEach(button => listen(button, 'click', () => {
    const face = faces.find(item => item.id === button.dataset.pick);
    if (!face) return;
    picked = face;
    all('[data-pick]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    rig?.choose(face.id);
    if (bagFace) bagFace.textContent = face.name;
    dirty = true;
    run();
  }));
  /** The watch as it is now, with the face that was chosen: a small picture of it for the bag. */
  const portrait = (): string | null => {
    if (!watch) return null;
    try {
      watch.render();
      const middle = watch.project('case', 0, 0, 0), half = 27 * watch.scale(), ratio = canvas.width / canvas.clientWidth;
      const sheet = document.createElement('canvas');
      sheet.width = sheet.height = 192;
      const ctx = sheet.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(canvas, (middle.x - half) * ratio, (middle.y - half) * ratio, half * 2 * ratio, half * 2 * ratio, 0, 0, 192, 192);
      return sheet.toDataURL('image/png');
    } catch { return null; }
  };
  const bagPicture = bagItem?.querySelector('img') ?? null;
  listen(one('[data-add]'), 'click', (event: MouseEvent) => {
    const picture = portrait() ?? `${brand.assets}/poster.webp`;
    if (bagPicture) bagPicture.src = picture;
    if (bagCount) { bagCount.textContent = '1'; bagCount.setAttribute('data-full', ''); }
    if (bagItem) bagItem.hidden = false;
    if (bagEmpty) bagEmpty.hidden = true;
    if (bagFace) bagFace.textContent = picked.name;
    const from = (event.currentTarget as HTMLElement).getBoundingClientRect(), to = bagCount?.getBoundingClientRect(), box = root.getBoundingClientRect();
    if (reduced || !to) { bag(true); return; }
    // A small copy of the watch goes from the button to the bag, and the bag opens.
    const flyer = document.createElement('img');
    flyer.src = picture;
    flyer.alt = '';
    Object.assign(flyer.style, { position: 'absolute', left: `${from.left - box.left + from.width / 2 - 36}px`, top: `${from.top - box.top - 60}px`, width: '72px', height: '72px', zIndex: '45', pointerEvents: 'none' });
    root.appendChild(flyer);
    gsap.fromTo(flyer, { scale: 0.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.25, ease: 'power2.out' });
    gsap.to(flyer, { x: to.left + to.width / 2 - (from.left + from.width / 2), y: to.top - (from.top - 60) - 26, scale: 0.28, duration: 0.7, delay: 0.2, ease: 'power3.inOut', onComplete: () => { flyer.remove(); bag(true); } });
    if (bagCount) gsap.fromTo(bagCount, { scale: 1.5 }, { scale: 1, duration: 0.5, delay: 0.85, ease: 'back.out(3)' });
  });

  // Keys scroll the demo from the moment it opens.
  scroller.focus({ preventScroll: true });

  return () => {
    alive = false;
    halt();
    seen.disconnect();
    cleanups.forEach(cleanup => cleanup());
    remove();
    prepared.revert();
    gsap.killTweensOf(shown);
    words.destroy();
    director.destroy();
    watch?.destroy();
    delete (root as { sumWatch?: unknown }).sumWatch;
  };
}
