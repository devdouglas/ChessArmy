import { UNIT_STATS, type UnitStats, type UnitType } from './engine';
import {
  getDefaultFormationId,
  listDeletedFormations,
  listFormations,
  replaceDeletedFormations,
  replaceFormations,
  setDefaultFormationId,
  type SavedFormation,
} from './formations';
import {
  getDefaultLevelId,
  listDeletedLevels,
  listLevels,
  replaceDeletedLevels,
  replaceLevels,
  setDefaultLevelId,
  type SavedLevel,
} from './levels';
import { setPersistHook, silencePersist } from './persist-hook';
import { mergeByUpdatedAt, mergeDeleted, pruneDeleted } from './store-merge';
import {
  aiChecklistAreStock,
  applyRemoteAiChecklist,
  getAiChecklist,
  persistAiChecklist,
  sanitizeAiChecklist,
} from './ai-config';
import { applyRemoteUnitStats, persistUnitStats, unitStatsAreStock } from './units';

export { mergeByUpdatedAt, mergeDeleted, pruneDeleted } from './store-merge';

export type ServerStatus = 'checking' | 'ok' | 'local' | 'err';

export type ServerStore = {
  units: Partial<Record<UnitType, Partial<UnitStats>>> | null;
  aiChecklist: ReturnType<typeof getAiChecklist> | null;
  levels: SavedLevel[];
  defaultLevelId: string | null;
  formations: SavedFormation[];
  defaultFormationId: string | null;
  deletedLevels: Record<string, number>;
  deletedFormations: Record<string, number>;
};

const API_URL = `${import.meta.env.BASE_URL}api.php`;
const SAVE_KEY = 'warchess-oneshot';

let status: ServerStatus = 'checking';
let timer = 0;
const listeners = new Set<(s: ServerStatus) => void>();

export function getServerStatus(): ServerStatus {
  return status;
}

export function onServerStatus(fn: (s: ServerStatus) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setStatus(next: ServerStatus): void {
  status = next;
  for (const fn of listeners) fn(next);
}

function asDeletedMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [id, ts] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(ts);
    if (id && Number.isFinite(n) && n > 0) out[id] = n;
  }
  return out;
}

async function pullStore(): Promise<ServerStore | null> {
  try {
    const res = await fetch(API_URL, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<ServerStore>;
    if (!data || typeof data !== 'object') return null;
    return {
      units: data.units && typeof data.units === 'object' ? data.units : null,
      aiChecklist:
        data.aiChecklist && typeof data.aiChecklist === 'object' ? data.aiChecklist : null,
      levels: Array.isArray(data.levels) ? data.levels : [],
      defaultLevelId: data.defaultLevelId ?? null,
      formations: Array.isArray(data.formations) ? data.formations : [],
      defaultFormationId: data.defaultFormationId ?? null,
      deletedLevels: asDeletedMap(data.deletedLevels),
      deletedFormations: asDeletedMap(data.deletedFormations),
    };
  } catch {
    return null;
  }
}

function itemStamp(items: { id: string; updatedAt?: number }[]): string {
  return items
    .map((item) => `${item.id}:${Number(item.updatedAt) || 0}`)
    .sort()
    .join('|');
}

function deletedStamp(map: Record<string, number>): string {
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, ts]) => `${id}:${ts}`)
    .join('|');
}

function localStore(): ServerStore {
  return {
    units: UNIT_STATS,
    aiChecklist: getAiChecklist(),
    levels: listLevels(),
    defaultLevelId: getDefaultLevelId(),
    formations: listFormations(),
    defaultFormationId: getDefaultFormationId(),
    deletedLevels: listDeletedLevels(),
    deletedFormations: listDeletedFormations(),
  };
}

export async function pushStore(): Promise<boolean> {
  const body = localStore();
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'X-Warchess-Key': SAVE_KEY,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setStatus('err');
      return false;
    }
    setStatus('ok');
    return true;
  } catch {
    setStatus(status === 'ok' ? 'err' : 'local');
    return false;
  }
}

