import {
  allLegalActions,
  applyAction,
  legalHighlights,
  type GameState,
} from '../src/engine';
import { UNIT_STATS } from '../src/roster';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function meleeOnto(s: GameState, pieceId: string, col: number, row: number) {
  return legalHighlights(s, pieceId).some(
    (h) =>
      (h.kind === 'move' || h.kind === 'stamina') &&
      h.hex.col === col &&
      h.hex.row === row,
  );
}

function adjacent(turn: 'red' | 'blue' = 'red'): GameState {
  const s = createStateFromTerrain(emptyTerrain(8, 10), 'melee0', 'pointy', [
    { type: 'soldier', col: 4, row: 5, side: 'red' },
    { type: 'general', col: 7, row: 1, side: 'red' },
    { type: 'soldier', col: 5, row: 5, side: 'blue' },
    { type: 'general', col: 1, row: 9, side: 'blue' },
  ]);
  s.turn = turn;
  return s;
}

const saved = UNIT_STATS.soldier.meleeDamage;

try {
  UNIT_STATS.soldier.meleeDamage = 0;
  const redState = adjacent('red');
  const red = redState.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
  assert(
    !meleeOnto(redState, red.id, 5, 5),
    'player highlights must omit enemy hex at melee 0',
  );
  const bounced = applyAction(redState, {
    kind: 'move',
    pieceId: red.id,
    to: { col: 5, row: 5 },
  });
  assert(bounced === redState, 'apply melee-0 onto enemy must be a no-op');

  const blueState = adjacent('blue');
  const blue = blueState.pieces.find((p) => p.side === 'blue' && p.type === 'soldier')!;
  assert(
    !allLegalActions(blueState).some(
      (a) =>
        a.kind === 'move' &&
        a.pieceId === blue.id &&
        a.to.col === 4 &&
        a.to.row === 5,
    ),
    'AI legal actions must omit melee-0 onto enemy',
  );
  assert(!meleeOnto(blueState, blue.id, 4, 5), 'AI highlights omit enemy hex at melee 0');

  UNIT_STATS.soldier.meleeDamage = 1;
  const ok = adjacent('red');
  const redOk = ok.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
  assert(meleeOnto(ok, redOk.id, 5, 5), 'melee 1 still highlights enemy hex');
  const after = applyAction(ok, {
    kind: 'move',
    pieceId: redOk.id,
    to: { col: 5, row: 5 },
  });
  assert(
    !after.pieces.some((p) => p.side === 'blue' && p.type === 'soldier'),
    'melee 1 still kills 1hp soldier',
  );
} finally {
  UNIT_STATS.soldier.meleeDamage = saved;
}

console.log('melee 0: no player/AI bump onto occupied hex');
