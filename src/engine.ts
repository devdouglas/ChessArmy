/**
 * Pure rules engine for Chess Army prototype.
 * Question: does this army-chess ruleset feel right to play?
 */

import {
  distance,
  eq,
  line,
  neighbors,
  parseKey,
  pathTo,
  reachable,
  type Hex,
  type HexOrientation,
  type PathOpts,
} from './hex';

export type Side = 'red' | 'blue';
export type Terrain = 'land' | 'water' | 'rock' | 'wall' | 'high';

/** Impassable solid terrain (rock permanent, wall rocket-breakable). */
export function isSolidTerrain(t: Terrain): boolean {
  return t === 'rock' || t === 'wall';
}
export type UnitType =
  | 'soldier'
  | 'scout'
  | 'bazooka'
  | 'sniper'
  | 'tank'
  | 'general';

export const UNIT_TYPES: UnitType[] = [
  'soldier',
  'scout',
  'bazooka',
  'sniper',
  'tank',
  'general',
];

export type Piece = {
  id: string;
  side: Side;
  type: UnitType;
  col: number;
  row: number;
  /** Soldiers only: once-per-game 2-hex sprint. Lost when used or when shooting. */
  hasSprint?: boolean;
  /** Turns of shoot cooldown remaining (can't shoot while > 0). */
  shootCooldown?: number;
  /** Fired this turn — cooldown won't tick until the following end-turn. */
  firedThisTurn?: boolean;
  /** Remaining shots when the unit has a finite ammo cap. */
  ammo?: number;
  /** Remaining hitpoints (undefined = full / `UnitStats.hp`). */
  hp?: number;
};

export type GameState = {
  cols: number;
  rows: number;
  orientation: HexOrientation;
  terrain: Terrain[][]; // [row][col]
  pieces: Piece[];
  turn: Side;
  /** Scout mid-turn: remaining actions for selected piece id */
  scoutActionsLeft: number | null;
  scoutPieceId: string | null;
  /** Path-cost spent on moves this scout activation (budget 3 → no 2+2). */
  scoutMoveSpent: number | null;
  winner: Side | null;
  log: string[];
};

export type Action =
  | { kind: 'move'; pieceId: string; to: Hex; sprint?: boolean }
  | { kind: 'shoot'; pieceId: string; at: Hex }
  | { kind: 'skip' }; // scout skip remaining action

export type Highlight =
  | { kind: 'move'; hex: Hex; cost: number }
  | { kind: 'sprint'; hex: Hex; cost: number }
  /** Valid fire target (enemy, or empty for splash). */
  | { kind: 'shoot'; hex: Hex }
  /** In weapon range + LOS, but not a legal shot (empty air / friendly). */
  | { kind: 'shoot-range'; hex: Hex };

export type UnitStats = {
  name: string;
  chess: string;
  move: number;
  /** Max shoot distance (high ground may add +1). */
  shoot: number;
  /** Min shoot distance (1 = can fire adjacent). */
  shootMin: number;
  actions: number;
  /** Own turns you must sit out shooting after firing (1 = next activation, 2 = two, …). */
  shootCooldown: number;
  value: number;
  /** Once-per-game extra move (lost when used or when shooting). */
  sprint: boolean;
  /** Sprint move range (used when sprint is still available). */
  sprintMove: number;
  /** Cap on total move cost across a multi-action activation (0 = no cap). */
  moveBudget: number;
  /** Shots per piece per match (0 = unlimited). */
  ammo: number;
  /** Hitpoints. */
  hp: number;
  /** Damage when bumping / overrunning an occupied hex. */
  meleeDamage: number;
  /** Damage of a non-splash shot. */
  shootDamage: number;
  /** Damage per hex in a splash blast. 0 = no splash (bullet shot). */
  splashDamage: number;
  /** Subtracted from incoming damage (can be negative). */
  armor: number;
};

/** Ring color for the current armor scale. */
export function armorColor(armor: number): string {
  if (armor >= 2) return '#3dba6a';
  if (armor === 1) return '#e89030';
  if (armor <= -1) return '#8b5cf6';
  return '#dc4646';
}

export function armorOf(piece: Piece): number {
  return UNIT_STATS[piece.type].armor;
}

/** Damage after the target's armor. Negative armor increases the hit. */
export function netDamage(piece: Piece, amount: number): number {
  return Math.max(0, amount - armorOf(piece));
}

