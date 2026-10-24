import {
  clampMaxTurns,
  clampUnitsPerTurn,
  isKnownUnit,
  sanitizeUnitTokens,
  isSide,
  sanitizeArmyControls,
  sanitizeAiStyles,
  sanitizeTokens,
  liftWallTerrain,
  type ArmyControl,
  type AiStyle,
  type Side,
  type Terrain,
  type TileToken,
  type UnitType,
} from './engine';
import type { HexOrientation } from './hex';
import {
  COLS,
  DEFAULT_ORIENTATION,
  cloneTerrain,
  emptyTerrain,
  sanitizeStampFacing,
  type ArmyStamp,
} from './map';
import { notifyPersist } from './persist-hook';
import { getSelectedPeriod, sanitizePeriod, type Period } from './period';

const STORAGE_KEY = 'chessarmy-levels-v1';
const DELETED_KEY = 'chessarmy-levels-deleted-v1';
const ACTIVE_KEY = 'chessarmy-active-level';
const DEFAULT_KEY = 'chessarmy-default-level';
const FILTER_KEY = 'chessarmy-levels-filter';

export type LevelCategory = 'campaign' | 'tutorial' | 'historical' | 'skirmish';

export const LEVEL_CATEGORIES: LevelCategory[] = [
  'campaign',
  'tutorial',
  'skirmish',
  'historical',
];

export const LEVEL_CATEGORY_LABEL: Record<LevelCategory, string> = {
  campaign: 'Campaign',
  tutorial: 'Tutorial',
  skirmish: 'Skirmish',
  historical: 'Historical',
};

export function isLevelCategory(raw: unknown): raw is LevelCategory {
  return LEVEL_CATEGORIES.includes(raw as LevelCategory);
}

export function sanitizeCategory(raw: unknown): LevelCategory {
  if (isLevelCategory(raw)) return raw;
  if (raw === 'free') return 'historical';
  return 'historical';
}

export type SavedLevel = {
  id: string;
  name: string;
  cols: number;
  rows: number;
  /** Default pointy for levels saved before this field existed. */
  orientation: HexOrientation;
  /** terrain[row][col] */
  terrain: Terrain[][];
  /** Stamped armies. Missing = spawn stock on Play. Empty = no pieces. */
  armies?: ArmyStamp[];
  /** Per-color controller. Missing → red player, everyone else ai enemy. */
  armyControls?: Record<Side, ArmyControl>;
  /** Per-color AI checklist. Missing → aggressive. */
  aiStyles?: Record<Side, AiStyle>;
  /** Overlay stamps (pikes, walls, flags, …). Missing on old saves → none. */
  tokens?: TileToken[];
  /** Missing on old saves → historical (was `free`). */
  category: LevelCategory;
  /** Missing on old saves → modern. */
  period: Period;
  /** Playlist order within category + period. Missing on old saves → A–Z then compacted. */
  sort: number;
  /** Pieces a side may activate per turn. Missing on old saves → 1. */
  unitsPerTurn: number;
  /** Full rounds to win. 0 = no cap. Missing on old saves → 0. */
  maxTurns: number;
  /** One-liner on map lists under the title. Empty = omit. */
  teaserText: string;
  /** Briefing at match start. Empty = skip overlay. */
  startText: string;
  /** Shown on victory (Red / human). Empty = stock win copy. */
  winText: string;
  /** Shown on defeat (Blue wins). Empty = stock lose copy. */
  loseText: string;
  /** Extra stars (2 and 3). Star 1 is always a win. */
  star2: StarRule;
  star3: StarRule;
  updatedAt: number;
};

export type StarMetric = 'turns' | 'casualties';
export type StarOp = 'lt' | 'lte' | 'eq';
export type StarRule = { metric: StarMetric; op: StarOp; value: number };

export const STAR_VALUE_MAX = 99;

export const DEFAULT_STAR_2: StarRule = { metric: 'turns', op: 'lt', value: 6 };
export const DEFAULT_STAR_3: StarRule = { metric: 'casualties', op: 'eq', value: 0 };

