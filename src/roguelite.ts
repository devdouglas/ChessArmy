/** Roguelite: randomised maps, shop recruits, permanent player losses, 10 wins. */

import {
  statsOf,
  unitTokensOf,
  type AiStyle,
  type Piece,
  type UnitTokenType,
  type UnitType,
} from './engine';
import { placeSlots, RANDOM_COLS, type ArmySlot, type ArmyStamp } from './map';
import { sanitizePeriod, type Period } from './period';
import { UNIT_STATS, UNIT_TYPES } from './roster';

export const ROGUE_GOAL = 10;
export const ROGUE_START_COUNT = 2;
export const ROGUE_GOLD_PER_WIN = 1;
export const ROGUE_START_GOLD = 2;
export const ROGUE_SHOP_SIZE = 3;

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

/** Open post-victory shop (offers rolled once per win). */
export type RogueShop = {
  offers: UnitType[];
  /** Units bought this shop, queued onto the next army. */
  purchased: UnitType[];
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

export function pickRogueUnit(period: Period, avoid?: UnitType[]): UnitType {
  const pool = rogueUnitPool(period);
  const prefer = avoid?.length
    ? pool.filter((t) => !avoid.includes(t))
    : pool;
  const list = prefer.length ? prefer : pool;
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
): UnitType[] {
  const offers: UnitType[] = [];
  const n = Math.max(0, Math.floor(count));
  for (let i = 0; i < n; i++) {
    const pool = rogueUnitPool(period);
    if (!pool.length) break;
    offers.push(pickRogueUnit(period, offers));
  }
  return offers;
}

export function openRogueShop(run: RogueRun): { run: RogueRun; shop: RogueShop } {
  return {
    run: { ...run, gold: run.gold + ROGUE_GOLD_PER_WIN },
    shop: {
      offers: rollRogueShopOffers(run.period),
      purchased: [],
    },
  };
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
    },
  };
}

/** Pack units onto back ranks, centered via placeSlots sourceCols. */
export function packRogueSlots(units: RogueUnit[], width = RANDOM_COLS): ArmySlot[] {
  const w = Math.max(1, Math.min(width, RANDOM_COLS));
  return units.map((u, i) => {
    const fromBack = Math.floor(i / w);
    const rankStart = fromBack * w;
    const rankCount = Math.min(w, units.length - rankStart);
    const centerOffset = Math.floor((w - rankCount) / 2);
    return {
      type: u.type,
      col: centerOffset + (i % w),
      fromBack,
      unitTokens: u.unitTokens,
    };
  });
}

export function rogueArmyStamps(run: RogueRun, cols: number, rows: number): ArmyStamp[] {
  const width = Math.min(cols, RANDOM_COLS);
  return [
    ...placeSlots(packRogueSlots(run.playerArmy, width), 'red', cols, rows, width),
    ...placeSlots(packRogueSlots(run.enemyArmy, width), 'blue', cols, rows, width),
  ];
}

export function createRogueRun(period: Period, aiStyle: AiStyle = 'aggressive'): RogueRun {
  const playerArmy: RogueUnit[] = [];
  const enemyArmy: RogueUnit[] = [];
  // General always starts on the Knight (scout).
  playerArmy.push({
    type: pickRogueKnight(period),
    unitTokens: ['general'],
  });
  while (playerArmy.length < ROGUE_START_COUNT) {
    playerArmy.push({
      type: pickRogueUnit(
        period,
        playerArmy.map((u) => u.type),
      ),
    });
  }
  for (let i = 0; i < ROGUE_START_COUNT; i++) {
    enemyArmy.push({
      type: pickRogueUnit(
        period,
        enemyArmy.map((u) => u.type),
      ),
    });
  }
  return {
    battle: 1,
    period: sanitizePeriod(period),
    playerArmy,
    enemyArmy,
    aiStyle,
    gold: ROGUE_START_GOLD,
  };
}

/** Tokens that should ride with a unit into the next battle. */
function carryTokens(piece: Piece): UnitTokenType[] | undefined {
  const tokens = unitTokensOf(piece).filter((t) => t === 'general');
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
 * enemy gains +1 random unit, next battle.
 * Returns null if the player has no survivors (shouldn't happen on a wipeout win).
 */
export function advanceRogueRun(
  run: RogueRun,
  livingPlayer: RogueUnit[],
  purchased: UnitType[] = [],
): RogueRun | null {
  if (!livingPlayer.length) return null;
  const playerArmy = [
    ...livingPlayer,
    ...purchased.map((type): RogueUnit => ({ type })),
  ];
  const enemyArmy = [
    ...run.enemyArmy,
    {
      type: pickRogueUnit(
        run.period,
        run.enemyArmy.map((u) => u.type),
      ),
    },
  ];
  return {
    ...run,
    battle: run.battle + 1,
    playerArmy,
    enemyArmy,
  };
}

export function rogueRunComplete(run: RogueRun): boolean {
  return run.battle > ROGUE_GOAL;
}

export function rogueBattleLabel(run: RogueRun): string {
  return `Battle ${Math.min(run.battle, ROGUE_GOAL)}/${ROGUE_GOAL}`;
}

export function rogueArmyHint(run: RogueRun): string {
  const you = run.playerArmy.map((u) => statsOf(u.type).name).join(', ');
  const them = run.enemyArmy.map((u) => statsOf(u.type).name).join(', ');
  return `You ${run.playerArmy.length} (${you}) · Enemy ${run.enemyArmy.length} (${them}) · ${run.gold}g`;
}