export function hasSplash(stats: UnitStats): boolean {
  return stats.splashDamage > 0;
}

export const DEFAULT_UNIT_STATS: Record<UnitType, UnitStats> = {
  soldier: {
    name: 'Soldier',
    chess: 'Pawn',
    move: 1,
    shoot: 2,
    shootMin: 1,
    actions: 1,
    shootCooldown: 1,
    value: 1,
    sprint: true,
    sprintMove: 2,
    moveBudget: 0,
    ammo: 0,
    hp: 1,
    meleeDamage: 1,
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
  },
  scout: {
    name: 'Scout',
    chess: 'Knight',
    move: 2,
    shoot: 3,
    shootMin: 1,
    actions: 2,
    shootCooldown: 1,
    value: 3,
    sprint: false,
    sprintMove: 2,
    moveBudget: 3,
    ammo: 0,
    hp: 1,
    meleeDamage: 1,
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
  },
  bazooka: {
    name: 'Bazooka',
    chess: 'Bishop',
    move: 1,
    shoot: 4,
    shootMin: 1,
    actions: 1,
    shootCooldown: 2,
    value: 3,
    sprint: false,
    sprintMove: 2,
    moveBudget: 0,
    ammo: 0,
    hp: 1,
    meleeDamage: 1,
    shootDamage: 1,
    splashDamage: 1,
    armor: 0,
  },
  sniper: {
    name: 'Sniper',
    chess: 'Rook',
    move: 1,
    shoot: 6,
    shootMin: 1,
    actions: 1,
    shootCooldown: 1,
    value: 5,
    sprint: false,
    sprintMove: 2,
    moveBudget: 0,
    ammo: 0,
    hp: 1,
    meleeDamage: 1,
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
  },
  tank: {
    name: 'Tank',
    chess: 'Queen',
    move: 3,
    shoot: 4,
    shootMin: 3,
    actions: 1,
    shootCooldown: 2,
    value: 9,
    sprint: false,
    sprintMove: 2,
    moveBudget: 0,
    ammo: 0,
    hp: 1,
    meleeDamage: 1,
    shootDamage: 1,
    splashDamage: 1,
    armor: 2,
  },
  general: {
    name: 'General',
    chess: 'King',
    move: 1,
    shoot: 2,
    shootMin: 1,
    actions: 1,
    shootCooldown: 0,
    value: 100,
    sprint: false,
    sprintMove: 2,
    moveBudget: 0,
    ammo: 0,
    hp: 1,
    meleeDamage: 1,
    shootDamage: 1,
    splashDamage: 0,
    armor: 1,
  },
};

/** Live stats — mutated by the unit editor. Engine reads this at action time. */
export const UNIT_STATS: Record<UnitType, UnitStats> = structuredClone(DEFAULT_UNIT_STATS);

export function isReloading(piece: Piece): boolean {
  return (piece.shootCooldown ?? 0) > 0;
}

/** True when the unit has a finite ammo cap and none left. */
export function isDepleted(piece: Piece): boolean {
  const cap = UNIT_STATS[piece.type].ammo;
  if (cap <= 0) return false;
  return (piece.ammo ?? 0) <= 0;
}

/** Remaining shots, or null if ammo is unlimited. */
export function ammoLeft(piece: Piece): number | null {
  const cap = UNIT_STATS[piece.type].ammo;
  if (cap <= 0) return null;
  return piece.ammo ?? 0;
}

function ammoLog(piece: Piece, stats: UnitStats): string {
  if (stats.ammo <= 0) return '';
  return (piece.ammo ?? 0) <= 0 ? ' — empty' : ` — ${piece.ammo} ammo`;
}

export function hpMax(piece: Piece): number {
  return UNIT_STATS[piece.type].hp;
}

export function hpLeft(piece: Piece): number {
  return piece.hp ?? hpMax(piece);
}

function hpOf(piece: Piece, hpMap?: Map<string, number>): number {
  return hpMap?.get(piece.id) ?? hpLeft(piece);
}

function applyDamage(
  state: GameState,
  victim: Piece,
  amount: number,
): { fatal: boolean; remaining: number } {
  const remaining = Math.max(0, hpLeft(victim) - netDamage(victim, amount));
  victim.hp = remaining;
  if (remaining <= 0) {
    state.pieces = state.pieces.filter((p) => p.id !== victim.id);
    return { fatal: true, remaining: 0 };
  }
  return { fatal: false, remaining };
}

