/**
 * Unit catalog. Engine reads flags on UnitStats — never unit names.
 * `role` is kit + glyph; KIT_TRAITS is what that kit writes.
 */

export type { AbilityId } from './abilities';
import type { AbilityId } from './abilities';

export type UnitRole =
  | 'soldier'
  | 'scout'
  | 'bazooka'
  | 'sniper'
  | 'archer'
  | 'javelin'
  | 'horsearcher'
  | 'chariotarcher'
  | 'cohort'
  | 'hoplite'
  | 'elephant'
  | 'barbarian'
  | 'catapult'
  | 'tank'
  | 'general'
  | 'tower'
  | 'dummy'
  | 'peasant'
  | 'dude'
  | 'wolf'
  | 'fighter'
  | 'gunship'
  | 'bomber'
  | 'frigate'
  | 'cruiser'
  | 'dreadnought';

/** Roster id: a stock role, or `u-…` for a copied unit. */
export type UnitType = string;

export const STOCK_UNIT_TYPES: UnitRole[] = [
  'soldier',
  'scout',
  'bazooka',
  'sniper',
  'archer',
  'javelin',
  'horsearcher',
  'chariotarcher',
  'cohort',
  'hoplite',
  'elephant',
  'barbarian',
  'catapult',
  'tank',
  'general',
  'tower',
  'dummy',
  'peasant',
  'dude',
  'wolf',
  'fighter',
  'gunship',
  'bomber',
  'frigate',
  'cruiser',
  'dreadnought',
];

/** Live roster. Copies are appended; reset restores stock. */
export const UNIT_TYPES: UnitType[] = [...STOCK_UNIT_TYPES];

export function isUnitRole(t: unknown): t is UnitRole {
  return typeof t === 'string' && (STOCK_UNIT_TYPES as readonly string[]).includes(t);
}

export function isCustomUnitId(t: unknown): t is UnitType {
  return typeof t === 'string' && /^u-[a-z0-9]+$/.test(t);
}

export function isKnownUnit(t: unknown): t is UnitType {
  return typeof t === 'string' && UNIT_TYPES.includes(t);
}

/** Combat type. Separate from kit (`role`) and era (`category`). */
export type UnitClass = 'melee' | 'ranged' | 'hero' | 'mounted' | 'other';

export const UNIT_CLASSES: UnitClass[] = ['melee', 'ranged', 'hero', 'mounted', 'other'];

export const UNIT_CLASS_LABEL: Record<UnitClass, string> = {
  melee: 'Melee',
  ranged: 'Ranged',
  hero: 'Hero',
  mounted: 'Mounted',
  other: 'Other',
};

export function isUnitClass(v: unknown): v is UnitClass {
  return typeof v === 'string' && (UNIT_CLASSES as readonly string[]).includes(v);
}

export function sanitizeUnitClass(v: unknown, fallback: UnitClass = 'other'): UnitClass {
  return isUnitClass(v) ? v : fallback;
}

export const STOCK_UNIT_CLASS: Record<UnitRole, UnitClass> = {
  soldier: 'melee',
  scout: 'mounted',
  bazooka: 'ranged',
  sniper: 'ranged',
  archer: 'ranged',
  javelin: 'ranged',
  horsearcher: 'mounted',
  chariotarcher: 'mounted',
  cohort: 'melee',
  hoplite: 'melee',
  elephant: 'mounted',
  barbarian: 'melee',
  catapult: 'ranged',
  tank: 'other',
  general: 'hero',
  tower: 'ranged',
  dummy: 'other',
  peasant: 'melee',
  dude: 'melee',
  wolf: 'melee',
  fighter: 'other',
  gunship: 'other',
  bomber: 'other',
  frigate: 'other',
  cruiser: 'other',
  dreadnought: 'other',
};

export type UnitCategory = 'modern' | 'ancient' | 'futuristic';

export const UNIT_CATEGORIES: UnitCategory[] = ['modern', 'ancient', 'futuristic'];

export const UNIT_CATEGORY_LABEL: Record<UnitCategory, string> = {
  modern: 'Modern',
  ancient: 'Ancient',
  futuristic: 'Futuristic',
};

