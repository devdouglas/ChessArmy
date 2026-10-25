import { isKnownUnit, sanitizeUnitTokens, UNIT_STATS, type Side, type UnitType } from './engine';
import {
  COLS,
  DEFAULT_ARMY_EDGE,
  ROWS,
  placeSlots,
  sanitizeStampFacing,
  slotsFromSide,
  stockSlots,
  type ArmyEdge,
  type ArmySlot,
  type ArmyStamp,
} from './map';
import { notifyPersist } from './persist-hook';
import { PERIODS, sanitizePeriod, type Period } from './period';

const STORAGE_KEY = 'chessarmy-formations-v1';
const DELETED_KEY = 'chessarmy-formations-deleted-v1';
const DEFAULT_KEY = 'chessarmy-default-formation';

export const STOCK_FORMATION_ID = 'stock';

export type SavedFormation = {
  id: string;
  name: string;
  cols: number;
  slots: ArmySlot[];
  /** Missing on old saves → inferred from unit categories, else modern. */
  period: Period;
  updatedAt: number;
};

function inferPeriod(slots: ArmySlot[]): Period {
  const counts: Record<Period, number> = {
    ancient: 0,
    modern: 0,
    futuristic: 0,
  };
  for (const s of slots) {
    const cat = UNIT_STATS[s.type]?.category;
    if (cat === 'ancient' || cat === 'modern' || cat === 'futuristic') {
      counts[cat] += 1;
    }
  }
  let best: Period = 'modern';
  let n = 0;
  for (const p of PERIODS) {
    if (counts[p] > n) {
      n = counts[p];
      best = p;
    }
  }
  return n > 0 ? best : 'modern';
}

