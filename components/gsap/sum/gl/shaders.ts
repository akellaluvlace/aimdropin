// The watch's shaders. Every part is a photograph taken from straight above, given thickness: its two
// faces are textured quads, its side wall is extruded from its outline and shaded as metal or glass
// under one imaginary studio. Photographs are not lit again (they were lit when they were taken); they
// only dim a little edge-on, take the shadow of the part above, and the dial's sunray finish catches
// the light as it turns. The hands are the exception: they are drawn, and lit by that studio.

/**
 * The studio every reflection sees: a white room with a darker floor, a soft box overhead, another to the
 * front left and a strip to the right. Two black flags stand either side: they break the walls into bands
 * of light and dark, which is what makes a round piece of steel read as round.
 */
const STUDIO = `
float studio(vec3 r) {
  float up = clamp(r.z, -1.0, 1.0);
  // The table is a white sweep, so what looks down (a case's flank, seen from above) is nearly as bright as what looks out.
  float room = mix(0.60, 0.82, smoothstep(-0.50, 0.10, up)) - 0.16 * smoothstep(-0.55, -0.98, up);
  float flags = 0.5 + 0.5 * cos(atan(r.y, r.x) * 2.0 + 0.9);
  room *= mix(mix(0.50, 1.0, smoothstep(0.10, 0.72, flags)), 1.0, smoothstep(0.35, 0.95, abs(up)));
  float top = 0.50 * smoothstep(0.45, 0.96, up);
  float key = 0.70 * pow(max(dot(r, normalize(vec3(-0.50, -0.52, 0.69))), 0.0), 5.0);
  float strip = 0.65 * pow(max(dot(r, normalize(vec3(0.86, 0.20, 0.47))), 0.0), 16.0);
  return room + top + key + strip;
}
float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
`;

export const FACE_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPos;
uniform mat4 uViewProj;
uniform mat4 uModel;
uniform vec2 uHalf;      // half the face, in mm
uniform vec2 uCentre;    // where its middle is, in the part's own frame
uniform float uZ;        // its height in the part's own frame
uniform float uMirror;   // 1 for a face seen from below: its photograph was taken from behind
out vec2 vUv;
out vec2 vLocal;
out vec3 vWorld;
void main() {
  vec2 p = aPos * uHalf + uCentre;
  vLocal = p;
  vUv = vec2(0.5 + 0.5 * aPos.x * (uMirror > 0.5 ? -1.0 : 1.0), 0.5 - 0.5 * aPos.y);
  vec4 world = uModel * vec4(p, uZ, 1.0);
  vWorld = world.xyz;
  gl_Position = uViewProj * world;
}`;

/** A photographed face. Drawn twice: its solid middle with depth, then its soft edge blended over what is behind. */
export const PHOTO_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform sampler2D uTex2;
uniform float uSweep;     // how far (radians, clockwise from 12) the second photograph has swept in; 0 is none
uniform int uPass;        // 0 the solid middle, 1 the soft edge
uniform vec3 uCam;
uniform mat3 uRot;
uniform vec4 uCaster;     // the part above: centre x, y (mm, this part's frame), radius, strength of its shadow
uniform float uSunray;    // strength of the dial's moving highlight
uniform float uDim;       // how much the face darkens seen edge-on
uniform float uShade;     // overall brightness (1 is the photograph as taken)
uniform vec4 uCut;        // a box left out of the photograph: from x, centre y, half height, on (1) or off (0)
in vec2 vUv;
in vec2 vLocal;
in vec3 vWorld;
out vec4 outColor;
${STUDIO}
void main() {
  if (uCut.w > 0.5 && vLocal.x > uCut.x && abs(vLocal.y - uCut.y) < uCut.z) discard;
  vec4 texel = texture(uTex, vUv);
  if (uSweep > 0.0) {
    float angle = atan(vLocal.x, vLocal.y);
    if (angle < 0.0) angle += 6.2831853;
    float edge = fwidth(angle) * 1.2 + 0.0015;
    texel = mix(texel, texture(uTex2, vUv), smoothstep(uSweep + edge, uSweep - edge, angle));
  }
  float alpha = texel.a;
  if (uPass == 0) { if (alpha < 0.985) discard; } else if (alpha >= 0.985 || alpha < 0.004) discard;
  vec3 rgb = texel.rgb / max(alpha, 0.001);
  vec3 normal = uRot * vec3(0.0, 0.0, 1.0);
  vec3 toEye = normalize(uCam - vWorld);
  float facing = abs(dot(normal, toEye));
  rgb *= uShade * mix(1.0 - uDim, 1.0, smoothstep(0.04, 0.70, facing));
  float reach = length(vLocal - uCaster.xy);
  rgb *= 1.0 - uCaster.w * (1.0 - smoothstep(uCaster.z * 0.80, uCaster.z * 1.08, reach));
  if (uSunray > 0.0) {
    // Brushed outward from the centre: a line of brushing lights up where it lies across the half vector.
    vec3 along = normalize(uRot * vec3(normalize(vLocal + 1e-4), 0.0));
    vec3 halfway = normalize(normalize(vec3(-0.35, -0.42, 0.84)) + toEye);
    float across = dot(along, halfway);
    float ray = pow(max(0.0, 1.0 - across * across), 60.0);
    // The finish only: the polished markers and the printed track keep their own light.
    float luma = dot(rgb, vec3(0.299, 0.587, 0.114));
    float finish = smoothstep(0.38, 0.55, luma) * (1.0 - smoothstep(0.86, 0.97, luma)) * smoothstep(0.8, 5.0, length(vLocal));
    rgb = rgb * (1.0 - 0.07 * uSunray * finish) + uSunray * 0.42 * ray * finish;
  }
  outColor = vec4(rgb * alpha, alpha);
}`;