export const UNIT_ROLE_LABEL: Record<UnitRole, string> = {
  soldier: 'Soldier',
  scout: 'Scout',
  bazooka: 'Bazooka',
  sniper: 'Sniper',
  archer: 'Archer',
  javelin: 'Javelin',
  horsearcher: 'Horse archer',
  chariotarcher: 'Chariot archer',
  cohort: 'Cohort',
  hoplite: 'Hoplite',
  elephant: 'Elephant',
  barbarian: 'Barbarian',
  catapult: 'Catapult',
  tank: 'Tank',
  general: 'General',
  tower: 'Tower',
  dummy: 'Dummy',
  peasant: 'Peasant',
  dude: 'Dude',
  wolf: 'Wolf',
  fighter: 'Fighter',
  gunship: 'Gunship',
  bomber: 'Bomber',
  frigate: 'Frigate',
  cruiser: 'Cruiser',
  dreadnought: 'Dreadnought',
};

export function sanitizeUnitCategory(raw: unknown): UnitCategory {
  if (raw === 'modern' || raw === 'ancient' || raw === 'futuristic') return raw;
  if (raw === 'roman' || raw === 'greek') return 'ancient';
  return 'modern';
}

/** How a shot treats pieces on the line. Terrain LOS is unchanged. */
export type ShootArc = 'straight' | 'arch';

export const SHOOT_ARCS: ShootArc[] = ['straight', 'arch'];

export const SHOOT_ARC_LABEL: Record<ShootArc, string> = {
  straight: 'Straight',
  arch: 'Arch',
};

export function sanitizeShootArc(raw: unknown): ShootArc {
  return raw === 'arch' ? 'arch' : 'straight';
}

/** Kit-only specials. Copied with the unit; kit dropdown overwrites these. */
export type UnitTraits = {
  /** Pass through any pieces; stop rules still apply. */
  passUnits: boolean;
  infantry: boolean;
  /** King kit stamps the General token when a stamp omits unitTokens. Command-kill is the token. */
  king: boolean;
};

export const TRAIT_FIELDS = [
  'passUnits',
  'infantry',
  'king',
] as const satisfies readonly (keyof UnitTraits)[];

/** Kit dropdown writes glyph only — numbers and pathing stay. */
export const GLYPH_ONLY_KITS: ReadonlySet<UnitRole> = new Set([
  'tower',
  'javelin',
  'horsearcher',
  'dude',
  'wolf',
  'fighter',
  'gunship',
  'bomber',
  'frigate',
  'cruiser',
  'dreadnought',
]);

export const KIT_TRAITS: Record<UnitRole, UnitTraits> = {
  soldier: { passUnits: false, infantry: true, king: false },
  scout: { passUnits: true, infantry: false, king: false },
  bazooka: { passUnits: false, infantry: false, king: false },
  sniper: { passUnits: false, infantry: false, king: false },
  archer: { passUnits: false, infantry: true, king: false },
  javelin: { passUnits: false, infantry: true, king: false },
  horsearcher: { passUnits: true, infantry: false, king: false },
  chariotarcher: { passUnits: false, infantry: false, king: false },
  cohort: { passUnits: false, infantry: true, king: false },
  hoplite: { passUnits: false, infantry: true, king: false },
  elephant: { passUnits: false, infantry: false, king: false },
  barbarian: { passUnits: false, infantry: true, king: false },
  catapult: { passUnits: false, infantry: false, king: false },
  tank: { passUnits: false, infantry: false, king: false },
  general: { passUnits: false, infantry: false, king: true },
  tower: { passUnits: false, infantry: false, king: false },
  dummy: { passUnits: false, infantry: false, king: false },
  peasant: { passUnits: false, infantry: true, king: false },
  dude: { passUnits: false, infantry: true, king: false },
  wolf: { passUnits: true, infantry: false, king: false },
  fighter: { passUnits: true, infantry: false, king: false },
  gunship: { passUnits: true, infantry: false, king: false },
  bomber: { passUnits: false, infantry: false, king: false },
  frigate: { passUnits: true, infantry: false, king: false },
  cruiser: { passUnits: false, infantry: false, king: false },
  dreadnought: { passUnits: false, infantry: false, king: false },
};

