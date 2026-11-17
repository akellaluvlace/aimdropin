// The little linear algebra the watch needs: 4x4 matrices in column-major order (as WebGL takes them)
// and a camera that orbits a point. No library: a dozen parts do not need one.

export type Mat4 = Float32Array;
export type Vec3 = [number, number, number];

export const mat4 = (): Mat4 => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; };

/** out = a * b. `out` may be `a` or `b`. */
export function mul(out: Mat4, a: Mat4, b: Mat4): Mat4 {
  const r = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let i = 0; i < 4; i++) r[c * 4 + i] = a[i] * b[c * 4] + a[4 + i] * b[c * 4 + 1] + a[8 + i] * b[c * 4 + 2] + a[12 + i] * b[c * 4 + 3];
  out.set(r);
  return out;
}

/** A perspective projection; `shiftX`, `shiftY` move the picture on the screen (in halves of the screen) without changing it. */
export function perspective(out: Mat4, fovY: number, aspect: number, near: number, far: number, shiftX = 0, shiftY = 0): Mat4 {
  const f = 1 / Math.tan(fovY / 2);
  out.fill(0);
  out[0] = f / aspect; out[5] = f;
  out[8] = -shiftX; out[9] = -shiftY;
  out[10] = (far + near) / (near - far); out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

/** Translate, then turn about x, y and z in that order (the part's own axes): T * Rx * Ry * Rz. */
export function compose(out: Mat4, tx: number, ty: number, tz: number, rx: number, ry: number, rz: number): Mat4 {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  // Rx * Ry * Rz
  out[0] = cy * cz; out[1] = sx * sy * cz + cx * sz; out[2] = -cx * sy * cz + sx * sz; out[3] = 0;
  out[4] = -cy * sz; out[5] = -sx * sy * sz + cx * cz; out[6] = cx * sy * sz + sx * cz; out[7] = 0;
  out[8] = sy; out[9] = -sx * cy; out[10] = cx * cy; out[11] = 0;
  out[12] = tx; out[13] = ty; out[14] = tz; out[15] = 1;
  return out;
}

/** The upper 3x3 of a matrix, for directions (the matrices here never scale). */
export function rotation(out: Float32Array, m: Mat4): Float32Array {
  out[0] = m[0]; out[1] = m[1]; out[2] = m[2]; out[3] = m[4]; out[4] = m[5]; out[5] = m[6]; out[6] = m[8]; out[7] = m[9]; out[8] = m[10];
  return out;
}

export function transform(m: Mat4, x: number, y: number, z: number): [number, number, number, number] {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14], m[3] * x + m[7] * y + m[11] * z + m[15]];
}

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (v: Vec3): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

/**
 * A camera on a sphere round a target. Angles in radians.
 * - `az`: round the watch's axis. 0 looks from the 6 o'clock side, so 12 o'clock is up on the screen.
 * - `el`: height above the dial's plane. A quarter turn (pi / 2) looks straight down at the dial; 0 is
 *   side on; below zero is from behind.
 * - `roll`: about the line of sight.
 * - `span`: how many millimetres of the scene fill the screen's height at the target.
 */
export interface Camera { tx: number; ty: number; tz: number; az: number; el: number; roll: number; span: number; shiftX: number; shiftY: number }

export const FOV = (20 * Math.PI) / 180;

export function view(out: Mat4, camera: Camera): { eye: Vec3; distance: number } {
  const { az, el, roll } = camera;
  const ce = Math.cos(el), se = Math.sin(el), sa = Math.sin(az), ca = Math.cos(az);
  const dir: Vec3 = [sa * ce, -ca * ce, se];           // from the target to the eye
  const up0: Vec3 = [-sa * se, ca * se, ce];           // which way "higher" is, on the sphere
  const forward: Vec3 = [-dir[0], -dir[1], -dir[2]];
  const right0 = normalize(cross(forward, up0));
  const up1 = cross(right0, forward);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const up: Vec3 = [up1[0] * cr + right0[0] * sr, up1[1] * cr + right0[1] * sr, up1[2] * cr + right0[2] * sr];
  const right: Vec3 = [right0[0] * cr - up1[0] * sr, right0[1] * cr - up1[1] * sr, right0[2] * cr - up1[2] * sr];
  const distance = camera.span / (2 * Math.tan(FOV / 2));
  const eye: Vec3 = [camera.tx + dir[0] * distance, camera.ty + dir[1] * distance, camera.tz + dir[2] * distance];
  out[0] = right[0]; out[4] = right[1]; out[8] = right[2]; out[12] = -(right[0] * eye[0] + right[1] * eye[1] + right[2] * eye[2]);
  out[1] = up[0]; out[5] = up[1]; out[9] = up[2]; out[13] = -(up[0] * eye[0] + up[1] * eye[1] + up[2] * eye[2]);
  out[2] = dir[0]; out[6] = dir[1]; out[10] = dir[2]; out[14] = -(dir[0] * eye[0] + dir[1] * eye[1] + dir[2] * eye[2]);
  out[3] = 0; out[7] = 0; out[11] = 0; out[15] = 1;
  return { eye, distance };
}
