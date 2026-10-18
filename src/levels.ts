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

const STORAGE_KEY = 'chessarmy-levels-v1';
const ACTIVE_KEY = 'chessarmy-active-level';
const DEFAULT_KEY = 'chessarmy-default-level';

export type LevelCategory = 'campaign' | 'tutorial' | 'free';

export const LEVEL_CATEGORIES: LevelCategory[] = ['campaign', 'tutorial', 'free'];

export const LEVEL_CATEGORY_LABEL: Record<LevelCategory, string> = {
  campaign: 'Campaign',
  tutorial: 'Tutorial',
  free: 'Free',
};

export function sanitizeCategory(raw: unknown): LevelCategory {
  if (raw === 'campaign' || raw === 'tutorial' || raw === 'free') return raw;
  return 'free';
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
  /** Missing on old saves → free. */
  category: LevelCategory;
  /** Pieces a side may activate per turn. Missing on old saves → 1. */
  unitsPerTurn: number;
  updatedAt: number;
};

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

function normalizeLevels(levels: SavedLevel[]): SavedLevel[] {
  return levels
    .filter((l) => l && l.id && l.name && Array.isArray(l.terrain))
    .map((l) => {
      const cols = l.cols || l.terrain[0]?.length || COLS;
      const rows = l.rows || l.terrain.length;
      const armies = sanitizeArmies(l.armies, cols, rows);
      return {
        ...l,
        orientation: l.orientation === 'flat' ? 'flat' : DEFAULT_ORIENTATION,
        cols,
        rows,
        terrain: cloneTerrain(l.terrain),
        category: sanitizeCategory(l.category),
        unitsPerTurn: clampUnitsPerTurn(l.unitsPerTurn ?? 1),
        ...(armies !== undefined ? { armies } : {}),
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
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

/** Category playlist order: name A–Z, numeric-aware. */
export function levelsInCategory(category: LevelCategory): SavedLevel[] {
  return listLevels()
    .filter((l) => l.category === category)
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
    );
}

export function saveLevel(
  name: string,
  terrain: Terrain[][],
  existingId?: string | null,
  orientation: HexOrientation = DEFAULT_ORIENTATION,
  armies?: ArmyStamp[],
  category?: LevelCategory,
  unitsPerTurn?: number,
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
      const updated: SavedLevel = {
        ...levels[idx],
        name: trimmed,
        cols,
        rows,
        orientation,
        terrain: cloneTerrain(terrain),
        armies: stamped,
        category: sanitizeCategory(category ?? levels[idx].category),
        unitsPerTurn: clampUnitsPerTurn(unitsPerTurn ?? levels[idx].unitsPerTurn ?? 1),
        updatedAt: now,
      };
      levels[idx] = updated;
      writeLevels(levels);
      return updated;
    }
  }
  const created: SavedLevel = {
    id: uid(),
    name: trimmed,
    cols,
    rows,
    orientation,
    terrain: cloneTerrain(terrain),
    armies: stamped,
    category: sanitizeCategory(category),
    unitsPerTurn: clampUnitsPerTurn(unitsPerTurn),
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
