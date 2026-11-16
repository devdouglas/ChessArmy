import type { CampaignMap, SeaNode } from './types';
import {
  BARBARIAN_ID,
  type ArmySize,
  type CampaignStack,
  type MatchState,
  type PendingInvasion,
  type TokenPool,
  type TurnPhase,
  TURN_PHASES,
  activeSeat,
  cloneMatch,
  isBarbarianFaction,
  isCapitalRegion,
  isIsland,
  isPlayerFaction,
  makeStack,
  pushLog,
  regionById,
  seatOf,
} from './match';

export type SeaRouteKind = 'blue' | 'red';

export type SeaAdjacency = {
  to: string;
  kind: SeaRouteKind;
};

export type LegalMove = {
  regionId: string;
  via: 'land' | 'sea';
  seaKind?: SeaRouteKind;
  /** Coin cost for the step (red crossing when shores not both owned). */
  coinCost: number;
};

function assertPlay(state: MatchState): asserts state is MatchState & {
  phase: Extract<MatchState['phase'], { kind: 'play' }>;
} {
  if (state.phase.kind !== 'play') throw new Error('Match not in play');
}

export function stacksInRegion(state: MatchState, regionId: string): CampaignStack[] {
  return state.stacks.filter((s) => s.regionId === regionId);
}

export function stacksOfFactionInRegion(
  state: MatchState,
  regionId: string,
  factionId: string,
): CampaignStack[] {
  return state.stacks.filter((s) => s.regionId === regionId && s.factionId === factionId);
}

export function totalUnitsOfFactionInRegion(
  state: MatchState,
  regionId: string,
  factionId: string,
): number {
  return stacksOfFactionInRegion(state, regionId, factionId).reduce((n, s) => n + s.units, 0);
}

export function ownerOf(state: MatchState, regionId: string): string | null {
  return state.regionOwners[regionId] ?? null;
}

/** Non-rebel factions with at least one unit in the region. */
function presentFactionsInRegion(state: MatchState, regionId: string): Set<string> {
  const present = new Set<string>();
  for (const s of stacksInRegion(state, regionId)) {
    if (s.rebelOf) continue;
    present.add(s.factionId);
  }
  return present;
}

/**
 * Ownership follows presence: empty (or rebels-only) → neutral;
 * exactly one faction → that faction; contested → keep current if still present else null.
 */
export function isSeaStopLocation(map: CampaignMap, locationId: string): boolean {
  return map.seaNodes.some((n) => n.kind === 'stop' && n.id === locationId);
}

export function isLandLocation(map: CampaignMap, locationId: string): boolean {
  return !!regionById(map, locationId);
}

export function locationLabel(map: CampaignMap, locationId: string): string {
  const reg = regionById(map, locationId);
  if (reg) return reg.name;
  if (isSeaStopLocation(map, locationId)) return 'sea stop';
  return locationId;
}

export function syncRegionOwnership(
  state: MatchState,
  regionId: string,
  map?: CampaignMap,
): void {
  if (map && !isLandLocation(map, regionId)) return;
  const present = presentFactionsInRegion(state, regionId);
  if (present.size === 0) {
    state.regionOwners[regionId] = null;
    return;
  }
  if (present.size === 1) {
    state.regionOwners[regionId] = [...present][0]!;
    return;
  }
  const cur = state.regionOwners[regionId];
  if (cur && present.has(cur)) return;
  state.regionOwners[regionId] = null;
}

export function syncAllRegionOwnership(state: MatchState, map: CampaignMap): void {
  const ids = new Set<string>(Object.keys(state.regionOwners));
  for (const s of state.stacks) {
    if (isLandLocation(map, s.regionId)) ids.add(s.regionId);
  }
  for (const rid of ids) syncRegionOwnership(state, rid, map);
}

export function playerHoldsHomeCapital(
  state: MatchState,
  map: CampaignMap,
  playerFactionId: string,
  homeFactionId: string,
): boolean {
  for (const rid of state.homeRegions[homeFactionId] ?? []) {
    const reg = regionById(map, rid);
    if (reg?.settlement.kind === 'capital') {
      return ownerOf(state, rid) === playerFactionId;
    }
  }
  return false;
}

/** Location id for a sea node: port → its region; stop → itself (ocean waypoint). */
function seaNodeLocation(node: SeaNode): string | null {
  if (node.kind === 'stop') return node.id;
  if (node.kind === 'port' && node.regionId) return node.regionId;
  return null;
}

/**
 * One-hop sea graph. Keys/values are land region ids or sea-stop node ids.
 * Direct port↔port = regions adjacent. Port↔stop or stop↔stop = must stop on the dot.
 */
export function buildSeaAdjacency(map: CampaignMap): Record<string, SeaAdjacency[]> {
  const byId = new Map(map.seaNodes.map((n) => [n.id, n]));
  const out: Record<string, SeaAdjacency[]> = {};

  const add = (from: string, to: string, kind: SeaRouteKind) => {
    if (from === to) return;
    const list = out[from] ?? [];
    const prev = list.find((x) => x.to === to);
    if (prev) {
      if (prev.kind === 'red' && kind === 'blue') prev.kind = 'blue';
      return;
    }
    list.push({ to, kind });
    out[from] = list;
  };

  for (const link of map.seaLinks) {
    const a = byId.get(link.a);
    const b = byId.get(link.b);
    if (!a || !b) continue;
    const from = seaNodeLocation(a);
    const to = seaNodeLocation(b);
    if (!from || !to) continue;
    add(from, to, link.kind);
    add(to, from, link.kind);
  }
  return out;
}

/** Port regions in the sea-component that contains the hop from→to. */
function seaComponentPortRegions(
  map: CampaignMap,
  fromLoc: string,
  toLoc: string,
): string[] {
  const byId = new Map(map.seaNodes.map((n) => [n.id, n]));
  const adj = new Map<string, string[]>();
  for (const l of map.seaLinks) {
    const la = adj.get(l.a) ?? [];
    la.push(l.b);
    adj.set(l.a, la);
    const lb = adj.get(l.b) ?? [];
    lb.push(l.a);
    adj.set(l.b, lb);
  }

  const nodesOf = (loc: string): string[] => {
    if (isSeaStopLocation(map, loc)) return byId.has(loc) ? [loc] : [];
    return map.seaNodes
      .filter((n) => n.kind === 'port' && n.regionId === loc)
      .map((n) => n.id);
  };

  const startNodes = nodesOf(fromLoc);
  const goal = new Set(nodesOf(toLoc));
  let seed: string | null = null;
  for (const a of startNodes) {
    for (const b of adj.get(a) ?? []) {
      if (goal.has(b) || seaNodeLocation(byId.get(b)!) === toLoc) {
        seed = a;
        break;
      }
    }
    if (seed) break;
  }
  if (!seed) seed = startNodes[0] ?? null;
  if (!seed) return [];

  const seen = new Set<string>([seed]);
  const queue = [seed];
  const ports = new Set<string>();
  while (queue.length) {
    const cur = queue.shift()!;
    const node = byId.get(cur);
    if (node?.kind === 'port' && node.regionId) ports.add(node.regionId);
    for (const n of adj.get(cur) ?? []) {
      if (seen.has(n)) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return [...ports];
}

/** Red hops are free when the mover owns every shore port in that sea component. */
function seaActsAsBlue(
  state: MatchState,
  map: CampaignMap,
  factionId: string,
  from: string,
  to: string,
  kind: SeaRouteKind,
): boolean {
  if (kind === 'blue') return true;
  const shores = seaComponentPortRegions(map, from, to);
  if (shores.length === 0) return false;
  return shores.every((r) => ownerOf(state, r) === factionId);
}

/** Regions occupied by faction (or grantors who supply them). */
function occupiedByForSupply(
  state: MatchState,
  factionId: string,
): Set<string> {
  const grantors = new Set<string>([factionId]);
  for (const g of state.supplyGrants) {
    if (g.toFactionId === factionId) grantors.add(g.fromFactionId);
  }
  const regions = new Set<string>();
  for (const s of state.stacks) {
    if (grantors.has(s.factionId) && !s.rebelOf) regions.add(s.regionId);
  }
  return regions;
}

export function capitalIdsOwnedBy(
  state: MatchState,
  map: CampaignMap,
  factionId: string,
): string[] {
  const ids: string[] = [];
  for (const r of map.regions) {
    if (r.settlement.kind === 'capital' && ownerOf(state, r.id) === factionId) {
      ids.push(r.id);
    }
  }
  return ids;
}

export function isRegionSupplied(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  factionId: string,
  regionId: string,
): boolean {
  const occupied = occupiedByForSupply(state, factionId);
  if (!occupied.has(regionId)) return false;
  const capitals = capitalIdsOwnedBy(state, map, factionId);
  if (capitals.length === 0) return false;
  if (capitals.includes(regionId)) return true;

  const queue = [regionId];
  const seen = new Set<string>([regionId]);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of map.neighbors[cur] ?? []) {
      if (seen.has(n)) continue;
      if (!occupied.has(n)) continue;
      if (capitals.includes(n)) return true;
      seen.add(n);
      queue.push(n);
    }
    for (const edge of sea[cur] ?? []) {
      if (seen.has(edge.to)) continue;
      if (!seaActsAsBlue(state, map, factionId, cur, edge.to, edge.kind)) continue;
      const toStop = isSeaStopLocation(map, edge.to);
      // Ocean stops bridge supply when empty/friendly; land needs occupation
      if (toStop) {
        if (hasHostileUnits(state, edge.to, factionId)) continue;
      } else if (!occupied.has(edge.to)) {
        continue;
      }
      if (capitals.includes(edge.to)) return true;
      seen.add(edge.to);
      queue.push(edge.to);
    }
  }
  return false;
}

