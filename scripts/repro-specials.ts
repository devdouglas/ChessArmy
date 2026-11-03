import {
  applyAction,
  canTrap,
  getPiece,
  javelinIsSpecial,
  hasAbility,
  hasActed,
  hpLeft,
  legalHighlights,
  staminaLeft,
  tokenOnHex,
  trapSpots,
  UNIT_STATS,
} from '../src/engine';
import { defaultFacing, neighborInDir, type HexDir } from '../src/hex';
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
  const spots = trapSpots(s, hop);
  assert(spots.length === 6, `every step direction is a trap spot, got ${spots.length}`);
  assert(
    legalHighlights(s, hop.id).filter((h) => h.kind === 'trap').length === 6,
    'trap spots are highlighted',
  );
  const side = spots.find((h) => h.col !== front.col || h.row !== front.row)!;
  const after = applyAction(s, { kind: 'trap', pieceId: hop.id, to: side });
  assert(tokenOnHex(after.tokens, side, 'pikes'), 'pikes land on the chosen hex');
  assert(!tokenOnHex(after.tokens, front, 'pikes'), 'the faced hex stays empty');
  assert(after.staminaBonus, 'first trap with energy left arms the second action');
  assert(canTrap(after, hop.id), 'trap stays available for the second action');
  assert(!hasActed(after, hop.id), 'first trap does not finish while energy remains');

  const clearBoard = createStateFromTerrain(emptyTerrain(8, 8), 'trap-clear', 'pointy', [
    { type: 'hoplite', col: 3, row: 4, side: 'red' },
    { type: 'general', col: 0, row: 4, side: 'red' },
    { type: 'general', col: 7, row: 4, side: 'blue' },
  ]);
  clearBoard.turn = 'red';
  clearBoard.tokens = [{ type: 'pikes', col: side.col, row: side.row }];
  const clearer = clearBoard.pieces.find((p) => p.type === 'hoplite')!;
  clearer.facing = hop.facing;
  assert(
    trapSpots(clearBoard, clearer).some((h) => h.col === side.col && h.row === side.row),
    'existing pikes stay a trap spot',
  );
  const cleared = applyAction(clearBoard, { kind: 'trap', pieceId: clearer.id, to: side });
  assert(!tokenOnHex(cleared.tokens, side, 'pikes'), 'trap clears pikes on the chosen hex');

  const immune = createStateFromTerrain(emptyTerrain(8, 8), 'trap-immune', 'pointy', [
    { type: 'hoplite', col: 3, row: 4, side: 'red' },
    { type: 'general', col: 0, row: 4, side: 'red' },
    { type: 'general', col: 7, row: 4, side: 'blue' },
  ]);
  immune.turn = 'red';
  const walker = immune.pieces.find((p) => p.type === 'hoplite')!;
  walker.facing = hop.facing;
  const step = neighborInDir({ col: walker.col, row: walker.row }, walker.facing, immune.orientation);
  immune.tokens = [{ type: 'pikes', col: step.col, row: step.row }];
  const hpBefore = hpLeft(walker);
  const walked = applyAction(immune, { kind: 'move', pieceId: walker.id, to: step });
  const afterWalk = walked.pieces.find((p) => p.id === walker.id)!;
  assert(hpLeft(afterWalk) === hpBefore, 'trap units ignore pikes when walking onto them');
  assert(
    afterWalk.col === step.col && afterWalk.row === step.row,
    'trap unit still walks onto the pike hex',
  );

  const second = createStateFromTerrain(emptyTerrain(8, 8), 'trap-second', 'pointy', [
    { type: 'hoplite', col: 3, row: 4, side: 'red' },
    { type: 'general', col: 0, row: 4, side: 'red' },
    { type: 'general', col: 7, row: 4, side: 'blue' },
  ]);
  second.turn = 'red';
  second.unitsPerTurn = 1;
  const hopper = second.pieces.find((p) => p.type === 'hoplite')!;
  hopper.facing = hop.facing;
  const firstStep = neighborInDir(
    { col: hopper.col, row: hopper.row },
    ((hopper.facing + 1) % 6) as HexDir,
    second.orientation,
  );
  const energyBefore = staminaLeft(hopper);
  assert(energyBefore > 0, 'hoplite has energy for a second action');
  const afterMove = applyAction(second, { kind: 'move', pieceId: hopper.id, to: firstStep });
  assert(afterMove.staminaBonus, 'a walk with energy left arms the second action');
  assert(canTrap(afterMove, hopper.id), 'trap is legal as the second action');
  const moved = getPiece(afterMove, hopper.id)!;
  const plantHex = trapSpots(afterMove, moved).find(
    (h) => h.col !== firstStep.col || h.row !== firstStep.row,
  )!;
  const afterTrap = applyAction(afterMove, {
    kind: 'trap',
    pieceId: hopper.id,
    to: plantHex,
  });
  assert(tokenOnHex(afterTrap.tokens, plantHex, 'pikes'), 'second-action trap plants');
  assert(!afterTrap.staminaBonus, 'second-action trap clears the energy lock');
  assert(afterTrap.turn === 'blue', 'second-action trap ends the side (cap 1)');
  assert(
    staminaLeft(getPiece(afterTrap, hopper.id)!) === energyBefore - 1,
    'second-action trap spends 1 energy',
  );

  const savedFront = UNIT_STATS.hoplite.armorFront;
  UNIT_STATS.hoplite.armorFront = -2;
  const red = neighborInDir({ col: hop.col, row: hop.row }, hop.facing, s.orientation);
  assert(
    !trapSpots(s, hop).some((h) => h.col === red.col && h.row === red.row),
    'a red face is not a trap spot',
  );
  assert(trapSpots(s, hop).length === 5, 'the other five directions stay');
  UNIT_STATS.hoplite.armorFront = savedFront;
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
  const charges = legalHighlights(s, tank.id).filter((h) => h.kind === 'charge');
  assert(
    charges.some((h) => h.hex.col === 3 && !h.extra),
    'spent energy still allows a crash inside the normal move',
  );
  assert(
    charges.some((h) => h.extra && h.unpaid) && !charges.some((h) => h.extra && !h.unpaid),
    'spent energy leaves extra-reach charge dests unpaid',
  );
}

console.log('specials: hide/javelin/charge/trap catalog and engine actions');