/** Sapphire: the crystal over the dial and the window in the caseback. Almost nothing face on, a mirror at a glance. */
export const GLASS_FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 uCam;
uniform mat3 uRot;
uniform float uRadius;
uniform float uRim;       // width of the ground edge, mm (0 for none)
uniform float uDome;      // how domed the surface is
uniform float uAlpha;
in vec2 vLocal;
in vec3 vWorld;
out vec4 outColor;
${STUDIO}
void main() {
  float r = length(vLocal) / uRadius;
  float edge = fwidth(r);
  if (r > 1.0 + edge) discard;
  vec3 normal = normalize(uRot * normalize(vec3(vLocal * uDome / uRadius, 1.0)));
  vec3 toEye = normalize(uCam - vWorld);
  float facing = dot(normal, toEye);
  if (facing < 0.0) { normal = -normal; facing = -facing; }
  float fresnel = pow(1.0 - facing, 3.0);
  float light = studio(reflect(-toEye, normal));
  float alpha = 0.012 + 0.55 * fresnel + 0.34 * smoothstep(1.25, 1.95, light);
  vec3 colour = vec3(0.90, 0.95, 1.0) * (0.40 + 0.5 * light);
  if (uRim > 0.0) {
    float inner = 1.0 - uRim / uRadius;
    float ground = smoothstep(inner - edge, inner + edge, r);
    // The ground edge: a bright frosted band with a darker line where it meets the clear glass.
    float line = 1.0 - smoothstep(0.0, 0.012, abs(r - inner));
    vec3 frost = vec3(0.84, 0.86, 0.89) * (0.62 + 0.26 * light) * (1.0 - 0.35 * line);
    colour = mix(colour, frost, ground);
    alpha = mix(alpha, 0.62, ground);
  }
  alpha *= uAlpha * (1.0 - smoothstep(1.0 - edge, 1.0 + edge, r));
  outColor = vec4(colour * alpha, alpha);
}`;

/**
 * The crystal away from the watch. Over a dial, sapphire is all but invisible, and GLASS_FRAGMENT draws it so.
 * Over the pale backdrop that left an empty ring: nothing said the ring was full of glass. On its own it is
 * drawn as a disc of glass lying on a white table is seen:
 * - each polished face mirrors a share of the room, larger the more it is seen at a slant (Schlick's
 *   approximation, for sapphire), and takes that share from what is behind it. Where it mirrors the soft box
 *   overhead it is as light as the paper or a touch lighter; where it mirrors the rest of the studio it is a
 *   shade darker. The soft box has an edge, and that edge crosses the disc as the camera comes down;
 * - the glass has a little body: a cool shade taken from whatever is seen through it;
 * - the band ground round its upper face is frosted glass, lighter than steel and half see-through, and the
 *   polished chamfer outside it glints where it faces a light. The under face's own edge shows through as a line.
 * `uApart` takes it from the seated look (GLASS_FRAGMENT's, repeated here) to this one as the crystal leaves
 * the watch. Seated, the crystal is drawn by GLASS_FRAGMENT itself: the watch is to the pixel what it was.
 */
export const LONE_GLASS_FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 uCam;
uniform mat3 uRot;
uniform float uRadius;
uniform float uRim;       // width of the ground edge, mm (0 for none: the under face)
uniform float uDome;      // how domed the surface is
uniform float uAlpha;
uniform float uApart;     // 0 as it sits on the watch, 1 on its own
in vec2 vLocal;
in vec3 vWorld;
out vec4 outColor;
${STUDIO}
void main() {
  float r = length(vLocal) / uRadius;
  float edge = fwidth(r);
  if (r > 1.0 + edge) discard;
  vec3 normal = normalize(uRot * normalize(vec3(vLocal * uDome / uRadius, 1.0)));
  vec3 toEye = normalize(uCam - vWorld);
  float facing = dot(normal, toEye);
  if (facing < 0.0) { normal = -normal; facing = -facing; }
  float slant = max(1.0 - facing, 0.0);
  vec3 seen = reflect(-toEye, normal);
  float light = studio(seen);
  float inner = 1.0 - uRim / uRadius;
  float ground = uRim > 0.0 ? smoothstep(inner - edge, inner + edge, r) : 0.0;
  float line = uRim > 0.0 ? 1.0 - smoothstep(0.0, 0.012, abs(r - inner)) : 0.0;

  // Seated, as GLASS_FRAGMENT has it. Colour times alpha, and alpha: what it adds, and what it takes away.
  vec3 sheen = vec3(0.90, 0.95, 1.0) * (0.40 + 0.5 * light);
  float glints = 0.34 * smoothstep(1.25, 1.95, light);
  vec4 seated = mix(vec4(sheen, 1.0) * (0.012 + 0.55 * slant * slant * slant + glints), vec4(vec3(0.84, 0.86, 0.89) * (0.62 + 0.26 * light) * (1.0 - 0.35 * line), 1.0) * 0.62, ground);

  // On its own. The share of the room one polished face shows:
  float mirror = (0.077 + 0.923 * pow(slant, 5.0)) * 0.78;
  // The room as a clear face shows it: the soft box overhead where the mirrored ray points up into it, and
  // the rest of the studio, dimmer. A little cool, as coated glass mirrors. The studio is a white sweep, so
  // what glass mirrors of it is never dark: with a black flag in it the disc turned to smoked glass (it did,
  // on a phone, where the camera faces one).
  float box = smoothstep(0.676, 0.716, seen.z);
  vec3 room = vec3(0.93, 0.965, 1.0) * mix(clamp(light * 0.74, 0.78, 0.92), 1.5, box);
  // And the body of the glass: a cool shade over what is seen through it.
  float body = 0.045;
  vec4 lone = vec4(sheen, 1.0) * glints + vec4(room * mirror + vec3(0.46, 0.55, 0.66) * body, mirror + body);
  if (uRim > 0.0) {
    // Frosted glass scatters the light that falls on it: nearly white, and half see-through.
    vec4 frost = vec4(vec3(0.94, 0.96, 0.985) * (0.80 + 0.13 * light) * (1.0 - 0.42 * line), 1.0) * 0.50;
    lone = mix(lone, frost, ground);
    // The chamfer, polished: it leans outward, so it mirrors a different part of the room all the way round.
    float lip = smoothstep(0.984 - edge, 0.984 + edge, r);
    vec3 leaning = normalize(uRot * normalize(vec3(vLocal / max(length(vLocal), 1e-4), 1.0)));
    float glint = studio(reflect(-toEye, leaning));
    lone = mix(lone, vec4(mix(vec3(0.56, 0.63, 0.72), vec3(1.0), smoothstep(0.95, 1.60, glint)), 1.0) * 0.78, lip);
  } else {
    // The under face's edge, seen through the glass: a fine line a little way inside the rim.
    float under = 1.0 - smoothstep(0.0, max(0.008, edge), abs(r - 0.990));
    lone = mix(lone, vec4(vec3(0.58, 0.65, 0.74), 1.0) * 0.5, under * 0.7);
  }
  outColor = mix(seated, lone, uApart) * (uAlpha * (1.0 - smoothstep(1.0 - edge, 1.0 + edge, r)));
}`;

