/**
 * Roguelite rules config: prices, unlocks, in-run availability, regions, globals.
 * "Regions" are terrain-generator presets (not campaign-map provinces).
 * Shipped defaults live in public/data/roguelite.json and match the previous
 * hard-coded constants. The admin page can override them in localStorage;
 * Export downloads a JSON file you can drop back into public/data/.
 */
import { PROMOTION_TOKEN_TYPES, statsOf, type PromotionTokenType, type UnitType } from './engine';
import { UNIT_STATS, UNIT_TYPES } from './roster';
import {
  BUILTIN_TERRAIN_PRESETS,
  getTerrainPreset,
  listBuiltinTerrainPresets,
  listUserTerrainPresets,
} from './terrain-gen';

export const ROGUE_CONFIG_VERSION = 1;
export const ROGUE_CONFIG_STORAGE_KEY = 'chessarmy-roguelite-config-v1';
export const ROGUE_PROGRESS_STORAGE_KEY = 'chessarmy-roguelite-progress-v1';

export const ROGUE_UNLOCK_TYPES = [
  'always',
  'never',
  'playGames',
  'reachBattle',
  'killUnits',
  'haveCoins',
  'reachBattleNoLoss',
  'winWithUnits',
] as const;

export type RogueUnlockType = (typeof ROGUE_UNLOCK_TYPES)[number];

/** A single unlock condition. All conditions on a unit/promo must be met. */
export type RogueUnlockCondition =
  | { type: 'always' }
  | { type: 'never' }
  | { type: 'playGames'; count: number }
  | { type: 'reachBattle'; battle: number }
  | { type: 'killUnits'; count: number; unitType: string | null }
  | { type: 'haveCoins'; count: number }
  | { type: 'reachBattleNoLoss'; battle: number }
  | { type: 'winWithUnits'; count: number; unitType: string };

/** All conditions must be met. Empty means always. */
export type RogueUnlock = RogueUnlockCondition[];

export const ROGUE_UNLOCK_TYPE_LABEL: Record<RogueUnlockType, string> = {
  always: 'Always',
  never: 'Never',
  playGames: 'Play X games',
  reachBattle: 'Reach battle X',
  killUnits: 'Kill X units',
  haveCoins: 'Have X coins',
  reachBattleNoLoss: 'Reach battle X with no losses',
  winWithUnits: 'Win with X of a unit',
};

export type RogueGlobals = {
  startGold: number;
  goalBattles: number;
  startCount: number;
  shopSize: number;
  promoCost: number;
  firstPromoFree: boolean;
  enemyPromoStart: number;
  scoutRegenPer: number;
  wealthyGoldPer: number;
  starGoldPerStar: number;
  endlessAfterGoal: boolean;
};

/**
 * A map-generation preset as used in roguelite (the Regions admin list).
 */
export type RogueRegionCfg = {
  enabled: boolean;
  fromBattle: number;
  toBattle: number | null;
  weight: number;
};

export type RogueRegionInfo = {
  id: string;
  name: string;
  difficulty: number;
  builtin?: boolean;
};

export type RogueUnitCfg = {
  used: boolean;
  unlock: RogueUnlock;
  fromBattle: number;
  toBattle: number | null;
  /** Gold cost. null = use the unit's value stat (legacy). */
  price: number | null;
  inShop: boolean;
  inStartPool: boolean;
  inEnemyPool: boolean;
};

export type RoguePromoCfg = {
  used: boolean;
  unlock: RogueUnlock;
  fromBattle: number;
  inShop: boolean;
  enemyAllowed: boolean;
};

export type RogueConfig = {
  version: number;
  globals: RogueGlobals;
  units: Record<string, Partial<RogueUnitCfg>>;
  promotions: Record<string, Partial<RoguePromoCfg>>;
  regions: Record<string, Partial<RogueRegionCfg>>;
};

export type RogueProgress = {
  runsCompleted: number;
  bestBattle: number;
  regionsCleared: string[];
  /** Roguelite runs started. Migrated up to at least `runsCompleted`. */
  gamesPlayed: number;
  /** Enemy units killed, keyed by unit type. */
  kills: Record<string, number>;
  /** Highest purse seen in a run (after rewards or purchases). */
  maxCoins: number;
  /** Highest battle started or won in a run with no player unit lost. */
  bestNoLossBattle: number;
  /** Best living count of each unit type in a winning player army. */
  winsWith: Record<string, number>;
};

