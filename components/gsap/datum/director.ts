// The scroll director of the Datum demo. It reads one number per frame, the scroll position of the demo's
// own scroller, eases toward it, and hands each scene how far along it is. Datum registers one scene (the
// whole page is a single pinned sheet), and turns its progress into a position in screens.
//
// This is the same director the Kelvin and Sum demos run on, kept as a copy of its own so that this folder
// can be lifted out and used somewhere else whole. If one is fixed, look at the others.
//
// Why not ScrollTrigger: a page this demo may open from can suspend ScrollTrigger on phones on purpose.
// The demo scrolls an element of its own, so it keeps out of that machinery entirely. The pin is native
// `position: sticky`.
//
// Rules kept here:
// - nothing is written to the scroll position except on an explicit action of the visitor's (the rail,
//   the step buttons, the arrow keys), only on the demo's own scroller, never on the document, and any
//   wheel or touch takes it back at once;
// - one stage is the scroller's height in px, measured once and again only when the width changes on
//   touch devices, so a moving browser toolbar cannot change the page's geometry;
// - the frame loop exists only while the demo can be seen.

export type Shape = 'wide' | 'tall';

/** Below this width-to-height ratio the demo uses its tall layouts and plates. */
export const TALL = 1.05;
/** On touch devices, a change of width no larger than this (px) is not a new layout. */
export const NOISE = 16;

export interface SceneMeasure {
  /** 0 to 1 through the scene's pinned stretch. */
  progress: number;
  /**
   * 0 to 1 through the part of the pinned stretch the scene has to itself.
   * The next scene starts one stage early and rises over this one, so the last
   * stage of a scene's pin belongs to that hand-over (`cover`).
   */
  live: number;
  /** 0 to 1 as the next scene rises over this one. Stays 0 for the last scene. */
  cover: number;
  /** 0 when the scene's top is at the bottom of the stage, 1 when it has reached the top. */
  enter: number;
  /** 0 until the scene's pin lets go, 1 when the scene has left the stage. */
  leave: number;
  /** One stage, in px. */
  stage: number;
  width: number;
  shape: Shape;
  /** Scroll speed in stages per second, eased. Signed. */
  velocity: number;
}

export interface Scene {
  el: HTMLElement;
  update(measure: SceneMeasure): void;
  /** The last scene of the page: nothing rises over it, so all of its pin is its own. */
  last?: boolean;
  /** Where the scene comes to rest, as shares of its own scroll (`live`): the beats a step lands on. */
  stops?: number[];
}

/** A step or a held run moves at reading pace: stages per second, and how quickly it gets there and stops. */
const STEP = 1.05;
const RUN = 0.85;
const ACCEL = 1.9;
/** A press shorter than this (ms) is a tap: one step. Longer, and it runs until let go. */
const TAP = 240;

