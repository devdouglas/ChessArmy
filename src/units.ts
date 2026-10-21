import {
  abilitiesEqual,
  sanitizeAbilities,
  type AbilityId,
} from './abilities';
import {
  DEFAULT_UNIT_STATS,
  KIT_TRAITS,
  TRAIT_FIELDS,
  isCustomUnitId,
  isUnitRole,
  STOCK_UNIT_TYPES,
  UNIT_STATS,
  UNIT_TYPES,
  sanitizeClimbLevel,
  sanitizeShootArc,
  sanitizeUnitCategory,
  statsOf,
  type ShootArc,
  type UnitCategory,
  type UnitRole,
  type UnitStats,
  type UnitTraits,
  type UnitType,
} from './engine';
import { notifyPersist } from './persist-hook';

const STORAGE_KEY = 'chessarmy-unit-stats-v1';
const MAX_UNITS = 48;

export type EditableStat = Exclude<
  keyof UnitStats,
  'name' | 'chess' | 'category' | 'role' | 'shootArc' | 'abilities' | keyof UnitTraits
>;

const INT_FIELDS = [
  'move',
  'shoot',
  'shootMin',
  'actions',
  'shootCooldown',
  'value',
  'moveBudget',
  'stamina',
  'staminaRegen',
  'ammo',
  'hp',
  'meleeDamage',
  'charge',
  'shootDamage',
  'splashDamage',
  'armor',
  'armorFront',
  'armorFrontLeft',
  'armorFrontRight',
  'armorFlankLeft',
  'armorFlankRight',
  'armorRear',
  'damageFront',
  'damageFrontLeft',
  'damageFrontRight',
  'damageFlankLeft',
  'damageFlankRight',
  'damageRear',
  'climbLevel',
] as const satisfies readonly EditableStat[];

const CLAMP: Record<(typeof INT_FIELDS)[number], { min: number; max: number }> = {
  move: { min: 0, max: 8 },
  shoot: { min: 0, max: 12 },
  shootMin: { min: 0, max: 12 },
  actions: { min: 1, max: 3 },
  shootCooldown: { min: 0, max: 6 },
  value: { min: 0, max: 999 },
  moveBudget: { min: 0, max: 12 },
  stamina: { min: 0, max: 8 },
  staminaRegen: { min: 0, max: 8 },
  ammo: { min: 0, max: 20 },
  hp: { min: 1, max: 10 },
  meleeDamage: { min: 0, max: 10 },
  charge: { min: 0, max: 10 },
  shootDamage: { min: 0, max: 10 },
  splashDamage: { min: 0, max: 10 },
  armor: { min: -2, max: 2 },
  armorFront: { min: -2, max: 2 },
  armorFrontLeft: { min: -2, max: 2 },
  armorFrontRight: { min: -2, max: 2 },
  armorFlankLeft: { min: -2, max: 2 },
  armorFlankRight: { min: -2, max: 2 },
  armorRear: { min: -2, max: 2 },
  damageFront: { min: 0, max: 2 },
  damageFrontLeft: { min: 0, max: 2 },
  damageFrontRight: { min: 0, max: 2 },
  damageFlankLeft: { min: 0, max: 2 },
  damageFlankRight: { min: 0, max: 2 },
  damageRear: { min: 0, max: 2 },
  climbLevel: { min: 0, max: 3 },
};

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function roleFrom(type: UnitType, raw: Partial<UnitStats> | undefined): UnitRole {
  if (raw && isUnitRole(raw.role)) return raw.role;
  if (isUnitRole(type)) return type;
  return 'soldier';
}

function bool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === 'boolean' ? raw : fallback;
}

type LegacyStats = Partial<UnitStats> & { noHigh?: boolean };

/** Old kit flags: noHigh blocked hills; passWater was swim-through. Missing climbLevel migrates. */
function waterClimbFrom(
  role: UnitRole,
  s: LegacyStats,
  d: UnitStats,
): { passWater: boolean; climbLevel: number } {
  if (s.climbLevel !== undefined && s.climbLevel !== null) {
    return {
      passWater: bool(s.passWater, d.passWater),
      climbLevel: sanitizeClimbLevel(s.climbLevel, d.climbLevel),
    };
  }
  const noHigh =
    typeof s.noHigh === 'boolean'
      ? s.noHigh
      : role === 'elephant' || role === 'catapult' || role === 'tank' || role === 'dummy';
  const swam = s.passWater === true || role === 'scout';
  if (!noHigh || swam) return { passWater: true, climbLevel: 2 };
  return { passWater: false, climbLevel: 0 };
}

