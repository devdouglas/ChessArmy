import {
  applyAction,
  meleeDamageOf,
  previewMove,
  sanitizeUnitTokens,
  type GameState,
} from '../src/engine';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function board(): GameState {
  const t = emptyTerrain(6, 6);
  const s = createStateFromTerrain(t, 'wood', 'pointy', [
    { type: 'soldier', col: 2, row: 2, side: 'red' },
    { type: 'general', col: 5, row: 0, side: 'red' },
    { type: 'soldier', col: 1, row: 5, side: 'blue' },
    { type: 'general', col: 0, row: 5, side: 'blue' },
  ]);
  s.turn = 'red';
  const gate = { col: 3, row: 2 };
  s.tokens = [{ type: 'palisade', col: gate.col, row: gate.row, hp: 3 }];
  return s;
}

{
  const s = board();
  const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
  assert(meleeDamageOf(p) === 1, 'stock melee is 1');
  const plan = previewMove(s, p, { col: 3, row: 2 });
  assert(plan.palisadeHits[0]?.remaining === 2, '1 attack leaves 2 HP');
  assert(!plan.palisadeHits[0]?.destroyed, '1 attack does not fell 3 HP');
}

{
  const s = board();
  const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
  p.unitTokens = sanitizeUnitTokens(['attack1', 'attack1']);
  assert(meleeDamageOf(p) === 3, '1+2 attack is 3');
  const plan = previewMove(s, p, { col: 3, row: 2 });
  assert(plan.palisadeHits[0]?.remaining === 0, '3 attack clears 3 HP');
  assert(plan.palisadeHits[0]?.destroyed, '3 attack fells the fence');
  const after = applyAction(s, { kind: 'move', pieceId: p.id, to: { col: 3, row: 2 } });
  assert(
    !after.tokens.some((t) => t.type === 'palisade' && t.col === 3 && t.row === 2),
    'fence gone',
  );
  const live = after.pieces.find((x) => x.id === p.id)!;
  assert(live.col === 3 && live.row === 2, 'walker takes the hex');
}

console.log('wood: attack strength chips palisade HP');
