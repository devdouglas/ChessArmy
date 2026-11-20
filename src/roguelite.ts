/** Roguelite: randomised maps, shop recruits, permanent player losses, 10 wins then endless. */

import {
  MAX_UNIT_PROMOTIONS,
  PROMOTION_TOKEN_TYPES,
  isPromotionToken,
  isStackablePromotion,
  sanitizeUnitTokens,
  statsOf,
  unitTokensOf,
  withStory,
  type AiStyle,
  type Piece,
  type PromotionTokenType,
  type Side,
  type UnitTokenType,
  type UnitType,
} from './engine';
import {
  DEFAULT_ARMY_EDGE,
  RANDOM_ORIENTATION,
  ROGUE_HEX_RADIUS,
  facingFromStamp,
  rogueHexDisk,
  sanitizeStampFacing,
  type ArmyStamp,
} from './map';
import { distance } from './hex';
import { sanitizePeriod, type Period } from './period';
import { UNIT_STATS, UNIT_TYPES } from './roster';

export const ROGUE_GOAL = 10;
/** Enemy / shop kits: value must be ≤ battle + this. Battle 4 → value ≤ 5. */
export const ROGUE_VALUE_SLACK = 1;
/** First battle where enemies receive promotions. */
export const ROGUE_PROMO_START = 7;
export const ROGUE_START_COUNT = 2;
/** Gold at run start. Battles pay 1g per earned star. */
export const ROGUE_START_GOLD = 0;
export const ROGUE_SHOP_SIZE = 3;
/** Roguelite star copy (win / general lives / no losses). */
export const ROGUE_STAR_LABELS = [
  'Win',
  'General survives',
  'No units lost',
] as const;

/** Max recruitable kit value for this battle number. */
export function rogueMaxUnitValue(battle: number): number {
  return Math.max(0, Math.floor(battle)) + ROGUE_VALUE_SLACK;
}

/** How many random enemy promotions to stamp for this battle (0 before L7). */
export function rogueEnemyPromoCount(battle: number): number {
  const b = Math.max(0, Math.floor(battle));
  return Math.max(0, b - (ROGUE_PROMO_START - 1));
}

/** Army entry — type plus any kickoff tokens that survive between battles. */
export type RogueUnit = {
  type: UnitType;
  unitTokens?: UnitTokenType[];
};

export type RogueRun = {
  battle: number;
  period: Period;
  playerArmy: RogueUnit[];
  enemyArmy: RogueUnit[];
  aiStyle: AiStyle;
  /** Spendable coin; leftovers carry between battles. */
  gold: number;
};

/** Gold cost for each promotion after the first free pick. */
export const ROGUE_PROMO_COST = 1;

/** Open post-victory shop (offers rolled once per win). */
export type RogueShop = {
  offers: UnitType[];
  /** Units bought this shop, queued onto the next army. */
  purchased: UnitType[];
  /** Gold gained from stars this battle (1 per star). */
  starGold: number;
  /** Promotion choices — first take free, extras cost ROGUE_PROMO_COST each. */
  promotions: PromotionTokenType[];
  /** True after the free promotion has been claimed this shop. */
  freePromoTaken: boolean;
};

/** Combat kits for the era — no dummies / zero-combat props. */
export function rogueUnitPool(period: Period): UnitType[] {
  const era = sanitizePeriod(period);
  return UNIT_TYPES.filter((t) => {
    const s = UNIT_STATS[t];
    if (!s || s.category !== era) return false;
    return s.recruitable;
  });
}

export function rogueUnitCost(type: UnitType): number {
  return Math.max(0, Math.floor(statsOf(type).value));
}

/**
 * Random recruitable kit. `maxValue` caps by combat value (battle + 1).
 * If the cap empties the pool, fall back to the cheapest kits in the era.
 */
export function pickRogueUnit(
  period: Period,
  avoid?: UnitType[],
  maxValue?: number,
): UnitType {
  const pool = rogueUnitPool(period);
  const underCap =
    maxValue == null
      ? pool
      : pool.filter((t) => statsOf(t).value <= maxValue);
  const base = underCap.length
    ? underCap
    : pool.length
      ? (() => {
          const lo = Math.min(...pool.map((t) => statsOf(t).value));
          return pool.filter((t) => statsOf(t).value === lo);
        })()
      : pool;
  const prefer = avoid?.length
    ? base.filter((t) => !avoid.includes(t))
    : base;
  const list = prefer.length ? prefer : base;
  if (!list.length) throw new Error(`No recruitable units for ${sanitizePeriod(period)}`);
  return list[Math.floor(Math.random() * list.length)]!;
}

