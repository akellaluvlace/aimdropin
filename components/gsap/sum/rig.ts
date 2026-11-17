// The watch's choreography: where the camera is and where every part is, for any place on the page.
// A pure function of the scroll position (in screens, see score.ts) and the picture's shape, plus two
// things that run in their own time: the hands, which chase the visitor's local time, and the rotor,
// which swings as a rotor does. It only writes numbers into the watch's state; watch.ts draws them.
//
// Two layouts. On a wide stage the picture is the whole stage, the words keep its left side and the
// watch its right. On a tall one (a phone) the picture is the top of the stage and the words are under
// it, so everything is centred in a picture of its own.

import { HEIGHTS, type PartId, type Watch } from './gl/watch';
import { SCORE, STOPS, along, clamp01, type StopId } from './score';

export type Layout = 'wide' | 'tall';
type Ease = (t: number) => number;

const deg = (degrees: number) => (degrees * Math.PI) / 180;
const linear: Ease = t => t;
const inOut: Ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const out: Ease = t => 1 - Math.pow(1 - t, 3);
const into: Ease = t => t * t * t;
/** An explosion: nearly all of the way at once, then a long drift to rest. */
const burst: Ease = t => (1 - Math.pow(2, -9 * t)) / (1 - Math.pow(2, -9));
/** Glides through a hold: even in the middle, eased at both ends. */
const glide: Ease = t => t * t * (3 - 2 * t);

/** How far each part travels along the watch's axis when it comes apart, mm. The case stays. */
export const APART: Record<StopId, number> = { crystal: 62, hands: 43, dial: 24, case: 0, calibre: -27, rotor: -49, caseback: -68 };
/** A tall picture has less room along the axis: the parts stop closer together there. */
const SPREAD: Record<Layout, number> = { wide: 1, tall: 0.62 };
const middle = (id: StopId) => (id === 'hands' ? 3.06 : (HEIGHTS[id][0] + HEIGHTS[id][1]) / 2);
/** Where a part's middle is on the axis once the watch is apart. */
export const apartAt = (id: StopId, layout: Layout) => APART[id] * SPREAD[layout] + middle(id);
/** At their own stop the three hands come apart along the axis, this far from one to the next (mm): each is seen whole, on its own tube. */
const HANDS_APART = 6.5;
/**
 * When they come apart, in screens: they start this long before the tour arrives at them (they are in the
 * picture by then), each takes this long, and the hour hand waits this long for the seconds hand. The last is
 * done 0.12 of a screen after arriving, and the page rests on them at 0.2.
 */
const HANDS_OPEN = [0.2, 0.24, 0.08] as const;
/** The case comes into the picture turned this far about its axis (degrees), in the sense the dial left in. */
const CASE_TURNED = 46;
/** And comes round to straight within this much scroll of arriving (screens): done before its rest, 0.3 in. */
const CASE_ROUND = 0.27;
/** It starts back to the line this much before its stop ends (screens): see where the parts are placed. */
const CASE_LEAD = 0.1;
/** Parts leave in this order (outermost first) and come home in the other. */
const LEAVE: Record<StopId, number> = { crystal: 0, caseback: 0.02, hands: 0.07, rotor: 0.09, dial: 0.14, calibre: 0.16, case: 0 };
const HOME: Record<StopId, number> = { dial: 0, calibre: 0.03, hands: 0.08, rotor: 0.11, crystal: 0.16, caseback: 0.2, case: 0 };
/** A small tumble as each part leaves, degrees about x and y, gone by the time it rests. */
const TUMBLE: Record<StopId, [number, number]> = { crystal: [9, -6], hands: [-7, 10], dial: [6, 8], case: [-3, 4], calibre: [-8, -6], rotor: [12, 9], caseback: [-9, 7] };
/** The shapes the camera's path was composed for: a 16:10 stage, and a phone's picture. */
const COMPOSED: Record<Layout, number> = { wide: 1.6, tall: 0.8 };
/**
 * A picture narrower than the one a path was composed for shows the same scene, smaller: everything is
 * measured across it. A wider one keeps the scene's size, and has more room at the sides.
 */
const narrower = (layout: Layout, aspect: number) => Math.max(1, COMPOSED[layout] / aspect);
/**
 * The tour takes one part at a time out of the line, sideways, to look at it on its own: this far, mm.
 * Sideways is up on a wide stage and to the right in a tall picture, and far enough that the rest of
 * the line is out of the picture whatever its shape.
 */