/** Legacy noHigh kits — cannot climb. Everyone else could climb and/or swim. */
const HEAVY_KITS: ReadonlySet<UnitRole> = new Set([
  'elephant',
  'catapult',
  'tank',
  'dummy',
]);

const FLYING_KITS: ReadonlySet<UnitRole> = new Set([
  'fighter',
  'gunship',
  'bomber',
  'frigate',
  'cruiser',
  'dreadnought',
]);

export function stockMobility(role: UnitRole): { passWater: boolean; climbLevel: number } {
  if (FLYING_KITS.has(role)) return { passWater: true, climbLevel: 3 };
  if (HEAVY_KITS.has(role)) return { passWater: false, climbLevel: 0 };
  return { passWater: true, climbLevel: 2 };
}

export const CLIMB_LEVELS = [0, 1, 2, 3] as const;
export type ClimbLevel = (typeof CLIMB_LEVELS)[number];

export const CLIMB_LEVEL_LABEL: Record<ClimbLevel, string> = {
  0: '0',
  1: 'Hill (lvl.1)',
  2: 'Plateau (lvl.2)',
  3: 'Mountain (lvl.3)',
};

export function sanitizeClimbLevel(raw: unknown, fallback = 0): ClimbLevel {
  const v = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(v)) return fallback as ClimbLevel;
  return Math.max(0, Math.min(3, Math.floor(v))) as ClimbLevel;
}

export type UnitStats = UnitTraits & {
  name: string;
  chess: string;
  /** Era roster. Missing on old saves → modern. */
  category: UnitCategory;
  /** Kit + glyph. Copies keep the source kit unless changed. */
  role: UnitRole;
  /** Melee, ranged, hero, mounted, or other. */
  unitClass: UnitClass;
  /** Stop on / enter water. From water: 1 hex. Turn-start: 1 stamina or 2 HP. No regen in water. */
  passWater: boolean;
  /** Derived from the hide ability. Kept on the stats blob for persist / old JSON. */
  canHide: boolean;
  /** Max occupiable height: 0 land, 1 hill, 2 plateau, 3 mountain. */
  climbLevel: number;
  move: number;
  /** AI Hold Sight (hexes). Not fog of war. Hill / plateau / mountain add like shoot. Always ≥ max(move, shoot)+1. */
  sight: number;
  /** Max shoot distance (shooter elevation adds; firing at elevation costs that much). */
  shoot: number;
  /** Min shoot distance (1 = can fire adjacent). */
  shootMin: number;
  /** Straight: pieces block from low. Arch: fire over units. Terrain LOS unchanged. */
  shootArc: ShootArc;
  actions: number;
  /** Own turns you must sit out shooting after firing (1 = next activation, 2 = two, …). */
  shootCooldown: number;
  value: number;
  /** Cap on total steps this activation, including stamina extras (0 = none). */
  moveBudget: number;
  /** Stamina pool. 0 = cannot climb or double. */
  stamina: number;
  /** Own turns to recover 1 stamina (any action resets; grant only on a fully idle End on land). 0 = never. */
  staminaRegen: number;
  /** Shots per piece per match (0 = unlimited). */
  ammo: number;
  /** Hitpoints. */
  hp: number;
  /** Damage when bumping an occupied dest hex. 0 = melee is not a legal action. */
  meleeDamage: number;
  /** Mid-path charge-through damage. 0 = cannot charge through units. A living blocker stops you from a later occupied dest unless that charge kills them. Empty dest beyond: trample the line even if they survive. */
  charge: number;
  /** Damage of a non-splash shot. */
  shootDamage: number;
  /** Damage per hex in a splash blast. 0 = no splash (bullet shot). */
  splashDamage: number;
  /** Subtracted from incoming damage (can be negative). */
  armor: number;
  /** When true, incoming hits use the six facing sides instead of `armor`. */
  hexArmor: boolean;
  armorFront: number;
  armorFrontLeft: number;
  armorFrontRight: number;
  armorFlankLeft: number;
  armorFlankRight: number;
  armorRear: number;
  /** When true, outgoing hits can use per-face damage (0–2). Combat not wired yet. */
  hexDamage: boolean;
  damageFront: number;
  damageFrontLeft: number;
  damageFrontRight: number;
  damageFlankLeft: number;
  damageFlankRight: number;
  damageRear: number;
  /** Granted in the unit editor; pieces may override at runtime. */
  abilities: AbilityId[];
};

