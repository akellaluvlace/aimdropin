// The watch, drawn. A small WebGL2 renderer for one object: Sum's watch, built from photographs of its
// parts (scripts/gsap/sum/prepare.mjs) and their measured outlines (watch-parts.ts). Each part is two
// photographed faces and an extruded side wall, so it can be lifted out, turned and looked at from any
// side; glass and shadows are drawn, and so are the hands (hands.ts), which have to stay sharp from a
// hand's width away. The choreography (rig.ts) only moves numbers: the camera, each part's place, the
// hands' angles.
//
// It follows the rules of the other canvases here: it never reads or writes a scroll position; it
// draws only when asked; a lost context is rebuilt; and on touch screens its size follows the stage,
// which does not change when a browser toolbar moves.

import { CASE_R, MEASURED } from '../watch-parts';
import { HANDS, handHalfWidth, handOutline, handUniforms, type HandName, type HandShape } from './hands';
import { compose, mat4, mul, perspective, rotation, transform, view, FOV, type Camera, type Mat4 } from './mat';
import { FACE_VERTEX, GLASS_FRAGMENT, HAND_FRAGMENT, LONE_EDGE_FRAGMENT, LONE_GLASS_FRAGMENT, PHOTO_FRAGMENT, SHAPE_FRAGMENT, WALL_FRAGMENT, WALL_VERTEX } from './shaders';

export type PartId = 'crystal' | 'case' | 'hands' | 'dial' | 'calibre' | 'rotor' | 'caseback' | 'strapTop' | 'strapBottom';
export const PART_IDS: PartId[] = ['crystal', 'case', 'hands', 'dial', 'calibre', 'rotor', 'caseback', 'strapTop', 'strapBottom'];

/** Where a part is, relative to its place in the assembled watch: mm along its axes, radians about them. */
export interface PartPose { x: number; y: number; z: number; rx: number; ry: number; rz: number; visible: boolean }

export interface WatchState {
  camera: Camera;
  parts: Record<PartId, PartPose>;
  /**
   * The hands' angles, clockwise from 12, radians. At their own stop they come apart along the axis: the
   * seconds hand `lift` mm above its place, the hour hand `drop` mm below its own. The minute hand stays.
   */
  hands: { hour: number; minute: number; second: number; lift: number; drop: number };
  /** The dial's photograph, and one sweeping in over it clockwise from 12 (`sweep` in radians, 0 for none). */
  dial: { face: string; next: string; sweep: number };
  /** The rotor's swing, radians. */
  rotor: number;
  /** 0 to 1: the shadow under the watch, the sunray's highlight, the crystal's presence. */
  ground: number; sunray: number; glass: number;
  /** The whole watch turned about its middle, radians (turning it over is `ry` going to a half turn). */
  turn: { rx: number; ry: number; rz: number };
}

type Rgb = [number, number, number];
interface Material { base: Rgb; shine: number; brush: number; alpha?: number; round?: number; bevel?: number; knurl?: number }
const STEEL: Material = { base: [0.80, 0.81, 0.83], shine: 0.95, brush: 9, round: 0.34, bevel: 0.075 };
const BACK_STEEL: Material = { base: [0.80, 0.81, 0.83], shine: 0.95, brush: 9, round: 0.2, bevel: 0.16 };
const BORE: Material = { base: [0.74, 0.75, 0.77], shine: 0.80, brush: 7 };
const POLISHED: Material = { base: [0.82, 0.83, 0.85], shine: 1.0, brush: 0, round: 0.25 };
const CROWN_STEEL: Material = { base: [0.82, 0.83, 0.85], shine: 1.0, brush: 0, knurl: 2.6, bevel: 0.12 };
const RHODIUM: Material = { base: [0.76, 0.76, 0.78], shine: 0.90, brush: 5 };
const TUNGSTEN: Material = { base: [0.34, 0.35, 0.37], shine: 0.85, brush: 10, bevel: 0.14 };
/**
 * The sides of the bracelet's links: brushed along their length like the case's flank, with a polished bevel
 * at each edge. A length is straight, so its side is one flat band that can face the light all at once:
 * it is rounder than the case's flank and a shade darker, or it goes as pale as the paper behind it.
 */
const LINKS: Material = { base: [0.70, 0.71, 0.73], shine: 0.90, brush: 9, round: 0.62, bevel: 0.12 };
const SILVERED: Material = { base: [0.80, 0.80, 0.81], shine: 0.70, brush: 0 };
const SAPPHIRE: Material = { base: [0.80, 0.90, 0.97], shine: 0.95, brush: 0, alpha: 0.42 };
/** The crystal is still "on the watch" this far from its seat, and wholly on its own from this far (mm). */
const CRYSTAL_APART: [number, number] = [1.5, 12];
/** The crown: a knurled barrel at 3 o'clock. Measured from the head's outline, which it is taken out of. */
const CROWN = { y: 0.14, radius: 2.85, length: 2.27 };

/**
 * Bottom and top of each part in the assembled watch, mm. The dial's top is 1.7 mm under the crystal.
 * From the crystal's top to the caseback is 9.6 mm, which is the height the page gives the watch.
 */
