"use client";

import { useEffect } from "react";

// Fetch. Each "yard" on the page (the hero's strip of ground, the footer) holds
// a wolf and a frisbee. Pick the frisbee up and the wolf follows it wherever it
// is carried; let go and it flies the way it was thrown, and the wolf runs,
// leaps and catches it. A plain click on the frisbee tosses it up. In the
// footer the wolf is asleep: picking the frisbee up wakes it, and afterwards
// it carries the frisbee home and goes back to sleep.
//
// The scenes themselves (markup in Arcade.tsx, entrances and resting poses in
// app/arcade.css) need none of this. The script takes over only while a game
// is on: it hides the resting wolf (.yard-rest), drives a second one
// (.yard-wolf) and the frisbee (.yard-disc) frame by frame, and hands back
// when it is over. It does nothing under prefers-reduced-motion.
//
// The wolf it drives has one sprite per pose, all on the page from the start
// (YardWolf in Arcade.tsx): the script shows the one in use and never changes
// a sprite's image, so a change of pose never waits for a file. The game is
// switched on only once every pose's strip has loaded.

const PX = 2; // screen pixels per sprite pixel

type Anchor = readonly [number, number];
// `ox` nudges a pose forward (sprite pixels) so its body lines up with the sitting wolf's.
type Pose = { img: string; w: number; h: number; n: number; ox?: number; mouth?: readonly Anchor[] };

// Sizes in sprite pixels, and where the mouth is in each frame ([from the
// left, from the bottom]), measured from the sprite strips. Keep in step
// with public/sprites and app/arcade.css: tests/landing-sprites.test.ts
// checks the sizes.
const SIT: Pose = { img: "wolf-sit-sm", w: 43, h: 42, n: 8, mouth: Array(8).fill([41, 29]) };
const RUN: Pose = { img: "wolf-run-sm", w: 45, h: 40, n: 8, mouth: Array(8).fill([43, 27]) };
const JUMP: Pose = {
  img: "wolf-jump-sm",
  w: 44,
  h: 42,
  n: 8,
  mouth: [
    [41, 25],
    [41, 17],
    [40, 25],
    [42, 33],
    [42, 32],
    [42, 25],
    [42, 16],
    [42, 25],
  ],
};
const BOW: Pose = { img: "wolf-bow-sm", w: 42, h: 37, n: 8, ox: 3 };
const LOOK: Pose = { img: "wolf-look-sm", w: 40, h: 44, n: 8, ox: 1 };
const WAKE: Pose = { img: "wolf-wake-sm", w: 43, h: 42, n: 8 };
const POSES = [SIT, RUN, JUMP, BOW, LOOK, WAKE];

const WOLF = 43 * PX; // the wolf's standing width: its place is the left edge of this box
// The frisbee's five attitudes: level (also lying and in the mouth), face toward us, nose up, nose
// down (drawn flying right; mirrored for left), edge on.
const DISC = { w: 21, h: 11, frames: 5 };
const [LEVEL, FACE, NOSE_UP, NOSE_DOWN, EDGE_ON] = [0, 1, 2, 3, 4];
const DISC_HALF = 7; // its middle is this high when it lies on the ground
// How high each frame's middle is in the strip (px): the level frame stands on the strip's bottom
// row, the tilted ones need the room above it.
const DISC_UP = [7, 10, 11, 11, 7];
const GRAB = 58; // width of the frisbee's grab area

const EDGE = 8; // the wolf stays this far inside the yard
const ROOM = 62; // and keeps this much in front of it, for the frisbee
const WALL = 70; // a thrown frisbee turns back this far from the yard's ends
const RUN_SPEED = 0.46; // px per ms
const STRIDE = 12; // px of ground per running frame, so the legs keep up with the ground
const REACT_MS = 110; // before the wolf sets off after a throw
const HOLD_MS = 950; // sitting with the frisbee before putting it down
const WAKE_MS = 380;

