/** Quick sanity for roguelite grow / prune / shop / hex map / succession. */
import {
  createRogueInitialState,
  ROGUE_HEX_RADIUS,
  rogueHexDisk,
} from '../src/map';
import {
  hasGeneral,
  hasUnitToken,
  maybeSucceedGeneral,
  passTurn,
  sanitizeUnitTokens,
} from '../src/engine';
import { distance } from '../src/hex';
import {
  ROGUE_GOAL,
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
  takeRoguePromotionOffer,
} from '../src/roguelite';

const period = 'ancient' as const;
const pool = rogueUnitPool(period);
if (pool.length < 4) throw new Error(`pool too small: ${pool.length}`);

const knight = pickRogueKnight(period);
if (knight !== 'scout') throw new Error(`expected scout knight, got ${knight}`);

let run = createRogueRun(period);
if (run.playerArmy.length !== ROGUE_START_COUNT) throw new Error('bad start player');
if (run.gold !== ROGUE_START_GOLD) throw new Error(`start gold should be ${ROGUE_START_GOLD}`);

const disk = rogueHexDisk(ROGUE_HEX_RADIUS);
const stamps = rogueArmyStamps(run);
let state = createRogueInitialState(undefined, stamps);
if (state.hexRadius !== ROGUE_HEX_RADIUS) {
  throw new Error(`hex radius ${state.hexRadius}`);
}
if (!state.hexCenter) throw new Error('missing hex center');

const red = state.pieces.filter((p) => p.side === 'red');
const blue = state.pieces.filter((p) => p.side === 'blue');
if (red.length !== ROGUE_START_COUNT) throw new Error(`red spawn ${red.length}`);
if (blue.length !== ROGUE_START_COUNT) throw new Error(`blue spawn ${blue.length}`);
for (const p of state.pieces) {
  if (distance(p, state.hexCenter, state.orientation) > state.hexRadius) {
    throw new Error(`piece off disk ${p.type} @${p.col},${p.row}`);
  }
}

const gen = red.find((p) => hasUnitToken(p, 'general'));
if (!gen) throw new Error('no general');
state.generalSuccession = true;
state.pieces = state.pieces.filter((p) => p.id !== gen.id);
state.casualties = { ...state.casualties, red: 1 };
if (state.turn === 'red') state = passTurn(state);
state = passTurn(state);
if (state.turn !== 'red') state = passTurn(state);
maybeSucceedGeneral(state, 'red');
if (!hasGeneral(state.pieces, 'red')) throw new Error('succession failed');

const living = survivorUnits(
  state.pieces.filter((p) => p.side === 'red'),
  'red',
);
const opened = openRogueShop(run, 2);
run = opened.run;
let shop = opened.shop;
if (run.gold !== ROGUE_START_GOLD + 2) throw new Error(`star gold ${run.gold}`);
if (shop.offers.length !== Math.min(ROGUE_SHOP_SIZE, pool.length)) {
  throw new Error(`shop size ${shop.offers.length}`);
}
if (shop.promotions.length !== Math.min(ROGUE_SHOP_SIZE, 5)) {
  throw new Error(`promo size ${shop.promotions.length}`);
}
if (new Set(shop.promotions).size !== shop.promotions.length) {
  throw new Error('promo offers not distinct');
}
{
  const taken = takeRoguePromotionOffer(shop, 0);
  if (!taken) throw new Error('take promo failed');
  shop = taken.shop;
  if (shop.promotions.length !== 2) throw new Error('promo shelf not consumed');
  const stamped = living.map((u, i) =>
    i === 0
      ? {
          ...u,
          unitTokens: sanitizeUnitTokens([...(u.unitTokens ?? []), taken.promo]),
        }
      : u,
  );
  if (!stamped[0]?.unitTokens?.includes(taken.promo)) {
    throw new Error('promo not stamped');
  }
  // Put promo back for the rest of the script — shelf already consumed is fine.
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
if (!next.playerArmy.some((u) => u.unitTokens?.includes('general'))) {
  throw new Error('general not carried');
}
if (next.enemyArmy.length !== 3) throw new Error(`enemy grow ${next.enemyArmy.length}`);

run = next;
for (let b = 2; b < ROGUE_GOAL; b++) {
  const adv = advanceRogueRun(run, run.playerArmy, []);
  if (!adv) throw new Error(`advance ${b}`);
  run = adv;
}
if (run.battle !== ROGUE_GOAL) throw new Error(`expected battle ${ROGUE_GOAL}, got ${run.battle}`);

console.log('roguelite ok', {
  pool: pool.length,
  disk: `${disk.cols}x${disk.rows} R${disk.radius}`,
  knight,
  bought,
  finalPlayer: run.playerArmy.length,
  finalEnemy: run.enemyArmy.length,
  battle: run.battle,
  gold: run.gold,
});