export function sanitizeUnitStats(
  type: UnitType,
  raw: Partial<UnitStats> | undefined,
): UnitStats {
  const dRole = roleFrom(type, raw);
  const d = DEFAULT_UNIT_STATS[dRole];
  const traits = KIT_TRAITS[dRole];
  const s = (raw ?? {}) as LegacyStats;
  const mobility = waterClimbFrom(dRole, s, d);
  const name =
    typeof s.name === 'string' && s.name.trim()
      ? s.name.trim().slice(0, 32)
      : d.name;
  const chess =
    typeof s.chess === 'string' && s.chess.trim()
      ? s.chess.trim().slice(0, 24)
      : d.chess;
  const armor = clampInt(s.armor, CLAMP.armor.min, CLAMP.armor.max, d.armor);
  const kingHint = bool(s.king, d.king);
  const abilities = sanitizeAbilities(
    s.abilities,
    s.abilities === undefined && kingHint ? ['general'] : d.abilities,
  );
  const next: UnitStats = {
    name,
    chess,
    category: sanitizeUnitCategory(s.category ?? d.category),
    role: dRole,
    passWater: mobility.passWater,
    climbLevel: mobility.climbLevel,
    passUnits: bool(s.passUnits, traits.passUnits),
    infantry: bool(s.infantry, traits.infantry),
    king: abilities.includes('general'),
    abilities,
    move: clampInt(s.move, CLAMP.move.min, CLAMP.move.max, d.move),
    shoot: clampInt(s.shoot, CLAMP.shoot.min, CLAMP.shoot.max, d.shoot),
    shootMin: clampInt(s.shootMin, CLAMP.shootMin.min, CLAMP.shootMin.max, d.shootMin),
    shootArc: sanitizeShootArc(s.shootArc ?? d.shootArc),
    actions: clampInt(s.actions, CLAMP.actions.min, CLAMP.actions.max, d.actions),
    shootCooldown: clampInt(
      s.shootCooldown,
      CLAMP.shootCooldown.min,
      CLAMP.shootCooldown.max,
      d.shootCooldown,
    ),
    value: clampInt(s.value, CLAMP.value.min, CLAMP.value.max, d.value),
    moveBudget: clampInt(s.moveBudget, CLAMP.moveBudget.min, CLAMP.moveBudget.max, d.moveBudget),
    stamina: clampInt(s.stamina, CLAMP.stamina.min, CLAMP.stamina.max, d.stamina),
    staminaRegen: clampInt(
      s.staminaRegen,
      CLAMP.staminaRegen.min,
      CLAMP.staminaRegen.max,
      d.staminaRegen,
    ),
    ammo: clampInt(s.ammo, CLAMP.ammo.min, CLAMP.ammo.max, d.ammo),
    hp: clampInt(s.hp, CLAMP.hp.min, CLAMP.hp.max, d.hp),
    meleeDamage: clampInt(
      s.meleeDamage,
      CLAMP.meleeDamage.min,
      CLAMP.meleeDamage.max,
      d.meleeDamage,
    ),
    charge: clampInt(
      s.charge,
      CLAMP.charge.min,
      CLAMP.charge.max,
      (s as { overrun?: unknown }).overrun === true ? Math.max(1, d.charge) : d.charge,
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
    armor,
    hexArmor: bool(s.hexArmor, d.hexArmor),
    armorFront: clampInt(s.armorFront, CLAMP.armorFront.min, CLAMP.armorFront.max, armor),
    armorFrontLeft: clampInt(
      s.armorFrontLeft,
      CLAMP.armorFrontLeft.min,
      CLAMP.armorFrontLeft.max,
      armor,
    ),
    armorFrontRight: clampInt(
      s.armorFrontRight,
      CLAMP.armorFrontRight.min,
      CLAMP.armorFrontRight.max,
      armor,
    ),
    armorFlankLeft: clampInt(
      s.armorFlankLeft,
      CLAMP.armorFlankLeft.min,
      CLAMP.armorFlankLeft.max,
      armor,
    ),
    armorFlankRight: clampInt(
      s.armorFlankRight,
      CLAMP.armorFlankRight.min,
      CLAMP.armorFlankRight.max,
      armor,
    ),
    armorRear: clampInt(s.armorRear, CLAMP.armorRear.min, CLAMP.armorRear.max, armor),
    hexDamage: bool(s.hexDamage, d.hexDamage),
    damageFront: clampInt(s.damageFront, CLAMP.damageFront.min, CLAMP.damageFront.max, d.damageFront),
    damageFrontLeft: clampInt(
      s.damageFrontLeft,
      CLAMP.damageFrontLeft.min,
      CLAMP.damageFrontLeft.max,
      d.damageFrontLeft,
    ),
    damageFrontRight: clampInt(
      s.damageFrontRight,
      CLAMP.damageFrontRight.min,
      CLAMP.damageFrontRight.max,
      d.damageFrontRight,
    ),
    damageFlankLeft: clampInt(
      s.damageFlankLeft,
      CLAMP.damageFlankLeft.min,
      CLAMP.damageFlankLeft.max,
      d.damageFlankLeft,
    ),
    damageFlankRight: clampInt(
      s.damageFlankRight,
      CLAMP.damageFlankRight.min,
      CLAMP.damageFlankRight.max,
      d.damageFlankRight,
    ),
    damageRear: clampInt(s.damageRear, CLAMP.damageRear.min, CLAMP.damageRear.max, d.damageRear),
  };
  const legacySplash = (s as { splash?: unknown }).splash;
  if (legacySplash === false) next.splashDamage = 0;
  if (next.shootMin > next.shoot) next.shootMin = next.shoot;
  return next;
}

function clearCustomUnits(): void {
  for (const type of [...UNIT_TYPES]) {
    if (isUnitRole(type)) continue;
    delete UNIT_STATS[type];
  }
  UNIT_TYPES.length = 0;
  UNIT_TYPES.push(...STOCK_UNIT_TYPES);
}

function writeStock(next: Record<UnitRole, UnitStats>): void {
  for (const type of STOCK_UNIT_TYPES) {
    Object.assign(UNIT_STATS[type], next[type]);
  }
}

function registerCustom(type: UnitType, stats: UnitStats): void {
  if (isUnitRole(type) || !isCustomUnitId(type)) return;
  UNIT_STATS[type] = stats;
  if (!UNIT_TYPES.includes(type)) UNIT_TYPES.push(type);
}

export function persistUnitStats(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(UNIT_STATS));
  } catch {
    /* ignore quota / private mode */
  }
  notifyPersist();
}

