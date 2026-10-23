import { type GameState } from '../src/engine';
import { neighborInDir } from '../src/hex';
import { UNIT_STATS } from '../src/roster';
import { pickAiAction } from '../src/ai';
import { resetAiChecklist, setAiRule } from '../src/ai-config';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const start = { col: 4, row: 5 };
const step = neighborInDir(start, 0, 'pointy');
const closer = neighborInDir(start, 1, 'pointy');

function board(): GameState {
  const s = createStateFromTerrain(
    emptyTerrain(8, 10),
    'ai-checklist',
    'pointy',
    [
      { type: 'soldier', col: start.col, row: start.row, side: 'blue' },
      { type: 'general', col: 7, row: 1, side: 'red' },
      { type: 'soldier', col: 6, row: 8, side: 'red' },
    ],
    { blue: 'ai-enemy', red: 'player' },
    [
      { type: 'pikes', col: step.col, row: step.row },
      { type: 'pikes', col: closer.col, row: closer.row },
    ],
    { blue: 'aggressive', red: 'aggressive' },
  );
  s.turn = 'blue';
  const me = s.pieces.find((p) => p.side === 'blue' && p.type === 'soldier');
  if (me) me.hp = 3;
  return s;
}

function walkedPikes(s: GameState) {
  const a = pickAiAction(s);
  if (a?.kind !== 'move') return false;
  return (
    (a.to.col === step.col && a.to.row === step.row) ||
    (a.to.col === closer.col && a.to.row === closer.row)
  );
}

const saved = {
  shoot: UNIT_STATS.soldier.shoot,
  stamina: UNIT_STATS.soldier.stamina,
  actions: UNIT_STATS.soldier.actions,
};

try {
  UNIT_STATS.soldier.shoot = 0;
  UNIT_STATS.soldier.stamina = 0;
  UNIT_STATS.soldier.actions = 1;
  resetAiChecklist();

  {
    const s = board();
    const a = pickAiAction(s);
    assert(a?.kind === 'move', 'stock aggressive still moves');
    assert(!walkedPikes(s), 'stock aggressive does not walk pikes');
  }

  setAiRule('aggressive', 'avoid-pikes', false);
  {
    const s = board();
    assert(walkedPikes(s), 'unchecked avoid-pikes walks a pike hex toward the hunt');
  }

  resetAiChecklist();
  {
    const s = board();
    s.aiStyles = { ...s.aiStyles, blue: 'defensive' };
    setAiRule('defensive', 'avoid-pikes', false);
    assert(walkedPikes(s), 'defensive column controls that army');
  }
} finally {
  UNIT_STATS.soldier.shoot = saved.shoot;
  UNIT_STATS.soldier.stamina = saved.stamina;
  UNIT_STATS.soldier.actions = saved.actions;
  resetAiChecklist();
}

console.log('repro-ai-checklist ok');
