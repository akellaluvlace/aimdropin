// When everything on the Datum page happens, in screens of scroll: one screen of scroll is one unit, on
// every device. The picture (plate.ts), the drawing over it (drawing.ts) and the words are all set from
// one timeline built from these (timeline.ts), so they cannot drift apart. Nothing here is a duration in
// seconds: the visitor sets the pace.
//
// Every [from, to] is a move; every plain number is a rest, where a step stops. A move ends a little
// before the rest after it and the next one starts a little after: at a rest nothing is half way.

export const SCORE = {
  /** The first words sink back into the line; then the site opens out of it, up and down. */
  firstGone: [0.06, 0.3],
  open: [0.32, 0.98],
  site: 1.1,

  /** A sheet of tracing paper is unrolled over the photograph, and the house is set out on it. */
  veil: [1.3, 2.12],
  grid: [1.86, 2.4],
  length: [2.14, 2.62],
  height: [2.36, 2.74],
  setOut: 2.85,

  /** The elevation is drawn: the wall, the roof, the openings, then the fine lines. */
  wall: [3.05, 3.5],
  roof: [3.32, 3.74],
  openings: [3.56, 4.04],
  detail: [3.86, 4.26],
  drawing: 4.4,

  /** The building goes up bay by bay, off the line, and the drawing gives way to it. */
  rise: [4.6, 5.74],
  structure: 5.9,

  /** The finished house comes down over the building site from the ridge. A phone walks up to it meanwhile. */
  settle: [6.1, 6.94],
  approach: [6.16, 6.98],
  building: 7.1,

  /** Dusk falls, the sheet turns blue with it, and then the lights come on, one room at a time. */
  dusk: [7.3, 7.98],
  lights: [7.98, 8.6],
  glow: [8.56, 8.72],
  evening: 8.85,

  /** In through the tall opening; up a floor; and the room closes back into the line as the day returns. */
  enter: [9.05, 9.94],
  ground: 10.1,
  climb: [10.3, 11.1],
  first: 11.25,
  leave: [11.45, 12.02],
  day: [11.5, 12.0],

  /** Three samples come up out of the line. */
  samples: [12.02, 12.5],
  board: 12.65,
  /** The last material closes into the line. */
  shut: [16.0, 16.56],

  /** Along the line to three other buildings, and off the end of it. */
  away: [20.0, 20.9],
  /** The last words rise out of the line once the last photograph has passed where they stand. */
  last: [20.74, 21.0],
  end: 21.1,
} as const;

/** The materials: each opens from its sample to the whole plate, over the one before. */
export const MATERIALS = [
  { id: 'slate', open: [12.85, 13.55], rest: 13.7 },
  { id: 'lime', open: [13.9, 14.6], rest: 14.75 },
  { id: 'oak', open: [14.95, 15.65], rest: 15.8 },
] as const;
export type MaterialId = (typeof MATERIALS)[number]['id'];

/** Other work: the page travels along the line from one building to the next. */
export const WORKS = [
  { id: 'coast', arrive: [16.3, 17.2], rest: 17.35 },
  { id: 'studio', arrive: [17.55, 18.45], rest: 18.6 },
  { id: 'pavilion', arrive: [18.8, 19.7], rest: 19.85 },
] as const;
export type WorkId = (typeof WORKS)[number]['id'];

/** How long the page is, in screens of scroll. */
export const SCREENS = SCORE.end;

/** Every scene: where the page comes to rest. A tap on a step button, or an arrow key, goes from one to the next. */
export const SCENES = [
  { id: 'line', rest: 0 },
  { id: 'site', rest: SCORE.site },
  { id: 'setout', rest: SCORE.setOut },
  { id: 'drawing', rest: SCORE.drawing },
  { id: 'structure', rest: SCORE.structure },
  { id: 'building', rest: SCORE.building },
  { id: 'evening', rest: SCORE.evening },
  { id: 'ground', rest: SCORE.ground },
  { id: 'first', rest: SCORE.first },
  { id: 'board', rest: SCORE.board },
  ...MATERIALS.map(material => ({ id: material.id, rest: material.rest })),
  ...WORKS.map(work => ({ id: work.id, rest: work.rest })),
  { id: 'start', rest: SCORE.end },
] as const;
export type SceneId = (typeof SCENES)[number]['id'];
export const RESTS: number[] = SCENES.map(scene => scene.rest);

/**
 * When the page leaves each scene for the next: the start of the move between them. A scene's words are
 * whole until then and start to go as the picture does; the next scene's arrive a third of a screen on.
 */
export const MOVES: number[] = [
  SCORE.firstGone[0], SCORE.veil[0], SCORE.wall[0], SCORE.rise[0], SCORE.settle[0], SCORE.dusk[0], SCORE.enter[0], SCORE.climb[0], SCORE.leave[0],
  ...MATERIALS.map(material => material.open[0]), SCORE.shut[0], ...WORKS.slice(1).map(work => work.arrive[0]), SCORE.away[0],
];
/** How long a scene's words take to go, and so how long after a move starts the next ones come. */
export const GOING = 0.34;

/** The page's chapters, for the rail: where each starts. A chapter's button goes to its first rest. */
export const CHAPTERS = [
  { id: 'line', label: 'Line', from: 0 },
  { id: 'site', label: 'Site', from: SCORE.open[0] },
  { id: 'drawing', label: 'Drawing', from: SCORE.wall[0] },
  { id: 'building', label: 'Building', from: SCORE.rise[0] },
  { id: 'inside', label: 'Inside', from: SCORE.enter[0] },
  { id: 'materials', label: 'Materials', from: SCORE.leave[0] },
  { id: 'work', label: 'Work', from: SCORE.shut[0] },
] as const;

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
/** How far `at` is through [from, to], held at 0 and 1 outside it. */
export const along = (at: number, from: number, to: number) => clamp01((at - from) / (to - from));
