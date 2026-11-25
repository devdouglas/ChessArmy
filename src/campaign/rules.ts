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
  isNeutralFaction,
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

/** Factions with at least one unit in the region (incl. fallen-capital remnants). */
function presentFactionsInRegion(state: MatchState, regionId: string): Set<string> {
  const present = new Set<string>();
  for (const s of stacksInRegion(state, regionId)) {
    present.add(s.factionId);
  }
  return present;
}

/**
 * Ownership follows presence: empty → unowned;
 * exactly one faction (incl. rebel:*) → that faction; contested → keep current if still present else null.
 * Remnants hold ground so they can retreat to adjacent owned land like anyone else.
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

function regionSuppliedGivenOccupied(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  factionId: string,
  regionId: string,
  occupied: Set<string>,
): boolean {
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

export function isRegionSupplied(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  factionId: string,
  regionId: string,
): boolean {
  return regionSuppliedGivenOccupied(
    state,
    map,
    sea,
    factionId,
    regionId,
    occupiedByForSupply(state, factionId),
  );
}

/** Occupied set as if `stack` moved `moveCount` units to `toRegionId`. */
function occupiedAfterMove(
  state: MatchState,
  stack: CampaignStack,
  moveCount: number,
  toRegionId: string,
): Set<string> {
  const grantors = new Set<string>([stack.factionId]);
  for (const g of state.supplyGrants) {
    if (g.toFactionId === stack.factionId) grantors.add(g.fromFactionId);
  }
  const regions = new Set<string>();
  for (const s of state.stacks) {
    if (!grantors.has(s.factionId) || s.rebelOf) continue;
    if (s.id === stack.id) {
      if (s.units - moveCount > 0) regions.add(s.regionId);
      if (moveCount > 0) regions.add(toRegionId);
      continue;
    }
    regions.add(s.regionId);
  }
  return regions;
}

/** Loose units may only step onto regions that stay capital-supplied after the move. */
function looseMoveKeepsSupply(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  stack: CampaignStack,
  moveCount: number,
  toRegionId: string,
): boolean {
  if (stack.rebelOf) return true;
  const occupied = occupiedAfterMove(state, stack, moveCount, toRegionId);
  return regionSuppliedGivenOccupied(
    state,
    map,
    sea,
    stack.factionId,
    toRegionId,
    occupied,
  );
}

/**
 * End of turn: lose loose units that are cut off from a capital.
 * ★ armies are kept (paid upkeep earlier, or still campaigning until next upkeep).
 */
