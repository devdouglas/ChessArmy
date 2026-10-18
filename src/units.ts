import {
  DEFAULT_UNIT_STATS,
  UNIT_STATS,
  UNIT_TYPES,
  type UnitStats,
  type UnitType,
} from './engine';
import { notifyPersist } from './persist-hook';

const STORAGE_KEY = 'chessarmy-unit-stats-v1';

export type EditableStat = Exclude<keyof UnitStats, 'name' | 'chess'>;

const INT_FIELDS = [
  'move',
  'shoot',
  'shootMin',
  'actions',
  'shootCooldown',
  'value',
  'sprintMove',
  'moveBudget',
  'ammo',
  'hp',
  'meleeDamage',
  'shootDamage',
  'splashDamage',
  'armor',
] as const satisfies readonly EditableStat[];

const BOOL_FIELDS = ['sprint'] as const satisfies readonly EditableStat[];

const CLAMP: Record<(typeof INT_FIELDS)[number], { min: number; max: number }> = {
  move: { min: 0, max: 8 },
  shoot: { min: 0, max: 12 },
  shootMin: { min: 0, max: 12 },
  actions: { min: 1, max: 3 },
  shootCooldown: { min: 0, max: 6 },
  value: { min: 0, max: 999 },
  sprintMove: { min: 1, max: 8 },
  moveBudget: { min: 0, max: 12 },
  ammo: { min: 0, max: 20 },
  hp: { min: 1, max: 10 },
  meleeDamage: { min: 0, max: 10 },
  shootDamage: { min: 0, max: 10 },
  splashDamage: { min: 0, max: 10 },
  armor: { min: -5, max: 5 },
};

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

export function sanitizeUnitStats(
  type: UnitType,
  raw: Partial<UnitStats> | undefined,
): UnitStats {
  const d = DEFAULT_UNIT_STATS[type];
  const s = raw ?? {};
  const next: UnitStats = {
    name: d.name,
    chess: d.chess,
    move: clampInt(s.move, CLAMP.move.min, CLAMP.move.max, d.move),
    shoot: clampInt(s.shoot, CLAMP.shoot.min, CLAMP.shoot.max, d.shoot),
    shootMin: clampInt(s.shootMin, CLAMP.shootMin.min, CLAMP.shootMin.max, d.shootMin),
    actions: clampInt(s.actions, CLAMP.actions.min, CLAMP.actions.max, d.actions),
    shootCooldown: clampInt(
      s.shootCooldown,
      CLAMP.shootCooldown.min,
      CLAMP.shootCooldown.max,
      d.shootCooldown,
    ),
    value: clampInt(s.value, CLAMP.value.min, CLAMP.value.max, d.value),
    sprint: asBool(s.sprint, d.sprint),
    sprintMove: clampInt(s.sprintMove, CLAMP.sprintMove.min, CLAMP.sprintMove.max, d.sprintMove),
    moveBudget: clampInt(s.moveBudget, CLAMP.moveBudget.min, CLAMP.moveBudget.max, d.moveBudget),
    ammo: clampInt(s.ammo, CLAMP.ammo.min, CLAMP.ammo.max, d.ammo),
    hp: clampInt(s.hp, CLAMP.hp.min, CLAMP.hp.max, d.hp),
    meleeDamage: clampInt(
      s.meleeDamage,
      CLAMP.meleeDamage.min,
      CLAMP.meleeDamage.max,
      d.meleeDamage,
    ),
    shootDamage: clampInt(
      s.shootDamage,
      CLAMP.shootDamage.min,
      CLAMP.shootDamage.max,
      d.shootDamage,
    ),
    splashDamage: clampInt(
      s.splashDamage,
      CLAMP.splashDamage.min,
      CLAMP.splashDamage.max,
      d.splashDamage,
    ),
    armor: clampInt(s.armor, CLAMP.armor.min, CLAMP.armor.max, d.armor),
  };
  // Old saves had a splash checkbox. Off → no blast, even if splashDamage was 1.
  const legacySplash = (s as { splash?: unknown }).splash;
  if (legacySplash === false) next.splashDamage = 0;
  if (next.shootMin > next.shoot) next.shootMin = next.shoot;
  return next;
}

function writeLive(next: Record<UnitType, UnitStats>): void {
  for (const type of UNIT_TYPES) {
    Object.assign(UNIT_STATS[type], next[type]);
  }
}

export function persistUnitStats(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(UNIT_STATS));
  } catch {
    /* ignore quota / private mode */
  }
  notifyPersist();
}

export function applyRemoteUnitStats(
  raw: Partial<Record<UnitType, Partial<UnitStats>>>,
): void {
  if (!raw || typeof raw !== 'object') return;
  for (const type of UNIT_TYPES) {
    Object.assign(UNIT_STATS[type], sanitizeUnitStats(type, raw[type]));
  }
}

export function loadUnitStats(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<Record<UnitType, Partial<UnitStats>>>;
    if (!parsed || typeof parsed !== 'object') return;
    for (const type of UNIT_TYPES) {
      Object.assign(UNIT_STATS[type], sanitizeUnitStats(type, parsed[type]));
    }
  } catch {
    writeLive(structuredClone(DEFAULT_UNIT_STATS));
  }
}

export function resetUnitStats(): void {
  writeLive(structuredClone(DEFAULT_UNIT_STATS));
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  notifyPersist();
}

export function unitStatsAreStock(): boolean {
  return UNIT_TYPES.every((type) => {
    const a = UNIT_STATS[type];
    const b = DEFAULT_UNIT_STATS[type];
    return (INT_FIELDS as readonly string[]).concat(BOOL_FIELDS).every((k) => a[k as EditableStat] === b[k as EditableStat]);
  });
}

export function patchUnitStat(type: UnitType, field: EditableStat, value: number | boolean): void {
  const next = sanitizeUnitStats(type, {
    ...UNIT_STATS[type],
    [field]: value,
  });
  Object.assign(UNIT_STATS[type], next);
  persistUnitStats();
}

export { CLAMP, INT_FIELDS, BOOL_FIELDS };

loadUnitStats();
