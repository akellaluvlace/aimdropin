// Shared by the measuring scripts.

/** Least-squares circle through points (Kasa). */
export function fitCircle(points) {
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0;
  for (const [x, y] of points) { const z = x * x + y * y; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; sz += z; }
  const n = points.length;
  // Solve [sxx sxy sx; sxy syy sy; sx sy n] [a b c]' = [sxz syz sz]'
  const m = [[sxx, sxy, sx, sxz], [sxy, syy, sy, syz], [sx, sy, n, sz]];
  for (let i = 0; i < 3; i++) {
    let pivot = i;
    for (let r = i + 1; r < 3; r++) if (Math.abs(m[r][i]) > Math.abs(m[pivot][i])) pivot = r;
    [m[i], m[pivot]] = [m[pivot], m[i]];
    for (let r = 0; r < 3; r++) if (r !== i) { const f = m[r][i] / m[i][i]; for (let c = i; c < 4; c++) m[r][c] -= f * m[i][c]; }
  }
  const a = m[0][3] / m[0][0], b = m[1][3] / m[1][1], c = m[2][3] / m[2][2];
  let cx = a / 2, cy = b / 2, r = Math.sqrt(c + cx * cx + cy * cy);
  // The algebraic fit above makes a short arc's circle too small. Refine it geometrically (Gauss-Newton on
  // the distances to the circle), which does not.
  for (let pass = 0; pass < 60; pass++) {
    const n3 = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    for (const [x, y] of points) {
      const d = Math.hypot(x - cx, y - cy) || 1e-9;
      const j = [-(x - cx) / d, -(y - cy) / d, -1], f = d - r;
      for (let i = 0; i < 3; i++) { for (let k = 0; k < 3; k++) n3[i][k] += j[i] * j[k]; n3[i][3] -= j[i] * f; }
    }
    for (let i = 0; i < 3; i++) {
      let pivot = i;
      for (let q = i + 1; q < 3; q++) if (Math.abs(n3[q][i]) > Math.abs(n3[pivot][i])) pivot = q;
      [n3[i], n3[pivot]] = [n3[pivot], n3[i]];
      for (let q = 0; q < 3; q++) if (q !== i) { const g = n3[q][i] / n3[i][i]; for (let k = i; k < 4; k++) n3[q][k] -= g * n3[i][k]; }
    }
    const step = [n3[0][3] / n3[0][0], n3[1][3] / n3[1][1], n3[2][3] / n3[2][2]];
    cx += step[0]; cy += step[1]; r += step[2];
    if (Math.hypot(...step) < 1e-4) break;
  }
  return { cx, cy, r };
}
