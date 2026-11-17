// Where the map's camera is for any place on the page: one move, from the whole earth to a door and
// back. Between two stops the scale changes evenly in its logarithm (a zoom that feels even), and the
// centre closes on the next stop faster than the scale does, so the place being zoomed to comes to the
// middle of the picture and stays there instead of swinging out of it.

import { EARTH, between, lonLat, place, type View } from './map/geo';
import { LEVELS, SCORE, along, glide } from './score';

/** A stop of the camera: where it looks, and how much ground lies across the picture's shorter side, in metres. */
export interface Stop { lon: number; lat: number; across: number }

/** The whole earth with a little room round it. */
const PLANET = (EARTH * 2) / 0.86;
export function stops(door: [number, number], runMiddle: [number, number]): Record<(typeof LEVELS)[number]['id'], Stop> {
  return {
    planet: { lon: 58, lat: 20, across: PLANET },
    lane: { lon: 2.5, lat: 46.8, across: 3_500_000 },
    // Ireland is what this picture is of: all of it, with the ship's way up from Land's End on its right.
    // Centred on the Irish Sea the picture was mostly Wales, and the camera seemed to head for Britain
    // first and then turn away from it.
    crossing: { lon: -6.4, lat: 52.3, across: 600_000 },
    city: { lon: -6.214, lat: 53.352, across: 23_000 },
    run: { lon: runMiddle[0], lat: runMiddle[1], across: 6_400 },
    street: { lon: door[0] + 0.0006, lat: door[1] + 0.0002, across: 640 },
    door: { lon: door[0], lat: door[1], across: 170 },
    all: { lon: 58, lat: 20, across: PLANET },
  };
}

/** How much faster than the scale the centre arrives. */
const CLOSING = 1.7;
function move(from: Stop, to: Stop, t: number): Stop {
  const across = Math.exp(Math.log(from.across) + (Math.log(to.across) - Math.log(from.across)) * t);
  // Zooming in, the centre is measured from the stop being zoomed to; zooming out, from the one being left.
  const [near, far, start] = to.across < from.across ? [to, from, from.across] : [from, to, to.across];
  const least = Math.pow(Math.min(from.across, to.across) / start, CLOSING);
  const off = (Math.pow(across / start, CLOSING) - least) / (1 - least);
  const [lon, lat] = lonLat(between(place(near.lon, near.lat), place(far.lon, far.lat), off));
  return { lon, lat, across };
}

/** The camera at a place on the page. `shorter` is the picture's shorter side in CSS pixels. */
export function cameraAt(at: number, where: Record<string, Stop>, shorter: number): View & { across: number } {
  let stop: Stop = where.planet;
  for (let i = 0; i < LEVELS.length - 1; i++) {
    const here = LEVELS[i], next = LEVELS[i + 1];
    // The move to the next stop takes the stretch between this stop's rest and the next one's.
    const [a, b] = next.id === 'all' ? [SCORE.out[0], SCORE.out[1]] : [here.rest + 0.25, next.rest - 0.15];
    if (at <= a) { stop = where[here.id]; break; }
    if (at < b) { stop = move(where[here.id], where[next.id], glide(along(at, a, b))); break; }
    stop = where[next.id];
  }
  return { lon: stop.lon, lat: stop.lat, scale: (EARTH * shorter) / stop.across, across: stop.across };
}
