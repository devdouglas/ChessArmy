import { type GameState } from '../src/engine';
import { UNIT_STATS } from '../src/roster';
import { pickAiAction } from '../src/ai';
import { resetAiChecklist } from '../src/ai-config';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const saved = {
  shoot: UNIT_STATS.soldier.shoot,
  stamina: UNIT_STATS.soldier.stamina,
};

function board(): GameState {
  const s = createStateFromTerrain(
    emptyTerrain(8, 10),
    'ai-advance',
    'pointy',
    [
      { type: 'soldier', col: 3, row: 1, side: 'blue' },
      { type: 'soldier', col: 4, row: 1, side: 'blue' },
      { type: 'soldier', col: 3, row: 3, side: 'blue' },
      { type: 'general', col: 6, row: 8, side: 'red' },
    ],
    { blue: 'ai-enemy', red: 'player' },
    [],
    { blue: 'advance', red: 'aggressive' },
  );
  s.turn = 'blue';
  s.unitsPerTurn = 6;
  return s;
}

resetAiChecklist();
UNIT_STATS.soldier.shoot = 0;
UNIT_STATS.soldier.stamina = 0;
try {
  const s = board();
  const a = pickAiAction(s);
  assert(a?.kind === 'move', 'advance still marches');
  const p = s.pieces.find((x) => x.id === a.pieceId)!;
  assert(p.row === 1, 'rear steps first — the unit already ahead stays put');
  assert(a.kind === 'move' && a.to.row > p.row, 'rear walks toward the far edge');
} finally {
  UNIT_STATS.soldier.shoot = saved.shoot;
  UNIT_STATS.soldier.stamina = saved.stamina;
  resetAiChecklist();
}

console.log('repro-ai-advance ok');
