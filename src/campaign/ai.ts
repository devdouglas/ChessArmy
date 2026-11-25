import type { CampaignMap } from './types';
import {
  activeSeat,
  capitalRegions,
  cloneMatch,
  isCapitalRegion,
  isNeutralFaction,
  pushLog,
  regionById,
  seatOf,
  type MatchState,
  type PendingInvasion,
} from './match';
import {
  advancePhase,
  armiesNeedingUpkeep,
  canSiegeRegion,
  factionHasArmy,
  legalMovesForStack,
  moveStack,
  openInvasionContacts,
  ownerOf,
  payUpkeep,
  recruit,
  recruitableRegions,
  resolveBattleDice,
  resolveInvasionChoice,
  retreatDestinations,
  stacksInRegion,
  type SeaAdjacency,
} from './rules';

/** Optional FX hook: play step animation then return final battle state. */
export type AnimateBattleFn = (
  state: MatchState,
  invasionId: string,
  rng: AiRng,
) => Promise<MatchState>;

/** Attacker / defender unit counts for an open invasion (capital +1 on def power). */
function invasionForceSizes(
  state: MatchState,
  map: CampaignMap,
  inv: PendingInvasion,
): { att: number; def: number; defPower: number } {
  const att = inv.attackerStackIds.reduce((n, id) => {
    const s = state.stacks.find((x) => x.id === id);
    return n + (s?.units ?? 0);
  }, 0);
  const def = stacksInRegion(state, inv.regionId)
    .filter(
      (s) =>
        !inv.attackerStackIds.includes(s.id) &&
        (inv.defenderFactionId
          ? s.factionId === inv.defenderFactionId
          : s.factionId !== inv.attackerFactionId),
    )
    .reduce((n, s) => n + s.units, 0);
  const cap = isCapitalRegion(map, inv.regionId) ? 1 : 0;
  return { att, def, defPower: def + cap };
}

/**
 * Defender fights instead of sieging when odds are at least equal−1
 * (defPower >= att − 1), i.e. not worse than one pip down.
 */
function defenderPrefersFight(
  state: MatchState,
  map: CampaignMap,
  inv: PendingInvasion,
): boolean {
  const { att, defPower } = invasionForceSizes(state, map, inv);
  if (att <= 0) return true;
  return defPower >= att - 1;
}

/** Enemy ★ on a land neighbor of this capital. */
function enemyArmyAdjacentTo(
  state: MatchState,
  map: CampaignMap,
  capitalId: string,
  factionId: string,
): boolean {
  for (const n of map.neighbors[capitalId] ?? []) {
    if (
      stacksInRegion(state, n).some(
        (s) => s.kind === 'army' && !s.rebelOf && s.factionId !== factionId,
      )
    ) {
      return true;
    }
  }
  return false;
}

/**
 * If an enemy ★ is adjacent to our capital, rush every unmoved stack from
 * neighboring villages into that capital (one stack per call).
 */
function tryRushVillageReinforceCapital(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  factionId: string,
): MatchState | null {
  const caps = capitalRegions(map).filter((r) => ownerOf(state, r.id) === factionId);
  for (const cap of caps) {
    if (!enemyArmyAdjacentTo(state, map, cap.id, factionId)) continue;

    const villageIds = (map.neighbors[cap.id] ?? []).filter(
      (nid) => regionById(map, nid)?.settlement.kind === 'village',
    );
    for (const vid of villageIds) {
      const stacks = stacksInRegion(state, vid).filter(
        (s) => s.factionId === factionId && !s.rebelOf && !s.moved,
      );
      for (const stack of stacks) {
        const legal = legalMovesForStack(state, map, sea, stack.id, { count: 'all' });
        if (!legal.some((m) => m.regionId === cap.id)) continue;
        try {
          // legalMoves already blocks ★ depart when broke / besieged
          return moveStack(state, map, sea, stack.id, cap.id, { count: 'all' });
        } catch {
          /* try next stack */
        }
      }
    }
  }
  return null;
}

export type AiRng = () => number;

function factionLabel(map: CampaignMap, id: string): string {
  return map.factions.find((f) => f.id === id)?.name ?? id;
}

