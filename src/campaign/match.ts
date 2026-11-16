import type { CampaignMap, CampaignRegion } from './types';

export const MATCH_STORAGE_KEY = 'chessarmy-campaign-match-v1';
export const BARBARIAN_ID = 'barbarians';

export type TurnPhase =
  | 'taxes'
  | 'recruit'
  | 'upkeep'
  | 'move'
  | 'invasions'
  | 'armies';

export const TURN_PHASES: TurnPhase[] = [
  'taxes',
  'recruit',
  'upkeep',
  'move',
  'invasions',
  'armies',
];

export type ArmySize = 3 | 5 | 10;

export type TokenPool = {
  small: number;
  medium: number;
  large: number;
};

export type PlayerSeat = {
  factionId: string;
  coins: number;
  tokens: TokenPool;
};

/** One stack on the board (loose men or an army token). */
export type CampaignStack = {
  id: string;
  /** Owning faction, or BARBARIAN_ID, or rebels via rebelOf. */
  factionId: string;
  regionId: string;
  units: number;
  kind: 'loose' | 'army';
  /** Token face when kind === 'army'. */
  armySize?: ArmySize;
  moved: boolean;
  exhausted: boolean;
  /** Fallen homeland faction — stack is a rebel unit. */
  rebelOf?: string;
};

export type SupplyGrant = {
  fromFactionId: string;
  toFactionId: string;
};

export type Siege = {
  regionId: string;
  attackerFactionId: string;
  defenderFactionId: string;
  attackerStackIds: string[];
  defenderStackIds: string[];
};

export type PendingInvasion = {
  id: string;
  regionId: string;
  attackerFactionId: string;
  attackerStackIds: string[];
  fromRegionIds: string[];
  defenderFactionId: string | null;
  status: 'pending' | 'battle' | 'siege';
  treachery: boolean;
  /** stackId → was supplied when battle opened / invasion queued for battle. */
  enteredSupplied: Record<string, boolean>;
};

export type ArmyPrompt = {
  regionId: string;
  factionId: string;
  /** Total units in the region for this faction. */
  units: number;
};

export type MatchPhase =
  | { kind: 'setup' }
  | {
      kind: 'play';
      phase: TurnPhase;
      playerIndex: number;
      round: number;
      taxesCollected: boolean;
    };

export type MatchState = {
  version: 1;
  mapId: 'europe';
  /** Mutable ownership; null = neutral. */
  regionOwners: Record<string, string | null>;
  /** Original map faction → region ids (for uprisings). */
  homeRegions: Record<string, string[]>;
  seats: PlayerSeat[];
  stacks: CampaignStack[];
  supplyGrants: SupplyGrant[];
  sieges: Siege[];
  pendingInvasions: PendingInvasion[];
  armyPrompt: ArmyPrompt | null;
  phase: MatchPhase;
  log: string[];
  nextStackId: number;
  nextInvasionId: number;
};

export function emptyTokenPool(): TokenPool {
  return { small: 3, medium: 2, large: 1 };
}

export function choosableFactions(map: CampaignMap): { id: string; name: string; color: string }[] {
  return map.factions.filter((f) => f.id !== BARBARIAN_ID);
}

export function isPlayerFaction(state: MatchState, factionId: string): boolean {
  return state.seats.some((s) => s.factionId === factionId);
}

export function isBarbarianFaction(state: MatchState, factionId: string | null): boolean {
  if (!factionId) return false;
  if (factionId === BARBARIAN_ID) return true;
  if (factionId.startsWith('rebel:')) return false;
  return !isPlayerFaction(state, factionId);
}

export function activeSeat(state: MatchState): PlayerSeat | null {
  if (state.phase.kind !== 'play') return null;
  return state.seats[state.phase.playerIndex] ?? null;
}

export function seatOf(state: MatchState, factionId: string): PlayerSeat | null {
  return state.seats.find((s) => s.factionId === factionId) ?? null;
}

export function regionById(map: CampaignMap, id: string): CampaignRegion | undefined {
  return map.regions.find((r) => r.id === id);
}

export function capitalRegions(map: CampaignMap): CampaignRegion[] {
  return map.regions.filter((r) => r.settlement.kind === 'capital');
}

export function villageRegions(map: CampaignMap): CampaignRegion[] {
  return map.regions.filter((r) => r.settlement.kind === 'village');
}

