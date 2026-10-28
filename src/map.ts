import {
  beginSideTurn,
  defaultArmyControls,
  defaultAiStyles,
  emptyHadKing,
  emptySideCounts,
  hasGeneral,
  openingSide,
  sanitizeArmyControls,
  sanitizeAiStyles,
  SIDES,
  liftWallTerrain,
  sanitizeTokens,
  seedFlagOwners,
  statsOf,
  hpMax,
  staminaMax,
  hasUnitToken,
  stampAffiliation,
  type ArmyControl,
  type AiStyle,
  type GameState,
  type Piece,
  type Affiliation,
  type Side,
  type Terrain,
  type TileToken,
  type UnitTokenType,
  type UnitType,
  withStory,
  type PieceStory,
} from './engine';
import { defaultFacing, isHexDir, neighbors, type HexDir, type HexOrientation } from './hex';

export const COLS = 11;
export const ROWS = 11;
/** Randomised maps are two files wider than the stock grid. */
export const RANDOM_COLS = COLS + 2;
export const MIN_COLS = 5;
export const MAX_COLS = 21;
export const MIN_ROWS = 5;
export const MAX_ROWS = 21;
export const DEFAULT_ORIENTATION: HexOrientation = 'pointy';
/** Randomised maps (skirmish / hotseat) are always flat-top. */
export const RANDOM_ORIENTATION: HexOrientation = 'flat';

/** Army ranks + the line immediately in front of each army. */
function isClearRow(row: number, rows: number): boolean {
  return row < 3 || row >= rows - 3;
}

export type MapOptions = {
  waterCount: number;
  rockCount: number;
  palisadeCount: number;
  highCount: number;
  plateauCount: number;
};

export const DEFAULT_MAP: MapOptions = {
  waterCount: 8,
  rockCount: 4,
  palisadeCount: 3,
  highCount: 6,
  plateauCount: 5,
};

/** Back rank files 1→8 */
const BACK: UnitType[] = [
  'sniper',
  'scout',
  'bazooka',
  'tank',
  'general',
  'bazooka',
  'scout',
  'sniper',
];

export function emptyTerrain(cols: number = COLS, rows: number = ROWS): Terrain[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 'land' as Terrain),
  );
}

export function cloneTerrain(t: Terrain[][]): Terrain[][] {
  return t.map((row) => [...row]);
}

export function clampGridSize(cols: number, rows: number): { cols: number; rows: number } {
  return {
    cols: Math.max(MIN_COLS, Math.min(MAX_COLS, Math.floor(cols) || COLS)),
    rows: Math.max(MIN_ROWS, Math.min(MAX_ROWS, Math.floor(rows) || ROWS)),
  };
}

/** Grow/shrink a grid; new cells are land, extras are cropped. */
export function resizeTerrain(
  t: Terrain[][],
  cols: number,
  rows: number,
): Terrain[][] {
  const size = clampGridSize(cols, rows);
  const next: Terrain[][] = [];
  for (let r = 0; r < size.rows; r++) {
    const row: Terrain[] = [];
    for (let c = 0; c < size.cols; c++) {
      row.push(t[r]?.[c] ?? 'land');
    }
    next.push(row);
  }
  return next;
}

function eligibleCells(
  cols = RANDOM_COLS,
  rows = ROWS,
): { col: number; row: number }[] {
  const cells: { col: number; row: number }[] = [];
  for (let row = 0; row < rows; row++) {
    if (isClearRow(row, rows)) continue;
    for (let col = 0; col < cols; col++) {
      cells.push({ col, row });
    }
  }
  return cells;
}

/** Adjacent same-type. Water flank / sideways spread stays 3×. */
const CLUSTER = 7;
const WATER_SIDE = 3;

function inMap(
  h: { col: number; row: number },
  cols: number,
  rows: number,
): boolean {
  return h.col >= 0 && h.row >= 0 && h.col < cols && h.row < rows;
}

