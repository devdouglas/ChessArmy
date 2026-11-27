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
import {
  configuredUnitCost,
  getRogueConfig,
  getRogueProgress,
  promoAvailableInRun,
  unitAvailableInRun,
} from './roguelite-config';

export const ROGUE_GOAL = 10;
/** Enemy / shop kits: value must be ≤ battle + this. Battle 4 → value ≤ 5. */
export const ROGUE_VALUE_SLACK = 1;
/** First battle where enemies receive promotions. */
export const ROGUE_PROMO_START = 7;
export const ROGUE_START_COUNT = 2;
/** Gold at run start. Battles pay 1g per earned star. */
export const ROGUE_START_GOLD = 0;
export const ROGUE_SHOP_SIZE = 3;
/** Map regenerates granted per Scout promotion-unit at battle start. */
export const ROGUE_SCOUT_REGEN_PER = 2;
/** Roguelite star copy (win / general lives / no losses). */
export const ROGUE_STAR_LABELS = [
  'Win',
  'General survives',
  'No units lost',
] as const;

/** Live values from the roguelite config (seeded to the constants above). */
export function rogueGoal(): number {
  return getRogueConfig().globals.goalBattles;
}
export function rogueStartGold(): number {
  return getRogueConfig().globals.startGold;
}
export function rogueStartCount(): number {
  return getRogueConfig().globals.startCount;
}
export function rogueShopSize(): number {
  return getRogueConfig().globals.shopSize;
}
export function roguePromoGold(): number {
  return getRogueConfig().globals.promoCost;
}
export function rogueScoutRegenPer(): number {
  return getRogueConfig().globals.scoutRegenPer;
}

/** Max recruitable kit value for this battle number. */
export function rogueMaxUnitValue(battle: number): number {
  return Math.max(0, Math.floor(battle)) + getRogueConfig().globals.valueSlack;
}

/** How many random enemy promotions to stamp for this battle (0 before L7). */
export function rogueEnemyPromoCount(battle: number): number {
  const b = Math.max(0, Math.floor(battle));
  const start = getRogueConfig().globals.enemyPromoStart;
  return Math.max(0, b - (start - 1));
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
  /** Gold from Wealthy promotions on living player units. */
  wealthyGold: number;
  /** Promotion choices — first take free, extras cost ROGUE_PROMO_COST each. */
  promotions: PromotionTokenType[];
  /** True after the free promotion has been claimed this shop. */
  freePromoTaken: boolean;
};

/**
 * Combat kits for the era that the config lists for this purpose.
 * `battle` is the upcoming fight (shop after battle N uses N+1).
 */
export function rogueUnitPool(
  period: Period,
  purpose: 'shop' | 'start' | 'enemy' = 'shop',
  battle = 1,
): UnitType[] {
  const era = sanitizePeriod(period);
  const progress = getRogueProgress();
  return UNIT_TYPES.filter((t) => {
    const s = UNIT_STATS[t];
    if (!s || s.category !== era) return false;
    return unitAvailableInRun(t, battle, purpose, progress);
  });
}

export function rogueUnitCost(type: UnitType): number {
  return configuredUnitCost(type);
}

/**
 * Random recruitable kit. `maxValue` caps by combat value (battle + 1).
 * If the cap empties the pool, fall back to the cheapest kits in the era.
 */
export function pickRogueUnit(
  period: Period,
  avoid?: UnitType[],
  maxValue?: number,
  purpose: 'shop' | 'start' | 'enemy' = 'shop',
  battle = 1,
): UnitType {
  const pool = rogueUnitPool(period, purpose, battle);
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

/** The Knight chess piece for this era. Falls back to the configured general kit (stock: Scout). */
export function pickRogueKnight(period: Period): UnitType {
  const knights = rogueUnitPool(period, 'start', 1).filter(
    (t) => statsOf(t).chess.toLowerCase() === 'knight',
  );
  if (knights.length) {
    return knights[Math.floor(Math.random() * knights.length)]!;
  }
  // Stock / configured kit — used even when the era catalog has no Knight chess label.
  const kit = getRogueConfig().globals.startGeneralKit;
  if (kit && UNIT_STATS[kit]) return kit;
  if (UNIT_STATS.scout) return 'scout';
  return pickRogueUnit(period, undefined, undefined, 'start', 1);
}

/** Three (or fewer) distinct random recruits for the victory shop. */
export function rollRogueShopOffers(
  period: Period,
  count = rogueShopSize(),
  maxValue?: number,
  battle = 1,
): UnitType[] {
  const offers: UnitType[] = [];
  const n = Math.max(0, Math.floor(count));
  for (let i = 0; i < n; i++) {
    const pool = rogueUnitPool(period, 'shop', battle);
    if (!pool.length) break;
    offers.push(pickRogueUnit(period, offers, maxValue, 'shop', battle));
  }
  return offers;
}

/** Distinct random promotions for the victory shop (up to `count`). */
export function rollRoguePromotions(
  count = rogueShopSize(),
  battle = 1,
): PromotionTokenType[] {
  const progress = getRogueProgress();
  const pool = PROMOTION_TOKEN_TYPES.filter((t) =>
    promoAvailableInRun(t, battle, 'shop', progress),
  );
  const out: PromotionTokenType[] = [];
  const n = Math.max(0, Math.min(Math.floor(count), pool.length));
  for (let i = 0; i < n; i++) {
    const j = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(j, 1)[0]!);
  }
  return out;
}