function uid(): string {
  return `frm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function validType(t: unknown): t is UnitType {
  return isKnownUnit(t);
}

function sanitizeSlot(raw: unknown): ArmySlot | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<ArmySlot>;
  if (!validType(s.type)) return null;
  const col = Math.floor(Number(s.col));
  const fromBack = Math.floor(Number(s.fromBack));
  if (!Number.isFinite(col) || !Number.isFinite(fromBack)) return null;
  if (col < 0 || col > 32 || fromBack < 0 || fromBack > 32) return null;
  const unitTokens = sanitizeUnitTokens(s.unitTokens);
  return {
    type: s.type,
    col,
    fromBack,
    unitTokens: unitTokens.length ? unitTokens : undefined,
    facing: sanitizeStampFacing('red', s.facing),
  };
}

function normalize(list: SavedFormation[]): SavedFormation[] {
  return list
    .filter((f) => f && f.id && f.id !== STOCK_FORMATION_ID && f.name && Array.isArray(f.slots))
    .map((f) => {
      const slots = f.slots.map(sanitizeSlot).filter((s): s is ArmySlot => !!s).slice(0, 48);
      return {
        ...f,
        cols: Math.max(1, Math.min(32, Math.floor(f.cols) || COLS)),
        slots,
        period:
          f.period === 'ancient' || f.period === 'modern' || f.period === 'futuristic'
            ? f.period
            : inferPeriod(slots),
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function write(list: SavedFormation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  notifyPersist();
}

function readDeletedFormations(): Record<string, number> {
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

function writeDeletedFormations(map: Record<string, number>): void {
  localStorage.setItem(DELETED_KEY, JSON.stringify(map));
}

export function listDeletedFormations(): Record<string, number> {
  return readDeletedFormations();
}

export function replaceDeletedFormations(map: Record<string, number>): void {
  writeDeletedFormations(map);
}

function forgetDeletedFormation(id: string): void {
  const map = readDeletedFormations();
  if (!(id in map)) return;
  delete map[id];
  writeDeletedFormations(map);
}

function rememberDeletedFormation(id: string): void {
  const map = readDeletedFormations();
  map[id] = Date.now();
  writeDeletedFormations(map);
}

export function listFormations(): SavedFormation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedFormation[];
    if (!Array.isArray(parsed)) return [];
    return normalize(parsed);
  } catch {
    return [];
  }
}

export function listFormationsInPeriod(period: Period): SavedFormation[] {
  const p = sanitizePeriod(period);
  return listFormations().filter((f) => f.period === p);
}

export function replaceFormations(list: SavedFormation[]): void {
  write(normalize(list));
}

export function getFormation(id: string): SavedFormation | null {
  if (id === STOCK_FORMATION_ID) return null;
  return listFormations().find((f) => f.id === id) ?? null;
}

export function stockFormation(cols: number, rows: number): SavedFormation {
  return {
    id: STOCK_FORMATION_ID,
    name: 'Standard',
    cols,
    slots: stockSlots(cols, rows),
    period: 'modern',
    updatedAt: 0,
  };
}

export function saveFormation(
  name: string,
  slots: ArmySlot[],
  cols: number,
  existingId?: string | null,
  period?: Period,
): SavedFormation {
  const list = listFormations();
  const trimmed = name.trim() || 'Untitled army';
  const now = Date.now();
  const cleanSlots = slots.map(sanitizeSlot).filter((s): s is ArmySlot => !!s).slice(0, 48);
  const width = Math.max(1, Math.min(32, Math.floor(cols) || COLS));
  const era = period ? sanitizePeriod(period) : inferPeriod(cleanSlots);
  if (existingId && existingId !== STOCK_FORMATION_ID) {
    const idx = list.findIndex((f) => f.id === existingId);
    if (idx >= 0) {
      const updated: SavedFormation = {
        ...list[idx],
        name: trimmed,
        cols: width,
        slots: cleanSlots,
        period: era,
        updatedAt: now,
      };
      list[idx] = updated;
      forgetDeletedFormation(updated.id);
      write(list);
      return updated;
    }
  }
  const created: SavedFormation = {
    id: uid(),
    name: trimmed,
    cols: width,
    slots: cleanSlots,
    period: era,
    updatedAt: now,
  };
  list.unshift(created);
  forgetDeletedFormation(created.id);
  write(list);
  return created;
}

export function deleteFormation(id: string): void {
  if (id === STOCK_FORMATION_ID) return;
  rememberDeletedFormation(id);
  write(listFormations().filter((f) => f.id !== id));
  if (getDefaultFormationId() === id) setDefaultFormationId(null);
}

export function getDefaultFormationId(): string | null {
  try {
    const v = localStorage.getItem(DEFAULT_KEY);
    return v && v !== STOCK_FORMATION_ID ? v : null;
  } catch {
    return null;
  }
}

export function setDefaultFormationId(id: string | null): void {
  if (!id || id === STOCK_FORMATION_ID) localStorage.removeItem(DEFAULT_KEY);
  else localStorage.setItem(DEFAULT_KEY, id);
  notifyPersist();
}

export function captureFormation(
  pieces: ArmyStamp[],
  side: Side,
  cols: number,
  rows: number,
  edge: ArmyEdge = DEFAULT_ARMY_EDGE[side],
): { slots: ArmySlot[]; cols: number } {
  return { slots: slotsFromSide(pieces, side, cols, rows, edge), cols };
}

export function stampFormation(
  form: Pick<SavedFormation, 'slots' | 'cols'>,
  side: Side,
  cols: number,
  rows: number,
  edge: ArmyEdge = DEFAULT_ARMY_EDGE[side],
): ArmyStamp[] {
  return placeSlots(form.slots, side, cols, rows, form.cols, edge);
}

export function defaultArmyStamps(
  cols: number,
  rows: number,
  period?: Period,
): ArmyStamp[] | null {
  const id = getDefaultFormationId();
  const saved = id ? getFormation(id) : null;
  if (!saved) return null;
  if (period && saved.period !== sanitizePeriod(period)) return null;
  return [
    ...stampFormation(saved, 'red', cols, rows),
    ...stampFormation(saved, 'blue', cols, rows),
  ];
}

/** Value/weight of a saved army. General token +1, same as combatValue. */
export function formationCombatValue(slots: ArmySlot[]): number {
  let n = 0;
  for (const s of slots) {
    n += UNIT_STATS[s.type]?.value ?? 0;
    if (s.unitTokens?.includes('general')) n += 1;
  }
  return n;
}

export function slotsEqual(a: ArmySlot[], b: ArmySlot[]): boolean {
  if (a.length !== b.length) return false;
  const key = (s: ArmySlot) =>
    `${s.type}:${s.col}:${s.fromBack}:${s.facing ?? ''}:${(s.unitTokens ?? []).join(',')}`;
  const left = a.map(key).sort();
  const right = b.map(key).sort();
  return left.every((k, i) => k === right[i]);
}

export function bothStockStamps(cols = COLS, rows = ROWS): ArmyStamp[] {
  const form = stockFormation(cols, rows);
  return [
    ...stampFormation(form, 'red', cols, rows),
    ...stampFormation(form, 'blue', cols, rows),
  ];
}