function hpHitLog(name: string, fatal: boolean, remaining: number): string {
  return fatal ? `${name} killed` : `${name} (${remaining} HP)`;
}

export type MoveHit = {
  id: string;
  amount: number;
  fatal: boolean;
  remaining: number;
};

export type MovePlan = {
  stop: Hex;
  hits: MoveHit[];
};

function activationMoveRange(state: GameState, piece: Piece): number {
  const stats = UNIT_STATS[piece.type];
  let moveRange =
    stats.sprint && piece.hasSprint
      ? Math.max(stats.move, stats.sprintMove)
      : stats.move;
  if (stats.actions > 1 && stats.moveBudget > 0) {
    const spent =
      state.scoutPieceId === piece.id ? (state.scoutMoveSpent ?? 0) : 0;
    moveRange = Math.min(stats.move, Math.max(0, stats.moveBudget - spent));
  }
  return moveRange;
}

/**
 * Where a move actually ends: occupying an enemy hex is melee.
 * A kill takes the hex; a survivor leaves the attacker on the hex before.
 * Tank overrun still walks through infantry that die; a survivor blocks.
 */
export function previewMove(
  state: GameState,
  piece: Piece,
  to: Hex,
): MovePlan {
  const from: Hex = { col: piece.col, row: piece.row };
  const melee = Math.max(0, UNIT_STATS[piece.type].meleeDamage);
  const path =
    pathTo(from, to, {
      ...movePathOpts(state, piece),
      maxDist: Math.max(1, activationMoveRange(state, piece)),
    }) ?? (eq(from, to) ? [] : [to]);

  const hpMap = new Map(state.pieces.map((p) => [p.id, hpLeft(p)]));
  const hits: MoveHit[] = [];
  let stop = to;

  const strike = (victim: Piece): boolean => {
    if (melee <= 0) return false;
    const nextHp = hpOf(victim, hpMap) - netDamage(victim, melee);
    hpMap.set(victim.id, nextHp);
    hits.push({
      id: victim.id,
      amount: melee,
      fatal: nextHp <= 0,
      remaining: Math.max(0, nextHp),
    });
    return nextHp <= 0;
  };

  for (let i = 0; i < path.length; i++) {
    const h = path[i];
    const occ = pieceAt(state, h);
    if (!occ || occ.side === piece.side) continue;
    const isDest = i === path.length - 1;
    const overrun = piece.type === 'tank' && occ.type === 'soldier' && !isDest;
    if (!isDest && !overrun) continue;
    const died = strike(occ);
    if (!died) {
      stop = i === 0 ? from : path[i - 1];
      break;
    }
  }

  return { stop, hits };
}

export function pieceAt(state: GameState, h: Hex): Piece | undefined {
  return state.pieces.find((p) => p.col === h.col && p.row === h.row);
}

export function getPiece(state: GameState, id: string): Piece | undefined {
  return state.pieces.find((p) => p.id === id);
}

export function terrainAt(state: GameState, h: Hex): Terrain {
  return state.terrain[h.row]?.[h.col] ?? 'rock';
}

function inBounds(state: GameState, h: Hex): boolean {
  return h.col >= 0 && h.row >= 0 && h.col < state.cols && h.row < state.rows;
}

function hexDist(state: GameState, a: Hex, b: Hex): number {
  return distance(a, b, state.orientation);
}

function hexNeighbors(state: GameState, h: Hex): Hex[] {
  return neighbors(h, state.orientation);
}

function losClear(state: GameState, from: Hex, to: Hex): boolean {
  const cells = line(from, to, state.orientation);
  const fromHigh = terrainAt(state, from) === 'high';
  // Rock/wall always block. High blocks through-LOS only when shooting from low.
  // From high: shoot along/over the ridge (intermediate high ignored) and over pieces.
  // Destination may be high / occupied / wall — you can shoot *onto* it.
  for (let i = 0; i < cells.length - 1; i++) {
    const h = cells[i];
    const t = terrainAt(state, h);
    if (isSolidTerrain(t)) return false;
    if (!fromHigh && t === 'high') return false;
    if (!fromHigh && pieceAt(state, h)) return false;
  }
  return true;
}