function pickWeighted<T>(items: T[], weight: (item: T) => number): T | undefined {
  if (!items.length) return undefined;
  const ws = items.map((item) => {
    const w = weight(item);
    return w > 0 && Number.isFinite(w) ? w : 0;
  });
  let total = 0;
  for (const w of ws) total += w;
  if (total <= 0) return items[Math.floor(Math.random() * items.length)];
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

function takeWeighted<T>(
  items: T[],
  weight: (item: T) => number,
): T | undefined {
  const picked = pickWeighted(items, weight);
  if (!picked) return undefined;
  const i = items.indexOf(picked);
  if (i >= 0) items.splice(i, 1);
  return picked;
}

function adjMatch(
  t: Terrain[][],
  h: { col: number; row: number },
  type: Terrain,
  cols: number,
  rows: number,
  pred?: (n: { col: number; row: number }) => boolean,
): boolean {
  for (const n of neighbors(h, RANDOM_ORIENTATION)) {
    if (!inMap(n, cols, rows)) continue;
    if (t[n.row][n.col] !== type) continue;
    if (pred && !pred(n)) continue;
    return true;
  }
  return false;
}

/** Left / right third — water and palisades seed and grow here. */
function isFlankCol(col: number, cols: number): boolean {
  const band = Math.max(2, Math.floor(cols / 3));
  return col < band || col >= cols - band;
}

function clusterWeight(
  t: Terrain[][],
  h: { col: number; row: number },
  type: Terrain,
  cols: number,
  rows: number,
): number {
  let w = 1;
  if (adjMatch(t, h, type, cols, rows)) w *= CLUSTER;
  if (type === 'water') {
    const sideways = adjMatch(t, h, 'water', cols, rows, (n) => n.col !== h.col);
    if (isFlankCol(h.col, cols) || sideways) w *= WATER_SIDE;
  }
  return w;
}

function palisadeWeight(
  h: { col: number; row: number },
  palKeys: Set<string>,
  cols: number,
): number {
  let w = 1;
  let adj = false;
  let sideways = false;
  for (const n of neighbors(h, RANDOM_ORIENTATION)) {
    if (!palKeys.has(`${n.col},${n.row}`)) continue;
    adj = true;
    if (n.col !== h.col) sideways = true;
  }
  if (adj) w *= CLUSTER;
  if (isFlankCol(h.col, cols) || sideways) w *= WATER_SIDE;
  return w;
}

type TerrainKey = 'water' | 'rock' | 'high' | 'plateau';

/** Cap counts so they fit the playable belt. Palisades overlay walkable tiles. */
export function clampMapOptions(opts: MapOptions): MapOptions {
  const max = eligibleCells(RANDOM_COLS, ROWS).length;
  let water = Math.max(0, Math.floor(opts.waterCount));
  let rock = Math.max(0, Math.floor(opts.rockCount));
  let palisade = Math.max(0, Math.min(max, Math.floor(opts.palisadeCount)));
  let high = Math.max(0, Math.floor(opts.highCount));
  let plateau = Math.max(0, Math.floor(opts.plateauCount));
  const total = water + rock + high + plateau;
  if (total > max && total > 0) {
    const scale = max / total;
    water = Math.floor(water * scale);
    rock = Math.floor(rock * scale);
    high = Math.floor(high * scale);
    plateau = Math.floor(plateau * scale);
    let left = max - water - rock - high - plateau;
    const prefs = (
      [
        { k: 'water' as const, v: opts.waterCount },
        { k: 'rock' as const, v: opts.rockCount },
        { k: 'high' as const, v: opts.highCount },
        { k: 'plateau' as const, v: opts.plateauCount },
      ] satisfies { k: TerrainKey; v: number }[]
    ).sort((a, b) => b.v - a.v);
    let pi = 0;
    while (left > 0) {
      const k = prefs[pi % prefs.length].k;
      if (k === 'water') water++;
      else if (k === 'rock') rock++;
      else if (k === 'high') high++;
      else plateau++;
      left--;
      pi++;
    }
  }
  return {
    waterCount: water,
    rockCount: rock,
    palisadeCount: palisade,
    highCount: high,
    plateauCount: plateau,
  };
}

export function maxTerrainCells(): number {
  return eligibleCells().length;
}

function paintTerrain(t: Terrain[][], opts: MapOptions): TileToken[] {
  const rows = t.length || ROWS;
  const cols = t[0]?.length ?? RANDOM_COLS;
  const { waterCount, rockCount, palisadeCount, highCount, plateauCount } =
    clampMapOptions(opts);
  const open = eligibleCells(cols, rows);
  const stamp = (type: Terrain, count: number) => {
    for (let n = 0; n < count; n++) {
      const h = takeWeighted(open, (cell) =>
        clusterWeight(t, cell, type, cols, rows),
      );
      if (!h) break;
      t[h.row][h.col] = type;
    }
  };
  stamp('water', waterCount);
  stamp('rock', rockCount);
  stamp('high', highCount);
  // Plateau is +2 — only paint land touching high so random maps stay walkable.
  const besideHigh: { col: number; row: number }[] = [];
  const seen = new Set<string>();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (t[row][col] !== 'high') continue;
      for (const n of neighbors({ col, row }, RANDOM_ORIENTATION)) {
        if (!inMap(n, cols, rows)) continue;
        if (isClearRow(n.row, rows) || t[n.row][n.col] !== 'land') continue;
        const k = `${n.col},${n.row}`;
        if (seen.has(k)) continue;
        seen.add(k);
        besideHigh.push(n);
      }
    }
  }
  for (let p = 0; p < plateauCount; p++) {
    const h = takeWeighted(besideHigh, (cell) =>
      clusterWeight(t, cell, 'plateau', cols, rows),
    );
    if (!h) break;
    t[h.row][h.col] = 'plateau';
  }
  const palisades: TileToken[] = [];
  const palKeys = new Set<string>();
  const palOpen = eligibleCells(cols, rows).filter(({ col, row }) => {
    const cell = t[row][col];
    return cell === 'land' || cell === 'high' || cell === 'plateau';
  });
  for (let p = 0; p < palisadeCount; p++) {
    const h = takeWeighted(palOpen, (cell) =>
      palisadeWeight(cell, palKeys, cols),
    );
    if (!h) break;
    palisades.push({ type: 'palisade', col: h.col, row: h.row });
    palKeys.add(`${h.col},${h.row}`);
  }
  return palisades;
}