const laneOf = (layout: Layout, aspect: number) => (layout === 'wide' ? Math.max(84, 37 * narrower(layout, aspect) + 28) : Math.max(60, 36 * Math.max(aspect, COMPOSED.tall) + 28));

/** A camera position at a place on the page. Angles in degrees; anything left out carries on from the row before. */
interface Shot { at: number; el?: number; span?: number; tz?: number; tx?: number; ty?: number; shiftX?: number; shiftY?: number; roll?: number; az?: number; ease?: Ease }
type Filled = Required<Omit<Shot, 'ease'>> & { ease: Ease };

/**
 * The camera's path. Wide stages lay the watch's axis across the screen (the camera comes round to
 * 9 o'clock and rolls a quarter turn, so 12 o'clock stays up); tall pictures stand it upright.
 */
function shots(layout: Layout, aspect: number): Filled[] {
  const wide = layout === 'wide';
  const z = (id: StopId) => apartAt(id, layout);
  const k = narrower(layout, aspect);
  // How much of the scene fills the picture's height, mm.
  const fit = (wideSpan: number, tallSpan: number) => (wide ? wideSpan : tallSpan) * k;
  // Where the part being looked at sits: on a wide stage clear of the words, to the right.
  const aside = { shiftX: wide ? 0.36 : 0, shiftY: 0 };
  const whole = { shiftX: wide ? 0.34 : 0, shiftY: 0 };
  const centred = { shiftX: wide ? 0 : -0.14, shiftY: wide ? -0.10 : 0 };
  const distance = laneOf(layout, aspect);
  const lane = wide ? { tx: 0, ty: distance } : { tx: distance, ty: 0 };
  const axis = { tx: 0, ty: 0 };
  /** A point on the part being looked at, from its middle (the calibre's balance). */
  const onPart = (x: number, y: number) => ({ tx: lane.tx + x, ty: lane.ty + y });
  const rows: Shot[] = [
    { at: 0, az: wide ? -90 : 0, roll: wide ? -90 : 0, el: 90, span: fit(75, 68), tx: 0, ty: 0, tz: 0, ...whole },
    { at: SCORE.ready[0] },
    { at: SCORE.ready[1], el: 60, span: fit(104, 88), ...centred },
    { at: SCORE.burst[1], el: wide ? 30 : 38, span: fit(106, 108), tz: -3, ease: out },
    { at: STOPS[0].from, el: wide ? 27 : 35, roll: wide ? -88 : 2, ease: linear },
    // The crystal: looked at across its surface, where glass shows.
    { at: STOPS[0].arrive, el: 50, span: fit(62, 57), tz: z('crystal'), roll: wide ? -90 : 0, ...aside, ...lane },
    { at: STOPS[0].leave, el: 38, span: fit(60, 56), roll: wide ? -85 : 4, ease: glide },
    // The hands.
    { at: STOPS[1].arrive, el: 66, span: fit(48, 46), tz: z('hands'), roll: wide ? -90 : 0, ...aside },
    { at: STOPS[1].leave, el: 57, span: fit(46, 45), ease: glide },
    // The dial: nearly face on, then let the light run across it.
    { at: STOPS[2].arrive, el: 76, span: fit(56, 58), tz: z('dial'), ...aside },
    { at: STOPS[2].leave, el: 60, span: fit(54, 57), ease: glide },
    // The case: it comes in from low down, for its flanks, turned the way the dial went out; comes round to
    // face the visitor before the page rests on it (CASE_ROUND); and is left straight on, with a slow drift.
    { at: STOPS[3].arrive, el: 22, span: fit(70, 69), tz: 0, roll: wide ? -94 : -4, ...aside },
    // (Straight on it stands taller than it lay: in a tall picture it is a little smaller and lower, so that on a
    // short phone its lugs keep clear of the bar.)
    { at: STOPS[3].arrive + CASE_ROUND, el: 80, span: fit(74, 76), roll: wide ? -90 : 0, shiftY: wide ? 0 : -0.07, ease: glide },
    { at: STOPS[3].leave, el: 84, ease: linear },
    // The calibre: its plain side, turned over to its bridges, then close on the balance.
    { at: STOPS[4].arrive, el: 68, span: fit(48, 50), tz: z('calibre'), roll: wide ? -90 : 0, ...aside },
    { at: SCORE.calibreTurn[0], el: 66, ease: glide },
    { at: SCORE.calibreTurn[1], el: 72, span: fit(46, 49) },
    // Close on the balance, which the calibre turns to bring round to the words' side (BALANCE, below). On a
    // wide stage the camera aims at it; in a tall picture the movement fills the picture, clear of the wordmark's corner.
    { at: SCORE.calibreMacro[1], el: 78, span: fit(25, 27), ...(wide ? onPart(-5.5, -3.2) : onPart(0, 0)), shiftX: wide ? 0.45 : 0.29, shiftY: wide ? -0.04 : 0, ease: glide },
    // And a slow drift across it, so the close-up is still alive where the page rests.
    { at: STOPS[4].leave, el: 80, span: fit(24.2, 26.2), ...(wide ? onPart(-5.2, -2.9) : onPart(-0.6, 0.5)), ease: linear },
    // The rotor.
    { at: STOPS[5].arrive, el: 62, span: fit(46, 46), tz: z('rotor'), ...lane, ...aside, ease: glide },
    { at: STOPS[5].leave, el: 54, span: fit(44, 45), ease: glide },
    // The caseback, turned to its engraved side.
    { at: STOPS[6].arrive, el: 80, span: fit(58, 61), tz: z('caseback'), ...aside },
    { at: STOPS[6].leave, el: 66, span: fit(56, 59), roll: wide ? -86 : 4, ease: glide },
    // Back to the whole stack, and together.
    { at: SCORE.regroup[1], el: wide ? 30 : 38, span: fit(106, 108), tz: -3, roll: wide ? -90 : 0, ...centred, ...axis, ease: glide },
    { at: SCORE.rejoin[1], el: 58, span: fit(84, 77), tz: 0, ...whole },
    { at: SCORE.turnOver[0], el: 55, ease: linear },
    { at: SCORE.turnOver[1], el: 80, span: fit(78, 72) },
    { at: SCORE.turnBack[0], el: 77, ease: linear },
    { at: SCORE.turnBack[1], el: 90, span: fit(75, 68) },
    // The faces: a slow lean toward the light and back, so each new dial is seen to catch it.
    { at: SCORE.faces[1], el: 78, span: fit(70, 64), roll: wide ? -93 : -3, ease: glide },
    { at: SCORE.wornIn[0], el: 90, span: fit(75, 68), roll: wide ? -90 : 0, ease: glide },
    // The page ends where it began: the watch, running.
    { at: SCORE.end },
  ];
  const filled: Filled[] = [];
  let last: Filled = { at: 0, el: 90, span: 80, tz: 0, tx: 0, ty: 0, shiftX: 0, shiftY: 0, roll: 0, az: 0, ease: inOut };
  for (const row of rows) { last = { ...last, ...row, ease: row.ease ?? inOut }; filled.push(last); }
  return filled;
}