export function isStackSupplied(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  stack: CampaignStack,
): boolean {
  if (stack.rebelOf) return false;
  return isRegionSupplied(state, map, sea, stack.factionId, stack.regionId);
}

export function isCampaigningArmy(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  stack: CampaignStack,
): boolean {
  if (stack.kind !== 'army') return false;
  if (isStackInBattleOrWaiting(state, stack.id)) return false;
  return !isStackSupplied(state, map, sea, stack);
}

export function isStackInBattleOrWaiting(state: MatchState, stackId: string): boolean {
  for (const inv of state.pendingInvasions) {
    if (inv.status === 'battle' || inv.status === 'pending') {
      if (inv.attackerStackIds.includes(stackId)) return true;
    }
  }
  for (const sg of state.sieges) {
    if (sg.attackerStackIds.includes(stackId) || sg.defenderStackIds.includes(stackId)) {
      return true;
    }
  }
  return false;
}

export function armyNeedsUpkeepPayment(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  stack: CampaignStack,
): boolean {
  if (stack.kind !== 'army') return false;
  if (stack.upkeepPaid) return false;
  // In battle: only pay if entered supplied and now unsupplied (supply broken mid-battle)
  const inv = state.pendingInvasions.find(
    (i) => i.status === 'battle' && i.attackerStackIds.includes(stack.id),
  );
  if (inv) {
    const entered = inv.enteredSupplied[stack.id];
    if (entered && !isStackSupplied(state, map, sea, stack)) return true;
    return false;
  }
  for (const sg of state.sieges) {
    if (sg.attackerStackIds.includes(stack.id) || sg.defenderStackIds.includes(stack.id)) {
      // sieges: campaigning payment skipped per "waiting for battle" / in engagement
      return false;
    }
  }
  return isCampaigningArmy(state, map, sea, stack);
}

export function armiesNeedingUpkeep(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  factionId: string,
): CampaignStack[] {
  return state.stacks.filter(
    (s) =>
      s.factionId === factionId &&
      !s.rebelOf &&
      armyNeedsUpkeepPayment(state, map, sea, s),
  );
}

/** Half rounded down (5 → lose 2). */
export function upkeepLossAmount(units: number): number {
  return Math.floor(Math.max(0, units) / 2);
}

/** Owned capitals that yield tax this turn (not under siege). */
export function taxableCapitalRegions(state: MatchState, map: CampaignMap): string[] {
  assertPlay(state);
  const seat = activeSeat(state)!;
  const ids: string[] = [];
  for (const r of map.regions) {
    if (r.settlement.kind !== 'capital') continue;
    if (ownerOf(state, r.id) !== seat.factionId) continue;
    if (state.sieges.some((s) => s.regionId === r.id)) continue;
    ids.push(r.id);
  }
  return ids;
}

export function collectTaxes(state: MatchState, map: CampaignMap): MatchState {
  assertPlay(state);
  const next = cloneMatch(state);
  assertPlay(next);
  if (next.phase.taxesCollected) return next;
  const seat = activeSeat(next)!;
  const gain = taxableCapitalRegions(next, map).length;
  seat.coins += gain;
  next.phase.taxesCollected = true;
  pushLog(next, `${factionLabel(map, seat.factionId)} collects ${gain} tax`);
  return next;
}

export function skipTaxes(state: MatchState): MatchState {
  assertPlay(state);
  const next = cloneMatch(state);
  assertPlay(next);
  next.phase.taxesCollected = true;
  return next;
}

function factionLabel(map: CampaignMap, id: string): string {
  return map.factions.find((f) => f.id === id)?.name ?? id;
}

function recruitBlockedByCampaigning(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  regionId: string,
  factionId: string,
): boolean {
  const mine = stacksOfFactionInRegion(state, regionId, factionId);
  if (!mine.length) return false;
  const hasCampaigning = mine.some((s) => isCampaigningArmy(state, map, sea, s));
  const hasNonCampaigning = mine.some((s) => !isCampaigningArmy(state, map, sea, s));
  return hasCampaigning && !hasNonCampaigning;
}

function hasHostileUnits(state: MatchState, regionId: string, factionId: string): boolean {
  return stacksInRegion(state, regionId).some(
    (s) => s.factionId !== factionId && !s.rebelOf,
  );
}

/** True when recruiting onto an owned village/capital (stays unmoved). Adjacent placements are moved. */
export function isHomeRecruit(
  state: MatchState,
  map: CampaignMap,
  regionId: string,
  factionId: string,
): boolean {
  if (ownerOf(state, regionId) !== factionId) return false;
  const r = regionById(map, regionId);
  return r?.settlement.kind === 'capital' || r?.settlement.kind === 'village';
}

/** Regions where this faction has at least one unmoved unit (recruit adjacency source). */
function regionsWithUnmovedPresence(state: MatchState, factionId: string): Set<string> {
  const ids = new Set<string>();
  for (const s of state.stacks) {
    if (s.factionId === factionId && !s.rebelOf && !s.moved) ids.add(s.regionId);
  }
  return ids;
}

/**
 * Recruit targets: owned villages/capitals, plus land neighbors of regions with
 * unmoved presence (moved units do not unlock further adjacency until next turn).
 */
export function recruitableRegions(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  factionId: string,
): string[] {
  const out = new Set<string>();

  for (const r of map.regions) {
    if (ownerOf(state, r.id) !== factionId) continue;
    if (r.settlement.kind !== 'capital' && r.settlement.kind !== 'village') continue;
    if (recruitBlockedByCampaigning(state, map, sea, r.id, factionId)) continue;
    out.add(r.id);
  }

  // Recruit-and-move: only unmoved stacks grant neighbouring access this turn
  for (const rid of regionsWithUnmovedPresence(state, factionId)) {
    for (const n of map.neighbors[rid] ?? []) {
      if (hasHostileUnits(state, n, factionId)) continue;
      if (recruitBlockedByCampaigning(state, map, sea, n, factionId)) continue;
      out.add(n);
    }
  }
  return [...out];
}

