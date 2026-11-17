// Everything the Meridian page says, and the facts it is built on. Meridian is a concept: delivery
// tracking software that does not exist, following one parcel that does not exist. It is one of three
// sites made for a library of pages people can use, so nothing here names or sells whoever made it.
// The map is real: Natural Earth for the land, OpenStreetMap for Dublin (credited on the page). Every
// number on the page agrees with every other: the counts add up, the times follow one another, and the
// check adds and orders them.

import type { LevelId } from './score';

export const brand = {
  name: 'Meridian',
  concept: 'Concept product',
  /** What it is, in as few words as will do. */
  kind: 'Delivery tracking for carriers',
  /** Served from here: the map's data, the proof photograph, the fonts. */
  assets: '/assets/gsap/meridian',
  /** The parcel the page follows. */
  parcel: 'MRD 4471 0926 41',
  van: 'Van 12',
  /** The moment it is delivered: every time on the page is told from this. */
  delivered: '14:02',
};

/** What a parcel can be doing, in the order a parcel does them. */
export const STATES = ['At sea', 'On the road', 'At a depot', 'Out for delivery', 'Delivered'] as const;

export interface Level {
  id: LevelId;
  /** What the picture is of at this scale, on the rail. */
  name: string;
  /** How many parcels are in the picture, and the sentence that number starts. */
  count: number; counted: string;
  line: string;
  /** How many are in each state: they add up to `count`. */
  states: [number, number, number, number, number];
  /** How much time the ruler shows, in minutes before the delivery. */
  minutes: number;
}
export const levels: Level[] = [
  { id: 'planet', name: 'Earth', count: 41207, counted: 'parcels are on their way.', line: 'Someone has just asked where theirs is. Meridian is how a carrier answers: every parcel on one map, down to the door. Scroll to look it up.', states: [23410, 9655, 5037, 3105, 0], minutes: 34 * 1440 },
  { id: 'lane', name: 'Europe', count: 9312, counted: 'of them are in Europe.', line: 'This one left Shenzhen 33 days ago. It came through Suez, round Spain and up the Channel to Rotterdam.', states: [2941, 3480, 1575, 1316, 0], minutes: 9 * 1440 },
  { id: 'crossing', name: 'Ireland', count: 1204, counted: 'are bound for Ireland.', line: 'From Rotterdam it went by feeder ship round Land’s End: 38 hours to Dublin Port.', states: [402, 51, 433, 318, 0], minutes: 52 * 60 },
  { id: 'city', name: 'Dublin', count: 318, counted: 'are out for delivery in Dublin.', line: 'It came off the ship at 05:12, went through the depot by 07:10, and was on a van at 07:40.', states: [0, 0, 0, 318, 0], minutes: 10 * 60 },
  { id: 'run', name: 'Van', count: 86, counted: 'are on this van.', line: 'Eighty-six stops, planned at 06:00 and twice since: a quay closed, and one customer is out until two.', states: [0, 0, 0, 46, 40], minutes: 400 },
  { id: 'street', name: 'Street', count: 1, counted: 'is this one.', line: 'Stop 41 of 86: Smithfield, Dublin 7. Due at 14:02, and on time.', states: [0, 0, 0, 1, 0], minutes: 16 },
  { id: 'door', name: 'Door', count: 1, counted: 'delivered.', line: 'At 14:02. Signed for at reception, photographed where it was left.', states: [0, 0, 0, 0, 1], minutes: 2 },
  { id: 'all', name: 'All', count: 41207, counted: 'parcels. That was one.', line: 'Meridian is watching the other 41,206 the same way.', states: [23410, 9655, 5037, 3104, 1], minutes: 34 * 1440 },
];

/** What happened to the parcel, in minutes before it was delivered. */
export const events: { minutes: number; text: string }[] = [
  { minutes: 33 * 1440 + 310, text: 'Shenzhen, gate in' },
  { minutes: 27 * 1440, text: 'Singapore Strait' },
  { minutes: 13 * 1440, text: 'Suez' },
  { minutes: 8 * 1440, text: 'Gibraltar' },
  { minutes: 6100, text: 'Rotterdam' },
  { minutes: 2810, text: 'Sailed for Dublin' },
  { minutes: 530, text: 'Dublin Port, 05:12' },
  { minutes: 412, text: 'Depot, 07:10' },
  { minutes: 382, text: 'On the van, 07:40' },
  { minutes: 11, text: 'Stop 40, 13:51' },
  { minutes: 0, text: 'Delivered, 14:02' },
];

