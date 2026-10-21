import { applyAction, hpLeft, previewMove, UNIT_STATS } from '../src/engine';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const savedHp = UNIT_STATS.soldier.hp;
UNIT_STATS.soldier.hp = 2;

try {
  const s = createStateFromTerrain(emptyTerrain(10, 8), 'charge-live', 'pointy', [
    { type: 'tank', col: 1, row: 5, side: 'red' },
    { type: 'general', col: 1, row: 1, side: 'red' },
    { type: 'soldier', col: 2, row: 5, side: 'blue' },
    { type: 'soldier', col: 3, row: 5, side: 'blue' },
    { type: 'general', col: 8, row: 7, side: 'blue' },
  ]);
  s.turn = 'red';
  const tank = s.pieces.find((p) => p.type === 'tank' && p.side === 'red')!;
  const to = { col: 4, row: 5 };
  const plan = previewMove(s, tank, to);
  assert(plan.hits.length === 2, `expected 2 charge hits, got ${plan.hits.length}`);
  assert(plan.hits.every((h) => !h.fatal && h.remaining === 1), 'survivors at 1 hp');
  assert(plan.stop.col === 4 && plan.stop.row === 5, `should pass through to dest, stop ${plan.stop.col},${plan.stop.row}`);

  const after = applyAction(s, { kind: 'move', pieceId: tank.id, to });
  const moved = after.pieces.find((p) => p.id === tank.id)!;
  const blues = after.pieces.filter((p) => p.side === 'blue' && p.type === 'soldier');
  assert(moved.col === 4 && moved.row === 5, `tank at dest, got ${moved.col},${moved.row}`);
  assert(blues.length === 2, 'both soldiers still alive');
  assert(blues.every((p) => hpLeft(p) === 1), 'both lost 1 hp');
} finally {
  UNIT_STATS.soldier.hp = savedHp;
}

console.log('charge: survivors take dmg and let the charger through');
