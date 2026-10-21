import {
  applyAction,
  isHostile,
  sameTeam,
  type GameState,
} from '../src/engine';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function piece(s: GameState, side: 'red' | 'blue' | 'yellow' | 'purple') {
  const p = s.pieces.find((x) => x.side === side);
  if (!p) throw new Error(`missing ${side}`);
  return p;
}

const t = emptyTerrain(8, 10);

{
  const s = createStateFromTerrain(t, '2v2', 'pointy', [
    { type: 'general', col: 1, row: 8, side: 'red' },
    { type: 'general', col: 1, row: 1, side: 'blue' },
    { type: 'general', col: 6, row: 8, side: 'yellow' },
    { type: 'general', col: 6, row: 1, side: 'purple' },
  ], {
    red: 'player',
    yellow: 'ai-ally',
    blue: 'ai-enemy',
    purple: 'ai-enemy',
  });
  assert(!s.winner, '2v2 should not be over at start');
  assert(sameTeam(s, 'red', 'yellow'), 'player + ally');
  assert(sameTeam(s, 'blue', 'purple'), 'enemies allied');
  assert(isHostile(s, 'red', 'blue'), 'player vs enemy');
  assert(!isHostile(s, 'red', 'yellow'), 'not hostile to ally');
  const red = piece(s, 'red');
  let next = applyAction(s, {
    kind: 'move',
    pieceId: red.id,
    to: { col: red.col, row: red.row - 1 },
  });
  if (next.scoutPieceId) next = applyAction(next, { kind: 'skip' });
  assert(next.turn === 'blue', `turn order red→blue, got ${next.turn}`);
}

{
  const s = createStateFromTerrain(t, 'kill-enemy', 'pointy', [
    { type: 'general', col: 3, row: 5, side: 'red' },
    { type: 'soldier', col: 4, row: 5, side: 'red' },
    { type: 'general', col: 5, row: 5, side: 'blue' },
    { type: 'general', col: 1, row: 8, side: 'yellow' },
  ], {
    red: 'player',
    yellow: 'ai-ally',
    blue: 'ai-enemy',
    purple: 'ai-enemy',
  });
  const soldier = s.pieces.find((p) => p.type === 'soldier')!;
  const after = applyAction(s, {
    kind: 'move',
    pieceId: soldier.id,
    to: { col: 5, row: 5 },
  });
  assert(after.winner === 'red' || after.winner === 'yellow', `player team wins, got ${after.winner}`);
}

{
  const s = createStateFromTerrain(t, 'hotseat', 'pointy', [
    { type: 'general', col: 1, row: 8, side: 'red' },
    { type: 'general', col: 1, row: 1, side: 'blue' },
  ], {
    red: 'player',
    blue: 'player',
    yellow: 'ai-enemy',
    purple: 'ai-enemy',
  });
  assert(isHostile(s, 'red', 'blue'), 'two players FFA when no enemy pieces');
  assert(!s.winner, 'hotseat not over');
}

console.log('repro-armies ok');
