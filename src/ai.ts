/**
 * Greedy AI:
 * - Army: capture value + approach enemy general
 * - Own general: flee the enemy army; only attack if no non-attack option
 */

import {
  allLegalActions,
  applyAction,
  getPiece,
  hpLeft,
  pieceAt,
  previewMove,
  UNIT_STATS,
  type Action,
  type GameState,
  type Side,
} from './engine';
import { distance, type Hex } from './hex';

function dist(state: GameState, a: Hex, b: Hex): number {
  return distance(a, b, state.orientation);
}

/** Enemy within this distance → general must prioritize fleeing. */
const GEN_THREAT_RANGE = 3;

function enemyGeneral(state: GameState, me: Side) {
  return state.pieces.find((p) => p.side !== me && p.type === 'general');
}

function myGeneral(state: GameState, me: Side) {
  return state.pieces.find((p) => p.side === me && p.type === 'general');
}

function minEnemyDist(state: GameState, hex: Hex, me: Side): number {
  let min = Infinity;
  for (const p of state.pieces) {
    if (p.side === me) continue;
    min = Math.min(min, dist(state, hex, { col: p.col, row: p.row }));
  }
  return min === Infinity ? 99 : min;
}

/** Sum of capped distances — higher = farther from the pack. */
function packClearance(state: GameState, hex: Hex, me: Side): number {
  let sum = 0;
  for (const p of state.pieces) {
    if (p.side === me) continue;
    sum += Math.min(dist(state, hex, { col: p.col, row: p.row }), 8);
  }
  return sum;
}

function isAttackAction(state: GameState, action: Action, me: Side): boolean {
  if (action.kind === 'shoot') return true;
  if (action.kind === 'move') {
    const v = pieceAt(state, action.to);
    return !!(v && v.side !== me);
  }
  return false;
}

function generalThreatened(state: GameState, me: Side): boolean {
  const g = myGeneral(state, me);
  if (!g) return false;
  return minEnemyDist(state, { col: g.col, row: g.row }, me) <= GEN_THREAT_RANGE;
}

function scoreKillDelta(state: GameState, after: GameState, me: Side): number {
  let score = 0;
  const removed = state.pieces.filter((p) => !after.pieces.some((q) => q.id === p.id));
  for (const k of removed) {
    const v = UNIT_STATS[k.type].value * 20;
    if (k.side !== me) {
      score += v;
      if (k.type === 'general') score += 10_000;
    } else {
      score -= v * 1.4;
      if (k.type === 'general') score -= 10_000;
    }
  }
  for (const p of state.pieces) {
    const q = after.pieces.find((x) => x.id === p.id);
    if (!q) continue;
    const dmg = hpLeft(p) - hpLeft(q);
    if (dmg <= 0) continue;
    const v = UNIT_STATS[p.type].value * 8 * dmg;
    score += p.side !== me ? v : -v * 1.4;
  }
  if (after.winner === me) score += 50_000;
  if (after.winner && after.winner !== me) score -= 50_000;
  return score;
}

/** Flee scoring: maximize distance from enemies; attacks only if no flee/move left. */
function scoreGeneralAction(state: GameState, action: Action, me: Side): number {
  if (action.kind === 'skip') return -100;

  const piece = getPiece(state, action.pieceId);
  if (!piece) return -Infinity;

  const from: Hex = { col: piece.col, row: piece.row };
  const genActs = allLegalActions(state).filter(
    (a) => a.kind !== 'skip' && a.pieceId === piece.id,
  );
  const hasNonAttack = genActs.some((a) => !isAttackAction(state, a, me));
  const attacking = isAttackAction(state, action, me);

  if (attacking) {
    // Only fight when every other general option is also an attack
    if (hasNonAttack) return -20_000;
    const after = applyAction(state, action);
    return scoreKillDelta(state, after, me) + Math.random() * 0.3;
  }

  if (action.kind !== 'move') return -Infinity;

  const stop = previewMove(state, piece, action.to).stop;
  const beforeMin = minEnemyDist(state, from, me);
  const afterMin = minEnemyDist(state, stop, me);
  const beforePack = packClearance(state, from, me);
  const afterPack = packClearance(state, stop, me);

  let score = (afterMin - beforeMin) * 100;
  score += (afterPack - beforePack) * 4;

  // Strongly prefer opening distance; punish walking into the army
  if (afterMin > beforeMin) score += 500;
  else if (afterMin < beforeMin) score -= 800;

  score += Math.random() * 0.3;
  return score;
}

function scoreArmyAction(state: GameState, action: Action, me: Side): number {
  if (action.kind === 'skip') return -5;

  const piece = getPiece(state, action.pieceId);
  if (!piece) return -Infinity;

  const gen = enemyGeneral(state, me);
  let score = scoreKillDelta(state, applyAction(state, action), me);

  if (action.kind === 'move' && gen) {
    const beforeDist = dist(
      state,
      { col: piece.col, row: piece.row },
      { col: gen.col, row: gen.row },
    );
    const afterDist = dist(
      state,
      previewMove(state, piece, action.to).stop,
      { col: gen.col, row: gen.row },
    );
    score += (beforeDist - afterDist) * 3;

    if (piece.type === 'tank' || piece.type === 'bazooka' || piece.type === 'sniper') {
      score += (beforeDist - afterDist) * 2;
    }

    const victim = pieceAt(state, action.to);
    if (victim && victim.side !== me) {
      score += UNIT_STATS[victim.type].value * 20;
    }
  }

  if (action.kind === 'shoot' && gen) {
    const d = dist(state, action.at, { col: gen.col, row: gen.row });
    score += Math.max(0, 8 - d);

    const target = pieceAt(state, action.at);
    if (target && target.side !== me) {
      score += UNIT_STATS[target.type].value * 18;
    }
  }

  score += UNIT_STATS[piece.type].value * 0.05;
  score += Math.random() * 0.3;
  return score;
}

function scoreAction(state: GameState, action: Action, me: Side): number {
  if (action.kind === 'skip') return -5;
  const piece = getPiece(state, action.pieceId);
  if (!piece) return -Infinity;
  if (piece.type === 'general') return scoreGeneralAction(state, action, me);
  return scoreArmyAction(state, action, me);
}

function pickBest(actions: Action[], state: GameState, me: Side): Action {
  let best = actions[0];
  let bestScore = -Infinity;
  for (const a of actions) {
    const s = scoreAction(state, a, me);
    if (s > bestScore) {
      bestScore = s;
      best = a;
    }
  }
  return best;
}

export function pickAiAction(state: GameState): Action | null {
  const me = state.turn;
  const actions = allLegalActions(state);
  if (!actions.length) return null;

  const g = myGeneral(state, me);

  // Threatened general: only consider their flee moves (or forced attacks)
  if (g && generalThreatened(state, me)) {
    const genActs = actions.filter((a) => a.kind !== 'skip' && a.pieceId === g.id);
    if (genActs.length) {
      const flee = genActs.filter((a) => !isAttackAction(state, a, me));
      return pickBest(flee.length ? flee : genActs, state, me);
    }
  }

  return pickBest(actions, state, me);
}

/** Play AI until it's the human's turn again (handles scout double-action). */
export function runAiTurn(state: GameState, aiSide: Side): GameState {
  let s = state;
  let guard = 0;
  while (s.turn === aiSide && !s.winner && guard < 8) {
    const action = pickAiAction(s);
    if (!action) break;
    s = applyAction(s, action);
    guard += 1;
  }
  return s;
}