// How a thrown frisbee flies (px, ms). It has weight; its lift grows with the square of its forward
// speed, up to a little more than its weight, so a fast one flies level and climbs slightly; the air
// slows it (partly in proportion to its speed, partly to the square); falling flat it settles
// rather than drops; and out of speed on the way down it hooks back a little, the way they do.
const GRAVITY = 0.0011;
const LIFT = 0.0024;
const LIFT_MOST = 1.06;
const DRAG = 0.0007;
const DRAG_FAST = 0.0006;
const SINK = 0.0046;
const FADE = 0.0003;
const MAX_THROW = 2;
// Let go without a throw, it is tossed gently forward and up; thrown, it gets a little lift.
const TOSS = { across: 0.52, up: 0.3 };
const CLICK = { across: 0.3, up: 0.95 };
const STEP = 8; // ms between points of the worked-out flight
// The wolf can take it out of the air between these heights (mouth height at
// the top of a small hop and of its highest leap).
const MOUTH_UP = 64; // the mouth's height in the leaping pose
const CATCH_LOW = MOUTH_UP + 14;
const CATCH_HIGH = MOUTH_UP + 88;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Plan = {
  air: boolean; // caught in the air, or fetched from the ground
  xs: number[];
  ys: number[];
  last: number; // index of the flight's last point (the catch, or the landing)
  natural: number; // ms the flight takes left to itself
  total: number; // ms it is given (stretched when the wolf needs longer)
  dir: number;
  runTo: number;
  runMs: number;
  leapAt: number;
  leapMs: number;
  up: number;
  across: number;
  end: number; // where the wolf ends up
  fall: number; // how high it was (mid-hop) when the frisbee left the hand
  pickAt: number; // ground only: when it has the frisbee
};

