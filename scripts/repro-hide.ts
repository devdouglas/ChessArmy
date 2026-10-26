import {
  applyAction,
  isConcealed,
  isConcealedFrom,
  legalHighlights,
  pieceVisible,
  restPiece,
  revealPiece,
  tokenAt,
  viewingSides,
  type GameState,
} from '../src/engine';
import { neighborInDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';
import { UNIT_STATS } from '../src/roster';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const start = { col: 2, row: 5 };
const woods = neighborInDir(start, 0, 'pointy');
const beyond = neighborInDir(woods, 0, 'pointy');

function board(): GameState {
  const t = emptyTerrain(8, 10);
  const s = createStateFromTerrain(
    t,
    'hide',
    'pointy',
    [
      { type: 'soldier', col: start.col, row: start.row, side: 'red' },
      { type: 'barbarian', col: woods.col, row: woods.row, side: 'blue' },
      { type: 'general', col: 0, row: 5, side: 'red' },
      { type: 'general', col: 7, row: 5, side: 'blue' },
    ],
    undefined,
    [{ type: 'forest', col: woods.col, row: woods.row }],
  );
  s.turn = 'red';
  return s;
}

assert(UNIT_STATS.barbarian.canHide, 'stock barbarian can hide');
assert(!UNIT_STATS.soldier.canHide, 'stock soldier cannot hide');

{
  const s = board();
  const barb = s.pieces.find((p) => p.type === 'barbarian')!;
  const red = s.pieces.find((p) => p.type === 'soldier' && p.side === 'red')!;
  assert(isConcealed(s, barb), 'barbarian is concealed in forest');
  assert(isConcealedFrom(s, barb, 'red'), 'red cannot see them');
  assert(!isConcealedFrom(s, barb, 'blue'), 'blue still sees own unit');
  assert(!pieceVisible(s, barb, viewingSides(s)), 'board viewer is red');
  revealPiece(barb);
  assert(pieceVisible(s, barb, viewingSides(s)), 'revealPiece paints them for enemies');
  barb.revealed = undefined;
  assert(!pieceVisible(s, barb, viewingSides(s)), 'cover restored for later cases');
  assert(
    !legalHighlights(s, red.id).some(
      (h) => h.kind === 'shoot' && h.hex.col === woods.col && h.hex.row === woods.row,
    ),
    'cannot shoot a hidden unit',
  );
}

{
  const s = board();
  const barb = s.pieces.find((p) => p.type === 'barbarian')!;
  s.turn = 'blue';
  const after = applyAction(s, { kind: 'move', pieceId: barb.id, to: beyond });
  const moved = after.pieces.find((p) => p.id === barb.id)!;
  assert(moved.revealed, 'moving breaks hide');
  assert(!isConcealed(after, moved), 'no longer concealed off forest');
  const back = { ...after, turn: 'blue', actedIds: [], scoutPieceId: null };
  const p = back.pieces.find((x) => x.id === barb.id)!;
  p.movedThisTurn = false;
  p.staminaUsedThisTurn = false;
  const home = applyAction(back, { kind: 'move', pieceId: p.id, to: woods });
  const again = home.pieces.find((x) => x.id === p.id)!;
  assert(again.revealed, 'hide stays broken after walking back');
  assert(!isConcealed(home, again), 'revealed unit is visible in forest');
}

{
  const s = board();
  const barb = s.pieces.find((p) => p.type === 'barbarian')!;
  s.turn = 'blue';
  const rested = restPiece(s, barb.id);
  const still = rested.pieces.find((p) => p.id === barb.id)!;
  assert(!still.revealed, 'rest does not break hide');
  assert(isConcealed(rested, still), 'still hidden after rest');
}

{
  const s = board();
  const red = s.pieces.find((p) => p.type === 'soldier' && p.side === 'red')!;
  const after = applyAction(s, { kind: 'move', pieceId: red.id, to: woods });
  const barb = after.pieces.find((p) => p.type === 'barbarian');
  assert(!barb || barb.revealed, 'being attacked reveals');
}

{
  const t = emptyTerrain(8, 10);
  const s = createStateFromTerrain(
    t,
    'hide-shoot',
    'pointy',
    [
      { type: 'archer', col: start.col, row: start.row, side: 'red' },
      { type: 'barbarian', col: woods.col, row: woods.row, side: 'blue' },
      { type: 'general', col: 0, row: 5, side: 'red' },
      { type: 'general', col: 7, row: 5, side: 'blue' },
    ],
    undefined,
    [{ type: 'forest', col: woods.col, row: woods.row }],
  );
  s.turn = 'blue';
  const barb = s.pieces.find((p) => p.type === 'barbarian')!;
  assert(tokenAt(s.tokens, woods)?.type === 'forest', 'forest present');
  // Barbarian has no shoot — attack via melee onto red
  const after = applyAction(s, { kind: 'move', pieceId: barb.id, to: start });
  const moved = after.pieces.find((p) => p.id === barb.id);
  assert(moved?.revealed, 'attacking breaks hide');
}

{
  const t = emptyTerrain(8, 10);
  const s = createStateFromTerrain(
    t,
    'hidden-token',
    'pointy',
    [
      { type: 'soldier', col: start.col, row: start.row, side: 'red' },
      {
        type: 'soldier',
        col: beyond.col,
        row: beyond.row,
        side: 'blue',
        unitTokens: ['hidden'],
      },
      { type: 'general', col: 0, row: 5, side: 'red' },
      { type: 'general', col: 7, row: 5, side: 'blue' },
    ],
  );
  s.turn = 'red';
  const hid = s.pieces.find((p) => p.side === 'blue' && p.type === 'soldier')!;
  const red = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
  assert(hid.unitTokens?.includes('hidden'), 'token stamped');
  assert(isConcealed(s, hid), 'hidden token conceals on open land');
  assert(isConcealedFrom(s, hid, 'red'), 'red cannot see stamped hidden');
  assert(!isConcealedFrom(s, hid, 'blue'), 'owner sees stamped hidden');
  assert(
    !legalHighlights(s, red.id).some(
      (h) => h.kind === 'shoot' && h.hex.col === beyond.col && h.hex.row === beyond.row,
    ),
    'cannot shoot a hidden-token unit',
  );
  s.turn = 'blue';
  const after = applyAction(s, { kind: 'move', pieceId: hid.id, to: woods });
  const moved = after.pieces.find((p) => p.id === hid.id)!;
  assert(moved.revealed, 'moving breaks hidden token');
  assert(!isConcealed(after, moved), 'visible after the first move');
}

console.log('hide: forest + hidden token; move/attack/hit breaks it');