/**
 * Victory shop — `starGold` is 1 per earned star; `wealthyGold` is +1 per
 * Wealthy chevron on living player units. Offers match the next battle's value cap.
 */
export function openRogueShop(
  run: RogueRun,
  starGold: number,
  wealthyGold = 0,
): { run: RogueRun; shop: RogueShop } {
  const stars = Math.max(0, Math.floor(starGold));
  const wealth = Math.max(0, Math.floor(wealthyGold));
  const g = getRogueConfig().globals;
  const gain = stars * g.starGoldPerStar + wealth * g.wealthyGoldPer;
  const nextBattle = run.battle + 1;
  return {
    run: { ...run, gold: run.gold + gain },
    shop: {
      offers: rollRogueShopOffers(
        run.period,
        g.shopSize,
        rogueMaxUnitValue(nextBattle),
        nextBattle,
      ),
      purchased: [],
      starGold: stars * g.starGoldPerStar,
      wealthyGold: wealth * g.wealthyGoldPer,
      promotions: rollRoguePromotions(g.shopSize, nextBattle),
      freePromoTaken: false,
    },
  };
}

function enemyPromoPool(battle: number): Exclude<PromotionTokenType, 'general'>[] {
  const progress = getRogueProgress();
  return PROMOTION_TOKEN_TYPES.filter((t) =>
    promoAvailableInRun(t, battle, 'enemy', progress),
  ) as Exclude<PromotionTokenType, 'general'>[];
}

function stackableCount(unit: RogueUnit): number {
  return (unit.unitTokens ?? []).filter(isStackablePromotion).length;
}

/** Drop enemy stackable promos, then stamp `count` random ones (same unit can be hit twice). */
export function applyRogueEnemyPromotions(
  army: RogueUnit[],
  count: number,
  battle = 999,
): RogueUnit[] {
  const n = Math.max(0, Math.floor(count));
  const pool = enemyPromoPool(battle);
  const out: RogueUnit[] = army.map((u) => {
    const kept = (u.unitTokens ?? []).filter((t) => !isStackablePromotion(t));
    return kept.length ? { type: u.type, unitTokens: kept } : { type: u.type };
  });
  if (!n || !out.length || !pool.length) return out;
  for (let i = 0; i < n; i++) {
    const eligible = out
      .map((u, idx) => ({ u, idx }))
      .filter(({ u }) => stackableCount(u) < MAX_UNIT_PROMOTIONS);
    if (!eligible.length) break;
    const pick = eligible[Math.floor(Math.random() * eligible.length)]!;
    const promo =
      pool[Math.floor(Math.random() * pool.length)]!;
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
      wealthyGold: shop.wealthyGold,
      promotions: shop.promotions,
      freePromoTaken: shop.freePromoTaken,
    },
  };
}

/** Cost to take the promotion at `index` (0 = still free). */
export function roguePromoCost(shop: RogueShop): number {
  if (!shop.freePromoTaken && getRogueConfig().globals.firstPromoFree) return 0;
  return getRogueConfig().globals.promoCost;
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
  const startCount = getRogueConfig().globals.startCount;
  while (playerArmy.length < startCount) {
    playerArmy.push({
      type: pickRogueUnit(
        period,
        playerArmy.map((u) => u.type),
        maxValue,
        'start',
        battle,
      ),
    });
  }
  for (let i = 0; i < startCount; i++) {
    enemyArmy.push({
      type: pickRogueUnit(
        period,
        enemyArmy.map((u) => u.type),
        maxValue,
        'enemy',
        battle,
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
      battle,
    ),
    aiStyle,
    gold: getRogueConfig().globals.startGold,
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
        'enemy',
        battle,
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
      battle,
    ),
  };
}

/** True after the player finishes the goal battle and opts out (UI clears the run). */
export function rogueRunComplete(run: RogueRun): boolean {
  return run.battle > getRogueConfig().globals.goalBattles;
}

export function rogueBattleLabel(run: RogueRun): string {
  const goal = getRogueConfig().globals.goalBattles;
  if (run.battle > goal) return `Battle ${run.battle}`;
  return `Battle ${run.battle}/${goal}`;
}

export function rogueArmyHint(run: RogueRun): string {
  const you = run.playerArmy.map((u) => statsOf(u.type).name).join(', ');
  const them = run.enemyArmy.map((u) => statsOf(u.type).name).join(', ');
  return `You ${run.playerArmy.length} (${you}) · Enemy ${run.enemyArmy.length} (${them}) · ${run.gold}g`;
}
