import { UNIT_STATS, type UnitStats, type UnitType } from './engine';
import {
  getDefaultFormationId,
  listFormations,
  replaceFormations,
  setDefaultFormationId,
  type SavedFormation,
} from './formations';
import {
  getDefaultLevelId,
  listLevels,
  replaceLevels,
  setDefaultLevelId,
  type SavedLevel,
} from './levels';
import { setPersistHook, silencePersist } from './persist-hook';
import { applyRemoteUnitStats, persistUnitStats, unitStatsAreStock } from './units';

export type ServerStatus = 'checking' | 'ok' | 'local' | 'err';

export type ServerStore = {
  units: Partial<Record<UnitType, Partial<UnitStats>>> | null;
  levels: SavedLevel[];
  defaultLevelId: string | null;
  formations: SavedFormation[];
  defaultFormationId: string | null;
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

export function serverStatusLabel(s: ServerStatus = status): string {
  if (s === 'checking') return 'server…';
  if (s === 'ok') return 'server';
  if (s === 'err') return 'server error';
  return 'local only';
}

async function pullStore(): Promise<ServerStore | null> {
  try {
    const res = await fetch(API_URL, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ServerStore;
    if (!data || typeof data !== 'object') return null;
    return {
      units: data.units && typeof data.units === 'object' ? data.units : null,
      levels: Array.isArray(data.levels) ? data.levels : [],
      defaultLevelId: data.defaultLevelId ?? null,
      formations: Array.isArray(data.formations) ? data.formations : [],
      defaultFormationId: data.defaultFormationId ?? null,
    };
  } catch {
    return null;
  }
}

export async function pushStore(): Promise<boolean> {
  const body: ServerStore = {
    units: UNIT_STATS,
    levels: listLevels(),
    defaultLevelId: getDefaultLevelId(),
    formations: listFormations(),
    defaultFormationId: getDefaultFormationId(),
  };
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

function queuePush(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    void pushStore();
  }, 450);
}

/** Pull shared JSON; seed the file if the server is empty and we have local data. */
export async function syncFromServer(): Promise<{
  applied: boolean;
  defaultLevelId: string | null;
}> {
  const remote = await pullStore();
  if (!remote) {
    setStatus('local');
    return { applied: false, defaultLevelId: null };
  }

  const localLevels = listLevels();
  const serverEmpty =
    remote.levels.length === 0 &&
    !remote.units &&
    remote.formations.length === 0;
  if (
    serverEmpty &&
    (localLevels.length > 0 || !unitStatsAreStock() || listFormations().length > 0)
  ) {
    const ok = await pushStore();
    if (!ok) setStatus('err');
    return { applied: false, defaultLevelId: getDefaultLevelId() };
  }

  let applied = false;
  silencePersist(() => {
    if (remote.units) {
      applyRemoteUnitStats(remote.units);
      persistUnitStats();
      applied = true;
    }
    if (remote.levels.length > 0) {
      replaceLevels(remote.levels);
      applied = true;
    }
    if (remote.defaultLevelId) {
      setDefaultLevelId(remote.defaultLevelId);
      applied = true;
    }
    if (remote.formations.length > 0) {
      replaceFormations(remote.formations);
      applied = true;
    }
    if (remote.defaultFormationId) {
      setDefaultFormationId(remote.defaultFormationId);
      applied = true;
    }
  });
  setStatus('ok');
  return { applied, defaultLevelId: getDefaultLevelId() };
}

setPersistHook(queuePush);