const FIELDS = ['el', 'span', 'tz', 'tx', 'ty', 'shiftX', 'shiftY', 'roll', 'az'] as const;
function cameraAt(rows: Filled[], at: number, into: Record<(typeof FIELDS)[number], number>) {
  let index = 1;
  while (index < rows.length - 1 && rows[index].at < at) index++;
  const from = rows[index - 1], to = rows[index];
  const t = to.at === from.at ? 1 : to.ease(clamp01((at - from.at) / (to.at - from.at)));
  for (const field of FIELDS) into[field] = from[field] + (to[field] - from[field]) * t;
}

/** Hands' angles for a time of day, radians clockwise from 12. The seconds hand steps eight times a second, as this calibre beats. */
export function timeAngles(date: Date) {
  const seconds = Math.floor((date.getSeconds() + date.getMilliseconds() / 1000) * 8) / 8;
  const minutes = date.getMinutes() + seconds / 60;
  const hours = (date.getHours() % 12) + minutes / 60;
  return { hour: (hours / 12) * Math.PI * 2, minute: (minutes / 60) * Math.PI * 2, second: (seconds / 60) * Math.PI * 2 };
}
const CATALOGUE = { hour: deg(304), minute: deg(48), second: 0 }; // eight minutes past ten, as watches are photographed
const nearest = (from: number, to: number) => { let d = (to - from) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

export interface Rig {
  /**
   * Put the watch where `at` (screens of scroll) says, for a picture of this layout and shape (width over
   * height). `velocity` is the scroll's speed in screens a second (it swings the rotor), `seconds` the time
   * since the last call. Returns true while something is still moving by itself, so the caller keeps drawing.
   */
  update(at: number, velocity: number, layout: Layout, aspect: number, seconds: number): boolean;
  /** The time the hands show (their own, not the device's, while the watch is apart). */
  readonly stopped: Date | null;
  /** Start the hands from noon, to wind up to the time (the entrance), after holding them there for `hold` seconds. */
  wind(hold?: number): void;
  /** The face picked at the end of the page: the seconds hand sweeps it in, in its own time. */
  choose(face: string): void;
  /**
   * Lean the camera off the vertical, in degrees: `x` to the right, `y` up. Only where the watch lies whole
   * and face up (the first screen and the last); it is eased, and fades out as the page moves on.
   */
  lean(x: number, y: number): void;
}

export function createRig(watch: Watch, now: () => Date = () => new Date()): Rig {
  const { state } = watch;
  // The path for the picture as it is now: worked out again only when its layout or shape changes.
  const path = { layout: '' as Layout | '', aspect: 0, rows: [] as Filled[], lane: 0 };
  const camera = { el: 90, span: 80, tz: 0, tx: 0, ty: 0, shiftX: 0, shiftY: 0, roll: 0, az: 0 };
  const shown = { hour: 0, minute: 0, second: 0 };
  let stopped: Date | null = null;
  const rotor = { angle: 0, speed: 0 };
  let caught = false, held = 0;
  // The face chosen at the end, and the one being swept in over it.
  const chosen = { face: 'dial-silver', next: 'dial-silver', sweep: 0 };
  const leaning = { toX: 0, toY: 0, x: 0, y: 0 };

  const update: Rig['update'] = (at, velocity, layout, aspect, seconds) => {
    // ---------- Camera ----------
    if (path.layout !== layout || Math.abs(path.aspect - aspect) > 0.004) Object.assign(path, { layout, aspect, rows: shots(layout, aspect), lane: laneOf(layout, aspect) });
    cameraAt(path.rows, at, camera);
    // A lean toward the pointer (or a slow sway, on a phone) while the watch lies whole and face up. Straight
    // down, any angle round the axis shows the same picture, so the camera can leave the vertical any way.
    const ease = seconds > 0 ? 1 - Math.exp(-seconds / 0.45) : 1;
    leaning.x += (leaning.toX - leaning.x) * ease;
    leaning.y += (leaning.toY - leaning.y) * ease;
    const still = Math.max(1 - along(at, 0.06, 0.4), along(at, SCORE.wornOut[1] - 0.15, SCORE.yours));
    const leanX = leaning.x * still, leanY = leaning.y * still, leant = Math.hypot(leanX, leanY);
    if (leant > 1e-3) { const round = (Math.atan2(leanX, -leanY) * 180) / Math.PI; camera.az = round; camera.roll = round; camera.el = 90 - leant; }
    Object.assign(state.camera, { az: deg(camera.az), el: deg(camera.el), roll: deg(camera.roll), span: camera.span, tx: camera.tx, ty: camera.ty, tz: camera.tz, shiftX: camera.shiftX, shiftY: camera.shiftY });

    // ---------- Parts: apart, toured, together ----------
    const apartBy = (id: StopId) => {
      if (at <= SCORE.regroup[1]) return burst(along(at, SCORE.burst[0] + LEAVE[id], SCORE.burst[1] - 0.25 + LEAVE[id]));
      return 1 - into(along(at, SCORE.rejoin[0] + HOME[id], SCORE.rejoin[1] - 0.2 + HOME[id]));
    };
    const tumble = along(at, SCORE.burst[0], SCORE.burst[1]);
    const wobble = Math.sin(tumble * Math.PI) * (1 - tumble) * 1.7;
    for (const stop of STOPS) {
      const id = stop.id as StopId, pose = state.parts[id as PartId];
      pose.z = APART[id] * SPREAD[layout] * apartBy(id);
      // Out of the line into the lane while the tour looks at it, and back as the next one comes out.
      const index = STOPS.indexOf(stop), next = STOPS[index + 1];
      // (The case, left straight on, is nearer the camera than the calibre it makes way for, and so goes by
      // larger: it is given a little longer to go, CASE_LEAD, or its way out would be the page's fastest move.)
      const picked = glide(along(at, stop.from, stop.arrive - 0.05)) * (1 - glide(along(at, stop.leave - (id === 'case' ? CASE_LEAD : 0), next ? next.arrive - 0.05 : SCORE.regroup[1])));
      pose.x = layout === 'tall' ? path.lane * picked : 0;
      pose.y = layout === 'wide' ? path.lane * picked : 0;
      pose.rx = deg(TUMBLE[id][0]) * wobble;
      pose.ry = deg(TUMBLE[id][1]) * wobble;
      pose.rz = 0;
    }
    // Each part's own turn while it is looked at.
    state.parts.dial.rz = deg(46) * (glide(along(at, STOPS[2].arrive, STOPS[2].leave)) - inOut(along(at, STOPS[2].leave, STOPS[3].arrive)));
    // The case is the other way about: it is turned before it is in the picture (as the dial was when it left),
    // and its own turn is the way back to straight, done before the page rests on it.
    state.parts.case.rz = deg(CASE_TURNED) * (inOut(along(at, STOPS[3].from, STOPS[3].from + 0.25)) - glide(along(at, STOPS[3].arrive, STOPS[3].arrive + CASE_ROUND)));
    state.parts.calibre.ry += Math.PI * (inOut(along(at, SCORE.calibreTurn[0], SCORE.calibreTurn[1])) + inOut(along(at, STOPS[4].leave, STOPS[5].arrive - 0.1)));
    // Turned over, the balance is 6.4 mm out at about 5 o'clock. The close-up turns the calibre until it is at
    // 8 o'clock, beside the words, and goes on turning a little while the page rests there.
    const closeUp = deg(97) * glide(along(at, SCORE.calibreTurn[1], SCORE.calibreMacro[1])) + deg(7) * along(at, SCORE.calibreMacro[1], STOPS[4].leave);
    state.parts.calibre.rz = closeUp * (1 - inOut(along(at, STOPS[4].leave, STOPS[5].arrive)));
    state.parts.caseback.ry += Math.PI * (inOut(along(at, STOPS[6].from + 0.05, STOPS[6].arrive)) + inOut(along(at, SCORE.regroup[0], SCORE.regroup[1])));
    state.parts.caseback.rz = deg(22) * (glide(along(at, STOPS[6].arrive, STOPS[6].leave)) - inOut(along(at, SCORE.regroup[0], SCORE.regroup[1])));
    // The hands come into the picture as they sit on the watch, one on another, and come apart along the axis
    // once they are in it: the seconds hand is lifted off first, as a watchmaker takes them off, then the hour
    // hand is let down. They are apart before the page can rest on them, and close up again out of the picture.
    const opening = STOPS[1].arrive - HANDS_OPEN[0], closing = STOPS[1].leave + HANDS_OPEN[0];
    state.hands.lift = HANDS_APART * (inOut(along(at, opening, opening + HANDS_OPEN[1])) - inOut(along(at, closing + HANDS_OPEN[2], STOPS[2].arrive)));
    state.hands.drop = HANDS_APART * (inOut(along(at, opening + HANDS_OPEN[2], opening + HANDS_OPEN[2] + HANDS_OPEN[1])) - inOut(along(at, closing, STOPS[2].arrive - HANDS_OPEN[2])));

    // The bracelet: off before the watch comes apart, on again once it is whole.
    const off = inOut(along(at, SCORE.strapOff[0], SCORE.strapOff[1])) - out(along(at, SCORE.strapOn[0], SCORE.strapOn[1]));
    for (const [id, sign, travel] of [['strapTop', 1, 170], ['strapBottom', -1, 220]] as const) {
      const pose = state.parts[id];
      pose.y = sign * travel * off;
      pose.z = -6 * Math.sin(Math.min(1, off) * Math.PI);
      pose.visible = off < 0.995;
    }

    // Turned over, and back the same way round.
    state.turn.ry = Math.PI * (inOut(along(at, SCORE.turnOver[0], SCORE.turnOver[1])) + inOut(along(at, SCORE.turnBack[0], SCORE.turnBack[1])));
    state.ground = 1 - along(at, SCORE.ready[0], SCORE.ready[1]) + along(at, SCORE.rejoin[1], SCORE.whole);

    // ---------- The faces: the seconds hand sweeps a new dial in ----------
    const [first, second] = SCORE.sweeps;
    const sweepOne = glide(along(at, first[0], first[1])), sweepTwo = glide(along(at, second[0], second[1]));
    const sweeping = sweepTwo > 0 ? sweepTwo : sweepOne;
    state.dial.face = sweepTwo >= 1 ? 'dial-ink' : sweepOne >= 1 ? 'dial-salmon' : 'dial-silver';
    state.dial.next = sweepTwo > 0 ? 'dial-ink' : 'dial-salmon';
    state.dial.sweep = sweeping > 0 && sweeping < 1 ? sweeping * Math.PI * 2 : 0;
    // At the end the choice is the visitor's, and a change sweeps in over a little under a second.
    const choosing = at >= SCORE.wornOut[0];
    if (choosing) {
      if (chosen.next !== chosen.face) {
        chosen.sweep = Math.min(1, chosen.sweep + (seconds > 0 ? seconds / 0.85 : 1));
        if (chosen.sweep >= 1) { chosen.face = chosen.next; chosen.sweep = 0; }
      }
      state.dial.face = chosen.face;
      state.dial.next = chosen.next;
      state.dial.sweep = chosen.sweep > 0 ? glide(chosen.sweep) * Math.PI * 2 : 0;
    }

    // ---------- Hands ----------
    const running = at < SCORE.strapOff[0] + 0.1 || at >= SCORE.wornOut[0];
    const catalogue = at >= (SCORE.turnBack[0] + SCORE.turnBack[1]) / 2 && !running;
    if (running) stopped = null; else if (!stopped) stopped = now();
    const target = running ? timeAngles(now()) : catalogue ? { ...CATALOGUE, second: sweeping * Math.PI * 2 } : (() => {
      const frozen = timeAngles(stopped!);
      // At the hands' own stop the scroll runs them, geared as the calibre gears them: the seconds hand once
      // round, the minute hand the sixtieth of a turn that goes with it, the hour hand a twelfth of that.
      const run = Math.PI * 2 * glide(along(at, STOPS[1].arrive, STOPS[1].leave));
      frozen.second += run; frozen.minute += run / 60; frozen.hour += run / 720;
      return frozen;
    })();
    // They chase their target: wound up from noon at the start, and to the time again at the end.
    const quick = catalogue || !running ? 0.05 : caught ? 0.03 : 0.5;
    // Held at noon until the entrance has uncovered them: winding up is worth seeing.
    held = Math.max(0, held - seconds);
    const k = held > 0 ? 0 : seconds > 0 ? 1 - Math.exp(-seconds / quick) : 1;
    let moving = false;
    for (const hand of ['hour', 'minute', 'second'] as const) {
      const gap = nearest(shown[hand], target[hand]);
      shown[hand] += gap * k;
      if (Math.abs(gap) > 0.002) moving = true;
    }
    if (running && !moving) caught = true;
    if (!running) caught = false;
    Object.assign(state.hands, shown);

    // ---------- Rotor: a weight on a bearing. Scrolling swings it; it settles heavy side down. ----------
    if (seconds > 0) {
      const step = Math.min(seconds, 0.05);
      rotor.speed += (-9.5 * Math.sin(rotor.angle) - 1.5 * rotor.speed + velocity * 26) * step;
      rotor.angle += rotor.speed * step;
    }
    state.rotor = rotor.angle;
    const swinging = Math.abs(rotor.speed) > 0.004 || Math.abs(Math.sin(rotor.angle)) > 0.004;

    return running || moving || swinging || held > 0 || (choosing && chosen.next !== chosen.face);
  };

  return {
    update,
    get stopped() { return stopped; },
    wind(hold = 0) { shown.hour = shown.minute = shown.second = 0; caught = false; held = hold; },
    choose(face) { if (face !== chosen.next) { if (chosen.sweep > 0) chosen.face = chosen.next; chosen.next = face; chosen.sweep = 0; } },
    lean(x, y) { leaning.toX = x; leaning.toY = y; },
  };
}