/**
 * The search the page begins with. It is a picture of one: the page types the parcel's number into it as
 * it starts to scroll, and it says what state the parcel it found is in.
 */
export const search = { out: 'Out for delivery', done: 'Delivered' };

/**
 * What Meridian does by itself while the parcel is in Dublin, each shown at the scale it happens at. The
 * page begins with its premise, a customer asking where their parcel is (the first sentence), so the first
 * of these is the answer to that. The times agree with `events` and with the sentences: on the van at
 * 07:40, a quay closed in the morning, stop 40 at 13:51, delivered at 14:02 (inside the window the
 * customer was given).
 */
export const updates: { level: LevelId; time: string; kind: string; text: string }[] = [
  { level: 'city', time: '07:41', kind: 'Answer to the customer', text: '“Out for delivery today, between 13:30 and 14:30.”' },
  { level: 'run', time: '09:14', kind: 'Route planned again', text: 'A quay is closed: 12 stops moved. This one is still due at 14:02.' },
  { level: 'street', time: '13:58', kind: 'Text to the customer', text: '“Van 12 is 4 minutes away.”' },
];

/** The proof of delivery. */
export const proof = {
  title: 'Proof of delivery',
  rows: [['Delivered', '14:02'], ['Stop', '41 of 86'], ['Left at', 'Reception'], ['Signed', 'M. Daly']] as [string, string][],
  alt: 'A cardboard parcel with a shipping label on a reception counter, photographed from above.',
};

/**
 * The parcel's way by sea, as [lon, lat]: Shenzhen, the Singapore and Malacca straits, round Sri Lanka,
 * the Gulf of Aden and the Red Sea, Suez, the Mediterranean, Gibraltar, round Spain, the Channel to
 * Rotterdam, then the feeder back down the Channel, round Land's End and up the Irish Sea to Dublin Port.
 */
export const SEAWAY: [number, number][] = [
  [114.27, 22.57], [114.6, 21.5], [111.0, 15.0], [108.5, 8.0], [105.4, 2.4], [104.45, 1.2], [103.5, 1.12], [102.3, 1.9], [100.6, 3.2], [98.0, 5.4], [95.0, 5.9], [85.0, 5.6], [80.6, 5.6], [72.0, 8.5], [60.0, 12.0], [51.5, 12.3], [45.5, 11.8], [43.4, 12.6],
  [41.0, 16.0], [38.5, 20.0], [35.6, 25.0], [34.05, 27.4], [33.3, 28.4], [32.9, 29.2], [32.56, 29.93], [32.31, 31.27], [32.0, 32.1], [28.0, 33.3], [22.0, 35.0], [15.5, 36.3], [11.5, 37.4], [5.0, 37.6], [-1.0, 36.4], [-5.6, 35.95], [-9.3, 36.6], [-10.0, 39.0], [-9.9, 43.5],
  [-6.6, 47.2], [-5.9, 48.7], [-3.6, 49.65], [0.0, 50.2], [1.4, 50.95], [2.6, 51.6], [3.6, 51.98], [4.05, 51.97], [3.6, 51.98], [2.6, 51.6], [1.4, 50.95], [0.0, 50.2], [-3.6, 49.65], [-6.0, 49.8], [-6.3, 51.0], [-5.95, 52.2], [-5.75, 53.0], [-6.0, 53.34], [-6.19, 53.345],
];

/**
 * The day of its journey the parcel is on at places along that way, as [index in SEAWAY, day]: the gate at
 * Shenzhen is day 1, then the Singapore Strait, Suez, Gibraltar, Rotterdam, and Dublin Port on day 34.
 * They agree with `events`. Between two of them the day is told from the distance sailed.
 */
export const DAYS: [number, number][] = [[0, 1], [5, 7], [24, 21], [33, 26], [44, 31], [55, 34]];

/** Ports and cities other parcels travel between: the traffic on the globe. */
export const HUBS: [number, number][] = [
  [114.06, 22.54], [121.47, 31.23], [103.82, 1.35], [55.27, 25.2], [72.88, 19.08], [4.48, 51.92], [9.99, 53.55], [-6.26, 53.35], [-74.0, 40.71], [-118.24, 34.05], [-46.33, -23.96], [3.38, 6.45],
  [18.42, -33.92], [151.21, -33.87], [139.69, 35.69], [28.98, 41.01], [-3.7, 40.42], [21.01, 52.23], [-87.63, 41.88], [-99.13, 19.43], [36.82, -1.29], [126.98, 37.57],
];

