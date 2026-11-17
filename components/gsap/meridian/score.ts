// When everything on the Meridian page happens, in screens of scroll: one screen of scroll is one unit,
// on every device. The camera (camera.ts), the map's layers and the words (timeline.ts) all read these.
// Nothing here is a duration in seconds: the visitor sets the pace.

/** The scales the page stops at, from the whole earth to a door. `rest` is where a step comes to rest. */
export const LEVELS = [
  { id: 'planet', rest: 0, from: 0, to: 1.7 },
  { id: 'lane', rest: 3.1, from: 1.7, to: 3.7 },
  { id: 'crossing', rest: 5.1, from: 3.7, to: 5.7 },
  { id: 'city', rest: 7.1, from: 5.7, to: 7.7 },
  { id: 'run', rest: 9.3, from: 7.7, to: 9.9 },
  { id: 'street', rest: 11.3, from: 9.9, to: 11.8 },
  { id: 'door', rest: 12.9, from: 11.8, to: 13.5 },
  { id: 'all', rest: 15.9, from: 13.5, to: 16.4 },
] as const;
export type LevelId = (typeof LEVELS)[number]['id'];

export const SCORE = {
  /** The parcel's number is typed into the search as the page starts to scroll, and taken out again on the way back out. */
  search: [0.06, 0.48],
  cleared: [13.7, 14.1],
  /** The parcel's journey is drawn across the earth, from Shenzhen to Dublin. */
  journey: [0.2, 1.5],
  /** The van's run is drawn from the depot, stop by stop, and the van drives it to the stop the page follows. */
  planned: [6.6, 7.1],
  drive: [7.5, 11.0],
  /** The building is lit, the proof of delivery comes up. */
  door: [11.9, 12.5],
  proof: [12.3, 12.9],
  /** Back out to the whole earth. */
  out: [13.5, 15.6],
  end: 16.4,
} as const;
export const SCREENS = SCORE.end;
export const RESTS: number[] = LEVELS.map(level => level.rest);

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
/** How far `at` is through [from, to], held at 0 and 1 outside it. */
export const along = (at: number, from: number, to: number) => clamp01((at - from) / (to - from));
/** Glides through: even in the middle, eased at both ends. */
export const glide = (t: number) => t * t * (3 - 2 * t);
