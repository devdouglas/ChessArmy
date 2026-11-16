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

/** Build region↔region sea adjacencies (worst link kind on path through stops). */
export function buildSeaAdjacency(map: CampaignMap): Record<string, SeaAdjacency[]> {
  const byId = new Map(map.seaNodes.map((n) => [n.id, n]));
  const adj = new Map<string, { id: string; kind: SeaRouteKind }[]>();
  for (const l of map.seaLinks) {
    const listA = adj.get(l.a) ?? [];
    listA.push({ id: l.b, kind: l.kind });
    adj.set(l.a, listA);
    const listB = adj.get(l.b) ?? [];
    listB.push({ id: l.a, kind: l.kind });
    adj.set(l.b, listB);
  }

  const out: Record<string, SeaAdjacency[]> = {};
  const ports = map.seaNodes.filter((n): n is SeaNode & { regionId: string } =>
    n.kind === 'port' && !!n.regionId,
  );

  for (const port of ports) {
    const queue: { id: string; worst: SeaRouteKind }[] = [{ id: port.id, worst: 'blue' }];
    const seen = new Set<string>([port.id]);
    const found = new Map<string, SeaRouteKind>();

    while (queue.length) {
      const cur = queue.shift()!;
      for (const edge of adj.get(cur.id) ?? []) {
        if (seen.has(edge.id)) continue;
        seen.add(edge.id);
        const worst: SeaRouteKind = cur.worst === 'red' || edge.kind === 'red' ? 'red' : 'blue';
        const node = byId.get(edge.id);
        if (!node) continue;
        if (node.kind === 'port' && node.regionId && node.regionId !== port.regionId) {
          const prev = found.get(node.regionId);
          if (!prev || (prev === 'red' && worst === 'blue')) {
            found.set(node.regionId, worst);
          }
        } else if (node.kind === 'stop') {
          queue.push({ id: edge.id, worst });
        } else if (node.kind === 'port') {
          // other port without region — still traverse? skip
        }
      }
    }

    const list = out[port.regionId] ?? [];
    for (const [to, kind] of found) {
      if (!list.some((x) => x.to === to && x.kind === kind)) {
        list.push({ to, kind });
      }
    }
    out[port.regionId] = list;
  }
  return out;
}

function ownsBothShores(
  state: MatchState,
  factionId: string,
  a: string,
  b: string,
): boolean {
  return ownerOf(state, a) === factionId && ownerOf(state, b) === factionId;
}