export type RoguePoolPurpose = 'shop' | 'start' | 'enemy';

export const DEFAULT_ROGUE_GLOBALS: RogueGlobals = {
  startGold: 0,
  goalBattles: 10,
  startCount: 2,
  shopSize: 3,
  promoCost: 1,
  firstPromoFree: true,
  enemyPromoStart: 7,
  scoutRegenPer: 2,
  wealthyGoldPer: 1,
  starGoldPerStar: 1,
  endlessAfterGoal: true,
};

function int(n: unknown, fallback: number, min = 0, max = 999): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** Prefer `used`; accept legacy `listed` from older JSON / localStorage. */
function usedFlag(raw: { used?: unknown; listed?: unknown } | undefined, fallback: boolean): boolean {
  if (!raw) return fallback;
  if (typeof raw.used === 'boolean') return raw.used;
  if (typeof raw.listed === 'boolean') return raw.listed;
  return fallback;
}

function sanitizeUnlockCondition(raw: unknown): RogueUnlockCondition | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as {
    type?: unknown;
    battle?: unknown;
    count?: unknown;
    unitType?: unknown;
    regionId?: unknown;
  };
  let t = src.type;
  // Migrate old single-condition kinds.
  if (t === 'battleAtLeast') t = 'reachBattle';
  if (t === 'runsCompleted') t = 'playGames';
  if (t === 'regionCleared') return { type: 'always' };
  if (t === 'never') return { type: 'never' };
  if (t === 'playGames') return { type: 'playGames', count: int(src.count, 1, 0, 999) };
  if (t === 'reachBattle') return { type: 'reachBattle', battle: int(src.battle, 1, 1, 999) };
  if (t === 'killUnits') {
    const typ = String(src.unitType ?? '').trim();
    return { type: 'killUnits', count: int(src.count, 1, 1, 9999), unitType: typ || null };
  }
  if (t === 'haveCoins') return { type: 'haveCoins', count: int(src.count, 1, 0, 9999) };
  if (t === 'reachBattleNoLoss') {
    return { type: 'reachBattleNoLoss', battle: int(src.battle, 1, 1, 999) };
  }
  if (t === 'winWithUnits') {
    const typ = String(src.unitType ?? '').trim();
    if (!typ) return null;
    return { type: 'winWithUnits', count: int(src.count, 1, 1, 99), unitType: typ };
  }
  if (t === 'always') return { type: 'always' };
  return null;
}

export function sanitizeUnlock(raw: unknown): RogueUnlock {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
  const out: RogueUnlockCondition[] = [];
  for (const item of list) {
    const c = sanitizeUnlockCondition(item);
    if (c) out.push(c);
  }
  // never already fails; drop redundant always when mixed with real conditions.
  const meaningful = out.filter((c) => c.type !== 'always');
  if (meaningful.some((c) => c.type === 'never')) return [{ type: 'never' }];
  if (!meaningful.length) return [{ type: 'always' }];
  return meaningful;
}

export function defaultUnitCfg(type: UnitType): RogueUnitCfg {
  const rec = !!UNIT_STATS[type]?.recruitable;
  return {
    used: rec,
    unlock: [{ type: 'always' }],
    fromBattle: 1,
    toBattle: null,
    price: null,
    inShop: rec,
    inStartPool: rec,
    inEnemyPool: rec,
  };
}

export function defaultPromoCfg(id: PromotionTokenType): RoguePromoCfg {
  const isGeneral = id === 'general';
  return {
    used: !isGeneral,
    unlock: [{ type: 'always' }],
    fromBattle: 1,
    inShop: !isGeneral,
    enemyAllowed: id !== 'general' && id !== 'scout' && id !== 'wealthy',
  };
}

