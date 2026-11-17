// Everything the Datum page says. Datum is a concept: an architecture practice that does not exist, with
// buildings that do not exist. Every photograph was generated for it (scripts/gsap/datum).
// It is one of three concept sites made for a library of pages for people to use, so it stands on its
// own: it says it is a concept, and names, credits and sells nobody.
//
// The figures are not written here: they are read from the long house's photograph (survey.ts) and put
// into the sentences below, so the words, the dimensions on the drawing and the drawing itself cannot
// disagree.

import { FIGURES, HOUSE, PICTURES } from './survey';
import type { SceneId } from './score';

export const brand = {
  name: 'Datum',
  concept: 'Concept practice',
  /** Served from here: the photographs and the font. */
  assets: '/assets/gsap/datum',
};

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five', 'twenty-six', 'twenty-seven', 'twenty-eight', 'twenty-nine', 'thirty'];
const inWords = (count: number) => WORDS[count] ?? String(count);
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
/** A level, as a drawing gives it: metres above the datum, to the millimetre. "5.005". */
export const level = (mm: number) => (mm / 1000).toFixed(3);
/** A length, as a drawing gives it: millimetres, in threes. "24 000". */
export const length = (mm: number) => String(Math.round(mm)).replace(/\B(?=(\d{3})+$)/g, ' ');

/** The long house, in the figures its drawing carries (millimetres). */
export const house = {
  length: FIGURES.length,
  bays: FIGURES.bays,
  bay: FIGURES.length / FIGURES.bays,
  eaves: FIGURES.eaves,
  ridge: FIGURES.ridge,
  /** The first floor's finished level, above the datum. */
  floor: 2700,
  openings: HOUSE.openings.length,
  /** The tall opening, to the nearest half metre. */
  tall: Math.round((HOUSE.openings.find(opening => opening.kind === 'glazed')!.h / HOUSE.perMetre) * 2) / 2,
};

export interface Scene {
  id: SceneId;
  /** The heading, a line at a time. */
  title: string[];
  body: string;
  /** What the drawing's title block says while this scene is on the sheet. */
  sheet: { project: string; drawing: string; stage: string };
}

