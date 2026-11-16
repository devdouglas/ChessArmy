import type { Point } from './types';

export const SNAP_PX = 8;
export const POINT_EPS = 0.01;

export function dist(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function samePoint(a: Point, b: Point, eps = POINT_EPS): boolean {
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

export function pointInPolygon(p: Point, ring: Point[]): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x;
    const yi = ring[i].y;
    const xj = ring[j].x;
    const yj = ring[j].y;
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function centroid(ring: Point[]): Point {
  if (ring.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p.x;
    y += p.y;
  }
  return { x: x / ring.length, y: y / ring.length };
}

/** Closest point on segment ab to p. */
export function closestOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return { x: a.x, y: a.y };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

export type SnapHit =
  | { kind: 'vertex'; point: Point; regionId: string; index: number }
  | { kind: 'edge'; point: Point; regionId: string; edgeIndex: number }
  | null;

export function snapToRegions(
  p: Point,
  regions: { id: string; ring: Point[] }[],
  radius = SNAP_PX,
): SnapHit {
  let bestVertex: SnapHit = null;
  let bestVertexD = radius;
  let bestEdge: SnapHit = null;
  let bestEdgeD = radius;

  for (const region of regions) {
    const ring = region.ring;
    for (let i = 0; i < ring.length; i++) {
      const d = dist(p, ring[i]);
      if (d <= bestVertexD) {
        bestVertexD = d;
        bestVertex = {
          kind: 'vertex',
          point: { ...ring[i] },
          regionId: region.id,
          index: i,
        };
      }
      const j = (i + 1) % ring.length;
      const on = closestOnSegment(p, ring[i], ring[j]);
      const ed = dist(p, on);
      if (ed <= bestEdgeD) {
        bestEdgeD = ed;
        bestEdge = {
          kind: 'edge',
          point: on,
          regionId: region.id,
          edgeIndex: i,
        };
      }
    }
  }
  return bestVertex ?? bestEdge;
}

/** Move every vertex across all rings that matches `from` to `to`. */
export function moveSharedVertex(
  regions: { ring: Point[] }[],
  from: Point,
  to: Point,
  eps = POINT_EPS,
): number {
  let n = 0;
  for (const region of regions) {
    for (let i = 0; i < region.ring.length; i++) {
      if (samePoint(region.ring[i], from, eps)) {
        region.ring[i] = { x: to.x, y: to.y };
        n += 1;
      }
    }
  }
  return n;
}

function edgeKey(a: Point, b: Point): string {
  const ax = Math.round(a.x * 100) / 100;
  const ay = Math.round(a.y * 100) / 100;
  const bx = Math.round(b.x * 100) / 100;
  const by = Math.round(b.y * 100) / 100;
  if (ax < bx || (ax === bx && ay < by)) {
    return `${ax},${ay}|${bx},${by}`;
  }
  return `${bx},${by}|${ax},${ay}`;
}

function edgesOf(ring: Point[]): [Point, Point][] {
  const out: [Point, Point][] = [];
  for (let i = 0; i < ring.length; i++) {
    out.push([ring[i], ring[(i + 1) % ring.length]]);
  }
  return out;
}

/**
 * Regions share a border when they share at least one edge (after snap rounding).
 * Returns undirected adjacency lists.
 */
export function computeNeighbors(
  regions: { id: string; ring: Point[] }[],
): Record<string, string[]> {
  const edgeOwners = new Map<string, Set<string>>();
  for (const region of regions) {
    for (const [a, b] of edgesOf(region.ring)) {
      if (samePoint(a, b)) continue;
      const key = edgeKey(a, b);
      let set = edgeOwners.get(key);
      if (!set) {
        set = new Set();
        edgeOwners.set(key, set);
      }
      set.add(region.id);
    }
  }

  const neighbors: Record<string, Set<string>> = {};
  for (const region of regions) neighbors[region.id] = new Set();

  for (const owners of edgeOwners.values()) {
    if (owners.size < 2) continue;
    const ids = [...owners];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        neighbors[ids[i]].add(ids[j]);
        neighbors[ids[j]].add(ids[i]);
      }
    }
  }

  const out: Record<string, string[]> = {};
  for (const id of Object.keys(neighbors)) {
    out[id] = [...neighbors[id]].sort();
  }
  return out;
}