export interface Director {
  readonly stage: number;
  readonly width: number;
  readonly shape: Shape;
  add(scene: Scene): () => void;
  /** Measure again and redraw every scene (after fonts or layout the page knows about). */
  refresh(): void;
  /** Called after each layout measure, with the new shape. */
  onLayout(listener: (shape: Shape, changed: boolean) => void): void;
  /** Which scene is on stage, and how far the whole page has been read (0 to 1). */
  onProgress(listener: (index: number, sceneProgress: number, total: number) => void): void;
  /** Jump to a scene: an explicit action, eased, cancelled by any input. */
  goTo(index: number, within?: number): void;
  /** On to the next beat (1) or back to the one before (-1), at reading pace. */
  step(direction: 1 | -1): void;
  /** A button or key goes down: a tap will step, a hold runs steadily until `release`. */
  press(direction: 1 | -1): void;
  release(): void;
  destroy(): void;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function createDirector(root: HTMLElement, scroller: HTMLElement): Director {
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Fine pointers scroll in steps (wheels), so the position is eased more; touch scrolling is already continuous.
  const ease = reduced ? 0 : fine ? 0.11 : 0.045;
  const scenes: { scene: Scene; top: number; height: number; last: string; cover: number; failed: boolean }[] = [];
  const layoutListeners: ((shape: Shape, changed: boolean) => void)[] = [];
  const progressListeners: ((index: number, sceneProgress: number, total: number) => void)[] = [];
  const state = { stage: 0, width: 0, shape: 'wide' as Shape, y: 0, target: 0, velocity: 0, raf: 0, last: 0, visible: true, alive: true, force: true, jump: 0, jumpFrom: 0, jumpTo: 0, jumpAt: 0, jumping: false, scrollHeight: 0, reported: '' };
  // A drive: the scroller taken toward a goal at a capped speed (a step to the next beat, or a held run).
  const drive = { on: false, at: 0, goal: 0, speed: 0, cruise: STEP, pressed: 0 as -1 | 0 | 1, held: false, timer: 0, key: '' };

  const measure = (force = false) => {
    const width = root.clientWidth;
    const height = root.clientHeight;
    if (!width || !height) return;
    // Touch devices: a height-only change is a browser toolbar moving. Keep the geometry.
    // A few pixels of width either way come with it (rounding, or a scrollbar the
    // page behind gains while the toolbar shows): that is not a rotation.
    if (!force && !fine && state.stage && Math.abs(width - state.width) <= NOISE) return;
    const shape: Shape = width / height < TALL ? 'tall' : 'wide';
    const changed = shape !== state.shape || !state.stage;
    state.width = width;
    state.stage = height;
    state.shape = shape;
    root.dataset.shape = shape;
    root.style.setProperty('--stage', `${height}px`);
    layoutListeners.forEach(listener => listener(shape, changed));
    geometry();
  };
  // Scene positions inside the scroller's content. offsetTop is relative to the scroller (it is positioned).
  const geometry = () => {
    for (const entry of scenes) {
      let top = 0;
      for (let node: HTMLElement | null = entry.scene.el; node && node !== scroller; node = node.offsetParent as HTMLElement | null) top += node.offsetTop;
      entry.top = top;
      entry.height = entry.scene.el.offsetHeight;
    }
    state.scrollHeight = scroller.scrollHeight;
    state.force = true;
  };

  const frame = (now: number) => {
    state.raf = requestAnimationFrame(frame);
    // Never zero: two frames on one timestamp would divide the speed below by nothing.
    const dt = state.last ? Math.min(Math.max((now - state.last) / 1000, 0.001), 0.1) : 1 / 60;
    state.last = now;
    if (state.jumping) {
      const t = clamp01((now - state.jumpAt) / state.jump);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      scroller.scrollTop = state.jumpFrom + (state.jumpTo - state.jumpFrom) * eased;
      if (t >= 1) state.jumping = false;
    } else if (drive.on) {
      // Speed up to the cruising speed, and never faster than can still be stopped at the goal:
      // moving the goal (another tap, letting go of a hold) changes the speed smoothly, never the position.
      const remaining = drive.goal - drive.at;
      const rate = ACCEL * state.stage;
      const want = Math.sign(remaining) * Math.min(drive.cruise * state.stage, Math.sqrt(2 * rate * Math.abs(remaining)));
      const change = rate * dt;
      drive.speed += Math.max(-change, Math.min(change, want - drive.speed));
      let next = drive.at + drive.speed * dt;
      if ((drive.goal - drive.at) * (drive.goal - next) <= 0 || (Math.abs(drive.goal - next) < 0.6 && Math.abs(drive.speed) < rate * 0.05)) { next = drive.goal; drive.speed = 0; drive.on = false; }
      drive.at = next;
      scroller.scrollTop = next;
    }
    state.target = scroller.scrollTop;
    const before = state.y;
    const k = ease ? 1 - Math.exp(-dt / ease) : 1;
    state.y += (state.target - state.y) * k;
    if (Math.abs(state.target - state.y) < 0.05) state.y = state.target;
    const speed = state.stage ? (state.y - before) / state.stage / dt : 0;
    state.velocity += (speed - state.velocity) * (1 - Math.exp(-dt / 0.12));
    if (Math.abs(state.velocity) < 0.0005) state.velocity = 0;
    if (!state.force && state.y === before && state.velocity === 0) return;
    const { stage, y } = state;
    let onStage = 0;
    let within = 0;
    scenes.forEach((entry, index) => {
      const pinned = Math.max(entry.height - stage, 1);
      const own = entry.scene.last ? pinned : Math.max(pinned - stage, 1);
      const measured: SceneMeasure = {
        progress: clamp01((y - entry.top) / pinned),
        live: clamp01((y - entry.top) / own),
        cover: entry.scene.last ? 0 : clamp01((y - entry.top - own) / stage),
        enter: clamp01((y - (entry.top - stage)) / stage),
        leave: clamp01((y - (entry.top + entry.height - stage)) / stage),
        stage, width: state.width, shape: state.shape, velocity: state.velocity,
      };
      // The scene whose top has passed the middle of the stage most recently is the one on stage.
      if (y >= entry.top - stage * 0.5) { onStage = index; within = clamp01((y - entry.top) / Math.max(entry.height, 1)); }
      const key = `${measured.progress.toFixed(5)}|${measured.enter.toFixed(4)}|${measured.cover.toFixed(4)}|${measured.leave.toFixed(4)}|${measured.velocity.toFixed(3)}`;
      if (!state.force && key === entry.last) return;
      entry.last = key;
      // The hand-over is the same for every scene, so it lives in the stylesheet: the stage sinks back and dims.
      if (measured.cover !== entry.cover) { entry.cover = measured.cover; entry.scene.el.style.setProperty('--cover', measured.cover.toFixed(4)); }
      // A scene that cannot update must not take the ones after it, or the report below, down with it
      // (one call a browser refused once left the last scene dark and the rail dead): say so once, go on.
      try { entry.scene.update(measured); } catch (error) { if (!entry.failed) { entry.failed = true; console.error('Datum: a scene could not update.', error); } }
    });
    const total = clamp01(y / Math.max(state.scrollHeight - stage, 1));
    const report = `${onStage}|${within.toFixed(3)}|${total.toFixed(3)}`;
    if (report !== state.reported) { state.reported = report; progressListeners.forEach(listener => { try { listener(onStage, within, total); } catch (error) { console.error('Datum: progress could not be reported.', error); } }); }
    state.force = false;
  };
  const run = () => {
    if (state.raf || !state.visible || document.hidden || !state.alive) return;
    state.last = 0;
    state.raf = requestAnimationFrame(frame);
  };
  const halt = () => { cancelAnimationFrame(state.raf); state.raf = 0; };

  const visibility = new IntersectionObserver(entries => {
    state.visible = entries.some(entry => entry.isIntersecting);
    if (state.visible) { state.force = true; run(); } else halt();
  });
  visibility.observe(root);
  const onVisibility = () => { if (document.hidden) halt(); else run(); };
  document.addEventListener('visibilitychange', onVisibility);
  const sizes = new ResizeObserver(() => measure());
  sizes.observe(root);
  // Any input of the visitor's own ends a jump or a drive at once.
  const cancelJump = () => { state.jumping = false; drive.on = false; drive.speed = 0; drive.held = false; };
  for (const type of ['wheel', 'touchstart', 'pointerdown']) scroller.addEventListener(type, cancelJump, { passive: true });

  // Every place the page comes to rest, top to bottom, in px of scroll.
  const beats = () => {
    const end = Math.max(0, state.scrollHeight - state.stage);
    const list: number[] = [];
    for (const entry of scenes) {
      const pinned = Math.max(entry.height - state.stage, 1);
      const own = entry.scene.last ? pinned : Math.max(pinned - state.stage, 1);
      for (const share of entry.scene.stops ?? []) list.push(Math.min(end, entry.top + own * share));
    }
    if (!list.length || list[0] > 1) list.unshift(0);
    return list;
  };
  const beatAfter = (from: number, direction: 1 | -1) => {
    const slack = state.stage * 0.03;
    const list = beats();
    return direction > 0 ? list.find(stop => stop > from + slack) : [...list].reverse().find(stop => stop < from - slack);
  };
  const driveTo = (goal: number, cruise: number) => {
    state.jumping = false;
    if (!drive.on) { drive.at = scroller.scrollTop; drive.speed = 0; }
    Object.assign(drive, { on: true, goal, cruise });
    run();
  };
  const step = (direction: 1 | -1) => {
    // From where a step already under way is heading, so quick taps add up.
    const from = drive.on && Math.sign(drive.goal - drive.at) === direction ? drive.goal : scroller.scrollTop;
    const to = beatAfter(from, direction);
    if (to === undefined) return;
    if (reduced) { scroller.scrollTop = to; return; }
    driveTo(to, STEP);
  };
  const press = (direction: 1 | -1) => {
    clearTimeout(drive.timer);
    drive.pressed = direction;
    drive.held = false;
    if (reduced) return;
    drive.timer = window.setTimeout(() => {
      drive.timer = 0;
      if (drive.pressed !== direction) return;
      drive.held = true;
      driveTo(direction > 0 ? Math.max(0, state.scrollHeight - state.stage) : 0, RUN);
    }, TAP);
  };
  const release = () => {
    const direction = drive.pressed;
    drive.pressed = 0;
    if (!direction) return;
    if (drive.timer || reduced) { clearTimeout(drive.timer); drive.timer = 0; step(direction); return; }
    if (!drive.held || !drive.on) return;
    drive.held = false;
    // Let go: come to rest on the next beat if it is close, or else as soon as it can stop.
    const stopping = (drive.speed * drive.speed) / (2 * ACCEL * state.stage);
    const beat = beatAfter(drive.at - direction * state.stage * 0.03, direction);
    drive.goal = beat !== undefined && Math.abs(beat - drive.at) <= Math.max(stopping, state.stage * 0.45) ? beat : drive.at + direction * stopping;
  };
  // Keys, anywhere in the demo: the arrows and the page keys step and hold like the buttons, Space
  // steps (unless a button has the focus, where it presses that button), Home and End go to the ends.
  const KEYS: Record<string, 1 | -1> = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as Element | null;
    if (target?.closest?.('input, textarea, select, [contenteditable]')) return;
    const onControl = !!target?.closest?.('button, a');
    let direction: 1 | -1 | undefined = KEYS[event.key];
    if (!direction && event.key === ' ' && !onControl) direction = event.shiftKey ? -1 : 1;
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const to = event.key === 'Home' ? 0 : Math.max(0, state.scrollHeight - state.stage);
      drive.on = false;
      if (reduced) { scroller.scrollTop = to; return; }
      const distance = Math.abs(to - scroller.scrollTop) / Math.max(state.stage, 1);
      Object.assign(state, { jumping: true, jumpFrom: scroller.scrollTop, jumpTo: to, jumpAt: performance.now(), jump: Math.min(2200, 700 + distance * 260) });
      return;
    }
    if (!direction) return;
    event.preventDefault();
    if (event.repeat) return;
    drive.key = event.key;
    press(direction);
  };
  const onKeyUp = (event: KeyboardEvent) => { if (drive.key && event.key === drive.key) { drive.key = ''; release(); } };
  const letGo = () => { if (drive.pressed) { drive.key = ''; clearTimeout(drive.timer); drive.timer = 0; drive.pressed = 0; if (drive.held && drive.on) { drive.held = false; drive.goal = drive.at + Math.sign(drive.speed) * (drive.speed * drive.speed) / (2 * ACCEL * Math.max(state.stage, 1)); } } };
  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', letGo);

  measure(true);
  state.y = state.target = scroller.scrollTop;
  run();

  return {
    get stage() { return state.stage; },
    get width() { return state.width; },
    get shape() { return state.shape; },
    add(scene) {
      const entry = { scene, top: 0, height: 0, last: '', cover: 0, failed: false };
      scenes.push(entry);
      geometry();
      return () => { const index = scenes.indexOf(entry); if (index >= 0) scenes.splice(index, 1); };
    },
    refresh() { measure(true); },
    onLayout(listener) { layoutListeners.push(listener); listener(state.shape, true); },
    onProgress(listener) { progressListeners.push(listener); },
    goTo(index, within = 0) {
      const entry = scenes[index];
      if (!entry) return;
      const to = Math.min(entry.top + Math.max(0, entry.height - state.stage * (entry.scene.last ? 1 : 2)) * within, state.scrollHeight - state.stage);
      if (reduced) { scroller.scrollTop = to; return; }
      const distance = Math.abs(to - scroller.scrollTop) / Math.max(state.stage, 1);
      drive.on = false;
      Object.assign(state, { jumping: true, jumpFrom: scroller.scrollTop, jumpTo: to, jumpAt: performance.now(), jump: Math.min(2200, 700 + distance * 260) });
    },
    step,
    press,
    release,
    destroy() {
      state.alive = false;
      halt();
      visibility.disconnect();
      sizes.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      for (const type of ['wheel', 'touchstart', 'pointerdown']) scroller.removeEventListener(type, cancelJump);
      root.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', letGo);
      clearTimeout(drive.timer);
      root.style.removeProperty('--stage');
    },
  };
}