const longHouse = 'Long house';
export const scenes: Scene[] = [
  { id: 'line', title: ['First,', 'a line.'], body: `${brand.name} is an architecture practice. Every building it makes starts the same way: one level line, set out on the ground, that everything else is measured from.`, sheet: { project: longHouse, drawing: '000 Datum', stage: 'Brief' } },
  { id: 'site', title: ['Then, a place.'], body: 'A meadow in the west of Ireland, two hawthorns bent by the wind, low hills to the south. The line is struck where the mown grass ends.', sheet: { project: longHouse, drawing: '001 Site', stage: 'Survey' } },
  { id: 'setout', title: ['Set it out.'], body: `${capital(inWords(house.bays + 1))} grid lines, ${inWords(house.bay / 1000)} metres apart: ${inWords(house.length / 1000)} metres, end to end. Eaves at ${level(house.eaves)} above the line, ridge at ${level(house.ridge)}. Every figure on this sheet is measured from it.`, sheet: { project: longHouse, drawing: '002 Setting out', stage: 'Setting out' } },
  { id: 'drawing', title: ['Draw it.'], body: `One long house under one roof. ${capital(inWords(house.openings))} openings, no two the same size, each placed for what is behind it: a table, a stair, a bed, a view of the hills.`, sheet: { project: longHouse, drawing: '100 South elevation', stage: 'Design' } },
  { id: 'structure', title: ['Build it.'], body: 'Bay by bay, off the same line. Blockwork to the eaves, rafters to the ridge, slate from the west end. Nothing here is where it is by eye.', sheet: { project: longHouse, drawing: '200 Structure', stage: 'Construction' } },
  { id: 'building', title: ['The drawing,', 'built.'], body: 'White lime, pale oak, blue slate, and no gutter to break the edge of the roof. It stands where the line said it would.', sheet: { project: longHouse, drawing: '300 As built', stage: 'Complete' } },
  { id: 'evening', title: ['Then someone', 'moves in.'], body: 'The lights come on one room at a time. It is the only part of the job nobody draws.', sheet: { project: longHouse, drawing: '301 After dark', stage: 'In use' } },
  { id: 'ground', title: ['Inside, the line', 'is the floor.'], body: `Level ${level(0)} is the oak under your feet. The tall opening is ${inWords(house.tall)} metres high, so the table stands half in the meadow.`, sheet: { project: longHouse, drawing: '400 Ground floor', stage: 'In use' } },
  { id: 'first', title: ['One floor up.'], body: `${level(house.floor)} above the line. Rafters left in view, one window set at the height of a seat, and a bench under it.`, sheet: { project: longHouse, drawing: '401 First floor', stage: 'In use' } },
  { id: 'board', title: ['Three materials.'], body: "Slate, lime and oak. All three were in use within a day's walk of this meadow long before the house was.", sheet: { project: longHouse, drawing: '500 Materials', stage: 'Specification' } },
  { id: 'slate', title: ['Slate.'], body: 'Riven, in random widths, laid in courses that shorten toward the ridge. No two roofs of it are alike.', sheet: { project: longHouse, drawing: '501 Slate', stage: 'Specification' } },
  { id: 'lime', title: ['Lime.'], body: 'Three coats, floated by hand, then limewashed. It breathes, it moves a little, and it takes the light softly.', sheet: { project: longHouse, drawing: '502 Lime', stage: 'Specification' } },
  { id: 'oak', title: ['Oak.'], body: 'Quarter-sawn, pegged and left bare. In ten years it will be silver. That is in the drawing too.', sheet: { project: longHouse, drawing: '503 Oak', stage: 'Specification' } },
  { id: 'coast', title: ['A house', 'on the coast.'], body: `Concrete and larch, ${inWords(PICTURES.coast.length!)} metres long and one storey high, with the Atlantic behind the dining table.`, sheet: { project: 'Coast house', drawing: '100 West elevation', stage: 'Complete' } },
  { id: 'studio', title: ['A studio', 'on the water.'], body: `${capital(inWords(PICTURES.studio.length!))} metres of black timber on steel legs. The tide comes in under it twice a day.`, sheet: { project: 'Tide studio', drawing: '100 South elevation', stage: 'Complete' } },
  { id: 'pavilion', title: ['A reading', 'pavilion.'], body: `${capital(inWords(PICTURES.pavilion.length!))} metres under one roof, on a row of oak columns, in a clearing in an oak wood.`, sheet: { project: 'Reading pavilion', drawing: '100 North elevation', stage: 'Complete' } },
  { id: 'start', title: ['Yours starts', 'the same way.'], body: `${brand.name} is a concept. The practice and its buildings do not exist, and every photograph here was generated.`, sheet: { project: 'Yours', drawing: '000 Datum', stage: 'Not started' } },
];

/** What the title block's cells are called. */
export const cells = { project: 'Project', drawing: 'Drawing', scale: 'Scale', stage: 'Stage' };
/** The scale, where a picture is a photograph of a room or a surface and has none. */
export const noScale = 'Not to scale';

/** For a reader who cannot see the pictures: what happens on the sheet. */
export const described = 'A thin red level line runs across a white drawing sheet and stays at the same height throughout. A meadow rises out of it. Tracing paper is laid over the meadow and a long house is set out on it with grid lines and dimensions, then drawn in ink as an elevation. The house is built bay by bay over its drawing, finished in white lime render under a slate roof, and seen at dusk as its lights come on. Then two rooms inside it, close views of its slate, lime and oak, and three other buildings standing on the same line.';

export const alts = {
  poster: 'A long white house with a slate roof and oak-lined windows of different sizes, seen straight on in a mown meadow under an overcast sky.',
};
