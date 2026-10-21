/** Offset coords + cube math for pointy-top (odd-r) and flat-top (odd-q) hexes. */

export type Hex = { col: number; row: number };
export type Cube = { q: number; r: number; s: number };
/** Point up = pointy-top. Flat up = flat-top. */
export type HexOrientation = 'pointy' | 'flat';

export function key(h: Hex): string {
  return `${h.col},${h.row}`;
}

export function parseKey(k: string): Hex {
  const [col, row] = k.split(',').map(Number);
  return { col, row };
}

export function eq(a: Hex, b: Hex): boolean {
  return a.col === b.col && a.row === b.row;
}

export function offsetToCube(h: Hex, o: HexOrientation): Cube {
  if (o === 'flat') {
    const q = h.col;
    const r = h.row - (h.col - (h.col & 1)) / 2;
    return { q, r, s: -q - r };
  }
  const q = h.col - (h.row - (h.row & 1)) / 2;
  const r = h.row;
  return { q, r, s: -q - r };
}

export function cubeToOffset(c: Cube, o: HexOrientation): Hex {
  if (o === 'flat') {
    const col = c.q;
    const row = c.r + (c.q - (c.q & 1)) / 2;
    return { col, row };
  }
  const col = c.q + (c.r - (c.r & 1)) / 2;
  return { col, row: c.r };
}

export function cubeDistance(a: Cube, b: Cube): number {
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));
}

export function distance(a: Hex, b: Hex, o: HexOrientation): number {
  return cubeDistance(offsetToCube(a, o), offsetToCube(b, o));
}

/** Cube steps, CCW from +q (pointy east / flat SE). */
export const CUBE_DIRS: Cube[] = [
  { q: 1, r: 0, s: -1 },
  { q: 1, r: -1, s: 0 },
  { q: 0, r: -1, s: 1 },
  { q: -1, r: 0, s: 1 },
  { q: -1, r: 1, s: 0 },
  { q: 0, r: 1, s: -1 },
];

export type HexDir = 0 | 1 | 2 | 3 | 4 | 5;

export function isHexDir(n: unknown): n is HexDir {
  return n === 0 || n === 1 || n === 2 || n === 3 || n === 4 || n === 5;
}

/** Red up (2), blue down (5), yellow east (0), purple west (3). */
export function defaultFacing(side: string): HexDir {
  if (side === 'blue') return 5;
  if (side === 'yellow') return 0;
  if (side === 'purple') return 3;
  return 2;
}

/** Cube dir of the hex-axis from `from` to `to`, or null if they are not aligned. */
export function axisDir(from: Hex, to: Hex, o: HexOrientation): HexDir | null {
  const a = offsetToCube(from, o);
  const b = offsetToCube(to, o);
  const dq = b.q - a.q;
  const dr = b.r - a.r;
  const ds = b.s - a.s;
  const n = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
  if (n === 0) return null;
  for (let i = 0; i < 6; i++) {
    const d = CUBE_DIRS[i];
    if (d.q * n === dq && d.r * n === dr && d.s * n === ds) return i as HexDir;
  }
  return null;
}

/** Adjacent step `from` → `to`, or null if not a cube neighbor. */
export function dirBetween(from: Hex, to: Hex, o: HexOrientation): HexDir | null {
  const a = offsetToCube(from, o);
  const b = offsetToCube(to, o);
  const dq = b.q - a.q;
  const dr = b.r - a.r;
  const ds = b.s - a.s;
  for (let i = 0; i < 6; i++) {
    const d = CUBE_DIRS[i];
    if (d.q === dq && d.r === dr && d.s === ds) return i as HexDir;
  }
  return null;
}

export function neighborInDir(h: Hex, dir: HexDir, o: HexOrientation): Hex {
  const c = offsetToCube(h, o);
  const d = CUBE_DIRS[dir];
  return cubeToOffset({ q: c.q + d.q, r: c.r + d.r, s: c.s + d.s }, o);
}

/**
 * Side of `to` that faces `from` (the incoming attack / last LOS step).
 * Adjacent uses the shared edge; longer shots use the hex before `to` on the line.
 */
export function incomingDir(from: Hex, to: Hex, o: HexOrientation): HexDir | null {
  const adj = dirBetween(to, from, o);
  if (adj !== null) return adj;
  const cells = line(from, to, o);
  if (cells.length === 0) return null;
  const prev = cells.length === 1 ? from : cells[cells.length - 2];
  return dirBetween(to, prev, o);
}

export function neighbors(h: Hex, o: HexOrientation): Hex[] {
  const c = offsetToCube(h, o);
  return CUBE_DIRS.map((d) =>
    cubeToOffset({ q: c.q + d.q, r: c.r + d.r, s: c.s + d.s }, o),
  );
}

function cubeLerp(a: Cube, b: Cube, t: number): Cube {
  return {
    q: a.q + (b.q - a.q) * t,
    r: a.r + (b.r - a.r) * t,
    s: a.s + (b.s - a.s) * t,
  };
}

function cubeRound(c: Cube): Cube {
  let q = Math.round(c.q);
  let r = Math.round(c.r);
  let s = Math.round(c.s);
  const qDiff = Math.abs(q - c.q);
  const rDiff = Math.abs(r - c.r);
  const sDiff = Math.abs(s - c.s);
  if (qDiff > rDiff && qDiff > sDiff) q = -r - s;
  else if (rDiff > sDiff) r = -q - s;
  else s = -q - r;
  return { q, r, s };
}

