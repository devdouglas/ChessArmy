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
  setAiRule('aggressive', 'hold-position', false);
  setAiRule('defensive', 'hold-position', false);

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
  setAiRule('defensive', 'hold-position', false);
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

{
  const from = { col: 4, row: 5 };
  const adj = neighborInDir(from, 0, 'pointy');
  const dual = (): GameState => {
    const s = createStateFromTerrain(
      emptyTerrain(8, 10),
      'ai-shoot-first',
      'pointy',
      [
        { type: 'soldier', col: from.col, row: from.row, side: 'blue' },
        { type: 'soldier', col: adj.col, row: adj.row, side: 'red' },
        { type: 'general', col: 1, row: 1, side: 'red' },
        { type: 'general', col: 1, row: 8, side: 'blue' },
      ],
      { blue: 'ai-enemy', red: 'player' },
      [],
      { blue: 'aggressive', red: 'aggressive' },
    );
    s.turn = 'blue';
    return s;
  };

  resetAiChecklist();
  {
    const a = pickAiAction(dual());
    assert(a?.kind === 'shoot', 'stock shoot-first shoots when melee is also legal');
    assert(
      a?.kind === 'shoot' && a.at.col === adj.col && a.at.row === adj.row,
      'stock shot is the adjacent grunt',
    );
  }
  setAiRule('aggressive', 'shoot-first', false);
  {
    const a = pickAiAction(dual());
    assert(a?.kind === 'move', 'unchecked shoot-first melees when both are legal');
    assert(
      a?.kind === 'move' && a.to.col === adj.col && a.to.row === adj.row,
      'unchecked melee is the adjacent grunt',
    );
  }
  resetAiChecklist();
}

{
  const from = { col: 4, row: 5 };
  const close = neighborInDir(from, 0, 'pointy');
  const strong = neighborInDir(neighborInDir(from, 1, 'pointy'), 1, 'pointy');
  const board = (far: { type: 'tank' | 'soldier'; unitTokens?: ['general'] }): GameState => {
    const s = createStateFromTerrain(
      emptyTerrain(8, 10),
      'ai-strongest',
      'pointy',
      [
        { type: 'soldier', col: from.col, row: from.row, side: 'blue' },
        { type: 'peasant', col: close.col, row: close.row, side: 'red' },
        {
          type: far.type,
          col: strong.col,
          row: strong.row,
          side: 'red',
          unitTokens: far.unitTokens,
        },
        { type: 'general', col: 1, row: 1, side: 'red' },
        { type: 'general', col: 1, row: 8, side: 'blue' },
      ],
      { blue: 'ai-enemy', red: 'player' },
      [],
      { blue: 'aggressive', red: 'aggressive' },
    );
    s.turn = 'blue';
    return s;
  };

  resetAiChecklist();
  {
    const a = pickAiAction(board({ type: 'tank' }));
    assert(
      a?.kind === 'shoot' && a.at.col === strong.col && a.at.row === strong.row,
      'strongest-first shoots the tank over the closer peasant',
    );
  }
  setAiRule('aggressive', 'strongest-first', false);
  {
    const a = pickAiAction(board({ type: 'tank' }));
    assert(
      a?.kind === 'shoot' && a.at.col === close.col && a.at.row === close.row,
      'unchecked strongest-first shoots the closest',
    );
  }
  resetAiChecklist();
  {
    const a = pickAiAction(board({ type: 'soldier', unitTokens: ['general'] }));
    assert(
      a?.kind === 'shoot' && a.at.col === strong.col && a.at.row === strong.row,
      'general token +1 value makes that soldier the strongest',
    );
  }
  resetAiChecklist();
}

{
  const from = { col: 4, row: 5 };
  const step = neighborInDir(from, 0, 'pointy');
  const hill = neighborInDir(step, 0, 'pointy');
  const t = emptyTerrain(8, 10);
  t[hill.row][hill.col] = 'high';
  const savedShoot = UNIT_STATS.soldier.shoot;
  UNIT_STATS.soldier.shoot = 0;
  resetAiChecklist();
  setAiRule('aggressive', 'hunt-enemy-general', false);
  setAiRule('aggressive', 'return-to-start', false);
  setAiRule('aggressive', 'hold-position', false);
  try {
    const s = createStateFromTerrain(
      t,
      'ai-high-ground',
      'pointy',
      [
        { type: 'soldier', col: from.col, row: from.row, side: 'blue' },
        { type: 'general', col: 7, row: 9, side: 'red' },
        { type: 'general', col: 1, row: 9, side: 'blue' },
      ],
      { blue: 'ai-enemy', red: 'player' },
      [],
      { blue: 'aggressive', red: 'aggressive' },
    );
    s.turn = 'blue';
    const a = pickAiAction(s);
    assert(a?.kind === 'move', 'not hunting still moves toward high ground');
    assert(
      a?.kind === 'move' &&
        ((a.to.col === step.col && a.to.row === step.row) ||
          (a.to.col === hill.col && a.to.row === hill.row)),
      'prefer-high-ground walks toward a hill within 3 when Attack is off',
    );
  } finally {
    UNIT_STATS.soldier.shoot = savedShoot;
    resetAiChecklist();
  }
}

{
  const home = { col: 4, row: 5 };
  const away = neighborInDir(home, 0, 'pointy');
  const savedShoot = UNIT_STATS.soldier.shoot;
  UNIT_STATS.soldier.shoot = 0;
  resetAiChecklist();
  setAiRule('aggressive', 'hunt-enemy-general', false);
  setAiRule('aggressive', 'prefer-high-ground', false);
  setAiRule('aggressive', 'hold-position', false);
  try {
    const s = createStateFromTerrain(
      emptyTerrain(8, 10),
      'ai-return-start',
      'pointy',
      [
        { type: 'soldier', col: away.col, row: away.row, side: 'blue' },
        { type: 'general', col: 7, row: 9, side: 'red' },
        { type: 'general', col: 1, row: 9, side: 'blue' },
      ],
      { blue: 'ai-enemy', red: 'player' },
      [],
      { blue: 'aggressive', red: 'aggressive' },
    );
    s.turn = 'blue';
    const p = s.pieces.find((x) => x.side === 'blue' && x.type === 'soldier')!;
    p.startCol = home.col;
    p.startRow = home.row;
    const a = pickAiAction(s);
    assert(a?.kind === 'move', 'not hunting walks back toward start');
    assert(
      a?.kind === 'move' && a.to.col === home.col && a.to.row === home.row,
      'return-to-start steps onto the spawn hex',
    );
  } finally {
    UNIT_STATS.soldier.shoot = savedShoot;
    resetAiChecklist();
  }
}

console.log('repro-ai-checklist ok');