/** BFS hop distance on land neighbors; Infinity if unreachable. */
export function landDistance(
  map: CampaignMap,
  fromId: string,
  toId: string,
): number {
  if (fromId === toId) return 0;
  const seen = new Set<string>([fromId]);
  const q: { id: string; d: number }[] = [{ id: fromId, d: 0 }];
  while (q.length) {
    const cur = q.shift()!;
    for (const n of map.neighbors[cur.id] ?? []) {
      if (seen.has(n)) continue;
      if (n === toId) return cur.d + 1;
      seen.add(n);
      q.push({ id: n, d: cur.d + 1 });
    }
  }
  return Number.POSITIVE_INFINITY;
}

export function pickAiTargetCapital(
  state: MatchState,
  map: CampaignMap,
  factionId: string,
  rng: AiRng = Math.random,
): string | null {
  const caps = capitalRegions(map).filter((r) => ownerOf(state, r.id) !== factionId);
  if (!caps.length) return null;
  return caps[Math.floor(rng() * caps.length)]!.id;
}

function ensureAiTarget(
  state: MatchState,
  map: CampaignMap,
  factionId: string,
  rng: AiRng,
): MatchState {
  const seat = seatOf(state, factionId);
  if (!seat?.isAi) return state;
  const cur = seat.aiTargetCapitalId;
  if (cur && regionById(map, cur) && ownerOf(state, cur) !== factionId) {
    return state;
  }
  const next = cloneMatch(state);
  const s = seatOf(next, factionId)!;
  const pick = pickAiTargetCapital(next, map, factionId, rng);
  s.aiTargetCapitalId = pick ?? undefined;
  if (pick) {
    pushLog(
      next,
      `${factionLabel(map, factionId)} AI targets ${regionById(map, pick)?.name ?? pick}`,
    );
  }
  return next;
}

function borderRecruitRegions(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  factionId: string,
): string[] {
  return recruitableRegions(state, map, sea, factionId).filter((rid) =>
    (map.neighbors[rid] ?? []).some((n) => {
      const o = ownerOf(state, n);
      if (o && o !== factionId) return true;
      return stacksInRegion(state, n).some(
        (s) => s.factionId !== factionId && !s.rebelOf,
      );
    }),
  );
}

/** Unowned frontier toward target (village reinforce is a separate fallback). */
function pickFrontierToward(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  factionId: string,
  targetId: string,
): string | null {
  const opts = recruitableRegions(state, map, sea, factionId).filter(
    (rid) => ownerOf(state, rid) == null,
  );
  if (!opts.length) return null;
  let best: string | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const rid of opts) {
    const d = landDistance(map, rid, targetId);
    if (d < bestD) {
      bestD = d;
      best = rid;
    }
  }
  return best;
}

function pickArmyMoveToward(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  stackId: string,
  targetId: string,
): string | null {
  const moves = legalMovesForStack(state, map, sea, stackId, { count: 'all' });
  if (!moves.length) return null;
  let best: string | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const m of moves) {
    const d = landDistance(map, m.regionId, targetId);
    if (d < bestD) {
      bestD = d;
      best = m.regionId;
    }
  }
  return best;
}

/** Human seat must answer Wait/Attack or Fight/Siege/Flight. */
export function needsHumanInvasionInput(state: MatchState): boolean {
  return openInvasionContacts(state).some((inv) => {
    if (inv.status === 'pending') {
      const seat = seatOf(state, inv.attackerFactionId);
      return !!seat && !seat.isAi;
    }
    if (inv.status === 'awaiting_defender' && inv.defenderFactionId) {
      const seat = seatOf(state, inv.defenderFactionId);
      return !!seat && !seat.isAi;
    }
    return false;
  });
}

/** AI answers Wait/Attack / Retreat/Siege/Battle when it is that side (instant dice). */
export function resolveAiInvasionContacts(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  rng: AiRng = Math.random,
): MatchState {
  let next = state;
  for (let guard = 0; guard < 40; guard++) {
    const battle = next.pendingInvasions.find((i) => {
      if (i.status !== 'battle') return false;
      const atkAi = !!seatOf(next, i.attackerFactionId)?.isAi;
      const defAi = i.defenderFactionId
        ? !!seatOf(next, i.defenderFactionId)?.isAi
        : true;
      return atkAi || defAi;
    });
    if (battle) {
      next = resolveBattleDice(next, map, battle.id, rng);
      continue;
    }

    const contacts = openInvasionContacts(next);
    if (!contacts.length) return next;
    const inv = contacts[0]!;

    if (inv.status === 'pending') {
      if (!seatOf(next, inv.attackerFactionId)?.isAi) return next;
      next = resolveInvasionChoice(next, map, sea, inv.id, 'attack');
      continue;
    }

    if (inv.status === 'awaiting_defender') {
      const defId = inv.defenderFactionId;
      if (!defId) return next;
      const defSeat = seatOf(next, defId);
      const autoDef = !!defSeat?.isAi || isNeutralFaction(next, defId);
      if (!autoDef) return next;

      if (retreatDestinations(next, map, inv).length > 0) {
        try {
          next = resolveInvasionChoice(next, map, sea, inv.id, 'retreat');
          continue;
        } catch {
          /* fall through */
        }
      }
      const fight = defenderPrefersFight(next, map, inv);
      if (!fight && canSiegeRegion(next, map, inv.regionId, defId)) {
        next = resolveInvasionChoice(next, map, sea, inv.id, 'defend');
        continue;
      }
      next = resolveBattleDice(next, map, inv.id, rng);
      continue;
    }

    return next;
  }
  return next;
}