export function ringToPath(ring: Point[]): string {
  if (ring.length === 0) return '';
  const parts = ring.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`);
  return `${parts.join(' ')} Z`;
}

export function pointOnSegment(
  p: Point,
  a: Point,
  b: Point,
  eps = SNAP_PX * 0.35,
): boolean {
  return dist(p, closestOnSegment(p, a, b)) <= eps;
}

export function pointOnRingBoundary(
  p: Point,
  ring: Point[],
  eps = SNAP_PX * 0.35,
): boolean {
  for (let i = 0; i < ring.length; i++) {
    if (samePoint(p, ring[i], eps)) return true;
    if (pointOnSegment(p, ring[i], ring[(i + 1) % ring.length], eps)) return true;
  }
  return false;
}

/** Strict interior — not on the boundary. */
export function pointStrictlyInside(p: Point, ring: Point[]): boolean {
  return pointInPolygon(p, ring) && !pointOnRingBoundary(p, ring);
}

function orient(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** Proper crossing (not just shared endpoint / collinear overlap). */
export function segmentsProperIntersect(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  const eps = 1e-9;
  if (Math.abs(o1) < eps || Math.abs(o2) < eps || Math.abs(o3) < eps || Math.abs(o4) < eps) {
    return false;
  }
  return o1 * o2 < 0 && o3 * o4 < 0;
}

/**
 * True when rings share interior area.
 * Shared vertices / shared border edges are allowed.
 */
export function ringsOverlap(a: Point[], b: Point[]): boolean {
  if (a.length < 3 || b.length < 3) return false;
  for (const p of a) {
    if (pointStrictlyInside(p, b)) return true;
  }
  for (const p of b) {
    if (pointStrictlyInside(p, a)) return true;
  }
  for (let i = 0; i < a.length; i++) {
    const a0 = a[i];
    const a1 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const b0 = b[j];
      const b1 = b[(j + 1) % b.length];
      if (segmentsProperIntersect(a0, a1, b0, b1)) return true;
    }
  }
  // Centroid of A inside B (covers A fully inside B with no verts inside due to shared hull)
  const ca = centroid(a);
  if (pointStrictlyInside(ca, b)) return true;
  const cb = centroid(b);
  if (pointStrictlyInside(cb, a)) return true;
  return false;
}

export function ringOverlapsAny(
  ring: Point[],
  others: { id?: string; ring: Point[] }[],
  ignoreId?: string,
): boolean {
  for (const o of others) {
    if (ignoreId && o.id === ignoreId) continue;
    if (ringsOverlap(ring, o.ring)) return true;
  }
  return false;
}

/** Walk inclusive indices from `from` to `to` along the ring (forward). */
export function ringArcInclusive(ring: Point[], from: number, to: number): Point[] {
  const n = ring.length;
  if (n === 0) return [];
  const out: Point[] = [];
  let i = ((from % n) + n) % n;
  const end = ((to % n) + n) % n;
  out.push({ ...ring[i] });
  if (i === end) return out;
  do {
    i = (i + 1) % n;
    out.push({ ...ring[i] });
  } while (i !== end);
  return out;
}

export type SplitResult = {
  ringA: Point[];
  ringB: Point[];
};

/**
 * Split a ring by a cut from vertex `startIndex` to `endIndex`
 * through optional interior midpoints (not including the endpoints).
 */
export function splitRingByCut(
  ring: Point[],
  startIndex: number,
  endIndex: number,
  mids: Point[],
): SplitResult | null {
  const n = ring.length;
  if (n < 3) return null;
  if (startIndex < 0 || endIndex < 0 || startIndex >= n || endIndex >= n) return null;
  if (startIndex === endIndex) return null;

  const arcA = ringArcInclusive(ring, startIndex, endIndex);
  const arcB = ringArcInclusive(ring, endIndex, startIndex);
  // Adjacent verts with no mids → one ring would only have 2 points.
  if (arcA.length + mids.length < 3) return null;
  if (arcB.length + mids.length < 3) return null;

  const midCopy = mids.map((p) => ({ ...p }));
  const ringA = [
    ...arcA,
    ...[...midCopy].reverse(),
  ];
  const ringB = [
    ...arcB,
    ...midCopy,
  ];

  // Drop accidental duplicate consecutive points.
  const clean = (pts: Point[]): Point[] => {
    const out: Point[] = [];
    for (const p of pts) {
      if (out.length && samePoint(out[out.length - 1], p)) continue;
      out.push(p);
    }
    if (out.length >= 2 && samePoint(out[0], out[out.length - 1])) out.pop();
    return out;
  };
  const a = clean(ringA);
  const b = clean(ringB);
  if (a.length < 3 || b.length < 3) return null;
  return { ringA: a, ringB: b };
}

/** Midpoints of each cut segment should stay inside (or on) the source ring. */
export function cutStaysInside(ring: Point[], start: Point, end: Point, mids: Point[]): boolean {
  const path = [start, ...mids, end];
  for (let i = 0; i < path.length - 1; i++) {
    const mid = {
      x: (path[i].x + path[i + 1].x) / 2,
      y: (path[i].y + path[i + 1].y) / 2,
    };
    if (!pointInPolygon(mid, ring) && !pointOnRingBoundary(mid, ring)) return false;
  }
  for (const p of mids) {
    if (!pointInPolygon(p, ring) && !pointOnRingBoundary(p, ring)) return false;
  }
  return true;
}

export function findVertexIndex(
  ring: Point[],
  p: Point,
  eps = SNAP_PX,
): number {
  let best = -1;
  let bestD = eps;
  for (let i = 0; i < ring.length; i++) {
    const d = dist(p, ring[i]);
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export type EdgeHit = {
  regionId: string;
  edgeIndex: number;
  a: Point;
  b: Point;
  point: Point;
  dist: number;
};

/** Closest edge within radius. Prefer `preferRegionId` when distances are close. */
export function findEdgeNear(
  regions: { id: string; ring: Point[] }[],
  p: Point,
  radius = SNAP_PX,
  preferRegionId?: string,
): EdgeHit | null {
  let best: EdgeHit | null = null;
  for (const region of regions) {
    const ring = region.ring;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const on = closestOnSegment(p, a, b);
      // Skip near existing vertices — those are for dragging, not insert.
      if (dist(on, a) <= SNAP_PX * 0.6 || dist(on, b) <= SNAP_PX * 0.6) continue;
      const d = dist(p, on);
      if (d > radius) continue;
      const hit: EdgeHit = {
        regionId: region.id,
        edgeIndex: i,
        a: { ...a },
        b: { ...b },
        point: on,
        dist: d,
      };
      if (
        !best ||
        d < best.dist - 0.01 ||
        (Math.abs(d - best.dist) <= 0.01 &&
          preferRegionId === region.id &&
          preferRegionId !== best.regionId)
      ) {
        best = hit;
      }
    }
  }
  return best;
}

/**
 * Insert `point` on every ring that has an edge matching endpoints a–b
 * (either direction). Returns the new vertex index on `primaryRegionId`.
 */
/**
 * Remove every ring vertex that matches `point` (shared borders stay in sync).
 * Rings that would drop below 3 verts are left unchanged and listed in `blocked`.
 */
export function removeVertexAtPoint(
  regions: { id: string; ring: Point[] }[],
  point: Point,
  eps = SNAP_PX,
): { removed: number; blocked: string[] } {
  let removed = 0;
  const blocked: string[] = [];
  for (const region of regions) {
    const matches = region.ring
      .map((v, i) => (samePoint(v, point, eps) ? i : -1))
      .filter((i) => i >= 0);
    if (!matches.length) continue;
    if (region.ring.length - matches.length < 3) {
      blocked.push(region.id);
      continue;
    }
    for (let i = matches.length - 1; i >= 0; i--) {
      region.ring.splice(matches[i], 1);
      removed += 1;
    }
  }
  return { removed, blocked };
}

export function insertVertexOnSharedEdge(
  regions: { id: string; ring: Point[] }[],
  a: Point,
  b: Point,
  point: Point,
  primaryRegionId: string,
): number | null {
  let primaryIndex: number | null = null;
  for (const region of regions) {
    const ring = region.ring;
    for (let i = 0; i < ring.length; i++) {
      const p0 = ring[i];
      const p1 = ring[(i + 1) % ring.length];
      const forward = samePoint(p0, a) && samePoint(p1, b);
      const backward = samePoint(p0, b) && samePoint(p1, a);
      if (!forward && !backward) continue;
      // Already has a vertex here?
      if (ring.some((v) => samePoint(v, point, SNAP_PX * 0.5))) {
        const existing = findVertexIndex(ring, point, SNAP_PX);
        if (region.id === primaryRegionId && existing >= 0) primaryIndex = existing;
        break;
      }
      const insertAt = i + 1;
      ring.splice(insertAt, 0, { x: point.x, y: point.y });
      if (region.id === primaryRegionId) primaryIndex = insertAt;
      break;
    }
  }
  return primaryIndex;
}
