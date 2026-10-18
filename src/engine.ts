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
import { statsOf, type UnitStats, type UnitType } from './roster';

export {
  DEFAULT_UNIT_STATS,
  KIT_TRAITS,
  SHOOT_ARCS,
  SHOOT_ARC_LABEL,
  STOCK_UNIT_TYPES,
  TRAIT_FIELDS,
  UNIT_CATEGORIES,
  UNIT_CATEGORY_LABEL,
  UNIT_ROLE_LABEL,
  UNIT_STATS,
  UNIT_TYPES,
  isCustomUnitId,
  isKnownUnit,
  isUnitRole,
  roleOf,
  sanitizeShootArc,
  sanitizeUnitCategory,
  statsOf,
  type ShootArc,
  type UnitCategory,
  type UnitRole,
  type UnitStats,
  type UnitTraits,
  type UnitType,
} from './roster';

export type Side = 'red' | 'blue';
export type Terrain = 'land' | 'water' | 'rock' | 'wall' | 'high';

/** Impassable solid terrain (rock permanent, wall rocket-breakable). */
export function isSolidTerrain(t: Terrain): boolean {
  return t === 'rock' || t === 'wall';
}

export type Piece = {
  id: string;
  side: Side;
  type: UnitType;
  col: number;
  row: number;
  /** Turns of shoot cooldown remaining (can't shoot while > 0). */
  shootCooldown?: number;
  /** Fired this turn — cooldown won't tick until the following end-turn. */
  firedThisTurn?: boolean;
  /** Remaining shots when the unit has a finite ammo cap. */
  ammo?: number;
  /** Remaining hitpoints (undefined = full / `UnitStats.hp`). */
  hp?: number;
  /** Remaining stamina (undefined = full / `UnitStats.stamina`). */
  stamina?: number;
  /** Spent stamina already this activation. */
  staminaUsedThisTurn?: boolean;
  /** Walked this activation — idle regen does not tick. */
  movedThisTurn?: boolean;
  /** Own-turn Ends left until +1 stamina can land (grant only while idle). */
  staminaRegenWait?: number;
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
  /** Snapshot at match start. King-kill win only if that side actually fielded one. */
  hadKing: Record<Side, boolean>;
  /** How many pieces this side may activate before the turn ends. Default 1. */
  unitsPerTurn: number;
  /** Piece ids that already finished an activation this side-turn. */
  actedIds: string[];
};

export type Action =
  | { kind: 'move'; pieceId: string; to: Hex }
  | { kind: 'shoot'; pieceId: string; at: Hex }
  | { kind: 'skip' }; // scout skip remaining action

export type Highlight =
  | { kind: 'move'; hex: Hex; cost: number }
  /** Walk that spends 1 stamina (double range and/or climb). */
  | { kind: 'stamina'; hex: Hex; cost: number }
  /** Valid fire target (enemy, or empty for splash). */
  | { kind: 'shoot'; hex: Hex }
  /** In weapon range + LOS, but not a legal shot (empty air / friendly). */
  | { kind: 'shoot-range'; hex: Hex };

/** Ring color for the current armor scale. */
export function armorColor(armor: number): string {
  if (armor >= 2) return '#3dba6a';
  if (armor === 1) return '#e89030';
  if (armor <= -1) return '#8b5cf6';
  return '#dc4646';
}

export function armorOf(piece: Piece): number {
  return statsOf(piece.type).armor;
}

/** Damage after the target's armor. Negative armor increases the hit. Melee uses min 1. */
export function netDamage(piece: Piece, amount: number, min = 0): number {
  return Math.max(min, amount - armorOf(piece));
}

export function hasSplash(stats: UnitStats): boolean {
  return stats.splashDamage > 0;
}

export function isReloading(piece: Piece): boolean {
  return (piece.shootCooldown ?? 0) > 0;
}

/** True when the unit has a finite ammo cap and none left. */
export function isDepleted(piece: Piece): boolean {
  const cap = statsOf(piece.type).ammo;
  if (cap <= 0) return false;
  return (piece.ammo ?? 0) <= 0;
}

/** Remaining shots, or null if ammo is unlimited. */
export function ammoLeft(piece: Piece): number | null {
  const cap = statsOf(piece.type).ammo;
  if (cap <= 0) return null;
  return piece.ammo ?? 0;
}

function ammoLog(piece: Piece, stats: UnitStats): string {
  if (stats.ammo <= 0) return '';
  return (piece.ammo ?? 0) <= 0 ? ' — empty' : ` — ${piece.ammo} ammo`;
}

