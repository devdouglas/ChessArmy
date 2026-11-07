/** Quick sanity for roguelite grow / prune / stamps. */
import { createInitialState, DEFAULT_MAP, RANDOM_COLS, ROWS } from '../src/map';
import {
  ROGUE_GOAL,
  ROGUE_START_COUNT,
  advanceRogueRun,
  createRogueRun,
  rogueArmyStamps,
  rogueUnitPool,
  survivorTypes,
} from '../src/roguelite';

const period = 'ancient' as const;
const pool = rogueUnitPool(period);
if (pool.length < 4) throw new Error(`pool too small: ${pool.length}`);

let run = createRogueRun(period);
if (run.playerTypes.length !== ROGUE_START_COUNT) throw new Error('bad start player');
if (run.enemyTypes.length !== ROGUE_START_COUNT) throw new Error('bad start enemy');

const stamps = rogueArmyStamps(run, RANDOM_COLS, ROWS);
const state = createInitialState(DEFAULT_MAP, stamps);
const red = state.pieces.filter((p) => p.side === 'red');
const blue = state.pieces.filter((p) => p.side === 'blue');
if (red.length !== ROGUE_START_COUNT) throw new Error(`red spawn ${red.length}`);
if (blue.length !== ROGUE_START_COUNT) throw new Error(`blue spawn ${blue.length}`);

// Simulate a win with one casualty
const living = survivorTypes(red.slice(0, 1), 'red');
const next = advanceRogueRun(run, living);
if (!next) throw new Error('advance failed');
if (next.playerTypes.length !== 2) throw new Error(`player after loss+recruit ${next.playerTypes.length}`);
if (next.enemyTypes.length !== 3) throw new Error(`enemy grow ${next.enemyTypes.length}`);
if (next.battle !== 2) throw new Error('battle not 2');

// Climb to goal size
run = next;
for (let b = 2; b < ROGUE_GOAL; b++) {
  const adv = advanceRogueRun(run, run.playerTypes);
  if (!adv) throw new Error(`advance ${b}`);
  run = adv;
}
if (run.battle !== ROGUE_GOAL) throw new Error(`expected battle ${ROGUE_GOAL}, got ${run.battle}`);
if (run.enemyTypes.length !== ROGUE_START_COUNT + (ROGUE_GOAL - 1)) {
  throw new Error(`enemy size ${run.enemyTypes.length}`);
}

console.log('roguelite ok', {
  pool: pool.length,
  finalPlayer: run.playerTypes.length,
  finalEnemy: run.enemyTypes.length,
  battle: run.battle,
});
