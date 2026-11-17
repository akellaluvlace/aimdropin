// Everything the Sum page says, and what it is made of. Sum is a concept: a watch brand that does not
// exist, and its shop, which sells one watch by taking it apart into its parts and putting it back.
// Every photograph was generated for it (scripts/gsap/sum); the numbers are the page's
// own and add up on the page.

import type { StopId } from './score';

export const brand = {
  name: 'Sum',
  model: 'Sum 39',
  concept: 'Concept store',
  price: 1470,
  /** Served from here: the parts' photographs, the lifestyle photographs, the font. */
  assets: '/assets/gsap/sum',
};

/** The parts, in the order the tour meets them. `count` is how many pieces each is: they add up to 147. */
export const parts: { id: StopId | 'strap'; name: string; count: number; made: string; line: string; turned?: string }[] = [
  { id: 'crystal', name: 'Crystal', count: 2, made: 'Sapphire, and its gasket', line: 'Domed sapphire with a ground edge. Almost nothing but a diamond will scratch it.' },
  { id: 'hands', name: 'Hands', count: 3, made: 'Blued steel, and one in red', line: 'Hours, minutes and a seconds hand that never stops sweeping. Scroll, and it goes round once for you.' },
  { id: 'dial', name: 'Dial', count: 13, made: 'One dial, twelve markers', line: 'Silvered brass with a sunray finish. Watch the light run across it as it turns.' },
  { id: 'case', name: 'Case', count: 4, made: 'Case, crown, stem and tube', line: 'Steel, 39 mm across, brushed all the way round by hand.' },
  { id: 'calibre', name: 'Calibre S-01', count: 107, made: 'Plates, wheels, jewels, screws', line: 'The side that faces the dial. The hands are driven from here.', turned: 'And the side worth turning it over for. Twenty-five jewels, and a balance that beats eight times a second: 691,200 times a day.' },
  { id: 'rotor', name: 'Rotor', count: 3, made: 'Weight, bearing and screw', line: 'A weight on a bearing. Every move of your wrist swings it, and each swing winds the watch.' },
  { id: 'caseback', name: 'Caseback', count: 9, made: 'Back, window, gasket, six screws', line: 'Six screws and a sapphire window, so the part that does the work is on show.' },
  // The steel bracelet. (Its id is from the leather strap the watch had first: nothing a visitor reads.)
  { id: 'strap', name: 'Bracelet', count: 6, made: 'Two lengths, clasp, pin, two bars', line: '' },
];
export const total = parts.reduce((sum, part) => sum + part.count, 0);

export const faces = [
  { id: 'dial-silver', name: 'Silver', note: 'As it comes.' },
  { id: 'dial-salmon', name: 'Salmon', note: 'Warm, and a little harder to find.' },
  { id: 'dial-ink', name: 'Ink', note: 'For after dark.' },
] as const;

export const worn = [
  { id: 'cuff', line: 'It is 9.6 mm high.', note: 'So it goes under a cuff.', alt: 'A wrist wearing the watch under the cuff of a pale blue shirt and a navy jumper, the hand resting on an oak desk by a window.' },
  { id: 'bench', line: 'One watchmaker.', note: 'One watch a day, start to finish.', alt: 'The watch on a green bench mat among tweezers, a loupe and screwdrivers.' },
  { id: 'rail', line: '124 grams.', note: 'Bracelet and all.', alt: 'A wrist wearing the watch, a camel coat sleeve and a paper cup, on a railway platform in early light.' },
] as const;

export const specs: [string, string][] = [
  ['Case', 'Steel, 39 mm, 9.6 mm high'],
  ['Calibre', 'S-01 automatic, 25 jewels'],
  ['Runs for', '42 hours off the wrist'],
  ['Water', '10 atmospheres'],
  ['Parts', String(total)],
];

/** The time, the way a watch with hands is read: "eight minutes past ten". */
export function timeInWords(date: Date): string {
  const NUMBERS = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five', 'twenty-six', 'twenty-seven', 'twenty-eight', 'twenty-nine'];
  const minutes = date.getMinutes(), hour = date.getHours() % 12;
  const here = NUMBERS[hour], next = NUMBERS[(hour + 1) % 12];
  if (minutes === 0) return `${here} o'clock`;
  if (minutes === 15) return `a quarter past ${here}`;
  if (minutes === 30) return `half past ${here}`;
  if (minutes === 45) return `a quarter to ${next}`;
  const few = (count: number) => `${NUMBERS[count]} ${count === 1 ? 'minute' : 'minutes'}`;
  return minutes < 30 ? `${few(minutes)} past ${here}` : `${few(60 - minutes)} to ${next}`;
}
/**
 * The same, in the pieces the headline is set in: what comes before "past" or "to", and the rest.
 * "seventeen minutes" + "to twelve.", "a quarter" + "past ten.", "half past" + "ten.", "ten" + "o'clock."
 */
export function timeParts(date: Date): { lead: string; rest: string } {
  const said = timeInWords(date);
  if (said.endsWith("o'clock")) return { lead: said.slice(0, -8), rest: "o'clock." };
  if (said.startsWith('half past ')) return { lead: 'half past', rest: `${said.slice(10)}.` };
  const cut = said.search(/ (past|to) /);
  return { lead: said.slice(0, cut), rest: `${said.slice(cut + 1)}.` };
}
/** "10:08:36", for the line that says when the watch was opened. */
export const timeInFigures = (date: Date) => [date.getHours(), date.getMinutes(), date.getSeconds()].map((value, index) => (index ? String(value).padStart(2, '0') : String(value))).join(':');
/** The city of the device's time zone, when it names one ("Europe/Dublin" gives "Dublin"). Read from the device, sent nowhere. */
export function cityOfZone(): string {
  try { const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''; const city = zone.split('/').pop() ?? ''; return /^[A-Za-z_]+$/.test(city) && !/^(UTC|GMT|Etc)/i.test(zone) ? city.replace(/_/g, ' ') : ''; } catch { return ''; }
}
export const euros = (amount: number) => `€${amount.toLocaleString('en-IE')}`;