export function sanitizeStarMetric(raw: unknown): StarMetric {
  return raw === 'casualties' ? 'casualties' : 'turns';
}

export function sanitizeStarOp(raw: unknown): StarOp {
  if (raw === 'lte' || raw === 'eq') return raw;
  return 'lt';
}

export function sanitizeStarRule(raw: unknown, fallback: StarRule): StarRule {
  const src =
    raw && typeof raw === 'object' ? (raw as Partial<StarRule>) : fallback;
  const value = Math.floor(Number(src.value));
  return {
    metric: sanitizeStarMetric(src.metric ?? fallback.metric),
    op: sanitizeStarOp(src.op ?? fallback.op),
    value: Number.isFinite(value)
      ? Math.max(0, Math.min(STAR_VALUE_MAX, value))
      : fallback.value,
  };
}

export function starRuleMet(
  rule: StarRule,
  turns: number,
  ownCasualties: number,
): boolean {
  const n = rule.metric === 'turns' ? turns : ownCasualties;
  if (rule.op === 'lt') return n < rule.value;
  if (rule.op === 'lte') return n <= rule.value;
  return n === rule.value;
}

/** Both metrics only increase, so a failed rule stays failed. */
export function starRulePossible(
  rule: StarRule,
  turns: number,
  ownCasualties: number,
): boolean {
  const n = rule.metric === 'turns' ? turns : ownCasualties;
  if (rule.op === 'lt') return n < rule.value;
  if (rule.op === 'lte' || rule.op === 'eq') return n <= rule.value;
  return false;
}

export function starOpLabel(op: StarOp): string {
  if (op === 'lte') return '≤';
  if (op === 'eq') return '=';
  return '<';
}

export function starRuleLabel(rule: StarRule): string {
  if (rule.metric === 'casualties' && rule.op === 'eq' && rule.value === 0) {
    return 'No casualties';
  }
  const noun = rule.metric === 'turns' ? 'Turns' : 'Casualties';
  return `${noun} ${starOpLabel(rule.op)} ${rule.value}`;
}

export const LEVEL_TEXT_MAX = 280;
export const TEASER_TEXT_MAX = 120;

export function sanitizeLevelText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, LEVEL_TEXT_MAX);
}

export function sanitizeTeaserText(raw: unknown): string {
  return sanitizeLevelText(raw).slice(0, TEASER_TEXT_MAX);
}

export { emptyTerrain, cloneTerrain };

function uid(): string {
  return `lvl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function listLevels(): SavedLevel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedLevel[];
    if (!Array.isArray(parsed)) return [];
    return normalizeLevels(parsed);
  } catch {
    return [];
  }
}

function validType(t: unknown): t is UnitType {
  return isKnownUnit(t);
}

function sanitizeArmies(raw: unknown, cols: number, rows: number): ArmyStamp[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const out: ArmyStamp[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const p = item as Partial<ArmyStamp>;
    if (!validType(p.type)) continue;
    const side = isSide(p.side) ? p.side : null;
    if (!side) continue;
    const col = Math.floor(Number(p.col));
    const row = Math.floor(Number(p.row));
    if (!Number.isFinite(col) || !Number.isFinite(row)) continue;
    if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
    const k = `${col},${row}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const unitTokens = sanitizeUnitTokens(
      (p as ArmyStamp & { unitTokens?: unknown }).unitTokens,
    );
    out.push({
      type: p.type,
      col,
      row,
      side,
      unitTokens: unitTokens.length ? unitTokens : undefined,
      facing: sanitizeStampFacing(side, (p as { facing?: unknown }).facing),
    });
    if (out.length >= 128) break;
  }
  return out;
}

function sanitizeSort(raw: unknown): number | undefined {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) ? n : undefined;
}