export function recruit(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  regionId: string,
  payerFactionId?: string,
): MatchState {
  assertPlay(state);
  const next = cloneMatch(state);
  assertPlay(next);
  const seat = activeSeat(next)!;
  const payer = payerFactionId ? seatOf(next, payerFactionId) : seat;
  if (!payer) throw new Error('No payer');
  if (payer.coins < 1) throw new Error('Not enough coins');
  const allowed = recruitableRegions(next, map, sea, seat.factionId);
  if (!allowed.includes(regionId)) throw new Error('Cannot recruit there');

  const home = isHomeRecruit(next, map, regionId, seat.factionId);
  const asMoved = !home;

  payer.coins -= 1;
  const mergeTarget = stacksOfFactionInRegion(next, regionId, seat.factionId).find(
    (s) => s.moved === asMoved && !s.rebelOf,
  );
  let placed: CampaignStack;
  if (mergeTarget) {
    mergeTarget.units += 1;
    placed = mergeTarget;
  } else {
    placed = makeStack(next, {
      factionId: seat.factionId,
      regionId,
      units: 1,
      kind: 'loose',
      moved: asMoved,
    });
    next.stacks.push(placed);
  }
  syncStackArmyKind(next, placed);
  syncRegionOwnership(next, regionId);
  pushLog(
    next,
    `${factionLabel(map, seat.factionId)} recruits in ${regionById(map, regionId)?.name ?? regionId}${asMoved ? ' (moved)' : ''}`,
  );
  return next;
}

/** 3+ units on a stack = army. */
export const ARMY_MIN_UNITS = 3;

export function factionHasArmy(state: MatchState, factionId: string): boolean {
  return state.stacks.some(
    (s) => s.factionId === factionId && s.kind === 'army' && !s.rebelOf,
  );
}

/**
 * Sync army kind from unit count.
 * Demotion (<3) always runs. Promotion (3+ → army) only when `promote` (end of turn).
 * Returns true when a stack newly becomes an army.
 */
export function syncStackArmyKind(
  state: MatchState,
  stack: CampaignStack,
  opts?: { promote?: boolean },
): boolean {
  if (stack.rebelOf) return false;
  const seat = seatOf(state, stack.factionId);
  if (stack.units >= ARMY_MIN_UNITS) {
    if (!opts?.promote || stack.kind === 'army') return false;
    const fit = seat ? largestTokenFitting(seat.tokens, stack.units) : null;
    if (fit && seat) takeToken(seat.tokens, fit);
    stack.kind = 'army';
    stack.armySize = fit ?? (stack.units >= 10 ? 10 : stack.units >= 5 ? 5 : 3);
    state.lastFormedArmyByFaction ??= {};
    state.lastFormedArmyByFaction[stack.factionId] = stack.id;
    return true;
  }
  if (stack.kind === 'army') {
    if (seat && stack.armySize) returnToken(seat.tokens, stack.armySize);
    stack.kind = 'loose';
    delete stack.armySize;
  }
  return false;
}

function remapStackIds(
  state: MatchState,
  oldIds: Set<string>,
  newId: string,
): void {
  for (const inv of state.pendingInvasions) {
    if (!inv.attackerStackIds.some((id) => oldIds.has(id))) continue;
    inv.attackerStackIds = [
      ...new Set([...inv.attackerStackIds.filter((id) => !oldIds.has(id)), newId]),
    ];
    let supplied = false;
    for (const id of oldIds) {
      if (inv.enteredSupplied[id]) supplied = true;
      delete inv.enteredSupplied[id];
    }
    inv.enteredSupplied[newId] = supplied;
  }
  for (const sg of state.sieges) {
    if (sg.attackerStackIds.some((id) => oldIds.has(id))) {
      sg.attackerStackIds = [
        ...new Set([...sg.attackerStackIds.filter((id) => !oldIds.has(id)), newId]),
      ];
    }
    if (sg.defenderStackIds.some((id) => oldIds.has(id))) {
      sg.defenderStackIds = [
        ...new Set([...sg.defenderStackIds.filter((id) => !oldIds.has(id)), newId]),
      ];
    }
  }
}

/**
 * End of turn: extras in a region with an army merge into that army;
 * any remaining 3+ stack becomes an army (★).
 */
export function formArmiesEndOfTurn(state: MatchState, factionId: string): void {
  state.armyPrompt = null;
  const seat = seatOf(state, factionId);
  const byRegion = new Map<string, CampaignStack[]>();
  for (const s of state.stacks) {
    if (s.factionId !== factionId || s.rebelOf) continue;
    const list = byRegion.get(s.regionId);
    if (list) list.push(s);
    else byRegion.set(s.regionId, [s]);
  }

  for (const [, group] of byRegion) {
    const army = group.find((s) => s.kind === 'army');
    const keep = army ?? group[0];
    if (!keep) continue;

    if (group.length > 1) {
      const absorbed = new Set<string>();
      for (const s of group) {
        if (s.id === keep.id) continue;
        keep.units += s.units;
        if (seat && s.kind === 'army' && s.armySize) returnToken(seat.tokens, s.armySize);
        absorbed.add(s.id);
      }
      if (absorbed.size) {
        state.stacks = state.stacks.filter((s) => !absorbed.has(s.id));
        remapStackIds(state, absorbed, keep.id);
      }
    }

    syncStackArmyKind(state, keep, { promote: true });
  }
}

function returnToken(pool: TokenPool, size: ArmySize): void {
  if (size === 3) pool.small += 1;
  else if (size === 5) pool.medium += 1;
  else pool.large += 1;
}

function takeToken(pool: TokenPool, size: ArmySize): boolean {
  if (size === 3 && pool.small > 0) {
    pool.small -= 1;
    return true;
  }
  if (size === 5 && pool.medium > 0) {
    pool.medium -= 1;
    return true;
  }
  if (size === 10 && pool.large > 0) {
    pool.large -= 1;
    return true;
  }
  return false;
}

function largestTokenFitting(pool: TokenPool, units: number): ArmySize | null {
  if (units >= 10 && pool.large > 0) return 10;
  if (units >= 5 && pool.medium > 0) return 5;
  if (units >= 3 && pool.small > 0) return 3;
  return null;
}

/** Apply unpaid upkeep: lose floor(units/2), retoken. */
export function applyUpkeepLoss(state: MatchState, stackId: string): MatchState {
  const next = cloneMatch(state);
  const stack = next.stacks.find((s) => s.id === stackId);
  if (!stack || stack.kind !== 'army') return next;
  const regionId = stack.regionId;
  const seat = seatOf(next, stack.factionId);
  const loss = upkeepLossAmount(stack.units);
  stack.units = Math.max(0, stack.units - loss);
  if (seat && stack.armySize) returnToken(seat.tokens, stack.armySize);
  if (stack.units <= 0) {
    next.stacks = next.stacks.filter((s) => s.id !== stackId);
    syncRegionOwnership(next, regionId);
    return next;
  }
  stack.kind = 'loose';
  delete stack.armySize;
  // Still 3+ → stay an army; below 3 → remains loose
  syncStackArmyKind(next, stack, { promote: true });
  return next;
}