let idSeq = 0;
function pid(side: Affiliation, type: UnitType): string {
  idSeq += 1;
  return `${side}-${type}-${idSeq}`;
}

/**
 * Column for BACK[i].
 * Red: left→right cols 1..8.
 * Blue: mirrored (own left at col 8) so from Red's view the enemy left sniper
 * sits on the right with its pawn against it.
 */
function armyLayout(cols: number): { backW: number; backStart: number } {
  const backW = Math.min(8, cols);
  const backStart = cols > backW ? Math.floor((cols - backW) / 2) : 0;
  return { backW, backStart };
}

function backCol(
  side: Side,
  backIndex: number,
  backStart: number,
  backW: number,
): number {
  return side === 'red'
    ? backStart + backIndex
    : backStart + (backW - 1) - backIndex;
}

/** Blue pawn/bunker line vs mirrored back rank (player view: − = left). */
const BLUE_PAWN_SHIFT = -1; // was +1, then two left

/** Bunker files in front of tank + general for that side. */
function wallPawnCols(side: Side, cols: number): number[] {
  const { backW, backStart } = armyLayout(cols);
  // BACK indices: tank=3, general=4
  const files = [3, 4]
    .filter((i) => i < backW)
    .map((i) => backCol(side, i, backStart, backW));
  return side === 'blue' ? files.map((c) => c + BLUE_PAWN_SHIFT) : files;
}