/**
 * Names on the map: each between two scales, the coarser first (the ground across the picture in metres,
 * over 900). A name comes in over the 30% under `from` and goes over the 30% under `to`: the ranges are
 * chosen so that where the page rests (16,463, 3,889, 667, 25.6, 7.1, 0.71 and 0.19) each is whole or gone.
 * The check looks for one that is half way.
 */
export const PLACES: { text: string; lon: number; lat: number; from: number; to: number; side?: 'left' | 'right' | 'above' | 'below'; size?: number }[] = [
  { text: 'Shenzhen', lon: 114.06, lat: 22.54, from: 60000, to: 2600, side: 'left' },
  { text: 'Singapore', lon: 103.82, lat: 1.35, from: 60000, to: 2600, side: 'below' },
  { text: 'Suez', lon: 32.55, lat: 30.0, from: 60000, to: 1500, side: 'right' },
  { text: 'Gibraltar', lon: -5.35, lat: 36.14, from: 9000, to: 900, side: 'below' },
  { text: 'Rotterdam', lon: 4.3, lat: 51.93, from: 9000, to: 260, side: 'right' },
  { text: 'Dublin', lon: -6.26, lat: 53.35, from: 60000, to: 16, side: 'left' },
  { text: 'Land’s End', lon: -5.71, lat: 50.07, from: 1400, to: 260, side: 'below' },
  { text: 'Holyhead', lon: -4.63, lat: 53.31, from: 1100, to: 120, side: 'right' },
  { text: 'Dublin Port', lon: -6.203, lat: 53.3475, from: 70, to: 7, side: 'above' },
  { text: 'Howth', lon: -6.066, lat: 53.378, from: 110, to: 18, side: 'right' },
  { text: 'Dún Laoghaire', lon: -6.135, lat: 53.294, from: 110, to: 18, side: 'right' },
  { text: 'River Liffey', lon: -6.262, lat: 53.3468, from: 11, to: 1.5, side: 'below', size: 11 },
  { text: 'Smithfield', lon: -6.2786, lat: 53.3493, from: 11, to: 0.45, side: 'above' },
];

/** How much time the ruler shows, in words: "34 days", "52 hours", "16 minutes". */
export function spanOf(minutes: number): string {
  if (minutes >= 2880) return `${Math.round(minutes / 1440)} days`;
  if (minutes >= 120) return `${Math.round(minutes / 60)} hours`;
  const whole = Math.max(1, Math.round(minutes));
  return `${whole} ${whole === 1 ? 'minute' : 'minutes'}`;
}

export const thousands = (value: number) => Math.round(value).toLocaleString('en-IE');
/** A map's scale as it is printed on one: "1 : 60,000,000", for a screen where a CSS pixel is 0.2646 mm. */
export function scaleOf(metresAPixel: number): string {
  const one = metresAPixel / 0.0002646, digits = Math.max(0, Math.floor(Math.log10(one)) - 1), step = Math.pow(10, digits);
  return `1 : ${thousands(Math.round(one / step) * step)}`;
}
/** "53.3484° N  6.2786° W", to as many places as the scale is worth. */
export function coordinates(lon: number, lat: number, metresAPixel: number): string {
  const places = metresAPixel > 2000 ? 1 : metresAPixel > 200 ? 2 : metresAPixel > 20 ? 3 : 4;
  return `${Math.abs(lat).toFixed(places)}° ${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lon).toFixed(places)}° ${lon >= 0 ? 'E' : 'W'}`;
}
/** A round length for a scale bar about `room` pixels long: 1, 2 or 5 times a power of ten. */
export function barOf(metresAPixel: number, room: number): { metres: number; pixels: number; text: string } {
  const most = metresAPixel * room, power = Math.pow(10, Math.floor(Math.log10(most)));
  const metres = [5, 2, 1].map(step => step * power).find(length => length <= most) ?? power;
  return { metres, pixels: metres / metresAPixel, text: metres >= 1000 ? `${thousands(metres / 1000)} km` : `${thousands(metres)} m` };
}