function mergeUnit(type: UnitType, raw?: Partial<RogueUnitCfg>): RogueUnitCfg {
  const d = defaultUnitCfg(type);
  if (!raw) return d;
  const toBattle =
    raw.toBattle == null || raw.toBattle === ('' as unknown)
      ? d.toBattle
      : int(raw.toBattle, d.toBattle ?? 0, 1, 999);
  return {
    used: usedFlag(raw, d.used),
    unlock: raw.unlock ? sanitizeUnlock(raw.unlock) : d.unlock,
    fromBattle: raw.fromBattle == null ? d.fromBattle : int(raw.fromBattle, d.fromBattle, 1, 999),
    toBattle: raw.toBattle == null ? d.toBattle : toBattle,
    price: raw.price == null || raw.price === ('' as unknown) ? d.price : int(raw.price, 0, 0, 9999),
    inShop: bool(raw.inShop, d.inShop),
    inStartPool: bool(raw.inStartPool, d.inStartPool),
    inEnemyPool: bool(raw.inEnemyPool, d.inEnemyPool),
  };
}

function mergePromo(id: PromotionTokenType, raw?: Partial<RoguePromoCfg>): RoguePromoCfg {
  const d = defaultPromoCfg(id);
  if (!raw) return d;
  return {
    used: usedFlag(raw, d.used),
    unlock: raw.unlock ? sanitizeUnlock(raw.unlock) : d.unlock,
    fromBattle: raw.fromBattle == null ? d.fromBattle : int(raw.fromBattle, d.fromBattle, 1, 999),
    inShop: bool(raw.inShop, d.inShop),
    enemyAllowed: bool(raw.enemyAllowed, d.enemyAllowed),
  };
}

/** Same battle windows Auto used before regions were configurable: 1, 4, or 8. */
export function defaultRegionFromBattle(difficulty: number): number {
  if (difficulty <= 1) return 1;
  if (difficulty === 2) return 4;
  return 8;
}

export function defaultRegionCfg(id: string): RogueRegionCfg {
  const p = getTerrainPreset(id) ?? BUILTIN_TERRAIN_PRESETS.find((x) => x.id === id);
  const difficulty = p?.difficulty ?? 1;
  return {
    enabled: difficulty > 0,
    fromBattle: defaultRegionFromBattle(difficulty),
    toBattle: null,
    weight: 1,
  };
}

function mergeRegion(id: string, raw?: Partial<RogueRegionCfg>): RogueRegionCfg {
  const d = defaultRegionCfg(id);
  if (!raw) return d;
  const toBattle =
    raw.toBattle == null || raw.toBattle === ('' as unknown)
      ? d.toBattle
      : int(raw.toBattle, d.toBattle ?? 0, 1, 999);
  return {
    enabled: bool(raw.enabled, d.enabled),
    fromBattle: raw.fromBattle == null ? d.fromBattle : int(raw.fromBattle, d.fromBattle, 1, 999),
    toBattle: raw.toBattle == null ? d.toBattle : toBattle,
    weight: raw.weight == null ? d.weight : int(raw.weight, d.weight, 0, 999),
  };
}

function rawRegionsMap(raw: unknown): Record<string, Partial<RogueRegionCfg>> {
  // Ignore leftover arrays from old Early/Late or campaign-map saves.
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, Partial<RogueRegionCfg>> = {};
  for (const [id, val] of Object.entries(raw as Record<string, unknown>)) {
    if (id && val && typeof val === 'object' && !Array.isArray(val)) {
      out[id] = val as Partial<RogueRegionCfg>;
    }
  }
  return out;
}