export function payUpkeep(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  stackId: string,
  payerFactionId?: string,
): MatchState {
  assertPlay(state);
  const next = cloneMatch(state);
  assertPlay(next);
  const stack = next.stacks.find((s) => s.id === stackId);
  if (!stack) throw new Error('No stack');
  if (!armyNeedsUpkeepPayment(next, map, sea, stack)) throw new Error('No upkeep due');
  const active = activeSeat(next)!;
  const payer = payerFactionId ? seatOf(next, payerFactionId) : active;
  if (!payer || payer.coins < 1) throw new Error('Not enough coins');
  payer.coins -= 1;
  stack.upkeepPaid = true;
  pushLog(next, `Upkeep paid for army in ${regionById(map, stack.regionId)?.name ?? stack.regionId}`);
  return next;
}

export function resolveUnpaidUpkeep(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
): MatchState {
  assertPlay(state);
  let next = cloneMatch(state);
  assertPlay(next);
  const seat = activeSeat(next)!;
  const due = next.stacks.filter(
    (s) => s.factionId === seat.factionId && armyNeedsUpkeepPayment(next, map, sea, s),
  );
  for (const stack of due) {
    // Battle abort if unpaid while in battle with broken supply
    const inv = next.pendingInvasions.find(
      (i) => i.status === 'battle' && i.attackerStackIds.includes(stack.id),
    );
    if (inv) {
      next = abortBattleForSupply(next, map, inv.id);
      continue;
    }
    next = applyUpkeepLoss(next, stack.id);
    pushLog(
      next,
      `Unpaid upkeep: army in ${regionById(map, stack.regionId)?.name ?? stack.regionId} loses half`,
    );
  }
  return next;
}

/** Defeat scoring: each living unit = 1pt; larger wins; tie → attacker. */
function abortBattleForSupply(
  state: MatchState,
  map: CampaignMap,
  invasionId: string,
): MatchState {
  let next = cloneMatch(state);
  const inv = next.pendingInvasions.find((i) => i.id === invasionId);
  if (!inv) return next;
  const atkUnits = inv.attackerStackIds
    .map((id) => next.stacks.find((s) => s.id === id)?.units ?? 0)
    .reduce((a, b) => a + b, 0);
  const defStacks = stacksInRegion(next, inv.regionId).filter(
    (s) => s.factionId === inv.defenderFactionId,
  );
  const defUnits = defStacks.reduce((n, s) => n + s.units, 0);
  const attackerWins = atkUnits >= defUnits;
  pushLog(
    next,
    `Battle aborted (no supply upkeep): ${attackerWins ? 'attacker' : 'defender'} wins on points (${atkUnits} vs ${defUnits})`,
  );
  if (attackerWins) {
    next = applyDefeatExchange(next, map, inv, 'defender');
  } else {
    next = applyDefeatExchange(next, map, inv, 'attacker');
  }
  next.pendingInvasions = next.pendingInvasions.filter((i) => i.id !== invasionId);
  return next;
}

function resolveMoveCount(stack: CampaignStack, count?: number | 'all'): number {
  if (count === 'all' || count == null) return stack.units;
  return Math.floor(count);
}

/** Destinations for a stack moving `count` units (default: whole stack). Once/turn — moved stacks have none. */
export function legalMovesForStack(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  stackId: string,
  opts?: { count?: number | 'all' },
): LegalMove[] {
  const stack = state.stacks.find((s) => s.id === stackId);
  if (!stack || stack.moved) return [];
  const moveCount = resolveMoveCount(stack, opts?.count);
  if (moveCount < 1 || moveCount > stack.units) return [];

  // Capital cannot be left empty
  if (isCapitalRegion(map, stack.regionId)) {
    const owner = ownerOf(state, stack.regionId);
    if (owner && stack.factionId === owner) {
      const remaining = capitalGarrisonCount(state, map, stack.regionId) - moveCount;
      if (remaining < 1) return [];
    }
  }

  // Armies never peel — only whole-stack moves
  if (stack.kind === 'army' && moveCount !== stack.units) return [];

  const factionId = stack.factionId;
  const from = stack.regionId;
  const moves: LegalMove[] = [];
  // Only a ★ army (moved as a whole) may enter enemy-held / enemy-occupied regions
  const canInvade = stack.kind === 'army' && moveCount === stack.units;

  const tryAdd = (to: string, via: 'land' | 'sea', seaKind?: SeaRouteKind, coinCost = 0) => {
    if (to === from) return;
    const owner = ownerOf(state, to);
    const foreign = owner !== null && owner !== factionId && !stack.rebelOf;
    const enemyStacks = stacksInRegion(state, to).filter(
      (s) => s.factionId !== factionId && !(stack.rebelOf && s.rebelOf === stack.rebelOf),
    );
    if (foreign && !canInvade) return;
    if (enemyStacks.length && !canInvade) return;
    moves.push({ regionId: to, via, seaKind, coinCost });
  };

  // Land neighbors only from land regions (ocean stops have none)
  if (isLandLocation(map, from)) {
    for (const n of map.neighbors[from] ?? []) {
      tryAdd(n, 'land');
    }
  }
  for (const edge of sea[from] ?? []) {
    const asBlue = seaActsAsBlue(state, map, factionId, from, edge.to, edge.kind);
    const cost = asBlue ? 0 : 1;
    tryAdd(edge.to, 'sea', edge.kind, cost);
  }
  return moves;
}

function capitalGarrisonCount(state: MatchState, map: CampaignMap, regionId: string): number {
  if (!isCapitalRegion(map, regionId)) return 0;
  const owner = ownerOf(state, regionId);
  if (!owner) return 0;
  return totalUnitsOfFactionInRegion(state, regionId, owner);
}

/**
 * Move units from a stack to a bordering (or sea-linked) region.
 * `count: 1` peels one unit; `count: 'all'` (default) moves the whole stack.
 * Each stack moves at most once per turn.
 */
export function moveStack(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  stackId: string,
  toRegionId: string,
  opts?: { count?: number | 'all'; payerFactionId?: string },
): MatchState {
  assertPlay(state);
  const next = cloneMatch(state);
  assertPlay(next);
  const stack = next.stacks.find((s) => s.id === stackId);
  if (!stack) throw new Error('No stack');
  if (stack.moved) throw new Error('Already moved');

  const count = resolveMoveCount(stack, opts?.count);
  if (count < 1 || count > stack.units) throw new Error('Bad move count');

  const legal = legalMovesForStack(next, map, sea, stackId, { count });
  const dest = legal.find((m) => m.regionId === toRegionId);
  if (!dest) throw new Error('Illegal move');

  const seat = activeSeat(next)!;
  const payer = opts?.payerFactionId ? seatOf(next, opts.payerFactionId) : seat;
  const cost = dest.coinCost;
  if (cost > 0) {
    if (!payer || payer.coins < cost) throw new Error('Not enough coins');
    payer.coins -= cost;
  }

  if (isCapitalRegion(map, stack.regionId)) {
    const owner = ownerOf(next, stack.regionId);
    if (owner && stack.factionId === owner) {
      const remaining = capitalGarrisonCount(next, map, stack.regionId) - count;
      if (remaining < 1) throw new Error('Capital cannot be left empty');
    }
  }

  const fromId = stack.regionId;
  const invadesAsArmy = !stack.rebelOf && stack.kind === 'army' && count === stack.units;
  let mover: CampaignStack;

  const movedAtDest = stacksOfFactionInRegion(next, toRegionId, stack.factionId).find(
    (s) => s.moved && s.rebelOf === stack.rebelOf && s.id !== stack.id,
  );

  if (count === stack.units) {
    if (movedAtDest) {
      movedAtDest.units += stack.units;
      const ownerSeat = seatOf(next, stack.factionId);
      if (ownerSeat && stack.kind === 'army' && stack.armySize) {
        returnToken(ownerSeat.tokens, stack.armySize);
        stack.kind = 'loose';
        delete stack.armySize;
      }
      next.stacks = next.stacks.filter((s) => s.id !== stack.id);
      syncStackArmyKind(next, movedAtDest);
      mover = movedAtDest;
    } else {
      stack.regionId = toRegionId;
      stack.moved = true;
      mover = stack;
    }
  } else {
    if (stack.kind === 'army') throw new Error('Armies cannot split');
    // Peel: remainder stays as the region's unmoved stack
    stack.units -= count;
    syncStackArmyKind(next, stack);
    if (movedAtDest) {
      movedAtDest.units += count;
      syncStackArmyKind(next, movedAtDest);
      mover = movedAtDest;
    } else {
      mover = makeStack(next, {
        factionId: stack.factionId,
        regionId: toRegionId,
        units: count,
        kind: 'loose',
        moved: true,
        rebelOf: stack.rebelOf,
      });
      next.stacks.push(mover);
      syncStackArmyKind(next, mover);
    }
  }

  const atSea = isSeaStopLocation(map, toRegionId);
  const owner = ownerOf(next, toRegionId);
  const enemiesAtDest = stacksInRegion(next, toRegionId).filter(
    (s) => s.id !== mover.id && s.factionId !== mover.factionId && !mover.rebelOf,
  );
  if (invadesAsArmy && !atSea && owner && owner !== mover.factionId) {
    queueInvasion(next, map, sea, mover, fromId, owner);
  } else if (invadesAsArmy && !atSea && !owner) {
    queueInvasion(next, map, sea, mover, fromId, null);
  } else if (invadesAsArmy && enemiesAtDest.length) {
    queueInvasion(next, map, sea, mover, fromId, enemiesAtDest[0].factionId);
  }

  const label = count === 1 ? '1 unit' : `${count} units`;
  pushLog(
    next,
    `${factionLabel(map, mover.factionId)} moves ${label} to ${locationLabel(map, toRegionId)}`,
  );
  syncRegionOwnership(next, fromId, map);
  syncRegionOwnership(next, toRegionId, map);
  return next;
}

