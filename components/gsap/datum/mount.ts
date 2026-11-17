// Wires the Datum page together once its markup is in the page: the scroll director, the plate (the
// photographs), the drawing over it, the one timeline, the chrome and the entrance. React only renders the
// markup and calls this; nothing in here needs React, so the folder can be used somewhere else as it is.

import gsap from 'gsap';
import { createDirector, type Shape } from './director';
import { DAY, NIGHT, createPlate, createView, inkTurn, mix, softTone, type Layout } from './plate';
import { buildDrawing } from './drawing';
import { buildTimeline } from './timeline';
import { brand, level as asLevel, noScale } from './content';
import { CHAPTERS, MOVES, RESTS, SCENES, SCREENS, along, type SceneId } from './score';
import { HOUSE, PICTURES } from './survey';

export function mountDatum(root: HTMLElement): () => void {
  const one = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector);
  const all = <T extends Element = HTMLElement>(selector: string) => Array.from(root.querySelectorAll<T>(selector));
  const scroller = one('[data-scroller]')!, track = one('[data-track]')!;
  const canvas = one<HTMLCanvasElement>('[data-plate]')!, datumEl = one('[data-datum-line]')!, sheetEl = one<SVGSVGElement>('[data-drawing]')!;
  const bar = one('[data-bar]'), levelMark = one('[data-level-mark]');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cleanups: (() => void)[] = [];
  const listen = (target: EventTarget | null | undefined, type: string, handler: (event: never) => void, options?: AddEventListenerOptions) => {
    if (!target) return;
    target.addEventListener(type, handler as EventListener, options);
    cleanups.push(() => target.removeEventListener(type, handler as EventListener, options));
  };

  let at = 0, shape: Shape = 'wide', dirty = true, alive = true, wanted = -9;
  let shownNight = -1, shownLevel = '', shownScale = '';
  const scales = {} as Record<SceneId, string>;
  const view = createView();
  const plate = createPlate(canvas, brand.assets, () => { dirty = true; run(); });
  const drawing = buildDrawing(sheetEl, sheetEl.dataset.clip || 'datum-unbuilt');
  const director = createDirector(root, scroller);

  // ---------- The strip measures its own room ----------
  // The words come first. What gives way to them, in the order it goes, is written on the root as data-give
  // and read by the stylesheet (see "What the strip gives up" there). It is measured when the sheet is laid
  // out, never guessed from the window's size: thresholds on the size of the window leave gaps between them
  // where something overflows.
  const GIVE: Record<Shape, string[]> = { wide: ['', 'beside', 'beside close', 'close bare'], tall: ['', 'bare', 'bare close'] };
  const wordBlocks = all('[data-words]'), stripEl = one('[data-strip]'), blockEl = one('[data-block]'), railEl = one('[data-rail]'), pagerEl = one('[data-pager]');
  const entries = all('[data-roll] > span'), scaleCell = one('[data-scale]');
  /** How wide an element's type is set, whatever windows it is shown through: its letters only, not the boxes they are in. */
  const typeWidth = (element: Element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT), range = document.createRange();
    let left = Infinity, right = -Infinity;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) { range.selectNodeContents(node); for (const rect of range.getClientRects()) { if (rect.width < 0.5) continue; left = Math.min(left, rect.left); right = Math.max(right, rect.right); } }
    return right > left ? right - left : 0;
  };
  /** Whether everything in the strip has its own room as it is laid out now. */
  const stripFits = () => {
    if (!stripEl || !blockEl || !railEl || !pagerEl) return true;
    const box = (element: Element) => element.getBoundingClientRect();
    const strip = box(stripEl), rail = box(railEl), steps = box(pagerEl), foot = Math.min(rail.top, steps.top);
    const block = getComputedStyle(blockEl).display === 'none' ? null : box(blockEl);
    for (const words of wordBlocks) {
      const here = box(words);
      // Under the words: on a tall stage the title block, or the foot once it has gone; on a wide one the
      // rail, and the step buttons too where the words reach over them.
      const under = shape === 'tall' ? (block ? block.top : foot) : here.right > steps.left - 8 ? foot : rail.top;
      if (here.bottom > under - 6) return false;
      // No heading wider than the column it has (its type, measured: a line's window is a little wider than
      // its column by design), and no sentence squeezed into a sliver beside what follows it.
      for (const heading of words.querySelectorAll<HTMLElement>('h2')) if (typeWidth(heading) > heading.clientWidth + 2) return false;
      for (const text of words.querySelectorAll<HTMLElement>('p[data-fade]')) if (text.clientWidth < Math.min(240, here.width - 8)) return false;
    }
    if (block) {
      const overSteps = block.right > steps.left - 8 && block.left < steps.right + 8;
      if (block.bottom > (shape === 'tall' || overSteps ? foot : strip.bottom) - 6) return false;
      if (!entriesWhole()) return false;
    }
    return true;
  };
  /** The title block shows every entry it will ever show, whole: no cell is too narrow for its longest one. */
  const entriesWhole = () => [...entries, scaleCell].every(entry => !entry || entry.scrollWidth <= entry.clientWidth + 1);
  /**
   * How tall a tall stage's strip has to be for what it holds now: the longest block of words, the title
   * block under it where it is shown, and the foot where the rail and the step buttons stand.
   */
  const stripNeeds = () => {
    if (!stripEl || !blockEl || !pagerEl) return 0;
    const words = Math.max(...wordBlocks.map(block => block.offsetHeight)), top = wordBlocks[0]?.offsetTop ?? 0;
    const shown = getComputedStyle(blockEl).display !== 'none';
    // Under the words: the title block and the room it keeps beneath it, or the step buttons' own room.
    const under = shown ? 10 + blockEl.offsetHeight + parseFloat(getComputedStyle(blockEl).bottom) : 10 + (stripEl.getBoundingClientRect().bottom - pagerEl.getBoundingClientRect().top);
    return Math.ceil(top + words + under);
  };
  const fitStrip = () => {
    // The scale's longest entry is the one to measure with.
    if (scaleCell) scaleCell.textContent = noScale;
    root.style.removeProperty('--strip');
    const levels = GIVE[shape], stage = stripEl?.parentElement?.offsetHeight ?? 0, over = bar?.offsetHeight ?? 0;
    for (const give of levels) {
      root.dataset.give = give;
      if (shape === 'wide') { if (stripFits()) break; continue; }
      // A tall stage's strip is as tall as its words need and no taller: the rest of the sheet is the
      // picture's, which keeps at least 44% of it. Where the words would need more than that leaves, the
      // next thing gives way; the picture is the last to.
      const need = stripNeeds(), most = stage - over - Math.max(170, stage * 0.44), last = give === levels[levels.length - 1];
      if (need > most && !last) continue;
      // Room is not only height. A title block that fits under the words but is too narrow for one of its
      // entries ("Not to scale", on a 320px phone) gives way as well: it was once kept only because the
      // words of the last sheet happened to be long enough to push it out.
      if (!last && blockEl && getComputedStyle(blockEl).display !== 'none' && !entriesWhole()) continue;
      root.style.setProperty('--strip', `${Math.min(need, Math.max(most, stage - over - 150))}px`);
      break;
    }
    shownScale = '';
  };

  // ---------- The bar measures its own room too ----------
  // What this is ("Concept practice") stays in the bar at every width: it is the one thing the site says
  // about itself on every screen. Where the bar has no room for everything, the word beside the close
  // button goes (the button keeps its label). Measured, not a threshold: the rule this replaced hid the
  // concept on any stage under 340px wide, and a 320px phone has 34px to spare for it.
  const wordmarkEl = one('[data-bar] > span'), toolsEl = one('[data-bar] > div');
  const fitBar = () => {
    if (!bar || !wordmarkEl || !toolsEl) return;
    root.removeAttribute('data-bar-tight');
    // (Neither side shrinks or wraps, so what each needs is what it measures.)
    const style = getComputedStyle(bar), room = bar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    if (wordmarkEl.offsetWidth + 16 + toolsEl.offsetWidth > room + 0.5) root.setAttribute('data-bar-tight', '');
  };

  // ---------- Layout: the plate's box and the datum's height are the stylesheet's; everything else follows them ----------
  let layout: Layout = { width: 1, height: 1, datum: 1, shape: 'wide', dpr: 1, small: false, lean: false, edge: 16, keep: 0 };
  const measure = () => {
    const width = canvas.offsetWidth, height = canvas.offsetHeight;
    if (!width || !height) return;
    fitBar();
    fitStrip();
    const datum = datumEl.offsetTop - canvas.offsetTop;
    const small = shape === 'tall' && width <= 560;
    // As many pixels as the screen has, up to a point: a phone's canvas is small, a wall-sized one is not.
    let dpr = Math.min(window.devicePixelRatio || 1, small ? 3 : 2);
    dpr = Math.min(dpr, Math.sqrt(5.2e6 / (width * height)));
    // The datum's level hangs from its east end: the house and its dimensions keep clear of it, and of as much at the other end.
    const tag = levelMark ? { left: levelMark.offsetLeft, right: levelMark.offsetLeft + levelMark.offsetWidth } : { left: width, right: width };
    layout = { width, height, datum, shape, dpr, small, lean: !fine, edge: parseFloat(getComputedStyle(bar ?? root).paddingLeft) || 16, keep: width - tag.left + 7 };
    plate.resize(layout);
    drawing.layout(plate.project, { width, height, datum, narrow: width < 620, tag: tag.left });
    // The scale each scene is drawn at. A photograph of a room or of a surface has none; the last sheet is the reader's own.
    const ratios = plate.ratios(), drawn = (ratio: number) => `1:${ratio}`;
    for (const { id } of SCENES) scales[id] = id === 'start' ? '1:1' : id === 'coast' || id === 'studio' || id === 'pavilion' ? drawn(ratios[id]) : id === 'building' || id === 'evening' ? drawn(ratios.close) : ['line', 'site', 'setout', 'drawing', 'structure'].includes(id) ? drawn(ratios.overview) : noScale;
    shownScale = '';
    wanted = -9;
    dirty = true;
  };

  // ---------- What follows the scroll besides the timeline ----------
  const words = buildTimeline(root, view);
  const railItems = all('[data-rail-item]');
  const pager = one('[data-pager]');
  const levelEl = one('[data-level]'), scaleEl = one('[data-scale]');
  const follow = () => {
    railItems.forEach((item, index) => {
      const from = CHAPTERS[index].from, to = CHAPTERS[index + 1]?.from ?? SCREENS;
      const here = at >= from - 0.0005 && (at < to || index === CHAPTERS.length - 1);
      item.setAttribute('aria-current', String(here));
      item.style.setProperty('--fill', along(at, from, to).toFixed(3));
    });
    if (pager) pager.dataset.end = at <= 0.002 ? 'top' : at >= SCREENS - 0.002 ? 'bottom' : '';
    // The sheet's own colours: white by day, the dusk sky's blue at night.
    if (view.night !== shownNight) {
      shownNight = view.night;
      const turn = inkTurn(view.night);
      const paper = mix(DAY.paper, NIGHT.paper, view.night), ink = mix(DAY.ink, NIGHT.ink, turn), soft = softTone(view.night), red = mix(DAY.red, NIGHT.red, view.night);
      const rgb = (colour: number[]) => `rgb(${colour.join(' ')})`;
      root.style.setProperty('--paper', rgb(paper));
      root.style.setProperty('--ink', rgb(ink));
      root.style.setProperty('--soft', rgb(soft));
      root.style.setProperty('--red', rgb(red));
      root.style.setProperty('--rule', `rgb(${ink.join(' ')} / ${(0.16 + 0.14 * turn).toFixed(3)})`);
    }
    // The drawing gives way where the building has gone up, and its figures count as their lines are drawn.
    drawing.cut(plate.strips(), [view.bay0, view.bay1, view.bay2, view.bay3, view.bay4, view.bay5, view.bay6, view.bay7]);
    drawing.count(view.len, view.rise);
    // The level the line stands at: 0.000, until the page goes up a floor.
    const height = Math.round(view.level / 5) * 5, levelText = height > 0 ? `+${asLevel(height)}` : asLevel(0);
    if (levelEl && levelText !== shownLevel) { shownLevel = levelText; levelEl.textContent = levelText; }
    // The scale changes with the rest of the title block: a fifth of a screen into each move, as its entries roll.
    let scene = 0;
    while (scene < MOVES.length && at >= MOVES[scene] + 0.22) scene++;
    const scale = scales[SCENES[scene].id];
    if (scaleEl && scale !== shownScale) { shownScale = scale; scaleEl.textContent = scale; }
    if (Math.abs(at - wanted) > 0.12) { wanted = at; plate.want(at); }
  };

  // ---------- Drawing: only when the scroll has moved or a picture has arrived, never in its own time ----------
  // The director calls `update` inside its own frame, so the page is drawn in the same frame the scroll was read in.
  let raf = 0, visible = true;
  const render = () => {
    if (!dirty || !alive) return;
    dirty = false;
    words.seek(at);
    follow();
    plate.draw(view);
  };
  const run = () => { if (!raf && visible && !document.hidden && alive) raf = requestAnimationFrame(() => { raf = 0; render(); }); };
  const seen = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); if (visible) { dirty = true; run(); } });
  seen.observe(root);
  listen(document, 'visibilitychange', () => { if (!document.hidden) { dirty = true; run(); } });

  // For the checks (scripts/gsap/verify-datum.mjs), which ask the page where things are and never work it out for
  // themselves: the house as surveyed and the photographs' own geometry; where the camera puts a point of the
  // house's photograph now; what the picture is about at this moment; what the plate holds and drew last.
  Object.defineProperty(root, 'datumPlate', { configurable: true, value: { view, survey: { house: HOUSE, pictures: PICTURES }, boxes: plate.boxes, project: plate.project, ready: plate.ready, camera: () => plate.camera(view), cameras: () => ({ overview: plate.overview, close: plate.closeUp }), layout: () => layout, ratios: () => plate.ratios(),
    at: (mx: number, my: number) => { const cam = plate.camera(view); return { x: layout.width / 2 + (mx - cam.fx) * cam.s, y: layout.datum + (my - HOUSE.ground) * cam.s }; },
    subjects: () => plate.subjects(view),
    // The sheet put at any place in the score for one frame, and how far everything on the plate has got there; with no place, put back where the scroll is.
    pose: (place?: number) => { const real = at; at = place ?? real; dirty = true; render(); const edges = plate.edges(view); at = real; return edges; } } });

  // The whole page is one scene: its progress is the place in the score.
  let entrance: gsap.core.Timeline | null = null;
  const remove = director.add({
    el: track,
    last: true,
    stops: RESTS.map(rest => rest / SCREENS),
    update: measured => {
      at = measured.live * SCREENS; dirty = true;
      // A visitor who scrolls before the entrance is over gets the page as it rests: the words are the scroll's now.
      if (entrance && at > 0.01) { entrance.progress(1); entrance = null; }
      render();
    },
  });
  director.onLayout(next => { shape = next; measure(); run(); });

  // ---------- Entrance: the line is drawn across the sheet, and the first words rise out of it ----------
  const veil = one('[data-veil]');
  const firstWords = one('[data-first]'), firstLift = all('[data-first] [data-lift]'), firstFades = [...all('[data-words="line"] [data-fade]'), ...all('[data-cue]')], chrome = all('[data-chrome]');
  const stroke = one('[data-datum-stroke]');
  const prepared = gsap.context(() => {
    // Below the line, with their window shut at it: they will come up out of the line itself.
    gsap.set(firstLift, { yPercent: 104 });
    gsap.set(firstWords, { '--cut': 1 });
    gsap.set([...firstFades, ...chrome, levelMark], { autoAlpha: 0 });
    gsap.set(stroke, { scaleX: 0, transformOrigin: '0 50%' });
  }, root);
  const enter = () => {
    if (!alive) return;
    measure();
    if (veil) veil.style.display = 'none';
    run();
    const done = () => { root.dataset.entered = 'true'; entrance = null; };
    const quick = reduced ? 0.01 : 0;
    const tl = gsap.timeline({ onComplete: done, delay: reduced ? 0 : 0.15 });
    tl.to(stroke, { scaleX: 1, duration: quick || 1.1, ease: 'expo.inOut' }, 0);
    tl.to(levelMark, { autoAlpha: 1, duration: quick || 0.4 }, reduced ? 0 : 0.85);
    tl.to(firstLift, { yPercent: 0, duration: quick || 1.1, ease: 'expo.out' }, reduced ? 0 : 0.8);
    // Once they stand, the window opens under the line for the comma's tail.
    tl.to(firstWords, { '--cut': 0, duration: quick || 0.3, ease: 'power1.out' }, reduced ? 0 : 1.45);
    tl.to(firstFades, { autoAlpha: 1, duration: quick || 0.6, stagger: reduced ? 0 : 0.08 }, reduced ? 0 : 1.3);
    tl.to(chrome, { autoAlpha: 1, duration: quick || 0.6, stagger: reduced ? 0 : 0.06 }, reduced ? 0 : 1.1);
    entrance = tl;
    cleanups.push(() => tl.kill());
  };
  // The first screen is a line and a few words: it waits for the type, and for nothing else.
  const type = (document.fonts?.load ? document.fonts.load('300 40px Jost').catch(() => undefined) : Promise.resolve()) as Promise<unknown>;
  Promise.race([type, new Promise(resolve => window.setTimeout(resolve, 1600))]).then(() => window.setTimeout(enter, reduced ? 0 : 120));
  // Type that arrives after the sheet has been laid out changes what fits: measure again.
  document.fonts?.ready?.then(() => { if (alive && root.dataset.entered === 'true') { measure(); run(); } }).catch(() => undefined);
  plate.want(0);

  // ---------- Chrome: the rail, the step buttons, replay ----------
  const firstRestFrom = (from: number) => RESTS.find(rest => rest >= from - 0.001) ?? from;
  listen(one('[data-rail]'), 'click', (event: MouseEvent) => {
    const item = (event.target as Element).closest<HTMLElement>('[data-rail-item]');
    if (!item) return;
    const to = firstRestFrom(CHAPTERS[railItems.indexOf(item)].from);
    // Fetch what stands there now: the page will be there before it could be asked for on the way.
    plate.want(at, to);
    director.goTo(0, to / SCREENS);
  });
  listen(one('[data-replay]'), 'click', () => { plate.want(at, 0); director.goTo(0, 0); });
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

  // Keys scroll the demo from the moment it opens.
  scroller.focus({ preventScroll: true });

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    seen.disconnect();
    cleanups.forEach(cleanup => cleanup());
    remove();
    prepared.revert();
    words.destroy();
    director.destroy();
    plate.destroy();
    drawing.destroy();
    for (const name of ['--paper', '--ink', '--soft', '--red', '--rule', '--strip']) root.style.removeProperty(name);
    delete root.dataset.give;
    delete (root as { datumPlate?: unknown }).datumPlate;
  };
}