export function sanitizeRogueConfig(raw: unknown): RogueConfig {
  const src = raw && typeof raw === 'object' ? (raw as Partial<RogueConfig>) : {};
  const g: Partial<RogueGlobals> = src.globals && typeof src.globals === 'object' ? src.globals : {};
  const globals: RogueGlobals = {
    startGold: int(g.startGold, DEFAULT_ROGUE_GLOBALS.startGold, 0, 9999),
    goalBattles: int(g.goalBattles, DEFAULT_ROGUE_GLOBALS.goalBattles, 1, 999),
    startCount: int(g.startCount, DEFAULT_ROGUE_GLOBALS.startCount, 1, 16),
    shopSize: int(g.shopSize, DEFAULT_ROGUE_GLOBALS.shopSize, 1, 12),
    promoCost: int(g.promoCost, DEFAULT_ROGUE_GLOBALS.promoCost, 0, 99),
    firstPromoFree: bool(g.firstPromoFree, DEFAULT_ROGUE_GLOBALS.firstPromoFree),
    enemyPromoStart: int(g.enemyPromoStart, DEFAULT_ROGUE_GLOBALS.enemyPromoStart, 1, 999),
    scoutRegenPer: int(g.scoutRegenPer, DEFAULT_ROGUE_GLOBALS.scoutRegenPer, 0, 20),
    wealthyGoldPer: int(g.wealthyGoldPer, DEFAULT_ROGUE_GLOBALS.wealthyGoldPer, 0, 20),
    starGoldPerStar: int(g.starGoldPerStar, DEFAULT_ROGUE_GLOBALS.starGoldPerStar, 0, 20),
    endlessAfterGoal: bool(g.endlessAfterGoal, DEFAULT_ROGUE_GLOBALS.endlessAfterGoal),
  };
  const rawRegions = rawRegionsMap((src as { regions?: unknown }).regions);
  const regionIds = new Set<string>([
    ...BUILTIN_TERRAIN_PRESETS.map((p) => p.id),
    ...Object.keys(rawRegions),
  ]);
  const regions: Record<string, Partial<RogueRegionCfg>> = {};
  for (const id of regionIds) {
    regions[id] = mergeRegion(id, rawRegions[id]);
  }
  const units: Record<string, Partial<RogueUnitCfg>> = {};
  if (src.units && typeof src.units === 'object') {
    for (const [id, val] of Object.entries(src.units)) {
      if (id && val && typeof val === 'object') units[id] = { ...(val as Partial<RogueUnitCfg>) };
    }
  }
  const promotions: Record<string, Partial<RoguePromoCfg>> = {};
  if (src.promotions && typeof src.promotions === 'object') {
    for (const [id, val] of Object.entries(src.promotions)) {
      if (id && val && typeof val === 'object') promotions[id] = { ...(val as Partial<RoguePromoCfg>) };
    }
  }
  return { version: ROGUE_CONFIG_VERSION, globals, units, promotions, regions };
}

export const DEFAULT_ROGUE_CONFIG: RogueConfig = sanitizeRogueConfig({
  version: ROGUE_CONFIG_VERSION,
  globals: { ...DEFAULT_ROGUE_GLOBALS },
  units: {},
  promotions: {},
});

let current: RogueConfig = structuredCloneDefault();
let loadedFromFile = false;

export function regionRogueCfg(id: string, cfg: RogueConfig = current): RogueRegionCfg {
  return mergeRegion(id, cfg.regions[id]);
}

function compareRogueRegionPresets(a: RogueRegionInfo, b: RogueRegionInfo, cfg: RogueConfig): number {
  if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
  const fa = regionRogueCfg(a.id, cfg).fromBattle;
  const fb = regionRogueCfg(b.id, cfg).fromBattle;
  if (fa !== fb) return fa - fb;
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

/** Terrain presets ordered by difficulty, then from-battle, then name. */
export function listRogueRegionPresets(cfg: RogueConfig = current): RogueRegionInfo[] {
  const seen = new Set<string>();
  const out: RogueRegionInfo[] = [];
  const add = (row: RogueRegionInfo) => {
    if (!row.id || seen.has(row.id)) return;
    seen.add(row.id);
    out.push(row);
  };
  for (const p of listBuiltinTerrainPresets()) {
    add({ id: p.id, name: p.name, difficulty: p.difficulty, builtin: true });
  }
  for (const p of listUserTerrainPresets()) {
    add({ id: p.id, name: p.name, difficulty: p.difficulty, builtin: false });
  }
  for (const id of Object.keys(cfg.regions)) {
    if (seen.has(id)) continue;
    const p = getTerrainPreset(id);
    add({
      id,
      name: p?.name ?? id,
      difficulty: p?.difficulty ?? 1,
      builtin: !!p?.builtin,
    });
  }
  out.sort((a, b) => compareRogueRegionPresets(a, b, cfg));
  return out;
}

export function regionAvailableInBattle(id: string, battle: number, cfg: RogueConfig = current): boolean {
  const c = regionRogueCfg(id, cfg);
  if (!c.enabled || c.weight <= 0) return false;
  if (battle < c.fromBattle) return false;
  if (c.toBattle != null && battle > c.toBattle) return false;
  return true;
}

function knownRegionIds(cfg: RogueConfig = current): Set<string> {
  return new Set(listRogueRegionPresets(cfg).map((r) => r.id));
}

function structuredCloneDefault(): RogueConfig {
  return sanitizeRogueConfig(DEFAULT_ROGUE_CONFIG);
}

export function getRogueConfig(): RogueConfig {
  return current;
}

export function unitRogueCfg(type: UnitType): RogueUnitCfg {
  return mergeUnit(type, current.units[type]);
}

export function promoRogueCfg(id: PromotionTokenType): RoguePromoCfg {
  return mergePromo(id, current.promotions[id]);
}

function intMap(raw: unknown, max = 99999): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!k) continue;
    const n = int(v, 0, 0, max);
    if (n > 0) out[k] = n;
  }
  return out;
}