/**
 * Splash blast from impact `at`, shot fired from `from`.
 * Walls block forward spread — only the back/side arch (toward the shooter) is hit
 * when impacting a wall; splash never continues through solid cover.
 */
export function splashBlast(state: GameState, at: Hex, from: Hex): Hex[] {
  const out: Hex[] = [at];
  const impactSolid = isSolidTerrain(terrainAt(state, at));
  const atDist = hexDist(state, from, at);

  // Concrete/rock hit: only 3 splash tiles — impact + 2 closest toward shooter
  if (impactSolid) {
    const back = hexNeighbors(state, at)
      .filter((n) => inBounds(state, n) && hexDist(state, from, n) <= atDist)
      .sort((a, b) => hexDist(state, from, a) - hexDist(state, from, b));
    for (const n of back.slice(0, 2)) out.push(n);
    return out;
  }

  for (const n of hexNeighbors(state, at)) {
    if (!inBounds(state, n)) continue;

    // Open impact: can clip an adjacent wall/rock, but not hexes in its shadow
    if (isSolidTerrain(terrainAt(state, n))) {
      out.push(n);
      continue;
    }
    if (inSolidShadow(state, from, at, n)) continue;
    out.push(n);
  }
  return out;
}

/** True if `n` sits in the shadow behind solid cover adjacent to impact `at`. */
function inSolidShadow(state: GameState, from: Hex, at: Hex, n: Hex): boolean {
  for (const s of hexNeighbors(state, at)) {
    if (!inBounds(state, s) || !isSolidTerrain(terrainAt(state, s))) continue;
    if (eq(s, n)) return false;
    // n is behind solid s (from the shot) if farther from shooter than s and touches s
    if (hexDist(state, s, n) === 1 && hexDist(state, from, n) > hexDist(state, from, s)) {
      // Only treat as shadow when n is not merely beside the cover in a mutual triangle
      // with a clear shot angle — require n to be further along the from→s axis
      if (hexDist(state, from, n) >= hexDist(state, from, s) + hexDist(state, s, n)) return true;
    }
  }
  return false;
}

/** True if aiming splash at `at` would damage at least one enemy. */
function splashHitsEnemy(
  state: GameState,
  at: Hex,
  from: Hex,
  shooterSide: Side,
): boolean {
  for (const h of splashBlast(state, at, from)) {
    const t = pieceAt(state, h);
    if (t && t.side !== shooterSide) return true;
  }
  return false;
}

/** True if splash would hit an enemy, or this hex is a wall to demolish. */
function splashHasTarget(
  state: GameState,
  at: Hex,
  from: Hex,
  shooterSide: Side,
): boolean {
  if (splashHitsEnemy(state, at, from, shooterSide)) return true;
  // Walls: must aim at the wall itself (not the tile in front) so the rocket impacts on it
  return terrainAt(state, at) === 'wall';
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    terrain: state.terrain.map((r) => [...r]),
    pieces: state.pieces.map((p) => ({ ...p })),
    log: [...state.log],
  };
}

function other(side: Side): Side {
  return side === 'red' ? 'blue' : 'red';
}

function tickShootCooldowns(state: GameState, side: Side): void {
  for (const p of state.pieces) {
    if (p.side !== side) continue;
    if (p.firedThisTurn) {
      // Fired this activation — keep cooldown for the next one
      p.firedThisTurn = false;
      continue;
    }
    if ((p.shootCooldown ?? 0) > 0) {
      p.shootCooldown = (p.shootCooldown ?? 0) - 1;
    }
  }
}

function endTurn(state: GameState): void {
  const finished = state.turn;
  state.scoutActionsLeft = null;
  state.scoutPieceId = null;
  state.scoutMoveSpent = null;
  tickShootCooldowns(state, finished);
  state.turn = other(state.turn);
}

function checkWin(state: GameState): void {
  const redG = state.pieces.some((p) => p.side === 'red' && p.type === 'general');
  const blueG = state.pieces.some((p) => p.side === 'blue' && p.type === 'general');
  if (!redG) state.winner = 'blue';
  else if (!blueG) state.winner = 'red';
}

