import {
  applyAction,
  canTrap,
  javelinIsSpecial,
  hasAbility,
  legalHighlights,
  tokenOnHex,
  UNIT_STATS,
} from '../src/engine';
import { defaultFacing, neighborInDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(UNIT_STATS.barbarian.abilities.includes('hide'), 'barbarian hide');
assert(UNIT_STATS.barbarian.abilities.includes('charge'), 'barbarian charge');
assert(UNIT_STATS.cohort.abilities.includes('javelin'), 'cohort javelin');
assert(UNIT_STATS.hoplite.abilities.includes('trap'), 'hoplite trap');
assert(UNIT_STATS.general.king, 'general king kit');
assert(UNIT_STATS.general.abilities.length === 0, 'general ability gone');
assert(UNIT_STATS.tank.abilities.includes('charge'), 'tank charge');
assert(UNIT_STATS.cohort.meleeDamage > 0 && UNIT_STATS.cohort.shoot > 0, 'cohort is melee+shoot');

{
  const s = createStateFromTerrain(emptyTerrain(8, 8), 'specials', 'pointy', [
    { type: 'cohort', col: 2, row: 4, side: 'red' },
    { type: 'soldier', col: 3, row: 4, side: 'blue' },
    { type: 'general', col: 0, row: 4, side: 'red' },
    { type: 'general', col: 7, row: 4, side: 'blue' },
  ]);
  s.turn = 'red';
  const cohort = s.pieces.find((p) => p.type === 'cohort')!;
  assert(javelinIsSpecial(cohort), 'cohort javelin is a special');
  assert(hasAbility(cohort, 'javelin'), 'javelin listed');
  assert(
    legalHighlights(s, cohort.id).some((h) => h.kind === 'shoot'),
    'engine still lists shoot (player UI gates it)',
  );
}

{
  const s = createStateFromTerrain(emptyTerrain(8, 8), 'trap', 'pointy', [
    { type: 'hoplite', col: 3, row: 4, side: 'red' },
    { type: 'general', col: 0, row: 4, side: 'red' },
    { type: 'general', col: 7, row: 4, side: 'blue' },
  ]);
  s.turn = 'red';
  const hop = s.pieces.find((p) => p.type === 'hoplite')!;
  hop.facing = defaultFacing('red');
  const front = neighborInDir({ col: hop.col, row: hop.row }, hop.facing, s.orientation);
  assert(canTrap(s, hop.id), 'hoplite can trap');
  const after = applyAction(s, { kind: 'trap', pieceId: hop.id });
  assert(tokenOnHex(after.tokens, front, 'pikes'), 'pikes land on the faced hex');
  const used = after.pieces.find((p) => p.id === hop.id)!;
  assert(!canTrap(after, used.id), 'trap spends the activation');
}

{
  const t = emptyTerrain(10, 8);
  for (let row = 0; row < 8; row++) {
    if (row === 4) continue;
    for (let col = 0; col < 10; col++) t[row][col] = 'rock';
  }
  const s = createStateFromTerrain(t, 'no-charge', 'pointy', [
    { type: 'tank', col: 1, row: 4, side: 'red' },
    { type: 'soldier', col: 2, row: 4, side: 'blue' },
    { type: 'general', col: 0, row: 4, side: 'red' },
    { type: 'general', col: 8, row: 4, side: 'blue' },
  ]);
  s.turn = 'red';
  const tank = s.pieces.find((p) => p.type === 'tank')!;
  tank.staminaUsedThisTurn = true;
  assert(
    !legalHighlights(s, tank.id).some((h) => h.kind === 'charge'),
    'spent energy blocks charge dests',
  );
}

console.log('specials: hide/javelin/charge/trap catalog and engine actions');