/** Cancel the debounce and POST now. Save buttons should await this. */
export async function flushStore(): Promise<boolean> {
  window.clearTimeout(timer);
  timer = 0;
  return pushStore();
}

function queuePush(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    void pushStore();
  }, 450);
}

function applyMerged(store: ServerStore): void {
  silencePersist(() => {
    if (store.units) {
      applyRemoteUnitStats(store.units);
      persistUnitStats();
    }
    if (store.aiChecklist) {
      applyRemoteAiChecklist(store.aiChecklist);
      persistAiChecklist();
    }
    replaceLevels(store.levels);
    replaceDeletedLevels(store.deletedLevels);
    if (store.defaultLevelId) setDefaultLevelId(store.defaultLevelId);
    replaceFormations(store.formations);
    replaceDeletedFormations(store.deletedFormations);
    if (store.defaultFormationId) setDefaultFormationId(store.defaultFormationId);
  });
}

/** Pull shared JSON; merge by id. Newer updatedAt wins that map. */
export async function syncFromServer(): Promise<{
  applied: boolean;
  defaultLevelId: string | null;
}> {
  const remote = await pullStore();
  if (!remote) {
    setStatus('local');
    return { applied: false, defaultLevelId: null };
  }

  const local = localStore();
  const serverEmpty =
    remote.levels.length === 0 &&
    !remote.units &&
    !remote.aiChecklist &&
    remote.formations.length === 0;
  if (
    serverEmpty &&
    (local.levels.length > 0 ||
      !unitStatsAreStock() ||
      !aiChecklistAreStock() ||
      local.formations.length > 0)
  ) {
    const ok = await pushStore();
    if (!ok) setStatus('err');
    return { applied: false, defaultLevelId: getDefaultLevelId() };
  }

  const deletedLevels = pruneDeleted(
    mergeDeleted(local.deletedLevels, remote.deletedLevels),
    [...local.levels, ...remote.levels],
  );
  const deletedFormations = pruneDeleted(
    mergeDeleted(local.deletedFormations, remote.deletedFormations),
    [...local.formations, ...remote.formations],
  );
  const merged: ServerStore = {
    units: remote.units ?? local.units,
    aiChecklist: sanitizeAiChecklist(remote.aiChecklist ?? local.aiChecklist),
    levels: mergeByUpdatedAt(local.levels, remote.levels, deletedLevels),
    defaultLevelId: remote.defaultLevelId ?? local.defaultLevelId,
    formations: mergeByUpdatedAt(local.formations, remote.formations, deletedFormations),
    defaultFormationId: remote.defaultFormationId ?? local.defaultFormationId,
    deletedLevels,
    deletedFormations,
  };

  const checklistStamp = (c: ServerStore['aiChecklist']) =>
    c ? JSON.stringify(c) : '';

  const changed =
    itemStamp(merged.levels) !== itemStamp(local.levels) ||
    itemStamp(merged.formations) !== itemStamp(local.formations) ||
    deletedStamp(merged.deletedLevels) !== deletedStamp(local.deletedLevels) ||
    deletedStamp(merged.deletedFormations) !== deletedStamp(local.deletedFormations) ||
    checklistStamp(merged.aiChecklist) !== checklistStamp(local.aiChecklist);

  if (changed) applyMerged(merged);

  const needsPush =
    itemStamp(merged.levels) !== itemStamp(remote.levels) ||
    itemStamp(merged.formations) !== itemStamp(remote.formations) ||
    deletedStamp(merged.deletedLevels) !== deletedStamp(remote.deletedLevels) ||
    deletedStamp(merged.deletedFormations) !== deletedStamp(remote.deletedFormations) ||
    checklistStamp(merged.aiChecklist) !== checklistStamp(remote.aiChecklist);
  if (needsPush) {
    const ok = await pushStore();
    if (!ok) setStatus('err');
  } else {
    setStatus('ok');
  }

  return { applied: changed, defaultLevelId: getDefaultLevelId() };
}

setPersistHook(queuePush);

window.addEventListener('pagehide', () => {
  window.clearTimeout(timer);
  timer = 0;
  void pushStore();
});