function ingestRoster(raw: Partial<Record<string, Partial<UnitStats>>>): void {
  clearCustomUnits();
  for (const type of STOCK_UNIT_TYPES) {
    Object.assign(UNIT_STATS[type], sanitizeUnitStats(type, raw[type]));
  }
  for (const type of Object.keys(raw)) {
    if (UNIT_TYPES.length >= MAX_UNITS) break;
    if (!isCustomUnitId(type)) continue;
    registerCustom(type, sanitizeUnitStats(type, raw[type]));
  }
}

export function applyRemoteUnitStats(
  raw: Partial<Record<UnitType, Partial<UnitStats>>>,
): void {
  if (!raw || typeof raw !== 'object') return;
  ingestRoster(raw);
}

export function loadUnitStats(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const parsed = JSON.parse(stored) as Partial<Record<string, Partial<UnitStats>>>;
    if (!parsed || typeof parsed !== 'object') return;
    ingestRoster(parsed);
  } catch {
    clearCustomUnits();
    writeStock(structuredClone(DEFAULT_UNIT_STATS));
  }
}

export function resetUnitStats(): void {
  clearCustomUnits();
  writeStock(structuredClone(DEFAULT_UNIT_STATS));
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  notifyPersist();
}

export function unitStatsAreStock(): boolean {
  if (UNIT_TYPES.length !== STOCK_UNIT_TYPES.length) return false;
  return STOCK_UNIT_TYPES.every((type) => {
    const a = UNIT_STATS[type];
    const b = DEFAULT_UNIT_STATS[type];
    return (
      a.name === b.name &&
      a.category === b.category &&
      a.role === b.role &&
      INT_FIELDS.every((k) => a[k] === b[k]) &&
      TRAIT_FIELDS.every((k) => a[k] === b[k]) &&
      a.passWater === b.passWater &&
      a.shootArc === b.shootArc &&
      a.hexArmor === b.hexArmor &&
      a.hexDamage === b.hexDamage &&
      abilitiesEqual(a.abilities, b.abilities)
    );
  });
}