function afterAction(state: GameState, piece: Piece): void {
  const stats = UNIT_STATS[piece.type];
  if (stats.actions > 1 && state.scoutPieceId === piece.id) {
    state.scoutActionsLeft = (state.scoutActionsLeft ?? stats.actions) - 1;
    if (state.scoutActionsLeft <= 0) endTurn(state);
  } else if (stats.actions > 1 && state.scoutPieceId === null) {
    // first scout action
    state.scoutPieceId = piece.id;
    state.scoutActionsLeft = stats.actions - 1;
    if (state.scoutActionsLeft <= 0) endTurn(state);
  } else {
    endTurn(state);
  }
  checkWin(state);
}

/** Path rules for a piece (shared by highlights + tank overrun resolution). */
function movePathOpts(state: GameState, piece: Piece): Omit<PathOpts, 'maxDist'> {
  const isScout = piece.type === 'scout';
  const isTank = piece.type === 'tank';
  return {
    cols: state.cols,
    rows: state.rows,
    orientation: state.orientation,
    canStop: (h: Hex) => {
      if (!inBounds(state, h)) return false;
      const t = terrainAt(state, h);
      // Nobody ends on water/rock/wall (scouts only *pass through* water)
      if (t === 'water' || isSolidTerrain(t)) return false;
      // Tanks too heavy for high ground
      if (isTank && t === 'high') return false;
      const occ = pieceAt(state, h);
      if (!occ) return true;
      return occ.side !== piece.side; // capture enemy
    },
    canPass: (h: Hex) => {
      if (!inBounds(state, h)) return false;
      const t = terrainAt(state, h);
      if (isSolidTerrain(t)) return false; // rock/wall block everyone
      if (isScout) {
        // Scout: through water + any pieces; stop rules handled by canStop
        return true;
      }
      if (t === 'water') return false;
      if (isTank && t === 'high') return false;
      const occ = pieceAt(state, h);
      if (!occ) return true;
      // Tank: overrun enemy infantry; blocked by other pieces
      if (isTank) {
        return occ.side !== piece.side && occ.type === 'soldier';
      }
      return occ.side === piece.side; // others: friendlies only
    },
  };
}

/** Move/shoot range for a piece (ignores whose turn it is). */
export function rangeHighlights(state: GameState, pieceId: string): Highlight[] {
  const piece = getPiece(state, pieceId);
  if (!piece) return [];

  const stats = UNIT_STATS[piece.type];
  const from: Hex = { col: piece.col, row: piece.row };
  const out: Highlight[] = [];

  const moveRange = activationMoveRange(state, piece);

  const fromTerrain = terrainAt(state, from);
  // Climb onto high from low: −1 move range (min 1).
  // Already on high → other high (incl. adjacent): full move, no climb penalty.
  // Leaving high / flat: full move.
  const climbRange = Math.max(1, moveRange - 1);

  const pathOpts = movePathOpts(state, piece);

  const reachFull = reachable(from, { ...pathOpts, maxDist: moveRange });
  const reachClimb =
    fromTerrain === 'high'
      ? reachFull // on the ridge — never apply climb restriction
      : reachable(from, { ...pathOpts, maxDist: climbRange });

  const reach = new Map<string, number>();
  for (const [k, dist] of reachFull) {
    const h = parseKey(k);
    const climbing = fromTerrain !== 'high' && terrainAt(state, h) === 'high';
    if (climbing) {
      const cd = reachClimb.get(k);
      if (cd === undefined) continue;
      reach.set(k, cd);
    } else {
      reach.set(k, dist);
    }
  }

  for (const [k, dist] of reach) {
    const h = parseKey(k);
    if (stats.sprint && piece.hasSprint && dist > stats.move && dist <= moveRange) {
      out.push({ kind: 'sprint', hex: h, cost: dist });
    } else if (dist <= moveRange) {
      out.push({ kind: 'move', hex: h, cost: dist });
    }
  }

  // Shoot — show full LOS range; only enemy (or splash aim) is actionable
  if (isReloading(piece) || isDepleted(piece)) {
    return out; // move highlights only while reloading / empty
  }

  const shootRange = stats.shoot + (fromTerrain === 'high' ? 1 : 0);
  const shootMin = stats.shootMin;
  const splash = hasSplash(stats);

  for (let row = 0; row < state.rows; row++) {
    for (let col = 0; col < state.cols; col++) {
      const h = { col, row };
      if (eq(h, from)) continue;
      const d = hexDist(state, from, h);
      if (d > shootRange || d < shootMin) continue;
      const terrain = terrainAt(state, h);
      if (terrain === 'rock') continue; // can't shoot into rock
      // Walls: only rockets can impact (to demolish); bullets treat like blocked aim
      if (terrain === 'wall' && !splash) continue;
      // Splash (bazooka/tank) can't impact on water
      if (splash && terrain === 'water') continue;
      if (!losClear(state, from, h)) continue;

      const target = pieceAt(state, h);
      // Never highlight friendly-occupied tiles as shoot range
      if (target && target.side === piece.side) continue;

      if (splash) {
        // Actionable if blast hits an enemy or a concrete wall
        if (splashHasTarget(state, h, from, piece.side)) {
          out.push({ kind: 'shoot', hex: h });
        } else {
          out.push({ kind: 'shoot-range', hex: h });
        }
      } else if (target && target.side !== piece.side) {
        out.push({ kind: 'shoot', hex: h });
      } else {
        // Visible range only — no thin-air shots for bullets
        out.push({ kind: 'shoot-range', hex: h });
      }
    }
  }

  return out;
}

