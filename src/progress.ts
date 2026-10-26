/** Wins + best stars. Guests: localStorage. Signed-in: WordPress profile. */

const STORAGE_KEY = 'chessarmy-level-stars-v1';
const LEGACY_WINS_KEY = 'chessarmy-level-wins-v1';

/** Best stars earned on a map (1–3). Missing → never won. */
const best = new Map<string, number>();

export type StarMap = Record<string, number>;

let remote = false;
let persistHook: (() => void) | null = null;
let silenced = 0;

export function clampStars(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(3, Math.floor(n)));
}

export function sanitizeStarMap(raw: unknown): StarMap {
  const out: StarMap = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, n] of Object.entries(raw as Record<string, unknown>)) {
    if (!id) continue;
    const stars = clampStars(typeof n === 'number' ? n : Number(n));
    if (stars >= 1) out[id] = stars;
  }
  return out;
}

export function mergeStarMaps(a: StarMap, b: StarMap): StarMap {
  const out: StarMap = { ...a };
  for (const [id, n] of Object.entries(b)) {
    const stars = clampStars(n);
    if (stars < 1) continue;
    out[id] = Math.max(out[id] ?? 0, stars);
  }
  return out;
}

export function starMapsEqual(a: StarMap, b: StarMap): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const id of keys) {
    if ((a[id] ?? 0) !== (b[id] ?? 0)) return false;
  }
  return true;
}

function loadLegacyWins(into: Map<string, number>): void {
  try {
    const raw = localStorage.getItem(LEGACY_WINS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;
    for (const id of parsed) {
      if (typeof id === 'string' && id && !into.has(id)) into.set(id, 1);
    }
  } catch {
    /* ignore */
  }
}

function load(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = sanitizeStarMap(JSON.parse(raw) as unknown);
      for (const [id, n] of Object.entries(parsed)) best.set(id, n);
    }
  } catch {
    /* ignore quota / private mode / junk */
  }
  loadLegacyWins(best);
}

load();

export function snapshotStars(): StarMap {
  const out: StarMap = {};
  for (const [id, n] of best) out[id] = n;
  return out;
}

export function applyStars(stars: StarMap): void {
  best.clear();
  for (const [id, n] of Object.entries(sanitizeStarMap(stars))) {
    best.set(id, n);
  }
}

export function setProgressRemote(on: boolean, hook: (() => void) | null = null): void {
  remote = on;
  persistHook = on ? hook : null;
}

export function silenceProgressPersist<T>(fn: () => T): T {
  silenced += 1;
  try {
    return fn();
  } finally {
    silenced -= 1;
  }
}

export function clearBrowserProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_WINS_KEY);
  } catch {
    /* ignore */
  }
}

function persist(): void {
  if (silenced) return;
  if (remote) {
    persistHook?.();
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshotStars()));
  } catch {
    /* ignore quota / private mode */
  }
}

export function hasWonLevel(id: string): boolean {
  return (best.get(id) ?? 0) >= 1;
}

export function bestStarsForLevel(id: string): number {
  return best.get(id) ?? 0;
}

export function recordLevelWin(id: string, stars = 1): void {
  if (!id) return;
  const n = Math.max(1, clampStars(stars));
  const prev = best.get(id) ?? 0;
  if (n <= prev) return;
  best.set(id, n);
  persist();
}

export function clearLevelWins(ids: Iterable<string>): void {
  let changed = false;
  for (const id of ids) {
    if (id && best.delete(id)) changed = true;
  }
  if (changed) persist();
}
