/**
 * AI picker. Checklist sections match this order:
 * 1 Walking — do-not-touch / flags / pikes / palisades / keep-line / general last.
 * 2 Melee or shooting — if anyone can hit, they do (shoot-first, strongest, value, king restraint).
 * 3 Targeting — hunt: nearest enemy (Attack); else advance the front; else guard owned flags.
 * 4 Chasing — close on that hunt, prefer high ground.
 * 5 Defending — smash walls on the path; hold and face the nearest enemy.
 * 6 Retreating — do not flee the hunt; if not hunting, walk home; avoid skip.
 * Hidden (still concealed): camp. No walk/rotate unless that action is an attack.
 * Last remaining pieces all concealed → unhide + that AI goes aggressive, but
 * only if that side already had a visible unit. Kickoff ambush stays camped.
 */

import {
  allLegalActions,
  applyAction,
  combatValue,
  facingOf,
  getPiece,
  hasAbility,
  hasSplash,
  hpLeft,
  isHostile,
  pathForMove,
  pieceAt,
  previewMove,
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
  flushLastHiddenArmies,
  isConcealed,
  isConcealedFrom,
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

function nearestEnemy(state: GameState, from: Hex, me: Side): Piece | null {
  let best: Piece | null = null;
  let bestD = Infinity;
  for (const p of state.pieces) {
    if (!isHostile(state, p.side, me) || isConcealedFrom(state, p, me)) continue;
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
  // Attack beats Advance when both are on — otherwise they walk the far edge
  // and look like they're wandering / retreating past live enemies.
  if (on('hunt-enemy-general')) {
    const near = nearestEnemy(state, from, me);
    if (near) return { col: near.col, row: near.row };
  }
  if (on('advance-front')) {
    const far = farEdgeHex(state, from, me);
    if (!eq(from, far)) return far;
  }
  return null;
}

function inBoard(state: GameState, h: Hex): boolean {
  return h.col >= 0 && h.row >= 0 && h.col < state.cols && h.row < state.rows;
}

/** Blue-side home (low rows) marches down the board; red-side home marches up. */
function armyAdvancesDown(state: GameState, me: Side): boolean {
  let sum = 0;
  let n = 0;
  for (const p of state.pieces) {
    if (p.side !== me) continue;
    sum += p.startRow ?? p.row;
    n += 1;
  }
  if (!n) return me !== 'red';
  return sum / n < (state.rows - 1) / 2;
}

function farEdgeRow(state: GameState, me: Side): number {
  return armyAdvancesDown(state, me) ? state.rows - 1 : 0;
}

function farEdgeHex(state: GameState, from: Hex, me: Side): Hex {
  return { col: from.col, row: farEdgeRow(state, me) };
}

function lineProgress(state: GameState, h: Hex, me: Side): number {
  return armyAdvancesDown(state, me) ? h.row : state.rows - 1 - h.row;
}

const LINE_SLACK = 1;

function canMarch(p: Piece): boolean {
  return UNIT_STATS[p.type].move > 0;
}

function marcherIds(state: GameState, pool: Action[], me: Side): Set<string> {
  const ids = new Set<string>();
  for (const a of pool) {
    if (a.kind !== 'move') continue;
    const p = getPiece(state, a.pieceId);
    if (p && p.side === me && canMarch(p)) ids.add(p.id);
  }
  return ids;
}

function rearProgress(state: GameState, me: Side, marchers: Set<string>): number {
  let min = Infinity;
  for (const p of state.pieces) {
    if (p.side !== me || !marchers.has(p.id)) continue;
    min = Math.min(min, lineProgress(state, { col: p.col, row: p.row }, me));
  }
  return min;
}

function breaksLine(
  state: GameState,
  piece: Piece,
  stop: Hex,
  me: Side,
  marchers: Set<string>,
): boolean {
  if (!canMarch(piece)) return false;
  const rear = rearProgress(state, me, marchers);
  if (!Number.isFinite(rear)) return false;
  return lineProgress(state, stop, me) > rear + LINE_SLACK;
}

function preferRear(state: GameState, actions: Action[], me: Side): Action[] {
  const ids = new Set<string>();
  for (const a of actions) {
    if (a.kind === 'skip') continue;
    ids.add(a.pieceId);
  }
  if (ids.size <= 1) return actions;
  let minP = Infinity;
  const prog = new Map<string, number>();
  for (const id of ids) {
    const p = getPiece(state, id);
    if (!p || !canMarch(p)) continue;
    const pr = lineProgress(state, { col: p.col, row: p.row }, me);
    prog.set(id, pr);
    if (pr < minP) minP = pr;
  }
  if (!Number.isFinite(minP)) return actions;
  const rear = actions.filter(
    (a) => a.kind !== 'skip' && prog.get(a.pieceId) === minP,
  );
  return rear.length ? rear : actions;
}

const HIGH_SEEK = 3;

/** Walk to `goal` with higher hexes cheaper, so the route covers ridges. */
function highGroundPath(
  state: GameState,
  piece: Piece,
  from: Hex,
  goal: Hex,
): Hex[] {
  if (eq(from, goal)) return [];
  const stats = UNIT_STATS[piece.type];
  const found = pathTo(from, goal, {
    cols: state.cols,
    rows: state.rows,
    maxDist: Math.max(5, state.cols * state.rows) * 5,
    orientation: state.orientation,
    stepCost: (a, b) => {
      const ha = terrainHeight(terrainAt(state, a));
      const hb = terrainHeight(terrainAt(state, b));
      if (Math.abs(hb - ha) > 1) return 0;
      if (hb > stats.climbLevel) return 0;
      return hb > 0 ? 1 : 5;
    },
    canStop: (h) => {
      if (!inBoard(state, h)) return false;
      if (eq(h, goal)) return true;
      const t = terrainAt(state, h);
      if (t === 'water' && !stats.passWater) return false;
      if (terrainHeight(t) > stats.climbLevel) return false;
      return true;
    },
    canPass: (h) => {
      if (!inBoard(state, h) || eq(h, goal)) return false;
      const t = terrainAt(state, h);
      if (t === 'water' && !stats.passWater) return false;
      if (terrainHeight(t) > stats.climbLevel) return false;
      return true;
    },
  });
  return found ?? [];
}

/** Walk hexes must be a prefix of the ridge, not a shortcut that skips it. */
function ridgeFollowIndex(walk: Hex[], ridge: Hex[]): number {
  if (!walk.length || !ridge.length || walk.length > ridge.length) return -1;
  for (let i = 0; i < walk.length; i++) {
    if (!eq(walk[i], ridge[i])) return -1;
  }
  return walk.length - 1;
}

function walkHexesToStop(state: GameState, piece: Piece, to: Hex, stop: Hex): Hex[] {
  const walk: Hex[] = [];
  for (const h of pathForMove(state, piece, to)) {
    walk.push(h);
    if (eq(h, stop)) return walk;
  }
  if (!walk.length || !eq(walk[walk.length - 1], stop)) walk.push(stop);
  return walk;
}

/** Highest walkable hex in 3 of `from` that this piece can occupy. */
function highGroundSeek(state: GameState, piece: Piece, from: Hex): Hex | null {
  const here = terrainHeight(terrainAt(state, from));
  const maxClimb = UNIT_STATS[piece.type].climbLevel;
  let best: Hex | null = null;
  let bestH = here;
  let bestD = Infinity;
  for (let row = 0; row < state.rows; row++) {
    for (let col = 0; col < state.cols; col++) {
      const h = { col, row };
      const d = dist(state, from, h);
      if (d < 1 || d > HIGH_SEEK) continue;
      if (isBlockedWalk(state, h) || isNoTouch(state, h)) continue;
      const occ = pieceAt(state, h);
      if (occ && occ.id !== piece.id) continue;
      const ht = terrainHeight(terrainAt(state, h));
      if (ht <= here || ht > maxClimb) continue;
      if (ht > bestH || (ht === bestH && d < bestD)) {
        bestH = ht;
        bestD = d;
        best = h;
      }
    }
  }
  return best;
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
  if (action.kind === 'rotate') {
    for (const t of hexDamagePushHits(state, piece, {
      col: piece.col,
      row: piece.row,
      facing: action.dir,
    })) {
      add(t);
    }
    return out;
  }
  if (action.kind !== 'move') return out;
  const plan = previewMove(state, piece, action.to);
  for (const h of plan.hits) add(getPiece(state, h.id));
  add(pieceAt(state, plan.stop));
  for (const t of hexDamagePushHits(state, piece, {
    col: plan.stop.col,
    row: plan.stop.row,
    facing: plan.facing,
  })) {
    add(t);
  }
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

/** Stay put only when Hold is on and Attack/flag-hunt is not pulling them. */
function isHolding(state: GameState, piece: Piece, me: Side, on: RuleOn): boolean {
  if (!on('hold-position') || piece.rangedHit) return false;
  return huntHex(state, { col: piece.col, row: piece.row }, me, on) == null;
}

/** Unprovoked hold walks — even stamina lunges. Adjacent melee onto the dest is allowed. */
function isHoldWalk(state: GameState, action: Action, me: Side): boolean {
  if (action.kind !== 'move') return false;
  const piece = getPiece(state, action.pieceId);
  if (!piece || piece.rangedHit) return false;
  const from: Hex = { col: piece.col, row: piece.row };
  const occ = pieceAt(state, action.to);
  if (occ && isHostile(state, occ.side, me) && dist(state, from, action.to) === 1) return false;
  return true;
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
    const v = combatValue(k) * 24;
    if (isHostile(state, k.side, me)) {
      score += v;
    } else {
      score -= v * 0.5;
    }
  }
  for (const p of state.pieces) {
    const q = after.pieces.find((x) => x.id === p.id);
    if (!q) continue;
    const dmg = hpLeft(p) - hpLeft(q);
    if (dmg <= 0) continue;
    const v = combatValue(p) * 10 * dmg;
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
    score += isHolding(state, piece, me, on) ? 400 : 20;
    return score;
  }

  const hunt = huntHex(state, from, me, on);
  const foe =
    on('hold-position') && piece.rangedHit ? nearestEnemy(state, from, me) : null;
  const blocking = hunt ? blockingDefenses(state, from, hunt) : [];
  const hitsBlocking = blocking.some((h) => actionHitsDefenseHex(state, action, h));
  if (on('targets-defenses') && hitsBlocking) {
    score += 2200;
  } else if (isDefenseOnlyShot(state, action, me)) {
    score -= 600;
  }

  if (isAttackAction(state, action, me)) {
    score += 4_000;
    if (action.kind === 'shoot') {
      const t = pieceAt(state, action.at);
      if (t && isHostile(state, t.side, me)) score += combatValue(t) * 22;
    }
    score += Math.random() * 0.3;
    return score;
  }

  if (action.kind === 'rotate') {
    if (!isHolding(state, piece, me, on)) {
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

  const stop = palPlan.stop;
  const closeHunt = foe ? { col: foe.col, row: foe.row } : hunt;
  const closer = closeHunt
    ? dist(state, from, closeHunt) - dist(state, stop, closeHunt)
    : 0;
  let highIdx = -1;
  if (on('prefer-high-ground')) {
    const ridgeGoal = closeHunt ?? highGroundSeek(state, piece, from);
    if (ridgeGoal) {
      highIdx = ridgeFollowIndex(
        walkHexesToStop(state, piece, action.to, stop),
        highGroundPath(state, piece, from, ridgeGoal),
      );
    }
    const fromH = terrainHeight(terrainAt(state, from));
    const toH = terrainHeight(terrainAt(state, stop));
    if (toH > fromH) score += 40 * (toH - fromH);
    if (toH < fromH) score -= 20 * (fromH - toH);
    // Ridge is a tie-break toward the hunt, never a reason to walk away.
    if (highIdx >= 0 && closer >= 0) score += 420 + highIdx * 80;
  }
  if (closeHunt && (on('close-on-hunt') || on('no-flee') || foe)) {
    if (on('close-on-hunt') || foe) {
      score += closer * 80;
      if (closer > 0) score += 300;
    }
    if (on('no-flee') && closer < 0) score -= 900;
  }

  if (on('return-to-start') && !hunt && !foe) {
    const home: Hex = {
      col: piece.startCol ?? piece.col,
      row: piece.startRow ?? piece.row,
    };
    if (eq(from, home)) {
      if (!eq(stop, home)) score -= 400;
    } else {
      const closer = dist(state, from, home) - dist(state, stop, home);
      score += closer * 90;
      if (closer > 0) score += 320;
      if (eq(stop, home)) score += 80;
    }
  }

  if (on('value-scoring')) score += combatValue(piece) * 0.05;
  score += Math.random() * 0.3;
  return score;
}

function holdAction(
  state: GameState,
  me: Side,
  pool: Action[],
  on: RuleOn,
): Action | null {
  const ids = new Set<string>();
  for (const a of pool) {
    if (a.kind === 'skip') continue;
    const p = getPiece(state, a.pieceId);
    if (!p || !isHolding(state, p, me, on)) continue;
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
  return !!piece.rangedHit;
}

/** Drop own-general actions while any other piece can still act. Scout lock is sacred. */
function othersFirst(state: GameState, pool: Action[], on: RuleOn): Action[] {
  if (!on('general-last') || state.scoutPieceId || !pool.length) return pool;
  const rest = pool.filter((a) => !isOwnGeneralAction(state, a));
  return rest.length ? rest : pool;
}

/** Same piece can shoot and melee: keep shots if shoot-first, else melee. */
function resolveShootMelee(
  state: GameState,
  attacks: Action[],
  me: Side,
  on: RuleOn,
): Action[] {
  const byPiece = new Map<string, Action[]>();
  const other: Action[] = [];
  for (const a of attacks) {
    if (
      (a.kind === 'shoot' || a.kind === 'move') &&
      isAttackAction(state, a, me)
    ) {
      const list = byPiece.get(a.pieceId) ?? [];
      list.push(a);
      byPiece.set(a.pieceId, list);
    } else {
      other.push(a);
    }
  }
  const shootFirst = on('shoot-first');
  const out = [...other];
  for (const list of byPiece.values()) {
    const shots = list.filter((a) => a.kind === 'shoot');
    const melees = list.filter((a) => a.kind === 'move');
    if (shots.length && melees.length) {
      out.push(...(shootFirst ? shots : melees));
    } else {
      out.push(...list);
    }
  }
  return out.length ? out : attacks;
}

function attackFocus(state: GameState, action: Action, me: Side): { value: number; dist: number } {
  if (action.kind === 'skip') return { value: -Infinity, dist: Infinity };
  const piece = getPiece(state, action.pieceId);
  const vs = victimsOf(state, action, me);
  if (!piece || !vs.length) return { value: -Infinity, dist: Infinity };
  const from: Hex = { col: piece.col, row: piece.row };
  let value = -Infinity;
  let d = Infinity;
  for (const v of vs) {
    value = Math.max(value, combatValue(v));
    d = Math.min(d, dist(state, from, { col: v.col, row: v.row }));
  }
  return { value, dist: d };
}

/** Strongest first: highest-value victim. Unchecked: closest victim. */
function preferTargets(
  state: GameState,
  attacks: Action[],
  me: Side,
  on: RuleOn,
): Action[] {
  if (attacks.length <= 1) return attacks;
  const scored = attacks.map((a) => ({ a, ...attackFocus(state, a, me) }));
  if (on('strongest-first')) {
    const best = Math.max(...scored.map((s) => s.value));
    return scored.filter((s) => s.value === best).map((s) => s.a);
  }
  const best = Math.min(...scored.map((s) => s.dist));
  return scored.filter((s) => s.dist === best).map((s) => s.a);
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

/** Concealed AI: only shoot / melee / hex-damage. Walks wait until provoked (revealed). */
function hiddenCamperOk(state: GameState, a: Action, me: Side): boolean {
  if (a.kind === 'skip' || a.kind === 'rest') return true;
  const piece = getPiece(state, a.pieceId);
  if (!piece || !isConcealed(state, piece)) return true;
  return isAttackAction(state, a, me);
}

export function pickAiAction(state: GameState): Action | null {
  flushLastHiddenArmies(state);
  const me = state.turn;
  const on = rulesFor(state);
  const actions = allLegalActions(state).filter((a) => {
    if (!hiddenCamperOk(state, a, me)) return false;
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

  const pool = on('keep-line') ? actions : othersFirst(state, actions, on);
  const safe = pool.filter((a) => {
    if (
      on('avoid-pikes') &&
      isPikeWalk(state, a) &&
      !attacksEnemyGeneral(state, a, me)
    ) {
      return false;
    }
    if (a.kind !== 'skip' && isHoldWalk(state, a, me)) {
      const piece = getPiece(state, a.pieceId);
      if (piece && isHolding(state, piece, me, on)) return false;
    }
    return true;
  });
  const attacks = preferTargets(
    state,
    resolveShootMelee(
      state,
      safe.filter((a) => isAttackAction(state, a, me)),
      me,
      on,
    ),
    me,
    on,
  );
  if (attacks.length) return pickBest(attacks, state, me, on);

  const mobile = safe.filter((a) => {
    if (a.kind === 'skip') return false;
    const piece = getPiece(state, a.pieceId);
    if (piece && isHolding(state, piece, me, on)) return isMobileAction(state, a);
    return true;
  });
  let march = mobile;
  if (on('keep-line')) {
    const marchers = marcherIds(state, mobile, me);
    march = mobile.filter((a) => {
      if (a.kind !== 'move') return true;
      const piece = getPiece(state, a.pieceId);
      if (!piece) return false;
      return !breaksLine(
        state,
        piece,
        previewMove(state, piece, a.to).stop,
        me,
        marchers,
      );
    });
    const steps = march.filter((a) => a.kind === 'move');
    if (steps.length) march = steps;
    march = preferRear(state, march, me);
  }
  if (march.length) return pickBest(march, state, me, on);

  const hold = holdAction(state, me, pool, on);
  if (hold) return hold;

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