export function emptyRogueProgress(): RogueProgress {
  return {
    runsCompleted: 0,
    bestBattle: 0,
    regionsCleared: [],
    gamesPlayed: 0,
    kills: {},
    maxCoins: 0,
    bestNoLossBattle: 0,
    winsWith: {},
  };
}

export function sanitizeRogueProgress(raw: unknown): RogueProgress {
  const src = raw && typeof raw === 'object' ? (raw as Partial<RogueProgress>) : {};
  const known = knownRegionIds();
  const regionsCleared = Array.isArray(src.regionsCleared)
    ? [
        ...new Set(
          src.regionsCleared.filter((id): id is string => {
            if (typeof id !== 'string' || !id) return false;
            // Drop invented Early/Late ids and leftover campaign-map ids.
            if (id === 'early' || id === 'late') return false;
            return known.size ? known.has(id) : true;
          }),
        ),
      ]
    : [];
  const runsCompleted = int(src.runsCompleted, 0, 0, 9999);
  return {
    runsCompleted,
    bestBattle: int(src.bestBattle, 0, 0, 9999),
    regionsCleared,
    gamesPlayed: Math.max(int(src.gamesPlayed, 0, 0, 9999), runsCompleted),
    kills: intMap(src.kills),
    maxCoins: int(src.maxCoins, 0, 0, 99999),
    bestNoLossBattle: int(src.bestNoLossBattle, 0, 0, 9999),
    winsWith: intMap(src.winsWith, 99),
  };
}

function readProgress(): RogueProgress {
  try {
    if (typeof localStorage === 'undefined') return emptyRogueProgress();
    const raw = localStorage.getItem(ROGUE_PROGRESS_STORAGE_KEY);
    if (!raw) return emptyRogueProgress();
    return sanitizeRogueProgress(JSON.parse(raw) as unknown);
  } catch {
    return emptyRogueProgress();
  }
}

function writeProgress(p: RogueProgress): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(ROGUE_PROGRESS_STORAGE_KEY, JSON.stringify(sanitizeRogueProgress(p)));
  } catch {
    /* private mode */
  }
}

export function getRogueProgress(): RogueProgress {
  return readProgress();
}

export function setRogueProgress(p: RogueProgress): void {
  writeProgress(p);
}

export type RogueProgressPatch = {
  regionId?: string;
  kills?: Record<string, number>;
  gold?: number;
  lostUnit?: boolean;
  /** Living player unit counts at a battle win, by type. */
  army?: Record<string, number>;
  /** Battle just started, with no player unit lost in this run so far. */
  noLossBattle?: number;
};

function addCounts(into: Record<string, number>, add?: Record<string, number>): Record<string, number> {
  if (!add) return into;
  const out = { ...into };
  for (const [k, v] of Object.entries(add)) {
    const n = Math.max(0, Math.floor(v));
    if (!k || n <= 0) continue;
    out[k] = (out[k] ?? 0) + n;
  }
  return out;
}

function maxCounts(into: Record<string, number>, seen?: Record<string, number>): Record<string, number> {
  if (!seen) return into;
  const out = { ...into };
  for (const [k, v] of Object.entries(seen)) {
    const n = Math.max(0, Math.floor(v));
    if (!k || n <= 0) continue;
    out[k] = Math.max(out[k] ?? 0, n);
  }
  return out;
}