export function hpMax(piece: Piece): number {
  return statsOf(piece.type).hp;
}

export function hpLeft(piece: Piece): number {
  return piece.hp ?? hpMax(piece);
}

export function staminaMax(piece: Piece): number {
  return statsOf(piece.type).stamina;
}

export function staminaLeft(piece: Piece): number {
  const max = staminaMax(piece);
  if (max <= 0) return 0;
  return piece.stamina ?? max;
}

export function canSpendStamina(piece: Piece): boolean {
  return staminaLeft(piece) > 0 && !piece.staminaUsedThisTurn;
}

function spendStamina(piece: Piece): void {
  const max = staminaMax(piece);
  if (max <= 0) return;
  piece.stamina = Math.max(0, staminaLeft(piece) - 1);
  piece.staminaUsedThisTurn = true;
  restartStaminaWait(piece);
}

/** Moving while below max restarts the idle countdown. */
function markMoved(piece: Piece): void {
  piece.movedThisTurn = true;
  if (staminaLeft(piece) < staminaMax(piece)) restartStaminaWait(piece);
}

function restartStaminaWait(piece: Piece): void {
  const regen = statsOf(piece.type).staminaRegen;
  if (regen > 0 && staminaLeft(piece) < staminaMax(piece)) {
    piece.staminaRegenWait = regen;
  }
}

function hpOf(piece: Piece, hpMap?: Map<string, number>): number {
  return hpMap?.get(piece.id) ?? hpLeft(piece);
}

function applyDamage(
  state: GameState,
  victim: Piece,
  amount: number,
  min = 0,
): { fatal: boolean; remaining: number } {
  const remaining = Math.max(0, hpLeft(victim) - netDamage(victim, amount, min));
  victim.hp = remaining;
  if (remaining <= 0) {
    state.pieces = state.pieces.filter((p) => p.id !== victim.id);
    return { fatal: true, remaining: 0 };
  }
  return { fatal: false, remaining };
}

