/** Roguelite: randomised maps, shop recruits, permanent player losses, 10 wins. */

import {
  statsOf,
  unitTokensOf,
  withStory,
  type AiStyle,
  type Piece,
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

/** Victory shop — `starGold` is 1 per earned star this battle. */
export function openRogueShop(
  run: RogueRun,
  starGold: number,
): { run: RogueRun; shop: RogueShop } {
  const gain = Math.max(0, Math.floor(starGold));
  return {
    run: { ...run, gold: run.gold + gain },
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