function applyProgressPatch(prev: RogueProgress, battle: number, patch: RogueProgressPatch = {}): RogueProgress {
  const b = int(battle, 0, 0, 9999);
  const id = patch.regionId?.trim() ?? '';
  const regionsCleared =
    id && !prev.regionsCleared.includes(id) ? [...prev.regionsCleared, id] : prev.regionsCleared;
  const noLoss = !patch.lostUnit
    ? Math.max(prev.bestNoLossBattle, b, patch.noLossBattle ?? 0)
    : Math.max(prev.bestNoLossBattle, patch.noLossBattle ?? 0);
  return {
    ...prev,
    bestBattle: Math.max(prev.bestBattle, b),
    regionsCleared,
    kills: addCounts(prev.kills, patch.kills),
    maxCoins: Math.max(prev.maxCoins, int(patch.gold, 0, 0, 99999)),
    bestNoLossBattle: noLoss,
    winsWith: maxCounts(prev.winsWith, patch.army),
  };
}

/** Update stored meta-progress after a battle win (`battle` is the battle just won). */
export function recordRogueBattleWin(
  battle: number,
  regionId?: string,
  patch: RogueProgressPatch = {},
): RogueProgress {
  const prev = readProgress();
  const next = applyProgressPatch(prev, battle, { ...patch, regionId: regionId ?? patch.regionId });
  writeProgress(next);
  return next;
}

/** Record kills / gold / a lost unit when a roguelite match ends in defeat. */
export function recordRogueMatchProgress(battle: number, patch: RogueProgressPatch): RogueProgress {
  const prev = readProgress();
  const next = applyProgressPatch(prev, 0, { ...patch, lostUnit: patch.lostUnit ?? true });
  // Defeat should not raise bestBattle; applyProgressPatch with battle 0 keeps it.
  void battle;
  writeProgress(next);
  return next;
}

/** Count a run start as a game played, and note starting gold / battle 1 if still clean. */
export function recordRogueRunStarted(gold = 0): RogueProgress {
  const prev = readProgress();
  const next: RogueProgress = {
    ...prev,
    gamesPlayed: prev.gamesPlayed + 1,
    maxCoins: Math.max(prev.maxCoins, int(gold, 0, 0, 99999)),
    bestNoLossBattle: Math.max(prev.bestNoLossBattle, 1),
  };
  writeProgress(next);
  return next;
}

/** Track the highest purse held. */
export function recordRogueGold(gold: number): RogueProgress {
  const prev = readProgress();
  const maxCoins = Math.max(prev.maxCoins, int(gold, 0, 0, 99999));
  if (maxCoins === prev.maxCoins) return prev;
  const next = { ...prev, maxCoins };
  writeProgress(next);
  return next;
}

/** A new battle has started in a still-clean run. */
export function recordRogueNoLossBattle(battle: number): RogueProgress {
  const prev = readProgress();
  const bestNoLossBattle = Math.max(prev.bestNoLossBattle, int(battle, 0, 0, 9999));
  if (bestNoLossBattle === prev.bestNoLossBattle) return prev;
  const next = { ...prev, bestNoLossBattle };
  writeProgress(next);
  return next;
}

/** Count a finished goal run (player opts out after the goal battle). */
export function recordRogueRunCompleted(): RogueProgress {
  const prev = readProgress();
  const next = { ...prev, runsCompleted: prev.runsCompleted + 1 };
  writeProgress(next);
  return next;
}

export function killsCounted(progress: RogueProgress, unitType?: string | null): number {
  if (unitType) return progress.kills[unitType] ?? 0;
  return Object.values(progress.kills).reduce((n, v) => n + v, 0);
}