function queueInvasion(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  stack: CampaignStack,
  fromRegionId: string,
  defenderFactionId: string | null,
): void {
  let inv = state.pendingInvasions.find(
    (i) =>
      i.regionId === stack.regionId &&
      i.attackerFactionId === stack.factionId &&
      i.status === 'pending',
  );
  if (!inv) {
    inv = {
      id: `inv-${state.nextInvasionId++}`,
      regionId: stack.regionId,
      attackerFactionId: stack.factionId,
      attackerStackIds: [],
      fromRegionIds: [],
      defenderFactionId,
      status: 'pending',
      treachery: false,
      enteredSupplied: {},
    };
    state.pendingInvasions.push(inv);
  }
  if (!inv.attackerStackIds.includes(stack.id)) inv.attackerStackIds.push(stack.id);
  if (!inv.fromRegionIds.includes(fromRegionId)) inv.fromRegionIds.push(fromRegionId);
  inv.enteredSupplied[stack.id] = isStackSupplied(state, map, sea, {
    ...stack,
    regionId: fromRegionId,
  });
}

export function controllableStackIds(
  state: MatchState,
  map: CampaignMap,
  factionId: string,
): string[] {
  const ids: string[] = [];
  for (const s of state.stacks) {
    if (s.factionId === factionId && !s.rebelOf) {
      ids.push(s.id);
      continue;
    }
    if (s.rebelOf && !playerHoldsHomeCapital(state, map, factionId, s.rebelOf)) {
      ids.push(s.id);
    }
  }
  return ids;
}

export type InvasionChoice =
  | 'retreat'
  | 'defeat'
  | 'defend'
  | 'battle'
  | 'join'
  | 'auto';

export function retreatDestinations(
  state: MatchState,
  map: CampaignMap,
  invasion: PendingInvasion,
): string[] {
  const fromAttack = new Set(invasion.fromRegionIds);
  const out: string[] = [];
  for (const n of map.neighbors[invasion.regionId] ?? []) {
    if (fromAttack.has(n)) continue;
    const owner = ownerOf(state, n);
    const occupiedHostile = stacksInRegion(state, n).some(
      (s) =>
        s.factionId !== invasion.defenderFactionId &&
        !state.supplyGrants.some(
          (g) =>
            g.fromFactionId === invasion.defenderFactionId && g.toFactionId === s.factionId,
        ),
    );
    if (occupiedHostile) continue;
    // free adjacent: empty or owned by defender
    if (owner && owner !== invasion.defenderFactionId) continue;
    out.push(n);
  }
  return out;
}

function removeUnitsFromStacks(
  state: MatchState,
  stackIds: string[],
  loss: number,
): void {
  let left = loss;
  const touched = new Set<string>();
  for (const id of stackIds) {
    if (left <= 0) break;
    const s = state.stacks.find((x) => x.id === id);
    if (!s) continue;
    touched.add(s.regionId);
    const take = Math.min(s.units, left);
    s.units -= take;
    left -= take;
    if (s.units <= 0) {
      const seat = seatOf(state, s.factionId);
      if (seat && s.kind === 'army' && s.armySize) returnToken(seat.tokens, s.armySize);
      state.stacks = state.stacks.filter((x) => x.id !== s.id);
    } else {
      syncStackArmyKind(state, s);
    }
  }
  for (const rid of touched) syncRegionOwnership(state, rid);
}

function captureRegion(
  state: MatchState,
  map: CampaignMap,
  regionId: string,
  newOwner: string,
  previousOwner: string | null,
): void {
  const wasCapital = isCapitalRegion(map, regionId);
  state.regionOwners[regionId] = newOwner;

  if (!wasCapital) return;

  state.lastCapturedCapitalByFaction ??= {};
  state.lastCapturedCapitalByFaction[newOwner] = regionId;

  const seat = seatOf(state, newOwner);
  if (!seat) return;

  if (previousOwner && isBarbarianFaction(state, previousOwner)) {
    seat.coins += 1;
    pushLog(state, `${factionLabel(map, newOwner)} captures barbarian capital (+1 coin)`);
    triggerUprising(state, map, regionId, previousOwner);
  } else if (previousOwner && isPlayerFaction(state, previousOwner)) {
    const victim = seatOf(state, previousOwner);
    if (victim && victim.coins > 0) {
      victim.coins -= 1;
      seat.coins += 1;
      pushLog(state, `${factionLabel(map, newOwner)} steals 1 coin from capital`);
    } else {
      pushLog(state, `${factionLabel(map, newOwner)} captures capital (treasury empty)`);
    }
  } else {
    seat.coins += 1;
    pushLog(state, `${factionLabel(map, newOwner)} captures capital (+1 coin)`);
  }
}

function homeFactionForBarbarianCapital(
  state: MatchState,
  map: CampaignMap,
  capitalRegionId: string,
): string | null {
  for (const [factionId, regions] of Object.entries(state.homeRegions)) {
    if (factionId === BARBARIAN_ID) continue;
    if (!regions.includes(capitalRegionId)) continue;
    const reg = regionById(map, capitalRegionId);
    if (reg?.settlement.kind === 'capital') return factionId;
  }
  return null;
}

function triggerUprising(
  state: MatchState,
  map: CampaignMap,
  capitalRegionId: string,
  previousOwner: string,
): void {
  const home =
    homeFactionForBarbarianCapital(state, map, capitalRegionId) ??
    (previousOwner !== BARBARIAN_ID ? previousOwner : null);
  if (!home) return;
  for (const rid of state.homeRegions[home] ?? []) {
    const reg = regionById(map, rid);
    if (reg?.settlement.kind !== 'village') continue;
    const hasArmy = stacksInRegion(state, rid).some((s) => s.kind === 'army');
    if (hasArmy) continue;
    // spawn one rebel
    state.stacks.push(
      makeStack(state, {
        factionId: `rebel:${home}`,
        regionId: rid,
        units: 1,
        kind: 'loose',
        rebelOf: home,
      }),
    );
  }
  pushLog(state, `Uprising! Rebels spawn in ${factionLabel(map, home)} villages`);
}

