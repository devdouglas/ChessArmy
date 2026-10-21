import { applyAction, hpLeft, PIKE_DAMAGE, type GameState } from '../src/engine';
import { neighborInDir } from '../src/hex';
import { UNIT_STATS } from '../src/roster';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function redSoldier(s: GameState) {
  return s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
}

const start = { col: 4, row: 5 };
const step = neighborInDir(start, 0, 'pointy');
const step2 = neighborInDir(step, 0, 'pointy');

function board(tokens: { type: 'pikes'; col: number; row: number }[]): GameState {
  const s = createStateFromTerrain(
    emptyTerrain(8, 10),
    'pikes',
    'pointy',
    [
      { type: 'soldier', col: start.col, row: start.row, side: 'red' },
      { type: 'general', col: 1, row: 1, side: 'red' },
      { type: 'soldier', col: 6, row: 8, side: 'blue' },
      { type: 'general', col: 1, row: 9, side: 'blue' },
    ],
    undefined,
    tokens,
  );
  s.turn = 'red';
  return s;
}

{
  const s = board([{ type: 'pikes', col: start.col, row: start.row }]);
  const p = redSoldier(s);
  assert(hpLeft(p) === UNIT_STATS.soldier.hp, 'spawn on pikes does not damage');
}

{
  const s = board([{ type: 'pikes', col: step.col, row: step.row }]);
  const p = redSoldier(s);
  const after = applyAction(s, { kind: 'move', pieceId: p.id, to: step });
  const moved = after.pieces.find((x) => x.id === p.id);
  assert(!moved, '1hp soldier dies on one pike hex');
  assert(after.fxHits?.some((h) => h.id === p.id && h.fatal && h.dealt === PIKE_DAMAGE), 'pike hit flashes');
  assert(after.log.some((l) => l.includes('dies on pikes')), 'pike death is logged');
}

{
  const savedHp = UNIT_STATS.soldier.hp;
  const savedMove = UNIT_STATS.soldier.move;
  try {
    UNIT_STATS.soldier.hp = 3;
    UNIT_STATS.soldier.move = 2;
    const s = board([
      { type: 'pikes', col: step.col, row: step.row },
      { type: 'pikes', col: step2.col, row: step2.row },
    ]);
    const p = redSoldier(s);
    const after = applyAction(s, { kind: 'move', pieceId: p.id, to: step2 });
    const moved = after.pieces.find((x) => x.id === p.id)!;
    assert(moved.col === step2.col && moved.row === step2.row, 'survives to dest');
    assert(hpLeft(moved) === 1, 'two pike hexes deal 2');
  } finally {
    UNIT_STATS.soldier.hp = savedHp;
    UNIT_STATS.soldier.move = savedMove;
  }
}

{
  const savedHp = UNIT_STATS.soldier.hp;
  try {
    UNIT_STATS.soldier.hp = 3;
    const s = board([{ type: 'pikes', col: start.col, row: start.row }]);
    const p = redSoldier(s);
    const after = applyAction(s, { kind: 'move', pieceId: p.id, to: step });
    const moved = after.pieces.find((x) => x.id === p.id)!;
    assert(hpLeft(moved) === 3, 'leaving a pike hex does not damage');
  } finally {
    UNIT_STATS.soldier.hp = savedHp;
  }
}

console.log('repro-pikes ok');
