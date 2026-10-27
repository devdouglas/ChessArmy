import { hasUnitToken, staminaLeft, staminaMax } from '../src/engine';
import { createStateFromTerrain, emptyTerrain } from '../src/map';
import { UNIT_STATS } from '../src/roster';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const s = createStateFromTerrain(emptyTerrain(8, 10), 'exhausted', 'pointy', [
  { type: 'soldier', col: 3, row: 2, side: 'red', unitTokens: ['exhausted'] },
  {
    type: 'soldier',
    col: 4,
    row: 2,
    side: 'red',
    unitTokens: ['general', 'exhausted'],
  },
  { type: 'soldier', col: 5, row: 2, side: 'red' },
  { type: 'general', col: 1, row: 1, side: 'red' },
  { type: 'soldier', col: 3, row: 8, side: 'blue' },
  { type: 'general', col: 1, row: 9, side: 'blue' },
]);

const tired = s.pieces.find((p) => p.side === 'red' && p.col === 3)!;
const starred = s.pieces.find((p) => p.side === 'red' && p.col === 4)!;
const plain = s.pieces.find((p) => p.side === 'red' && p.col === 5)!;

assert(hasUnitToken(tired, 'exhausted'), 'token stamped');
assert(staminaMax(tired) === UNIT_STATS.soldier.stamina, 'max unchanged');
assert(staminaLeft(tired) === 0, 'kickoff stamina is 0');
assert(staminaMax(starred) === UNIT_STATS.soldier.stamina + 1, 'general still +1 max');
assert(staminaLeft(starred) === 0, 'general+exhausted still starts empty');
assert(staminaLeft(plain) === staminaMax(plain), 'unstamped soldier is full');

console.log('exhausted: kickoff stamina is 0; max and general bonus stay');