function applyDefeatExchange(
  state: MatchState,
  map: CampaignMap,
  inv: PendingInvasion,
  loser: 'attacker' | 'defender',
): MatchState {
  const next = cloneMatch(state);
  if (loser === 'defender') {
    removeUnitsFromStacks(next, inv.attackerStackIds, 1);
    const defIds = stacksInRegion(next, inv.regionId)
      .filter((s) => s.factionId === inv.defenderFactionId)
      .map((s) => s.id);
    removeUnitsFromStacks(next, defIds, 3);
    const defLeft = stacksInRegion(next, inv.regionId).filter(
      (s) => s.factionId === inv.defenderFactionId,
    );
    if (defLeft.length === 0) {
      captureRegion(
        next,
        map,
        inv.regionId,
        inv.attackerFactionId,
        inv.defenderFactionId,
      );
    }
  } else {
    removeUnitsFromStacks(next, inv.attackerStackIds, 3);
    const defIds = stacksInRegion(next, inv.regionId)
      .filter((s) => s.factionId === inv.defenderFactionId)
      .map((s) => s.id);
    removeUnitsFromStacks(next, defIds, 1);
    // Attackers retreat conceptually — remove from region back? Plan: defeat exchange only.
    // Surviving attackers stay; if wiped, region stays defender.
  }
  return next;
}

export function resolveInvasionAuto(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  invasionId: string,
): MatchState | null {
  const inv = state.pendingInvasions.find((i) => i.id === invasionId);
  if (!inv || inv.status !== 'pending') return null;

  const defenders = stacksInRegion(state, inv.regionId).filter(
    (s) => !inv.attackerStackIds.includes(s.id),
  );
  const defUnits = defenders.reduce((n, s) => n + s.units, 0);
  const allBarb =
    defenders.length > 0 &&
    defenders.every((s) => isBarbarianFaction(state, s.factionId) || s.factionId === BARBARIAN_ID);

  // Empty / neutral
  if (defenders.length === 0) {
    let next = cloneMatch(state);
    const prev = ownerOf(next, inv.regionId);
    captureRegion(next, map, inv.regionId, inv.attackerFactionId, prev);
    next.pendingInvasions = next.pendingInvasions.filter((i) => i.id !== invasionId);
    return next;
  }

  // Barbarian-only
  if (allBarb || (inv.defenderFactionId && isBarbarianFaction(state, inv.defenderFactionId) && defUnits > 0 && defenders.every((d) => isBarbarianFaction(state, d.factionId)))) {
    let next = cloneMatch(state);
    for (const d of defenders) {
      next.stacks = next.stacks.filter((s) => s.id !== d.id);
    }
    const prev = ownerOf(next, inv.regionId) ?? BARBARIAN_ID;
    captureRegion(next, map, inv.regionId, inv.attackerFactionId, prev);
    syncRegionOwnership(next, inv.regionId);
    next.pendingInvasions = next.pendingInvasions.filter((i) => i.id !== invasionId);
    return next;
  }

  // 1–2 loose, not capital, not island → auto-retreat
  const capital = isCapitalRegion(map, inv.regionId);
  const island = isIsland(map, inv.regionId);
  const onlyLoose = defenders.every((d) => d.kind === 'loose');
  if (!capital && !island && onlyLoose && defUnits <= 2 && defUnits >= 1) {
    const dests = retreatDestinations(state, map, inv);
    if (dests.length === 0) {
      return resolveInvasionChoice(state, map, sea, invasionId, 'defeat');
    }
    let next = cloneMatch(state);
    const dest = dests[0];
    for (const d of defenders) {
      const s = next.stacks.find((x) => x.id === d.id);
      if (s) s.regionId = dest;
    }
    captureRegion(
      next,
      map,
      inv.regionId,
      inv.attackerFactionId,
      inv.defenderFactionId,
    );
    syncRegionOwnership(next, inv.regionId);
    syncRegionOwnership(next, dest);
    next.pendingInvasions = next.pendingInvasions.filter((i) => i.id !== invasionId);
    pushLog(next, `Defenders auto-retreat to ${regionById(map, dest)?.name ?? dest}`);
    return next;
  }

  return null;
}

export function resolveInvasionChoice(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  invasionId: string,
  choice: InvasionChoice,
  opts?: { retreatTo?: string; joinConfirm?: boolean },
): MatchState {
  let next = cloneMatch(state);
  const inv = next.pendingInvasions.find((i) => i.id === invasionId);
  if (!inv || inv.status !== 'pending') throw new Error('No invasion');

  if (choice === 'auto') {
    const auto = resolveInvasionAuto(next, map, sea, invasionId);
    if (auto) return auto;
    throw new Error('Needs defender choice');
  }

  if (choice === 'retreat') {
    if (isCapitalRegion(map, inv.regionId)) throw new Error('Cannot retreat from capital');
    if (isIsland(map, inv.regionId)) throw new Error('Cannot retreat from island');
    const dests = retreatDestinations(next, map, inv);
    const dest = opts?.retreatTo && dests.includes(opts.retreatTo) ? opts.retreatTo : dests[0];
    if (!dest) {
      return resolveInvasionChoice(next, map, sea, invasionId, 'defeat');
    }
    const defenders = stacksInRegion(next, inv.regionId).filter(
      (s) => s.factionId === inv.defenderFactionId,
    );
    for (const d of defenders) {
      d.regionId = dest;
    }
    captureRegion(next, map, inv.regionId, inv.attackerFactionId, inv.defenderFactionId);
    syncRegionOwnership(next, inv.regionId);
    syncRegionOwnership(next, dest);
    next.pendingInvasions = next.pendingInvasions.filter((i) => i.id !== invasionId);
    pushLog(next, 'Defender retreats');
    return next;
  }

  if (choice === 'defeat') {
    next = applyDefeatExchange(next, map, inv, 'defender');
    next.pendingInvasions = next.pendingInvasions.filter((i) => i.id !== invasionId);
    pushLog(next, 'Defender admits defeat (3:1)');
    return next;
  }

  if (choice === 'defend') {
    const defenders = stacksInRegion(next, inv.regionId)
      .filter((s) => s.factionId === inv.defenderFactionId)
      .map((s) => s.id);
    next.sieges.push({
      regionId: inv.regionId,
      attackerFactionId: inv.attackerFactionId,
      defenderFactionId: inv.defenderFactionId!,
      attackerStackIds: [...inv.attackerStackIds],
      defenderStackIds: defenders,
    });
    inv.status = 'siege';
    next.pendingInvasions = next.pendingInvasions.filter((i) => i.id !== invasionId);
    pushLog(next, `Siege at ${regionById(map, inv.regionId)?.name ?? inv.regionId}`);
    return next;
  }

  if (choice === 'battle') {
    inv.status = 'battle';
    for (const id of inv.attackerStackIds) {
      const s = next.stacks.find((x) => x.id === id);
      if (s) inv.enteredSupplied[id] = isStackSupplied(next, map, sea, s);
    }
    pushLog(next, `Battle declared at ${regionById(map, inv.regionId)?.name ?? inv.regionId}`);
    return next;
  }

  if (choice === 'join') {
    if (!opts?.joinConfirm) throw new Error('Join needs both sides');
    if (inv.defenderFactionId) {
      next.supplyGrants.push({
        fromFactionId: inv.attackerFactionId,
        toFactionId: inv.defenderFactionId,
      });
      next.supplyGrants.push({
        fromFactionId: inv.defenderFactionId,
        toFactionId: inv.attackerFactionId,
      });
    }
    next.pendingInvasions = next.pendingInvasions.filter((i) => i.id !== invasionId);
    pushLog(next, 'Armies join — shared territory, mutual supply');
    return next;
  }

  return next;
}