function nameOrder(a: SavedLevel, b: SavedLevel): number {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

function playlistOrder(a: SavedLevel, b: SavedLevel): number {
  if (a.sort !== b.sort) return a.sort - b.sort;
  return nameOrder(a, b);
}

/** Fill missing `sort` per category+period. Old saves get A–Z. */
function ensureSort(levels: SavedLevel[]): void {
  const groups = new Map<string, SavedLevel[]>();
  for (const l of levels) {
    const k = `${l.category}\0${l.period}`;
    const g = groups.get(k);
    if (g) g.push(l);
    else groups.set(k, [l]);
  }
  for (const g of groups.values()) {
    const missing = g.filter((l) => !Number.isFinite(l.sort));
    if (!missing.length) continue;
    let max = -1;
    for (const l of g) {
      if (Number.isFinite(l.sort) && l.sort > max) max = l.sort;
    }
    missing.sort(nameOrder);
    for (const l of missing) {
      max += 1;
      l.sort = max;
    }
  }
}

function nextSort(
  levels: SavedLevel[],
  category: LevelCategory,
  period: Period,
  exceptId?: string,
): number {
  let max = -1;
  for (const l of levels) {
    if (exceptId && l.id === exceptId) continue;
    if (l.category !== category || l.period !== period) continue;
    if (l.sort > max) max = l.sort;
  }
  return max + 1;
}

function normalizeLevels(levels: SavedLevel[]): SavedLevel[] {
  const out = levels
    .filter((l) => l && l.id && l.name && Array.isArray(l.terrain))
    .map((l) => {
      const cols = l.cols || l.terrain[0]?.length || COLS;
      const rows = l.rows || l.terrain.length;
      const armies = sanitizeArmies(l.armies, cols, rows);
      const sort = sanitizeSort(l.sort);
      const armyControls = sanitizeArmyControls(
        (l as SavedLevel & { armyControls?: unknown }).armyControls,
      );
      const aiStyles = sanitizeAiStyles(
        (l as SavedLevel & { aiStyles?: unknown }).aiStyles,
      );
      const lifted = liftWallTerrain(
        cloneTerrain(l.terrain),
        sanitizeTokens(
          (l as SavedLevel & { tokens?: unknown }).tokens,
          cols,
          rows,
        ),
      );
      return {
        ...l,
        orientation: l.orientation === 'flat' ? 'flat' : DEFAULT_ORIENTATION,
        cols,
        rows,
        terrain: lifted.terrain,
        category: sanitizeCategory(l.category),
        period: sanitizePeriod(l.period),
        sort: sort ?? Number.NaN,
        unitsPerTurn: clampUnitsPerTurn(l.unitsPerTurn ?? 1),
        maxTurns: clampMaxTurns(
          (l as SavedLevel & { maxTurns?: unknown }).maxTurns ?? 0,
        ),
        teaserText: sanitizeTeaserText(
          (l as SavedLevel & { teaserText?: unknown }).teaserText,
        ),
        startText: sanitizeLevelText(l.startText),
        winText: sanitizeLevelText(l.winText),
        loseText: sanitizeLevelText(l.loseText),
        star2: sanitizeStarRule(
          (l as SavedLevel & { star2?: unknown }).star2,
          DEFAULT_STAR_2,
        ),
        star3: sanitizeStarRule(
          (l as SavedLevel & { star3?: unknown }).star3,
          DEFAULT_STAR_3,
        ),
        armyControls,
        aiStyles,
        tokens: lifted.tokens,
        ...(armies !== undefined ? { armies } : {}),
      };
    });
  ensureSort(out);
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

function writeLevels(levels: SavedLevel[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
  notifyPersist();
}

function readDeletedLevels(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [id, ts] of Object.entries(parsed)) {
      const n = Number(ts);
      if (id && Number.isFinite(n) && n > 0) out[id] = n;
    }
    return out;
  } catch {
    return {};
  }
}

function writeDeletedLevels(map: Record<string, number>): void {
  localStorage.setItem(DELETED_KEY, JSON.stringify(map));
}

export function listDeletedLevels(): Record<string, number> {
  return readDeletedLevels();
}

export function replaceDeletedLevels(map: Record<string, number>): void {
  writeDeletedLevels(map);
}

function forgetDeletedLevel(id: string): void {
  const map = readDeletedLevels();
  if (!(id in map)) return;
  delete map[id];
  writeDeletedLevels(map);
}

function rememberDeletedLevel(id: string): void {
  const map = readDeletedLevels();
  map[id] = Date.now();
  writeDeletedLevels(map);
}

/** Replace the local library (used when pulling from the server). */
export function replaceLevels(levels: SavedLevel[]): void {
  writeLevels(normalizeLevels(levels));
}

export function getLevel(id: string): SavedLevel | null {
  return listLevels().find((l) => l.id === id) ?? null;
}

/** Category playlist order: editor drag order (old saves A–Z). */
export function levelsInCategory(
  category: LevelCategory,
  period?: Period,
): SavedLevel[] {
  return listLevels()
    .filter((l) => l.category === category)
    .filter((l) => !period || l.period === period)
    .sort(playlistOrder);
}

/** Persist a new order for one category + period. `ids` is top-to-bottom. */
export function reorderLevels(
  category: LevelCategory,
  period: Period,
  ids: string[],
): boolean {
  if (!ids.length) return false;
  const levels = listLevels();
  const group = levels.filter((l) => l.category === category && l.period === period);
  if (group.length !== ids.length) return false;
  const rank = new Map(ids.map((id, i) => [id, i]));
  if (group.some((l) => !rank.has(l.id))) return false;
  let changed = false;
  const now = Date.now();
  for (const l of group) {
    const next = rank.get(l.id)!;
    if (l.sort === next) continue;
    l.sort = next;
    l.updatedAt = now;
    changed = true;
  }
  if (!changed) return false;
  writeLevels(levels);
  return true;
}

/** 1-based index among same category + period. */
export function levelOrdinal(level: SavedLevel): number {
  return (
    levelsInCategory(level.category, level.period).findIndex((l) => l.id === level.id) + 1
  );
}

export function levelLabel(level: SavedLevel): string {
  const name = level.name.trim();
  return name || 'Untitled';
}

export function saveLevel(
  name: string,
  terrain: Terrain[][],
  existingId?: string | null,
  orientation: HexOrientation = DEFAULT_ORIENTATION,
  armies?: ArmyStamp[],
  category?: LevelCategory,
  unitsPerTurn?: number,
  period?: Period,
  texts?: {
    teaserText?: string;
    startText?: string;
    winText?: string;
    loseText?: string;
  },
  stars?: { star2?: StarRule; star3?: StarRule },
  armyControls?: Partial<Record<Side, ArmyControl>>,
  tokens?: TileToken[],
  maxTurns?: number,
  aiStyles?: Partial<Record<Side, AiStyle>>,
): SavedLevel {
  const levels = listLevels();
  const trimmed = name.trim() || 'Untitled';
  const now = Date.now();
  const cols = terrain[0]?.length ?? COLS;
  const rows = terrain.length;
  const stamped = sanitizeArmies(armies ?? [], cols, rows) ?? [];
  const prevIdx = existingId ? levels.findIndex((l) => l.id === existingId) : -1;
  const prev = prevIdx >= 0 ? levels[prevIdx] : undefined;
  const lifted = liftWallTerrain(
    cloneTerrain(terrain),
    sanitizeTokens(tokens ?? prev?.tokens, cols, rows),
  );
  if (prev && prevIdx >= 0) {
    const nextCat = sanitizeCategory(category ?? prev.category);
    const nextPeriod = sanitizePeriod(period ?? prev.period);
    const moved = nextCat !== prev.category || nextPeriod !== prev.period;
    const updated: SavedLevel = {
      ...prev,
      name: trimmed,
      cols,
      rows,
      orientation,
      terrain: lifted.terrain,
      armies: stamped,
      category: nextCat,
      period: nextPeriod,
      sort: moved ? nextSort(levels, nextCat, nextPeriod, prev.id) : prev.sort,
      unitsPerTurn: clampUnitsPerTurn(unitsPerTurn ?? prev.unitsPerTurn ?? 1),
      maxTurns: clampMaxTurns(maxTurns ?? prev.maxTurns ?? 0),
      teaserText: sanitizeTeaserText(texts?.teaserText ?? prev.teaserText),
      startText: sanitizeLevelText(texts?.startText ?? prev.startText),
      winText: sanitizeLevelText(texts?.winText ?? prev.winText),
      loseText: sanitizeLevelText(texts?.loseText ?? prev.loseText),
      star2: sanitizeStarRule(stars?.star2 ?? prev.star2, DEFAULT_STAR_2),
      star3: sanitizeStarRule(stars?.star3 ?? prev.star3, DEFAULT_STAR_3),
      armyControls: sanitizeArmyControls(armyControls ?? prev.armyControls),
      aiStyles: sanitizeAiStyles(aiStyles ?? prev.aiStyles),
      tokens: lifted.tokens,
      updatedAt: now,
    };
    levels[prevIdx] = updated;
    forgetDeletedLevel(updated.id);
    writeLevels(levels);
    return updated;
  }
  const createdCat = sanitizeCategory(category);
  const createdPeriod = sanitizePeriod(period);
  const created: SavedLevel = {
    id: uid(),
    name: trimmed,
    cols,
    rows,
    orientation,
    terrain: lifted.terrain,
    armies: stamped,
    category: createdCat,
    period: createdPeriod,
    sort: nextSort(levels, createdCat, createdPeriod),
    unitsPerTurn: clampUnitsPerTurn(unitsPerTurn),
    maxTurns: clampMaxTurns(maxTurns ?? 0),
    teaserText: sanitizeTeaserText(texts?.teaserText),
    startText: sanitizeLevelText(texts?.startText),
    winText: sanitizeLevelText(texts?.winText),
    loseText: sanitizeLevelText(texts?.loseText),
    star2: sanitizeStarRule(stars?.star2, DEFAULT_STAR_2),
    star3: sanitizeStarRule(stars?.star3, DEFAULT_STAR_3),
    armyControls: sanitizeArmyControls(armyControls),
    aiStyles: sanitizeAiStyles(aiStyles),
    tokens: lifted.tokens,
    updatedAt: now,
  };
  levels.unshift(created);
  forgetDeletedLevel(created.id);
  writeLevels(levels);
  return created;
}

export function deleteLevel(id: string): void {
  rememberDeletedLevel(id);
  writeLevels(listLevels().filter((l) => l.id !== id));
  if (getActiveLevelId() === id) setActiveLevelId(null);
  if (getDefaultLevelId() === id) setDefaultLevelId(null);
}

/** null = random generated map */
export function getActiveLevelId(): string | null {
  try {
    const v = localStorage.getItem(ACTIVE_KEY);
    return v && v !== 'random' ? v : null;
  } catch {
    return null;
  }
}

export function setActiveLevelId(id: string | null): void {
  if (!id) localStorage.removeItem(ACTIVE_KEY);
  else localStorage.setItem(ACTIVE_KEY, id);
}

/** Level that loads on boot. Independent of whichever map you're currently playing. */
export function getDefaultLevelId(): string | null {
  try {
    const v = localStorage.getItem(DEFAULT_KEY);
    return v || null;
  } catch {
    return null;
  }
}

export function setDefaultLevelId(id: string | null): void {
  if (!id) localStorage.removeItem(DEFAULT_KEY);
  else localStorage.setItem(DEFAULT_KEY, id);
  notifyPersist();
}

export function getLevelsOverviewFilter(): {
  category: LevelCategory;
  period: Period;
} {
  const fallback = { category: 'campaign' as LevelCategory, period: getSelectedPeriod() };
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    if (!raw) return fallback;
    const v = JSON.parse(raw) as { category?: unknown; period?: unknown };
    return {
      category: isLevelCategory(v?.category) ? v.category : fallback.category,
      period: sanitizePeriod(v?.period),
    };
  } catch {
    return fallback;
  }
}

export function setLevelsOverviewFilter(category: LevelCategory, period: Period): void {
  try {
    localStorage.setItem(
      FILTER_KEY,
      JSON.stringify({
        category: isLevelCategory(category) ? category : 'campaign',
        period: sanitizePeriod(period),
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function terrainFromLevel(level: SavedLevel): Terrain[][] {
  return cloneTerrain(level.terrain);
}
