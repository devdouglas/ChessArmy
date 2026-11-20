import {
  actionPointsLeft,
  allLegalActions,
  applyAction,
  canReload,
  getPiece,
  isReloading,
  legalHighlights,
  passTurn,
} from '../src/engine';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

{
  const s = createStateFromTerrain(emptyTerrain(8, 8), 'reload', 'pointy', [
    { type: 'archer', col: 3, row: 4, side: 'red' },
    { type: 'soldier', col: 6, row: 4, side: 'blue' },
    { type: 'general', col: 0, row: 4, side: 'red' },
    { type: 'general', col: 7, row: 4, side: 'blue' },
  ]);
  s.turn = 'red';
  const archer = s.pieces.find((p) => p.type === 'archer')!;
  assert(!canReload(s, archer.id), 'ready unit cannot reload');

  const shot = legalHighlights(s, archer.id).find(
    (h) => h.kind === 'shoot' && h.hex.col === 6 && h.hex.row === 4,
  )!;
  assert(!!shot, 'archer has a shot on the soldier');
  const afterShot = applyAction(s, { kind: 'shoot', pieceId: archer.id, at: shot.hex });
  const cooling = getPiece(afterShot, archer.id)!;
  assert(isReloading(cooling), 'shot starts reload');
  assert((cooling.shootCooldown ?? 0) === 1, 'archer reload time is 1');
  assert(canReload(afterShot, archer.id), 'leftover AP can reload');
  assert(
    allLegalActions(afterShot).some((a) => a.kind === 'reload' && a.pieceId === archer.id),
    'reload is a legal action',
  );

  const reloaded = applyAction(afterShot, { kind: 'reload', pieceId: archer.id });
  const ready = getPiece(reloaded, archer.id)!;
  assert(!isReloading(ready), 'reload clears 1 cooldown');
  assert(actionPointsLeft(ready) === 0, 'reload spends 1 AP');
}

{
  const s = createStateFromTerrain(emptyTerrain(8, 8), 'reload-ballista', 'pointy', [
    { type: 'ballista', col: 2, row: 4, side: 'red' },
    { type: 'soldier', col: 6, row: 4, side: 'blue' },
    { type: 'general', col: 0, row: 0, side: 'red' },
    { type: 'general', col: 7, row: 0, side: 'blue' },
  ]);
  s.turn = 'red';
  const ballista = s.pieces.find((p) => p.type === 'ballista')!;
  const shot = legalHighlights(s, ballista.id).find(
    (h) => h.kind === 'shoot' && h.hex.col === 6 && h.hex.row === 4,
  )!;
  assert(!!shot, 'ballista has a shot on the soldier');
  let next = applyAction(s, { kind: 'shoot', pieceId: ballista.id, at: shot.hex });
  let p = getPiece(next, ballista.id)!;
  assert((p.shootCooldown ?? 0) === 2, 'ballista reload is 2');
  assert(canReload(next, ballista.id), 'can start reloading after fire');

  next = applyAction(next, { kind: 'reload', pieceId: ballista.id });
  p = getPiece(next, ballista.id)!;
  // End-of-turn tick skips once because firedThisTurn is still set.
  assert((p.shootCooldown ?? 0) === 1, 'one reload ticks one (end-turn skip keeps it)');

  // Blue → red: cooldown only ticks when YOUR turn ends, so still 1 here.
  if (next.turn === 'red') next = passTurn(next);
  next = passTurn(next);
  p = getPiece(next, ballista.id)!;
  assert(next.turn === 'red', 'red again');
  assert((p.shootCooldown ?? 0) === 1, 'still one left at start of next turn');
  assert(canReload(next, p.id), 'can pay the last point');
  next = applyAction(next, { kind: 'reload', pieceId: p.id });
  assert(!isReloading(getPiece(next, p.id)!), 'second reload finishes');
}

{
  // Reload on a later turn (not the fire turn) also works.
  const s = createStateFromTerrain(emptyTerrain(8, 8), 'reload-later', 'pointy', [
    { type: 'bazooka', col: 2, row: 4, side: 'red' },
    { type: 'soldier', col: 5, row: 4, side: 'blue' },
    { type: 'general', col: 0, row: 0, side: 'red' },
    { type: 'general', col: 7, row: 0, side: 'blue' },
  ]);
  s.turn = 'red';
  const zook = s.pieces.find((p) => p.type === 'bazooka')!;
  const shot = legalHighlights(s, zook.id).find(
    (h) => h.kind === 'shoot' && h.hex.col === 5 && h.hex.row === 4,
  )!;
  assert(!!shot, 'bazooka can fire');
  let next = applyAction(s, { kind: 'shoot', pieceId: zook.id, at: shot.hex });
  // Burn leftover AP without reloading
  if (next.scoutPieceId) next = applyAction(next, { kind: 'skip' });
  if (next.turn === 'red') next = passTurn(next);
  // Fire-turn end skipped the tick → still 2 going into the next red turn.
  next = passTurn(next);
  let p = getPiece(next, zook.id)!;
  assert(next.turn === 'red', 'red again');
  assert((p.shootCooldown ?? 0) === 2, `waiting left 2, got ${p.shootCooldown}`);
  assert(canReload(next, p.id), 'can reload on a later turn');
  next = applyAction(next, { kind: 'reload', pieceId: p.id });
  p = getPiece(next, p.id)!;
  assert((p.shootCooldown ?? 0) === 1, 'one AP clears one point');
  if (canReload(next, p.id)) {
    next = applyAction(next, { kind: 'reload', pieceId: p.id });
    p = getPiece(next, p.id)!;
  }
  assert(!isReloading(p), 'paid AP to finish reload');
}

console.log('repro-reload ok');
