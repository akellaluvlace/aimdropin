// Meridian's map: one canvas, drawn from the whole earth down to a street, with no map library.
// The land comes in three levels of detail (Natural Earth), the city's roads, the streets and the
// buildings from OpenStreetMap; each fades in at the scale it is worth drawing at. Everything is kept
// as unit vectors and projected each frame (geo.ts), so one camera serves at every scale.

import { EARTH, basis, between, clipArea, clipStroke, dot, metres, metresPerPixel, place, shape, type Shape, type Vec, type View } from './geo';

/** The chart's colours: paper land, a pale tint for water, ink for linework, magenta for the route (as on an air chart). */
export const CHART = {
  space: '#eef1f3', sea: '#d8e4ea', land: '#f8f8f4', coast: '#7c909d', grid: 'rgb(48 82 104 / .17)',
  road: '#34424d', minor: '#9aa7b0', street: '#ffffff', casing: '#c3ccd1', rail: '#77848d', building: '#e6e8e3', buildingEdge: '#cdd3cf', park: '#dde8d6',
  route: '#d6007e', glow: '#ffffff', ink: '#101820', amber: '#f0a400', traffic: '#3d5a6c',
};

export interface MapData {
  world: Shape[]; europe: Shape[]; isles: Shape[];
  city: { motorway: Shape[]; trunk: Shape[]; primary: Shape[]; secondary: Shape[]; tertiary: Shape[]; river: Shape[]; rail: Shape[]; sea: Shape[]; coast: Shape[]; islands: Shape[] };
  streets: { main: Shape[]; local: Shape[]; foot: Shape[]; tram: Shape[]; buildings: Shape[]; water: Shape[]; parks: Shape[] };
  /** The van's run from the depot, and where its stops are along it (metres from the depot). */
  run: Shape; runMetres: number; depot: [number, number]; stops: { lon: number; lat: number; metres: number }[]; followed: number;
}

export async function loadMapData(base: string): Promise<MapData> {
  const get = async (name: string) => (await fetch(`${base}/${name}.json`)).json();
  const [world, europe, isles, city, streets] = await Promise.all(['land-world', 'land-europe', 'land-isles', 'city', 'streets'].map(get));
  const shapes = (list: number[][]) => list.map(shape);
  // Where each stop is along the run, measured on the run as it is drawn here (the figures in the file were
  // measured on a flat map and are a few metres out, which shows at the scale of a door).
  const run = shape(streets.run), lengths = new Float64Array(run.count);
  for (let i = 1; i < run.count; i++) lengths[i] = lengths[i - 1] + metres([run.xyz[i * 3 - 3], run.xyz[i * 3 - 2], run.xyz[i * 3 - 1]], [run.xyz[i * 3], run.xyz[i * 3 + 1], run.xyz[i * 3 + 2]]);
  const stops = (streets.stops as { lon: number; lat: number; metres: number }[]).map(stop => {
    const at = place(stop.lon, stop.lat);
    let best = 0, least = Infinity;
    for (let i = 0; i < run.count; i++) {
      const off = metres(at, [run.xyz[i * 3], run.xyz[i * 3 + 1], run.xyz[i * 3 + 2]]);
      // The run passes some places twice: the pass nearest the distance on file is the stop.
      const score = off * 50 + Math.abs(lengths[i] - stop.metres);
      if (off < 3 && score < least) { least = score; best = i; }
    }
    return { ...stop, metres: lengths[best] };
  });
  return {
    world: shapes(world), europe: shapes(europe), isles: shapes(isles),
    city: { motorway: shapes(city.motorway), trunk: shapes(city.trunk), primary: shapes(city.primary), secondary: shapes(city.secondary), tertiary: shapes(city.tertiary), river: shapes(city.river), rail: shapes(city.rail), sea: shapes(city.sea), coast: (city.sea as number[][]).map(flat => shape(flat.slice(0, -6))), islands: shapes(city.islands) },
    streets: { main: shapes(streets.main), local: shapes(streets.local), foot: shapes(streets.foot), tram: shapes(streets.tram), buildings: shapes(streets.buildings), water: shapes(streets.water), parks: shapes(streets.parks) },
    run, runMetres: lengths[run.count - 1], depot: streets.depot, stops, followed: streets.followed,
  };
}

