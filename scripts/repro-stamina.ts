import {
  allLegalActions,
  applyAction,
  getPiece,
  hasActed,
  legalHighlights,
  passTurn,
  restPiece,
  staminaLeft,
  staminaMax,
  type Action,
  type GameState,
} from '../src/engine';
import { UNIT_STATS } from '../src/roster';
import { neighborInDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function make(unitsPerTurn: number, type: string): { s: GameState; id: string } {
  const t = emptyTerrain(8, 10);
  const high = neighborInDir({ col: 3, row: 2 }, 0, 'pointy');
  t[high.row][high.col] = 'high';
  const s = createStateFromTerrain(t, 'repro', 'pointy', [
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

{
  let { s, id } = make(1, 'soldier');
  const green = legalHighlights(s, id).find((h) => h.kind === 'move');
  assert(green, 'cap 1 green dest');
  s = applyAction(s, { kind: 'move', pieceId: id, to: green!.hex });
  assert(s.turn === 'red', 'cap 1 green move still offers the extra');
  assert(s.staminaBonus, 'last unit unused stamina hangs for Spend stamina');
  assert(staminaLeft(getPiece(s, id)!) === 1, 'extra not spent until taken');
}

{
  let { s, id } = make(3, 'soldier');
  const green = legalHighlights(s, id).find((h) => h.kind === 'move');
  assert(green, 'mid-quota green dest');
  s = applyAction(s, { kind: 'move', pieceId: id, to: green!.hex });
  assert(s.turn === 'red', 'not last unit — still red');
  assert(s.staminaBonus, 'mid-quota unused stamina still offers the extra');
}

{
  const t = emptyTerrain(8, 10);
  const from = { col: 3, row: 2 };
  const tgt = neighborInDir(from, 1, 'pointy');
  let s = createStateFromTerrain(t, 'repro-shoot-idle', 'pointy', [
    { type: 'soldier', col: from.col, row: from.row, side: 'red' },
    { type: 'general', col: 1, row: 1, side: 'red' },
    { type: 'soldier', col: tgt.col, row: tgt.row, side: 'blue' },
    { type: 'general', col: 1, row: 9, side: 'blue' },
  ]);
  s.unitsPerTurn = 3;
  const id = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!.id;
  getPiece(s, id)!.stamina = 0;
  const before = s;
  s = applyAction(s, { kind: 'shoot', pieceId: id, at: tgt });
  assert(s !== before, 'adjacent shot is legal');
  assert(staminaLeft(getPiece(s, id)!) === 0, 'shoot itself does not grant');
  s = passTurn(s);
  assert(staminaLeft(getPiece(s, id)!) === 0, 'shoot End does not regenerate');
  s = idleBoth(s);
  assert(staminaLeft(getPiece(s, id)!) === 0, 'opponent idle is not our idle End');
  s = idleBoth(s);
  assert(staminaLeft(getPiece(s, id)!) === 1, 'one idle End after shooting restores');
}

{
  const t = emptyTerrain(8, 10);
  const from = { col: 3, row: 2 };
  const tgt = neighborInDir(from, 1, 'pointy');
  let s = createStateFromTerrain(t, 'repro-shoot-bonus', 'pointy', [
    { type: 'soldier', col: from.col, row: from.row, side: 'red' },
    { type: 'general', col: 1, row: 1, side: 'red' },
    { type: 'soldier', col: tgt.col, row: tgt.row, side: 'blue' },
    { type: 'general', col: 1, row: 9, side: 'blue' },
  ]);
  s.unitsPerTurn = 1;
  const id = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!.id;
  s = applyAction(s, { kind: 'shoot', pieceId: id, at: tgt });
  assert(s.turn === 'red', 'last unit shot still offers the stamina extra');
  assert(s.staminaBonus, 'shot does not skip the stamina action');
  assert(staminaLeft(getPiece(s, id)!) === 1, 'shot does not spend stamina until the extra');
}

{
  let { s, id } = make(1, 'soldier');
  getPiece(s, id)!.stamina = 0;
  s = restPiece(s, id);
  assert(s.turn === 'blue', 'cap 1 rest ends the side');
  assert(staminaLeft(getPiece(s, id)!) === 1, 'rest is idle — regen still lands');
}

{
  let { s, id } = make(3, 'soldier');
  getPiece(s, id)!.stamina = 0;
  s = restPiece(s, id);
  assert(s.turn === 'red', 'cap 3 rest does not end the side');
  assert(hasActed(s, id), 'rest checkmarks the unit');
  assert(staminaLeft(getPiece(s, id)!) === 0, 'grant waits for End');
  const blocked = restPiece(s, id);
  assert(blocked === s, 'cannot rest an already-parked unit');
  s = passTurn(s);
  assert(staminaLeft(getPiece(s, id)!) === 1, 'resting unit regenerates on End');
}

{
  let { s, id } = make(3, 'soldier');
  const step = legalHighlights(s, id).find((h) => h.kind === 'move');
  assert(step, 'soldier has a free step');
  s = applyAction(s, { kind: 'move', pieceId: id, to: step!.hex });
  const afterMove = restPiece(s, id);
  assert(afterMove === s, 'rest is illegal after a move');
}

{
  const { s, id } = make(3, 'soldier');
  const from = { col: 3, row: 2 };
  const high = neighborInDir(from, 0, 'pointy');
  const two = neighborInDir(neighborInDir(from, 1, 'pointy'), 1, 'pointy');
  const p = getPiece(s, id)!;
  p.stamina = 0;
  const hl = legalHighlights(s, id);
  assert(
    !hl.some(
      (h) =>
        (h.kind === 'move' || h.kind === 'stamina') &&
        h.hex.col === high.col &&
        h.hex.row === high.row,
    ),
    'cannot climb with empty stamina',
  );
  assert(
    hl.some((h) => h.kind === 'rest' && h.hex.col === high.col && h.hex.row === high.row),
    'hill that needs stamina is marked need-rest',
  );
  assert(
    hl.some((h) => h.kind === 'rest' && h.hex.col === two.col && h.hex.row === two.row),
    'extra-move hex is marked need-rest',
  );
  assert(
    !allLegalActions(s).some(
      (a) =>
        a.kind === 'move' &&
        a.pieceId === id &&
        a.to.col === high.col &&
        a.to.row === high.row,
    ),
    'need-rest hex is not a legal move',
  );
}

{
  const t = emptyTerrain(8, 10);
  const s = createStateFromTerrain(t, 'gen-stam', 'pointy', [
    { type: 'soldier', col: 3, row: 2, side: 'red', unitTokens: ['general'] },
    { type: 'soldier', col: 4, row: 2, side: 'red' },
    { type: 'general', col: 1, row: 1, side: 'red' },
    { type: 'soldier', col: 3, row: 8, side: 'blue' },
    { type: 'general', col: 1, row: 9, side: 'blue' },
  ]);
  const starred = s.pieces.find((p) => p.side === 'red' && p.col === 3)!;
  const plain = s.pieces.find((p) => p.side === 'red' && p.col === 4)!;
  assert(
    staminaMax(starred) === UNIT_STATS.soldier.stamina + 1,
    'general token +1 stamina',
  );
  assert(staminaLeft(starred) === staminaMax(starred), 'spawns full with the extra pip');
  assert(staminaMax(plain) === UNIT_STATS.soldier.stamina, 'unstamped soldier unchanged');
}

console.log('stamina regen ok');