function escLog(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function unitLog(piece: Piece): string {
  return `<span class="log-side ${piece.side}">${escLog(statsOf(piece.type).name)}</span>`;
}

function sideLog(side: Side, label: string): string {
  return `<span class="log-side ${side}">${escLog(label)}</span>`;
}

function hpBit(victim: Piece, fatal: boolean, remaining: number): string {
  return fatal ? `${unitLog(victim)} killed` : `${unitLog(victim)} (${remaining} HP)`;
}

/** net = attack − shield; negative shield adds damage. Melee floors at 1. */
function dmgLine(victim: Piece, amount: number, min = 0): string {
  const shield = armorOf(victim);
  const net = netDamage(victim, amount, min);
  return `<span class="log-dmg">DMG: ${net} (attack ${amount} - shield ${shield})</span>`;
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
  const stats = statsOf(piece.type);
  let moveRange = stats.move;
  if (stats.actions > 1 && stats.moveBudget > 0) {
    const spent =
      state.scoutPieceId === piece.id ? (state.scoutMoveSpent ?? 0) : 0;
    moveRange = Math.min(stats.move, Math.max(0, stats.moveBudget - spent));
  }
  return moveRange;
}

function effectiveMoveRange(state: GameState, piece: Piece): number {
  const base = activationMoveRange(state, piece);
  return canSpendStamina(piece) ? base * 2 : base;
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
  const melee = Math.max(0, statsOf(piece.type).meleeDamage);
  const path =
    pathTo(from, to, {
      ...movePathOpts(state, piece),
      maxDist: Math.max(1, effectiveMoveRange(state, piece)),
    }) ?? (eq(from, to) ? [] : [to]);

  const hpMap = new Map(state.pieces.map((p) => [p.id, hpLeft(p)]));
  const hits: MoveHit[] = [];
  let stop = to;

  const strike = (victim: Piece): boolean => {
    if (melee <= 0) return false;
    const nextHp = hpOf(victim, hpMap) - netDamage(victim, melee, 1);
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
    const overrun =
      statsOf(piece.type).overrun && statsOf(occ.type).infantry && !isDest;
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

function losClear(state: GameState, from: Hex, to: Hex, overUnits: boolean): boolean {
  const cells = line(from, to, state.orientation);
  const fromHigh = terrainAt(state, from) === 'high';
  // Rock/wall always block. High blocks through-LOS only when shooting from low.
  // From high: shoot along/over the ridge (intermediate high ignored) and over pieces.
  // Arch: fire over units even from low. Terrain LOS unchanged.
  // Destination may be high / occupied / wall — you can shoot *onto* it.
  for (let i = 0; i < cells.length - 1; i++) {
    const h = cells[i];
    const t = terrainAt(state, h);
    if (isSolidTerrain(t)) return false;
    if (!fromHigh && t === 'high') return false;
    if (!fromHigh && !overUnits && pieceAt(state, h)) return false;
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

export const MIN_UNITS_PER_TURN = 1;
export const MAX_UNITS_PER_TURN = 12;

export function clampUnitsPerTurn(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 1;
  return Math.max(MIN_UNITS_PER_TURN, Math.min(MAX_UNITS_PER_TURN, Math.floor(v)));
}

export function hasActed(state: GameState, id: string): boolean {
  return state.actedIds.includes(id);
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    terrain: state.terrain.map((r) => [...r]),
    pieces: state.pieces.map((p) => ({ ...p })),
    log: [...state.log],
    actedIds: [...state.actedIds],
  };
}

function other(side: Side): Side {
  return side === 'red' ? 'blue' : 'red';
}

/**
 * Every own-turn End advances the countdown. Walking resets it to `regen`
 * (this End still counts, so remaining is regen-1). Only an idle End can
 * actually grant — otherwise spend/walk + regen 1 would refill the same turn.
 */
function tickStamina(state: GameState, side: Side): void {
  for (const p of state.pieces) {
    if (p.side !== side) continue;
    const moved = !!p.movedThisTurn;
    p.movedThisTurn = false;
    p.staminaUsedThisTurn = false;
    const max = staminaMax(p);
    const regen = statsOf(p.type).staminaRegen;
    if (max <= 0 || regen <= 0) continue;
    if (staminaLeft(p) >= max) {
      p.staminaRegenWait = undefined;
      continue;
    }
    const wait = (p.staminaRegenWait ?? regen) - 1;
    if (!moved && wait <= 0) {
      p.stamina = Math.min(max, staminaLeft(p) + 1);
      p.staminaRegenWait = staminaLeft(p) < max ? regen : undefined;
    } else {
      p.staminaRegenWait = Math.max(0, wait);
    }
  }
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

function clearScoutLock(state: GameState): void {
  state.scoutActionsLeft = null;
  state.scoutPieceId = null;
  state.scoutMoveSpent = null;
}

function endSideTurn(state: GameState): void {
  const finished = state.turn;
  clearScoutLock(state);
  tickShootCooldowns(state, finished);
  tickStamina(state, finished);
  state.actedIds = [];
  state.turn = other(state.turn);
}

/** Finish this piece's activation; end the side-turn if the unit quota is spent. */
function finishActivation(state: GameState, piece: Piece): void {
  clearScoutLock(state);
  if (!state.actedIds.includes(piece.id)) state.actedIds.push(piece.id);
  const cap = clampUnitsPerTurn(state.unitsPerTurn);
  const more =
    state.actedIds.length < cap &&
    state.pieces.some((p) => p.side === state.turn && !state.actedIds.includes(p.id));
  if (!more) endSideTurn(state);
  checkWin(state);
}

function hasKing(pieces: Piece[], side: Side): boolean {
  return pieces.some((p) => p.side === side && statsOf(p.type).king);
}

function sideDefeated(state: GameState, side: Side): boolean {
  const mine = state.pieces.filter((p) => p.side === side);
  if (mine.length === 0) return true;
  if (state.hadKing[side] && !hasKing(mine, side)) return true;
  return false;
}

/** Why the loser is out: no pieces left, or their fielded king was killed. */
export function defeatKind(state: GameState, loser: Side): 'wipeout' | 'king' {
  if (!state.pieces.some((p) => p.side === loser)) return 'wipeout';
  return 'king';
}

function checkWin(state: GameState): void {
  const redOut = sideDefeated(state, 'red');
  const blueOut = sideDefeated(state, 'blue');
  if (redOut && !blueOut) state.winner = 'blue';
  else if (blueOut && !redOut) state.winner = 'red';
  else if (redOut && blueOut) state.winner = other(state.turn);
}

function afterAction(state: GameState, piece: Piece): void {
  const stats = statsOf(piece.type);
  // Stamina spend burns leftover actions (scout second action, etc.).
  if (piece.staminaUsedThisTurn && stats.actions > 1) {
    finishActivation(state, piece);
    return;
  }
  if (stats.actions > 1 && state.scoutPieceId === piece.id) {
    state.scoutActionsLeft = (state.scoutActionsLeft ?? stats.actions) - 1;
    if (state.scoutActionsLeft <= 0) finishActivation(state, piece);
    else checkWin(state);
    return;
  }
  if (stats.actions > 1 && state.scoutPieceId === null) {
    state.scoutPieceId = piece.id;
    state.scoutActionsLeft = stats.actions - 1;
    if (state.scoutActionsLeft <= 0) finishActivation(state, piece);
    else checkWin(state);
    return;
  }
  finishActivation(state, piece);
}

/** Path rules for a piece (shared by highlights + overrun resolution). */
function movePathOpts(state: GameState, piece: Piece): Omit<PathOpts, 'maxDist'> {
  const stats = statsOf(piece.type);
  const fromTerrain = terrainAt(state, { col: piece.col, row: piece.row });
  const climbOk = fromTerrain === 'high' || canSpendStamina(piece);
  const highOk = (t: Terrain) => t !== 'high' || climbOk;
  return {
    cols: state.cols,
    rows: state.rows,
    orientation: state.orientation,
    canStop: (h: Hex) => {
      if (!inBounds(state, h)) return false;
      const t = terrainAt(state, h);
      // Nobody ends on water/rock/wall (water-walkers only *pass through*)
      if (t === 'water' || isSolidTerrain(t)) return false;
      if (stats.noHigh && t === 'high') return false;
      if (!highOk(t)) return false;
      const occ = pieceAt(state, h);
      if (!occ) return true;
      return occ.side !== piece.side; // capture enemy
    },
    canPass: (h: Hex) => {
      if (!inBounds(state, h)) return false;
      const t = terrainAt(state, h);
      if (isSolidTerrain(t)) return false;
      if (stats.noHigh && t === 'high') return false;
      if (!highOk(t)) return false;
      if (t === 'water' && !stats.passWater) return false;
      if (stats.passUnits) return true;
      const occ = pieceAt(state, h);
      if (!occ) return true;
      if (stats.overrun) {
        return occ.side !== piece.side && statsOf(occ.type).infantry;
      }
      return occ.side === piece.side;
    },
  };
}

/** Move/shoot range for a piece (ignores whose turn it is). */
export function rangeHighlights(state: GameState, pieceId: string): Highlight[] {
  const piece = getPiece(state, pieceId);
  if (!piece) return [];

  const stats = statsOf(piece.type);
  const from: Hex = { col: piece.col, row: piece.row };
  const out: Highlight[] = [];

  const baseRange = activationMoveRange(state, piece);
  const moveRange = effectiveMoveRange(state, piece);
  const fromTerrain = terrainAt(state, from);
  const pathOpts = { ...movePathOpts(state, piece), maxDist: moveRange };
  const reach = reachable(from, pathOpts);

  for (const [k, dist] of reach) {
    const h = parseKey(k);
    const doubled = dist > baseRange;
    const path = pathTo(from, h, pathOpts);
    const climbs =
      fromTerrain !== 'high' &&
      (terrainAt(state, h) === 'high' ||
        (path?.some((p) => terrainAt(state, p) === 'high') ?? false));
    if (climbs || doubled) {
      out.push({ kind: 'stamina', hex: h, cost: dist });
    } else {
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
      if (!losClear(state, from, h, stats.shootArc === 'arch')) continue;

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
  if (hasActed(state, pieceId)) return [];
  if (
    !state.scoutPieceId &&
    state.actedIds.length >= clampUnitsPerTurn(state.unitsPerTurn)
  ) {
    return [];
  }
  return rangeHighlights(state, pieceId);
}

/** End the current side-turn (skip leftover units / scout lock). */
export function passTurn(state: GameState): GameState {
  const next = cloneState(state);
  if (next.winner) return next;
  next.log.push(sideLog(next.turn, 'End turn'));
  endSideTurn(next);
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
      const scout = getPiece(next, next.scoutPieceId);
      next.log.push(
        `${scout ? unitLog(scout) : sideLog(next.turn, 'Scout')} skips remaining action`,
      );
      if (scout) finishActivation(next, scout);
      else {
        clearScoutLock(next);
        checkWin(next);
      }
    }
    return next;
  }

  const piece = getPiece(next, action.pieceId);
  if (!piece || piece.side !== next.turn) return state;
  if (next.scoutPieceId && next.scoutPieceId !== piece.id) return state;
  if (hasActed(next, piece.id)) return state;

  const highlights = legalHighlights(next, piece.id);

  if (action.kind === 'move') {
    const hit = highlights.find(
      (h) => (h.kind === 'move' || h.kind === 'stamina') && eq(h.hex, action.to),
    );
    if (!hit || (hit.kind !== 'move' && hit.kind !== 'stamina')) return state;

    const plan = previewMove(next, piece, action.to);
    const hitBits: string[] = [];
    const dmgLines: string[] = [];
    for (const mh of plan.hits) {
      const victim = getPiece(next, mh.id);
      if (!victim) continue;
      applyDamage(next, victim, mh.amount, 1);
      hitBits.push(hpBit(victim, mh.fatal, mh.remaining));
      dmgLines.push(dmgLine(victim, mh.amount, 1));
    }

    const bounced = !eq(plan.stop, action.to);
    const staminaTag = hit.kind === 'stamina' ? ' (stamina)' : '';
    if (hitBits.length) {
      next.log.push(
        `${unitLog(piece)} ${
          bounced
            ? 'strikes'
            : plan.hits.some((h) => h.fatal)
              ? 'captures'
              : statsOf(piece.type).overrun
                ? 'overruns'
                : 'hits'
        } ${hitBits.join(', ')}` +
          (bounced
            ? ` — stops ${plan.stop.col},${plan.stop.row}`
            : ` → ${action.to.col},${action.to.row}`) +
          staminaTag +
          dmgLines.join(''),
      );
    } else if (bounced) {
      next.log.push(
        `${unitLog(piece)} stops short of ${action.to.col},${action.to.row}${staminaTag}`,
      );
    } else {
      next.log.push(
        `${unitLog(piece)} moves to ${action.to.col},${action.to.row}${staminaTag}`,
      );
    }

    piece.col = plan.stop.col;
    piece.row = plan.stop.row;
    if (hit.kind === 'stamina') spendStamina(piece);
    markMoved(piece);
    if (statsOf(piece.type).moveBudget > 0) {
      next.scoutMoveSpent = (next.scoutMoveSpent ?? 0) + hit.cost;
    }

    afterAction(next, piece);
    return next;
  }

  // shoot
  const shootOk = highlights.some((h) => h.kind === 'shoot' && eq(h.hex, action.at));
  if (!shootOk) return state;

  const stats = statsOf(piece.type);
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
    const dmgLines: string[] = [];
    let wallsDown = 0;
    for (const h of blast) {
      const t = pieceAt(next, h);
      // Splash hits everyone in the blast — friendlies included
      if (t && stats.splashDamage > 0) {
        const dmg = applyDamage(next, t, stats.splashDamage);
        hitBits.push(hpBit(t, dmg.fatal, dmg.remaining));
        dmgLines.push(dmgLine(t, stats.splashDamage));
      }
      // Concrete walls crumble under rockets
      if (terrainAt(next, h) === 'wall') {
        next.terrain[h.row][h.col] = 'land';
        wallsDown++;
      }
    }
    if (wallsDown) hitBits.push(`${wallsDown} wall${wallsDown > 1 ? 's' : ''}`);
    next.log.push(
      `${unitLog(piece)} fires at ${action.at.col},${action.at.row}` +
        (hitBits.length ? ` — hits ${hitBits.join(' + ')}` : ' — splash misses') +
        (stats.shootCooldown > 0 ? ' — reloading' : '') +
        ammoLog(piece, stats) +
        dmgLines.join(''),
    );
  } else {
    const t = pieceAt(next, action.at);
    if (!t || t.side === piece.side) return state;
    const dmg = applyDamage(next, t, stats.shootDamage);
    next.log.push(
      `${unitLog(piece)} shoots ${unitLog(t)} at ${action.at.col},${action.at.row}` +
        (dmg.fatal ? ' — killed' : ` — ${dmg.remaining} HP`) +
        (stats.shootCooldown > 0 ? ' — reloading' : '') +
        ammoLog(piece, stats) +
        dmgLine(t, stats.shootDamage),
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
      : state.pieces.filter((p) => p.side === state.turn && !hasActed(state, p.id));

  for (const p of pieces) {
    for (const h of legalHighlights(state, p.id)) {
      if (h.kind === 'move' || h.kind === 'stamina') {
        actions.push({
          kind: 'move',
          pieceId: p.id,
          to: h.hex,
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