/** The Knight chess piece for this era (stock: Scout). */
export function pickRogueKnight(period: Period): UnitType {
  const knights = rogueUnitPool(period).filter(
    (t) => statsOf(t).chess.toLowerCase() === 'knight',
  );
  if (knights.length) {
    return knights[Math.floor(Math.random() * knights.length)]!;
  }
  // Stock Knight kit — used even when the era catalog has no Knight chess label.
  if (UNIT_STATS.scout) return 'scout';
  return pickRogueUnit(period);
}

/** Three (or fewer) distinct random recruits for the victory shop. */
export function rollRogueShopOffers(
  period: Period,
  count = ROGUE_SHOP_SIZE,
  maxValue?: number,
): UnitType[] {
  const offers: UnitType[] = [];
  const n = Math.max(0, Math.floor(count));
  for (let i = 0; i < n; i++) {
    const pool = rogueUnitPool(period);
    if (!pool.length) break;
    offers.push(pickRogueUnit(period, offers, maxValue));
  }
  return offers;
}

/** Distinct random promotions for the victory shop (up to `count`). */
export function rollRoguePromotions(
  count = ROGUE_SHOP_SIZE,
): PromotionTokenType[] {
  // Shop never offers General — succession crowns that separately.
  const pool = PROMOTION_TOKEN_TYPES.filter((t) => t !== 'general');
  const out: PromotionTokenType[] = [];
  const n = Math.max(0, Math.min(Math.floor(count), pool.length));
  for (let i = 0; i < n; i++) {
    const j = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(j, 1)[0]!);
  }
  return out;
}

/** Victory shop — `starGold` is 1 per earned star this battle. Offers match the next battle's value cap. */
export function openRogueShop(
  run: RogueRun,
  starGold: number,
): { run: RogueRun; shop: RogueShop } {
  const gain = Math.max(0, Math.floor(starGold));
  const nextBattle = run.battle + 1;
  return {
    run: { ...run, gold: run.gold + gain },
    shop: {
      offers: rollRogueShopOffers(
        run.period,
        ROGUE_SHOP_SIZE,
        rogueMaxUnitValue(nextBattle),
      ),
      purchased: [],
      starGold: gain,
      promotions: rollRoguePromotions(),
      freePromoTaken: false,
    },
  };
}

const ENEMY_PROMO_POOL = PROMOTION_TOKEN_TYPES.filter(
  (t) => t !== 'general',
) as Exclude<PromotionTokenType, 'general'>[];

function stackableCount(unit: RogueUnit): number {
  return (unit.unitTokens ?? []).filter(isStackablePromotion).length;
}

/** Drop enemy stackable promos, then stamp `count` random ones (same unit can be hit twice). */
export function applyRogueEnemyPromotions(
  army: RogueUnit[],
  count: number,
): RogueUnit[] {
  const n = Math.max(0, Math.floor(count));
  const out: RogueUnit[] = army.map((u) => {
    const kept = (u.unitTokens ?? []).filter((t) => !isStackablePromotion(t));
    return kept.length ? { type: u.type, unitTokens: kept } : { type: u.type };
  });
  if (!n || !out.length || !ENEMY_PROMO_POOL.length) return out;
  for (let i = 0; i < n; i++) {
    const eligible = out
      .map((u, idx) => ({ u, idx }))
      .filter(({ u }) => stackableCount(u) < MAX_UNIT_PROMOTIONS);
    if (!eligible.length) break;
    const pick = eligible[Math.floor(Math.random() * eligible.length)]!;
    const promo =
      ENEMY_PROMO_POOL[Math.floor(Math.random() * ENEMY_PROMO_POOL.length)]!;
    const unitTokens = sanitizeUnitTokens([
      ...(pick.u.unitTokens ?? []),
      promo,
    ]);
    out[pick.idx] = { type: pick.u.type, unitTokens };
  }
  return out;
}

/**
 * Buy offer at index if affordable. Removes it from the shelf.
 * Returns null when the slot is gone or gold is short.
 */
