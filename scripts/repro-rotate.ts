import {
  allLegalActions,
  facingOf,
  hasActed,
  rotatePiece,
  UNIT_STATS,
  type GameState,
} from '../src/engine';
import { createStateFromTerrain, emptyTerrain } from '../src/map';
import type { HexDir } from '../src/hex';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function board(): GameState {
  const s = createStateFromTerrain(emptyTerrain(8, 10), 'rotate', 'pointy', [
    { type: 'cohort', col: 4, row: 5, side: 'red' },
    { type: 'soldier', col: 3, row: 5, side: 'red' },
    { type: 'general', col: 1, row: 1, side: 'red' },
    { type: 'cohort', col: 6, row: 8, side: 'blue' },
    { type: 'general', col: 1, row: 9, side: 'blue' },
  ]);
  s.turn = 'red';
  s.unitsPerTurn = 3;
  return s;
}

const start = board();
const cohort = start.pieces.find((p) => p.side === 'red' && p.type === 'cohort')!;
const soldier = start.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
const blue = start.pieces.find((p) => p.side === 'blue' && p.type === 'cohort')!;

assert(UNIT_STATS.cohort.hexArmor, 'cohort has a hex shield');
assert(!UNIT_STATS.soldier.hexArmor, 'soldier has no hex shield');
assert(facingOf(cohort) === 2, 'red default facing is 2');
assert(
  !allLegalActions(start).some((a) => (a as { kind: string }).kind === 'rotate'),
  'rotate must not be an AI legal action',
);

assert(rotatePiece(start, soldier.id, 0) === start, 'no hex shield → no rotate');

const turned = rotatePiece(start, cohort.id, 0);
assert(turned !== start, 'legal rotate clones state');
assert(facingOf(turned.pieces.find((p) => p.id === cohort.id)!) === 0, 'facing locked to click dir');
assert(turned.log.some((l) => l.includes('turns')), 'log says turns');
assert(hasActed(turned, cohort.id), 'rotate spends the activation');
assert(rotatePiece(turned, cohort.id, 5) === turned, 'cannot rotate twice');

const otherSide = rotatePiece(start, blue.id, 0);
assert(otherSide === start, 'other side cannot rotate');

const junk = rotatePiece(start, cohort.id, 9 as HexDir);
assert(junk === start, 'invalid dir is a no-op');

const savedActions = UNIT_STATS.cohort.actions;
try {
  UNIT_STATS.cohort.actions = 2;
  const leftoverStart = board();
  const hexed = leftoverStart.pieces.find((p) => p.side === 'red' && p.type === 'cohort')!;
  const first = rotatePiece(leftoverStart, hexed.id, 5);
  assert(facingOf(first.pieces.find((p) => p.id === hexed.id)!) === 5, 'facing updates');
  assert(!hasActed(first, hexed.id), 'leftover action is still active');
  assert(first.scoutPieceId === hexed.id, 'lock after first rotate');
  assert((first.scoutActionsLeft ?? 0) === 1, 'one action left');
  const second = rotatePiece(first, hexed.id, 1);
  assert(hasActed(second, hexed.id), 'second rotate finishes');
  assert(facingOf(second.pieces.find((p) => p.id === hexed.id)!) === 1, 'second rotate facing');
} finally {
  UNIT_STATS.cohort.actions = savedActions;
}

console.log('repro-rotate ok');
