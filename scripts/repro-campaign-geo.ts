import {
  closestOnSegment,
  computeNeighbors,
  cutStaysInside,
  dist,
  findEdgeNear,
  insertVertexOnSharedEdge,
  moveSharedVertex,
  pointInPolygon,
  ringsOverlap,
  samePoint,
  snapToRegions,
  splitRingByCut,
} from '../src/campaign/geometry';
import type { Point } from '../src/campaign/types';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const square: Point[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

assert(pointInPolygon({ x: 50, y: 50 }, square), 'center inside');
assert(!pointInPolygon({ x: 150, y: 50 }, square), 'outside right');
assert(!pointInPolygon({ x: -1, y: 50 }, square), 'outside left');

const on = closestOnSegment({ x: 50, y: -10 }, { x: 0, y: 0 }, { x: 100, y: 0 });
assert(samePoint(on, { x: 50, y: 0 }), 'closest on top edge');
assert(dist({ x: 0, y: 0 }, { x: 3, y: 4 }) === 5, 'dist 3-4-5');

const regions = [
  {
    id: 'a',
    ring: [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 0, y: 50 },
    ],
  },
  {
    id: 'b',
    ring: [
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 50 },
    ],
  },
];

const hit = snapToRegions({ x: 50.5, y: 0.5 }, regions, 8);
assert(hit?.kind === 'vertex', 'snap prefers shared vertex');
assert(samePoint(hit!.point, { x: 50, y: 0 }), 'snapped to (50,0)');

const moved = moveSharedVertex(regions, { x: 50, y: 0 }, { x: 55, y: -5 });
assert(moved === 2, `shared vertex moved in both rings, got ${moved}`);
assert(samePoint(regions[0].ring[1], { x: 55, y: -5 }), 'region a updated');
assert(samePoint(regions[1].ring[0], { x: 55, y: -5 }), 'region b updated');

// restore shared edge for neighbor test
regions[0].ring[1] = { x: 50, y: 0 };
regions[1].ring[0] = { x: 50, y: 0 };
regions[0].ring[2] = { x: 50, y: 50 };
regions[1].ring[3] = { x: 50, y: 50 };

const neighbors = computeNeighbors(regions);
assert(neighbors.a.includes('b'), 'a neighbors b');
assert(neighbors.b.includes('a'), 'b neighbors a');

const lone = {
  id: 'c',
  ring: [
    { x: 200, y: 200 },
    { x: 220, y: 200 },
    { x: 220, y: 220 },
    { x: 200, y: 220 },
  ],
};
const n2 = computeNeighbors([...regions, lone]);
assert(n2.c.length === 0, 'isolated region has no neighbors');

assert(!ringsOverlap(regions[0].ring, regions[1].ring), 'shared-border neighbors do not overlap');
const nested: Point[] = [
  { x: 10, y: 10 },
  { x: 40, y: 10 },
  { x: 40, y: 40 },
  { x: 10, y: 40 },
];
assert(ringsOverlap(regions[0].ring, nested), 'nested ring overlaps');

const big: Point[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];
const split = splitRingByCut(big, 0, 2, [{ x: 50, y: 50 }]);
assert(!!split, 'split returns rings');
assert(split!.ringA.length >= 3 && split!.ringB.length >= 3, 'both halves valid');
assert(!ringsOverlap(split!.ringA, split!.ringB), 'halves share cut only');
assert(cutStaysInside(big, big[0], big[2], [{ x: 50, y: 50 }]), 'cut inside');
assert(!cutStaysInside(big, big[0], big[2], [{ x: 150, y: 50 }]), 'cut outside rejected');

const adj = splitRingByCut(big, 0, 1, []);
assert(adj === null, 'adjacent verts with no mid cannot split');

const shared = [
  {
    id: 'a',
    ring: [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 0, y: 50 },
    ],
  },
  {
    id: 'b',
    ring: [
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 50 },
    ],
  },
];
const edge = findEdgeNear(shared, { x: 50, y: 25 }, 8, 'a');
assert(edge?.regionId === 'a', 'edge hit on shared border');
const idx = insertVertexOnSharedEdge(
  shared,
  edge!.a,
  edge!.b,
  edge!.point,
  'a',
);
assert(idx === 2, `inserted on a at index 2, got ${idx}`);
assert(shared[0].ring.length === 5, 'a gained a vertex');
assert(shared[1].ring.length === 5, 'b gained matching vertex on shared edge');
assert(
  shared[0].ring.some((p) => samePoint(p, edge!.point)) &&
    shared[1].ring.some((p) => samePoint(p, edge!.point)),
  'both rings carry the new point',
);

console.log('repro-campaign-geo: ok');