export function buyRogueShopOffer(
  run: RogueRun,
  shop: RogueShop,
  index: number,
): { run: RogueRun; shop: RogueShop } | null {
  const type = shop.offers[index];
  if (type == null) return null;
  const cost = rogueUnitCost(type);
  if (run.gold < cost) return null;
  const offers = shop.offers.slice();
  offers.splice(index, 1);
  return {
    run: { ...run, gold: run.gold - cost },
    shop: {
      offers,
      purchased: [...shop.purchased, type],
      starGold: shop.starGold,
      promotions: shop.promotions,
      freePromoTaken: shop.freePromoTaken,
    },
  };
}

/** Cost to take the promotion at `index` (0 = still free). */
export function roguePromoCost(shop: RogueShop): number {
  return shop.freePromoTaken ? ROGUE_PROMO_COST : 0;
}

/**
 * Take promotion offer at index. First is free; later ones cost ROGUE_PROMO_COST.
 * Removes only that offer — extras stay for purchase.
 */
export function takeRoguePromotionOffer(
  run: RogueRun,
  shop: RogueShop,
  index: number,
): { run: RogueRun; shop: RogueShop; promo: PromotionTokenType } | null {
  const promo = shop.promotions[index];
  if (promo == null) return null;
  const cost = roguePromoCost(shop);
  if (run.gold < cost) return null;
  const promotions = shop.promotions.slice();
  promotions.splice(index, 1);
  return {
    run: cost ? { ...run, gold: run.gold - cost } : run,
    shop: {
      ...shop,
      promotions,
      freePromoTaken: true,
    },
    promo,
  };
}

/** Depth from a side's home edge (0 = rim). */
function edgeDepth(
  h: { col: number; row: number },
  side: Side,
  cols: number,
  rows: number,
): number {
  const edge = DEFAULT_ARMY_EDGE[side];
  if (edge === 'bottom') return rows - 1 - h.row;
  if (edge === 'top') return h.row;
  if (edge === 'left') return h.col;
  return cols - 1 - h.col;
}

function edgeAlong(
  h: { col: number; row: number },
  side: Side,
  cols: number,
  rows: number,
): number {
  const edge = DEFAULT_ARMY_EDGE[side];
  if (edge === 'bottom') return h.col;
  if (edge === 'top') return cols - 1 - h.col;
  if (edge === 'left') return h.row;
  return rows - 1 - h.row;
}

/** Pack an army onto the hex disk rim (centered on the first full-enough rank). */
function stampRogueArmy(
  units: RogueUnit[],
  side: Side,
  cols: number,
  rows: number,
  radius: number,
  center: { col: number; row: number },
): ArmyStamp[] {
  const onDisk = (h: { col: number; row: number }) =>
    distance(h, center, RANDOM_ORIENTATION) <= radius;
  const cells: { col: number; row: number; depth: number; along: number }[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const h = { col, row };
      if (!onDisk(h)) continue;
      cells.push({
        col,
        row,
        depth: edgeDepth(h, side, cols, rows),
        along: edgeAlong(h, side, cols, rows),
      });
    }
  }
  cells.sort((a, b) => a.depth - b.depth || a.along - b.along);

  const picked: { col: number; row: number }[] = [];
  let depth = cells[0]?.depth ?? 0;
  while (picked.length < units.length && depth < Math.max(cols, rows)) {
    const rank = cells
      .filter((c) => c.depth === depth)
      .sort((a, b) => a.along - b.along);
    const need = units.length - picked.length;
    if (rank.length >= need) {
      const start = Math.floor((rank.length - need) / 2);
      for (let i = 0; i < need; i++) {
        const c = rank[start + i]!;
        picked.push({ col: c.col, row: c.row });
      }
      break;
    }
    depth += 1;
  }
  // Overflow: keep taking next rim cells.
  if (picked.length < units.length) {
    for (const c of cells) {
      if (picked.some((p) => p.col === c.col && p.row === c.row)) continue;
      picked.push({ col: c.col, row: c.row });
      if (picked.length >= units.length) break;
    }
  }

  const facing = facingFromStamp({ side });
  const out: ArmyStamp[] = [];
  for (let i = 0; i < units.length; i++) {
    const u = units[i]!;
    const hex = picked[i];
    if (!hex) break;
    const packed = withStory(u.unitTokens, undefined);
    out.push({
      type: u.type,
      col: hex.col,
      row: hex.row,
      side,
      unitTokens: packed.unitTokens,
      facing: sanitizeStampFacing(side, facing),
    });
  }
  return out;
}

