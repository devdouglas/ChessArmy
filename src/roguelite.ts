/** Roguelite: randomised maps, growing armies, permanent player losses, 10 wins. */

import { statsOf, type AiStyle, type Piece, type UnitType } from './engine';
import { placeSlots, RANDOM_COLS, type ArmySlot, type ArmyStamp } from './map';
import { sanitizePeriod, type Period } from './period';
import { UNIT_STATS, UNIT_TYPES } from './roster';

export const ROGUE_GOAL = 10;
export const ROGUE_START_COUNT = 2;

export type RogueRun = {
  battle: number;
  period: Period;
  playerTypes: UnitType[];
  enemyTypes: UnitType[];
  aiStyle: AiStyle;
};

/** Combat kits for the era — no dummies / zero-combat props. */
export function rogueUnitPool(period: Period): UnitType[] {
  const era = sanitizePeriod(period);
  return UNIT_TYPES.filter((t) => {
    const s = UNIT_STATS[t];
    if (!s || s.category !== era) return false;
    if (t === 'dummy' || s.role === 'dummy') return false;
    return s.meleeDamage > 0 || s.shoot > 0 || s.charge > 0;
  });
}

export function pickRogueUnit(period: Period, avoid?: UnitType[]): UnitType {
  const pool = rogueUnitPool(period);
  const prefer = avoid?.length
    ? pool.filter((t) => !avoid.includes(t))
    : pool;
  const list = prefer.length ? prefer : pool;
  if (!list.length) {
    const fallback = UNIT_TYPES.find((t) => UNIT_STATS[t]?.category === sanitizePeriod(period));
    return fallback ?? 'soldier';
  }
  return list[Math.floor(Math.random() * list.length)]!;
}

/** Pack types onto back ranks, centered via placeSlots sourceCols. */
export function packRogueSlots(types: UnitType[], width = RANDOM_COLS): ArmySlot[] {
  const w = Math.max(1, Math.min(width, RANDOM_COLS));
  return types.map((type, i) => ({
    type,
    col: i % w,
    fromBack: Math.floor(i / w),
  }));
}

export function rogueArmyStamps(run: RogueRun, cols: number, rows: number): ArmyStamp[] {
  const width = Math.min(cols, RANDOM_COLS);
  return [
    ...placeSlots(packRogueSlots(run.playerTypes, width), 'red', cols, rows, width),
    ...placeSlots(packRogueSlots(run.enemyTypes, width), 'blue', cols, rows, width),
  ];
}

export function createRogueRun(period: Period, aiStyle: AiStyle = 'aggressive'): RogueRun {
  const playerTypes: UnitType[] = [];
  const enemyTypes: UnitType[] = [];
  for (let i = 0; i < ROGUE_START_COUNT; i++) {
    playerTypes.push(pickRogueUnit(period, playerTypes));
    enemyTypes.push(pickRogueUnit(period, enemyTypes));
  }
  return {
    battle: 1,
    period: sanitizePeriod(period),
    playerTypes,
    enemyTypes,
    aiStyle,
  };
}

/** Living player pieces → types (board order). Empty = wipe. */
export function survivorTypes(pieces: Piece[], playerSide: 'red' | 'blue' = 'red'): UnitType[] {
  return pieces
    .filter((p) => p.side === playerSide)
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map((p) => p.type);
}

/**
 * After a win: keep living player types, both sides gain +1 random unit, next battle.
 * Returns null if the player has no survivors (shouldn't happen on a wipeout win).
 */
export function advanceRogueRun(run: RogueRun, livingPlayer: UnitType[]): RogueRun | null {
  if (!livingPlayer.length) return null;
  const playerTypes = [...livingPlayer, pickRogueUnit(run.period, livingPlayer)];
  const enemyTypes = [...run.enemyTypes, pickRogueUnit(run.period, run.enemyTypes)];
  return {
    ...run,
    battle: run.battle + 1,
    playerTypes,
    enemyTypes,
  };
}

export function rogueRunComplete(run: RogueRun): boolean {
  return run.battle > ROGUE_GOAL;
}

export function rogueBattleLabel(run: RogueRun): string {
  return `Battle ${Math.min(run.battle, ROGUE_GOAL)}/${ROGUE_GOAL}`;
}

export function rogueArmyHint(run: RogueRun): string {
  const you = run.playerTypes.map((t) => statsOf(t).name).join(', ');
  const them = run.enemyTypes.map((t) => statsOf(t).name).join(', ');
  return `You ${run.playerTypes.length} (${you}) · Enemy ${run.enemyTypes.length} (${them})`;
}
