// When everything on the Sum page happens, in screens of scroll: one screen of scroll is one unit, on
// every device. The watch's choreography (rig.ts) and the words (timeline.ts) both read these, so the
// two cannot drift apart. Nothing here is a duration in seconds: the visitor sets the pace.

/** The parts the tour stops at, in the order it meets them, with how many pieces each is. They add up to 147. */
export const STOPS = [
  { id: 'crystal', from: 2.6, arrive: 3.2, leave: 3.7 },
  { id: 'hands', from: 3.7, arrive: 4.3, leave: 4.8 },
  { id: 'dial', from: 4.8, arrive: 5.4, leave: 6.0 },
  { id: 'case', from: 6.0, arrive: 6.6, leave: 7.3 },
  { id: 'calibre', from: 7.3, arrive: 7.9, leave: 9.5 },
  // Coming back out of the close-up takes longer than going from one part to the next: there is more to undo.
  { id: 'rotor', from: 9.5, arrive: 10.3, leave: 10.9 },
  { id: 'caseback', from: 10.9, arrive: 11.5, leave: 12.1 },
] as const;
export type StopId = (typeof STOPS)[number]['id'];

export const SCORE = {
  /** The strap comes off, the camera steps back. */
  strapOff: [0.18, 0.92],
  ready: [0.5, 1.0],
  /** The watch comes apart. */
  burst: [1.0, 2.0],
  overview: 2.3,
  /** Inside the calibre's stop: it turns over to show its bridges, then the camera closes in on the balance and drifts across it until the stop ends. */
  calibreTurn: [8.2, 8.75],
  calibreMacro: [8.75, 9.25],
  /** Back to the whole stack (the whole line comes back into the picture, so it is given room), then together again. */
  regroup: [12.1, 12.9],
  rejoin: [12.9, 13.65],
  strapOn: [13.25, 13.75],
  whole: 13.85,
  /** Turned over to the caseback, and back. */
  turnOver: [14.05, 14.85],
  back: 15.15,
  turnBack: [15.35, 15.95],
  /** Three faces: silver as it comes, then two sweeps of the seconds hand. */
  faces: [16.1, 17.15, 18.25],
  sweeps: [[16.3, 17.0], [17.4, 18.1]],
  /** Three photographs. */
  wornIn: [18.45, 18.95],
  worn: [19.15, 20.15, 21.15],
  wornOut: [21.35, 21.85],
  /** The watch again, running, and the price. */
  yours: 22.05,
  end: 22.95,
} as const;

/** How long the page is, in screens of scroll. */
export const SCREENS = SCORE.end;

/** Every place the page comes to rest: a tap on a step button, or an arrow key, goes from one to the next. */
export const RESTS: number[] = [
  0, SCORE.overview,
  STOPS[0].arrive + 0.2, STOPS[1].arrive + 0.2, STOPS[2].arrive + 0.25, STOPS[3].arrive + 0.3,
  8.05, 9.35, STOPS[5].arrive + 0.3, STOPS[6].arrive + 0.3,
  SCORE.whole, SCORE.back, ...SCORE.faces, ...SCORE.worn, SCORE.end,
];

/** The page's chapters, for the rail: where each starts. */
export const CHAPTERS = [
  { id: 'now', label: 'Now', from: 0 },
  { id: 'apart', label: 'Apart', from: 1.0 },
  { id: 'whole', label: 'Whole', from: SCORE.regroup[0] },
  { id: 'faces', label: 'Faces', from: SCORE.turnBack[1] },
  { id: 'worn', label: 'Worn', from: SCORE.wornIn[0] },
  { id: 'yours', label: 'Yours', from: SCORE.wornOut[0] },
] as const;

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
/** How far `at` is through [from, to], held at 0 and 1 outside it. */
export const along = (at: number, from: number, to: number) => clamp01((at - from) / (to - from));