/** Hexes along the line from a to b, excluding a, including b. */
export function line(a: Hex, b: Hex, o: HexOrientation): Hex[] {
  const n = distance(a, b, o);
  if (n === 0) return [];
  const ca = offsetToCube(a, o);
  const cb = offsetToCube(b, o);
  const out: Hex[] = [];
  for (let i = 1; i <= n; i++) {
    out.push(cubeToOffset(cubeRound(cubeLerp(ca, cb, i / n)), o));
  }
  return out;
}

export type PathOpts = {
  cols: number;
  rows: number;
  maxDist: number;
  orientation: HexOrientation;
  /** May stop here (empty land, or capturable enemy). */
  canStop: (h: Hex) => boolean;
  /** May walk through (friendly). Empty hexes should also pass if stoppable. */
  canPass: (h: Hex) => boolean;
  /** Movement cost to step from `from` onto `to` (default 1). */
  stepCost?: (from: Hex, to: Hex) => number;
};

/**
 * Uniform-cost reachable stop-hexes within maxDist.
 * Expands through passable hexes; enemies (stop && !pass) are destinations only.
 */
export function reachable(start: Hex, opts: PathOpts): Map<string, number> {
  return pathSearch(start, opts).stops;
}

/**
 * Shortest path from start → goal (inclusive of goal, exclusive of start),
 * or null if unreachable under the same rules as `reachable`.
 */
export function pathTo(start: Hex, goal: Hex, opts: PathOpts): Hex[] | null {
  if (eq(start, goal)) return [];
  const { best, parent } = pathSearch(start, opts);
  const gk = key(goal);
  if (!best.has(gk) || !opts.canStop(goal)) return null;

  const path: Hex[] = [];
  let cur: Hex | undefined = goal;
  while (cur && !eq(cur, start)) {
    path.push(cur);
    cur = parent.get(key(cur));
  }
  if (!cur || !eq(cur, start)) return null;
  path.reverse();
  return path;
}

function pathSearch(
  start: Hex,
  opts: PathOpts,
): {
  stops: Map<string, number>;
  best: Map<string, number>;
  parent: Map<string, Hex>;
} {
  const stepCost = opts.stepCost ?? (() => 1);
  const stops = new Map<string, number>();
  const best = new Map<string, number>([[key(start), 0]]);
  const parent = new Map<string, Hex>();
  // Simple sorted queue (board is tiny)
  const queue: { h: Hex; d: number }[] = [{ h: start, d: 0 }];

  while (queue.length) {
    queue.sort((a, b) => a.d - b.d);
    const { h, d } = queue.shift()!;
    if (d !== best.get(key(h))) continue; // stale
    if (d >= opts.maxDist) continue;

    for (const n of neighbors(h, opts.orientation)) {
      if (n.col < 0 || n.row < 0 || n.col >= opts.cols || n.row >= opts.rows) continue;
      const cost = stepCost(h, n);
      if (cost <= 0 || !Number.isFinite(cost)) continue;
      const nd = d + cost;
      if (nd > opts.maxDist) continue;

      const nk = key(n);
      const prev = best.get(nk);
      if (prev !== undefined && prev <= nd) continue;

      const stop = opts.canStop(n);
      const pass = opts.canPass(n);
      if (!stop && !pass) continue;

      best.set(nk, nd);
      parent.set(nk, h);
      if (stop) stops.set(nk, nd);

      if (pass && nd < opts.maxDist) queue.push({ h: n, d: nd });
    }
  }

  return { stops, best, parent };
}

/** Inverse of hexToPixel (centers). */
export function pixelToHex(
  x: number,
  y: number,
  size: number,
  o: HexOrientation,
): Hex {
  let q: number;
  let r: number;
  if (o === 'flat') {
    q = ((2 / 3) * x) / size;
    r = ((-1 / 3) * x + (Math.sqrt(3) / 3) * y) / size;
  } else {
    q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / size;
    r = ((2 / 3) * y) / size;
  }
  return cubeToOffset(cubeRound({ q, r, s: -q - r }), o);
}

/** Pixel center for an offset hex. */
export function hexToPixel(
  h: Hex,
  size: number,
  o: HexOrientation,
): { x: number; y: number } {
  if (o === 'flat') {
    const x = size * (3 / 2) * h.col;
    const y = size * Math.sqrt(3) * (h.row + 0.5 * (h.col & 1));
    return { x, y };
  }
  const x = size * Math.sqrt(3) * (h.col + 0.5 * (h.row & 1));
  const y = size * (3 / 2) * h.row;
  return { x, y };
}

export function hexCorners(
  cx: number,
  cy: number,
  size: number,
  o: HexOrientation,
): string {
  const start = o === 'flat' ? 0 : -30;
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i + start);
    pts.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

/** Content size of a cols×rows hex grid (centers + hex extent), excluding pad. */
export function hexGridExtent(
  cols: number,
  rows: number,
  size: number,
  o: HexOrientation,
): { w: number; h: number } {
  if (o === 'flat') {
    return {
      w: size * ((3 / 2) * (cols - 1) + 2),
      h: size * Math.sqrt(3) * (rows + 0.5),
    };
  }
  return {
    w: size * Math.sqrt(3) * (cols + 0.5),
    h: size * ((3 / 2) * rows + 1),
  };
}
