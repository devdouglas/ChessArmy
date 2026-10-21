/** Per-browser wins. Not synced — this is the local player's cleared maps. */

const STORAGE_KEY = 'chessarmy-level-wins-v1';

const wins = new Set<string>();

function load(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;
    for (const id of parsed) {
      if (typeof id === 'string' && id) wins.add(id);
    }
  } catch {
    /* ignore quota / private mode / junk */
  }
}

load();

export function hasWonLevel(id: string): boolean {
  return wins.has(id);
}

export function recordLevelWin(id: string): void {
  if (!id || wins.has(id)) return;
  wins.add(id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...wins]));
  } catch {
    /* ignore */
  }
}
