/**
 * Terrain heights: a draw-time treatment only. Movement, LOS and every other
 * rule keep using `terrainHeight()` in engine.ts; nothing here changes data.
 *
 * Every whole level is one identical slab of HEIGHT_STEP px. A tile at level N
 * is drawn N slabs tall, with a seam line between slabs on its south-facing
 * side walls. Tweak the numbers in LEVEL_TABLE / the constants below.
 */
import type { Terrain } from './engine';
import { cubeToOffset, neighborInDir, offsetToCube, type Hex, type HexDir, type HexOrientation } from './hex';

/** Screen px for one height level (one slab). */
export const HEIGHT_STEP = 12;

/** Level (in slabs) per terrain. Negative = sunken. One table, tweak freely. */
export const LEVEL_TABLE: Record<Terrain, number> = {
  water: -0.5, // half a step below the grass plane
  land: 0, // grass, the reference plane
  wall: 0, // stone-wall terrain stays flat (the wall glyph supplies the look)
  high: 1, // hills
  plateau: 2, // grey plateau, between hills and rock
  rock: 3, // mountains / rock
};

/** Thin plinth (px, not a full slab) under a palisade token — the tile itself stays put. */
export const PALISADE_BASE = 5;

/** Small lift of the bridge deck above its water (or other) tile. The tile stays put. */
export const BRIDGE_LIFT = 5;

/** Extra lift of a palisade / bridge object above its tile top. 0 for anything else. */
export function structureLift(type: string): number {
  if (type === 'palisade') return PALISADE_BASE;
  if (type === 'bridge') return BRIDGE_LIFT;
  return 0;
}

/** A placed token / unit sits this many slabs above its tile top. */
export const TOKEN_LIFT_STEPS = 0.25;
export const TOKEN_LIFT = HEIGHT_STEP * TOKEN_LIFT_STEPS;

/** Token glyphs that already fill the whole hex: they ride the tile, no extra lift. */
export const FLAT_GLYPH_TOKENS: ReadonlySet<string> = new Set(['wall', 'palisade', 'bridge']);

/** How far a tile top is raised, in px (positive = up on screen). */
export function levelLift(level: number): number {
  return level * HEIGHT_STEP;
}

export function terrainLift(t: Terrain): number {
  return levelLift(LEVEL_TABLE[t] ?? 0);
}

/** The three south-facing edges (and, for pointy-top boards, the two that exist). */
export type SideFace = 'sw' | 's' | 'se';

export type WallEdge = {
  /** Vertex index of the edge start; the edge runs vertex a -> a+1. */
  a: number;
  face: SideFace;
  /** Neighbour in that direction. */
  nb: Hex;
};

export type NorthEdge = { a: number };

function vertexAngle(i: number, o: HexOrientation): number {
  return ((o === 'flat' ? 0 : -30) + 60 * i) * (Math.PI / 180);
}

/** Corner i of a hex centred at (cx, cy). */
export function cornerAt(cx: number, cy: number, size: number, i: number, o: HexOrientation): [number, number] {
  const ang = vertexAngle(i, o);
  return [cx + size * Math.cos(ang), cy + size * Math.sin(ang)];
}

function edgeNormalAngle(i: number, o: HexOrientation): number {
  return vertexAngle(i, o) + Math.PI / 6;
}

/** South-facing edges that show a wall when the tile is higher than the neighbour. */
export function southEdges(h: Hex, o: HexOrientation): WallEdge[] {
  const out: WallEdge[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = edgeNormalAngle(i, o);
    if (Math.sin(ang) <= 0.2) continue; // vertical edges have no area; north faces are hidden
    const cos = Math.cos(ang);
    const face: SideFace = Math.abs(cos) < 0.2 ? 's' : cos > 0 ? 'se' : 'sw';
    out.push({ a: i, face, nb: neighbourAcross(h, i, o) });
  }
  return out;
}

/** North-facing edges: their neighbours' walls meet them, and rim light runs along them. */
export function northEdges(o: HexOrientation): NorthEdge[] {
  const out: NorthEdge[] = [];
  for (let i = 0; i < 6; i++) {
    if (Math.sin(edgeNormalAngle(i, o)) < -0.2) out.push({ a: i });
  }
  return out;
}

/** Neighbour across the edge between vertex i and i+1. */
export function neighbourAcross(h: Hex, i: number, o: HexOrientation): Hex {
  const want = edgeNormalAngle(i, o);
  let best: HexDir = 0;
  let bestD = Infinity;
  // Compare in screen space with a unit hex so we do not need the size.
  const c0 = unitCentre(h, o);
  for (let d = 0; d < 6; d++) {
    const n = neighborInDir(h, d as HexDir, o);
    const c1 = unitCentre(n, o);
    const ang = Math.atan2(c1.y - c0.y, c1.x - c0.x);
    let diff = Math.abs(ang - want) % (Math.PI * 2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < bestD) {
      bestD = diff;
      best = d as HexDir;
    }
  }
  return neighborInDir(h, best, o);
}

function unitCentre(h: Hex, o: HexOrientation): { x: number; y: number } {
  if (o === 'flat') return { x: 1.5 * h.col, y: Math.sqrt(3) * (h.row + 0.5 * (h.col & 1)) };
  return { x: Math.sqrt(3) * (h.col + 0.5 * (h.row & 1)), y: 1.5 * h.row };
}

/** All hexes within `radius` cube steps of `h` (including h). */
export function hexesWithin(h: Hex, radius: number, o: HexOrientation): Hex[] {
  const c = offsetToCube(h, o);
  const out: Hex[] = [];
  for (let dq = -radius; dq <= radius; dq++) {
    for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
      const q = c.q + dq;
      const r = c.r + dr;
      out.push(cubeToOffset({ q, r, s: -q - r }, o));
    }
  }
  return out;
}

export function pointInPolygon(px: number, py: number, pts: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
