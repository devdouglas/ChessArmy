/**
 * AI picker. Every behaviour is a checklist rule (ai-config) on aggressive /
 * defensive. Default style is aggressive; stock checklist has every rule on,
 * which is this original ruleset:
 * If anyone can shoot or melee, they do.
 * Otherwise close on the enemy general (else nearest enemy). No fleeing.
 * Pikes: don't walk onto them unless that move attacks the enemy general.
 * Do-not-touch tokens: never walk that hex (invalid path).
 * Own general: never attacks the army except the enemy general, or a unit
 * already in melee with him (adjacent, meleeDamage > 0).
 * Activate the general last — other pieces act first unless only the king can.
 * Flags: never capture. Guard owned flags like the king (close on them);
 * enemy / free flags mean nothing.
 * Hoplites: hold and rotate toward the nearest enemy. A ranged hit makes them
 * step forward and try to attack; then they go back to holding.
 * Targets defenses: rocket or melee a wall/palisade on the path to the hunt.
 */

import {
  allLegalActions,
  applyAction,
  facingOf,
  getPiece,
  hasAbility,
  hasSplash,
  hpLeft,
  isHostile,
  pathForMove,
  pieceAt,
  previewMove,
  roleOf,
  sameTeam,
  splashBlast,
  splashHitsEnemy,
  terrainAt,
  terrainHeight,
  tokenAt,
  UNIT_STATS,
  isNoTouch,
  hexDamageOn,
  hexDamagePushHits,
  isBlockedWalk,
  type Action,
  aiStyleOf,
  type GameState,
  type Piece,
  type Side,
} from './engine';
import { distance, eq, line, neighborInDir, pathTo, type Hex, type HexDir } from './hex';
import { isAiRuleOn, type AiRuleId } from './ai-config';

type RuleOn = (id: AiRuleId) => boolean;

function rulesFor(state: GameState): RuleOn {
  const style = aiStyleOf(state, state.turn);
  return (id) => isAiRuleOn(style, id);
}

function dist(state: GameState, a: Hex, b: Hex): number {
  return distance(a, b, state.orientation);
}

function isHoplite(piece: Piece): boolean {
  return roleOf(piece.type) === 'hoplite';
}