export function conditionSatisfied(
  cond: RogueUnlockCondition,
  progress: RogueProgress,
  battle = 1,
): boolean {
  switch (cond.type) {
    case 'always':
      return true;
    case 'never':
      return false;
    case 'playGames':
      return progress.gamesPlayed >= cond.count;
    case 'reachBattle':
      return battle >= cond.battle || progress.bestBattle >= cond.battle;
    case 'killUnits':
      return killsCounted(progress, cond.unitType) >= cond.count;
    case 'haveCoins':
      return progress.maxCoins >= cond.count;
    case 'reachBattleNoLoss':
      return progress.bestNoLossBattle >= cond.battle;
    case 'winWithUnits':
      return (progress.winsWith[cond.unitType] ?? 0) >= cond.count;
    default:
      return false;
  }
}

export function unlockSatisfied(unlock: RogueUnlock, progress: RogueProgress, battle = 1): boolean {
  return sanitizeUnlock(unlock).every((c) => conditionSatisfied(c, progress, battle));
}

export type UnlockConditionStatus = {
  type: RogueUnlockType;
  text: string;
  current: number;
  target: number;
  done: boolean;
};

function unitLabel(id: string | null | undefined): string {
  if (!id) return 'units';
  return UNIT_STATS[id as UnitType]?.name ?? id;
}

export function describeUnlockCondition(
  cond: RogueUnlockCondition,
  progress: RogueProgress,
  battle = 1,
): UnlockConditionStatus {
  const done = conditionSatisfied(cond, progress, battle);
  switch (cond.type) {
    case 'always':
      return { type: 'always', text: 'Always unlocked', current: 1, target: 1, done: true };
    case 'never':
      return { type: 'never', text: 'Never', current: 0, target: 1, done: false };
    case 'playGames':
      return {
        type: 'playGames',
        text: `${Math.min(progress.gamesPlayed, cond.count)}/${cond.count} games`,
        current: progress.gamesPlayed,
        target: cond.count,
        done,
      };
    case 'reachBattle': {
      const cur = Math.max(battle, progress.bestBattle);
      return {
        type: 'reachBattle',
        text: cur >= cond.battle ? `Reached battle ${cond.battle}` : `Reach battle ${cond.battle} (best ${cur})`,
        current: cur,
        target: cond.battle,
        done,
      };
    }
    case 'killUnits': {
      const cur = killsCounted(progress, cond.unitType);
      const who = cond.unitType ? unitLabel(cond.unitType) : 'units';
      return {
        type: 'killUnits',
        text: `Kill ${cond.count} ${who} (${cur}/${cond.count})`,
        current: cur,
        target: cond.count,
        done,
      };
    }
    case 'haveCoins':
      return {
        type: 'haveCoins',
        text: `Have ${cond.count} coins (max ${progress.maxCoins})`,
        current: progress.maxCoins,
        target: cond.count,
        done,
      };
    case 'reachBattleNoLoss':
      return {
        type: 'reachBattleNoLoss',
        text:
          progress.bestNoLossBattle >= cond.battle
            ? `Reached battle ${cond.battle} with no losses`
            : `Reach battle ${cond.battle} with no losses (best ${progress.bestNoLossBattle})`,
        current: progress.bestNoLossBattle,
        target: cond.battle,
        done,
      };
    case 'winWithUnits': {
      const cur = progress.winsWith[cond.unitType] ?? 0;
      const who = unitLabel(cond.unitType);
      return {
        type: 'winWithUnits',
        text: `Win with ${cond.count} ${who} (best ${cur})`,
        current: cur,
        target: cond.count,
        done,
      };
    }
    default:
      return { type: 'always', text: '', current: 0, target: 0, done: false };
  }
}

export function describeUnlock(
  unlock: RogueUnlock,
  progress: RogueProgress,
  battle = 1,
): UnlockConditionStatus[] {
  return sanitizeUnlock(unlock)
    .filter((c) => c.type !== 'always')
    .map((c) => describeUnlockCondition(c, progress, battle));
}

export function unitAvailableInRun(type: UnitType, battle: number, purpose: RoguePoolPurpose, progress: RogueProgress): boolean {
  const c = unitRogueCfg(type);
  if (!c.used) return false;
  if (purpose === 'shop' && !c.inShop) return false;
  if (purpose === 'start' && !c.inStartPool) return false;
  if (purpose === 'enemy' && !c.inEnemyPool) return false;
  if (!unlockSatisfied(c.unlock, progress, battle)) return false;
  if (battle < c.fromBattle) return false;
  if (c.toBattle != null && battle > c.toBattle) return false;
  return true;
}