/**
 * The crystal's edge away from the watch (see LONE_GLASS_FRAGMENT): ground glass with a polished lip at each
 * face, where a band of one grey read as steel. `uApart` takes it there from what WALL_FRAGMENT draws.
 */
export const LONE_EDGE_FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 uCam;
uniform vec3 uBase;
uniform float uShine;
uniform float uAlpha;
uniform float uApart;     // 0 as it sits on the watch, 1 on its own
in vec3 vWorld;
in vec3 vNormal;
in vec3 vAxis;
in float vT;
out vec4 outColor;
${STUDIO}
void main() {
  vec3 normal = normalize(vNormal);
  vec3 axis = normalize(vAxis);
  vec3 toEye = normalize(uCam - vWorld);
  if (dot(normal, toEye) < 0.0) normal = -normal;
  float light = studio(reflect(-toEye, normal));
  // Seated, as WALL_FRAGMENT draws sapphire.
  vec4 seated = vec4(1.0 - exp(-uBase * (0.20 + uShine * light) * 1.55), 1.0) * uAlpha;
  // On its own: ground glass, lit by what falls on it, and a polished lip where it meets each face.
  float across = vT * 2.0 - 1.0;
  vec3 frost = vec3(0.92, 0.95, 0.985) * (0.70 + 0.24 * smoothstep(0.45, 1.5, studio(normal)));
  float lip = smoothstep(0.50, 0.86, abs(across));
  float glint = studio(reflect(-toEye, normalize(normal + axis * sign(across) * 0.9)));
  vec4 lone = mix(vec4(frost, 1.0) * 0.56, vec4(mix(vec3(0.56, 0.63, 0.72), vec3(1.0), smoothstep(0.95, 1.60, glint)), 1.0) * 0.78, lip);
  outColor = mix(seated, lone, uApart);
}`;

/**
 * A hand. Drawn, so it is sharp however close the camera comes: its outline is a distance worked out for
 * every pixel, and what the surface does (two facets and a bevel on the blued blades; a rounded coat of
 * lacquer on the seconds hand, with its steel tube showing in the hub) follows from that distance. The
 * pieces are the ones handOutline() in hands.ts walks for the side walls.
 */
export const HAND_FRAGMENT = `#version 300 es
precision highp float;
uniform int uKind;        // 0 a blued blade (hour, minute), 1 the lacquered seconds needle
uniform int uPass;        // 0 its solid middle, with depth; 1 its soft edge; 2 its shadow
uniform vec4 uA;          // tail, length, hub radius, hole radius (on the needle: the radius of the tube's end)
uniform vec4 uB;          // blade: half-width at the hub, half-width at the shoulder, length of the point, half-width of the tail's end
                          // needle: half-width at the hub, half-width at the tip, radius of the counterweight, half-width of the stem at it
