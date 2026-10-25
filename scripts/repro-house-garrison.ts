import {
  applyAction,
  isHouse,
  isWall,
  legalHighlights,
  type GameState,
} from '../src/engine';
import { neighborInDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const home = { col: 4, row: 5 };
const step = neighborInDir(home, 0, 'pointy');

function board(): GameState {
  const s = createStateFromTerrain(
    emptyTerrain(8, 10),
    'house-garrison',
    'pointy',
    [
      { type: 'soldier', col: home.col, row: home.row, side: 'red' },
      { type: 'soldier', col: 1, row: 5, side: 'red' },
      { type: 'archer', col: 6, row: 5, side: 'blue' },
      { type: 'general', col: 1, row: 1, side: 'red' },
      { type: 'general', col: 6, row: 8, side: 'blue' },
    ],
    undefined,
    [{ type: 'house', col: home.col, row: home.row }],
  );
  s.turn = 'red';
  return s;
}

{
  const s = board();
  assert(isHouse(s, home), 'house token sits under the unit');
  assert(isWall(s, home), 'house is still a wall');
  const inside = s.pieces.find((p) => p.type === 'soldier' && p.col === home.col)!;
  assert(inside.row === home.row, 'unit starts in the house');
  const leaves = legalHighlights(s, inside.id).filter((h) => h.kind === 'move');
  assert(
    leaves.some((h) => h.hex.col === step.col && h.hex.row === step.row),
    'occupant can walk out',
  );
  assert(
    !leaves.some((h) => h.hex.col === home.col && h.hex.row === home.row),
    'current hex is not a move dest',
  );
}

{
  const s = board();
  const buddy = s.pieces.find((p) => p.type === 'soldier' && p.col === 1)!;
  assert(
    !legalHighlights(s, buddy.id).some(
      (h) =>
        (h.kind === 'move' || h.kind === 'stamina') &&
        h.hex.col === home.col &&
        h.hex.row === home.row,
    ),
    'other units cannot enter an occupied house',
  );
}

{
  const s = board();
  const bow = s.pieces.find((p) => p.type === 'archer')!;
  s.turn = 'blue';
  assert(
    !legalHighlights(s, bow.id).some(
      (h) => h.kind === 'shoot' && h.hex.col === home.col && h.hex.row === home.row,
    ),
    'bullets cannot shoot into a house',
  );
}

{
  const s = board();
  const inside = s.pieces.find((p) => p.type === 'soldier' && p.col === home.col)!;
  const after = applyAction(s, { kind: 'move', pieceId: inside.id, to: step });
  const left = after.pieces.find((p) => p.id === inside.id)!;
  assert(left.col === step.col && left.row === step.row, 'walked out');
  assert(isHouse(after, home), 'house stays');
  const again = {
    ...after,
    turn: 'red' as const,
    actedIds: [],
    scoutPieceId: null,
  };
  left.movedThisTurn = false;
  left.staminaUsedThisTurn = false;
  assert(
    !legalHighlights(again, left.id).some(
      (h) =>
        (h.kind === 'move' || h.kind === 'stamina') &&
        h.hex.col === home.col &&
        h.hex.row === home.row,
    ),
    'after leaving, cannot enter again',
  );
  const buddy = again.pieces.find((p) => p.type === 'soldier' && p.col === 1)!;
  assert(
    !legalHighlights(again, buddy.id).some(
      (h) =>
        (h.kind === 'move' || h.kind === 'stamina') &&
        h.hex.col === home.col &&
        h.hex.row === home.row,
    ),
    'empty house stays sealed',
  );
}

{
  const s = board();
  const inside = s.pieces.find((p) => p.type === 'soldier' && p.col === home.col)!;
  assert(
    legalHighlights(s, inside.id).some(
      (h) => h.kind === 'shoot' && h.hex.col === 6 && h.hex.row === 5,
    ) || legalHighlights(s, inside.id).some((h) => h.kind === 'shoot-range'),
    'occupant can still aim out of the house',
  );
}

console.log('repro-house-garrison ok');