export const HEIGHTS: Record<Exclude<PartId, 'hands'>, [number, number]> = {
  crystal: [3.9, 4.6], case: [-4.2, 4.2], dial: [1.8, 2.2], calibre: [-2.45, 1.75], rotor: [-3.35, -2.55], caseback: [-5.0, -3.5],
  // The bracelet's links are 3 mm of steel, and its end links sit between the lugs, over the spring bars.
  strapTop: [-2.9, 0.1], strapBottom: [-2.9, 0.1],
};
const BAR_Z: [number, number] = [-1.98, -0.62];
/** The top of each hand above the watch's middle: the hour hand lowest, the seconds hand over the other two. */
const HAND_Z: Record<HandName, number> = { hour: 2.72, minute: 3.06, second: 3.40 };
/** The hands in the order they are stacked, with which way each goes along the axis when they come apart. */
const HAND_ORDER: readonly (readonly [HandName, -1 | 0 | 1])[] = [['hour', -1], ['minute', 0], ['second', 1]];
// A hand's edge: blued steel is blue all the way through its skin, and so is lacquer red. The tube a hand
// is pressed on by is left bright.
const BLUED_EDGE: Material = { base: [0.050, 0.105, 0.44], shine: 0.95, brush: 0 };
const LACQUER_EDGE: Material = { base: [0.60, 0.050, 0.13], shine: 0.80, brush: 0 };
const TUBE: Material = { base: [0.82, 0.83, 0.85], shine: 1.0, brush: 0 };
const TUBE_BORE: Material = { base: [0.34, 0.35, 0.38], shine: 0.70, brush: 0 };
const LIGHT: [number, number] = [-0.35, -0.42]; // the key light's lean, for shadows

const circle = (radius: number, clockwise = false, segments = 96): number[] => {
  const loop: number[] = [];
  for (let i = 0; i < segments; i++) { const a = ((clockwise ? -i : i) / segments) * Math.PI * 2; loop.push(Math.cos(a) * radius, Math.sin(a) * radius); }
  return loop;
};
const rectangle = (cx: number, cy: number, hx: number, hy: number): number[] => [cx - hx, cy - hy, cx + hx, cy - hy, cx + hx, cy + hy, cx - hx, cy + hy];

export interface Watch {
  readonly supported: true;
  readonly state: WatchState;
  /** Fetch and upload photographs by name (files in the parts folder). Resolves when they can be drawn. */
  load(names: string[]): Promise<void>;
  /** A decoded photograph, to draw onto a canvas (the dial gets its lettering that way). */
  image(name: string): HTMLImageElement | undefined;
  /** Replace a photograph with anything a texture can be made from. */
  setTexture(name: string, source: TexImageSource): void;
  /** Fit the drawing to the canvas's box (CSS pixels). */
  resize(width: number, height: number): void;
  render(): void;
  /** Where a point of a part (mm from the part's own middle, in its own frame) is on the canvas, CSS pixels. Call after `render`. */
  project(part: PartId, x: number, y: number, z: number): { x: number; y: number; behind: boolean };
  /** How many CSS pixels a millimetre at the camera's target covers. */
  scale(): number;
  destroy(): void;
}

export const defaultPose = (): PartPose => ({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, visible: true });
export const defaultState = (): WatchState => ({
  camera: { tx: 0, ty: 0, tz: 0, az: 0, el: Math.PI / 2, roll: 0, span: 80, shiftX: 0, shiftY: 0 },
  parts: Object.fromEntries(PART_IDS.map(id => [id, defaultPose()])) as Record<PartId, PartPose>,
  hands: { hour: 0, minute: 0, second: 0, lift: 0, drop: 0 },
  dial: { face: 'dial-silver', next: 'dial-silver', sweep: 0 },
  rotor: 0, ground: 1, sunray: 0.5, glass: 1,
  turn: { rx: 0, ry: 0, rz: 0 },
});

export interface WatchOptions {
  /** Folder the photographs are served from, without a trailing slash. */
  base: string;
  /** `l` for large photographs (desks), `s` for small (phones). */
  detail: 'l' | 's';
  maxRatio?: number;
  maxPixels?: number;
}