export function admitBattleDefeat(
  state: MatchState,
  map: CampaignMap,
  invasionId: string,
  loser: 'attacker' | 'defender',
): MatchState {
  let next = cloneMatch(state);
  const inv = next.pendingInvasions.find((i) => i.id === invasionId);
  if (!inv || inv.status !== 'battle') throw new Error('No battle');
  next = applyDefeatExchange(next, map, inv, loser);
  next.pendingInvasions = next.pendingInvasions.filter((i) => i.id !== invasionId);
  pushLog(next, `${loser} admits defeat in battle`);
  return next;
}

export function declareTreachery(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  regionId: string,
  attackerFactionId: string,
  defenderFactionId: string,
): MatchState {
  const next = cloneMatch(state);
  const atk = stacksOfFactionInRegion(next, regionId, attackerFactionId).filter(
    (s) => s.kind === 'army',
  );
  if (!atk.length) throw new Error('Need an army for treachery');
  const inv: PendingInvasion = {
    id: `inv-${next.nextInvasionId++}`,
    regionId,
    attackerFactionId,
    attackerStackIds: atk.map((s) => s.id),
    fromRegionIds: [regionId],
    defenderFactionId,
    status: 'battle',
    treachery: true,
    enteredSupplied: {},
  };
  for (const s of atk) {
    inv.enteredSupplied[s.id] = isStackSupplied(next, map, sea, s);
  }
  next.pendingInvasions.push(inv);
  pushLog(next, `Treachery in ${regionById(map, regionId)?.name ?? regionId}!`);
  return next;
}

export function toggleSupplyGrant(
  state: MatchState,
  fromFactionId: string,
  toFactionId: string,
): MatchState {
  const next = cloneMatch(state);
  const idx = next.supplyGrants.findIndex(
    (g) => g.fromFactionId === fromFactionId && g.toFactionId === toFactionId,
  );
  if (idx >= 0) next.supplyGrants.splice(idx, 1);
  else next.supplyGrants.push({ fromFactionId, toFactionId });
  return next;
}

export function applySiegeAttrition(state: MatchState, map: CampaignMap): MatchState {
  const next = cloneMatch(state);
  assertPlay(next);
  const seat = activeSeat(next)!;
  // End of attacker's turn: sieges they prosecute lose 1 defender unit
  for (const sg of [...next.sieges]) {
    if (sg.attackerFactionId !== seat.factionId) continue;
    removeUnitsFromStacks(next, sg.defenderStackIds, 1);
    const left = stacksInRegion(next, sg.regionId).filter(
      (s) => s.factionId === sg.defenderFactionId,
    );
    if (left.length === 0) {
      captureRegion(next, map, sg.regionId, sg.attackerFactionId, sg.defenderFactionId);
      next.sieges = next.sieges.filter((s) => s.regionId !== sg.regionId);
      pushLog(next, `Siege falls at ${regionById(map, sg.regionId)?.name ?? sg.regionId}`);
    }
  }
  return next;
}

export function packArmiesInRegion(
  state: MatchState,
  map: CampaignMap,
  regionId: string,
  factionId: string,
  choice?: 'upgrade' | 'separate',
): MatchState {
  const next = cloneMatch(state);
  const seat = seatOf(next, factionId);
  if (!seat) return next;

  const stacks = stacksOfFactionInRegion(next, regionId, factionId).filter((s) => !s.rebelOf);
  let total = stacks.reduce((n, s) => n + s.units, 0);
  if (total < 3) {
    next.armyPrompt = null;
    return next;
  }

  // Count tokens as if current armies in this region were returned
  const avail = { ...seat.tokens };
  for (const s of stacks) {
    if (s.kind === 'army' && s.armySize) {
      if (s.armySize === 3) avail.small += 1;
      else if (s.armySize === 5) avail.medium += 1;
      else avail.large += 1;
    }
  }

  // Prompt: 6+ units and both a medium upgrade and two smalls are possible
  if (choice === undefined && total >= 6 && avail.medium > 0 && avail.small >= 2) {
    next.armyPrompt = { regionId, factionId, units: total };
    return next;
  }

  // Dissolve existing army tokens back to pool then rebuild
  for (const s of stacks) {
    if (s.kind === 'army' && s.armySize) {
      returnToken(seat.tokens, s.armySize);
    }
  }
  next.stacks = next.stacks.filter(
    (s) => !(s.regionId === regionId && s.factionId === factionId && !s.rebelOf),
  );

  const placeArmy = (size: ArmySize) => {
    if (!takeToken(seat.tokens, size)) return false;
    next.stacks.push(
      makeStack(next, {
        factionId,
        regionId,
        units: size,
        kind: 'army',
        armySize: size,
      }),
    );
    total -= size;
    return true;
  };

  if (choice === 'separate') {
    while (total >= 3 && seat.tokens.small > 0) {
      placeArmy(3);
    }
  } else {
    // Greedy upgrade
    while (total >= 10 && seat.tokens.large > 0) placeArmy(10);
    while (total >= 5 && seat.tokens.medium > 0) placeArmy(5);
    while (total >= 3 && seat.tokens.small > 0) placeArmy(3);
  }

  if (total > 0) {
    next.stacks.push(
      makeStack(next, {
        factionId,
        regionId,
        units: total,
        kind: 'loose',
      }),
    );
  }

  next.armyPrompt = null;
  pushLog(
    next,
    `Armies packed in ${regionById(map, regionId)?.name ?? regionId}`,
  );
  return next;
}

/** Automatic armies phase: promote 3+ stacks, no prompts. */
export function runArmyPhase(state: MatchState, _map: CampaignMap): MatchState {
  assertPlay(state);
  const next = cloneMatch(state);
  assertPlay(next);
  formArmiesEndOfTurn(next, activeSeat(next)!.factionId);
  return next;
}

export function answerArmyPrompt(
  state: MatchState,
  map: CampaignMap,
  choice: 'upgrade' | 'separate',
): MatchState {
  if (!state.armyPrompt) return state;
  const { regionId, factionId } = state.armyPrompt;
  let next = packArmiesInRegion(state, map, regionId, factionId, choice);
  // Continue packing other regions
  if (next.phase.kind === 'play') {
    next = runArmyPhase(next, map);
  }
  return next;
}

/**
 * Start-of-turn: merge each region's stacks for this faction into one unmoved stack.
 * Arrivals from last turn (moved) combine with locals so everything can move again.
 */
