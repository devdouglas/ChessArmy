import { getPiece, hpLeft, passTurn, staminaLeft, type GameState } from '../src/engine';
import { neighborInDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function make(): { s: GameState; id: string } {
  const t = emptyTerrain(8, 10);
  const high = neighborInDir({ col: 3, row: 2 }, 0, 'pointy');
  t[high.row][high.col] = 'high';
  const s = createStateFromTerrain(t, 'repro', 'pointy', [
    { type: 'soldier', col: 3, row: 2, side: 'red' },
    { type: 'general', col: 1, row: 1, side: 'red' },
    { type: 'soldier', col: 3, row: 8, side: 'blue' },
    { type: 'general', col: 1, row: 9, side: 'blue' },
  ]);
  const piece = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
  piece.stamina = 0;
  return { s, id: piece.id };
}

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

function ids(s: GameState, kind: 'gain' | 'spend'): string[] {
  return (s.fxStamina ?? []).filter((x) => x.kind === kind).map((x) => x.id);
}

{
  let { s, id } = make();
  assert(!s.fxStamina?.length, 'match start has no stamina flash');
  s = passTurn(s);
  assert(s.turn === 'blue', 'after red idle, blue to move');
  assert(!ids(s, 'gain').includes(id), 'grant is queued, not flashed on the opponent turn');
  assert(staminaLeft(getPiece(s, id)!) === 1, 'idle End still grants immediately');
  s = passTurn(s);
  assert(s.turn === 'red', 'back to red');
  assert(ids(s, 'gain').includes(id), 'gold flash lands at the start of the regenerating side');
}

{
  let { s, id } = make();
  const p = getPiece(s, id)!;
  p.movedThisTurn = true;
  s = passTurn(s);
  assert(staminaLeft(getPiece(s, id)!) === 0, 'walk End does not grant');
  s = passTurn(s);
  assert(!ids(s, 'gain').includes(id), 'no gold when nothing generated');
}

{
  const t = emptyTerrain(8, 10);
  t[2][3] = 'water';
  const s = createStateFromTerrain(t, 'repro-water', 'pointy', [
    { type: 'soldier', col: 3, row: 2, side: 'red' },
    { type: 'general', col: 1, row: 1, side: 'red' },
    { type: 'soldier', col: 3, row: 8, side: 'blue' },
    { type: 'general', col: 1, row: 9, side: 'blue' },
  ]);
  const id = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!.id;
  assert(ids(s, 'spend').includes(id), 'water penalty flashes blue at turn start');
  assert(!ids(s, 'gain').includes(id), 'penalty is not a gold grant');
  assert(staminaLeft(getPiece(s, id)!) === 0, 'water spends 1 stamina');
  assert(hpLeft(getPiece(s, id)!) === 1, 'paying the penalty does not drown');
}

{
  const t = emptyTerrain(8, 10);
  t[2][3] = 'water';
  let s = createStateFromTerrain(t, 'repro-drown', 'pointy', [
    { type: 'soldier', col: 3, row: 2, side: 'red' },
    { type: 'general', col: 1, row: 1, side: 'red' },
    { type: 'soldier', col: 3, row: 8, side: 'blue' },
    { type: 'general', col: 1, row: 9, side: 'blue' },
  ]);
  const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
  s = passTurn(s);
  assert(staminaLeft(getPiece(s, p.id)!) === 0, 'idle End in water does not regenerate');
  assert(!ids(s, 'gain').includes(p.id), 'no gold regen flash in water');
  s = passTurn(s);
  assert(
    !s.pieces.some((x) => x.id === p.id),
    'empty stamina in water drowns instead of flashing blue',
  );
  assert((s.fxHits ?? []).some((h) => h.id === p.id), 'drown still flashes red');
  assert(!ids(s, 'spend').includes(p.id), 'drown is not a stamina spend flash');
}

console.log('stamina fx ok');