/** A line across the earth with its length along it, so a share of it can be drawn. */
export interface Path { shape: Shape; along: Float64Array; length: number }
export function path(points: Vec[]): Path {
  const xyz = new Float64Array(points.length * 3), along = new Float64Array(points.length);
  let length = 0;
  points.forEach((point, i) => { xyz.set(point, i * 3); if (i) length += metres(points[i - 1], point); along[i] = length; });
  const flat: number[] = [];
  for (const point of points) flat.push(Math.atan2(point[0], point[2]) * 180 / Math.PI, Math.asin(point[1]) * 180 / Math.PI);
  return { shape: shape(flat), along, length };
}
/** Great circles through a list of [lon, lat] places, a point every `step` metres. */
export function seaway(waypoints: [number, number][], step = 40000): Vec[] {
  const points: Vec[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = place(...waypoints[i]), b = place(...waypoints[i + 1]);
    const pieces = Math.max(1, Math.round(metres(a, b) / step));
    for (let j = i ? 1 : 0; j <= pieces; j++) points.push(between(a, b, j / pieces));
  }
  return points;
}
/** The place a distance along a path. */
export function pathAt(p: Path, distance: number): Vec {
  const d = Math.max(0, Math.min(p.length, distance)), { along } = p;
  let low = 0, high = along.length - 1;
  while (high - low > 1) { const mid = (low + high) >> 1; if (along[mid] <= d) low = mid; else high = mid; }
  const a: Vec = [p.shape.xyz[low * 3], p.shape.xyz[low * 3 + 1], p.shape.xyz[low * 3 + 2]], b: Vec = [p.shape.xyz[high * 3], p.shape.xyz[high * 3 + 1], p.shape.xyz[high * 3 + 2]];
  const span = along[high] - along[low];
  return span > 0 ? between(a, b, (d - along[low]) / span) : a;
}

/** The box of Dublin that was surveyed (scripts/gsap/meridian/city.mjs): its sea is only drawn inside it. */
const SURVEYED: [number, number][] = [[-6.5, 53.2001], [-5.85, 53.2001], [-5.85, 53.4752], [-6.5, 53.4752]];

/** A name on the map, and the range of scales (the map's detail, in metres a pixel) it is shown at. */
export interface Label { text: string; lon: number; lat: number; from: number; to: number; size?: number; side?: 'left' | 'right' | 'above' | 'below'; weight?: number }
/** Other parcels' traffic on the globe: a great circle between two places. */
export interface Lane { a: Vec; b: Vec; points: Float64Array; phase: number; speed: number }
export function lane(from: [number, number], to: [number, number], seed: number): Lane {
  const a = place(...from), b = place(...to), steps = 36, points = new Float64Array((steps + 1) * 3);
  for (let i = 0; i <= steps; i++) points.set(between(a, b, i / steps), i * 3);
  const random = Math.abs(Math.sin(seed * 127.1) * 43758.5453) % 1;
  return { a, b, points, phase: random, speed: 0.012 + 0.02 * ((random * 7.3) % 1) };
}

export interface MapFrame {
  view: View;
  /**
   * What is worth drawing: metres a pixel on a picture 900 pixels across its shorter side showing the same
   * ground. The levels of detail follow this and not the real size of a pixel, so a phone and a desk show
   * the same map of the same place.
   */
  detail: number;
  /** Where on the canvas the camera's centre falls, as shares of half its width and height (0 is the middle). */
  shiftX: number; shiftY: number;
  /** How far the parcel's journey is drawn, and where the parcel is, in metres along it. */
  journey: Path; drawn: number; parcel: number;
  /** The van's run: how far it is drawn, and where the van is, in metres from the depot. Negative hides it. */
  run: number; van: number;
  /** Seconds, for what moves in its own time (traffic on the globe). */
  time: number;
  /** 0 to 1: other parcels' traffic, and the names. */
  traffic: number; labels: number;
  /** The building the parcel goes to, lit (0 to 1). */
  door: number;
}