function seaActsAsBlue(
  state: MatchState,
  factionId: string,
  from: string,
  to: string,
  kind: SeaRouteKind,
): boolean {
  if (kind === 'blue') return true;
  return ownsBothShores(state, factionId, from, to);
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
      if (!occupied.has(edge.to)) continue;
      if (!seaActsAsBlue(state, factionId, cur, edge.to, edge.kind)) continue;
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

export function collectTaxes(state: MatchState, map: CampaignMap): MatchState {
  assertPlay(state);
  const next = cloneMatch(state);
  assertPlay(next);
  if (next.phase.taxesCollected) return next;
  const seat = activeSeat(next)!;
  let gain = 0;
  for (const r of map.regions) {
    if (r.settlement.kind !== 'capital') continue;
    if (ownerOf(next, r.id) !== seat.factionId) continue;
    if (next.sieges.some((s) => s.regionId === r.id)) continue;
    gain += 1;
  }
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

export function recruitableRegions(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  factionId: string,
): string[] {
  const occupied = occupiedByForSupply(state, factionId);
  const out: string[] = [];
  for (const rid of occupied) {
    if (!isRegionSupplied(state, map, sea, factionId, rid)) continue;
    // Cannot add onto a campaigning army — if the only presence is campaigning armies, skip
    const mine = stacksOfFactionInRegion(state, rid, factionId);
    const hasCampaigning = mine.some((s) => isCampaigningArmy(state, map, sea, s));
    const hasNonCampaigning = mine.some((s) => !isCampaigningArmy(state, map, sea, s));
    if (hasCampaigning && !hasNonCampaigning) continue;
    out.push(rid);
  }
  return out;
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
  if (!allowed.includes(regionId)) throw new Error('Not on supply');

  payer.coins -= 1;
  // Prefer merging into an existing loose stack
  const loose = stacksOfFactionInRegion(next, regionId, seat.factionId).find(
    (s) => s.kind === 'loose',
  );
  if (loose) {
    loose.units += 1;
  } else {
    next.stacks.push(
      makeStack(next, {
        factionId: seat.factionId,
        regionId,
        units: 1,
        kind: 'loose',
      }),
    );
  }
  pushLog(
    next,
    `${factionLabel(map, seat.factionId)} recruits in ${regionById(map, regionId)?.name ?? regionId}`,
  );
  return next;
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

/** Apply unpaid upkeep: lose ceil(units/2), retoken. */
export function applyUpkeepLoss(state: MatchState, stackId: string): MatchState {
  const next = cloneMatch(state);
  const stack = next.stacks.find((s) => s.id === stackId);
  if (!stack || stack.kind !== 'army') return next;
  const seat = seatOf(next, stack.factionId);
  const loss = Math.ceil(stack.units / 2);
  stack.units = Math.max(0, stack.units - loss);
  if (seat && stack.armySize) returnToken(seat.tokens, stack.armySize);
  if (stack.units <= 0) {
    next.stacks = next.stacks.filter((s) => s.id !== stackId);
    return next;
  }
  const fit = seat ? largestTokenFitting(seat.tokens, stack.units) : null;
  if (fit && seat) {
    takeToken(seat.tokens, fit);
    stack.kind = 'army';
    stack.armySize = fit;
  } else {
    stack.kind = 'loose';
    delete stack.armySize;
  }
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

export function legalMovesForStack(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  stackId: string,
  opts?: { haste?: boolean },
): LegalMove[] {
  const stack = state.stacks.find((s) => s.id === stackId);
  if (!stack) return [];
  // First step free (moved=false). Second step is haste (moved=true).
  if (stack.moved && !opts?.haste) return [];
  if (!stack.moved && opts?.haste) return [];
  const factionId = stack.factionId;
  const from = stack.regionId;
  const moves: LegalMove[] = [];

  const canInvade = stack.kind === 'army' && stack.units >= 3;

  const tryAdd = (to: string, via: 'land' | 'sea', seaKind?: SeaRouteKind, coinCost = 0) => {
    if (to === from) return;
    const owner = ownerOf(state, to);
    const foreign = owner !== null && owner !== factionId && !stack.rebelOf;
    const enemyStacks = stacksInRegion(state, to).filter(
      (s) => s.factionId !== factionId && !(stack.rebelOf && s.rebelOf === stack.rebelOf),
    );
    // Only armies enter enemy-owned territory
    if (foreign && !canInvade) return;
    // Entering a region with enemies requires army
    if (enemyStacks.length && !canInvade) return;
    const hasteTax = opts?.haste ? 1 : 0;
    moves.push({ regionId: to, via, seaKind, coinCost: coinCost + hasteTax });
  };

  for (const n of map.neighbors[from] ?? []) {
    tryAdd(n, 'land');
  }
  for (const edge of sea[from] ?? []) {
    const asBlue = seaActsAsBlue(state, factionId, from, edge.to, edge.kind);
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

export function moveStack(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  stackId: string,
  toRegionId: string,
  opts?: { haste?: boolean; payerFactionId?: string },
): MatchState {
  assertPlay(state);
  const next = cloneMatch(state);
  assertPlay(next);
  const stack = next.stacks.find((s) => s.id === stackId);
  if (!stack) throw new Error('No stack');
  const haste = opts?.haste || stack.moved;
  if (stack.moved && !haste) throw new Error('Already moved');
  if (haste && !stack.moved) throw new Error('Haste is an extra step after moving');

  const legal = legalMovesForStack(next, map, sea, stackId, { haste: haste || undefined });
  const dest = legal.find((m) => m.regionId === toRegionId);
  if (!dest) throw new Error('Illegal move');

  const seat = activeSeat(next)!;
  const payer = opts?.payerFactionId ? seatOf(next, opts.payerFactionId) : seat;
  const cost = dest.coinCost;
  if (cost > 0) {
    if (!payer || payer.coins < cost) throw new Error('Not enough coins');
    payer.coins -= cost;
  }

  // Capital cannot be left empty
  if (isCapitalRegion(map, stack.regionId)) {
    const owner = ownerOf(next, stack.regionId);
    if (owner && stack.factionId === owner) {
      const remaining = capitalGarrisonCount(next, map, stack.regionId) - stack.units;
      if (remaining < 1) throw new Error('Capital cannot be left empty');
    }
  }

  const fromId = stack.regionId;
  stack.regionId = toRegionId;
  stack.moved = true;
  if (haste) {
    const owner = ownerOf(next, toRegionId);
    const invades =
      (owner && owner !== stack.factionId) ||
      stacksInRegion(next, toRegionId).some(
        (s) => s.id !== stack.id && s.factionId !== stack.factionId,
      ) ||
      next.sieges.some((s) => s.regionId === toRegionId);
    if (invades) stack.exhausted = true;
  }

  // Track invasion if entering foreign territory with army
  const owner = ownerOf(next, toRegionId);
  if (
    stack.kind === 'army' &&
    owner &&
    owner !== stack.factionId &&
    !stack.rebelOf
  ) {
    queueInvasion(next, map, sea, stack, fromId, owner);
  } else if (stack.kind === 'army' && !owner && !stack.rebelOf) {
    // Neutral empty — occupy immediately at invasion phase; mark pending empty occupy
    queueInvasion(next, map, sea, stack, fromId, null);
  } else if (
    stack.kind === 'army' &&
    owner === stack.factionId &&
    stacksInRegion(next, toRegionId).some(
      (s) => s.id !== stack.id && s.factionId !== stack.factionId,
    )
  ) {
    // Co-occupied / treachery target — handled via explicit treachery action
  }

  pushLog(
    next,
    `${factionLabel(map, stack.factionId)} moves to ${regionById(map, toRegionId)?.name ?? toRegionId}${haste ? ' (haste)' : ''}`,
  );
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
  for (const id of stackIds) {
    if (left <= 0) break;
    const s = state.stacks.find((x) => x.id === id);
    if (!s) continue;
    const take = Math.min(s.units, left);
    s.units -= take;
    left -= take;
    if (s.units <= 0) {
      const seat = seatOf(state, s.factionId);
      if (seat && s.kind === 'army' && s.armySize) returnToken(seat.tokens, s.armySize);
      state.stacks = state.stacks.filter((x) => x.id !== s.id);
    } else if (s.kind === 'army' && s.armySize && s.units < 3) {
      const seat = seatOf(state, s.factionId);
      if (seat) returnToken(seat.tokens, s.armySize);
      s.kind = 'loose';
      delete s.armySize;
    }
  }
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

export function runArmyPhase(state: MatchState, map: CampaignMap): MatchState {
  assertPlay(state);
  let next = cloneMatch(state);
  assertPlay(next);
  const seat = activeSeat(next)!;

  if (next.armyPrompt) {
    return next; // wait for UI choice
  }

  const regions = new Set(
    next.stacks.filter((s) => s.factionId === seat.factionId && !s.rebelOf).map((s) => s.regionId),
  );
  for (const rid of regions) {
    next = packArmiesInRegion(next, map, rid, seat.factionId);
    if (next.armyPrompt) return next;
  }
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
    next = skipTaxes(next);
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
  if (next.phase.phase === 'armies') {
    next = runArmyPhase(next, map);
    assertPlay(next);
    if (next.armyPrompt) return next;
  }

  if (idx >= TURN_PHASES.length - 1) {
    next = applySiegeAttrition(next, map);
    assertPlay(next);
    // Next player
    for (const s of next.stacks) {
      if (s.factionId === activeSeat(next)!.factionId) {
        s.moved = false;
        // exhausted clears at end of own turn
        s.exhausted = false;
      }
    }
    // Clear pending invasions that somehow linger for this attacker if resolved
    let pIdx = next.phase.playerIndex + 1;
    let round = next.phase.round;
    if (pIdx >= next.seats.length) {
      pIdx = 0;
      round += 1;
    }
    next.phase = {
      kind: 'play',
      phase: 'taxes',
      playerIndex: pIdx,
      round,
      taxesCollected: false,
    };
    pushLog(next, `— ${factionLabel(map, next.seats[pIdx].factionId)} turn (round ${round}) —`);
    return next;
  }

  next.phase = {
    ...next.phase,
    phase: TURN_PHASES[idx + 1],
  };
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
