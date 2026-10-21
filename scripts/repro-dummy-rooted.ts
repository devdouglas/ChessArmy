import { legalHighlights, type GameState } from '../src/engine';
import { pickAiAction } from '../src/ai';
import { neighborInDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function dummyOn(terrain: 'land' | 'high' | 'plateau' | 'rock'): GameState {
  const grid = emptyTerrain(8, 10);
  grid[5][4] = terrain;
  const s = createStateFromTerrain(grid, 'dummy-rooted', 'pointy', [
    { type: 'dummy', col: 4, row: 5, side: 'blue' },
    { type: 'general', col: 4, row: 8, side: 'blue' },
    { type: 'soldier', col: 4, row: 1, side: 'red' },
    { type: 'general', col: 3, row: 1, side: 'red' },
  ]);
  s.turn = 'blue';
  return s;
}

function dummyMoves(s: GameState): boolean {
  const p = s.pieces.find((x) => x.type === 'dummy' && x.side === 'blue')!;
  return legalHighlights(s, p.id).some(
    (h) => h.kind === 'move' || h.kind === 'stamina',
  );
}

function dummyShoots(s: GameState): boolean {
  const p = s.pieces.find((x) => x.type === 'dummy' && x.side === 'blue')!;
  return legalHighlights(s, p.id).some(
    (h) => h.kind === 'shoot' || h.kind === 'shoot-range',
  );
}

for (const t of ['land', 'high', 'plateau', 'rock'] as const) {
  const s = dummyOn(t);
  assert(!dummyMoves(s), `dummy on ${t}: no walk`);
  assert(!dummyShoots(s), `dummy on ${t}: no shoot`);
  const p = s.pieces.find((x) => x.type === 'dummy')!;
  const act = pickAiAction(s);
  assert(
    !act || act.pieceId !== p.id,
    `dummy on ${t}: AI must not activate the dummy (${JSON.stringify(act)})`,
  );
}

const hill = dummyOn('high');
const dummy = hill.pieces.find((x) => x.type === 'dummy')!;
const down = neighborInDir({ col: dummy.col, row: dummy.row }, 5, 'pointy');
assert(
  !legalHighlights(hill, dummy.id).some(
    (h) => h.hex.col === down.col && h.hex.row === down.row,
  ),
  'dummy on hill cannot step down',
);

console.log('dummy move 0 / shoot 0 stays rooted (incl. elevation)');