export function promoAvailableInRun(
  id: PromotionTokenType,
  battle: number,
  purpose: 'shop' | 'enemy',
  progress: RogueProgress,
): boolean {
  const c = promoRogueCfg(id);
  if (!c.used) return false;
  if (purpose === 'shop' && !c.inShop) return false;
  if (purpose === 'enemy' && !c.enemyAllowed) return false;
  if (!unlockSatisfied(c.unlock, progress, battle)) return false;
  if (battle < c.fromBattle) return false;
  return true;
}

export function configuredUnitCost(type: UnitType): number {
  const c = unitRogueCfg(type);
  if (c.price != null) return Math.max(0, Math.floor(c.price));
  return Math.max(0, Math.floor(statsOf(type).value));
}

export function applyRogueConfig(raw: unknown): RogueConfig {
  current = sanitizeRogueConfig(raw);
  return current;
}

export function saveRogueConfigLocal(cfg: RogueConfig): RogueConfig {
  current = sanitizeRogueConfig(cfg);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ROGUE_CONFIG_STORAGE_KEY, JSON.stringify(current));
    }
  } catch {
    /* private mode */
  }
  return current;
}

export function clearRogueConfigLocal(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(ROGUE_CONFIG_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function hasRogueConfigOverride(): boolean {
  try {
    return typeof localStorage !== 'undefined' && !!localStorage.getItem(ROGUE_CONFIG_STORAGE_KEY);
  } catch {
    return false;
  }
}

export function exportRogueConfigJson(cfg: RogueConfig = current): string {
  // Expand units currently in the roster so the file is a complete snapshot.
  const units: Record<string, Partial<RogueUnitCfg>> = { ...cfg.units };
  for (const t of UNIT_TYPES) {
    units[t] = unitCfgSnapshot(t, cfg);
  }
  const promotions: Record<string, Partial<RoguePromoCfg>> = {};
  for (const id of PROMOTION_TOKEN_TYPES) {
    promotions[id] = promoCfgSnapshot(id, cfg);
  }
  const regions: Record<string, Partial<RogueRegionCfg>> = {};
  for (const r of listRogueRegionPresets(cfg)) {
    regions[r.id] = regionCfgSnapshot(r.id, cfg);
  }
  for (const [id, val] of Object.entries(cfg.regions)) {
    if (!(id in regions)) regions[id] = val;
  }
  const out: RogueConfig = {
    version: ROGUE_CONFIG_VERSION,
    globals: { ...cfg.globals },
    units,
    promotions,
    regions,
  };
  return `${JSON.stringify(out, null, 2)}\n`;
}

function unitCfgSnapshot(type: UnitType, cfg: RogueConfig): Partial<RogueUnitCfg> {
  return mergeUnit(type, cfg.units[type]);
}

function promoCfgSnapshot(id: PromotionTokenType, cfg: RogueConfig): Partial<RoguePromoCfg> {
  return mergePromo(id, cfg.promotions[id]);
}

function regionCfgSnapshot(id: string, cfg: RogueConfig): Partial<RogueRegionCfg> {
  return mergeRegion(id, cfg.regions[id]);
}

function readLocalOverride(): RogueConfig | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(ROGUE_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    return sanitizeRogueConfig(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

/**
 * Load shipped JSON then apply a localStorage override (admin edits).
 * Safe to call more than once. Missing files leave the built-in seed in place.
 */
export async function loadRogueConfig(): Promise<RogueConfig> {
  if (typeof fetch === 'undefined') {
    const local = readLocalOverride();
    if (local) current = local;
    return current;
  }
  if (!loadedFromFile) {
    try {
      const url = new URL('data/roguelite.json', document.baseURI).href;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        current = sanitizeRogueConfig(await res.json());
        loadedFromFile = true;
      }
    } catch {
      /* offline / missing file — keep seed */
    }
  }
  const local = readLocalOverride();
  if (local) current = local;
  return current;
}

export function reloadShippedRogueConfig(): Promise<RogueConfig> {
  loadedFromFile = false;
  current = structuredCloneDefault();
  clearRogueConfigLocal();
  return loadRogueConfig();
}
