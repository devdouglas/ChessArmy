import {
  applyAction,
  getPiece,
  legalHighlights,
  passTurn,
  staminaLeft,
  type Action,
  type GameState,
} from '../src/engine';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function make(unitsPerTurn: number, type: string): { s: GameState; id: string } {
  const s = createStateFromTerrain(emptyTerrain(8, 10), 'repro', 'pointy', [
    { type, col: 3, row: 2, side: 'red' },
    { type: 'general', col: 1, row: 1, side: 'red' },
    { type: 'soldier', col: 3, row: 8, side: 'blue' },
    { type: 'general', col: 1, row: 9, side: 'blue' },
  ]);
  s.unitsPerTurn = unitsPerTurn;
  const piece = s.pieces.find((p) => p.side === 'red' && p.type === type)!;
  return { s, id: piece.id };
}

function staminaMove(s: GameState, id: string): GameState {
  const hits = legalHighlights(s, id).filter((h) => h.kind === 'stamina');
  if (!hits.length) throw new Error('no stamina moves');
  const act: Action = { kind: 'move', pieceId: id, to: hits[0].hex };
  return applyAction(s, act);
}

function idleBoth(s: GameState): GameState {
  if (s.turn === 'red') s = passTurn(s);
  if (s.turn === 'blue') s = passTurn(s);
  return s;
}

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

{
  let { s, id } = make(3, 'soldier');
  s = staminaMove(s, id);
  assert(staminaLeft(getPiece(s, id)!) === 0, 'soldier spent');
  s = idleBoth(s);
  assert(staminaLeft(getPiece(s, id)!) === 0, 'soldier spend-end does not grant');
  s = idleBoth(s);
  assert(staminaLeft(getPiece(s, id)!) === 1, 'soldier regen 1: one idle End restores');
}

{
  let { s, id } = make(3, 'scout');
  s = staminaMove(s, id);
  s = idleBoth(s);
  assert(staminaLeft(getPiece(s, id)!) === 0, 'scout spend-end does not grant');
  s = idleBoth(s);
  assert(staminaLeft(getPiece(s, id)!) === 1, 'scout regen 2: spend-end + one idle restores');
}

{
  let { s, id } = make(1, 'soldier');
  s = staminaMove(s, id);
  assert(s.turn === 'blue', 'cap 1 auto-ends after spend');
  s = idleBoth(s);
  assert(staminaLeft(getPiece(s, id)!) === 0, 'cap 1 spend-end skip grant');
  s = idleBoth(s);
  assert(staminaLeft(getPiece(s, id)!) === 1, 'cap 1 one idle pass restores');
}

console.log('stamina regen ok');
