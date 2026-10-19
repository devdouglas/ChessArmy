/**
 * Aggressive AI: if anyone can shoot or melee, they do.
 * Otherwise close on the enemy general (else nearest enemy). No fleeing.
 */

import {
  allLegalActions,
  applyAction,
  getPiece,
  hasAbility,
  hpLeft,
  pieceAt,
  previewMove,
  terrainAt,
  UNIT_STATS,
  type Action,
  type GameState,
  type Side,
} from './engine';
import { distance, type Hex } from './hex';

function dist(state: GameState, a: Hex, b: Hex): number {
  return distance(a, b, state.orientation);
}

function enemyGeneral(state: GameState, me: Side, from: Hex) {
  let best: (typeof state.pieces)[number] | null = null;
  let bestD = Infinity;
  for (const p of state.pieces) {
    if (p.side === me || !hasAbility(p, 'general')) continue;
    const d = dist(state, from, { col: p.col, row: p.row });
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function huntHex(state: GameState, from: Hex, me: Side): Hex | null {
  const gen = enemyGeneral(state, me, from);
  if (gen) return { col: gen.col, row: gen.row };
  let best: Hex | null = null;
  let bestD = Infinity;
  for (const p of state.pieces) {
    if (p.side === me) continue;
    const h = { col: p.col, row: p.row };
    const d = dist(state, from, h);
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}

function isAttackAction(state: GameState, action: Action, me: Side): boolean {
  if (action.kind === 'shoot') return true;
  if (action.kind === 'move') {
    const piece = getPiece(state, action.pieceId);
    if (!piece) return false;
    const plan = previewMove(state, piece, action.to);
    if (plan.hits.some((h) => {
      const v = getPiece(state, h.id);
      return !!v && v.side !== me;
    })) {
      return true;
    }
    const v = pieceAt(state, plan.stop);
    return !!(v && v.side !== me);
  }
  return false;
}

function scoreKillDelta(state: GameState, after: GameState, me: Side): number {
  let score = 0;
  const removed = state.pieces.filter((p) => !after.pieces.some((q) => q.id === p.id));
  for (const k of removed) {
    const v = UNIT_STATS[k.type].value * 24;
    if (k.side !== me) {
      score += v;
      if (hasAbility(k, 'general')) score += 10_000;
    } else {
      score -= v * 0.5;
      if (hasAbility(k, 'general')) score -= 10_000;
    }
  }
  for (const p of state.pieces) {
    const q = after.pieces.find((x) => x.id === p.id);
    if (!q) continue;
    const dmg = hpLeft(p) - hpLeft(q);
    if (dmg <= 0) continue;
    const v = UNIT_STATS[p.type].value * 10 * dmg;
    score += p.side !== me ? v : -v * 0.5;
  }
  if (after.winner === me) score += 50_000;
  if (after.winner && after.winner !== me) score -= 50_000;
  return score;
}

function scoreAction(state: GameState, action: Action, me: Side): number {
  if (action.kind === 'skip') return -80;

  const piece = getPiece(state, action.pieceId);
  if (!piece) return -Infinity;

  const from: Hex = { col: piece.col, row: piece.row };
  let score = scoreKillDelta(state, applyAction(state, action), me);

  if (isAttackAction(state, action, me)) {
    score += 4_000;
    if (action.kind === 'shoot') {
      const t = pieceAt(state, action.at);
      if (t && t.side !== me) score += UNIT_STATS[t.type].value * 22;
    }
    score += Math.random() * 0.3;
    return score;
  }

  if (action.kind !== 'move') return score;

  const stop = previewMove(state, piece, action.to).stop;
  const hunt = huntHex(state, from, me);
  if (hunt) {
    const closer = dist(state, from, hunt) - dist(state, stop, hunt);
    score += closer * 80;
    if (closer > 0) score += 300;
    else if (closer < 0) score -= 900;
  }

  const fromHigh = terrainAt(state, from) === 'high';
  const toHigh = terrainAt(state, stop) === 'high';
  if (toHigh && !fromHigh) score += 40;
  if (fromHigh && !toHigh) score -= 20;

  score += UNIT_STATS[piece.type].value * 0.05;
  score += Math.random() * 0.3;
  return score;
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

  const attacks = actions.filter((a) => isAttackAction(state, a, me));
  if (attacks.length) return pickBest(attacks, state, me);
  return pickBest(actions, state, me);
}

/** Play AI until it's the human's turn again (handles scout double-action). */
export function runAiTurn(state: GameState, aiSide: Side): GameState {
  let s = state;
  let guard = 0;
  while (s.turn === aiSide && !s.winner && guard < 64) {
    const action = pickAiAction(s);
    if (!action) break;
    s = applyAction(s, action);
    guard += 1;
  }
  return s;
}