export function isCapitalRegion(map: CampaignMap, regionId: string): boolean {
  return regionById(map, regionId)?.settlement.kind === 'capital';
}

export function isIsland(map: CampaignMap, regionId: string): boolean {
  return (map.neighbors[regionId] ?? []).length === 0;
}

function newId(state: MatchState, prefix: string): string {
  const n = state.nextStackId++;
  return `${prefix}-${n}`;
}

export function makeStack(
  state: MatchState,
  partial: Omit<CampaignStack, 'id' | 'moved' | 'exhausted'> & {
    moved?: boolean;
    exhausted?: boolean;
  },
): CampaignStack {
  return {
    id: newId(state, 'stk'),
    moved: partial.moved ?? false,
    exhausted: partial.exhausted ?? false,
    factionId: partial.factionId,
    regionId: partial.regionId,
    units: partial.units,
    kind: partial.kind,
    armySize: partial.armySize,
    rebelOf: partial.rebelOf,
  };
}

/**
 * Build a fresh match after players pick seats (order = turn order).
 * Unpicked capitals become barbarian; players get 1 unit on capital + each village.
 */
export function createMatch(map: CampaignMap, factionIds: string[]): MatchState {
  const unique = [...new Set(factionIds)];
  if (unique.length < 1) throw new Error('Need at least one player');
  for (const id of unique) {
    if (id === BARBARIAN_ID) throw new Error('Cannot play as barbarians');
    if (!map.factions.some((f) => f.id === id)) throw new Error(`Unknown faction ${id}`);
  }

  const regionOwners: Record<string, string | null> = {};
  const homeRegions: Record<string, string[]> = {};
  for (const r of map.regions) {
    regionOwners[r.id] = r.ownerId;
    if (r.ownerId) {
      (homeRegions[r.ownerId] ??= []).push(r.id);
    }
  }

  const state: MatchState = {
    version: 1,
    mapId: 'europe',
    regionOwners,
    homeRegions,
    seats: unique.map((factionId) => ({
      factionId,
      coins: 1,
      tokens: emptyTokenPool(),
    })),
    stacks: [],
    supplyGrants: [],
    sieges: [],
    pendingInvasions: [],
    armyPrompt: null,
    phase: {
      kind: 'play',
      phase: 'taxes',
      playerIndex: 0,
      round: 1,
      taxesCollected: false,
    },
    log: [],
    nextStackId: 1,
    nextInvasionId: 1,
  };

  const picked = new Set(unique);

  for (const cap of capitalRegions(map)) {
    const homeOwner = map.regions.find((r) => r.id === cap.id)?.ownerId;
    if (homeOwner && picked.has(homeOwner)) {
      state.stacks.push(
        makeStack(state, {
          factionId: homeOwner,
          regionId: cap.id,
          units: 1,
          kind: 'loose',
        }),
      );
    } else {
      // Barbarian capital
      state.regionOwners[cap.id] = BARBARIAN_ID;
      state.stacks.push(
        makeStack(state, {
          factionId: BARBARIAN_ID,
          regionId: cap.id,
          units: 1,
          kind: 'loose',
        }),
      );
    }
  }

  for (const v of villageRegions(map)) {
    const owner = map.regions.find((r) => r.id === v.id)?.ownerId;
    if (owner && picked.has(owner)) {
      state.stacks.push(
        makeStack(state, {
          factionId: owner,
          regionId: v.id,
          units: 1,
          kind: 'loose',
        }),
      );
    }
  }

  state.log.push(
    `Match started: ${unique
      .map((id) => map.factions.find((f) => f.id === id)?.name ?? id)
      .join(', ')}`,
  );
  return state;
}

export function cloneMatch(state: MatchState): MatchState {
  return structuredClone(state);
}

export function saveMatch(state: MatchState): void {
  try {
    localStorage.setItem(MATCH_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

export function loadMatch(): MatchState | null {
  try {
    const raw = localStorage.getItem(MATCH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MatchState;
    if (!parsed || parsed.version !== 1 || parsed.mapId !== 'europe') return null;
    if (!Array.isArray(parsed.seats) || !Array.isArray(parsed.stacks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSavedMatch(): void {
  try {
    localStorage.removeItem(MATCH_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function pushLog(state: MatchState, line: string): void {
  state.log.push(line);
  if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
}
