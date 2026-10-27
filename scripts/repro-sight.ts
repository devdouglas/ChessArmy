import {
  defaultSight,
  legalHighlights,
  pieceSees,
  pieceVisibleTo,
  type GameState,
} from '../src/engine';
import { neighborInDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';
import { DEFAULT_UNIT_STATS, UNIT_STATS } from '../src/roster';
import { sanitizeUnitStats } from '../src/units';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(defaultSight(1, 0) === 2, 'sight is move+1 when no gun');
assert(defaultSight(1, 4) === 5, 'sight is shoot+1 when shoot is longer');
assert(defaultSight(0, 0) === 1, 'sight is at least 1');
assert(UNIT_STATS.soldier.sight === defaultSight(1, 2), 'stock soldier sight is 3');
assert(
  UNIT_STATS.sniper.sight === defaultSight(UNIT_STATS.sniper.move, UNIT_STATS.sniper.shoot),
  'stock sniper sight is max(move,shoot)+1',
);

{
  const { sight: _drop, ...rest } = DEFAULT_UNIT_STATS.soldier;
  const filled = sanitizeUnitStats('soldier', rest);
  assert(filled.sight === defaultSight(filled.move, filled.shoot), 'missing sight → floor');
}

{
  const kept = sanitizeUnitStats('soldier', { ...DEFAULT_UNIT_STATS.soldier, sight: 9 });
  assert(kept.sight === 9, 'custom sight above floor is kept');
}

{
  const bumped = sanitizeUnitStats('soldier', {
    ...DEFAULT_UNIT_STATS.soldier,
    shoot: 4,
    sight: 1,
  });
  assert(bumped.sight === 5, 'sight 1 with shoot 4 is raised to 5');
}

const start = { col: 2, row: 5 };
const step1 = neighborInDir(start, 0, 'pointy');
const step2 = neighborInDir(step1, 0, 'pointy');
const step3 = neighborInDir(step2, 0, 'pointy');
const step4 = neighborInDir(step3, 0, 'pointy');

function board(
  blueAt: { col: number; row: number },
  tokens?: { type: 'wall'; col: number; row: number }[],
): GameState {
  const t = emptyTerrain(8, 10);
  const s = createStateFromTerrain(
    t,
    'sight',
    'pointy',
    [
      { type: 'soldier', col: start.col, row: start.row, side: 'red' },
      { type: 'general', col: 0, row: 5, side: 'red' },
      { type: 'soldier', col: blueAt.col, row: blueAt.row, side: 'blue' },
      { type: 'general', col: 7, row: 9, side: 'blue' },
    ],
    undefined,
    tokens,
  );
  s.turn = 'red';
  return s;
}

{
  const s = board(step3);
  const blue = s.pieces.find((p) => p.type === 'soldier' && p.side === 'blue')!;
  const red = s.pieces.find((p) => p.type === 'soldier' && p.side === 'red')!;
  assert(pieceSees(s, red, blue), 'AI Sight reaches 3');
  assert(pieceVisibleTo(s, blue, 'red'), 'no fog: still painted at Sight range');
}

{
  const s = board(step4);
  const blue = s.pieces.find((p) => p.type === 'soldier' && p.side === 'blue')!;
  const red = s.pieces.find((p) => p.type === 'soldier' && p.side === 'red')!;
  assert(!pieceSees(s, red, blue), 'AI Sight does not reach 4');
  assert(pieceVisibleTo(s, blue, 'red'), 'no fog: painted past Sight');
  assert(pieceVisibleTo(s, red, 'red'), 'own piece is always visible');
}

{
  const s = board(step2, [{ type: 'wall', col: step1.col, row: step1.row }]);
  const blue = s.pieces.find((p) => p.type === 'soldier' && p.side === 'blue')!;
  const red = s.pieces.find((p) => p.type === 'soldier' && p.side === 'red')!;
  assert(!pieceSees(s, red, blue), 'AI Sight: wall blocks');
  assert(pieceVisibleTo(s, blue, 'red'), 'no fog: painted behind a wall');
  assert(
    !legalHighlights(s, red.id).some(
      (h) => h.kind === 'shoot' && h.hex.col === step2.col && h.hex.row === step2.row,
    ),
    'shoot LOS still blocked by a wall',
  );
}

console.log('sight: floor max(move,shoot)+1; AI only, no fog');