export function patchUnitCategory(type: UnitType, category: UnitCategory): void {
  const next = sanitizeUnitStats(type, {
    ...statsOf(type),
    category: sanitizeUnitCategory(category),
  });
  Object.assign(UNIT_STATS[type], next);
  persistUnitStats();
}

export function patchUnitShootArc(type: UnitType, shootArc: ShootArc): void {
  const next = sanitizeUnitStats(type, {
    ...statsOf(type),
    shootArc: sanitizeShootArc(shootArc),
  });
  Object.assign(UNIT_STATS[type], next);
  persistUnitStats();
}

/** Writes kit glyph + traits. Tower is glyph only — numbers and flags stay. */
export function patchUnitKit(type: UnitType, role: UnitRole): void {
  if (!isUnitRole(role) || !UNIT_TYPES.includes(type)) return;
  const kit = DEFAULT_UNIT_STATS[role];
  const prev = statsOf(type);
  const next = sanitizeUnitStats(type, {
    ...prev,
    role,
    ...(role === 'tower' ? {} : { chess: kit.chess, ...KIT_TRAITS[role] }),
  });
  Object.assign(UNIT_STATS[type], next);
  persistUnitStats();
}

export function patchUnitName(type: UnitType, name: string): void {
  const next = sanitizeUnitStats(type, { ...statsOf(type), name });
  Object.assign(UNIT_STATS[type], next);
  persistUnitStats();
}

export function patchUnitAbility(type: UnitType, id: AbilityId, on: boolean): void {
  const prev = statsOf(type);
  const abilities = on
    ? sanitizeAbilities([...prev.abilities, id])
    : prev.abilities.filter((a) => a !== id);
  const next = sanitizeUnitStats(type, { ...prev, abilities, king: abilities.includes('general') });
  Object.assign(UNIT_STATS[type], next);
  persistUnitStats();
}

export function patchUnitStat(type: UnitType, field: EditableStat, value: number | boolean): void {
  const prev = statsOf(type);
  const seed =
    field === 'hexArmor' && value === true
      ? {
          ...prev,
          hexArmor: true,
          armorFront: prev.armor,
          armorFrontLeft: prev.armor,
          armorFrontRight: prev.armor,
          armorFlankLeft: prev.armor,
          armorFlankRight: prev.armor,
          armorRear: prev.armor,
        }
      : field === 'hexDamage' && value === true
        ? {
            ...prev,
            hexDamage: true,
            damageFront: 0,
            damageFrontLeft: 0,
            damageFrontRight: 0,
            damageFlankLeft: 0,
            damageFlankRight: 0,
            damageRear: 0,
          }
        : { ...prev, [field]: value };
  const next = sanitizeUnitStats(type, seed);
  Object.assign(UNIT_STATS[type], next);
  persistUnitStats();
}

function uniqueCopyName(base: string): string {
  const root = base.replace(/\s+\d+$/, '').trim() || 'Unit';
  const taken = new Set(UNIT_TYPES.map((t) => statsOf(t).name));
  let n = 2;
  while (taken.has(`${root} ${n}`)) n += 1;
  return `${root} ${n}`;
}

function newUnitId(): UnitType {
  return `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function copyUnit(from: UnitType): UnitType | null {
  if (!UNIT_TYPES.includes(from) || UNIT_TYPES.length >= MAX_UNITS) return null;
  const src = statsOf(from);
  let id = newUnitId();
  while (UNIT_TYPES.includes(id)) id = newUnitId();
  const stats = sanitizeUnitStats(id, { ...src, name: uniqueCopyName(src.name) });
  registerCustom(id, stats);
  persistUnitStats();
  return id;
}

export function deleteCopiedUnit(type: UnitType): boolean {
  if (!isCustomUnitId(type) || !UNIT_TYPES.includes(type)) return false;
  delete UNIT_STATS[type];
  const i = UNIT_TYPES.indexOf(type);
  if (i >= 0) UNIT_TYPES.splice(i, 1);
  persistUnitStats();
  return true;
}

export { CLAMP, INT_FIELDS };

loadUnitStats();
