import { applyAction, isWall, legalHighlights, type GameState } from '../src/engine';
import { neighborInDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const start = { col: 4, row: 5 };
const step = neighborInDir(start, 0, 'pointy');
const rocketAt = neighborInDir(step, 0, 'pointy');

function board(tile: 'high' | 'water' | 'land' | 'rock' = 'high'): GameState {
  const t = emptyTerrain(8, 10);
  t[step.row][step.col] = tile;
  const s = createStateFromTerrain(
    t,
    'walls',
    'pointy',
    [
      { type: 'soldier', col: start.col, row: start.row, side: 'red' },
      { type: 'bazooka', col: rocketAt.col, row: rocketAt.row, side: 'red' },
      { type: 'general', col: 1, row: 1, side: 'red' },
      { type: 'soldier', col: 6, row: 8, side: 'blue' },
      { type: 'general', col: 1, row: 9, side: 'blue' },
    ],
    undefined,
    [{ type: 'wall', col: step.col, row: step.row }],
  );
  s.turn = 'red';
  return s;
}

{
  const s = board();
  assert(isWall(s, step), 'wall token counts as wall');
  assert(s.terrain[step.row][step.col] === 'high', 'tile under wall stays hill');
  const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
  const moved = applyAction(s, { kind: 'move', pieceId: p.id, to: step });
  assert(moved === s, 'cannot walk onto a wall token');
}

{
  const t = emptyTerrain(8, 10);
  t[5][5] = 'wall';
  const s = createStateFromTerrain(t, 'old-wall', 'pointy', [
    { type: 'soldier', col: 4, row: 5, side: 'red' },
    { type: 'general', col: 1, row: 1, side: 'red' },
    { type: 'soldier', col: 6, row: 8, side: 'blue' },
    { type: 'general', col: 1, row: 9, side: 'blue' },
  ]);
  assert(s.terrain[5][5] === 'land', 'old wall terrain becomes land');
  assert(isWall(s, { col: 5, row: 5 }), 'old wall terrain lifts to a token');
}

{
  const s = board();
  const rocket = s.pieces.find((x) => x.type === 'bazooka')!;
  const can = legalHighlights(s, rocket.id).some(
    (h) => h.kind === 'shoot' && h.hex.col === step.col && h.hex.row === step.row,
  );
  assert(can, 'rocket can aim the wall token');
  const after = applyAction(s, { kind: 'shoot', pieceId: rocket.id, at: step });
  assert(!isWall(after, step), 'rocket demolishes wall token');
  assert(after.terrain[step.row][step.col] === 'high', 'hill remains after demolish');
}

{
  const s = board('water');
  assert(s.terrain[step.row][step.col] === 'water', 'wall sits on water');
  assert(isWall(s, step), 'wall token on water still blocks');
  const rocket = s.pieces.find((x) => x.type === 'bazooka')!;
  const can = legalHighlights(s, rocket.id).some(
    (h) => h.kind === 'shoot' && h.hex.col === step.col && h.hex.row === step.row,
  );
  assert(can, 'rocket can aim a wall on water');
  const after = applyAction(s, { kind: 'shoot', pieceId: rocket.id, at: step });
  assert(!isWall(after, step), 'rocket demolishes wall on water');
  assert(after.terrain[step.row][step.col] === 'water', 'water remains after demolish');
}

{
  const s = board('rock');
  assert(s.terrain[step.row][step.col] === 'rock', 'wall sits on mountain');
  const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
  assert(applyAction(s, { kind: 'move', pieceId: p.id, to: step }) === s, 'cannot walk a wall on mountain');
}

console.log('repro-walls ok');