/** Same as resolveAiInvasionContacts but battles can play FX via `animateBattle`. */
export async function resolveAiInvasionContactsAsync(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  rng: AiRng = Math.random,
  animateBattle?: AnimateBattleFn,
): Promise<MatchState> {
  if (!animateBattle) return resolveAiInvasionContacts(state, map, sea, rng);

  let next = state;
  for (let guard = 0; guard < 40; guard++) {
    const battle = next.pendingInvasions.find((i) => {
      if (i.status !== 'battle') return false;
      const atkAi = !!seatOf(next, i.attackerFactionId)?.isAi;
      const defAi = i.defenderFactionId
        ? !!seatOf(next, i.defenderFactionId)?.isAi
        : true;
      return atkAi || defAi;
    });
    if (battle) {
      next = await animateBattle(next, battle.id, rng);
      continue;
    }

    const contacts = openInvasionContacts(next);
    if (!contacts.length) return next;
    const inv = contacts[0]!;

    if (inv.status === 'pending') {
      if (!seatOf(next, inv.attackerFactionId)?.isAi) return next;
      next = resolveInvasionChoice(next, map, sea, inv.id, 'attack');
      continue;
    }

    if (inv.status === 'awaiting_defender') {
      const defId = inv.defenderFactionId;
      if (!defId) return next;
      const defSeat = seatOf(next, defId);
      const autoDef = !!defSeat?.isAi || isNeutralFaction(next, defId);
      if (!autoDef) return next;

      if (retreatDestinations(next, map, inv).length > 0) {
        try {
          next = resolveInvasionChoice(next, map, sea, inv.id, 'retreat');
          continue;
        } catch {
          /* fall through */
        }
      }
      const fight = defenderPrefersFight(next, map, inv);
      if (!fight && canSiegeRegion(next, map, inv.regionId, defId)) {
        next = resolveInvasionChoice(next, map, sea, inv.id, 'defend');
        continue;
      }
      next = await animateBattle(next, inv.id, rng);
      continue;
    }

    return next;
  }
  return next;
}

function fingerprint(state: MatchState): string {
  const seat = activeSeat(state);
  const ph = state.phase;
  return [
    ph.kind,
    ph.kind === 'play' ? ph.phase : '',
    ph.kind === 'play' ? ph.playerIndex : '',
    ph.kind === 'play' ? ph.round : '',
    state.log.length,
    state.stacks.length,
    state.pendingInvasions.length,
    seat?.coins ?? 0,
    seat?.factionId ?? '',
  ].join('|');
}

/**
 * One AI decision. Returns same fingerprint when idle (caller may advance phase).
 */