/** Legal actions for the current turn's piece. */
export function legalHighlights(state: GameState, pieceId: string): Highlight[] {
  if (state.winner) return [];
  const piece = getPiece(state, pieceId);
  if (!piece || piece.side !== state.turn) return [];
  if (state.scoutPieceId && state.scoutPieceId !== pieceId) return [];
  return rangeHighlights(state, pieceId);
}

/** End the current turn even if it isn't a scout skip. */
export function passTurn(state: GameState): GameState {
  const next = cloneState(state);
  if (next.winner) return next;
  next.log.push(`${next.turn} passes`);
  endTurn(next);
  checkWin(next);
  return next;
}

/** If the side to move has nothing to do (or a dangling scout lock), pass. */
export function resolveNoMoves(state: GameState): GameState {
  let s = state;
  let guard = 0;
  while (!s.winner && guard < 4) {
    if (s.scoutPieceId && !getPiece(s, s.scoutPieceId)) {
      s = passTurn(s);
      guard += 1;
      continue;
    }
    if (allLegalActions(s).length > 0) break;
    s = passTurn(s);
    guard += 1;
  }
  return s;
}

export function applyAction(state: GameState, action: Action): GameState {
  const applied = applyActionInner(state, action);
  if (applied === state) return state;
  return resolveNoMoves(applied);
}

