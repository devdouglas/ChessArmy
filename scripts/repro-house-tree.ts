import {
  applyAction,
  isPalisade,
  isWall,
  legalHighlights,
  previewMove,
  tokenAt,
  type GameState,
} from '../src/engine';
import { neighborInDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const start = { col: 4, row: 5 };
const step = neighborInDir(start, 0, 'pointy');
const rocketAt = neighborInDir(step, 0, 'pointy');

function board(kind: 'house' | 'tree'): GameState {
  const t = emptyTerrain(8, 10);
  t[step.row][step.col] = 'high';
  const s = createStateFromTerrain(
    t,
    kind,
    'pointy',
    [
      { type: 'soldier', col: start.col, row: start.row, side: 'red' },
      { type: 'bazooka', col: rocketAt.col, row: rocketAt.row, side: 'red' },
      { type: 'general', col: 1, row: 1, side: 'red' },
      { type: 'soldier', col: 6, row: 8, side: 'blue' },
      { type: 'general', col: 1, row: 9, side: 'blue' },
    ],
    undefined,
    [{ type: kind, col: step.col, row: step.row }],
  );
  s.turn = 'red';
  return s;
}

{
  const s = board('house');
  assert(isWall(s, step), 'house counts as wall');
  assert(!isPalisade(s, step), 'house is not a palisade');
  const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
  assert(applyAction(s, { kind: 'move', pieceId: p.id, to: step }) === s, 'cannot walk onto house');
  const rocket = s.pieces.find((x) => x.type === 'bazooka')!;
  assert(
    legalHighlights(s, rocket.id).some(
      (h) => h.kind === 'shoot' && h.hex.col === step.col && h.hex.row === step.row,
    ),
    'rocket can aim a house',
  );
  const after = applyAction(s, { kind: 'shoot', pieceId: rocket.id, at: step });
  assert(!isWall(after, step), 'rocket demolishes house');
  assert(after.terrain[step.row][step.col] === 'high', 'hill remains under house');
}

function readyAgain(s: GameState, id: string) {
  s.turn = 'red';
  s.actedIds = [];
  s.scoutPieceId = null;
  const p = s.pieces.find((x) => x.id === id);
  if (p) {
    p.movedThisTurn = false;
    p.staminaUsedThisTurn = false;
  }
}

{
  const s = board('tree');
  assert(isPalisade(s, step), 'tree counts as palisade');
  assert(!isWall(s, step), 'tree is not a wall');
  const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
  const plan = previewMove(s, p, step);
  assert(plan.palisadeHits[0]?.remaining === 2, 'tree takes 3 hits');
  const hit1 = applyAction(s, { kind: 'move', pieceId: p.id, to: step });
  assert(tokenAt(hit1.tokens, step)?.type === 'tree', 'tree still there');
  assert(tokenAt(hit1.tokens, step)?.hp === 2, 'tree chipped to 2');
  readyAgain(hit1, p.id);
  const hit2 = applyAction(hit1, { kind: 'move', pieceId: p.id, to: step });
  assert(tokenAt(hit2.tokens, step)?.hp === 1, 'tree chipped to 1');
  readyAgain(hit2, p.id);
  const hit3 = applyAction(hit2, { kind: 'move', pieceId: p.id, to: step });
  assert(!tokenAt(hit3.tokens, step), 'third hit fells the tree');
  assert(
    hit3.pieces.some((x) => x.id === p.id && x.col === step.col && x.row === step.row),
    'walker takes the hex',
  );
}

{
  const s = board('tree');
  const rocket = s.pieces.find((x) => x.type === 'bazooka')!;
  const after = applyAction(s, { kind: 'shoot', pieceId: rocket.id, at: step });
  assert(!isPalisade(after, step), 'rocket smashes tree');
}

console.log('house=wall, tree=palisade; rocket and melee match');
