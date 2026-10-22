import {
  beginSideTurn,
  defaultArmyControls,
  emptyHadKing,
  emptySideCounts,
  hasGeneral,
  openingSide,
  sanitizeArmyControls,
  SIDES,
  liftWallTerrain,
  sanitizeTokens,
  seedFlagOwners,
  statsOf,
  type ArmyControl,
  type GameState,
  type Piece,
  type Side,
  type Terrain,
  type TileToken,
  type UnitType,
} from './engine';
import { defaultFacing, neighbors, type HexOrientation } from './hex';

export const COLS = 11;
export const ROWS = 11;
export const MIN_COLS = 5;
export const MAX_COLS = 21;
export const MIN_ROWS = 5;
export const MAX_ROWS = 21;
export const DEFAULT_ORIENTATION: HexOrientation = 'pointy';

/** Rows kept clear: army ranks + the line immediately in front of each army. */
const CLEAR_ROWS = new Set([0, 1, 2, 8, 9, 10]);

export type MapOptions = {
  waterCount: number;
  rockCount: number;
  wallCount: number;
  highCount: number;
  plateauCount: number;
};

export const DEFAULT_MAP: MapOptions = {
  waterCount: 10,
  rockCount: 6,
  wallCount: 4,
  highCount: 6,
  plateauCount: 3,
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

function eligibleCells(): { col: number; row: number }[] {
  const cells: { col: number; row: number }[] = [];
  for (let row = 0; row < ROWS; row++) {
    if (CLEAR_ROWS.has(row)) continue;
    for (let col = 0; col < COLS; col++) {
      cells.push({ col, row });
    }
  }
  return cells;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type TerrainKey = 'water' | 'rock' | 'high' | 'plateau';

/** Cap counts so they fit the playable belt. Walls overlay walkable tiles. */
export function clampMapOptions(opts: MapOptions): MapOptions {
  const max = eligibleCells().length;
  let water = Math.max(0, Math.floor(opts.waterCount));
  let rock = Math.max(0, Math.floor(opts.rockCount));
  let wall = Math.max(0, Math.min(max, Math.floor(opts.wallCount)));
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
    wallCount: wall,
    highCount: high,
    plateauCount: plateau,
  };
}

export function maxTerrainCells(): number {
  return eligibleCells().length;
}

function paintTerrain(t: Terrain[][], opts: MapOptions): TileToken[] {
  const { waterCount, rockCount, wallCount, highCount, plateauCount } = clampMapOptions(opts);
  const picks = shuffle(eligibleCells());
  let i = 0;
  for (let w = 0; w < waterCount && i < picks.length; w++, i++) {
    const { col, row } = picks[i];
    t[row][col] = 'water';
  }
  for (let r = 0; r < rockCount && i < picks.length; r++, i++) {
    const { col, row } = picks[i];
    t[row][col] = 'rock';
  }
  for (let h = 0; h < highCount && i < picks.length; h++, i++) {
    const { col, row } = picks[i];
    t[row][col] = 'high';
  }
  // Plateau is +2 — only paint land touching high so random maps stay walkable.
  const besideHigh: { col: number; row: number }[] = [];
  const seen = new Set<string>();
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (t[row][col] !== 'high') continue;
      for (const n of neighbors({ col, row }, DEFAULT_ORIENTATION)) {
        if (n.col < 0 || n.row < 0 || n.col >= COLS || n.row >= ROWS) continue;
        if (CLEAR_ROWS.has(n.row) || t[n.row][n.col] !== 'land') continue;
        const k = `${n.col},${n.row}`;
        if (seen.has(k)) continue;
        seen.add(k);
        besideHigh.push(n);
      }
    }
  }
  const plateauPicks = shuffle(besideHigh);
  for (let p = 0; p < plateauCount && p < plateauPicks.length; p++) {
    const { col, row } = plateauPicks[p];
    t[row][col] = 'plateau';
  }
  const walls: TileToken[] = [];
  const wallPicks = shuffle(eligibleCells());
  for (let w = 0; w < wallCount && w < wallPicks.length; w++) {
    const { col, row } = wallPicks[w];
    walls.push({ type: 'wall', col, row });
  }
  return walls;
}

let idSeq = 0;
function pid(side: Side, type: UnitType): string {
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

/** One army, stored as if it were Red: col from own left, fromBack from own back rank. */
export type ArmySlot = {
  type: UnitType;
  col: number;
  fromBack: number;
};

export type ArmyStamp = {
  type: UnitType;
  col: number;
  row: number;
  side: Side;
};

export function slotsFromSide(
  pieces: ArmyStamp[],
  side: Side,
  cols: number,
  rows: number,
): ArmySlot[] {
  return pieces
    .filter((p) => p.side === side)
    .map((p) => ({
      type: p.type,
      col: side === 'red' ? p.col : cols - 1 - p.col,
      fromBack: side === 'red' ? rows - 1 - p.row : p.row,
    }))
    .filter((s) => s.col >= 0 && s.fromBack >= 0);
}

export function placeSlots(
  slots: ArmySlot[],
  side: Side,
  cols: number,
  rows: number,
  sourceCols: number,
): ArmyStamp[] {
  const off = Math.floor((cols - sourceCols) / 2);
  const out: ArmyStamp[] = [];
  const seen = new Set<string>();
  for (const s of slots) {
    const col = side === 'red' ? s.col + off : cols - 1 - (s.col + off);
    const row = side === 'red' ? rows - 1 - s.fromBack : s.fromBack;
    if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
    const k = `${col},${row}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ type: s.type, col, row, side });
  }
  return out;
}

/** Current stock Red layout, as formation slots. */
export function stockSlots(cols: number, rows: number): ArmySlot[] {
  return slotsFromSide(spawnArmy('red', cols, rows), 'red', cols, rows);
}

export function piecesFromStamps(stamps: ArmyStamp[]): Piece[] {
  return stamps.map((p) => ({
    id: pid(p.side, p.type),
    side: p.side,
    type: p.type,
    col: p.col,
    row: p.row,
    facing: defaultFacing(p.side),
    ...spawnExtras(p.type),
  }));
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
    hadKing,
    unitsPerTurn: 1,
    actedIds: [],
    startingSide: start,
    turnNumber: 1,
    casualties,
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
): GameState {
  const clamped = clampMapOptions(opts);
  const terrain = emptyTerrain();
  const walls = paintTerrain(terrain, clamped);
  return freshGame(
    terrain,
    `Red moves first. Map: ${clamped.waterCount} water, ${clamped.rockCount} rock, ${clamped.wallCount} wall, ${clamped.highCount} high, ${clamped.plateauCount} plateau (rows 3–7).`,
    DEFAULT_ORIENTATION,
    armies,
    controls,
    walls,
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
  );
}
