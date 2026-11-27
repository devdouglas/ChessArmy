/**
 * Roguelite rules config: prices, unlocks, in-run availability, regions, globals.
 * Shipped defaults live in public/data/roguelite.json and match the previous
 * hard-coded constants. The admin page can override them in localStorage;
 * Export downloads a JSON file you can drop back into public/data/.
 */
import { PROMOTION_TOKEN_TYPES, statsOf, type PromotionTokenType, type UnitType } from './engine';
import { UNIT_STATS, UNIT_TYPES } from './roster';

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

/** A campaign-map region (from the Europe map), used by region-cleared unlocks. */
export type GameRegion = {
  id: string;
  name: string;
  ownerId: string | null;
  settlementKind: string;
};

export type RogueUnitCfg = {
  listed: boolean;
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
  listed: boolean;
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
    listed: rec,
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
    listed: !isGeneral,
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
    listed: bool(raw.listed, d.listed),
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
    listed: bool(raw.listed, d.listed),
    unlock: raw.unlock ? sanitizeUnlock(raw.unlock) : d.unlock,
    fromBattle: raw.fromBattle == null ? d.fromBattle : int(raw.fromBattle, d.fromBattle, 1, 999),
    inShop: bool(raw.inShop, d.inShop),
    enemyAllowed: bool(raw.enemyAllowed, d.enemyAllowed),
  };
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
  // Ignore leftover `regions` on old localStorage / JSON saves (Early/Late
  // battle ranges). Real regions come from the campaign map.
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
  return { version: ROGUE_CONFIG_VERSION, globals, units, promotions };
}

export const DEFAULT_ROGUE_CONFIG: RogueConfig = sanitizeRogueConfig({
  version: ROGUE_CONFIG_VERSION,
  globals: { ...DEFAULT_ROGUE_GLOBALS },
  units: {},
  promotions: {},
});

let current: RogueConfig = structuredCloneDefault();
let loadedFromFile = false;
let gameRegions: GameRegion[] = [];

function summarizeGameRegions(
  regions: { id: string; name: string; ownerId: string | null; settlement?: { kind?: string } }[],
): GameRegion[] {
  const seen = new Set<string>();
  const out: GameRegion[] = [];
  for (const r of regions) {
    const id = String(r.id ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name: String(r.name ?? id).trim() || id,
      ownerId: r.ownerId ?? null,
      settlementKind: r.settlement?.kind ?? 'none',
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return out;
}

export function getGameRegions(): GameRegion[] {
  return gameRegions;
}

/** Campaign map first (same source as Total War), then shipped europe.json. */
function regionsFromUnknown(raw: unknown): GameRegion[] {
  if (!raw || typeof raw !== 'object') return [];
  const list = (raw as { regions?: unknown }).regions;
  if (!Array.isArray(list)) return [];
  const rows: Parameters<typeof summarizeGameRegions>[0] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const r = item as {
      id?: unknown;
      name?: unknown;
      ownerId?: unknown;
      settlement?: { kind?: unknown };
    };
    if (typeof r.id !== 'string' || !r.id) continue;
    const kind = r.settlement && typeof r.settlement === 'object' ? String(r.settlement.kind ?? 'none') : 'none';
    rows.push({
      id: r.id,
      name: typeof r.name === 'string' ? r.name : r.id,
      ownerId: typeof r.ownerId === 'string' ? r.ownerId : null,
      settlement: { kind },
    });
  }
  return summarizeGameRegions(rows);
}

export async function loadGameRegions(): Promise<GameRegion[]> {
  const apply = (list: GameRegion[]) => {
    if (list.length) gameRegions = list;
  };
  // Browser only: same campaign map the Total War editor uses (local / server).
  if (typeof document !== 'undefined') {
    try {
      const store = await import('./campaign/store');
      const local = store.readLocalCampaign();
      if (local?.regions.length) apply(summarizeGameRegions(local.regions));
      const map = await store.loadCampaignMap();
      if (map.regions.length) apply(summarizeGameRegions(map.regions));
    } catch {
      /* fall through to shipped file */
    }
    if (!gameRegions.length) {
      try {
        const url = new URL('data/campaign/europe.json', document.baseURI).href;
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) apply(regionsFromUnknown(await res.json()));
      } catch {
        /* offline / missing file */
      }
    }
  }
  return gameRegions;
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
  const known = new Set(gameRegions.map((r) => r.id));
  const regionsCleared = Array.isArray(src.regionsCleared)
    ? [
        ...new Set(
          src.regionsCleared.filter((id): id is string => {
            if (typeof id !== 'string' || !id) return false;
            // Drop invented Early/Late ids; keep campaign ids (or unknown until loaded).
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
export function recordRogueBattleWin(battle: number): RogueProgress {
  const prev = readProgress();
  const b = int(battle, 0, 0, 9999);
  const next: RogueProgress = {
    runsCompleted: prev.runsCompleted,
    bestBattle: Math.max(prev.bestBattle, b),
    regionsCleared: prev.regionsCleared,
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
  if (!c.listed) return false;
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
  if (!c.listed) return false;
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
  const out: RogueConfig = {
    version: ROGUE_CONFIG_VERSION,
    globals: { ...cfg.globals },
    units,
    promotions,
  };
  return `${JSON.stringify(out, null, 2)}\n`;
}

function unitCfgSnapshot(type: UnitType, cfg: RogueConfig): Partial<RogueUnitCfg> {
  return mergeUnit(type, cfg.units[type]);
}

function promoCfgSnapshot(id: PromotionTokenType, cfg: RogueConfig): Partial<RoguePromoCfg> {
  return mergePromo(id, cfg.promotions[id]);
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