function nearestEnemy(state: GameState, from: Hex, me: Side): Piece | null {
  let best: Piece | null = null;
  let bestD = Infinity;
  for (const p of state.pieces) {
    if (!isHostile(state, p.side, me)) continue;
    const d = dist(state, from, { col: p.col, row: p.row });
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/** Cube dir whose neighbor is closest to `to`. */
function faceToward(state: GameState, from: Hex, to: Hex): HexDir | null {
  if (eq(from, to)) return null;
  let best: HexDir | null = null;
  let bestD = Infinity;
  for (let d = 0; d < 6; d++) {
    const dir = d as HexDir;
    const n = neighborInDir(from, dir, state.orientation);
    const dd = dist(state, n, to);
    if (dd < bestD) {
      bestD = dd;
      best = dir;
    }
  }
  return best;
}

function enemyGeneral(state: GameState, me: Side, from: Hex) {
  let best: (typeof state.pieces)[number] | null = null;
  let bestD = Infinity;
  for (const p of state.pieces) {
    if (!isHostile(state, p.side, me) || !hasAbility(p, 'general')) continue;
    const d = dist(state, from, { col: p.col, row: p.row });
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function huntHex(state: GameState, from: Hex, me: Side, on: RuleOn): Hex | null {
  if (on('guard-owned-flags')) {
    const ours = (state.tokens ?? []).filter(
      (t) => t.type === 'flag' && t.owner && sameTeam(state, t.owner, me),
    );
    if (ours.length) {
      let best = ours[0];
      let bestD = Infinity;
      for (const f of ours) {
        const d = dist(state, from, { col: f.col, row: f.row });
        if (d < bestD) {
          bestD = d;
          best = f;
        }
      }
      return { col: best.col, row: best.row };
    }
  }
  if (on('hunt-enemy-general')) {
    const gen = enemyGeneral(state, me, from);
    if (gen) return { col: gen.col, row: gen.row };
  }
  let best: Hex | null = null;
  let bestD = Infinity;
  for (const p of state.pieces) {
    if (!isHostile(state, p.side, me)) continue;
    const h = { col: p.col, row: p.row };
    const d = dist(state, from, h);
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}

function inBoard(state: GameState, h: Hex): boolean {
  return h.col >= 0 && h.row >= 0 && h.col < state.cols && h.row < state.rows;
}

/** Walk to hunt as if walls/palisades were open. Those hexes are the blocking defenses. */
function ghostPathToHunt(state: GameState, from: Hex, hunt: Hex): Hex[] {
  if (eq(from, hunt)) return [];
  const found = pathTo(from, hunt, {
    cols: state.cols,
    rows: state.rows,
    maxDist: state.cols * state.rows,
    orientation: state.orientation,
    canStop: (h) => {
      if (!inBoard(state, h)) return false;
      if (eq(h, hunt)) return true;
      const t = terrainAt(state, h);
      return !(t === 'rock' && !isBlockedWalk(state, h));
    },
    canPass: (h) => {
      if (!inBoard(state, h) || eq(h, hunt)) return false;
      const t = terrainAt(state, h);
      return !(t === 'rock' && !isBlockedWalk(state, h));
    },
  });
  return found ?? line(from, hunt, state.orientation);
}

function blockingDefenses(state: GameState, from: Hex, hunt: Hex): Hex[] {
  return ghostPathToHunt(state, from, hunt).filter(
    (h) => isBlockedWalk(state, h) && !eq(h, hunt),
  );
}

function actionHitsDefenseHex(state: GameState, action: Action, hex: Hex): boolean {
  if (action.kind === 'shoot') {
    const piece = getPiece(state, action.pieceId);
    if (!piece) return false;
    const from: Hex = { col: piece.col, row: piece.row };
    if (hasSplash(UNIT_STATS[piece.type])) {
      return splashBlast(state, action.at, from).some((h) => eq(h, hex));
    }
    return eq(action.at, hex);
  }
  if (action.kind !== 'move') return false;
  const piece = getPiece(state, action.pieceId);
  if (!piece) return false;
  return previewMove(state, piece, action.to).palisadeHits.some((ph) => eq(ph.hex, hex));
}

function isDefenseOnlyShot(state: GameState, action: Action, me: Side): boolean {
  if (action.kind !== 'shoot' || shootHitsEnemy(state, action, me)) return false;
  const piece = getPiece(state, action.pieceId);
  if (!piece || !hasSplash(UNIT_STATS[piece.type])) return false;
  const from: Hex = { col: piece.col, row: piece.row };
  return splashBlast(state, action.at, from).some((h) => isBlockedWalk(state, h));
}

function shootHitsEnemy(state: GameState, action: Action, me: Side): boolean {
  if (action.kind !== 'shoot') return false;
  const piece = getPiece(state, action.pieceId);
  if (!piece) return false;
  const from: Hex = { col: piece.col, row: piece.row };
  if (hasSplash(UNIT_STATS[piece.type])) {
    return splashHitsEnemy(state, action.at, from, me);
  }
  const t = pieceAt(state, action.at);
  return !!(t && isHostile(state, t.side, me));
}

function isAttackAction(state: GameState, action: Action, me: Side): boolean {
  if (action.kind === 'shoot') return shootHitsEnemy(state, action, me);
  if (action.kind === 'move') {
    const piece = getPiece(state, action.pieceId);
    if (!piece) return false;
    const plan = previewMove(state, piece, action.to);
    if (plan.hits.some((h) => {
      const v = getPiece(state, h.id);
      return !!v && isHostile(state, v.side, me);
    })) {
      return true;
    }
    const v = pieceAt(state, plan.stop);
    if (v && isHostile(state, v.side, me)) return true;
    return hexDamagePushHits(state, piece, {
      col: plan.stop.col,
      row: plan.stop.row,
      facing: plan.facing,
    }).some((t) => isHostile(state, t.side, me));
  }
  if (action.kind === 'rotate') {
    const piece = getPiece(state, action.pieceId);
    if (!piece) return false;
    return hexDamagePushHits(state, piece, {
      col: piece.col,
      row: piece.row,
      facing: action.dir,
    }).some((t) => isHostile(state, t.side, me));
  }
  return false;
}

function isEnemyGeneral(state: GameState, piece: Piece | undefined, me: Side): boolean {
  return !!piece && isHostile(state, piece.side, me) && hasAbility(piece, 'general');
}

/** Shoot or walk that actually hits an enemy general this action. */
function attacksEnemyGeneral(state: GameState, action: Action, me: Side): boolean {
  if (action.kind === 'skip') return false;
  const piece = getPiece(state, action.pieceId);
  if (!piece) return false;
  if (action.kind === 'shoot') {
    if (!shootHitsEnemy(state, action, me)) return false;
    const from: Hex = { col: piece.col, row: piece.row };
    if (hasSplash(UNIT_STATS[piece.type])) {
      return splashBlast(state, action.at, from).some((h) =>
        isEnemyGeneral(state, pieceAt(state, h), me),
      );
    }
    return isEnemyGeneral(state, pieceAt(state, action.at), me);
  }
  if (action.kind === 'rotate') {
    return hexDamagePushHits(state, piece, {
      col: piece.col,
      row: piece.row,
      facing: action.dir,
    }).some((t) => isEnemyGeneral(state, t, me));
  }
  if (action.kind !== 'move') return false;
  const plan = previewMove(state, piece, action.to);
  if (plan.hits.some((h) => isEnemyGeneral(state, getPiece(state, h.id), me))) return true;
  if (isEnemyGeneral(state, pieceAt(state, plan.stop), me)) return true;
  return hexDamagePushHits(state, piece, {
    col: plan.stop.col,
    row: plan.stop.row,
    facing: plan.facing,
  }).some((t) => isEnemyGeneral(state, t, me));
}

/** True when this walk enters at least one pike hex (origin does not count). */
function moveStepsOnPikes(state: GameState, piece: Piece, to: Hex): boolean {
  const from: Hex = { col: piece.col, row: piece.row };
  const plan = previewMove(state, piece, to);
  if (eq(from, plan.stop)) return false;
  for (const h of pathForMove(state, piece, to)) {
    if (tokenAt(state.tokens, h)?.type === 'pikes') return true;
    if (hexDamageOn(state, h, piece.side)) return true;
    if (eq(h, plan.stop)) break;
  }
  return false;
}

function victimsOf(state: GameState, action: Action, me: Side): Piece[] {
  if (action.kind === 'skip') return [];
  const piece = getPiece(state, action.pieceId);
  if (!piece) return [];
  const out: Piece[] = [];
  const add = (p: Piece | undefined) => {
    if (p && isHostile(state, p.side, me) && !out.some((x) => x.id === p.id)) out.push(p);
  };
  if (action.kind === 'shoot') {
    const from: Hex = { col: piece.col, row: piece.row };
    if (hasSplash(UNIT_STATS[piece.type])) {
      for (const h of splashBlast(state, action.at, from)) add(pieceAt(state, h));
    } else {
      add(pieceAt(state, action.at));
    }
    return out;
  }
  if (action.kind !== 'move') return out;
  const plan = previewMove(state, piece, action.to);
  for (const h of plan.hits) add(getPiece(state, h.id));
  add(pieceAt(state, plan.stop));
  return out;
}

/** Adjacent enemy with melee damage — they can walk onto `target` next. */
function meleeThreatens(state: GameState, attacker: Piece, target: Piece): boolean {
  if (attacker.id === target.id) return false;
  if (!isHostile(state, attacker.side, target.side)) return false;
  if (UNIT_STATS[attacker.type].meleeDamage <= 0) return false;
  return (
    dist(
      state,
      { col: attacker.col, row: attacker.row },
      { col: target.col, row: target.row },
    ) === 1
  );
}

/**
 * Generals don't dump shots/melee into the army. King-hunt and fighting back
 * against a current melee threat are the only exceptions.
 */
function generalAttackOk(state: GameState, action: Action, me: Side): boolean {
  if (action.kind === 'skip') return true;
  const piece = getPiece(state, action.pieceId);
  if (!piece || !hasAbility(piece, 'general')) return true;
  if (!isAttackAction(state, action, me)) return true;
  if (attacksEnemyGeneral(state, action, me)) return true;
  return victimsOf(state, action, me).some((v) => meleeThreatens(state, v, piece));
}

function isPikeWalk(state: GameState, action: Action): boolean {
  if (action.kind !== 'move') return false;
  const piece = getPiece(state, action.pieceId);
  if (!piece) return false;
  return moveStepsOnPikes(state, piece, action.to);
}

/** Walk whose drawn/canonical path steps onto a Do-not-touch token. */
function moveTouchesNoTouch(state: GameState, action: Action): boolean {
  if (action.kind !== 'move') return false;
  const piece = getPiece(state, action.pieceId);
  if (!piece) return false;
  for (const h of pathForMove(state, piece, action.to)) {
    if (isNoTouch(state, h)) return true;
  }
  return false;
}

/** Unprovoked hoplite walks — even stamina lunges. Adjacent melee onto the dest is allowed. */
function isHopliteHoldWalk(state: GameState, action: Action, me: Side): boolean {
  if (action.kind !== 'move') return false;
  const piece = getPiece(state, action.pieceId);
  if (!piece || !isHoplite(piece) || piece.rangedHit) return false;
  const from: Hex = { col: piece.col, row: piece.row };
  const occ = pieceAt(state, action.to);
  if (occ && isHostile(state, occ.side, me) && dist(state, from, action.to) === 1) return false;
  return true;
}

function isHopliteForwardWalk(state: GameState, action: Action, piece: Piece): boolean {
  if (action.kind !== 'move') return false;
  const from: Hex = { col: piece.col, row: piece.row };
  const front = neighborInDir(from, facingOf(piece), state.orientation);
  return eq(action.to, front);
}

function moveCapturesFlag(state: GameState, action: Action, me: Side): boolean {
  if (action.kind !== 'move') return false;
  const piece = getPiece(state, action.pieceId);
  if (!piece) return false;
  const from: Hex = { col: piece.col, row: piece.row };
  const plan = previewMove(state, piece, action.to);
  if (eq(from, plan.stop)) return false;
  for (const h of pathForMove(state, piece, action.to)) {
    const tok = tokenAt(state.tokens, h);
    if (tok?.type === 'flag' && (!tok.owner || isHostile(state, tok.owner, me))) return true;
    if (eq(h, plan.stop)) break;
  }
  return false;
}

function scoreKillDelta(state: GameState, after: GameState, me: Side): number {
  let score = 0;
  const removed = state.pieces.filter((p) => !after.pieces.some((q) => q.id === p.id));
  for (const k of removed) {
    const v = UNIT_STATS[k.type].value * 24;
    if (isHostile(state, k.side, me)) {
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
    score += isHostile(state, p.side, me) ? v : -v * 0.5;
  }
  if (after.winner && sameTeam(after, after.winner, me)) score += 50_000;
  if (after.winner && !sameTeam(after, after.winner, me)) score -= 50_000;
  return score;
}

function scoreAction(state: GameState, action: Action, me: Side, on: RuleOn): number {
  if (action.kind === 'skip') return on('avoid-skip') ? -80 : 0;

  const piece = getPiece(state, action.pieceId);
  if (!piece) return -Infinity;

  const from: Hex = { col: piece.col, row: piece.row };
  let score = on('value-scoring') ? scoreKillDelta(state, applyAction(state, action), me) : 0;

  if (action.kind === 'rest') {
    score += isHoplite(piece) && !piece.rangedHit && on('hoplite-hold') ? 400 : 20;
    return score;
  }

  const hunt = huntHex(state, from, me, on);
  const blocking = hunt ? blockingDefenses(state, from, hunt) : [];
  const hitsBlocking = blocking.some((h) => actionHitsDefenseHex(state, action, h));
  if (on('targets-defenses') && hitsBlocking) {
    score += 2200;
  } else if (isDefenseOnlyShot(state, action, me)) {
    score -= 600;
  }

  if (isAttackAction(state, action, me) && on('prefer-attacks')) {
    score += 4_000;
    if (action.kind === 'shoot') {
      const t = pieceAt(state, action.at);
      if (t && isHostile(state, t.side, me)) score += UNIT_STATS[t.type].value * 22;
    }
    score += Math.random() * 0.3;
    return score;
  }

  if (action.kind === 'rotate') {
    if (!isHoplite(piece) || piece.rangedHit || !on('hoplite-hold')) {
      score -= 600;
      return score;
    }
    const enemy = nearestEnemy(state, from, me);
    const want = enemy
      ? faceToward(state, from, { col: enemy.col, row: enemy.row })
      : null;
    if (want != null && action.dir === want) score += 520;
    else score -= 180;
    return score;
  }

  if (action.kind !== 'move') return score;

  const palPlan = previewMove(state, piece, action.to);
  if (on('break-palisades')) {
    for (const ph of palPlan.palisadeHits) {
      score += ph.destroyed ? 280 : 140;
    }
  }

  if (
    on('hoplite-advance-on-hit') &&
    isHoplite(piece) &&
    piece.rangedHit &&
    isHopliteForwardWalk(state, action, piece)
  ) {
    score += 800;
  }

  const stop = palPlan.stop;
  const foe = isHoplite(piece) ? nearestEnemy(state, from, me) : null;
  const closeHunt = foe ? { col: foe.col, row: foe.row } : hunt;
  if (closeHunt && (on('close-on-hunt') || on('no-flee'))) {
    const closer = dist(state, from, closeHunt) - dist(state, stop, closeHunt);
    if (on('close-on-hunt')) {
      score += closer * 80;
      if (closer > 0) score += 300;
    }
    if (on('no-flee') && closer < 0) score -= 900;
  }

  if (on('prefer-high-ground')) {
    const fromH = terrainHeight(terrainAt(state, from));
    const toH = terrainHeight(terrainAt(state, stop));
    if (toH > fromH) score += 40 * (toH - fromH);
    if (toH < fromH) score -= 20 * (fromH - toH);
  }

  if (on('value-scoring')) score += UNIT_STATS[piece.type].value * 0.05;
  score += Math.random() * 0.3;
  return score;
}

function hopliteHoldAction(
  state: GameState,
  me: Side,
  pool: Action[],
  on: RuleOn,
): Action | null {
  const ids = new Set<string>();
  for (const a of pool) {
    if (a.kind === 'skip') continue;
    const p = getPiece(state, a.pieceId);
    if (!p || !isHoplite(p) || p.rangedHit) continue;
    ids.add(p.id);
  }
  const holds: Action[] = [];
  for (const id of ids) {
    const p = getPiece(state, id);
    if (!p) continue;
    const from: Hex = { col: p.col, row: p.row };
    const enemy = nearestEnemy(state, from, me);
    if (enemy) {
      const want = faceToward(state, from, { col: enemy.col, row: enemy.row });
      if (want != null && want !== facingOf(p)) {
        holds.push({ kind: 'rotate', pieceId: id, dir: want });
        continue;
      }
    }
    holds.push({ kind: 'rest', pieceId: id });
  }
  if (!holds.length) return null;
  return pickBest(holds, state, me, on);
}

function isOwnGeneralAction(state: GameState, action: Action): boolean {
  if (action.kind === 'skip') return false;
  const piece = getPiece(state, action.pieceId);
  return !!piece && hasAbility(piece, 'general');
}

function isMobileAction(state: GameState, action: Action): boolean {
  if (action.kind === 'skip') return false;
  const piece = getPiece(state, action.pieceId);
  if (!piece) return false;
  if (!isHoplite(piece)) return true;
  return !!piece.rangedHit;
}

/** Drop own-general actions while any other piece can still act. Scout lock is sacred. */
function othersFirst(state: GameState, pool: Action[], on: RuleOn): Action[] {
  if (!on('general-last') || state.scoutPieceId || !pool.length) return pool;
  const rest = pool.filter((a) => !isOwnGeneralAction(state, a));
  return rest.length ? rest : pool;
}

function pickBest(actions: Action[], state: GameState, me: Side, on: RuleOn): Action {
  let best = actions[0];
  let bestScore = -Infinity;
  for (const a of actions) {
    const s = scoreAction(state, a, me, on);
    if (s > bestScore) {
      bestScore = s;
      best = a;
    }
  }
  return best;
}

export function pickAiAction(state: GameState): Action | null {
  const me = state.turn;
  const on = rulesFor(state);
  const actions = allLegalActions(state).filter((a) => {
    if (on('general-restraint') && !generalAttackOk(state, a, me)) return false;
    if (
      on('never-capture-flags') &&
      moveCapturesFlag(state, a, me) &&
      !attacksEnemyGeneral(state, a, me)
    ) {
      return false;
    }
    if (on('avoid-notouch') && moveTouchesNoTouch(state, a)) return false;
    if (!on('targets-defenses')) {
      if (isDefenseOnlyShot(state, a, me)) return false;
      const piece = a.kind === 'skip' ? undefined : getPiece(state, a.pieceId);
      if (piece) {
        const from: Hex = { col: piece.col, row: piece.row };
        const hunt = huntHex(state, from, me, on);
        if (
          hunt &&
          blockingDefenses(state, from, hunt).some((h) =>
            actionHitsDefenseHex(state, a, h),
          )
        ) {
          return false;
        }
      }
    }
    return true;
  });
  if (!actions.length) return null;

  if (on('prefer-general-kills')) {
    const generalHits = othersFirst(
      state,
      actions.filter((a) => attacksEnemyGeneral(state, a, me)),
      on,
    );
    if (generalHits.length) return pickBest(generalHits, state, me, on);
  }

  const pool = othersFirst(state, actions, on);
  const safe = pool.filter((a) => {
    if (on('avoid-pikes') && isPikeWalk(state, a)) return false;
    if (on('hoplite-hold') && isHopliteHoldWalk(state, a, me)) return false;
    return true;
  });
  if (on('prefer-attacks')) {
    const attacks = safe.filter((a) => isAttackAction(state, a, me));
    if (attacks.length) return pickBest(attacks, state, me, on);
  }

  const mobile = safe.filter((a) => {
    if (on('hoplite-hold')) return isMobileAction(state, a);
    return a.kind !== 'skip';
  });
  if (mobile.length) return pickBest(mobile, state, me, on);

  if (on('hoplite-hold')) {
    const hold = hopliteHoldAction(state, me, pool, on);
    if (hold) return hold;
  }

  if (safe.length) return pickBest(safe, state, me, on);
  return pickBest(pool, state, me, on);
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