/** Pawn-row file for BACK[i]; blue line may be shifted vs back rank. */
function pawnCol(side: Side, backIndex: number, cols: number): number {
  const { backStart, backW } = armyLayout(cols);
  const col =
    backCol(side, backIndex, backStart, backW) +
    (side === 'blue' ? BLUE_PAWN_SHIFT : 0);
  return Math.max(0, Math.min(cols - 1, col));
}

function spawnExtras(type: UnitType): Pick<Piece, 'ammo' | 'hp' | 'stamina'> {
  const s = statsOf(type);
  return {
    ammo: s.ammo > 0 ? s.ammo : undefined,
    hp: s.hp > 1 ? s.hp : undefined,
    stamina: s.stamina > 0 ? s.stamina : undefined,
  };
}

/** Map edge a formation is stamped onto. One army per edge. */
export const ARMY_EDGES = ['bottom', 'top', 'left', 'right'] as const;
export type ArmyEdge = (typeof ARMY_EDGES)[number];

export const ARMY_EDGE_LABEL: Record<ArmyEdge, string> = {
  bottom: 'Bottom',
  top: 'Top',
  left: 'Left',
  right: 'Right',
};

export const DEFAULT_ARMY_EDGE: Record<Side, ArmyEdge> = {
  red: 'bottom',
  blue: 'top',
  yellow: 'left',
  purple: 'right',
};

export function isArmyEdge(v: unknown): v is ArmyEdge {
  return v === 'bottom' || v === 'top' || v === 'left' || v === 'right';
}

/** Cube-dir steps so Red's forward (2) points inward from this edge. */
const EDGE_ROT: Record<ArmyEdge, number> = {
  bottom: 0,
  right: 1,
  top: 3,
  left: 4,
};

function rotateDir(dir: HexDir, steps: number): HexDir {
  return ((((dir + steps) % 6) + 6) % 6) as HexDir;
}

function alongExtent(edge: ArmyEdge, cols: number, rows: number): number {
  return edge === 'left' || edge === 'right' ? rows : cols;
}

function slotToHex(
  along: number,
  depth: number,
  edge: ArmyEdge,
  cols: number,
  rows: number,
): { col: number; row: number } {
  switch (edge) {
    case 'bottom':
      return { col: along, row: rows - 1 - depth };
    case 'top':
      return { col: cols - 1 - along, row: depth };
    case 'left':
      return { col: depth, row: along };
    case 'right':
      return { col: cols - 1 - depth, row: rows - 1 - along };
  }
}

function hexToSlot(
  col: number,
  row: number,
  edge: ArmyEdge,
  cols: number,
  rows: number,
): { along: number; depth: number } {
  switch (edge) {
    case 'bottom':
      return { along: col, depth: rows - 1 - row };
    case 'top':
      return { along: cols - 1 - col, depth: row };
    case 'left':
      return { along: row, depth: col };
    case 'right':
      return { along: rows - 1 - row, depth: cols - 1 - col };
  }
}

/** One army, stored as if it were Red: col from own left, fromBack from own back rank. */
export type ArmySlot = {
  type: UnitType;
  col: number;
  fromBack: number;
  unitTokens?: UnitTokenType[];
  story?: PieceStory;
  /** Cube facing as if this slot were Red. Missing → defaultFacing('red'). */
  facing?: HexDir;
};

export type ArmyStamp = {
  type: UnitType;
  col: number;
  row: number;
  side: Affiliation;
  unitTokens?: UnitTokenType[];
  story?: PieceStory;
  /** Cube facing. Missing → defaultFacing(side). */
  facing?: HexDir;
};

export function facingFromStamp(p: Pick<ArmyStamp, 'side' | 'facing'>): HexDir {
  return isHexDir(p.facing) ? p.facing : defaultFacing(p.side);
}