/** Relative to facing, CCW: front → front-left → flank-left → rear → flank-right → front-right. */
export const HEX_ARMOR_SIDES = [
  'armorFront',
  'armorFrontLeft',
  'armorFlankLeft',
  'armorRear',
  'armorFlankRight',
  'armorFrontRight',
] as const;

export type HexArmorSide = (typeof HEX_ARMOR_SIDES)[number];

export const HEX_ARMOR_LABEL: Record<HexArmorSide, string> = {
  armorFront: 'Front',
  armorFrontLeft: 'Front left',
  armorFrontRight: 'Front right',
  armorFlankLeft: 'Flank left',
  armorFlankRight: 'Flank right',
  armorRear: 'Rear',
};

function hexArmorDefaults(n: number): Pick<
  UnitStats,
  | 'hexArmor'
  | 'armorFront'
  | 'armorFrontLeft'
  | 'armorFrontRight'
  | 'armorFlankLeft'
  | 'armorFlankRight'
  | 'armorRear'
> {
  return {
    hexArmor: false,
    armorFront: n,
    armorFrontLeft: n,
    armorFrontRight: n,
    armorFlankLeft: n,
    armorFlankRight: n,
    armorRear: n,
  };
}

export const HEX_DAMAGE_SIDES = [
  'damageFront',
  'damageFrontLeft',
  'damageFlankLeft',
  'damageRear',
  'damageFlankRight',
  'damageFrontRight',
] as const;

export type HexDamageSide = (typeof HEX_DAMAGE_SIDES)[number];

export const HEX_DAMAGE_LABEL: Record<HexDamageSide, string> = {
  damageFront: 'Front',
  damageFrontLeft: 'Front left',
  damageFrontRight: 'Front right',
  damageFlankLeft: 'Flank left',
  damageFlankRight: 'Flank right',
  damageRear: 'Rear',
};

function hexDamageDefaults(n = 0): Pick<
  UnitStats,
  | 'hexDamage'
  | 'damageFront'
  | 'damageFrontLeft'
  | 'damageFrontRight'
  | 'damageFlankLeft'
  | 'damageFlankRight'
  | 'damageRear'
> {
  const v = Math.max(0, Math.min(2, n));
  return {
    hexDamage: false,
    damageFront: v,
    damageFrontLeft: v,
    damageFrontRight: v,
    damageFlankLeft: v,
    damageFlankRight: v,
    damageRear: v,
  };
}

/** Floor for Sight: one hex past this unit's move or shoot, whichever is longer. */
export function defaultSight(move: number, shoot: number): number {
  const m = Number.isFinite(move) ? Math.max(0, Math.floor(move)) : 0;
  const sh = Number.isFinite(shoot) ? Math.max(0, Math.floor(shoot)) : 0;
  return Math.max(m, sh) + 1;
}

