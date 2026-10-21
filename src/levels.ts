import { clampUnitsPerTurn, isKnownUnit, type Terrain, type UnitType } from './engine';
import type { HexOrientation } from './hex';
import {
  COLS,
  DEFAULT_ORIENTATION,
  cloneTerrain,
  emptyTerrain,
  type ArmyStamp,
} from './map';
import { notifyPersist } from './persist-hook';
import { sanitizePeriod, type Period } from './period';

const STORAGE_KEY = 'chessarmy-levels-v1';
const ACTIVE_KEY = 'chessarmy-active-level';
const DEFAULT_KEY = 'chessarmy-default-level';

export type LevelCategory = 'campaign' | 'tutorial' | 'historical';

export const LEVEL_CATEGORIES: LevelCategory[] = ['campaign', 'tutorial', 'historical'];

export const LEVEL_CATEGORY_LABEL: Record<LevelCategory, string> = {
  campaign: 'Campaign',
  tutorial: 'Tutorial',
  historical: 'Historical',
};

export function sanitizeCategory(raw: unknown): LevelCategory {
  if (raw === 'campaign' || raw === 'tutorial' || raw === 'historical') return raw;
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
  /** Missing on old saves → historical (was `free`). */
  category: LevelCategory;
  /** Missing on old saves → modern. */
  period: Period;
  /** Playlist order within category + period. Missing on old saves → A–Z then compacted. */
  sort: number;
  /** Pieces a side may activate per turn. Missing on old saves → 1. */
  unitsPerTurn: number;
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

export function sanitizeLevelText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, LEVEL_TEXT_MAX);
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
    const side = p.side === 'blue' ? 'blue' : p.side === 'red' ? 'red' : null;
    if (!side) continue;
    const col = Math.floor(Number(p.col));
    const row = Math.floor(Number(p.row));
    if (!Number.isFinite(col) || !Number.isFinite(row)) continue;
    if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
    const k = `${col},${row}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ type: p.type, col, row, side });
    if (out.length >= 64) break;
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
      return {
        ...l,
        orientation: l.orientation === 'flat' ? 'flat' : DEFAULT_ORIENTATION,
        cols,
        rows,
        terrain: cloneTerrain(l.terrain),
        category: sanitizeCategory(l.category),
        period: sanitizePeriod(l.period),
        sort: sort ?? Number.NaN,
        unitsPerTurn: clampUnitsPerTurn(l.unitsPerTurn ?? 1),
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
  const n = levelOrdinal(level);
  return n > 0 ? `lvl.${n}` : 'lvl.?';
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
  texts?: { startText?: string; winText?: string; loseText?: string },
  stars?: { star2?: StarRule; star3?: StarRule },
): SavedLevel {
  const levels = listLevels();
  const trimmed = name.trim() || 'Untitled';
  const now = Date.now();
  const cols = terrain[0]?.length ?? COLS;
  const rows = terrain.length;
  const stamped = sanitizeArmies(armies ?? [], cols, rows) ?? [];
  if (existingId) {
    const idx = levels.findIndex((l) => l.id === existingId);
    if (idx >= 0) {
      const prev = levels[idx];
      const nextCat = sanitizeCategory(category ?? prev.category);
      const nextPeriod = sanitizePeriod(period ?? prev.period);
      const moved = nextCat !== prev.category || nextPeriod !== prev.period;
      const updated: SavedLevel = {
        ...prev,
        name: trimmed,
        cols,
        rows,
        orientation,
        terrain: cloneTerrain(terrain),
        armies: stamped,
        category: nextCat,
        period: nextPeriod,
        sort: moved ? nextSort(levels, nextCat, nextPeriod, prev.id) : prev.sort,
        unitsPerTurn: clampUnitsPerTurn(unitsPerTurn ?? prev.unitsPerTurn ?? 1),
        startText: sanitizeLevelText(texts?.startText ?? prev.startText),
        winText: sanitizeLevelText(texts?.winText ?? prev.winText),
        loseText: sanitizeLevelText(texts?.loseText ?? prev.loseText),
        star2: sanitizeStarRule(stars?.star2 ?? prev.star2, DEFAULT_STAR_2),
        star3: sanitizeStarRule(stars?.star3 ?? prev.star3, DEFAULT_STAR_3),
        updatedAt: now,
      };
      levels[idx] = updated;
      writeLevels(levels);
      return updated;
    }
  }
  const createdCat = sanitizeCategory(category);
  const createdPeriod = sanitizePeriod(period);
  const created: SavedLevel = {
    id: uid(),
    name: trimmed,
    cols,
    rows,
    orientation,
    terrain: cloneTerrain(terrain),
    armies: stamped,
    category: createdCat,
    period: createdPeriod,
    sort: nextSort(levels, createdCat, createdPeriod),
    unitsPerTurn: clampUnitsPerTurn(unitsPerTurn),
    startText: sanitizeLevelText(texts?.startText),
    winText: sanitizeLevelText(texts?.winText),
    loseText: sanitizeLevelText(texts?.loseText),
    star2: sanitizeStarRule(stars?.star2, DEFAULT_STAR_2),
    star3: sanitizeStarRule(stars?.star3, DEFAULT_STAR_3),
    updatedAt: now,
  };
  levels.unshift(created);
  writeLevels(levels);
  return created;
}

export function deleteLevel(id: string): void {
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

export function terrainFromLevel(level: SavedLevel): Terrain[][] {
  return cloneTerrain(level.terrain);
}
