import {
  actionPointsLeft,
  applyAction,
  legalHighlights,
  passTurn,
} from '../src/engine';
import { neighborInDir, type HexDir } from '../src/hex';
import { UNIT_STATS } from '../src/roster';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const hpSaved = UNIT_STATS.soldier.hp;
const apSaved = UNIT_STATS.soldier.actionPoints;
try {
  UNIT_STATS.soldier.hp = 4;
  UNIT_STATS.soldier.actionPoints = 2;

  const from = { col: 4, row: 5 };
  const dir = 2 as HexDir;
  const wet = neighborInDir(from, dir, 'pointy');
  const land = neighborInDir(wet, dir, 'pointy');
  const t = emptyTerrain(8, 10);
  t[wet.row][wet.col] = 'water';
  let s = createStateFromTerrain(t, 'water-exit', 'pointy', [
    { type: 'soldier', col: from.col, row: from.row, side: 'red' },
    { type: 'general', col: 0, row: 0, side: 'red' },
    { type: 'soldier', col: 6, row: 6, side: 'blue' },
    { type: 'general', col: 7, row: 7, side: 'blue' },
  ]);
  const id = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!.id;

  s = applyAction(s, { kind: 'move', pieceId: id, to: wet });
  s = passTurn(s);
  const wetUnit = s.pieces.find((p) => p.id === id)!;
  assert(actionPointsLeft(wetUnit) === 0, 'swim tax empties the pool');
  assert(
    legalHighlights(s, id).some(
      (h) => h.kind === 'move' && h.hex.col === land.col && h.hex.row === land.row,
    ),
    'exit hex still highlighted',
  );

  const left = applyAction(s, { kind: 'move', pieceId: id, to: land });
  assert(left !== s, '0-AP exit is not a no-op');
  const ashore = left.pieces.find((p) => p.id === id)!;
  assert(ashore.col === land.col && ashore.row === land.row, 'steps onto land');
  assert(actionPointsLeft(ashore) === 0, 'broke exit spends nothing');

  // With leftover after tax, the base step still costs 1 AP.
  UNIT_STATS.soldier.actionPoints = 3;
  const t2 = emptyTerrain(8, 10);
  t2[from.row][from.col] = 'water';
  const s2 = createStateFromTerrain(t2, 'water-exit-pay', 'pointy', [
    { type: 'soldier', col: from.col, row: from.row, side: 'red' },
    { type: 'general', col: 0, row: 0, side: 'red' },
    { type: 'soldier', col: 6, row: 6, side: 'blue' },
    { type: 'general', col: 7, row: 7, side: 'blue' },
  ]);
  const id2 = s2.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!.id;
  const before = actionPointsLeft(s2.pieces.find((p) => p.id === id2)!);
  assert(before === 2, 'tax leaves 2 from max 3');
  const one = neighborInDir(from, dir, 'pointy');
  const paid = applyAction(s2, { kind: 'move', pieceId: id2, to: one });
  assert(
    actionPointsLeft(paid.pieces.find((p) => p.id === id2)!) === before - 1,
    'non-broke water step still spends AP',
  );
} finally {
  UNIT_STATS.soldier.hp = hpSaved;
  UNIT_STATS.soldier.actionPoints = apSaved;
}

console.log('water exit: broke swim step ok');
