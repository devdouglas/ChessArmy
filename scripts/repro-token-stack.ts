import {
  applyAction,
  isForest,
  isPalisade,
  liftWallTerrain,
  sanitizeTokens,
  tokenOnHex,
  tokensAt,
  type GameState,
} from '../src/engine';
import { neighborInDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const at = { col: 4, row: 5 };
const step = neighborInDir(at, 2, 'pointy');

{
  const stacked = sanitizeTokens(
    [
      { type: 'board', col: 2, row: 2, text: 'hello' },
      { type: 'tree', col: 2, row: 2 },
      { type: 'forest', col: 2, row: 2 },
      { type: 'forest', col: 2, row: 2 },
    ],
    8,
    10,
  );
  const here = stacked.filter((t) => t.col === 2 && t.row === 2);
  assert(here.length === 3, `kept one of each type, got ${here.length}`);
  assert(here.map((t) => t.type).join(',') === 'board,tree,forest', 'paint order kept');
  assert(tokenOnHex(stacked, { col: 2, row: 2 }, 'board')?.text === 'hello', 'board text kept under forest');
}

{
  const t = emptyTerrain(6, 6);
  t[1][1] = 'wall';
  const lifted = liftWallTerrain(t, [
    { type: 'forest', col: 1, row: 1 },
    { type: 'board', col: 1, row: 1, text: 'under' },
  ]);
  const here = tokensAt(lifted.tokens, { col: 1, row: 1 });
  assert(here.some((x) => x.type === 'forest'), 'forest survives wall lift');
  assert(here.some((x) => x.type === 'board'), 'board survives wall lift');
  assert(here.some((x) => x.type === 'wall'), 'wall token added');
  assert(lifted.terrain[1][1] === 'land', 'wall terrain lifted');
}

function board(): GameState {
  const s = createStateFromTerrain(
    emptyTerrain(8, 10),
    'stack',
    'pointy',
    [
      { type: 'soldier', col: at.col, row: at.row, side: 'red' },
      { type: 'general', col: 1, row: 1, side: 'red' },
      { type: 'soldier', col: 6, row: 8, side: 'blue' },
      { type: 'general', col: 1, row: 9, side: 'blue' },
    ],
    undefined,
    [
      { type: 'board', col: step.col, row: step.row, text: 'under the trees' },
      { type: 'tree', col: step.col, row: step.row },
      { type: 'forest', col: step.col, row: step.row },
    ],
  );
  s.turn = 'red';
  return s;
}

{
  const s = board();
  assert(isForest(s, step), 'forest still counts under/over other tokens');
  assert(isPalisade(s, step), 'tree still blocks as palisade');
  assert(tokenOnHex(s.tokens, step, 'board')?.text === 'under the trees', 'board under forest');
}

{
  const s = board();
  s.tokens = s.tokens.filter((t) => t.type !== 'tree');
  const soldier = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
  const after = applyAction(s, { kind: 'move', pieceId: soldier.id, to: step });
  assert(after.fxBoard?.text === 'under the trees', 'walk reads the buried board');
  assert(isForest(after, step), 'forest still there after the walk');
}

console.log('token stack: one of each type per hex, forest/house gameplay still sees every layer');