export interface MapEngine {
  resize(width: number, height: number): void;
  render(frame: MapFrame): void;
  /** Where a place is on the canvas, in CSS pixels, with the frame last drawn. */
  locate(lon: number, lat: number): { x: number; y: number; front: boolean };
  /** How many points went to the canvas in the last frame (for the checks). */
  readonly drawnPoints: number;
  /** The names written in the last frame, and those of them that were half way in or out, for the checks. */
  readonly drawnNames: string[];
  readonly fadingNames: string[];
  /** The middle of the building the parcel is for, as [lon, lat], when there is one. */
  readonly doorPlace: [number, number] | null;
}

export function createMap(canvas: HTMLCanvasElement, data: MapData, options: { labels: Label[]; lanes: Lane[]; font: string; maxRatio?: number; door?: [number, number] }): MapEngine {
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const size = { width: 1, height: 1, ratio: 1 };
  const scratch = { a: new Float64Array(1 << 15), work: [new Float64Array(1 << 16), new Float64Array(1 << 16)] as [Float64Array, Float64Array] };
  const need = (count: number) => { if (count * 2 > scratch.a.length) { scratch.a = new Float64Array(count * 2 + 1024); scratch.work = [new Float64Array(count * 4 + 4096), new Float64Array(count * 4 + 4096)]; } };
  let last = { east: [1, 0, 0] as Vec, north: [0, 1, 0] as Vec, out: [0, 0, 1] as Vec, K: 1, cx: 0, cy: 0 };
  let drawnPoints = 0, drawnNames: string[] = [], fadingNames: string[] = [];
  // The building the parcel is for: the nearest to the door that is a building to walk into (the nearest of
  // all, in this square, is a chimney).
  const doorAt = options.door ? place(...options.door) : null;
  const doorBuilding = doorAt ? data.streets.buildings.filter(building => building.reach * EARTH > 16 && building.count >= 5).reduce<Shape | null>((best, building) => (!best || dot(building.mid, doorAt) > dot(best.mid, doorAt) ? building : best), null) : null;

  const resize = (width: number, height: number) => {
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, options.maxRatio ?? 2);
    size.width = width; size.height = height; size.ratio = ratio;
    const w = Math.round(width * ratio), h = Math.round(height * ratio);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  };

  const render = (frame: MapFrame) => {
    const { view } = frame, W = canvas.width, H = canvas.height, ratio = size.ratio;
    const { east, north, out } = basis(view);
    const K = view.scale * ratio, cx = W / 2 + frame.shiftX * W / 2, cy = H / 2 - frame.shiftY * H / 2;
    last = { east, north, out, K, cx, cy };
    drawnPoints = 0;
    drawnNames = []; fadingNames = [];
    const mpp = metresPerPixel(view), detail = frame.detail;
    // How far from the camera's centre the picture reaches, as an angle on the earth.
    const reachPx = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy));
    const seen = reachPx >= K ? Math.PI / 2 : Math.asin(reachPx / K);
    const pad = 80 * ratio, left = -pad, top = -pad, right = W + pad, bottom = H + pad;
    const whole = K < Math.max(W, H) * 4;            // far enough out that the earth's edge can be in the picture
    /** 1 where the map's detail is above `from` metres a pixel, 0 below `to`, even in the logarithm between. */
    const fade = (from: number, to: number) => Math.max(0, Math.min(1, (Math.log(detail) - Math.log(to)) / (Math.log(from) - Math.log(to))));
    const visible = (s: Shape) => { const away = Math.acos(Math.max(-1, Math.min(1, dot(s.mid, out)))); return away - s.reach <= seen + 0.0005; };
    /** Project a shape into the scratch array. Points behind the earth's edge are held on it. Returns false when all are behind. */
    const project = (s: Shape) => {
      need(s.count);
      const { xyz, count } = s, into = scratch.a;
      let front = 0;
      for (let i = 0; i < count; i++) {
        const x = xyz[i * 3], y = xyz[i * 3 + 1], z = xyz[i * 3 + 2];
        let px = x * east[0] + y * east[1] + z * east[2], py = x * north[0] + y * north[1] + z * north[2];
        if (x * out[0] + y * out[1] + z * out[2] < 0) { const l = Math.hypot(px, py) || 1; px /= l; py /= l; } else front++;
        into[i * 2] = cx + px * K; into[i * 2 + 1] = cy - py * K;
      }
      drawnPoints += count;
      return front > 0;
    };
    const areas = (list: Shape[], alpha: number, fill: string, stroke?: string, width = 0) => {
      if (alpha <= 0.004) return;
      ctx.beginPath();
      for (const s of list) {
        if (!visible(s) || !project(s)) continue;
        // Close to the ground an outline runs far outside the picture: it is cut to it.
        const cut = whole ? { points: scratch.a, count: s.count } : clipArea(scratch.a, s.count, left, top, right, bottom, scratch.work);
        if (cut.count < 3) continue;
        ctx.moveTo(cut.points[0], cut.points[1]);
        for (let i = 1; i < cut.count; i++) ctx.lineTo(cut.points[i * 2], cut.points[i * 2 + 1]);
        ctx.closePath();
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      ctx.fill('evenodd');
      if (stroke && width > 0) { ctx.strokeStyle = stroke; ctx.lineWidth = width * ratio; ctx.lineJoin = 'round'; ctx.stroke(); }
      ctx.globalAlpha = 1;
    };
    /** Trace lines into the current path, each stroke cut to the picture. `upTo` draws only so many metres of a path. */
    const trace = (s: Shape, upTo?: { along: Float64Array; metres: number }) => {
      if (!visible(s) || !project(s)) return;
      const p = scratch.a;
      let pen = false;
      for (let i = 0; i < s.count - 1; i++) {
        let x1 = p[i * 2 + 2], y1 = p[i * 2 + 3];
        if (upTo) {
          if (upTo.along[i] >= upTo.metres) break;
          if (upTo.along[i + 1] > upTo.metres) { const t = (upTo.metres - upTo.along[i]) / (upTo.along[i + 1] - upTo.along[i]); x1 = p[i * 2] + (x1 - p[i * 2]) * t; y1 = p[i * 2 + 1] + (y1 - p[i * 2 + 1]) * t; }
        }
        const cut = clipStroke(p[i * 2], p[i * 2 + 1], x1, y1, left, top, right, bottom);
        if (!cut) { pen = false; continue; }
        if (!pen || cut[0] !== p[i * 2] || cut[1] !== p[i * 2 + 1]) ctx.moveTo(cut[0], cut[1]);
        ctx.lineTo(cut[2], cut[3]);
        pen = cut[2] === x1 && cut[3] === y1;
      }
    };
    const lines = (list: Shape[], alpha: number, colour: string, width: number, dash?: number[]) => {
      if (alpha <= 0.004 || width <= 0) return;
      ctx.beginPath();
      for (const s of list) trace(s);
      ctx.globalAlpha = alpha; ctx.strokeStyle = colour; ctx.lineWidth = width * ratio; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (dash) ctx.setLineDash(dash.map(value => value * ratio));
      ctx.stroke();
      if (dash) ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    };
    /** A width given on the ground (metres), never thinner than `least` pixels. */
    const wide = (ground: number, least: number, most = 200) => Math.min(most, Math.max(least, ground / mpp));
    const point = (v: Vec) => { const front = dot(v, out) >= 0; return { x: cx + dot(v, east) * K, y: cy - dot(v, north) * K, front }; };

    // ---------- The sea, and the edge of the earth ----------
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = whole ? CHART.space : CHART.sea;
    ctx.fillRect(0, 0, W, H);
    if (whole) {
      ctx.fillStyle = CHART.sea;
      ctx.beginPath(); ctx.arc(cx, cy, K, 0, Math.PI * 2); ctx.fill();
    }
    // Lines of latitude and longitude, every fifteen degrees, while the earth is a ball.
    const grid = fade(9000, 2500);
    if (grid > 0.004) {
      ctx.beginPath();
      const step = 3;
      for (let lon = -180; lon < 180; lon += 15) { let pen = false; for (let lat = -84; lat <= 84; lat += step) { const p = point(place(lon, lat)); if (!p.front) { pen = false; continue; } if (pen) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); pen = true; } }
      for (let lat = -75; lat <= 75; lat += 15) { let pen = false; for (let lon = -180; lon <= 180; lon += step) { const p = point(place(lon, lat)); if (!p.front) { pen = false; continue; } if (pen) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); pen = true; } }
      ctx.globalAlpha = grid; ctx.strokeStyle = CHART.grid; ctx.lineWidth = 0.6 * ratio; ctx.stroke(); ctx.globalAlpha = 1;
    }

    // ---------- Land: three levels of detail, each handing over to the next ----------
    // A hand-over is in two halves, so that land is never seen through: first the finer level comes up
    // over the coarser one, then the coarser one goes from under it. Faded one against the other, land
    // that both have went pale half way, and the whole map looked milky for a moment.
    const toEurope = 1 - fade(9000, 5200), toIsles = 1 - fade(520, 300);
    const comes = (t: number) => Math.min(1, t * 2), goes = (t: number) => Math.min(1, 2 - t * 2);
    areas(data.world, goes(toEurope), CHART.land, CHART.coast, 0.7);
    areas(data.europe, Math.min(comes(toEurope), goes(toIsles)), CHART.land, CHART.coast, 0.7);
    areas(data.isles, comes(toIsles), CHART.land, CHART.coast, 0.7);
    // The earth is a ball: a little shade toward its edge, gone once it fills the picture.
    if (whole && grid > 0.004) {
      const shade = ctx.createRadialGradient(cx - K * 0.25, cy - K * 0.3, K * 0.2, cx, cy, K);
      shade.addColorStop(0, 'rgb(16 24 32 / 0)'); shade.addColorStop(0.72, 'rgb(16 24 32 / 0)'); shade.addColorStop(1, 'rgb(16 24 32 / .13)');
      ctx.globalAlpha = grid; ctx.fillStyle = shade; ctx.beginPath(); ctx.arc(cx, cy, K, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }

    // ---------- The city: its own coast (finer than the land above), river, railway and roads ----------
    const city = 1 - fade(110, 45);
    if (city > 0.004) {
      // The coast as surveyed, finer than the land above: land over everything, then the sea. Only inside the
      // box that was surveyed; outside it the coarser land still shows.
      ctx.save();
      ctx.beginPath();
      SURVEYED.forEach(([lon, lat], index) => { const p = point(place(lon, lat)); if (index) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
      ctx.closePath(); ctx.clip();
      // In two halves as well, so the bay does not go pale on the way: first the surveyed sea comes up
      // over the coarser land, then land comes up under it where the coarser map had sea.
      const wash = Math.max(0, city * 2 - 1);
      if (wash > 0.004) { ctx.globalAlpha = wash; ctx.fillStyle = CHART.land; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
      // The sea is filled as an area, and only its coast is drawn as a line: the area is the coast closed
      // well out to sea, and with an outline that closing showed as a box in the water.
      areas(data.city.sea, comes(city), CHART.sea);
      lines(data.city.coast, comes(city), CHART.coast, 0.7);
      areas(data.city.islands, comes(city), CHART.land, CHART.coast, 0.7);
      ctx.restore();
    }
    const street = 1 - fade(16, 9), close = 1 - fade(2.4, 1.2);
    areas(data.streets.parks, street, CHART.park);
    lines(data.city.river, (1 - fade(300, 150)) * (1 - street * 0.0), CHART.sea, wide(26, 1.2));
    areas(data.streets.water, street, CHART.sea, CHART.coast, 0.6);
    lines(data.city.rail, (1 - fade(110, 55)) * (1 - close * 0.6), CHART.rail, wide(3, 0.7, 2.2), [5, 4]);
    // Far out, roads are lines of ink of different weights. Close in, they are the streets themselves:
    // their real width, pale, with an edge.
    const ink = 1 - close * 0.85;
    lines(data.city.tertiary, (1 - fade(60, 34)) * (1 - street) * ink, CHART.minor, wide(7, 0.6, 3));
    lines(data.city.secondary, (1 - fade(120, 70)) * (1 - street) * ink, CHART.minor, wide(9, 0.8, 4));
    if (street > 0.004) {
      lines(data.streets.foot, street, CHART.casing, wide(5, 0.5) + 1);
      lines(data.streets.local, street, CHART.casing, wide(7.5, 0.8) + 1.6);
      lines(data.streets.main, street, CHART.casing, wide(11, 1.2) + 1.8);
      lines(data.streets.foot, street, CHART.street, wide(5, 0.5));
      lines(data.streets.local, street, CHART.street, wide(7.5, 0.8));
      lines(data.streets.main, street, CHART.street, wide(11, 1.2));
      lines(data.streets.tram, street * 0.8, CHART.rail, wide(1.4, 0.6, 1.6));
    }
    lines(data.city.primary, (1 - fade(240, 120)) * (1 - street), CHART.road, wide(12, 0.9, 5));
    lines(data.city.trunk, (1 - fade(420, 210)) * (1 - street), CHART.road, wide(14, 1, 6));
    lines(data.city.motorway, (1 - fade(420, 210)) * (1 - street * 0.7), CHART.road, wide(18, 1.3, 7));
    const built = 1 - fade(5, 2.5);
    areas(data.streets.buildings, built, CHART.building, CHART.buildingEdge, 0.6);
    if (doorBuilding && frame.door > 0.004 && built > 0.004) areas([doorBuilding], built * frame.door, CHART.route, CHART.route, 1.2);

    // ---------- Other parcels: traffic between the world's ports, while the earth is a ball ----------
    const traffic = frame.traffic * fade(9000, 3200);
    if (traffic > 0.004) {
      ctx.beginPath();
      for (const l of options.lanes) {
        let pen = false;
        for (let i = 0; i <= 36; i++) { const p = point([l.points[i * 3], l.points[i * 3 + 1], l.points[i * 3 + 2]]); if (!p.front) { pen = false; continue; } if (pen) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); pen = true; }
      }
      ctx.globalAlpha = traffic * 0.34; ctx.strokeStyle = CHART.traffic; ctx.lineWidth = 0.7 * ratio; ctx.stroke();
      ctx.globalAlpha = traffic * 0.9; ctx.fillStyle = CHART.traffic;
      ctx.beginPath();
      for (const l of options.lanes) for (let n = 0; n < 2; n++) {
        const t = (l.phase + n * 0.5 + frame.time * l.speed) % 1, p = point(between(l.a, l.b, t));
        if (!p.front) continue;
        ctx.moveTo(p.x + 1.7 * ratio, p.y); ctx.arc(p.x, p.y, 1.7 * ratio, 0, Math.PI * 2);
      }
      ctx.fill(); ctx.globalAlpha = 1;
    }

    // ---------- The one parcel: its journey, the van's run, and where it is now ----------
    const stroke = (s: Shape, upTo: { along: Float64Array; metres: number } | undefined, colour: string, width: number, alpha = 1) => {
      ctx.beginPath(); trace(s, upTo);
      ctx.globalAlpha = alpha; ctx.strokeStyle = colour; ctx.lineWidth = width * ratio; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); ctx.globalAlpha = 1;
    };
    if (frame.drawn > 0) {
      const upTo = { along: frame.journey.along, metres: frame.drawn };
      const far = fade(60, 20);                              // the sea leg matters less once in the city
      stroke(frame.journey.shape, upTo, CHART.glow, 5.2, 0.85 * Math.max(0.25, far));
      stroke(frame.journey.shape, upTo, CHART.route, 2.2, Math.max(0.3, far));
    }
    if (frame.run >= 0) {
      // The whole run faint, as planned; the part driven, in full.
      const along = runAlong(data.run);
      const planned = 1 - fade(60, 30);
      stroke(data.run, undefined, CHART.route, wide(4, 1.4, 5), planned * 0.26);
      if (frame.run > 0) { stroke(data.run, { along, metres: frame.run }, CHART.glow, wide(5, 2.4, 7) + 2.6, planned * 0.9); stroke(data.run, { along, metres: frame.run }, CHART.route, wide(5, 2.4, 7), planned); }
      // The stops, as rings; the ones behind the van, filled.
      const dots = 1 - fade(26, 13);
      if (dots > 0.004) {
        const r = Math.max(2.6, Math.min(7, 9 / mpp)) * ratio;
        data.stops.forEach((stop, index) => {
          const p = point(place(stop.lon, stop.lat));
          if (!p.front) return;
          const done = frame.van >= stop.metres - 1, followed = index === data.followed;
          ctx.globalAlpha = dots; ctx.beginPath(); ctx.arc(p.x, p.y, r * (followed ? 1.35 : 1), 0, Math.PI * 2);
          ctx.fillStyle = done ? CHART.route : CHART.land; ctx.fill();
          ctx.strokeStyle = CHART.route; ctx.lineWidth = 1.5 * ratio; ctx.stroke(); ctx.globalAlpha = 1;
        });
      }
    }
    // The parcel itself: a dot with a ring that says "here". On the run it is the van.
    const here = frame.run >= 0 && frame.van >= 0 ? runPlace(data.run, frame.van) : pathAt(frame.journey, frame.parcel);
    const at = point(here);
    if (at.front) {
      const r = 5.2 * ratio;
      ctx.beginPath(); ctx.arc(at.x, at.y, r * 2.3, 0, Math.PI * 2); ctx.fillStyle = 'rgb(214 0 126 / .16)'; ctx.fill();
      ctx.beginPath(); ctx.arc(at.x, at.y, r, 0, Math.PI * 2); ctx.fillStyle = CHART.route; ctx.fill();
      ctx.lineWidth = 2 * ratio; ctx.strokeStyle = CHART.glow; ctx.stroke();
    }

    // ---------- Names ----------
    if (frame.labels > 0.004) {
      ctx.textBaseline = 'middle';
      for (const label of options.labels) {
        // Shown between two scales (`from` the coarser, `to` the finer), with a soft edge at each end.
        const alpha = Math.min(fade(label.to, label.to * 0.7), 1 - fade(label.from, label.from * 0.7)) * frame.labels;
        if (alpha <= 0.01) continue;
        const p = point(place(label.lon, label.lat));
        if (!p.front || p.x < -200 || p.x > W + 200 || p.y < -50 || p.y > H + 50) continue;
        const px = (label.size ?? 12) * ratio, side = label.side ?? 'right', gap = 9 * ratio;
        ctx.font = `${label.weight ?? 600} ${px}px ${options.font}`;
        ctx.textAlign = side === 'left' ? 'right' : side === 'right' ? 'left' : 'center';
        const x = p.x + (side === 'left' ? -gap : side === 'right' ? gap : 0), y = p.y + (side === 'above' ? -gap - px * 0.4 : side === 'below' ? gap + px * 0.4 : 0);
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 3.4 * ratio; ctx.strokeStyle = 'rgb(248 248 244 / .9)'; ctx.lineJoin = 'round'; ctx.strokeText(label.text, x, y);
        ctx.fillStyle = CHART.ink; ctx.fillText(label.text, x, y);
        if (p.x > 0 && p.x < W && p.y > 0 && p.y < H) (alpha >= 0.98 * frame.labels ? drawnNames : fadingNames).push(label.text);
        if (side !== 'above' && side !== 'below') { ctx.beginPath(); ctx.arc(p.x, p.y, 2.2 * ratio, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
    }
  };

  // The run's own lengths along it, worked out once.
  let runLengths: Float64Array | null = null;
  const runAlong = (run: Shape) => {
    if (runLengths) return runLengths;
    const along = new Float64Array(run.count);
    for (let i = 1; i < run.count; i++) along[i] = along[i - 1] + metres([run.xyz[i * 3 - 3], run.xyz[i * 3 - 2], run.xyz[i * 3 - 1]], [run.xyz[i * 3], run.xyz[i * 3 + 1], run.xyz[i * 3 + 2]]);
    runLengths = along;
    return along;
  };
  const runPlace = (run: Shape, distance: number): Vec => pathAt({ shape: run, along: runAlong(run), length: runAlong(run)[run.count - 1] }, distance);

  return {
    resize, render,
    locate(lon, lat) { const v = place(lon, lat); return { x: (last.cx + dot(v, last.east) * last.K) / size.ratio, y: (last.cy - dot(v, last.north) * last.K) / size.ratio, front: dot(v, last.out) >= 0 }; },
    get drawnPoints() { return drawnPoints; },
    get drawnNames() { return drawnNames; },
    get fadingNames() { return fadingNames; },
    get doorPlace() { return doorBuilding ? [Math.atan2(doorBuilding.mid[0], doorBuilding.mid[2]) * 180 / Math.PI, Math.asin(doorBuilding.mid[1]) * 180 / Math.PI] as [number, number] : null; },
  };
}

export { EARTH };