function startYard(root: HTMLElement): () => void {
  const footer = root.dataset.yard === "footer";
  const rest = root.querySelector<HTMLElement>(".yard-rest");
  const wolf = root.querySelector<HTMLElement>(".yard-wolf");
  const disc = root.querySelector<HTMLElement>(".yard-disc");
  const discSprite = disc?.querySelector<HTMLElement>(".px");
  // each pose's own sprite
  const sprites = new Map<Pose, HTMLElement>();
  for (const p of POSES) {
    const el = wolf?.querySelector<HTMLElement>(`.px-${p.img}`);
    if (el) sprites.set(p, el);
  }
  if (!rest || !wolf || sprites.size !== POSES.length || !disc || !discSprite) return () => {};

  let mode: "rest" | "held" | "fly" | "won" | "home" = "rest";
  let raf = 0;
  let last = 0;
  let clock = 0; // ms into the current phase
  let width = 0;
  let ceiling = 0; // how high above the ground the frisbee may be carried
  // the wolf: its place (left edge), height off the ground, which way it faces
  let wx = 0;
  let wy = 0;
  let face = 1;
  let strides = 0;
  let pose = SIT;
  let frame = 0;
  let shown: Pose | null = null;
  // the frisbee's centre
  let dx = 0;
  let dy = 0;
  let dframe = LEVEL;
  // the footer wolf's bed
  let homeX = 0;
  let homeDisc = 0;
  let grab: { id: number; offX: number; offY: number; since: number; moved: number; still: number; hopAt: number; trail: { t: number; x: number; y: number }[] } | null = null;
  let plan: Plan | null = null;

  const origin = () => root.getBoundingClientRect();
  const measure = () => {
    const box = origin();
    width = box.width;
    const area = footer ? null : root.closest("section")?.getBoundingClientRect();
    ceiling = Math.max(120, area ? box.bottom - area.top - 12 : Math.min(box.bottom - 12, 640));
  };

  // The mouth, from the wolf's place and from the ground, whichever way it faces.
  const mouth = (p: Pose, f: number, facing: number) => {
    const [mx, my] = p.mouth?.[f] ?? SIT.mouth![0];
    return { x: facing > 0 ? mx * PX + 1 : WOLF - mx * PX - 1, y: my * PX };
  };
  const inMouth = (p: Pose, f: number, facing: number, x: number, y: number) => {
    const m = mouth(p, f, facing);
    return { x: x + m.x + facing * 5, y: Math.max(DISC_HALF, y + m.y) };
  };

  const render = () => {
    const sprite = sprites.get(pose)!;
    if (shown !== pose) {
      if (shown) sprites.get(shown)!.classList.remove("yard-on");
      sprite.classList.add("yard-on");
      // the holder is the pose's size: it is what gets placed and mirrored
      wolf.style.width = `${pose.w * PX}px`;
      wolf.style.height = `${pose.h * PX}px`;
      shown = pose;
    }
    sprite.style.backgroundPositionX = `${-frame * pose.w * PX}px`;
    // mirrored, a pose keeps its back where the standing wolf's back is
    const nudge = (pose.ox ?? 0) * PX;
    const box = face < 0 ? wx - (pose.w * PX - WOLF) - nudge : wx + nudge;
    wolf.style.translate = `${Math.round(box)}px ${-Math.round(wy)}px`;
    wolf.style.scale = `${face} 1`;
    disc.style.translate = `${Math.round(dx - GRAB / 2)}px ${-Math.round(Math.max(0, dy - DISC_UP[dframe]))}px`;
    discSprite.style.backgroundPositionX = `${-dframe * DISC.w * PX}px`;
    discSprite.style.scale = dframe === NOSE_UP || dframe === NOSE_DOWN ? `${heading} 1` : "";
  };
  const run = (to: number, dt: number) => {
    const gap = to - wx;
    const step = Math.sign(gap) * Math.min(Math.abs(gap), RUN_SPEED * dt);
    wx += step;
    strides += Math.abs(step);
    if (step) face = Math.sign(step);
    pose = RUN;
    frame = Math.floor(strides / STRIDE) % RUN.n;
    return Math.abs(to - wx) < 0.5;
  };
  const leapFrame = (u: number) => (u < 0.12 ? 3 : u < 0.62 ? 4 : u < 0.86 ? 5 : 6);

  // From the resting scene to the wolf the script drives.
  const takeOver = () => {
    measure();
    const box = origin();
    const at = rest.getBoundingClientRect();
    const d = discSprite.getBoundingClientRect();
    dx = (d.left + d.right) / 2 - box.left;
    dy = Math.max(DISC_HALF, box.bottom - (d.top + d.bottom) / 2);
    const arrived = footer || getComputedStyle(rest).opacity === "1";
    wx = arrived ? at.left - box.left : -130; // not here yet (the hero's entrance): it runs in from the edge
    face = !footer && arrived && getComputedStyle(root).getPropertyValue("--face").trim() === "-1" ? -1 : 1;
    wy = 0;
    strides = 0;
    pose = SIT;
    frame = 0;
    for (const el of sprites.values()) el.classList.remove("yard-on");
    shown = null;
    if (footer) {
      homeX = wx;
      homeDisc = dx;
    } else {
      root.setAttribute("data-played", "");
    }
    root.setAttribute("data-live", "");
    disc.style.left = "0px";
    render();
  };
  // Back to the resting scene.
  const handBack = () => {
    if (footer) {
      // asleep again, where it always sleeps; the z's start over
      disc.style.left = "";
      disc.style.translate = "";
      root.classList.remove("rv-in");
      void root.offsetWidth;
      root.classList.add("rv-armed", "rv-in");
    } else {
      root.style.setProperty("--rest", `${Math.round(wx)}px`);
      root.style.setProperty("--face", String(face));
      // the speech bubble opens away from the wolf, unless that is off the page
      const side = dx > width - 230 ? -1 : dx < 230 ? 1 : face;
      disc.style.setProperty("--tip", String(side));
    }
    root.removeAttribute("data-live");
    root.removeAttribute("data-busy");
    mode = "rest";
    plan = null;
  };

  // Work out the flight from where the frisbee is and how fast it left the hand, and what the wolf
  // does about it.
  const throwIt = (vx: number, vy: number) => {
    const xs = [dx];
    const ys = [dy];
    let x = dx;
    let y = dy;
    let catchAt = -1;
    const way = Math.abs(vx) >= 0.25 ? Math.sign(vx) : 0;
    for (let t = 0; t < 3200; t += STEP) {
      if (way && vy < 0 && Math.abs(vx) < 0.4 && vx * way > -0.05) vx -= way * FADE * STEP;
      vy += (Math.min(LIFT * vx * vx, GRAVITY * LIFT_MOST) - GRAVITY) * STEP;
      vy *= 1 - SINK * STEP;
      vx -= Math.sign(vx) * (DRAG * Math.abs(vx) + DRAG_FAST * vx * vx) * STEP;
      x += vx * STEP;
      y += vy * STEP;
      // near the edge of the page it turns back, softly
      if ((x < WALL && vx < 0) || (x > width - WALL && vx > 0)) vx *= -0.35;
      if (y <= DISC_HALF) {
        xs.push(x);
        ys.push(DISC_HALF);
        break;
      }
      xs.push(x);
      ys.push(y);
      if (catchAt < 0 && vy < 0 && y <= CATCH_HIGH && y >= CATCH_LOW) catchAt = xs.length - 1;
    }
    const middle = wx + WOLF / 2;
    // where the wolf may be, facing that way: inside the yard, with room in front of it for the frisbee
    const span = (d: number) => [EDGE + (d < 0 ? ROOM : 0), width - WOLF - EDGE - (d > 0 ? ROOM : 0)] as const;
    if (catchAt >= 0) {
      // In the air: the mouth has to be at this point at the top of a leap.
      const cx = xs[catchAt];
      const up = ys[catchAt] - MOUTH_UP;
      const leapMs = 430 + up * 2.3;
      const reach = 30 + up * 0.55; // how far a leap this high carries it
      let dir = cx >= middle ? 1 : -1;
      let top = cx - mouth(JUMP, 4, dir).x - dir * 5;
      if ((top - wx) * dir < 0) {
        dir = -dir;
        top = cx - mouth(JUMP, 4, dir).x - dir * 5;
      }
      const [lo, hi] = span(dir);
      top = clamp(top, lo, hi);
      const far = (top - wx) * dir;
      // a run and a full leap, or, too close for that, straight up drifting onto it
      const across = far >= reach / 2 ? reach * dir : 2 * (top - wx);
      const runTo = clamp(far >= reach / 2 ? top - across / 2 : wx, lo, hi);
      const end = clamp(runTo + across, lo, hi);
      const runMs = Math.abs(runTo - wx) / RUN_SPEED;
      const natural = Math.max(1, catchAt * STEP);
      const total = Math.max(natural, REACT_MS + runMs + leapMs / 2, 280);
      plan = { air: true, xs, ys, last: catchAt, natural, total, dir, runTo, runMs, leapAt: total - leapMs / 2, leapMs, up, across: end - runTo, end, fall: wy, pickAt: total };
    } else {
      // It comes down first: fetch it from the ground.
      const at = xs.length - 1;
      const lx = xs[at];
      let dir = lx >= middle ? 1 : -1;
      let stand = lx - mouth(JUMP, 1, dir).x - dir * 5;
      if ((stand - wx) * dir < 0) {
        dir = -dir;
        stand = lx - mouth(JUMP, 1, dir).x - dir * 5;
      }
      stand = clamp(stand, ...span(dir));
      const runMs = Math.abs(stand - wx) / RUN_SPEED;
      const natural = Math.max(1, at * STEP);
      plan = { air: false, xs, ys, last: at, natural, total: natural, dir, runTo: stand, runMs, leapAt: 0, leapMs: 0, up: 0, across: 0, end: stand, fall: wy, pickAt: Math.max(natural + 60, REACT_MS + runMs) + 150 };
    }
    grab = null;
    root.removeAttribute("data-held");
    root.setAttribute("data-busy", "");
    clock = 0;
    mode = "fly";
  };
  // Where the flight has got to. Stretched flights start at the speed they were thrown and hang
  // at the end.
  const flight = (p: Plan, t: number) => {
    const u = clamp(t / p.total, 0, 1);
    const stretch = p.total / p.natural;
    const at = (p.natural * (1 - Math.pow(1 - u, stretch))) / STEP;
    const i = Math.min(p.last - 1, Math.floor(at));
    const f = clamp(at - i, 0, 1);
    if (i < 0) return { x: p.xs[0], y: p.ys[0], vx: 0, vy: 0 };
    const sx = p.xs[i + 1] - p.xs[i];
    const sy = p.ys[i + 1] - p.ys[i];
    return { x: p.xs[i] + sx * f, y: p.ys[i] + sy * f, vx: sx / STEP, vy: sy / STEP };
  };
  // How the frisbee is seen in flight: nose up as it climbs, nose down as it dives, level with a
  // shimmer in between, and its face as it stalls and settles.
  let heading = 1;
  const attitude = (vx: number, vy: number, t: number) => {
    if (Math.abs(vx) > 0.04) heading = Math.sign(vx);
    const across = Math.abs(vx);
    const tilt = Math.atan2(vy, across);
    if (across < 0.15) return vy < 0 ? (Math.floor(t / 170) % 2 ? FACE : LEVEL) : Math.floor(t / 120) % 2 ? LEVEL : EDGE_ON;
    if (tilt > 0.22) return NOSE_UP;
    if (tilt < -0.4) return NOSE_DOWN;
    return Math.floor(t / 150) % 2 ? LEVEL : EDGE_ON;
  };

  const tick = (now: number) => {
    const dt = Math.min(34, now - last);
    last = now;
    clock += dt;

    if (mode === "held" && grab) {
      const waking = footer && now - grab.since < WAKE_MS;
      const want = clamp(dx - WOLF / 2, EDGE, width - WOLF - EDGE);
      const hopping = now - grab.hopAt < 420;
      const moving = pose === RUN;
      wy = 0;
      if (waking) {
        pose = WAKE;
        frame = Math.min(WAKE.n - 1, Math.floor(((now - grab.since) / WAKE_MS) * WAKE.n));
      } else if (hopping) {
        const u = (now - grab.hopAt) / 420;
        pose = JUMP;
        frame = leapFrame(u);
        wy = 34 * 4 * u * (1 - u);
      } else if (Math.abs(want - wx) > (moving ? 3 : 22)) {
        run(want, dt);
      } else {
        // under it, waiting: facing it, wagging; a bow when it is held still, a hop when it is close
        const middle = wx + WOLF / 2;
        if (Math.abs(dx - middle) > 14) face = dx > middle ? 1 : -1;
        if (dy < MOUTH_UP + 70 && Math.abs(dx - middle) < 54 && now - grab.hopAt > 1250) {
          grab.hopAt = now;
        } else if (now - grab.still > 700) {
          pose = BOW;
          frame = Math.floor(now / 70) % BOW.n;
        } else if (dy > 170) {
          pose = LOOK;
          frame = Math.floor(now / 75) % LOOK.n;
        } else {
          pose = SIT;
          frame = Math.floor(now / 65) % SIT.n;
        }
      }
      dframe = LEVEL;
    } else if (mode === "fly" && plan) {
      const p = plan;
      const t = clock;
      wy = 0;
      if (p.air && t >= p.leapAt + p.leapMs) {
        wx = p.end;
        mode = "won";
        clock = 0;
      } else if (p.air && t >= p.leapAt) {
        const u = (t - p.leapAt) / p.leapMs;
        pose = JUMP;
        frame = leapFrame(u);
        face = p.dir;
        wx = p.runTo + p.across * u;
        wy = p.up * 4 * u * (1 - u);
      } else if (!p.air && t >= p.pickAt) {
        wx = p.end;
        mode = "won";
        clock = 0;
      } else if (!p.air && t >= p.pickAt - 150 && Math.abs(p.runTo - wx) < 1) {
        pose = JUMP; // head down to it
        frame = 1;
        face = p.dir;
      } else if (t < REACT_MS) {
        // a beat before it sets off; if it was mid-hop, it comes down first
        pose = p.fall > 0 ? JUMP : SIT;
        frame = p.fall > 0 ? 5 : 0;
        wy = p.fall * (1 - t / REACT_MS);
      } else if (Math.abs(p.runTo - wx) >= 0.5) {
        run(p.runTo, dt);
      } else {
        pose = LOOK; // there first: watching it come down
        frame = Math.floor(now / 75) % LOOK.n;
        face = p.dir;
      }
      // the frisbee
      if (mode === "won" || (!p.air && t >= p.pickAt)) {
        const m = inMouth(SIT, 0, face, wx, 0);
        dx = m.x;
        dy = m.y;
        dframe = LEVEL;
      } else if (p.air && t >= p.total) {
        // caught: it comes down with the wolf
        const m = inMouth(pose, frame, face, wx, wy);
        dx = m.x;
        dy = m.y;
        dframe = LEVEL;
      } else {
        const at = flight(p, t);
        // close in on the mouth over the last stretch (of the flight, or of the head going down
        // to it), so the catch is exact
        const near = p.air ? clamp((t / p.total - 0.7) / 0.3, 0, 1) : clamp((t - p.pickAt + 150) / 150, 0, 1);
        const m = p.air ? inMouth(JUMP, 4, p.dir, p.runTo + p.across / 2, p.up) : inMouth(JUMP, 1, p.dir, p.end, 0);
        // (and it bobs a little on the air until then)
        const bob = t < p.total ? Math.sin(t / 85) * 1.6 * (1 - near) : 0;
        dx = at.x + (m.x - at.x) * near * near;
        dy = Math.max(DISC_HALF, at.y + bob + (m.y - at.y) * near * near);
        dframe = t < p.total ? attitude(at.vx, at.vy, t) : LEVEL;
      }
    } else if (mode === "won") {
      // sitting with it, wagging; then it is put down (hero) or carried home (footer)
      pose = SIT;
      frame = Math.floor(clock / 100) % SIT.n;
      wy = 0;
      const m = inMouth(SIT, frame, face, wx, 0);
      const front = clamp(wx + WOLF / 2 + face * (WOLF / 2 + 28), 24, width - 24);
      if (clock < (footer ? HOLD_MS / 2 : HOLD_MS)) {
        dx = m.x;
        dy = m.y;
      } else if (footer) {
        mode = "home";
        clock = 0;
      } else if (clock < HOLD_MS + 220) {
        const u = (clock - HOLD_MS) / 220;
        dx = m.x + (front - m.x) * u;
        dy = Math.max(DISC_HALF, m.y * (1 - u * u));
        dframe = FACE;
      } else {
        dx = front;
        dy = DISC_HALF;
        dframe = LEVEL;
        render();
        handBack();
        return;
      }
    } else if (mode === "home") {
      // carries it to bed, puts it down, lies down
      const there = Math.abs(homeX - wx) < 0.5;
      if (!there) {
        run(homeX, dt);
        const m = inMouth(RUN, frame, face, wx, 0);
        dx = m.x;
        dy = m.y;
        clock = 0;
      } else if (clock < 260) {
        face = 1;
        pose = SIT;
        frame = 0;
        const m = inMouth(SIT, 0, 1, wx, 0);
        const u = clock / 260;
        dx = m.x + (homeDisc - m.x) * u;
        dy = Math.max(DISC_HALF, m.y * (1 - u * u));
        dframe = FACE;
      } else if (clock < 1500) {
        pose = SIT;
        frame = Math.floor(clock / 100) % SIT.n;
        dx = homeDisc;
        dy = DISC_HALF;
        dframe = LEVEL;
      } else if (clock < 2000) {
        pose = WAKE; // lying down is waking up backwards
        frame = WAKE.n - 1 - Math.min(WAKE.n - 1, Math.floor(((clock - 1500) / 500) * WAKE.n));
      } else {
        render();
        handBack();
        return;
      }
    }
    render();
    raf = requestAnimationFrame(tick);
  };

  const local = (event: PointerEvent) => {
    const box = origin();
    return { x: event.clientX - box.left, y: box.bottom - event.clientY };
  };
  const onDown = (event: PointerEvent) => {
    if (mode !== "rest" || event.button !== 0) return;
    event.preventDefault();
    takeOver();
    const p = local(event);
    const now = performance.now();
    grab = { id: event.pointerId, offX: p.x - dx, offY: p.y - dy, since: now, moved: 0, still: now, hopAt: 0, trail: [{ t: now, x: dx, y: dy }] };
    disc.setPointerCapture(event.pointerId);
    root.setAttribute("data-held", "");
    mode = "held";
    last = now;
    raf = requestAnimationFrame(tick);
  };
  const onMove = (event: PointerEvent) => {
    if (!grab || event.pointerId !== grab.id) return;
    const p = local(event);
    const now = performance.now();
    const x = clamp(p.x - grab.offX, 14, width - 14);
    const y = clamp(p.y - grab.offY, DISC_HALF, ceiling);
    const step = Math.hypot(x - dx, y - dy);
    grab.moved += step;
    if (step > 1.5) grab.still = now;
    dx = x;
    dy = y;
    grab.trail.push({ t: now, x, y });
    if (grab.trail.length > 16) grab.trail.shift();
  };
  const onUp = (event: PointerEvent) => {
    if (!grab || event.pointerId !== grab.id) return;
    const now = performance.now();
    const trail = grab.trail;
    const tip = trail[trail.length - 1];
    let vx = 0;
    let vy = 0;
    const away = dx >= wx + WOLF / 2 ? 1 : -1; // the side of the wolf it is on
    if (grab.moved < 6 && now - grab.since < 400) {
      // a click, not a carry: toss it up, away from the wolf
      vx = away * CLICK.across;
      vy = CLICK.up;
    } else {
      if (now - tip.t < 80) {
        // still moving when let go: it keeps the hand's speed over the last tenth of a second
        const back = trail.find((s) => tip.t - s.t <= 100) ?? tip;
        const ms = tip.t - back.t;
        if (ms >= 12) {
          vx = (tip.x - back.x) / ms;
          vy = (tip.y - back.y) / ms;
        }
      }
      if (Math.hypot(vx, vy) < 0.25) {
        // just let go: a gentle toss, the way it was last being carried, or else away from the wolf
        const drift = tip.x - (trail.find((s) => tip.t - s.t <= 450) ?? tip).x;
        vx = (Math.abs(drift) > 12 ? Math.sign(drift) : away) * TOSS.across;
        vy = TOSS.up;
      } else if (vy > -0.5) {
        vy = Math.max(vy, 0) + 0.26; // thrown: a little lift under it, unless it was thrown at the ground
      }
      const speed = Math.hypot(vx, vy);
      if (speed > MAX_THROW) {
        vx *= MAX_THROW / speed;
        vy *= MAX_THROW / speed;
      }
    }
    throwIt(vx, vy);
  };
  // After a game the hero's wolf and frisbee are placed in pixels: on a resize, back to their own spots.
  const onResize = () => {
    if (mode !== "rest" || footer || !root.style.getPropertyValue("--rest")) return;
    root.style.removeProperty("--rest");
    root.style.removeProperty("--face");
    disc.style.removeProperty("--tip");
    disc.style.left = "";
    disc.style.translate = "";
  };

  disc.addEventListener("pointerdown", onDown);
  disc.addEventListener("pointermove", onMove);
  disc.addEventListener("pointerup", onUp);
  disc.addEventListener("pointercancel", onUp);
  disc.addEventListener("lostpointercapture", onUp); // however the hold ends, it counts as letting go
  window.addEventListener("resize", onResize);
  // The frisbee can be picked up once every pose's strip is here: a wolf that turned into a pose
  // still on its way would not be drawn until it arrived. (If one never arrives, there is no game:
  // the scene stays as it is.)
  let stopped = false;
  const strips = Array.from(sprites.values(), (el) => /url\("?([^")]+)"?\)/.exec(getComputedStyle(el).backgroundImage)?.[1] ?? "");
  Promise.all(
    strips.map((src) => {
      const image = new Image();
      image.src = src;
      return image.decode();
    }),
  ).then(
    () => {
      if (!stopped) root.setAttribute("data-ready", "");
    },
    () => {},
  );
  return () => {
    stopped = true;
    disc.removeEventListener("pointerdown", onDown);
    disc.removeEventListener("pointermove", onMove);
    disc.removeEventListener("pointerup", onUp);
    disc.removeEventListener("pointercancel", onUp);
    disc.removeEventListener("lostpointercapture", onUp);
    window.removeEventListener("resize", onResize);
    cancelAnimationFrame(raf);
    root.removeAttribute("data-ready");
  };
}

export default function WolfPlay() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const stops = Array.from(document.querySelectorAll<HTMLElement>("[data-yard]"), startYard);
    return () => stops.forEach((stop) => stop());
  }, []);
  return null;
}