export function consolidateFactionStacks(state: MatchState, factionId: string): void {
  const mine = state.stacks.filter((s) => s.factionId === factionId);
  const groups = new Map<string, CampaignStack[]>();
  for (const s of mine) {
    const key = `${s.regionId}\0${s.rebelOf ?? ''}`;
    const list = groups.get(key);
    if (list) list.push(s);
    else groups.set(key, [s]);
  }

  const seat = seatOf(state, factionId);

  for (const [, group] of groups) {
    if (group.length === 1) {
      group[0].moved = false;
      group[0].exhausted = false;
      delete group[0].upkeepPaid;
      syncStackArmyKind(state, group[0], { promote: true });
      continue;
    }

    const regionId = group[0].regionId;
    const rebelOf = group[0].rebelOf;
    const total = group.reduce((n, s) => n + s.units, 0);
    const oldIds = new Set(group.map((s) => s.id));

    for (const s of group) {
      if (seat && s.kind === 'army' && s.armySize) returnToken(seat.tokens, s.armySize);
    }
    state.stacks = state.stacks.filter((s) => !oldIds.has(s.id));
    if (total <= 0) continue;

    let kind: 'loose' | 'army' = 'loose';
    let armySize: ArmySize | undefined;
    if (!rebelOf && seat) {
      const fit = largestTokenFitting(seat.tokens, total);
      if (fit && takeToken(seat.tokens, fit)) {
        kind = 'army';
        armySize = fit;
      }
    }

    const stacked = makeStack(state, {
      factionId,
      regionId,
      units: total,
      kind,
      armySize,
      rebelOf,
      moved: false,
      exhausted: false,
    });
    delete stacked.upkeepPaid;
    state.stacks.push(stacked);
    if (syncStackArmyKind(state, stacked, { promote: true })) {
      /* recorded in lastFormedArmyByFaction */
    } else if (stacked.kind === 'army') {
      state.lastFormedArmyByFaction ??= {};
      state.lastFormedArmyByFaction[factionId] = stacked.id;
    }

    for (const inv of state.pendingInvasions) {
      if (!inv.attackerStackIds.some((id) => oldIds.has(id))) continue;
      inv.attackerStackIds = [
        ...new Set([
          ...inv.attackerStackIds.filter((id) => !oldIds.has(id)),
          stacked.id,
        ]),
      ];
      let supplied = false;
      for (const id of oldIds) {
        if (inv.enteredSupplied[id]) supplied = true;
        delete inv.enteredSupplied[id];
      }
      inv.enteredSupplied[stacked.id] = supplied;
    }
    for (const sg of state.sieges) {
      if (sg.attackerStackIds.some((id) => oldIds.has(id))) {
        sg.attackerStackIds = [
          ...new Set([
            ...sg.attackerStackIds.filter((id) => !oldIds.has(id)),
            stacked.id,
          ]),
        ];
      }
      if (sg.defenderStackIds.some((id) => oldIds.has(id))) {
        sg.defenderStackIds = [
          ...new Set([
            ...sg.defenderStackIds.filter((id) => !oldIds.has(id)),
            stacked.id,
          ]),
        ];
      }
    }
  }
}

export function advancePhase(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
): MatchState {
  assertPlay(state);
  let next = cloneMatch(state);
  assertPlay(next);

  const idx = TURN_PHASES.indexOf(next.phase.phase);
  if (next.phase.phase === 'taxes' && !next.phase.taxesCollected) {
    next = collectTaxes(next, map);
    assertPlay(next);
  }
  if (next.phase.phase === 'upkeep') {
    next = resolveUnpaidUpkeep(next, map, sea);
    assertPlay(next);
  }
  if (next.phase.phase === 'invasions') {
    // Auto-resolve what we can; leave battles/choices
    for (const inv of [...next.pendingInvasions]) {
      if (inv.status !== 'pending') continue;
      if (inv.attackerFactionId !== activeSeat(next)!.factionId) continue;
      const auto = resolveInvasionAuto(next, map, sea, inv.id);
      if (auto) next = auto;
    }
    assertPlay(next);
    const blocking = next.pendingInvasions.some(
      (i) =>
        i.attackerFactionId === activeSeat(next)!.factionId &&
        (i.status === 'pending' || i.status === 'battle'),
    );
    if (blocking) return next;
  }
  const passTurn = (state: MatchState): MatchState => {
    let s = state;
    assertPlay(s);
    formArmiesEndOfTurn(s, activeSeat(s)!.factionId);
    s = applySiegeAttrition(s, map);
    assertPlay(s);
    let pIdx = s.phase.playerIndex + 1;
    let round = s.phase.round;
    if (pIdx >= s.seats.length) {
      pIdx = 0;
      round += 1;
    }
    s.phase = {
      kind: 'play',
      phase: 'taxes',
      playerIndex: pIdx,
      round,
      taxesCollected: false,
    };
    consolidateFactionStacks(s, s.seats[pIdx].factionId);
    pushLog(s, `— ${factionLabel(map, s.seats[pIdx].factionId)} turn (round ${round}) —`);
    return s;
  };

  if (idx >= TURN_PHASES.length - 1) {
    // Leaving armies (or last phase): form ★ armies and hand off
    return passTurn(next);
  }

  next.phase = {
    ...next.phase,
    phase: TURN_PHASES[idx + 1],
  };
  const seatId = activeSeat(next)!.factionId;
  // No campaigning army needing !!! upkeep → skip
  if (
    next.phase.phase === 'upkeep' &&
    armiesNeedingUpkeep(next, map, sea, seatId).length === 0
  ) {
    next.phase = { ...next.phase, phase: 'move' };
  }
  // No armies entered enemy/neutral territory → skip invasions
  if (
    next.phase.phase === 'invasions' &&
    !next.pendingInvasions.some(
      (i) =>
        i.attackerFactionId === seatId &&
        (i.status === 'pending' || i.status === 'battle'),
    )
  ) {
    next.phase = { ...next.phase, phase: 'armies' };
  }
  // Armies phase is automatic — form ★ and pass the turn
  if (next.phase.phase === 'armies') {
    return passTurn(next);
  }
  return next;
}

export function setPhase(
  state: MatchState,
  phase: TurnPhase,
): MatchState {
  assertPlay(state);
  const next = cloneMatch(state);
  assertPlay(next);
  next.phase = { ...next.phase, phase };
  return next;
}

/** Tiny map helper for tests. */
export function testMap(partial?: Partial<CampaignMap>): CampaignMap {
  const regions = partial?.regions ?? [
    {
      id: 'a',
      name: 'A',
      ring: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      ownerId: 'rome',
      settlement: {
        kind: 'capital',
        key: 'rome',
        at: { x: 5, y: 5 },
        units: ['infantry'],
      },
    },
    {
      id: 'b',
      name: 'B',
      ring: [
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 10 },
        { x: 10, y: 10 },
      ],
      ownerId: 'rome',
      settlement: { kind: 'village', at: { x: 15, y: 5 } },
    },
    {
      id: 'c',
      name: 'C',
      ring: [
        { x: 20, y: 0 },
        { x: 30, y: 0 },
        { x: 30, y: 10 },
        { x: 20, y: 10 },
      ],
      ownerId: 'gaule',
      settlement: {
        kind: 'capital',
        key: 'paris',
        at: { x: 25, y: 5 },
        units: ['infantry'],
      },
    },
    {
      id: 'd',
      name: 'D',
      ring: [
        { x: 30, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 10 },
        { x: 30, y: 10 },
      ],
      ownerId: 'gaule',
      settlement: { kind: 'village', at: { x: 35, y: 5 } },
    },
    {
      id: 'island',
      name: 'Island',
      ring: [
        { x: 100, y: 0 },
        { x: 110, y: 0 },
        { x: 110, y: 10 },
        { x: 100, y: 10 },
      ],
      ownerId: 'gaule',
      settlement: { kind: 'none' },
    },
  ];
  return {
    id: 'europe',
    name: 'Test',
    view: { x: 0, y: 0, w: 100, h: 100 },
    factions: [
      { id: 'barbarians', name: 'Barbarians', color: '#6b5b4b' },
      { id: 'rome', name: 'Rome', color: '#b71c1c' },
      { id: 'gaule', name: 'Gaule', color: '#2e7d32' },
      { id: 'spain', name: 'Spain', color: '#c62828' },
    ],
    regions,
    seaNodes: partial?.seaNodes ?? [
      { id: 'p1', kind: 'port', at: { x: 0, y: 0 }, regionId: 'a' },
      { id: 'p2', kind: 'port', at: { x: 1, y: 0 }, regionId: 'c' },
    ],
    seaLinks: partial?.seaLinks ?? [{ id: 'l1', kind: 'red', a: 'p1', b: 'p2' }],
    neighbors: partial?.neighbors ?? {
      a: ['b'],
      b: ['a', 'c'],
      c: ['b', 'd'],
      d: ['c'],
      island: [],
    },
  };
}