export function campaignAiStep(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  rng: AiRng = Math.random,
): MatchState {
  if (state.phase.kind !== 'play') return state;
  const seat = activeSeat(state);
  if (!seat?.isAi) return state;

  let next = ensureAiTarget(state, map, seat.factionId, rng);
  next = resolveAiInvasionContacts(next, map, sea, rng);

  if (next.phase.kind !== 'play') return next;
  if (needsHumanInvasionInput(next)) return next;

  const factionId = seat.factionId;
  const target = seatOf(next, factionId)?.aiTargetCapitalId;
  const phase = next.phase.phase;

  if (phase === 'taxes') {
    return advancePhase(next, map, sea);
  }

  if (phase === 'upkeep') {
    const due = armiesNeedingUpkeep(next, map, sea, factionId);
    for (const a of due) {
      const s = seatOf(next, factionId);
      if (!s || s.coins < 1) break;
      try {
        next = payUpkeep(next, map, sea, a.id);
      } catch {
        break;
      }
    }
    return advancePhase(next, map, sea);
  }

  if (phase === 'move') {
    if (openInvasionContacts(next).length) return next;

    const rush = tryRushVillageReinforceCapital(next, map, sea, factionId);
    if (rush) {
      pushLog(
        rush,
        `${factionLabel(map, factionId)} rushes village troops to threatened capital`,
      );
      return resolveAiInvasionContacts(rush, map, sea, rng);
    }

    if ((seatOf(next, factionId)?.coins ?? 0) >= 1) {
      const pick =
        (target ? pickFrontierToward(next, map, sea, factionId, target) : null) ??
        (!factionHasArmy(next, factionId)
          ? borderRecruitRegions(next, map, sea, factionId)[0] ??
            recruitableRegions(next, map, sea, factionId)[0]
          : null);
      if (pick) {
        try {
          return recruit(next, map, sea, pick);
        } catch {
          /* fall through */
        }
      }
    }

    if (target && factionHasArmy(next, factionId)) {
      const armies = next.stacks.filter(
        (s) =>
          s.factionId === factionId &&
          s.kind === 'army' &&
          !s.rebelOf &&
          !s.moved,
      );
      for (const army of armies) {
        const dest = pickArmyMoveToward(next, map, sea, army.id, target);
        if (!dest || dest === army.regionId) continue;
        try {
          const moved = moveStack(next, map, sea, army.id, dest, { count: 'all' });
          return resolveAiInvasionContacts(moved, map, sea, rng);
        } catch {
          /* try next army */
        }
      }
    }

    return advancePhase(next, map, sea);
  }

  if (phase === 'invasions') {
    next = resolveAiInvasionContacts(next, map, sea, rng);
    try {
      return advancePhase(next, map, sea);
    } catch {
      return next;
    }
  }

  if (phase === 'armies') {
    return advancePhase(next, map, sea);
  }

  return next;
}

/** Drive AI seats until a human must act or the step cap hits. */
export function runCampaignAiTurns(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  rng: AiRng = Math.random,
  maxSteps = 100,
): MatchState {
  let next = resolveAiInvasionContacts(state, map, sea, rng);

  for (let i = 0; i < maxSteps; i++) {
    if (next.phase.kind !== 'play') break;
    if (!activeSeat(next)?.isAi) break;

    const before = fingerprint(next);
    const stepped = campaignAiStep(next, map, sea, rng);
    const after = fingerprint(stepped);
    next = stepped;

    if (needsHumanInvasionInput(next)) break;

    if (before === after) {
      if (needsHumanInvasionInput(next)) break;
      if (openInvasionContacts(next).length) break;
      try {
        const adv = advancePhase(next, map, sea);
        if (fingerprint(adv) === before) break;
        next = adv;
      } catch {
        break;
      }
    }
  }

  return next;
}

/** Like runCampaignAiTurns but battles play through `animateBattle`. */
export async function runCampaignAiTurnsAsync(
  state: MatchState,
  map: CampaignMap,
  sea: Record<string, SeaAdjacency[]>,
  rng: AiRng = Math.random,
  maxSteps = 100,
  animateBattle?: AnimateBattleFn,
): Promise<MatchState> {
  let next = await resolveAiInvasionContactsAsync(
    state,
    map,
    sea,
    rng,
    animateBattle,
  );

  for (let i = 0; i < maxSteps; i++) {
    if (next.phase.kind !== 'play') break;
    if (!activeSeat(next)?.isAi) break;

    const before = fingerprint(next);
    // Step via sync AI then re-resolve contacts with FX for any new battles
    let stepped = campaignAiStep(next, map, sea, rng);
    stepped = await resolveAiInvasionContactsAsync(
      stepped,
      map,
      sea,
      rng,
      animateBattle,
    );
    const after = fingerprint(stepped);
    next = stepped;

    if (needsHumanInvasionInput(next)) break;

    if (before === after) {
      if (needsHumanInvasionInput(next)) break;
      if (openInvasionContacts(next).length) break;
      try {
        const adv = advancePhase(next, map, sea);
        if (fingerprint(adv) === before) break;
        next = await resolveAiInvasionContactsAsync(
          adv,
          map,
          sea,
          rng,
          animateBattle,
        );
      } catch {
        break;
      }
    }
  }

  return next;
}