export function createWatch(canvas: HTMLCanvasElement, options: WatchOptions): Watch | null {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, depth: true, stencil: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const maxRatio = options.maxRatio ?? 2, maxPixels = options.maxPixels ?? 4.4e6;
  const state = defaultState();

  // ---------- Programs ----------
  type Program = { program: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };
  let photo: Program, glass: Program, loneGlass: Program, loneEdge: Program, shape: Program, hand: Program, wall: Program;
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(`Sum watch shader: ${log}`); }
    return shader;
  };
  const link = (vertex: string, fragment: string): Program => {
    const program = gl.createProgram()!;
    const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
    gl.attachShader(program, vs); gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Sum watch program: ${gl.getProgramInfoLog(program)}`);
    const u: Program['u'] = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) { const info = gl.getActiveUniform(program, i); if (info) u[info.name] = gl.getUniformLocation(program, info.name); }
    return { program, u };
  };

  // ---------- Geometry ----------
  let quad: WebGLVertexArrayObject | null = null;
  const buffers: WebGLBuffer[] = [];
  type Wall = { vao: WebGLVertexArrayObject; count: number };
  const walls: Record<string, Wall> = {};
  const buildWall = (loops: readonly (readonly number[])[]): Wall => {
    const vertices: number[] = [], indices: number[] = [];
    for (const loop of loops) {
      const n = loop.length / 2;
      const px = (i: number) => loop[((i % n) + n) % n * 2], py = (i: number) => loop[((i % n) + n) % n * 2 + 1];
      // Outward from a counter-clockwise outline (and into a clockwise hole): the travel direction turned right.
      const edge = (i: number): [number, number] => { const dx = px(i + 1) - px(i), dy = py(i + 1) - py(i), l = Math.hypot(dx, dy) || 1; return [dy / l, -dx / l]; };
      // Round parts shade smoothly; a real corner (a lug meeting the case) keeps its edge.
      const blend = (a: [number, number], b: [number, number]): [number, number] => { if (a[0] * b[0] + a[1] * b[1] < 0.80) return b; const x = a[0] + b[0], y = a[1] + b[1], l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
      let arc = 0;
      for (let i = 0; i < n; i++) {
        const here = edge(i), before = edge(i - 1), after = edge(i + 1);
        const startNormal = blend(before, here)[0] === here[0] && blend(before, here)[1] === here[1] ? here : blend(before, here);
        const endBlend = blend(here, after);
        const endNormal = endBlend[0] === after[0] && endBlend[1] === after[1] && (here[0] * after[0] + here[1] * after[1] < 0.80) ? here : endBlend;
        const length = Math.hypot(px(i + 1) - px(i), py(i + 1) - py(i));
        const base = vertices.length / 6;
        vertices.push(px(i), py(i), 0, startNormal[0], startNormal[1], arc, px(i), py(i), 1, startNormal[0], startNormal[1], arc);
        arc += length;
        vertices.push(px(i + 1), py(i + 1), 0, endNormal[0], endNormal[1], arc, px(i + 1), py(i + 1), 1, endNormal[0], endNormal[1], arc);
        indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
    }
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vertexBuffer = gl.createBuffer()!, indexBuffer = gl.createBuffer()!;
    buffers.push(vertexBuffer, indexBuffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 24, 8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 24, 12);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 24, 20);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, vertices.length / 6 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: indices.length };
  };
  // The bracelet's two lengths: the one with the clasp at 12 o'clock, the plain one at 6. (As parts they are
  // strapTop and strapBottom, the names the score and the rig know them by.)
  const strap = {
    strapTop: { ...MEASURED.bracelet.clasp, photo: 'bracelet-clasp', seams: MEASURED.bracelet.clasp.joints.map(joint => -joint) },
    strapBottom: { ...MEASURED.bracelet.plain, photo: 'bracelet-plain', seams: MEASURED.bracelet.plain.joints.map(joint => -joint) },
  };
  /** A length's outline, moved so its end link is at y = 0 and it runs toward -y (as its photograph does). */
  const strapLoops = (piece: { length: number; loops: readonly (readonly number[])[] }) => piece.loops.map(loop => loop.map((value, i) => (i % 2 ? value - piece.length / 2 : value)));

  const build = () => {
    photo = link(FACE_VERTEX, PHOTO_FRAGMENT);
    glass = link(FACE_VERTEX, GLASS_FRAGMENT);
    loneGlass = link(FACE_VERTEX, LONE_GLASS_FRAGMENT);
    loneEdge = link(WALL_VERTEX, LONE_EDGE_FRAGMENT);
    shape = link(FACE_VERTEX, SHAPE_FRAGMENT);
    hand = link(FACE_VERTEX, HAND_FRAGMENT);
    wall = link(WALL_VERTEX, WALL_FRAGMENT);
    quad = gl.createVertexArray();
    gl.bindVertexArray(quad);
    const buffer = gl.createBuffer()!;
    buffers.push(buffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    // The head's outline has the crown in it, and a wall pulled up from that would make the crown a slab:
    // the outline is closed along the case there, and the crown is a barrel of its own.
    walls.caseOuter = buildWall(MEASURED.case.outer.map(loop => {
      // Everything between these two angles is the crown and its root: the case's own curve goes there instead.
      const from = Math.asin((CROWN.y - CROWN.radius - 0.4) / CASE_R), to = Math.asin((CROWN.y + CROWN.radius + 0.4) / CASE_R), margin = 0.009;
      const kept: number[] = [];
      let bridged = false;
      for (let i = 0; i < loop.length; i += 2) {
        const x = loop[i], y = loop[i + 1], angle = Math.atan2(y, x);
        if (x < 0 || angle < from - margin || angle > to + margin) { kept.push(x, y); continue; }
        if (bridged) continue;
        bridged = true;
        // The outline runs counter-clockwise, so upward here.
        for (let step = 0; step <= 6; step++) { const a = from + ((to - from) * step) / 6; kept.push(Math.cos(a) * CASE_R, Math.sin(a) * CASE_R); }
      }
      return kept;
    }));
    walls.crown = buildWall([circle(CROWN.radius, false, 56)]);
    walls.caseBore = buildWall([circle(MEASURED.case.hole, true)]);
    walls.bars = buildWall(MEASURED.bars.map(bar => rectangle(bar.x, bar.y, bar.halfX, bar.halfY)));
    walls.crystal = buildWall([circle(MEASURED.case.hole - 0.05)]);
    walls.dial = buildWall([circle(MEASURED.dial.r - 0.03)]);
    walls.calibre = buildWall([circle(MEASURED.calibre.r - 0.08)]);
    walls.rotor = buildWall(MEASURED.rotor.loops);
    walls.caseback = buildWall([circle(MEASURED.caseback.r), circle(MEASURED.caseback.window, true)]);
    walls.strapTop = buildWall(strapLoops(strap.strapTop));
    walls.strapBottom = buildWall(strapLoops(strap.strapBottom));
    // A hand: its edge, the tube it is pressed on by, and (the blades) the hole through it.
    for (const [name] of HAND_ORDER) {
      const piece = HANDS[name];
      walls[`hand-${name}`] = buildWall([handOutline(piece)]);
      walls[`pipe-${name}`] = buildWall([circle(piece.pipe[0], false, 48)]);
      if (piece.kind === 0) walls[`hole-${name}`] = buildWall([circle(piece.hole, true, 48)]);
    }
  };

  // ---------- Photographs ----------
  type Photo = { texture: WebGLTexture; width: number; height: number };
  const photos = new Map<string, Photo>();
  const sources = new Map<string, TexImageSource>();
  const images = new Map<string, HTMLImageElement>();
  const pending = new Map<string, Promise<void>>();
  const anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');
  const upload = (name: string, source: TexImageSource) => {
    const old = photos.get(name);
    if (old) gl.deleteTexture(old.texture);
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (anisotropy) gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number));
    const size = source as { width: number; height: number };
    photos.set(name, { texture, width: size.width, height: size.height });
    sources.set(name, source);
  };
  /** `name` without a size tag: sized files are `<name>-l.webp` and `<name>-s.webp`; the bars have one size. */
  const fileOf = (name: string) => `${options.base}/${name}${name.startsWith('bar-') ? '' : `-${options.detail}`}.webp`;
  let alive = true, lost = false;
  const loadOne = (name: string): Promise<void> => {
    const existing = pending.get(name);
    if (existing) return existing;
    const job = (async () => {
      const image = new Image();
      image.decoding = 'async';
      image.src = fileOf(name);
      await image.decode();
      if (!alive) return;
      images.set(name, image);
      if (!sources.has(name) && !lost) upload(name, image); else if (!sources.has(name)) sources.set(name, image);
    })();
    pending.set(name, job);
    return job;
  };

  // ---------- Size ----------
  const size = { width: 0, height: 0, cssWidth: 1, cssHeight: 1 };
  const resize = (width: number, height: number) => {
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, maxRatio, Math.sqrt(maxPixels / (width * height)));
    size.cssWidth = width; size.cssHeight = height;
    const w = Math.max(1, Math.round(width * ratio)), h = Math.max(1, Math.round(height * ratio));
    if (w !== size.width || h !== size.height) { size.width = canvas.width = w; size.height = canvas.height = h; }
  };

  // ---------- Drawing ----------
  const viewMatrix = mat4(), projection = mat4(), viewProj = mat4();
  const models = Object.fromEntries(PART_IDS.map(id => [id, mat4()])) as Record<PartId, Mat4>;
  const rotations = Object.fromEntries(PART_IDS.map(id => [id, new Float32Array(9)])) as Record<PartId, Float32Array>;
  const scratch = mat4(), scratchRot = new Float32Array(9), turnMatrix = mat4();
  const crownModel = mat4(), crownRot = new Float32Array(9);
  // Each hand turns about the axis in the hands' own frame, and throws a shadow that lies in the dial's.
  const perHand = <T>(make: () => T): Record<HandName, T> => ({ hour: make(), minute: make(), second: make() });
  const handModels = perHand(mat4), handRots = perHand(() => new Float32Array(9)), shadowModels = perHand(mat4), shadowRots = perHand(() => new Float32Array(9));
  // How far each stands from its place along the axis, and where its top is in the hands' own frame.
  const handAway: Record<HandName, number> = { hour: 0, minute: 0, second: 0 }, handTop: Record<HandName, number> = { hour: 0, minute: 0, second: 0 };
  const handShapes: Record<HandName, ReturnType<typeof handUniforms>> = { hour: handUniforms(HANDS.hour), minute: handUniforms(HANDS.minute), second: handUniforms(HANDS.second) };
  let eye: [number, number, number] = [0, 0, 100];
  const middle = (id: PartId) => (id === 'hands' ? HAND_Z.minute : (HEIGHTS[id][0] + HEIGHTS[id][1]) / 2);
  const thickness = (id: PartId) => (id === 'hands' ? 0 : HEIGHTS[id][1] - HEIGHTS[id][0]);

  const place = () => {
    const { camera, parts } = state;
    const aspect = size.cssWidth / size.cssHeight;
    const found = view(viewMatrix, camera);
    eye = found.eye;
    perspective(projection, FOV, aspect, Math.max(5, found.distance - 320), found.distance + 520, camera.shiftX, camera.shiftY);
    mul(viewProj, projection, viewMatrix);
    const { turn } = state;
    const turned = turn.rx || turn.ry || turn.rz ? compose(turnMatrix, 0, 0, 0, turn.rx, turn.ry, turn.rz) : null;
    for (const id of PART_IDS) {
      const pose = parts[id];
      if (id === 'strapTop' || id === 'strapBottom') {
        // A length's own frame starts at its end link, which stands this far from the watch's middle, cut to the case.
        const sign = id === 'strapTop' ? 1 : -1;
        compose(models[id], pose.x, pose.y + sign * strap[id].at, middle(id) + pose.z, pose.rx, pose.ry, pose.rz + (sign > 0 ? Math.PI : 0));
      } else compose(models[id], pose.x, pose.y, middle(id) + pose.z, pose.rx, pose.ry, pose.rz + (id === 'rotor' ? state.rotor : 0));
      if (turned) mul(models[id], turned, models[id]);
      rotation(rotations[id], models[id]);
    }
    for (const [name, order] of HAND_ORDER) {
      mul(handModels[name], models.hands, compose(scratch, 0, 0, 0, 0, 0, -state.hands[name]));
      rotation(handRots[name], handModels[name]);
      handAway[name] = order < 0 ? -state.hands.drop : order > 0 ? state.hands.lift : 0;
      handTop[name] = HAND_Z[name] - HAND_Z.minute + handAway[name];
    }
  };

  type Item = { depth: number; draw: () => void };
  const viewDepth = (model: Mat4, x: number, y: number, z: number) => { const p = transform(model, x, y, z); return viewMatrix[2] * p[0] + viewMatrix[6] * p[1] + viewMatrix[10] * p[2] + viewMatrix[14]; };

  const bind = (program: Program, model: Mat4, rot: Float32Array) => {
    gl.useProgram(program.program);
    gl.uniformMatrix4fv(program.u.uViewProj, false, viewProj);
    gl.uniformMatrix4fv(program.u.uModel, false, model);
    if (program.u.uRot) gl.uniformMatrix3fv(program.u.uRot, false, rot);
    if (program.u.uCam) gl.uniform3f(program.u.uCam, eye[0], eye[1], eye[2]);
  };
  const face = (program: Program, halfX: number, halfY: number, z: number, mirror = false, cx = 0, cy = 0) => {
    gl.uniform2f(program.u.uHalf, halfX, halfY);
    gl.uniform2f(program.u.uCentre, cx, cy);
    gl.uniform1f(program.u.uZ, z);
    gl.uniform1f(program.u.uMirror, mirror ? 1 : 0);
    gl.bindVertexArray(quad);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  const seamsAt = new Float32Array(16);
  /** A side wall from `zFrom` to `zTo`. `seams` are places along the part's own y where one link ends and the next begins. */
  const drawWall = (which: string, model: Mat4, rot: Float32Array, zFrom: number, zTo: number, material: Material, seams?: readonly number[]) => {
    const mesh = walls[which];
    if (!mesh) return;
    bind(wall, model, rot);
    const count = Math.min(seams?.length ?? 0, seamsAt.length);
    gl.uniform1i(wall.u.uSeamCount, count);
    // (An array's name is reported with its first index by most drivers, and bare by a few.)
    if (count) { for (let i = 0; i < count; i++) seamsAt[i] = seams![i]; gl.uniform1fv(wall.u['uSeams[0]'] ?? wall.u.uSeams ?? null, seamsAt); }
    gl.uniform2f(wall.u.uZ, zFrom, zTo);
    gl.uniform3f(wall.u.uBase, material.base[0], material.base[1], material.base[2]);
    gl.uniform1f(wall.u.uShine, material.shine);
    gl.uniform1f(wall.u.uBrush, material.brush);
    gl.uniform1f(wall.u.uRound, material.round ?? 0);
    gl.uniform1f(wall.u.uBevel, material.bevel ?? 0);
    gl.uniform1f(wall.u.uKnurl, material.knurl ?? 0);
    gl.uniform1f(wall.u.uAlpha, material.alpha ?? 1);
    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, mesh.count, mesh.count > 65535 * 1.5 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
  };
  type FaceSpec = { part: PartId; name: string; halfX: number; halfY: number; z: number; mirror: boolean; cx?: number; cy?: number; caster?: [number, number, number, number]; sunray?: number; dim?: number; second?: string; sweep?: number; cut?: boolean };
  const drawPhoto = (spec: FaceSpec, pass: 0 | 1) => {
    const tex = photos.get(spec.name);
    if (!tex) return;
    bind(photo, models[spec.part], rotations[spec.part]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex.texture);
    gl.uniform1i(photo.u.uTex, 0);
    const second = spec.second && spec.sweep ? photos.get(spec.second) : undefined;
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, (second ?? tex).texture);
    gl.uniform1i(photo.u.uTex2, 1);
    gl.uniform1f(photo.u.uSweep, second ? spec.sweep! : 0);
    gl.uniform1i(photo.u.uPass, pass);
    const caster = spec.caster ?? [0, 0, 1, 0];
    gl.uniform4f(photo.u.uCaster, caster[0], caster[1], caster[2], caster[3]);
    gl.uniform1f(photo.u.uSunray, spec.sunray ?? 0);
    gl.uniform1f(photo.u.uDim, spec.dim ?? 0.22);
    gl.uniform1f(photo.u.uShade, 1);
    gl.uniform4f(photo.u.uCut, CASE_R + 0.12, CROWN.y, CROWN.radius + 0.75, spec.cut ? 1 : 0);
    face(photo, spec.halfX, spec.halfY, spec.z, spec.mirror, spec.cx ?? 0, spec.cy ?? 0);
  };
  const drawShape = (model: Mat4, rot: Float32Array, kind: 1 | 2, dims: [number, number, number, number], colour: Rgb, alpha: number, halfX: number, halfY: number, z: number, cx = 0, cy = 0, soft = 0, gloss = 0, turned = 0) => {
    bind(shape, model, rot);
    gl.uniform1f(shape.u.uTurned, turned);
    gl.uniform1i(shape.u.uShape, kind);
    gl.uniform4f(shape.u.uDims, dims[0], dims[1], dims[2], dims[3]);
    gl.uniform3f(shape.u.uColor, colour[0], colour[1], colour[2]);
    gl.uniform1f(shape.u.uAlpha, alpha);
    gl.uniform1f(shape.u.uSoft, soft);
    gl.uniform1f(shape.u.uGloss, gloss);
    face(shape, halfX, halfY, z, false, cx, cy);
  };
  /** A hand's face at height `z` in `model`: its solid middle (pass 0), its soft edge (1), or its shadow (2), `soft` mm softer at the edge. */
  const drawHand = (model: Mat4, rot: Float32Array, name: HandName, pass: 0 | 1 | 2, z: number, alpha = 1, soft = 0, colour: Rgb = [0, 0, 0]) => {
    const piece: HandShape = HANDS[name], [a, b] = handShapes[name];
    bind(hand, model, rot);
    gl.uniform1i(hand.u.uKind, piece.kind);
    gl.uniform1i(hand.u.uPass, pass);
    gl.uniform4f(hand.u.uA, a[0], a[1], a[2], a[3]);
    gl.uniform4f(hand.u.uB, b[0], b[1], b[2], b[3]);
    gl.uniform3f(hand.u.uColor, colour[0], colour[1], colour[2]);
    gl.uniform1f(hand.u.uAlpha, alpha);
    gl.uniform1f(hand.u.uSoft, soft);
    // Room round the outline for its soft edge: a shadow's is wide.
    const room = 0.3 + soft * 2.5;
    face(hand, handHalfWidth(piece) + room, (piece.tail + piece.length) / 2 + room, z, false, 0, (piece.length - piece.tail) / 2);
  };
  /**
   * A face of sapphire. `apart` is how far the crystal has come from the watch (0 seated, 1 on its own): away
   * from it the glass is drawn by a program of its own. Seated it is drawn exactly as it always was.
   */
  const drawGlass = (model: Mat4, rot: Float32Array, radius: number, z: number, rim: number, dome: number, alpha: number, apart = 0) => {
    const program = apart > 0 ? loneGlass : glass;
    bind(program, model, rot);
    gl.uniform1f(program.u.uRadius, radius);
    gl.uniform1f(program.u.uRim, rim);
    gl.uniform1f(program.u.uDome, dome);
    gl.uniform1f(program.u.uAlpha, alpha);
    if (apart > 0) gl.uniform1f(program.u.uApart, apart);
    face(program, radius * 1.02, radius * 1.02, z);
  };
  /** The crystal's edge away from the watch: the wall's own mesh, drawn as ground glass. */
  const drawLoneEdge = (model: Mat4, rot: Float32Array, zFrom: number, zTo: number, alpha: number, apart: number) => {
    const mesh = walls.crystal;
    if (!mesh) return;
    bind(loneEdge, model, rot);
    gl.uniform2f(loneEdge.u.uZ, zFrom, zTo);
    gl.uniform3f(loneEdge.u.uBase, SAPPHIRE.base[0], SAPPHIRE.base[1], SAPPHIRE.base[2]);
    gl.uniform1f(loneEdge.u.uShine, SAPPHIRE.shine);
    gl.uniform1f(loneEdge.u.uAlpha, alpha);
    gl.uniform1f(loneEdge.u.uApart, apart);
    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, mesh.count, mesh.count > 65535 * 1.5 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
  };

  /** The shadow a part above throws on this one: only between parts still on the axis and level with each other. */
  const casterFor = (below: PartId, above: PartId, radius: number): [number, number, number, number] => {
    const a = state.parts[above], b = state.parts[below];
    if (!a.visible || Math.abs(a.rx) + Math.abs(a.ry) + Math.abs(b.rx) + Math.abs(b.ry) > 0.2) return [0, 0, 1, 0];
    const gap = (above === 'hands' ? HAND_Z.hour : HEIGHTS[above][0]) + a.z - (HEIGHTS[below as Exclude<PartId, 'hands'>][1] + b.z);
    if (gap < 0.4) return [0, 0, 1, 0];
    const strength = 0.30 * Math.min(1, (gap - 0.4) / 5) * (1 - Math.min(1, Math.max(0, (gap - 14) / 46)));
    return [a.x - b.x - LIGHT[0] * gap * 0.30, a.y - b.y - LIGHT[1] * gap * 0.30, radius + gap * 0.05, strength];
  };

  const render = () => {
    if (lost || !alive || !size.width) return;
    place();
    const { parts } = state;
    gl.viewport(0, 0, size.width, size.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // The shadow on the table, under everything.
    if (state.ground > 0.01) {
      gl.disable(gl.DEPTH_TEST);
      const table = compose(scratch, -LIGHT[0] * 5, -LIGHT[1] * 5, -5.4, 0, 0, 0);
      rotation(scratchRot, table);
      // Turned on edge, the watch throws a narrow shadow, and a fainter one.
      const flat = Math.abs(Math.cos(state.turn.ry));
      drawShape(table, scratchRot, 2, [27 * Math.max(0.2, flat), 31, 0, 0], [0.05, 0.06, 0.09], 0.34 * state.ground * (0.45 + 0.55 * flat), 40, 44, 0);
    }

    const faces: FaceSpec[] = [];
    const half = MEASURED.case.half;
    const on = (id: PartId) => parts[id].visible;
    if (on('case')) {
      faces.push({ part: 'case', name: 'case-top', halfX: half, halfY: half, z: thickness('case') / 2, mirror: false, cut: true, caster: casterFor('case', 'crystal', MEASURED.case.hole) });
      faces.push({ part: 'case', name: 'case-bottom', halfX: half, halfY: half, z: -thickness('case') / 2, mirror: true, cut: true });
      for (const bar of MEASURED.bars) for (const z of [BAR_Z[1], BAR_Z[0]]) faces.push({ part: 'case', name: bar.texture, halfX: bar.halfX, halfY: bar.halfY, z, mirror: false, cx: bar.x, cy: bar.y });
    }
    if (on('dial')) faces.push({ part: 'dial', name: state.dial.face, halfX: MEASURED.dial.half, halfY: MEASURED.dial.half, z: thickness('dial') / 2, mirror: false, sunray: state.sunray, dim: 0.16, second: state.dial.next, sweep: state.dial.sweep, caster: casterFor('dial', 'case', CASE_R + 2) });
    if (on('calibre')) {
      faces.push({ part: 'calibre', name: 'calibre-top', halfX: MEASURED.calibre.half, halfY: MEASURED.calibre.half, z: thickness('calibre') / 2, mirror: false, caster: casterFor('calibre', 'dial', MEASURED.dial.r) });
      faces.push({ part: 'calibre', name: 'calibre-bottom', halfX: MEASURED.calibre.half, halfY: MEASURED.calibre.half, z: -thickness('calibre') / 2, mirror: true });
    }
    if (on('rotor')) {
      faces.push({ part: 'rotor', name: 'rotor', halfX: MEASURED.rotor.half, halfY: MEASURED.rotor.half, z: thickness('rotor') / 2, mirror: false });
      faces.push({ part: 'rotor', name: 'rotor', halfX: MEASURED.rotor.half, halfY: MEASURED.rotor.half, z: -thickness('rotor') / 2, mirror: true });
    }
    if (on('caseback')) faces.push({ part: 'caseback', name: 'caseback', halfX: MEASURED.caseback.half, halfY: MEASURED.caseback.half, z: -thickness('caseback') / 2, mirror: true });
    for (const id of ['strapTop', 'strapBottom'] as const) {
      if (!on(id)) continue;
      const piece = strap[id];
      for (const [z, mirror] of [[thickness(id) / 2, false], [-thickness(id) / 2, true]] as const) faces.push({ part: id, name: piece.photo, halfX: piece.halfX, halfY: piece.length / 2, z, mirror, cx: 0, cy: -piece.length / 2, dim: 0.3 });
    }

    // ---------- Solid: side walls and the solid middle of every photograph, with depth ----------
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.BLEND);
    if (on('case')) {
      const t = thickness('case') / 2;
      drawWall('caseOuter', models.case, rotations.case, -t, t, STEEL);
      drawWall('caseBore', models.case, rotations.case, -t, t, BORE);
      drawWall('bars', models.case, rotations.case, BAR_Z[0], BAR_Z[1], POLISHED);
      // The crown: a barrel whose axis is the watch's 3 o'clock.
      mul(crownModel, models.case, compose(scratch, CASE_R - 0.35, CROWN.y, 0, 0, Math.PI / 2, 0));
      rotation(crownRot, crownModel);
      drawWall('crown', crownModel, crownRot, 0, CROWN.length + 0.35, CROWN_STEEL);
    }
    if (on('dial')) drawWall('dial', models.dial, rotations.dial, -thickness('dial') / 2, thickness('dial') / 2, SILVERED);
    if (on('calibre')) drawWall('calibre', models.calibre, rotations.calibre, -thickness('calibre') / 2, thickness('calibre') / 2, RHODIUM);
    if (on('rotor')) drawWall('rotor', models.rotor, rotations.rotor, -thickness('rotor') / 2, thickness('rotor') / 2, TUNGSTEN);
    if (on('caseback')) drawWall('caseback', models.caseback, rotations.caseback, -thickness('caseback') / 2, thickness('caseback') / 2, BACK_STEEL);
    for (const id of ['strapTop', 'strapBottom'] as const) if (on(id)) drawWall(id, models[id], rotations[id], -thickness(id) / 2, thickness(id) / 2, LINKS, strap[id].seams);
    if (on('hands')) for (const [name] of HAND_ORDER) {
      const piece = HANDS[name], top = handTop[name], under = top - piece.thick, model = handModels[name], rot = handRots[name];
      drawWall(`hand-${name}`, model, rot, under, top, piece.kind === 0 ? BLUED_EDGE : LACQUER_EDGE);
      drawWall(`pipe-${name}`, model, rot, under - piece.pipe[1], under, TUBE);
      if (piece.kind === 0) drawWall(`hole-${name}`, model, rot, under - piece.pipe[1], top, TUBE_BORE);
      drawHand(model, rot, name, 0, top);
    }
    for (const spec of faces) drawPhoto(spec, 0);

    // ---------- Soft: photograph edges, drawn shapes and glass, far to near, over what is solid ----------
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    const items: Item[] = [];
    for (const spec of faces) items.push({ depth: viewDepth(models[spec.part], spec.cx ?? 0, spec.cy ?? 0, spec.z), draw: () => drawPhoto(spec, 1) });
    if (on('dial')) {
      // The back of the dial: plain brass.
      const z = -thickness('dial') / 2 - 0.01;
      items.push({ depth: viewDepth(models.dial, 0, 0, z), draw: () => drawShape(models.dial, rotations.dial, 1, [MEASURED.dial.r - 0.03, 0, 0, 0], [0.70, 0.64, 0.50], 1, MEASURED.dial.r + 0.4, MEASURED.dial.r + 0.4, z, 0, 0, 0, 0.35) });
    }
    if (on('case')) {
      // The crown's end: a polished, slightly domed disc.
      const z = CROWN.length + 0.35;
      items.push({ depth: viewDepth(crownModel, 0, 0, z), draw: () => drawShape(crownModel, crownRot, 1, [CROWN.radius, 0, 0.22, 0], [0.60, 0.61, 0.64], 1, CROWN.radius + 0.3, CROWN.radius + 0.3, z, 0, 0, 0, 0.45, 0.8) });
    }
    if (on('caseback')) {
      // Its inner face: steel turned on a lathe round the window, with the black gasket that seals it to the case.
      const z = thickness('caseback') / 2, r = MEASURED.caseback.r;
      items.push({ depth: viewDepth(models.caseback, 0, 0, z), draw: () => drawShape(models.caseback, rotations.caseback, 1, [r, MEASURED.caseback.window, 0, 0], [0.70, 0.71, 0.73], 1, r + 0.4, r + 0.4, z, 0, 0, 0, 0.3, 1) });
      items.push({ depth: viewDepth(models.caseback, 0, 0, z) + 0.002, draw: () => drawShape(models.caseback, rotations.caseback, 1, [r - 1.0, r - 1.85, 0, 0], [0.055, 0.055, 0.06], 1, r, r, z + 0.02, 0, 0, 0.02, 0.35) });
      const glassZ = -thickness('caseback') / 2 + 0.25;
      items.push({ depth: viewDepth(models.caseback, 0, 0, glassZ), draw: () => drawGlass(models.caseback, rotations.caseback, MEASURED.caseback.window + 0.1, glassZ, 0, 0.06, state.glass) });
    }
    if (on('hands')) {
      const dialPose = parts.dial, handPose = parts.hands;
      const level = Math.abs(handPose.rx) + Math.abs(handPose.ry) + Math.abs(dialPose.rx) + Math.abs(dialPose.ry) < 0.2 && on('dial');
      const dialTop = HEIGHTS.dial[1] + dialPose.z;
      // How far the hands have gone sideways from the dial's axis: in a lane of their own there is no dial under them.
      const aside = Math.hypot(handPose.x - dialPose.x, handPose.y - dialPose.y);
      for (const [name] of HAND_ORDER) {
        const piece = HANDS[name], cy = (piece.length - piece.tail) / 2, top = handTop[name];
        items.push({ depth: viewDepth(handModels[name], 0, cy, top), draw: () => drawHand(handModels[name], handRots[name], name, 1, top) });
        // Its shadow on the dial, while it is still over it.
        const above = HAND_Z[name] + handPose.z + handAway[name] - dialTop;
        if (level && above > 0 && above < 9 && aside < 4) {
          const shadow = shadowModels[name], shadowRot = shadowRots[name];
          mul(shadow, models.dial, compose(scratch, handPose.x - dialPose.x - LIGHT[0] * above * 0.55, handPose.y - dialPose.y - LIGHT[1] * above * 0.55, 0, 0, 0, handPose.rz - dialPose.rz - state.hands[name]));
          rotation(shadowRot, shadow);
          const zShadow = thickness('dial') / 2 + 0.015;
          const fade = 0.26 * (1 - above / 9) * (1 - aside / 4);
          items.push({ depth: viewDepth(shadow, 0, cy, zShadow) - 0.001, draw: () => drawHand(shadow, shadowRot, name, 2, zShadow, fade, 0.06 + above * 0.07, [0.03, 0.04, 0.07]) });
        }
      }
    }
    if (on('crystal') && state.glass > 0.01) {
      const t = thickness('crystal') / 2, r = MEASURED.case.hole - 0.05;
      // How far it has come from its seat in the case: over a dial glass is all but invisible, and stays so;
      // away from the watch it is drawn as glass on its own is seen (LONE_GLASS_FRAGMENT).
      const away = Math.hypot(parts.crystal.x - parts.case.x, parts.crystal.y - parts.case.y, parts.crystal.z - parts.case.z);
      const lifted = Math.min(1, Math.max(0, (away - CRYSTAL_APART[0]) / (CRYSTAL_APART[1] - CRYSTAL_APART[0]))), apart = lifted * lifted * (3 - 2 * lifted);
      const sapphire = (SAPPHIRE.alpha ?? 1) * state.glass;
      items.push({ depth: viewDepth(models.crystal, 0, 0, 0), draw: () => (apart > 0 ? drawLoneEdge(models.crystal, rotations.crystal, -t, t, sapphire, apart) : drawWall('crystal', models.crystal, rotations.crystal, -t, t, { ...SAPPHIRE, alpha: sapphire })) });
      items.push({ depth: viewDepth(models.crystal, 0, 0, -t), draw: () => drawGlass(models.crystal, rotations.crystal, r, -t, 0, 0.0, state.glass * 0.5, apart) });
      items.push({ depth: viewDepth(models.crystal, 0, 0, t), draw: () => drawGlass(models.crystal, rotations.crystal, r, t, MEASURED.case.hole - MEASURED.dial.track, 0.10, state.glass, apart) });
    }
    items.sort((a, b) => a.depth - b.depth);
    for (const item of items) item.draw();
    gl.depthMask(true);
    gl.bindVertexArray(null);
  };

  // ---------- Lifecycle ----------
  build();
  const onLost = (event: Event) => { event.preventDefault(); lost = true; photos.clear(); };
  const onRestored = () => {
    lost = false;
    try { build(); } catch { return; }
    for (const [name, source] of sources) upload(name, source);
    render();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  return {
    supported: true,
    state,
    load: names => Promise.all(names.map(loadOne)).then(() => undefined),
    image: name => images.get(name),
    setTexture: (name, source) => { if (lost) sources.set(name, source); else upload(name, source); },
    resize,
    render,
    project(part, x, y, z) {
      const world = transform(models[part], x, y, z);
      const clip = transform(viewProj, world[0], world[1], world[2]);
      return { x: (clip[0] / clip[3] * 0.5 + 0.5) * size.cssWidth, y: (0.5 - clip[1] / clip[3] * 0.5) * size.cssHeight, behind: clip[3] <= 0 };
    },
    scale: () => size.cssHeight / state.camera.span,
    destroy() {
      alive = false;
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      for (const { texture } of photos.values()) gl.deleteTexture(texture);
      for (const buffer of buffers) gl.deleteBuffer(buffer);
      // Give the context back once the canvas has really gone. A remount on the same canvas in the same tick
      // (React's strict mode does that in development) keeps it: a lost context cannot be asked for again.
      const lose = gl.getExtension('WEBGL_lose_context');
      window.setTimeout(() => { if (!canvas.isConnected) lose?.loseContext(); }, 0);
    },
  };
}