function applyActionInner(state: GameState, action: Action): GameState {
  const next = cloneState(state);
  if (next.winner) return next;

  if (action.kind === 'skip') {
    if (next.scoutPieceId) {
      next.log.push(`${next.turn} scout skips remaining action`);
      endTurn(next);
    }
    return next;
  }

  const piece = getPiece(next, action.pieceId);
  if (!piece || piece.side !== next.turn) return state;
  if (next.scoutPieceId && next.scoutPieceId !== piece.id) return state;

  const highlights = legalHighlights(next, piece.id);

  if (action.kind === 'move') {
    const hit = highlights.find(
      (h) =>
        (h.kind === 'move' || h.kind === 'sprint') && eq(h.hex, action.to),
    );
    if (!hit) return state;

    const plan = previewMove(next, piece, action.to);
    const hitBits: string[] = [];
    for (const mh of plan.hits) {
      const victim = getPiece(next, mh.id);
      if (!victim) continue;
      const name = `${victim.side} ${UNIT_STATS[victim.type].name}`;
      applyDamage(next, victim, mh.amount);
      hitBits.push(hpHitLog(name, mh.fatal, mh.remaining));
    }

    const bounced = !eq(plan.stop, action.to);
    const sprintTag = hit.kind === 'sprint' ? ' (sprint)' : '';
    if (hitBits.length) {
      next.log.push(
        `${piece.side} ${UNIT_STATS[piece.type].name} ${
          bounced
            ? 'strikes'
            : plan.hits.some((h) => h.fatal)
              ? 'captures'
              : piece.type === 'tank'
                ? 'overruns'
                : 'hits'
        } ${hitBits.join(', ')}` +
          (bounced
            ? ` — stops ${plan.stop.col},${plan.stop.row}`
            : ` → ${action.to.col},${action.to.row}`) +
          sprintTag,
      );
    } else if (bounced) {
      next.log.push(
        `${piece.side} ${UNIT_STATS[piece.type].name} stops short of ${action.to.col},${action.to.row}${sprintTag}`,
      );
    } else {
      next.log.push(
        `${piece.side} ${UNIT_STATS[piece.type].name} moves to ${action.to.col},${action.to.row}${sprintTag}`,
      );
    }

    piece.col = plan.stop.col;
    piece.row = plan.stop.row;
    if (hit.kind === 'sprint') piece.hasSprint = false;
    if (
      UNIT_STATS[piece.type].moveBudget > 0 &&
      (hit.kind === 'move' || hit.kind === 'sprint')
    ) {
      next.scoutMoveSpent = (next.scoutMoveSpent ?? 0) + hit.cost;
    }

    afterAction(next, piece);
    return next;
  }

  // shoot
  const shootOk = highlights.some((h) => h.kind === 'shoot' && eq(h.hex, action.at));
  if (!shootOk) return state;

  const stats = UNIT_STATS[piece.type];
  if (stats.sprint) piece.hasSprint = false;
  if (stats.ammo > 0) {
    piece.ammo = Math.max(0, (piece.ammo ?? stats.ammo) - 1);
  }
  if (stats.shootCooldown > 0) {
    piece.shootCooldown = stats.shootCooldown;
    piece.firedThisTurn = true;
  }

  if (hasSplash(stats)) {
    const fromHex: Hex = { col: piece.col, row: piece.row };
    const blast = splashBlast(next, action.at, fromHex);
    const hitBits: string[] = [];
    let wallsDown = 0;
    for (const h of blast) {
      const t = pieceAt(next, h);
      // Splash hits everyone in the blast — friendlies included
      if (t && stats.splashDamage > 0) {
        const name = `${t.side === piece.side ? 'friendly ' : ''}${UNIT_STATS[t.type].name}`;
        const dmg = applyDamage(next, t, stats.splashDamage);
        hitBits.push(hpHitLog(name, dmg.fatal, dmg.remaining));
      }
      // Concrete walls crumble under rockets
      if (terrainAt(next, h) === 'wall') {
        next.terrain[h.row][h.col] = 'land';
        wallsDown++;
      }
    }
    if (wallsDown) hitBits.push(`${wallsDown} wall${wallsDown > 1 ? 's' : ''}`);
    next.log.push(
      `${piece.side} ${UNIT_STATS[piece.type].name} fires at ${action.at.col},${action.at.row}` +
        (hitBits.length ? ` — hits ${hitBits.join(' + ')}` : ' — splash misses') +
        (stats.shootCooldown > 0 ? ' — reloading' : '') +
        ammoLog(piece, stats),
    );
  } else {
    const t = pieceAt(next, action.at);
    if (!t || t.side === piece.side) return state;
    const name = `${t.side} ${UNIT_STATS[t.type].name}`;
    const dmg = applyDamage(next, t, stats.shootDamage);
    next.log.push(
      `${piece.side} ${UNIT_STATS[piece.type].name} shoots ${name} at ${action.at.col},${action.at.row}` +
        (dmg.fatal ? '' : ` — ${dmg.remaining} HP`) +
        (stats.shootCooldown > 0 ? ' — reloading' : '') +
        ammoLog(piece, stats),
    );
  }

  afterAction(next, piece);
  return next;
}

/** All legal actions for the current side (for AI). */
export function allLegalActions(state: GameState): Action[] {
  if (state.winner) return [];
  const actions: Action[] = [];
  const pieces =
    state.scoutPieceId
      ? state.pieces.filter((p) => p.id === state.scoutPieceId)
      : state.pieces.filter((p) => p.side === state.turn);

  for (const p of pieces) {
    for (const h of legalHighlights(state, p.id)) {
      if (h.kind === 'move' || h.kind === 'sprint') {
        actions.push({
          kind: 'move',
          pieceId: p.id,
          to: h.hex,
          sprint: h.kind === 'sprint',
        });
      } else if (h.kind === 'shoot') {
        actions.push({ kind: 'shoot', pieceId: p.id, at: h.hex });
      }
      // shoot-range is display-only
    }
  }
  if (state.scoutPieceId && state.scoutActionsLeft) {
    actions.push({ kind: 'skip' });
  }
  return actions;
}
