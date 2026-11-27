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

export type RogueUnlock =
  | { type: 'always' }
  | { type: 'never' }
  | { type: 'battleAtLeast'; battle: number }
  | { type: 'runsCompleted'; count: number }
  | { type: 'regionCleared'; regionId: string };

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
 * `regionCleared` unlocks refer to these preset ids.
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
};

export type RoguePoolPurpose = 'shop' | 'start' | 'enemy';

const ALWAYS: RogueUnlock = { type: 'always' };

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

export function sanitizeUnlock(raw: unknown): RogueUnlock {
  if (!raw || typeof raw !== 'object') return { ...ALWAYS };
  const t = (raw as { type?: unknown }).type;
  if (t === 'never') return { type: 'never' };
  if (t === 'battleAtLeast') {
    return { type: 'battleAtLeast', battle: int((raw as { battle?: unknown }).battle, 1, 1, 999) };
  }
  if (t === 'runsCompleted') {
    return { type: 'runsCompleted', count: int((raw as { count?: unknown }).count, 1, 0, 999) };
  }
  if (t === 'regionCleared') {
    const regionId = String((raw as { regionId?: unknown }).regionId ?? '').trim();
    return regionId ? { type: 'regionCleared', regionId } : { ...ALWAYS };
  }
  return { ...ALWAYS };
}

export function defaultUnitCfg(type: UnitType): RogueUnitCfg {
  const rec = !!UNIT_STATS[type]?.recruitable;
  return {
    used: rec,
    unlock: { ...ALWAYS },
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
    unlock: { ...ALWAYS },
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

/** Built-in presets, then user presets, then any leftover ids still in the config. */
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

export function emptyRogueProgress(): RogueProgress {
  return { runsCompleted: 0, bestBattle: 0, regionsCleared: [] };
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
  return {
    runsCompleted: int(src.runsCompleted, 0, 0, 9999),
    bestBattle: int(src.bestBattle, 0, 0, 9999),
    regionsCleared,
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

/** Update stored meta-progress after a battle win (`battle` is the battle just won). */
export function recordRogueBattleWin(battle: number, regionId?: string): RogueProgress {
  const prev = readProgress();
  const b = int(battle, 0, 0, 9999);
  const id = regionId?.trim() ?? '';
  const regionsCleared =
    id && !prev.regionsCleared.includes(id) ? [...prev.regionsCleared, id] : prev.regionsCleared;
  const next: RogueProgress = {
    runsCompleted: prev.runsCompleted,
    bestBattle: Math.max(prev.bestBattle, b),
    regionsCleared,
  };
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

export function unlockSatisfied(unlock: RogueUnlock, progress: RogueProgress, battle = 1): boolean {
  switch (unlock.type) {
    case 'always':
      return true;
    case 'never':
      return false;
    case 'battleAtLeast':
      return battle >= unlock.battle || progress.bestBattle >= unlock.battle;
    case 'runsCompleted':
      return progress.runsCompleted >= unlock.count;
    case 'regionCleared':
      return progress.regionsCleared.includes(unlock.regionId);
    default:
      return true;
  }
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
  const regions: Record<string, Partial<RogueRegionCfg>> = { ...cfg.regions };
  for (const r of listRogueRegionPresets(cfg)) {
    regions[r.id] = regionCfgSnapshot(r.id, cfg);
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
