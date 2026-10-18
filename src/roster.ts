/**
 * Unit catalog. Engine reads flags on UnitStats — never unit names.
 * `role` is kit + glyph; KIT_TRAITS is what that kit writes.
 */

export type UnitRole =
  | 'soldier'
  | 'scout'
  | 'bazooka'
  | 'sniper'
  | 'tank'
  | 'general'
  | 'tower';

/** Roster id: a stock role, or `u-…` for a copied unit. */
export type UnitType = string;

export const STOCK_UNIT_TYPES: UnitRole[] = [
  'soldier',
  'scout',
  'bazooka',
  'sniper',
  'tank',
  'general',
  'tower',
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

export type UnitCategory = 'modern' | 'roman' | 'greek';

export const UNIT_CATEGORIES: UnitCategory[] = ['modern', 'roman', 'greek'];

export const UNIT_CATEGORY_LABEL: Record<UnitCategory, string> = {
  modern: 'Modern',
  roman: 'Roman',
  greek: 'Greek',
};

export const UNIT_ROLE_LABEL: Record<UnitRole, string> = {
  soldier: 'Soldier',
  scout: 'Scout',
  bazooka: 'Bazooka',
  sniper: 'Sniper',
  tank: 'Tank',
  general: 'General',
  tower: 'Tower',
};

export function sanitizeUnitCategory(raw: unknown): UnitCategory {
  if (raw === 'modern' || raw === 'roman' || raw === 'greek') return raw;
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

/** Movement / win specials. Copied with the unit; kit dropdown overwrites these. */
export type UnitTraits = {
  /** Pass through water hexes (cannot stop on them). */
  passWater: boolean;
  /** Pass through any pieces; stop rules still apply. */
  passUnits: boolean;
  /** Cannot enter high even with stamina. */
  noHigh: boolean;
  /** Walk through dying infantry mid-path. */
  overrun: boolean;
  /** Can be overrun. */
  infantry: boolean;
  /** Killing this wins — only if the side started the match with a king. Wipeout always wins. */
  king: boolean;
};

export const TRAIT_FIELDS = [
  'passWater',
  'passUnits',
  'noHigh',
  'overrun',
  'infantry',
  'king',
] as const satisfies readonly (keyof UnitTraits)[];

export const KIT_TRAITS: Record<UnitRole, UnitTraits> = {
  soldier: {
    passWater: false,
    passUnits: false,
    noHigh: false,
    overrun: false,
    infantry: true,
    king: false,
  },
  scout: {
    passWater: true,
    passUnits: true,
    noHigh: false,
    overrun: false,
    infantry: false,
    king: false,
  },
  bazooka: {
    passWater: false,
    passUnits: false,
    noHigh: false,
    overrun: false,
    infantry: false,
    king: false,
  },
  sniper: {
    passWater: false,
    passUnits: false,
    noHigh: false,
    overrun: false,
    infantry: false,
    king: false,
  },
  tank: {
    passWater: false,
    passUnits: false,
    noHigh: true,
    overrun: true,
    infantry: false,
    king: false,
  },
  general: {
    passWater: false,
    passUnits: false,
    noHigh: false,
    overrun: false,
    infantry: false,
    king: true,
  },
  tower: {
    passWater: false,
    passUnits: false,
    noHigh: false,
    overrun: false,
    infantry: false,
    king: false,
  },
};

export type UnitStats = UnitTraits & {
  name: string;
  chess: string;
  /** Era roster. Missing on old saves → modern. */
  category: UnitCategory;
  /** Kit + glyph. Copies keep the source kit unless changed. */
  role: UnitRole;
  move: number;
  /** Max shoot distance (high ground may add +1). */
  shoot: number;
  /** Min shoot distance (1 = can fire adjacent). */
  shootMin: number;
  /** Straight: pieces block from low. Arch: fire over units. Terrain LOS unchanged. */
  shootArc: ShootArc;
  actions: number;
  /** Own turns you must sit out shooting after firing (1 = next activation, 2 = two, …). */
  shootCooldown: number;
  value: number;
  /** Cap on total move cost across a multi-action activation (0 = no cap). */
  moveBudget: number;
  /** Stamina pool. 0 = cannot climb or double. */
  stamina: number;
  /** Own turns to recover 1 stamina (walk resets; grant only on an idle End). 0 = never. */
  staminaRegen: number;
  /** Shots per piece per match (0 = unlimited). */
  ammo: number;
  /** Hitpoints. */
  hp: number;
  /** Damage when bumping / overrunning an occupied hex. */
  meleeDamage: number;
  /** Damage of a non-splash shot. */
  shootDamage: number;
  /** Damage per hex in a splash blast. 0 = no splash (bullet shot). */
  splashDamage: number;
  /** Subtracted from incoming damage (can be negative). */
  armor: number;
};

export const DEFAULT_UNIT_STATS: Record<UnitRole, UnitStats> = {
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
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
    ...KIT_TRAITS.soldier,
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
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
    ...KIT_TRAITS.scout,
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
    shootDamage: 1,
    splashDamage: 1,
    armor: 0,
    ...KIT_TRAITS.bazooka,
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
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
    ...KIT_TRAITS.sniper,
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
    shootDamage: 1,
    splashDamage: 1,
    armor: 2,
    ...KIT_TRAITS.tank,
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
    shootDamage: 1,
    splashDamage: 0,
    armor: 1,
    ...KIT_TRAITS.general,
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
    shootDamage: 1,
    splashDamage: 0,
    armor: 0,
    ...KIT_TRAITS.tower,
  },
};

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