/** Persist only when it differs from the side's default. */
export function sanitizeStampFacing(side: Affiliation, raw: unknown): HexDir | undefined {
  if (!isHexDir(raw)) return undefined;
  return raw === defaultFacing(side) ? undefined : raw;
}

export function slotsFromSide(
  pieces: ArmyStamp[],
  side: Side,
  cols: number,
  rows: number,
  edge: ArmyEdge = DEFAULT_ARMY_EDGE[side],
): ArmySlot[] {
  const rot = EDGE_ROT[edge];
  return pieces
    .filter((p) => p.side === side)
    .map((p) => {
      const abs = facingFromStamp(p);
      const asRed = rotateDir(abs, -rot);
      const { along, depth } = hexToSlot(p.col, p.row, edge, cols, rows);
      const packed = withStory(p.unitTokens, p.story);
      return {
        type: p.type,
        col: along,
        fromBack: depth,
        unitTokens: packed.unitTokens,
        story: packed.story,
        facing: sanitizeStampFacing('red', asRed),
      };
    })
    .filter((s) => s.col >= 0 && s.fromBack >= 0);
}

export function placeSlots(
  slots: ArmySlot[],
  side: Side,
  cols: number,
  rows: number,
  sourceCols: number,
  edge: ArmyEdge = DEFAULT_ARMY_EDGE[side],
): ArmyStamp[] {
  const off = Math.floor((alongExtent(edge, cols, rows) - sourceCols) / 2);
  const rot = EDGE_ROT[edge];
  const out: ArmyStamp[] = [];
  const seen = new Set<string>();
  for (const s of slots) {
    const along = s.col + off;
    const { col, row } = slotToHex(along, s.fromBack, edge, cols, rows);
    if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
    const k = `${col},${row}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const asRed = facingFromStamp({ side: 'red', facing: s.facing });
    const facing = rotateDir(asRed, rot);
    const packed = withStory(s.unitTokens, s.story);
    out.push({
      type: s.type,
      col,
      row,
      side,
      unitTokens: packed.unitTokens,
      story: packed.story,
      facing: sanitizeStampFacing(side, facing),
    });
  }
  return out;
}

/** Nearest map edge for a side's pieces. Empty → that side's default edge. */
export function inferArmyEdge(
  pieces: Array<{ col: number; row: number; side: Affiliation }>,
  side: Side,
  cols: number,
  rows: number,
): ArmyEdge {
  const mine = pieces.filter((p) => p.side === side);
  if (!mine.length) return DEFAULT_ARMY_EDGE[side];
  const avgCol = mine.reduce((n, p) => n + p.col, 0) / mine.length;
  const avgRow = mine.reduce((n, p) => n + p.row, 0) / mine.length;
  const scores: [ArmyEdge, number][] = [
    ['bottom', rows - 1 - avgRow],
    ['top', avgRow],
    ['left', avgCol],
    ['right', cols - 1 - avgCol],
  ];
  scores.sort((a, b) => a[1] - b[1]);
  return scores[0]![0];
}

/** Unique edge occupancy from piece positions. Empty sides do not claim an edge. */
export function inferEdgeOwners(
  pieces: Array<{ col: number; row: number; side: Affiliation }>,
  cols: number,
  rows: number,
): Record<ArmyEdge, Side | null> {
  const owner: Record<ArmyEdge, Side | null> = {
    bottom: null,
    top: null,
    left: null,
    right: null,
  };
  const ranked = SIDES.flatMap((side) => {
    const mine = pieces.filter((p) => p.side === side);
    if (!mine.length) return [];
    const avgCol = mine.reduce((n, p) => n + p.col, 0) / mine.length;
    const avgRow = mine.reduce((n, p) => n + p.row, 0) / mine.length;
    const scores: [ArmyEdge, number][] = [
      ['bottom', rows - 1 - avgRow],
      ['top', avgRow],
      ['left', avgCol],
      ['right', cols - 1 - avgCol],
    ];
    scores.sort((a, b) => a[1] - b[1]);
    return [{ side, scores }];
  });
  ranked.sort((a, b) => a.scores[0]![1] - b.scores[0]![1]);
  for (const { side, scores } of ranked) {
    const pick = scores.find(([e]) => owner[e] === null);
    if (pick) owner[pick[0]] = side;
  }
  return owner;
}

/** Current stock Red layout, as formation slots. */
export function stockSlots(cols: number, rows: number): ArmySlot[] {
  return slotsFromSide(spawnArmy('red', cols, rows), 'red', cols, rows);
}

export function piecesFromStamps(stamps: ArmyStamp[]): Piece[] {
  return stamps.map((p) => {
    const packed = withStory(p.unitTokens, p.story);
    const side = stampAffiliation({ side: p.side, unitTokens: packed.unitTokens });
    const piece: Piece = {
      id: pid(side, p.type),
      side,
      type: p.type,
      col: p.col,
      row: p.row,
      startCol: p.col,
      startRow: p.row,
      facing: facingFromStamp(p),
      ...spawnExtras(p.type),
      unitTokens: packed.unitTokens,
      story: packed.story,
    };
    const max = hpMax(piece);
    piece.hp = max > 1 ? max : undefined;
    const stam = staminaMax(piece);
    if (hasUnitToken(piece, 'exhausted') && stam > 0) piece.stamina = 0;
    else piece.stamina = stam > 0 ? stam : undefined;
    return piece;
  });
}

function spawnArmy(side: Side, cols: number, rows: number): Piece[] {
  const backRow = side === 'red' ? rows - 1 : 0;
  const pawnRow = side === 'red' ? rows - 2 : 1;
  const { backW, backStart } = armyLayout(cols);
  const pieces: Piece[] = [];
  const wallCols = new Set(wallPawnCols(side, cols));

  for (let i = 0; i < backW; i++) {
    const col = backCol(side, i, backStart, backW);
    pieces.push({
      id: pid(side, BACK[i]),
      side,
      type: BACK[i],
      col,
      row: backRow,
      startCol: col,
      startRow: backRow,
      facing: defaultFacing(side),
      ...spawnExtras(BACK[i]),
    });
  }

  // Pawns against each unit except bunker hexes (concrete walls) → 6
  for (let i = 0; i < backW; i++) {
    const col = pawnCol(side, i, cols);
    if (wallCols.has(col)) continue;
    pieces.push({
      id: pid(side, 'soldier'),
      side,
      type: 'soldier',
      col,
      row: pawnRow,
      startCol: col,
      startRow: pawnRow,
      facing: defaultFacing(side),
      ...spawnExtras('soldier'),
    });
  }

  // +1 flank pawn on the outer wing (red left edge; blue shifted with the line)
  const flankCol = side === 'red' ? 0 : backStart + backW - 1;
  if (side === 'red' ? backStart > 0 : flankCol >= 0 && flankCol < cols) {
    const occupied = pieces.some((p) => p.col === flankCol && p.row === pawnRow);
    if (!occupied && !wallCols.has(flankCol)) {
      pieces.push({
        id: pid(side, 'soldier'),
        side,
        type: 'soldier',
        col: flankCol,
        row: pawnRow,
        startCol: flankCol,
        startRow: pawnRow,
        facing: defaultFacing(side),
        ...spawnExtras('soldier'),
      });
    }
  }

  return pieces;
}

/** Concrete bunkers on each army's pawn row in front of tank + general. */
function setupWallTokens(cols: number, rows: number): TileToken[] {
  const out: TileToken[] = [];
  for (const side of ['red', 'blue'] as Side[]) {
    const pawnRow = side === 'red' ? rows - 2 : 1;
    for (const col of wallPawnCols(side, cols)) {
      if (pawnRow >= 0 && pawnRow < rows && col >= 0 && col < cols) {
        out.push({ type: 'wall', col, row: pawnRow });
      }
    }
  }
  return out;
}

function freshGame(
  terrain: Terrain[][],
  log: string,
  orientation: HexOrientation = DEFAULT_ORIENTATION,
  armies?: ArmyStamp[] | null,
  controls?: Record<Side, ArmyControl> | Partial<Record<Side, ArmyControl>>,
  tokens?: TileToken[] | null,
  aiStyles?: Record<Side, AiStyle> | Partial<Record<Side, AiStyle>>,
): GameState {
  idSeq = 0;
  const custom = armies && armies.length > 0;
  const lifted = liftWallTerrain(cloneTerrain(terrain), tokens ?? []);
  const t = lifted.terrain;
  const rows = t.length;
  const cols = t[0]?.length ?? COLS;
  const merged = custom
    ? lifted.tokens
    : [...lifted.tokens, ...setupWallTokens(cols, rows)];
  const inBounds = (p: ArmyStamp) =>
    p.col >= 0 && p.col < cols && p.row >= 0 && p.row < rows;
  const pieces = custom
    ? piecesFromStamps(armies.filter(inBounds))
    : [...spawnArmy('red', cols, rows), ...spawnArmy('blue', cols, rows)];
  const king = (side: Side) => hasGeneral(pieces, side);
  const hadKing = emptyHadKing();
  const casualties = emptySideCounts();
  for (const s of SIDES) hadKing[s] = king(s);
  const start = openingSide(pieces);
  const state: GameState = {
    cols,
    rows,
    orientation,
    terrain: t,
    tokens: sanitizeTokens(merged, cols, rows),
    pieces,
    turn: start,
    scoutActionsLeft: null,
    scoutPieceId: null,
    scoutMoveSpent: null,
    staminaBonus: false,
    winner: null,
    controls: controls ? sanitizeArmyControls(controls) : defaultArmyControls(),
    aiStyles: aiStyles ? sanitizeAiStyles(aiStyles) : defaultAiStyles(),
    hadKing,
    hadVisible: emptyHadKing(),
    unitsPerTurn: 1,
    maxTurns: 0,
    actedIds: [],
    startingSide: start,
    turnNumber: 1,
    casualties,
    hpLost: emptySideCounts(),
    flagCaptures: 0,
    log: [log],
  };
  seedFlagOwners(state);
  beginSideTurn(state, false, true);
  return state;
}

export function createInitialState(
  opts: MapOptions = DEFAULT_MAP,
  armies?: ArmyStamp[] | null,
  controls?: Record<Side, ArmyControl> | Partial<Record<Side, ArmyControl>>,
  aiStyles?: Record<Side, AiStyle> | Partial<Record<Side, AiStyle>>,
): GameState {
  const clamped = clampMapOptions(opts);
  const terrain = emptyTerrain(RANDOM_COLS, ROWS);
  const walls = paintTerrain(terrain, clamped);
  return freshGame(
    terrain,
    `Red moves first. Map: ${clamped.waterCount} water, ${clamped.rockCount} rock, ${clamped.palisadeCount} palisade, ${clamped.highCount} high, ${clamped.plateauCount} plateau (rows 3–7).`,
    RANDOM_ORIENTATION,
    armies,
    controls,
    walls,
    aiStyles,
  );
}

/** Start a match on a custom (editor) terrain layout. */
export function createStateFromTerrain(
  terrain: Terrain[][],
  levelName?: string,
  orientation: HexOrientation = DEFAULT_ORIENTATION,
  armies?: ArmyStamp[] | null,
  controls?: Record<Side, ArmyControl> | Partial<Record<Side, ArmyControl>>,
  tokens?: TileToken[] | null,
  aiStyles?: Record<Side, AiStyle> | Partial<Record<Side, AiStyle>>,
): GameState {
  return freshGame(
    terrain,
    levelName
      ? `Red moves first. Level: ${levelName}`
      : 'Red moves first. Custom map.',
    orientation,
    armies,
    controls,
    tokens,
    aiStyles,
  );
}