uniform vec3 uColor;      // a shadow's colour
uniform float uAlpha;
uniform float uSoft;      // extra softness of the edge, mm (shadows)
uniform vec3 uCam;
uniform mat3 uRot;
in vec2 vLocal;
in vec3 vWorld;
out vec4 outColor;
${STUDIO}
// An upright piece with straight sides: half-width wa at ya, wb at yb. The exact distance (after Inigo Quilez's trapezoid).
float piece(vec2 p, float ya, float wa, float yb, float wb) {
  float he = 0.5 * (yb - ya);
  p = vec2(abs(p.x), p.y - 0.5 * (ya + yb));
  vec2 k1 = vec2(wb, he), k2 = vec2(wb - wa, 2.0 * he);
  vec2 ca = vec2(p.x - min(p.x, p.y < 0.0 ? wa : wb), abs(p.y) - he);
  vec2 cb = p - k1 + k2 * clamp(dot(k1 - p, k2) / dot(k2, k2), 0.0, 1.0);
  float inside = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
  return inside * sqrt(min(dot(ca, ca), dot(cb, cb)));
}
// The blade with its point: one piece with five sides, so no seam runs across it where the point begins.
float blade(vec2 p) {
  p.x = abs(p.x);
  vec2 shoulder = vec2(uB.y, uA.y - uB.z);
  float flank = dot(p - vec2(uB.x, 0.0), normalize(vec2(shoulder.y, uB.x - uB.y)));
  float point = dot(p - shoulder, normalize(vec2(uB.z, uB.y)));
  return max(max(flank, point), -p.y);
}
// Distance to the hand's outline, mm: negative inside it.
float outline(vec2 p) {
  float r = length(p);
  if (uKind == 0) {
    float d = min(blade(p), piece(p, -uA.x, uB.w, 0.0, uB.x));
    d = min(d, r - uA.z);
    // A shadow has no hole in it: on the watch the hand above stands in it.
    return uPass == 2 ? d : max(d, uA.w - r);
  }
  float weight = uB.z - uA.x;
  float d = min(piece(p, 0.0, uB.x, uA.y, uB.y), piece(p, weight, uB.w, 0.0, uB.x));
  d = min(d, r - uA.z);
  return min(d, length(p - vec2(0.0, weight)) - uB.z);
}
// Heat-blued steel is a mirror with a colour: near black where it sees the dark of the room, royal blue
// under the soft boxes, paler where it catches the key light. The colour is a film a few hundred atoms
// thick, so it leans to violet where the film is seen at a slant and toward a hand's point.
vec3 blued(float light, float violet) {
  vec3 film = mix(vec3(0.045, 0.117, 0.58), vec3(0.135, 0.062, 0.50), violet);
  return 1.0 - exp(-film * pow(light, 2.3)) + vec3(0.10, 0.13, 0.16) * smoothstep(1.55, 2.25, light);
}
// Bright steel, polished: the tube a hand is pressed on by.
vec3 bright(float light) { return vec3(0.80, 0.81, 0.84) * (0.26 + 0.56 * light) + vec3(0.32 * smoothstep(1.35, 2.05, light)); }
void main() {
  vec2 p = vLocal;
  float d = outline(p);
  float aa = fwidth(d) + uSoft;
  float cover = 1.0 - smoothstep(-aa, aa, d);
  if (uPass == 2) {
    if (cover < 0.003) discard;
    outColor = vec4(uColor * cover * uAlpha, cover * uAlpha);
    return;
  }
  if (uPass == 0) { if (cover < 0.985) discard; } else if (cover >= 0.985 || cover < 0.004) discard;
  // Which way the nearest edge lies: the surface falls away toward it.
  vec2 e = vec2(0.012, 0.0);
  vec2 away = vec2(outline(p + e.xy) - outline(p - e.xy), outline(p + e.yx) - outline(p - e.yx)) / (2.0 * e.x);
  float depth = max(-d, 0.0);
  float r = length(p);
  vec3 toEye = normalize(uCam - vWorld);
  vec3 colour;
  if (uKind == 0) {
    // Two facets along the blade and the tail, meeting in a ridge on the centre line. The hub is flat.
    // Every edge is bevelled and polished.
    float px = max(fwidth(r), 1e-5);
    float side = clamp(p.x / max(fwidth(p.x) * 0.8, 1e-5), -1.0, 1.0);
    float boss = 1.0 - smoothstep(-0.5, 0.5, (r - uA.z) / px);
    // A hand is not quite flat along its length either: it bows a little, down toward the dial at its point,
    // so what it reflects changes from the hub to the tip.
    float along = clamp(p.y / uA.y, -0.4, 1.0);
    // Nor is a facet a flat plane: it is a little fuller toward its edge than at the ridge.
    float across = abs(p.x) / max(abs(p.x) + depth, 1e-4);
    vec3 normal = mix(vec3(side * (0.27 + 0.22 * across), 0.30 * (2.0 * along - 1.0), 1.0), vec3(p / uA.z * 0.20, 1.0), boss);
    normal += vec3(away * 0.55 * clamp(1.0 - depth / 0.055, 0.0, 1.0), 0.0);
    vec3 n = normalize(uRot * normalize(normal));
    if (dot(n, toEye) < 0.0) n = -n;
    float slant = 1.0 - dot(n, toEye);
    colour = blued(studio(reflect(-toEye, n)), clamp(0.22 * along * along * (1.0 - boss) + 1.1 * slant, 0.0, 0.6));
    // The ridge itself catches a hair of light.
    colour += vec3(0.05, 0.10, 0.22) * (1.0 - boss) * (1.0 - smoothstep(0.0, 1.0, abs(p.x) / max(0.012, fwidth(p.x))));
    // Round the hole, the end of the steel tube the hand is riveted to: a bright ring, turned flat.
    float collar = uA.w + 0.13;
    float ring = 1.0 - smoothstep(-0.5, 0.5, (r - collar) / px);
    if (ring > 0.0) {
      vec3 rn = normalize(uRot * normalize(vec3(-p / max(r, 1e-4) * 0.9 * clamp(1.0 - (r - uA.w) / 0.05, 0.0, 1.0), 1.0)));
      if (dot(rn, toEye) < 0.0) rn = -rn;
      colour = mix(colour, bright(studio(reflect(-toEye, rn))), ring);
    }
    colour *= 1.0 - 0.5 * (1.0 - smoothstep(0.0, 1.0, abs(r - collar) / max(0.016, px)));
  } else {
    // Lacquer lies rounded over the metal: flat across the hub and the counterweight, a half round along the needle.
    float weight = uB.z - uA.x;
    bool broad = r < uA.z || length(p - vec2(0.0, weight)) < uB.z;
    float halfWidth = broad ? 0.17 : (p.y > 0.0 ? mix(uB.x, uB.y, clamp(p.y / uA.y, 0.0, 1.0)) : mix(uB.x, uB.w, clamp(p.y / weight, 0.0, 1.0)));
    float fall = clamp(1.0 - depth / min(halfWidth, 0.17), 0.0, 1.0);
    vec3 n = normalize(uRot * normalize(vec3(away * 1.15 * fall, 1.0)));
    if (dot(n, toEye) < 0.0) n = -n;
    float light = studio(reflect(-toEye, n));
    // Its red hardly changes with the light; the gloss over it does.
    colour = vec3(0.80, 0.085, 0.20) * (0.52 + 0.40 * smoothstep(0.35, 1.45, light)) + vec3(1.0, 0.93, 0.93) * 0.70 * smoothstep(1.25, 1.95, light);
    // The steel tube the hand is riveted to shows in the middle of the hub: a polished, slightly domed end.
    float px = max(fwidth(r), 1e-5);
    float tube = 1.0 - smoothstep(-0.5, 0.5, (r - uA.w) / px);
    if (tube > 0.0) {
      vec3 tn = normalize(uRot * normalize(vec3(p / uA.w * 0.6, 1.0)));
      if (dot(tn, toEye) < 0.0) tn = -tn;
      colour = mix(colour, bright(studio(reflect(-toEye, tn))), tube);
    }
    colour *= 1.0 - 0.5 * (1.0 - smoothstep(0.0, 1.0, abs(r - uA.w) / max(0.016, px)));
  }
  float alpha = (uPass == 0 ? 1.0 : cover) * uAlpha;
  outColor = vec4(colour * alpha, alpha);
}`;

/** Drawn shapes: plain discs and rings, and the shadow on the table. */
export const SHAPE_FRAGMENT = `#version 300 es
precision highp float;
uniform int uShape;       // 1 disc or ring, 2 soft blob
uniform vec4 uDims;       // disc: radius, inner radius, how domed | blob: radius x, radius y
uniform vec3 uColor;
uniform float uAlpha;
uniform float uSoft;      // extra softness of the edge, mm (shadows)
uniform float uGloss;     // 0 matte, 1 polished
uniform float uTurned;    // a disc or ring turned on a lathe: fine circles that catch the light in two fans
uniform vec3 uCam;
uniform mat3 uRot;
in vec2 vLocal;
in vec3 vWorld;
out vec4 outColor;
${STUDIO}
void main() {
  float cover = 1.0;
  vec3 normal = vec3(0.0, 0.0, 1.0);
  if (uShape == 1) {
    float r = length(vLocal);
    float aa = fwidth(r) + uSoft;
    cover = (1.0 - smoothstep(uDims.x - aa, uDims.x + aa, r)) * smoothstep(uDims.y - aa, uDims.y + aa, r);
    normal = normalize(vec3(vLocal / max(uDims.x, 0.001) * uDims.z, 1.0));
  } else {
    float r = length(vLocal / uDims.xy);
    cover = pow(1.0 - smoothstep(0.0, 1.0, r), 1.6);
  }
  if (cover < 0.003) discard;
  vec3 colour = uColor;
  if (uGloss > 0.0) {
    vec3 worldNormal = normalize(uRot * normal);
    vec3 toEye = normalize(uCam - vWorld);
    if (dot(worldNormal, toEye) < 0.0) worldNormal = -worldNormal;
    float light = studio(reflect(-toEye, worldNormal));
    colour = uColor * (0.40 + 0.62 * light) + vec3(uGloss * 0.38 * smoothstep(1.30, 2.0, light));
    if (uTurned > 0.0) {
      float r = length(vLocal);
      float ring = r * 11.0;
      float grain = 0.93 + 0.14 * mix(hash(floor(ring)), hash(floor(ring) + 1.0), smoothstep(0.0, 1.0, fract(ring)));
      // The tool's marks run round the part: they light up where they lie across the half vector.
      vec3 tangent = normalize(uRot * vec3(-vLocal.y, vLocal.x, 0.0));
      vec3 halfway = normalize(normalize(vec3(-0.35, -0.42, 0.84)) + toEye);
      float across = dot(tangent, halfway);
      float fan = pow(max(0.0, 1.0 - across * across), 18.0);
      colour = colour * grain * (0.86 + 0.42 * uTurned * fan);
    }
  }
  float alpha = cover * uAlpha;
  outColor = vec4(colour * alpha, alpha);
}`;

export const WALL_VERTEX = `#version 300 es
layout(location = 0) in vec2 aXY;
layout(location = 1) in float aT;       // 0 at the bottom of the wall, 1 at the top
layout(location = 2) in vec2 aNormal;
layout(location = 3) in float aArc;     // distance round the outline, mm
uniform mat4 uViewProj;
uniform mat4 uModel;
uniform mat3 uRot;
uniform vec2 uZ;                        // bottom, top
out vec3 vWorld;
out vec3 vNormal;
out vec3 vAxis;                         // the part's own axis, in the world
out vec3 vLength;                       // the part's own y, in the world: the way a bracelet runs
out vec2 vSurface;                      // round the outline, up the wall
out float vT;
out float vAlong;                       // how far along the part's own y, mm
void main() {
  float z = mix(uZ.x, uZ.y, aT);
  vec4 world = uModel * vec4(aXY, z, 1.0);
  vWorld = world.xyz;
  vNormal = uRot * vec3(aNormal, 0.0);
  vAxis = uRot * vec3(0.0, 0.0, 1.0);
  vLength = uRot * vec3(0.0, 1.0, 0.0);
  vSurface = vec2(aArc, z);
  vT = aT;
  vAlong = aXY.y;
  gl_Position = uViewProj * world;
}`;

/** A side wall: brushed or polished steel, tungsten, brass, a hand's blued or lacquered edge, the edge of a sapphire. */
export const WALL_FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 uCam;
uniform vec3 uBase;
uniform float uShine;     // how much of the studio it reflects
uniform float uBrush;     // brushing lines per mm, running round the part (0 for none)
uniform float uRound;     // how much the wall bulges between its two edges (0 is flat)
uniform float uBevel;     // share of its height taken by a polished bevel at each edge (0 for none)
uniform float uKnurl;     // ridges per mm round the part, running along its axis (a crown)
uniform float uAlpha;
uniform int uSeamCount;   // the side of a bracelet: how many joints between links it has (0 for anything else)
uniform float uSeams[16]; // and where they are, along the part's own y (mm)
in vec3 vWorld;
in vec3 vNormal;
in vec3 vAxis;
in vec3 vLength;
in vec2 vSurface;
in float vT;
in float vAlong;
out vec4 outColor;
${STUDIO}
void main() {
  vec3 normal = normalize(vNormal);
  vec3 axis = normalize(vAxis);
  vec3 toEye = normalize(uCam - vWorld);
  if (dot(normal, toEye) < 0.0) normal = -normal;
  // The side of a bracelet is a row of links: each ends in a rounded corner, and a dark line parts it from the next.
  float joint = 0.0, turn = 0.0, hair = max(0.05, fwidth(vAlong));
  for (int i = 0; i < 16; i++) {
    if (i >= uSeamCount) break;
    float off = vAlong - uSeams[i];
    joint = max(joint, 1.0 - smoothstep(0.0, 1.0, abs(off) / hair));
    turn -= sign(off) * (1.0 - smoothstep(0.0, 0.32, abs(off)));
  }
  if (uSeamCount > 0) normal = normalize(normal + normalize(vLength) * turn * 0.42);
  // A flank is not a flat band: it bulges a little, and its two edges are bevelled and polished.
  float across = vT * 2.0 - 1.0;
  float bevel = uBevel > 0.0 ? smoothstep(1.0 - 2.0 * uBevel, 1.0 - 0.6 * uBevel, abs(across)) : 0.0;
  float ridge = 0.0;
  if (uKnurl > 0.0) {
    // Ridges along the axis: each one leans the surface one way, then the other.
    ridge = fract(vSurface.x * uKnurl) - 0.5;
    normal = normalize(normal + cross(axis, normal) * ridge * 1.5);
  }
  normal = normalize(normal + axis * (uRound * across + 0.9 * bevel * sign(across)));
  vec3 seen = reflect(-toEye, normal);
  float light = studio(seen);
  float grain = 1.0;
  if (uBrush > 0.0) {
    // Brushing smears a reflection across the lines, so a brushed flank shows the room as broad upright
    // bands of light and dark going round it: that contrast is what reads as steel.
    float bands = 0.5 + 0.5 * cos(atan(seen.y, seen.x) * 3.0 + 1.7);
    light *= mix(mix(0.58, 1.34, smoothstep(0.12, 0.88, bands)), 1.0, bevel);
    float line = vSurface.y * uBrush;
    grain = mix(0.93 + 0.14 * mix(hash(floor(line)), hash(floor(line) + 1.0), smoothstep(0.0, 1.0, fract(line))), 1.0, bevel);
  }
  if (uKnurl > 0.0) grain *= 0.80 + 0.20 * smoothstep(0.0, 0.22, 0.5 - abs(ridge));
  // Exposed as a photograph is: the brightest reflection comes up to white without burning out.
  vec3 lit = uBase * (0.20 + uShine * light * (1.0 + 0.25 * bevel)) * grain;
  vec3 colour = (1.0 - exp(-lit * 1.55)) * (1.0 - 0.72 * joint);
  outColor = vec4(colour * uAlpha, uAlpha);
}`;
