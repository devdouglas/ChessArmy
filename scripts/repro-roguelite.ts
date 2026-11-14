/** Quick sanity for roguelite grow / prune / shop / stamps. */
import { createInitialState, DEFAULT_MAP, RANDOM_COLS, RANDOM_ROWS } from '../src/map';
import { hasUnitToken } from '../src/engine';
import { UNIT_STATS } from '../src/roster';
import {
  ROGUE_GOAL,
  ROGUE_GOLD_PER_WIN,
  ROGUE_SHOP_SIZE,
  ROGUE_START_COUNT,
  ROGUE_START_GOLD,
  advanceRogueRun,
  buyRogueShopOffer,
  createRogueRun,
  openRogueShop,
  pickRogueKnight,
  rogueArmyStamps,
  rogueUnitCost,
  rogueUnitPool,
  survivorUnits,
} from '../src/roguelite';

const period = 'ancient' as const;
const pool = rogueUnitPool(period);
if (pool.length < 4) throw new Error(`pool too small: ${pool.length}`);

const knight = pickRogueKnight(period);
if (knight !== 'scout') throw new Error(`expected scout knight, got ${knight}`);
if (UNIT_STATS[knight].chess !== 'Knight') throw new Error('scout is not Knight');

let run = createRogueRun(period);
if (run.playerArmy.length !== ROGUE_START_COUNT) throw new Error('bad start player');
if (run.enemyArmy.length !== ROGUE_START_COUNT) throw new Error('bad start enemy');
if (run.gold !== ROGUE_START_GOLD) throw new Error(`start gold should be ${ROGUE_START_GOLD}`);
if (run.playerArmy[0]?.type !== 'scout') throw new Error('general not on knight/scout');
if (!run.playerArmy[0]?.unitTokens?.includes('general')) {
  throw new Error('scout missing general token');
}

const stamps = rogueArmyStamps(run, RANDOM_COLS, RANDOM_ROWS);
const state = createInitialState(DEFAULT_MAP, stamps);
const red = state.pieces.filter((p) => p.side === 'red');
const blue = state.pieces.filter((p) => p.side === 'blue');
if (red.length !== ROGUE_START_COUNT) throw new Error(`red spawn ${red.length}`);
if (blue.length !== ROGUE_START_COUNT) throw new Error(`blue spawn ${blue.length}`);
const horsePiece = red.find((p) => p.type === 'scout');
if (!horsePiece || !hasUnitToken(horsePiece, 'general')) {
  throw new Error('spawned knight lacks general');
}

const living = survivorUnits(
  red.filter((p) => p.type === 'scout'),
  'red',
);
const opened = openRogueShop(run);
run = opened.run;
let shop = opened.shop;
if (run.gold !== ROGUE_START_GOLD + ROGUE_GOLD_PER_WIN) {
  throw new Error('gold not granted');
}
if (shop.offers.length !== Math.min(ROGUE_SHOP_SIZE, pool.length)) {
  throw new Error(`shop size ${shop.offers.length}`);
}

let bought = 0;
for (;;) {
  const idx = shop.offers.findIndex((t) => rogueUnitCost(t) <= run.gold);
  if (idx < 0) break;
  const nextBuy = buyRogueShopOffer(run, shop, idx);
  if (!nextBuy) throw new Error('buy failed');
  run = nextBuy.run;
  shop = nextBuy.shop;
  bought++;
}

const next = advanceRogueRun(run, living, shop.purchased);
if (!next) throw new Error('advance failed');
if (next.playerArmy.length !== 1 + bought) {
  throw new Error(`player after loss+shop ${next.playerArmy.length}`);
}
if (!next.playerArmy[0]?.unitTokens?.includes('general')) {
  throw new Error('general not carried');
}
if (next.enemyArmy.length !== 3) throw new Error(`enemy grow ${next.enemyArmy.length}`);
if (next.battle !== 2) throw new Error('battle not 2');

run = next;
for (let b = 2; b < ROGUE_GOAL; b++) {
  const adv = advanceRogueRun(run, run.playerArmy, []);
  if (!adv) throw new Error(`advance ${b}`);
  run = adv;
}
if (run.battle !== ROGUE_GOAL) throw new Error(`expected battle ${ROGUE_GOAL}, got ${run.battle}`);
if (run.enemyArmy.length !== ROGUE_START_COUNT + (ROGUE_GOAL - 1)) {
  throw new Error(`enemy size ${run.enemyArmy.length}`);
}

const modern = createRogueRun('modern');
if (modern.playerArmy[0]?.type !== 'scout') throw new Error('modern knight not scout');
if (!modern.playerArmy[0]?.unitTokens?.includes('general')) {
  throw new Error('modern knight missing general');
}

console.log('roguelite ok', {
  pool: pool.length,
  knight,
  bought,
  finalPlayer: run.playerArmy.length,
  finalEnemy: run.enemyArmy.length,
  battle: run.battle,
  gold: run.gold,
});
