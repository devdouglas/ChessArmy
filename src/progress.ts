/** Per-browser wins + best stars. Not synced — this is the local player's cleared maps. */

const STORAGE_KEY = 'chessarmy-level-stars-v1';
const LEGACY_WINS_KEY = 'chessarmy-level-wins-v1';

/** Best stars earned on a map (1–3). Missing → never won. */
const best = new Map<string, number>();

function clampStars(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(3, Math.floor(n)));
}

function loadLegacyWins(): void {
  try {
    const raw = localStorage.getItem(LEGACY_WINS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;
    for (const id of parsed) {
      if (typeof id === 'string' && id && !best.has(id)) best.set(id, 1);
    }
  } catch {
    /* ignore */
  }
}

function load(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [id, n] of Object.entries(parsed as Record<string, unknown>)) {
          if (!id) continue;
          const stars = clampStars(typeof n === 'number' ? n : Number(n));
          if (stars >= 1) best.set(id, stars);
        }
      }
    }
  } catch {
    /* ignore quota / private mode / junk */
  }
  loadLegacyWins();
}

load();

function persist(): void {
  try {
    const out: Record<string, number> = {};
    for (const [id, n] of best) out[id] = n;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
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