export function rogueArmyStamps(
  run: RogueRun,
  cols?: number,
  rows?: number,
  radius = ROGUE_HEX_RADIUS,
): ArmyStamp[] {
  const disk = rogueHexDisk(radius);
  const c = cols ?? disk.cols;
  const r = rows ?? disk.rows;
  return [
    ...stampRogueArmy(run.playerArmy, 'red', c, r, radius, disk.center),
    ...stampRogueArmy(run.enemyArmy, 'blue', c, r, radius, disk.center),
  ];
}

export function createRogueRun(period: Period, aiStyle: AiStyle = 'aggressive'): RogueRun {
  const battle = 1;
  const maxValue = rogueMaxUnitValue(battle);
  const playerArmy: RogueUnit[] = [];
  const enemyArmy: RogueUnit[] = [];
  // General always starts on the Knight (scout) — value cap does not apply.
  playerArmy.push({
    type: pickRogueKnight(period),
    unitTokens: ['general'],
  });
  while (playerArmy.length < ROGUE_START_COUNT) {
    playerArmy.push({
      type: pickRogueUnit(
        period,
        playerArmy.map((u) => u.type),
        maxValue,
      ),
    });
  }
  for (let i = 0; i < ROGUE_START_COUNT; i++) {
    enemyArmy.push({
      type: pickRogueUnit(
        period,
        enemyArmy.map((u) => u.type),
        maxValue,
      ),
    });
  }
  return {
    battle,
    period: sanitizePeriod(period),
    playerArmy,
    enemyArmy: applyRogueEnemyPromotions(
      enemyArmy,
      rogueEnemyPromoCount(battle),
    ),
    aiStyle,
    gold: ROGUE_START_GOLD,
  };
}

/** Tokens that should ride with a unit into the next battle. */
function carryTokens(piece: Piece): UnitTokenType[] | undefined {
  const tokens = unitTokensOf(piece).filter(isPromotionToken);
  return tokens.length ? tokens : undefined;
}

/** Living player pieces → army entries (board order). Empty = wipe. */
export function survivorUnits(
  pieces: Piece[],
  playerSide: 'red' | 'blue' = 'red',
): RogueUnit[] {
  return pieces
    .filter((p) => p.side === playerSide)
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map((p) => {
      const unitTokens = carryTokens(p);
      return unitTokens ? { type: p.type, unitTokens } : { type: p.type };
    });
}

/** Living player pieces → types only. */
export function survivorTypes(
  pieces: Piece[],
  playerSide: 'red' | 'blue' = 'red',
): UnitType[] {
  return survivorUnits(pieces, playerSide).map((u) => u.type);
}

/**
 * After a win + shop: keep living player units, append purchases,
 * enemy gains +1 random unit (value ≤ next battle + 1), re-stamp enemy promos,
 * next battle. Past battle 10 this keeps going until the player dies.
 * Returns null if the player has no survivors (shouldn't happen on a wipeout win).
 */
export function advanceRogueRun(
  run: RogueRun,
  livingPlayer: RogueUnit[],
  purchased: UnitType[] = [],
): RogueRun | null {
  if (!livingPlayer.length) return null;
  const battle = run.battle + 1;
  const maxValue = rogueMaxUnitValue(battle);
  const playerArmy = [
    ...livingPlayer,
    ...purchased.map((type): RogueUnit => ({ type })),
  ];
  const grown = [
    ...run.enemyArmy,
    {
      type: pickRogueUnit(
        run.period,
        run.enemyArmy.map((u) => u.type),
        maxValue,
      ),
    },
  ];
  return {
    ...run,
    battle,
    playerArmy,
    enemyArmy: applyRogueEnemyPromotions(
      grown,
      rogueEnemyPromoCount(battle),
    ),
  };
}

/** True after the player finishes the goal battle and opts out (UI clears the run). */
export function rogueRunComplete(run: RogueRun): boolean {
  return run.battle > ROGUE_GOAL;
}

export function rogueBattleLabel(run: RogueRun): string {
  if (run.battle > ROGUE_GOAL) return `Battle ${run.battle}`;
  return `Battle ${run.battle}/${ROGUE_GOAL}`;
}

export function rogueArmyHint(run: RogueRun): string {
  const you = run.playerArmy.map((u) => statsOf(u.type).name).join(', ');
  const them = run.enemyArmy.map((u) => statsOf(u.type).name).join(', ');
  return `You ${run.playerArmy.length} (${you}) · Enemy ${run.enemyArmy.length} (${them}) · ${run.gold}g`;
}
