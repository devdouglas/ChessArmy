import {
  applyAction,
  getPiece,
  legalHighlights,
  passTurn,
  actionPointsLeft,
  type GameState,
} from '../src/engine';
import { neighborInDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function idleBoth(s: GameState): GameState {
  if (s.turn === 'red') s = passTurn(s);
  if (s.turn === 'blue') s = passTurn(s);
  return s;
}

function board(): { s: GameState; id: string } {
  const s = createStateFromTerrain(emptyTerrain(8, 10), 'rest-bonus', 'pointy', [
    { type: 'soldier', col: 3, row: 2, side: 'red' },
    { type: 'general', col: 1, row: 1, side: 'red' },
    { type: 'soldier', col: 3, row: 8, side: 'blue' },
    { type: 'general', col: 1, row: 9, side: 'blue' },
  ]);
  s.unitsPerTurn = 3;
  const piece = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
  return { s, id: piece.id };
}

function walk(s: GameState, id: string): GameState {
  const step = legalHighlights(s, id).find((h) => h.kind === 'move');
  if (!step) throw new Error('no green step');
  return applyAction(s, { kind: 'move', pieceId: id, to: step.hex });
}

{
  const { s, id } = board();
  getPiece(s, id)!.actionPoints = 0;
  const next = idleBoth(s);
  assert(
    actionPointsLeft(getPiece(next, id)!) === 2,
    'idle grant is AP / turn + 1 rest bonus',
  );
}

{
  const { s, id } = board();
  getPiece(s, id)!.actionPoints = 1;
  let next = walk(s, id);
  assert(actionPointsLeft(getPiece(next, id)!) === 0, 'walk spends the pool');
  next = idleBoth(next);
  assert(
    actionPointsLeft(getPiece(next, id)!) === 1,
    'an action last turn is not +1',
  );
}

{
  const { s, id } = board();
  getPiece(s, id)!.actionPoints = 0;
  getPiece(s, id)!.unitTokens = ['sleep'];
  const next = idleBoth(s);
  assert(actionPointsLeft(getPiece(next, id)!) === 0, 'sleep still skips grant');
}

{
  const t = emptyTerrain(8, 10);
  t[2][3] = 'water';
  let s = createStateFromTerrain(t, 'rest-bonus-water', 'pointy', [
    { type: 'soldier', col: 3, row: 2, side: 'red' },
    { type: 'general', col: 1, row: 1, side: 'red' },
    { type: 'soldier', col: 3, row: 8, side: 'blue' },
    { type: 'general', col: 1, row: 9, side: 'blue' },
  ]);
  const id = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!.id;
  getPiece(s, id)!.actionPoints = 0;
  getPiece(s, id)!.hp = 4;
  s = idleBoth(s);
  const wet = getPiece(s, id);
  assert(wet, 'still alive with spare HP');
  assert(actionPointsLeft(wet!) === 0, 'water still skips grant');
}

{
  const from = { col: 3, row: 2 };
  const s = createStateFromTerrain(emptyTerrain(8, 10), 'rest-bonus-cap', 'pointy', [
    { type: 'soldier', col: from.col, row: from.row, side: 'red' },
    { type: 'soldier', col: neighborInDir(from, 1, 'pointy').col, row: neighborInDir(from, 1, 'pointy').row, side: 'red' },
    { type: 'general', col: 1, row: 1, side: 'red' },
    { type: 'soldier', col: 3, row: 8, side: 'blue' },
    { type: 'general', col: 1, row: 9, side: 'blue' },
  ]);
  s.unitsPerTurn = 1;
  const mover = s.pieces.find((p) => p.side === 'red' && p.col === from.col)!;
  const idle = s.pieces.find((p) => p.side === 'red' && p.id !== mover.id && p.type === 'soldier')!;
  mover.actionPoints = 1;
  idle.actionPoints = 0;
  let next = walk(s, mover.id);
  next = idleBoth(next);
  assert(actionPointsLeft(getPiece(next, mover.id)!) === 1, 'mover: AP / turn only');
  assert(actionPointsLeft(getPiece(next, idle.id)!) === 2, 'unactivated unit still rests');
}

console.log('rest bonus AP ok');