export const DEFAULT_UNIT_STATS: Record<UnitRole, UnitStats> = ((
  raw: Record<UnitRole, Omit<UnitStats, 'sight' | 'unitClass'>>,
): Record<UnitRole, UnitStats> => {
  const out = {} as Record<UnitRole, UnitStats>;
  for (const role of STOCK_UNIT_TYPES) {
    const s = raw[role];
    out[role] = {
      ...s,
      unitClass: STOCK_UNIT_CLASS[role],
      sight: defaultSight(s.move, s.shoot),
    };
  }
  return out;
})({
  soldier: {
    name: 'Soldier',
    chess: 'Pawn',
    category: 'modern',
    role: 'soldier',
    move: 1,
    shoot: 2,
    shootMin: 1,
    shootArc: 'straight',
    actions: 1,
    shootCooldown: 1,
    value: 1,
    moveBudget: 0,
    stamina: 1,
    staminaRegen: 1,
    ammo: 0,
    hp: 1,
    meleeDamage: 1,
    charge: 0,
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
    ...hexArmorDefaults(0),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.soldier,
    ...stockMobility('soldier'),
    canHide: false,
    abilities: [],
  },
  scout: {
    name: 'Scout',
    chess: 'Knight',
    category: 'modern',
    role: 'scout',
    move: 2,
    shoot: 3,
    shootMin: 1,
    shootArc: 'straight',
    actions: 2,
    shootCooldown: 1,
    value: 3,
    moveBudget: 3,
    stamina: 1,
    staminaRegen: 2,
    ammo: 0,
    hp: 1,
    meleeDamage: 1,
    charge: 0,
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
    ...hexArmorDefaults(0),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.scout,
    ...stockMobility('scout'),
    canHide: false,
    abilities: [],
  },
  bazooka: {
    name: 'Bazooka',
    chess: 'Bishop',
    category: 'modern',
    role: 'bazooka',
    move: 1,
    shoot: 4,
    shootMin: 1,
    shootArc: 'straight',
    actions: 1,
    shootCooldown: 2,
    value: 3,
    moveBudget: 0,
    stamina: 1,
    staminaRegen: 2,
    ammo: 0,
    hp: 1,
    meleeDamage: 1,
    charge: 0,
    shootDamage: 1,
    splashDamage: 1,
    armor: 0,
    ...hexArmorDefaults(0),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.bazooka,
    ...stockMobility('bazooka'),
    canHide: false,
    abilities: [],
  },
  sniper: {
    name: 'Sniper',
    chess: 'Rook',
    category: 'modern',
    role: 'sniper',
    move: 1,
    shoot: 6,
    shootMin: 1,
    shootArc: 'straight',
    actions: 1,
    shootCooldown: 1,
    value: 5,
    moveBudget: 0,
    stamina: 1,
    staminaRegen: 2,
    ammo: 0,
    hp: 1,
    meleeDamage: 1,
    charge: 0,
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
    ...hexArmorDefaults(0),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.sniper,
    ...stockMobility('sniper'),
    canHide: false,
    abilities: [],
  },
  archer: {
    name: 'Archer',
    chess: 'Bow',
    category: 'ancient',
    role: 'archer',
    move: 1,
    shoot: 4,
    shootMin: 2,
    shootArc: 'arch',
    actions: 1,
    shootCooldown: 1,
    value: 3,
    moveBudget: 0,
    stamina: 1,
    staminaRegen: 1,
    ammo: 0,
    hp: 1,
    meleeDamage: 1,
    charge: 0,
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
    ...hexArmorDefaults(0),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.archer,
    ...stockMobility('archer'),
    canHide: false,
    abilities: [],
  },
  javelin: {
    name: 'Javelin',
    chess: 'Pilum',
    category: 'ancient',
    role: 'javelin',
    move: 1,
    shoot: 2,
    shootMin: 1,
    shootArc: 'arch',
    actions: 1,
    shootCooldown: 1,
    value: 2,
    moveBudget: 0,
    stamina: 1,
    staminaRegen: 1,
    ammo: 0,
    hp: 1,
    meleeDamage: 1,
    charge: 0,
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
    ...hexArmorDefaults(0),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.javelin,
    ...stockMobility('javelin'),
    canHide: false,
    abilities: ['javelin'],
  },
  horsearcher: {
    name: 'Horse archer',
    chess: 'Parthian',
    category: 'ancient',
    role: 'horsearcher',
    move: 2,
    shoot: 3,
    shootMin: 1,
    shootArc: 'arch',
    actions: 1,
    shootCooldown: 1,
    value: 4,
    moveBudget: 0,
    stamina: 1,
    staminaRegen: 1,
    ammo: 0,
    hp: 1,
    meleeDamage: 1,
    charge: 0,
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
    ...hexArmorDefaults(0),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.horsearcher,
    ...stockMobility('horsearcher'),
    canHide: false,
    abilities: [],
  },
  chariotarcher: {
    name: 'Chariot archer',
    chess: 'Quadriga',
    category: 'ancient',
    role: 'chariotarcher',
    move: 2,
    shoot: 3,
    shootMin: 1,
    shootArc: 'arch',
    actions: 1,
    shootCooldown: 1,
    value: 5,
    moveBudget: 0,
    stamina: 1,
    staminaRegen: 1,
    ammo: 0,
    hp: 2,
    meleeDamage: 1,
    charge: 1,
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
    ...hexArmorDefaults(0),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.chariotarcher,
    ...stockMobility('chariotarcher'),
    passWater: false,
    climbLevel: 1,
    canHide: false,
    abilities: ['charge'],
  },
  cohort: {
    name: 'Cohort',
    chess: 'Scutum',
    category: 'ancient',
    role: 'cohort',
    move: 1,
    shoot: 1,
    shootMin: 1,
    shootArc: 'arch',
    actions: 1,
    shootCooldown: 1,
    value: 2,
    moveBudget: 0,
    stamina: 1,
    staminaRegen: 1,
    ammo: 0,
    hp: 2,
    meleeDamage: 1,
    charge: 0,
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
    ...hexArmorDefaults(0),
    ...hexDamageDefaults(),
    hexArmor: true,
    ...KIT_TRAITS.cohort,
    ...stockMobility('cohort'),
    canHide: false,
    abilities: ['javelin'],
  },
  hoplite: {
    name: 'Hoplite',
    chess: 'Spear',
    category: 'ancient',
    role: 'hoplite',
    move: 1,
    shoot: 0,
    shootMin: 0,
    shootArc: 'straight',
    actions: 1,
    shootCooldown: 0,
    value: 2,
    moveBudget: 0,
    stamina: 1,
    staminaRegen: 1,
    ammo: 0,
    hp: 2,
    meleeDamage: 1,
    charge: 0,
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
    ...hexArmorDefaults(0),
    ...hexDamageDefaults(),
    hexArmor: true,
    ...KIT_TRAITS.hoplite,
    ...stockMobility('hoplite'),
    canHide: false,
    abilities: ['trap'],
  },
  elephant: {
    name: 'Elephant',
    chess: 'Beast',
    category: 'ancient',
    role: 'elephant',
    move: 2,
    shoot: 0,
    shootMin: 0,
    shootArc: 'straight',
    actions: 1,
    shootCooldown: 0,
    value: 8,
    moveBudget: 0,
    stamina: 1,
    staminaRegen: 2,
    ammo: 0,
    hp: 3,
    meleeDamage: 2,
    charge: 1,
    shootDamage: 1,
    splashDamage: 0,
    armor: 1,
    ...hexArmorDefaults(1),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.elephant,
    ...stockMobility('elephant'),
    canHide: false,
    abilities: ['charge'],
  },
  barbarian: {
    name: 'Barbarian',
    chess: 'Axe',
    category: 'ancient',
    role: 'barbarian',
    move: 2,
    shoot: 0,
    shootMin: 0,
    shootArc: 'straight',
    actions: 1,
    shootCooldown: 0,
    value: 3,
    moveBudget: 0,
    stamina: 2,
    staminaRegen: 1,
    ammo: 0,
    hp: 2,
    meleeDamage: 2,
    charge: 1,
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
    ...hexArmorDefaults(0),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.barbarian,
    ...stockMobility('barbarian'),
    canHide: true,
    abilities: ['hide', 'charge'],
  },
  catapult: {
    name: 'Catapult',
    chess: 'Siege',
    category: 'ancient',
    role: 'catapult',
    move: 1,
    shoot: 5,
    shootMin: 2,
    shootArc: 'arch',
    actions: 1,
    shootCooldown: 2,
    value: 6,
    moveBudget: 0,
    stamina: 1,
    staminaRegen: 2,
    ammo: 0,
    hp: 2,
    meleeDamage: 0,
    charge: 0,
    shootDamage: 2,
    splashDamage: 1,
    armor: 0,
    ...hexArmorDefaults(0),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.catapult,
    ...stockMobility('catapult'),
    canHide: false,
    abilities: [],
  },
  tank: {
    name: 'Tank',
    chess: 'Queen',
    category: 'modern',
    role: 'tank',
    move: 3,
    shoot: 4,
    shootMin: 3,
    shootArc: 'straight',
    actions: 1,
    shootCooldown: 2,
    value: 9,
    moveBudget: 0,
    stamina: 1,
    staminaRegen: 3,
    ammo: 0,
    hp: 1,
    meleeDamage: 1,
    charge: 1,
    shootDamage: 1,
    splashDamage: 1,
    armor: 2,
    ...hexArmorDefaults(2),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.tank,
    ...stockMobility('tank'),
    canHide: false,
    abilities: ['charge'],
  },
  general: {
    name: 'General',
    chess: 'King',
    category: 'modern',
    role: 'general',
    move: 1,
    shoot: 2,
    shootMin: 1,
    shootArc: 'straight',
    actions: 1,
    shootCooldown: 0,
    value: 100,
    moveBudget: 0,
    stamina: 1,
    staminaRegen: 2,
    ammo: 0,
    hp: 1,
    meleeDamage: 1,
    charge: 0,
    shootDamage: 1,
    splashDamage: 0,
    armor: 1,
    ...hexArmorDefaults(1),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.general,
    ...stockMobility('general'),
    canHide: false,
    abilities: [],
  },
  tower: {
    name: 'Tower',
    chess: '—',
    category: 'modern',
    role: 'tower',
    move: 1,
    shoot: 2,
    shootMin: 1,
    shootArc: 'straight',
    actions: 1,
    shootCooldown: 1,
    value: 1,
    moveBudget: 0,
    stamina: 1,
    staminaRegen: 1,
    ammo: 0,
    hp: 1,
    meleeDamage: 1,
    charge: 0,
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
    ...hexArmorDefaults(0),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.tower,
    ...stockMobility('tower'),
    canHide: false,
    abilities: [],
  },
  dummy: {
    name: 'Dummy',
    chess: 'Straw',
    category: 'modern',
    role: 'dummy',
    move: 0,
    shoot: 0,
    shootMin: 0,
    shootArc: 'straight',
    actions: 1,
    shootCooldown: 0,
    value: 0,
    moveBudget: 0,
    stamina: 0,
    staminaRegen: 0,
    ammo: 0,
    hp: 2,
    meleeDamage: 0,
    charge: 0,
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
    ...hexArmorDefaults(0),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.dummy,
    ...stockMobility('dummy'),
    canHide: false,
    abilities: [],
  },
  peasant: {
    name: 'Peasant',
    chess: 'Levy',
    category: 'ancient',
    role: 'peasant',
    move: 1,
    shoot: 0,
    shootMin: 0,
    shootArc: 'straight',
    actions: 1,
    shootCooldown: 0,
    value: 0,
    moveBudget: 0,
    stamina: 1,
    staminaRegen: 1,
    ammo: 0,
    hp: 1,
    meleeDamage: 1,
    charge: 0,
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
    ...hexArmorDefaults(0),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.peasant,
    ...stockMobility('peasant'),
    canHide: false,
    abilities: [],
  },
  dude: {
    name: 'Dude',
    chess: 'Chap',
    category: 'ancient',
    role: 'dude',
    move: 1,
    shoot: 0,
    shootMin: 0,
    shootArc: 'straight',
    actions: 1,
    shootCooldown: 0,
    value: 0,
    moveBudget: 0,
    stamina: 1,
    staminaRegen: 1,
    ammo: 0,
    hp: 1,
    meleeDamage: 1,
    charge: 0,
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
    ...hexArmorDefaults(0),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.dude,
    ...stockMobility('dude'),
    canHide: false,
    abilities: [],
  },
  wolf: {
    name: 'Wolf',
    chess: 'Pack',
    category: 'ancient',
    role: 'wolf',
    move: 2,
    shoot: 0,
    shootMin: 0,
    shootArc: 'straight',
    actions: 1,
    shootCooldown: 0,
    value: 3,
    moveBudget: 0,
    stamina: 2,
    staminaRegen: 1,
    ammo: 0,
    hp: 1,
    meleeDamage: 2,
    charge: 1,
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
    ...hexArmorDefaults(0),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.wolf,
    ...stockMobility('wolf'),
    canHide: true,
    abilities: ['hide', 'charge'],
  },
  fighter: {
    name: 'Fighter',
    chess: 'Dart',
    category: 'futuristic',
    role: 'fighter',
    move: 3,
    shoot: 2,
    shootMin: 1,
    shootArc: 'straight',
    actions: 1,
    shootCooldown: 1,
    value: 3,
    moveBudget: 0,
    stamina: 1,
    staminaRegen: 1,
    ammo: 0,
    hp: 1,
    meleeDamage: 1,
    charge: 1,
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
    ...hexArmorDefaults(0),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.fighter,
    ...stockMobility('fighter'),
    canHide: false,
    abilities: ['charge'],
  },
  gunship: {
    name: 'Gunship',
    chess: 'Sentry',
    category: 'futuristic',
    role: 'gunship',
    move: 2,
    shoot: 3,
    shootMin: 1,
    shootArc: 'arch',
    actions: 1,
    shootCooldown: 1,
    value: 4,
    moveBudget: 0,
    stamina: 1,
    staminaRegen: 1,
    ammo: 0,
    hp: 1,
    meleeDamage: 1,
    charge: 0,
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
    ...hexArmorDefaults(0),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.gunship,
    ...stockMobility('gunship'),
    canHide: false,
    abilities: [],
  },
  bomber: {
    name: 'Bomber',
    chess: 'Payload',
    category: 'futuristic',
    role: 'bomber',
    move: 1,
    shoot: 4,
    shootMin: 2,
    shootArc: 'arch',
    actions: 1,
    shootCooldown: 2,
    value: 5,
    moveBudget: 0,
    stamina: 1,
    staminaRegen: 1,
    ammo: 0,
    hp: 1,
    meleeDamage: 1,
    charge: 0,
    shootDamage: 1,
    splashDamage: 1,
    armor: 0,
    ...hexArmorDefaults(0),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.bomber,
    ...stockMobility('bomber'),
    canHide: false,
    abilities: [],
  },
  frigate: {
    name: 'Frigate',
    chess: 'Knife',
    category: 'futuristic',
    role: 'frigate',
    move: 2,
    shoot: 2,
    shootMin: 1,
    shootArc: 'straight',
    actions: 1,
    shootCooldown: 1,
    value: 4,
    moveBudget: 0,
    stamina: 1,
    staminaRegen: 1,
    ammo: 0,
    hp: 2,
    meleeDamage: 1,
    charge: 1,
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
    ...hexArmorDefaults(0),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.frigate,
    ...stockMobility('frigate'),
    canHide: false,
    abilities: ['charge'],
  },
  cruiser: {
    name: 'Cruiser',
    chess: 'Hull',
    category: 'futuristic',
    role: 'cruiser',
    move: 2,
    shoot: 3,
    shootMin: 1,
    shootArc: 'straight',
    actions: 1,
    shootCooldown: 1,
    value: 7,
    moveBudget: 0,
    stamina: 1,
    staminaRegen: 1,
    ammo: 0,
    hp: 3,
    meleeDamage: 1,
    charge: 0,
    shootDamage: 1,
    splashDamage: 0,
    armor: 1,
    ...hexArmorDefaults(1),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.cruiser,
    ...stockMobility('cruiser'),
    canHide: false,
    abilities: [],
  },
  dreadnought: {
    name: 'Dreadnought',
    chess: 'Leviathan',
    category: 'futuristic',
    role: 'dreadnought',
    move: 1,
    shoot: 4,
    shootMin: 2,
    shootArc: 'straight',
    actions: 1,
    shootCooldown: 2,
    value: 10,
    moveBudget: 0,
    stamina: 0,
    staminaRegen: 0,
    ammo: 0,
    hp: 4,
    meleeDamage: 1,
    charge: 0,
    shootDamage: 1,
    splashDamage: 1,
    armor: 2,
    ...hexArmorDefaults(2),
    ...hexDamageDefaults(),
    ...KIT_TRAITS.dreadnought,
    ...stockMobility('dreadnought'),
    canHide: false,
    abilities: [],
  },
});

/** Live stats — mutated by the unit editor. Engine reads this at action time. */
export const UNIT_STATS: Record<string, UnitStats> = structuredClone(DEFAULT_UNIT_STATS);

export function statsOf(type: UnitType): UnitStats {
  return UNIT_STATS[type] ?? DEFAULT_UNIT_STATS.soldier;
}

/** Glyph / kit id. Mechanics use flags on stats, not this. */
export function roleOf(type: UnitType): UnitRole {
  const s = UNIT_STATS[type];
  if (s && isUnitRole(s.role)) return s.role;
  if (isUnitRole(type)) return type;
  return 'soldier';
}