export function cullUnsuppliedLooseStacks(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  factionId: string,
): void {
  const doomed = state.stacks.filter(
    (s) =>
      s.factionId === factionId &&
      !s.rebelOf &&
      s.kind === 'loose' &&
      !isStackInBattleOrWaiting(state, s.id) &&
      !isStackSupplied(state, map, sea, s),
  );
  if (doomed.length === 0) return;
  const ids = new Set(doomed.map((s) => s.id));
  const units = doomed.reduce((n, s) => n + s.units, 0);
  const regions = new Set(doomed.map((s) => s.regionId));
  state.stacks = state.stacks.filter((s) => !ids.has(s.id));
  for (const rid of regions) syncRegionOwnership(state, rid, map);
  pushLog(
    state,
    `${factionLabel(map, factionId)} loses ${units} detached unit${units === 1 ? '' : 's'} (cut from capital)`,
  );
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
    if (
      inv.status === 'battle' ||
      inv.status === 'pending' ||
      inv.status === 'awaiting_defender'
    ) {
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

/** Open contact that must be resolved before leaving move. */
export function openInvasionContacts(state: MatchState): PendingInvasion[] {
  return state.pendingInvasions.filter(
    (i) => i.status === 'pending' || i.status === 'awaiting_defender',
  );
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

function hasHostileUnits(state: MatchState, regionId: string, factionId: string): boolean {
  return stacksInRegion(state, regionId).some(
    (s) => s.factionId !== factionId && !s.rebelOf,
  );
}

/**
 * Territory that can project into unowned land: needs a ready unit.
 * Cooldown / exhausted-only tiles do not seed further claims.
 */
function regionsRecruitFrom(state: MatchState, factionId: string): Set<string> {
  const ids = new Set<string>();
  for (const s of state.stacks) {
    if (s.factionId !== factionId || s.rebelOf) continue;
    if (s.moved || s.exhausted) continue;
    ids.add(s.regionId);
  }
  return ids;
}

function occupiedAfterRecruit(
  state: MatchState,
  factionId: string,
  regionId: string,
): Set<string> {
  const occupied = occupiedByForSupply(state, factionId);
  occupied.add(regionId);
  return occupied;
}

function canPlaceRecruitUnit(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  factionId: string,
  regionId: string,
): boolean {
  if (!isLandLocation(map, regionId)) return false;
  // Sieged towns/capitals cannot be reinforced by recruit
  if (state.sieges.some((sg) => sg.regionId === regionId)) return false;
  if (hasHostileUnits(state, regionId, factionId)) return false;
  return regionSuppliedGivenOccupied(
    state,
    map,
    sea,
    factionId,
    regionId,
    occupiedAfterRecruit(state, factionId, regionId),
  );
}

/**
 * Place-unit targets (single Recruit action):
 * - any region you own (settlement or open ground), or
 * - unowned empty land adjacent to territory that still has a ready unit.
 * Must stay capital-supplied after the unit lands.
 */
export function recruitableRegions(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  factionId: string,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const r of map.regions) {
    if (ownerOf(state, r.id) !== factionId) continue;
    if (!canPlaceRecruitUnit(state, map, sea, factionId, r.id)) continue;
    seen.add(r.id);
    out.push(r.id);
  }

  const from = regionsRecruitFrom(state, factionId);
  for (const c of from) {
    for (const n of map.neighbors[c] ?? []) {
      if (seen.has(n)) continue;
      if (!isLandLocation(map, n)) continue;
      if (ownerOf(state, n) != null) continue;
      if (stacksInRegion(state, n).length > 0) continue;
      if (!canPlaceRecruitUnit(state, map, sea, factionId, n)) continue;
      seen.add(n);
      out.push(n);
    }
  }

  return out;
}

function placeCooldownUnit(
  state: MatchState,
  _map: CampaignMap,
  factionId: string,
  regionId: string,
): CampaignStack {
  const cooldown = stacksOfFactionInRegion(state, regionId, factionId).find(
    (s) => s.moved && !s.rebelOf,
  );
  let placed: CampaignStack;
  if (cooldown) {
    cooldown.units += 1;
    placed = cooldown;
  } else {
    placed = makeStack(state, {
      factionId,
      regionId,
      units: 1,
      kind: 'loose',
      moved: true,
      exhausted: false,
    });
    state.stacks.push(placed);
  }
  syncStackArmyKind(state, placed);
  syncRegionOwnership(state, regionId);
  return placed;
}

/**
 * Spend 1¢ to place a unit in cooldown (moved). Any owned region or unowned adjacent.
 */
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

  payer.coins -= 1;
  placeCooldownUnit(next, map, seat.factionId, regionId);
  pushLog(
    next,
    `${factionLabel(map, seat.factionId)} recruits in ${regionById(map, regionId)?.name ?? regionId} (cooldown)`,
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
  const seat = activeSeat(state);
  if (!seat || stack.factionId !== seat.factionId || stack.rebelOf) return [];
  const moveCount = resolveMoveCount(stack, opts?.count);
  if (moveCount < 1 || moveCount > stack.units) return [];

  // Capital cannot be left empty by loose peels / non-army moves.
  if (stack.kind !== 'army' && isCapitalRegion(map, stack.regionId)) {
    const owner = ownerOf(state, stack.regionId);
    if (owner && stack.factionId === owner) {
      const remaining = capitalGarrisonCount(state, map, stack.regionId) - moveCount;
      if (remaining < 1) return [];
    }
  }

  // Armies never peel — only whole-stack moves
  if (stack.kind === 'army' && moveCount !== stack.units) return [];

  // ★ leaving owned land alone auto-buys a 1¢ garrison — broke / besieged = no march
  if (
    stack.kind === 'army' &&
    moveCount === stack.units &&
    needsDepartGarrison(state, map, stackId)
  ) {
    const pay = departRecruitStatus(state, stack.factionId, undefined, stack.regionId);
    if (!pay.ok) return [];
  }

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
    // Loose units stay on the capital supply net — no voluntary detach
    if (
      stack.kind === 'loose' &&
      !looseMoveKeepsSupply(state, map, sea, stack, moveCount, to)
    ) {
      return;
    }
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

  const seat = activeSeat(next)!;
  if (stack.factionId !== seat.factionId || stack.rebelOf) {
    throw new Error('Not your units');
  }

  const count = resolveMoveCount(stack, opts?.count);
  if (count < 1 || count > stack.units) throw new Error('Bad move count');

  const needsGar =
    stack.kind === 'army' &&
    count === stack.units &&
    needsDepartGarrison(next, map, stackId);

  const legal = legalMovesForStack(next, map, sea, stackId, { count });
  const dest = legal.find((m) => m.regionId === toRegionId);
  if (!dest) throw new Error('Illegal move');

  const payer = opts?.payerFactionId ? seatOf(next, opts.payerFactionId) : seat;
  // Settlement depart garrison (1¢) + any sea toll
  const garrisonCost = needsGar ? 1 : 0;
  const cost = dest.coinCost + garrisonCost;
  if (cost > 0) {
    if (!payer || payer.coins < cost) throw new Error('Not enough coins');
  }
  if (dest.coinCost > 0) {
    payer!.coins -= dest.coinCost;
  }

  if (stack.kind !== 'army' && isCapitalRegion(map, stack.regionId)) {
    const owner = ownerOf(next, stack.regionId);
    if (owner && stack.factionId === owner) {
      const remaining = capitalGarrisonCount(next, map, stack.regionId) - count;
      if (remaining < 1) throw new Error('Capital cannot be left empty');
    }
  }

  const fromId = stack.regionId;
  if (needsGar) {
    recruitDepartGarrison(next, map, stack.factionId, fromId, opts?.payerFactionId);
  }
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
  if (invadesAsArmy && !atSea) {
    // Remnants whose capital you don't hold defect into this ★
    absorbNeutralRemnants(next, map, mover);
    const owner = ownerOf(next, toRegionId);
    const hostiles = stacksInRegion(next, toRegionId).filter(
      (s) => s.id !== mover.id && s.factionId !== mover.factionId,
    );
    if (owner && owner !== mover.factionId) {
      queueInvasion(next, map, sea, mover, fromId, owner);
    } else if (hostiles.length) {
      queueInvasion(next, map, sea, mover, fromId, hostiles[0]!.factionId);
    } else if (!owner) {
      queueInvasion(next, map, sea, mover, fromId, null);
    }
  }

  const label = count === 1 ? '1 unit' : `${count} units`;
  pushLog(
    next,
    `${factionLabel(map, mover.factionId)} moves ${label} to ${locationLabel(map, toRegionId)}`,
  );
  syncRegionOwnership(next, fromId, map);
  syncRegionOwnership(next, toRegionId, map);

  // Resolve / classify contact immediately — move and invasions are linked
  const contact = next.pendingInvasions.find(
    (i) =>
      i.regionId === toRegionId &&
      i.attackerFactionId === mover.factionId &&
      (i.status === 'pending' || i.status === 'awaiting_defender'),
  );
  if (contact) {
    const auto = resolveInvasionAuto(next, map, sea, contact.id);
    if (auto) return auto;
    classifyInvasionContact(next, map, contact.id);
  }
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
  _map: CampaignMap,
  factionId: string,
): string[] {
  // Fallen-capital remnants (rebelOf) are neutral — nobody controls them until they defect
  return state.stacks.filter((s) => s.factionId === factionId && !s.rebelOf).map((s) => s.id);
}

export type InvasionChoice =
  | 'wait'
  | 'attack'
  | 'retreat'
  | 'defeat'
  | 'defend'
  | 'battle'
  | 'join'
  | 'auto';

function invasionDefenders(state: MatchState, invasion: PendingInvasion): CampaignStack[] {
  return stacksInRegion(state, invasion.regionId).filter(
    (s) =>
      !invasion.attackerStackIds.includes(s.id) &&
      (invasion.defenderFactionId
        ? s.factionId === invasion.defenderFactionId
        : s.factionId !== invasion.attackerFactionId),
  );
}

export function invasionHasDefendingArmy(
  state: MatchState,
  invasion: PendingInvasion,
): boolean {
  return invasionDefenders(state, invasion).some((s) => s.kind === 'army');
}

/**
 * Retreat destinations: adjacent land the defender owns (not the approach hex, no hostiles).
 * No teleport — ★ and loose use the same adjacency rule.
 */
export function neighboringOwnedRetreatDestinations(
  state: MatchState,
  map: CampaignMap,
  invasion: PendingInvasion,
): string[] {
  if (!invasion.defenderFactionId) return [];
  const fromAttack = new Set(invasion.fromRegionIds);
  const out: string[] = [];
  for (const n of map.neighbors[invasion.regionId] ?? []) {
    if (fromAttack.has(n)) continue;
    if (ownerOf(state, n) !== invasion.defenderFactionId) continue;
    if (hasHostileUnits(state, n, invasion.defenderFactionId)) continue;
    out.push(n);
  }
  return out;
}

/** @deprecated Alias — same as neighboringOwnedRetreatDestinations. */
export function armyRetreatDestinations(
  state: MatchState,
  map: CampaignMap,
  invasion: PendingInvasion,
): string[] {
  return neighboringOwnedRetreatDestinations(state, map, invasion);
}

/** Destinations for a manual retreat (adjacent owned only). */
export function retreatDestinations(
  state: MatchState,
  map: CampaignMap,
  invasion: PendingInvasion,
): string[] {
  return neighboringOwnedRetreatDestinations(state, map, invasion);
}

/** After auto-resolve fails: ★ defenders → attacker Wait/Attack; else defender responds. */
function classifyInvasionContact(
  state: MatchState,
  _map: CampaignMap,
  invasionId: string,
): void {
  const inv = state.pendingInvasions.find((i) => i.id === invasionId);
  if (!inv || inv.status !== 'pending') return;
  if (invasionHasDefendingArmy(state, inv)) {
    // stay pending — attacker Wait / Attack
    return;
  }
  inv.status = 'awaiting_defender';
}

/** Town/capital the defender owns — otherwise only Retreat / Battle. */
export function canSiegeRegion(
  state: MatchState,
  map: CampaignMap,
  regionId: string,
  defenderFactionId: string | null,
): boolean {
  if (!defenderFactionId) return false;
  if (ownerOf(state, regionId) !== defenderFactionId) return false;
  const kind = regionById(map, regionId)?.settlement.kind;
  return kind === 'capital' || kind === 'village';
}

export function isSettlementRegion(map: CampaignMap, regionId: string): boolean {
  const kind = regionById(map, regionId)?.settlement.kind;
  return kind === 'capital' || kind === 'village';
}

/**
 * ★ is the only friendly presence on owned land (settlement or open) — leaving
 * auto-spends 1¢ for a cooldown garrison. No coins / under siege → cannot march.
 * Foreign / vacant land just empties.
 */
export function needsDepartGarrison(
  state: MatchState,
  map: CampaignMap,
  stackId: string,
): boolean {
  const stack = state.stacks.find((s) => s.id === stackId);
  if (!stack || stack.kind !== 'army' || stack.rebelOf) return false;
  if (!isLandLocation(map, stack.regionId)) return false;
  if (ownerOf(state, stack.regionId) !== stack.factionId) return false;
  const total = totalUnitsOfFactionInRegion(state, stack.regionId, stack.factionId);
  return total <= stack.units;
}

/** @deprecated Alias — same as needsDepartGarrison. */
export function needsGarrisonDepartChoice(
  state: MatchState,
  map: CampaignMap,
  stackId: string,
): boolean {
  return needsDepartGarrison(state, map, stackId);
}

export function departRecruitStatus(
  state: MatchState,
  factionId: string,
  payerFactionId?: string,
  fromRegionId?: string,
): { ok: true } | { ok: false; reason: string } {
  const payer = payerFactionId ? seatOf(state, payerFactionId) : seatOf(state, factionId);
  if (!payer) return { ok: false, reason: 'No treasury' };
  if (payer.coins < 1) return { ok: false, reason: 'Need 1¢ in the bank' };
  if (fromRegionId && state.sieges.some((sg) => sg.regionId === fromRegionId)) {
    return { ok: false, reason: 'Cannot recruit under siege' };
  }
  return { ok: true };
}

/** Place 1¢ cooldown garrison on the owned land you're about to leave. */
function recruitDepartGarrison(
  state: MatchState,
  map: CampaignMap,
  factionId: string,
  regionId: string,
  payerFactionId?: string,
): void {
  const payer = payerFactionId ? seatOf(state, payerFactionId) : seatOf(state, factionId);
  if (!payer) throw new Error('No payer');
  if (payer.coins < 1) throw new Error('Not enough coins');
  if (!isLandLocation(map, regionId)) throw new Error('Not land');
  if (ownerOf(state, regionId) !== factionId) throw new Error('Not your land');
  if (state.sieges.some((sg) => sg.regionId === regionId)) {
    throw new Error('Cannot recruit under siege');
  }
  payer.coins -= 1;
  placeCooldownUnit(state, map, factionId, regionId);
  pushLog(
    state,
    `${factionLabel(map, factionId)} leaves a garrison in ${locationLabel(map, regionId)} (−1¢)`,
  );
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

  // Presence may have already flipped ownership before resolve — never loot/neutralize self
  if (previousOwner === newOwner) return;

  // After ownership flip — any capital still held means the faction survives
  const lastCapital =
    !!previousOwner && capitalIdsOwnedBy(state, map, previousOwner).length === 0;

  if (
    previousOwner &&
    (isBarbarianFaction(state, previousOwner) || isNeutralFaction(state, previousOwner))
  ) {
    seat.coins += 1;
    const kind = isBarbarianFaction(state, previousOwner) ? 'barbarian' : 'neutral';
    pushLog(state, `${factionLabel(map, newOwner)} captures ${kind} capital (+1 coin)`);
    if (isBarbarianFaction(state, previousOwner)) {
      triggerUprising(state, map, regionId, previousOwner);
    } else if (lastCapital) {
      // Unpicked homeland: remnants go neutral only when their last capital falls
      neutralizeFaction(state, map, previousOwner);
    }
  } else if (previousOwner && isPlayerFaction(state, previousOwner)) {
    const victim = seatOf(state, previousOwner);
    if (victim && victim.coins > 0) {
      victim.coins -= 1;
      seat.coins += 1;
      pushLog(state, `${factionLabel(map, newOwner)} steals 1 coin from capital`);
    } else {
      pushLog(state, `${factionLabel(map, newOwner)} captures capital (treasury empty)`);
    }
    if (lastCapital) {
      neutralizeFaction(state, map, previousOwner);
    }
  } else {
    seat.coins += 1;
    pushLog(state, `${factionLabel(map, newOwner)} captures capital (+1 coin)`);
  }
}

/**
 * Last capital fell — every remaining stack of that faction becomes a neutral remnant
 * (`rebelOf` = home). They still hold their hexes (for retreat) until a ★ absorbs them.
 */
function neutralizeFaction(state: MatchState, map: CampaignMap, factionId: string): void {
  if (!factionId || factionId === BARBARIAN_ID) return;
  let units = 0;
  const touched = new Set<string>();
  for (const s of state.stacks) {
    if (s.rebelOf === factionId) continue;
    if (s.factionId !== factionId) continue;
    s.rebelOf = factionId;
    s.factionId = `rebel:${factionId}`;
    units += s.units;
    touched.add(s.regionId);
  }
  for (const rid of touched) syncRegionOwnership(state, rid, map);
  if (units > 0) {
    pushLog(
      state,
      `${factionLabel(map, factionId)} falls — ${units} unit${units === 1 ? '' : 's'} turn neutral`,
    );
  }
}

/**
 * Remnants whose capital is held by `armyFaction` stay hostile to that faction.
 * Any other ★ entering their hex absorbs them into the army.
 * Returns how many units joined.
 */
function absorbNeutralRemnants(
  state: MatchState,
  map: CampaignMap,
  army: CampaignStack,
): number {
  if (army.kind !== 'army' || army.rebelOf) return 0;
  let joined = 0;
  const here = stacksInRegion(state, army.regionId).filter(
    (s) => s.id !== army.id && s.rebelOf,
  );
  for (const rem of here) {
    const home = rem.rebelOf!;
    // Conqueror holding their capital does not get free defections
    if (playerHoldsHomeCapital(state, map, army.factionId, home)) continue;

    joined += rem.units;
    army.units += rem.units;
    const remSeat = seatOf(state, rem.factionId);
    // rebel stacks shouldn't hold army tokens, but return if somehow
    if (remSeat && rem.kind === 'army' && rem.armySize) {
      returnToken(remSeat.tokens, rem.armySize);
    }
    state.stacks = state.stacks.filter((s) => s.id !== rem.id);
  }
  if (joined > 0) {
    if (army.kind === 'army') {
      army.armySize = army.units >= 10 ? 10 : army.units >= 5 ? 5 : 3;
    } else {
      syncStackArmyKind(state, army, { promote: true });
    }
    pushLog(
      state,
      `${joined} neutral remnant${joined === 1 ? '' : 's'} join ${factionLabel(map, army.factionId)}`,
    );
    syncRegionOwnership(state, army.regionId, map);
  }
  return joined;
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
  _sea: Record<string, SeaAdjacency[]>,
  invasionId: string,
): MatchState | null {
  const inv = state.pendingInvasions.find((i) => i.id === invasionId);
  if (!inv || inv.status !== 'pending') return null;

  const defenders = stacksInRegion(state, inv.regionId).filter(
    (s) => !inv.attackerStackIds.includes(s.id),
  );
  const defUnits = defenders.reduce((n, s) => n + s.units, 0);
  const allBarb =
    defenders.length > 0 && defenders.every((s) => s.factionId === BARBARIAN_ID);

  // Empty — trust invasion.defenderFactionId; presence sync may already show attacker
  if (defenders.length === 0) {
    let next = cloneMatch(state);
    captureRegion(
      next,
      map,
      inv.regionId,
      inv.attackerFactionId,
      inv.defenderFactionId,
    );
    next.pendingInvasions = next.pendingInvasions.filter((i) => i.id !== invasionId);
    return next;
  }

  // True barbarian-only (not homeland neutrals)
  if (allBarb) {
    let next = cloneMatch(state);
    for (const d of defenders) {
      next.stacks = next.stacks.filter((s) => s.id !== d.id);
    }
    const prev = inv.defenderFactionId ?? BARBARIAN_ID;
    captureRegion(next, map, inv.regionId, inv.attackerFactionId, prev);
    syncRegionOwnership(next, inv.regionId);
    next.pendingInvasions = next.pendingInvasions.filter((i) => i.id !== invasionId);
    return next;
  }

  // 1–2 loose, not capital, not island → auto-retreat to neighboring owned
  const capital = isCapitalRegion(map, inv.regionId);
  const island = isIsland(map, inv.regionId);
  const onlyLoose = defenders.every((d) => d.kind === 'loose');
  if (!capital && !island && onlyLoose && defUnits <= 2 && defUnits >= 1) {
    const dests = neighboringOwnedRetreatDestinations(state, map, inv);
    if (dests.length === 0) {
      // Nowhere adjacent owned → automatic battle
      const fight = cloneMatch(state);
      const fightInv = fight.pendingInvasions.find((i) => i.id === invasionId)!;
      fightInv.status = 'awaiting_defender';
      pushLog(fight, 'No adjacent owned land to retreat — battle');
      return resolveBattleDice(fight, map, invasionId);
    }
    let next = cloneMatch(state);
    const dest = dests[0]!;
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
  if (!inv) throw new Error('No invasion');

  if (choice === 'auto') {
    if (inv.status !== 'pending' && inv.status !== 'awaiting_defender') {
      throw new Error('No invasion');
    }
    const auto = resolveInvasionAuto(next, map, sea, invasionId);
    if (auto) return auto;
    throw new Error('Needs defender choice');
  }

  // Attacker: hold without pressing the attack
  if (choice === 'wait') {
    if (inv.status !== 'pending') throw new Error('Wait only at contact');
    next.pendingInvasions = next.pendingInvasions.filter((i) => i.id !== invasionId);
    pushLog(
      next,
      `${factionLabel(map, inv.attackerFactionId)} waits at ${regionById(map, inv.regionId)?.name ?? inv.regionId}`,
    );
    return next;
  }

  // Attacker presses attack → defender responds
  if (choice === 'attack') {
    if (inv.status !== 'pending') throw new Error('Attack only at contact');
    inv.status = 'awaiting_defender';
    pushLog(
      next,
      `${factionLabel(map, inv.attackerFactionId)} attacks — defender must respond`,
    );
    return next;
  }

  // Defender responses only after Attack (or auto-classified non-★ contact)
  if (
    choice === 'retreat' ||
    choice === 'defend' ||
    choice === 'battle' ||
    choice === 'defeat' ||
    choice === 'join'
  ) {
    if (inv.status !== 'awaiting_defender') {
      throw new Error('Defender responds after Attack');
    }
  }

  if (choice === 'retreat') {
    const armyDef = invasionHasDefendingArmy(next, inv);
    // Loose cannot flight from capital; ★ can (abandons the capital)
    if (isCapitalRegion(map, inv.regionId) && !armyDef) {
      throw new Error('Cannot retreat from capital');
    }
    if (isIsland(map, inv.regionId)) throw new Error('Cannot retreat from island');
    const dests = retreatDestinations(next, map, inv);
    const dest = opts?.retreatTo && dests.includes(opts.retreatTo) ? opts.retreatTo : dests[0];
    if (!dest) {
      pushLog(next, 'No adjacent owned land to retreat — battle');
      return resolveBattleDice(next, map, invasionId);
    }
    const defenders = invasionDefenders(next, inv);
    for (const d of defenders) {
      d.regionId = dest;
      d.moved = true;
    }
    captureRegion(next, map, inv.regionId, inv.attackerFactionId, inv.defenderFactionId);
    syncRegionOwnership(next, inv.regionId);
    syncRegionOwnership(next, dest);
    next.pendingInvasions = next.pendingInvasions.filter((i) => i.id !== invasionId);
    pushLog(next, `Defender retreats to ${regionById(map, dest)?.name ?? dest}`);
    return next;
  }

  if (choice === 'defeat') {
    next = applyDefeatExchange(next, map, inv, 'defender');
    next.pendingInvasions = next.pendingInvasions.filter((i) => i.id !== invasionId);
    pushLog(next, 'Defender admits defeat (3:1)');
    return next;
  }

  if (choice === 'defend') {
    if (!canSiegeRegion(next, map, inv.regionId, inv.defenderFactionId)) {
      throw new Error('Can only siege a town/capital you control');
    }
    if (!inv.defenderFactionId) throw new Error('No defender');
    const defenders = invasionDefenders(next, inv).map((s) => s.id);
    next.sieges.push({
      regionId: inv.regionId,
      attackerFactionId: inv.attackerFactionId,
      defenderFactionId: inv.defenderFactionId,
      attackerStackIds: [...inv.attackerStackIds],
      defenderStackIds: defenders,
      days: 0,
    });
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
    pushLog(
      next,
      `Battle kept for later at ${regionById(map, inv.regionId)?.name ?? inv.regionId}`,
    );
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

export type BattleRng = () => number;

/** One proportional duel: `loser` loses 1 unit. */
export type BattleExchange = {
  att: number;
  def: number;
  pool: number;
  roll: number;
  loser: 'attacker' | 'defender';
};

export type BattlePlan = {
  regionId: string;
  attackerFactionId: string;
  defenderFactionId: string | null;
  exchanges: BattleExchange[];
  state: MatchState;
};

/**
 * Plan unit-by-unit proportional battle (for FX + resolve).
 * Each exchange: roll 1..(att+def[+1 capital]); ≤att → defender loses, else attacker loses.
 */
export function planBattleDice(
  state: MatchState,
  map: CampaignMap,
  invasionId: string,
  rng: BattleRng = Math.random,
): BattlePlan {
  let next = cloneMatch(state);
  let inv = next.pendingInvasions.find((i) => i.id === invasionId);
  if (!inv) throw new Error('No battle');

  if (inv.status === 'awaiting_defender') {
    inv.status = 'battle';
    for (const id of inv.attackerStackIds) {
      const s = next.stacks.find((x) => x.id === id);
      if (s) inv.enteredSupplied[id] = true;
    }
  }
  if (inv.status !== 'battle') throw new Error('No battle');

  let att = inv.attackerStackIds.reduce((n, id) => {
    const s = next.stacks.find((x) => x.id === id);
    return n + (s?.units ?? 0);
  }, 0);
  const defStacks = invasionDefenders(next, inv);
  let def = defStacks.reduce((n, s) => n + s.units, 0);
  const defIds = defStacks.map((s) => s.id);
  const attStart = att;
  const defStart = def;
  const place = regionById(map, inv.regionId)?.name ?? inv.regionId;
  const capitalBonus = isCapitalRegion(map, inv.regionId) ? 1 : 0;
  const defLabel = inv.defenderFactionId
    ? factionLabel(map, inv.defenderFactionId)
    : 'defenders';
  const exchanges: BattleExchange[] = [];

  pushLog(
    next,
    `Battle at ${place}: ${factionLabel(map, inv.attackerFactionId)} ${att} vs ${defLabel} ${def}${
      capitalBonus ? ` (+${capitalBonus} capital)` : ''
    }`,
  );

  while (att > 0 && def > 0) {
    const pool = att + def + capitalBonus;
    const roll = Math.floor(rng() * pool) + 1;
    const defLabelOdds = capitalBonus ? `${def}+${capitalBonus}` : `${def}`;
    if (roll <= att) {
      exchanges.push({ att, def, pool, roll, loser: 'defender' });
      pushLog(
        next,
        `  ${att} vs ${defLabelOdds}: d${pool}→${roll} → attacker (${att} vs ${def - 1})`,
      );
      def -= 1;
    } else {
      exchanges.push({ att, def, pool, roll, loser: 'attacker' });
      pushLog(
        next,
        `  ${att} vs ${defLabelOdds}: d${pool}→${roll} → defender (${att - 1} vs ${def})`,
      );
      att -= 1;
    }
  }

  removeUnitsFromStacks(next, inv.attackerStackIds, attStart - att);
  removeUnitsFromStacks(next, defIds, defStart - def);

  if (def <= 0) {
    captureRegion(
      next,
      map,
      inv.regionId,
      inv.attackerFactionId,
      inv.defenderFactionId,
    );
    pushLog(
      next,
      `Battle resolved: attacker holds ${place} with ${att} unit${att === 1 ? '' : 's'} left`,
    );
  } else {
    pushLog(
      next,
      `Battle resolved: defender holds ${place} with ${def} unit${def === 1 ? '' : 's'} left`,
    );
  }

  next.sieges = next.sieges.filter((sg) => sg.regionId !== inv!.regionId);
  next.pendingInvasions = next.pendingInvasions.filter((i) => i.id !== invasionId);

  return {
    regionId: inv.regionId,
    attackerFactionId: inv.attackerFactionId,
    defenderFactionId: inv.defenderFactionId,
    exchanges,
    state: next,
  };
}

/** Instant resolve — use `planBattleDice` when you need exchange FX. */
export function resolveBattleDice(
  state: MatchState,
  map: CampaignMap,
  invasionId: string,
  rng: BattleRng = Math.random,
): MatchState {
  return planBattleDice(state, map, invasionId, rng).state;
}

/** ★ army sharing a hex with an enemy ★ (e.g. after Wait) can open Attack. */
export function canDeclareColocatedAttack(
  state: MatchState,
  stackId: string,
): boolean {
  if (state.phase.kind !== 'play') return false;
  const phase = state.phase.phase;
  if (phase !== 'move' && phase !== 'invasions') return false;
  const seat = activeSeat(state);
  if (!seat) return false;
  const stack = state.stacks.find((s) => s.id === stackId);
  if (!stack || stack.rebelOf || stack.kind !== 'army') return false;
  if (stack.factionId !== seat.factionId) return false;
  if (state.sieges.some((sg) => sg.regionId === stack.regionId)) return false;

  const open = state.pendingInvasions.find(
    (i) =>
      i.regionId === stack.regionId &&
      (i.status === 'awaiting_defender' || i.status === 'battle'),
  );
  if (open) return false;

  const pending = state.pendingInvasions.find(
    (i) => i.regionId === stack.regionId && i.status === 'pending',
  );
  if (pending) return pending.attackerFactionId === stack.factionId;

  return stacksInRegion(state, stack.regionId).some(
    (s) =>
      s.id !== stack.id &&
      s.kind === 'army' &&
      !s.rebelOf &&
      s.factionId !== stack.factionId,
  );
}

/**
 * Co-located ★ declares Attack → defender gets Retreat / Defend / Battle.
 * Either side may initiate after Wait.
 */
export function declareColocatedAttack(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  stackId: string,
): MatchState {
  assertPlay(state);
  if (!canDeclareColocatedAttack(state, stackId)) {
    throw new Error('Cannot attack from here');
  }
  const next = cloneMatch(state);
  assertPlay(next);
  const stack = next.stacks.find((s) => s.id === stackId)!;

  const pending = next.pendingInvasions.find(
    (i) => i.regionId === stack.regionId && i.status === 'pending',
  );
  if (pending) {
    return resolveInvasionChoice(next, map, sea, pending.id, 'attack');
  }

  const foe = stacksInRegion(next, stack.regionId).find(
    (s) =>
      s.kind === 'army' &&
      !s.rebelOf &&
      s.factionId !== stack.factionId,
  );
  if (!foe) throw new Error('No enemy army here');

  const attackers = stacksInRegion(next, stack.regionId).filter(
    (s) => s.factionId === stack.factionId && !s.rebelOf,
  );
  const inv: PendingInvasion = {
    id: `inv-${next.nextInvasionId++}`,
    regionId: stack.regionId,
    attackerFactionId: stack.factionId,
    attackerStackIds: attackers.map((s) => s.id),
    fromRegionIds: [],
    defenderFactionId: foe.factionId,
    status: 'awaiting_defender',
    treachery: false,
    enteredSupplied: {},
  };
  for (const s of attackers) {
    inv.enteredSupplied[s.id] = isStackSupplied(next, map, sea, s);
  }
  next.pendingInvasions.push(inv);
  pushLog(
    next,
    `${factionLabel(map, stack.factionId)} attacks in ${regionById(map, stack.regionId)?.name ?? stack.regionId} — defender must respond`,
  );
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

export function canBreakSiege(state: MatchState, regionId: string): boolean {
  if (state.phase.kind !== 'play') return false;
  const seat = activeSeat(state);
  if (!seat) return false;
  const phase = state.phase.phase;
  if (phase !== 'move' && phase !== 'invasions') return false;
  const sg = state.sieges.find((s) => s.regionId === regionId);
  return !!sg && sg.attackerFactionId === seat.factionId;
}

/** Attacker lifts the siege — armies stay co-located (can Attack again). */
export function breakSiege(
  state: MatchState,
  map: CampaignMap,
  regionId: string,
): MatchState {
  assertPlay(state);
  if (!canBreakSiege(state, regionId)) throw new Error('Cannot break this siege');
  const next = cloneMatch(state);
  assertPlay(next);
  next.sieges = next.sieges.filter((s) => s.regionId !== regionId);
  pushLog(
    next,
    `${factionLabel(map, activeSeat(next)!.factionId)} breaks the siege at ${regionById(map, regionId)?.name ?? regionId}`,
  );
  return next;
}

/**
 * Who may open a battle from a siege:
 * - defender: always (sally)
 * - attacker: only on a village after ≥1 full day of siege
 */
export function canSiegeBattle(
  state: MatchState,
  map: CampaignMap,
  regionId: string,
): boolean {
  if (state.phase.kind !== 'play') return false;
  const seat = activeSeat(state);
  if (!seat) return false;
  const phase = state.phase.phase;
  if (phase !== 'move' && phase !== 'invasions') return false;
  const sg = state.sieges.find((s) => s.regionId === regionId);
  if (!sg) return false;
  if (sg.defenderFactionId === seat.factionId) return true;
  if (sg.attackerFactionId === seat.factionId) {
    const village = regionById(map, regionId)?.settlement.kind === 'village';
    return !!village && (sg.days ?? 0) >= 1;
  }
  return false;
}

export function siegeToBattle(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  regionId: string,
): MatchState {
  assertPlay(state);
  if (!canSiegeBattle(state, map, regionId)) throw new Error('Cannot start battle from this siege');
  const next = cloneMatch(state);
  assertPlay(next);
  const sg = next.sieges.find((s) => s.regionId === regionId);
  if (!sg) throw new Error('No siege');
  const seat = activeSeat(next)!;
  const byAttacker = seat.factionId === sg.attackerFactionId;

  const inv: PendingInvasion = {
    id: `inv-${next.nextInvasionId++}`,
    regionId: sg.regionId,
    attackerFactionId: sg.attackerFactionId,
    attackerStackIds: [...sg.attackerStackIds],
    fromRegionIds: [],
    defenderFactionId: sg.defenderFactionId,
    status: byAttacker ? 'awaiting_defender' : 'battle',
    treachery: false,
    enteredSupplied: {},
  };
  for (const id of inv.attackerStackIds) {
    const s = next.stacks.find((x) => x.id === id);
    if (s) inv.enteredSupplied[id] = isStackSupplied(next, map, sea, s);
  }
  next.sieges = next.sieges.filter((s) => s.regionId !== regionId);
  next.pendingInvasions.push(inv);
  pushLog(
    next,
    byAttacker
      ? `${factionLabel(map, sg.attackerFactionId)} assaults the siege at ${regionById(map, regionId)?.name ?? regionId}`
      : `${factionLabel(map, sg.defenderFactionId)} starts a battle at ${regionById(map, regionId)?.name ?? regionId} (kept for later)`,
  );
  return next;
}

export function applySiegeAttrition(state: MatchState, map: CampaignMap): MatchState {
  const next = cloneMatch(state);
  assertPlay(next);
  const seat = activeSeat(next)!;
  // End of attacker's turn: +1 siege day, then −1 defender unit
  for (const sg of next.sieges) {
    if (sg.attackerFactionId !== seat.factionId) continue;
    sg.days = (sg.days ?? 0) + 1;
    removeUnitsFromStacks(next, sg.defenderStackIds, 1);
    const left = stacksInRegion(next, sg.regionId).filter(
      (s) => s.factionId === sg.defenderFactionId,
    );
    if (left.length === 0) {
      captureRegion(next, map, sg.regionId, sg.attackerFactionId, sg.defenderFactionId);
      next.sieges = next.sieges.filter((s) => s.regionId !== sg.regionId);
      pushLog(next, `Siege falls at ${regionById(map, sg.regionId)?.name ?? sg.regionId}`);
    } else {
      pushLog(
        next,
        `Siege day ${sg.days} at ${regionById(map, sg.regionId)?.name ?? sg.regionId} (−1 defender)`,
      );
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
        (i.status === 'pending' ||
          i.status === 'awaiting_defender' ||
          i.status === 'battle'),
    );
    if (blocking) return next;
  }
  const passTurn = (state: MatchState): MatchState => {
    let s = state;
    assertPlay(s);
    const activeFaction = activeSeat(s)!.factionId;
    // Cull before ★ promotion so 3+ detached loose cannot dodge by forming an army
    cullUnsuppliedLooseStacks(s, map, sea, activeFaction);
    formArmiesEndOfTurn(s, activeFaction);
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
        (i.status === 'pending' ||
          i.status === 'awaiting_defender' ||
          i.status === 'battle'),
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
