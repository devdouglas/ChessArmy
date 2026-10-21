import { applyAction, passTurn, type GameState } from '../src/engine';
import { neighborInDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const start = { col: 4, row: 5 };
const step = neighborInDir(start, 0, 'pointy');
const step2 = neighborInDir(step, 0, 'pointy');

function board(
  tokens: { type: 'flag'; col: number; row: number }[],
  extra: { type: 'soldier' | 'general'; col: number; row: number; side: 'red' | 'blue' }[] = [],
): GameState {
  const s = createStateFromTerrain(
    emptyTerrain(8, 10),
    'flags',
    'pointy',
    [
      { type: 'soldier', col: start.col, row: start.row, side: 'red' },
      { type: 'general', col: 1, row: 1, side: 'red' },
      { type: 'soldier', col: 6, row: 8, side: 'blue' },
      { type: 'general', col: 1, row: 9, side: 'blue' },
      ...extra,
    ],
    undefined,
    tokens,
  );
  s.turn = 'red';
  return s;
}

function untilTurn(s: GameState, side: 'red' | 'blue'): GameState {
  let g = s;
  let n = 0;
  while (g.turn !== side && !g.winner && n++ < 8) {
    if (g.scoutPieceId) g = applyAction(g, { kind: 'skip' });
    else g = passTurn(g);
  }
  return g;
}

{
  const s = board([{ type: 'flag', col: start.col, row: start.row }]);
  assert(s.winner === 'red', 'spawn on the only flag wins immediately');
}

{
  const s = board([{ type: 'flag', col: step.col, row: step.row }]);
  assert(!s.winner, 'unowned flag does not end the match');
  const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
  const after = applyAction(s, { kind: 'move', pieceId: p.id, to: step });
  assert(after.winner === 'red', 'walking onto the only flag wins');
  assert(
    after.tokens.some((t) => t.type === 'flag' && t.owner === 'red'),
    'sole flag is owned',
  );
  assert(after.log.some((l) => l.includes('captures the flag')), 'capture is logged');
}

{
  const s = board([
    { type: 'flag', col: step.col, row: step.row },
    { type: 'flag', col: step2.col, row: step2.row },
  ]);
  const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
  const one = applyAction(s, { kind: 'move', pieceId: p.id, to: step });
  assert(!one.winner, 'one of two flags is not enough');
  assert(one.tokens.filter((t) => t.type === 'flag' && t.owner === 'red').length === 1, 'holds one');
  let next = untilTurn(one, 'red');
  next = applyAction(next, { kind: 'move', pieceId: p.id, to: step2 });
  assert(next.winner === 'red', 'taking every flag wins');
}

{
  const s = createStateFromTerrain(
    emptyTerrain(8, 10),
    'flags-recap',
    'pointy',
    [
      { type: 'soldier', col: start.col, row: start.row, side: 'red' },
      { type: 'general', col: 1, row: 1, side: 'red' },
      { type: 'soldier', col: step.col, row: step.row, side: 'blue' },
      { type: 'general', col: 1, row: 9, side: 'blue' },
    ],
    undefined,
    [
      { type: 'flag', col: step.col, row: step.row },
      { type: 'flag', col: 7, row: 1 },
    ],
  );
  s.turn = 'red';
  assert(
    s.tokens.some((t) => t.type === 'flag' && t.col === step.col && t.owner === 'blue'),
    'blue holds the occupied flag at kickoff',
  );
  assert(!s.winner, 'one of two flags is not a win');
  const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
  const after = applyAction(s, { kind: 'move', pieceId: p.id, to: step });
  assert(!after.winner, 'recapture of one flag is not enough');
  assert(
    after.tokens.some((t) => t.type === 'flag' && t.col === step.col && t.owner === 'red'),
    'red recaptures the contested flag',
  );
  assert(after.log.some((l) => l.includes('recaptures')), 'recapture is logged');
}

{
  const flagHex = { col: 7, row: 1 };
  const s = createStateFromTerrain(
    emptyTerrain(8, 10),
    'flags-king',
    'pointy',
    [
      { type: 'soldier', col: start.col, row: start.row, side: 'red' },
      { type: 'general', col: 1, row: 1, side: 'red' },
      { type: 'general', col: step.col, row: step.row, side: 'blue' },
    ],
    undefined,
    [{ type: 'flag', col: flagHex.col, row: flagHex.row }],
  );
  s.turn = 'red';
  const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
  const after = applyAction(s, { kind: 'move', pieceId: p.id, to: step });
  assert(after.winner === 'red', 'killing the last general still wins with a loose flag');
  assert(
    after.tokens.some((t) => t.type === 'flag' && !t.owner),
    'loose flag stays unowned',
  );
}

console.log('repro-flags ok');
