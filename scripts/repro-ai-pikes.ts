import { allLegalActions, type GameState } from '../src/engine';
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

function board(
  tokens: { type: 'pikes'; col: number; row: number }[],
  extra: { type: 'soldier' | 'general'; col: number; row: number; side: 'red' | 'blue' }[] = [],
): GameState {
  const s = createStateFromTerrain(
    emptyTerrain(8, 10),
    'ai-pikes',
    'pointy',
    [
      { type: 'soldier', col: start.col, row: start.row, side: 'blue' },
      { type: 'general', col: 7, row: 1, side: 'red' },
      { type: 'soldier', col: 6, row: 8, side: 'red' },
      ...extra,
    ],
    { blue: 'ai-enemy', red: 'player' },
    tokens,
  );
  s.turn = 'blue';
  const me = s.pieces.find((p) => p.side === 'blue' && p.type === 'soldier');
  if (me) me.hp = 3;
  return s;
}

function pickedMoveTo(s: GameState, col: number, row: number) {
  const a = pickAiAction(s);
  return a?.kind === 'move' && a.to.col === col && a.to.row === row;
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

  {
    const s = board([
      { type: 'pikes', col: step.col, row: step.row },
      { type: 'pikes', col: closer.col, row: closer.row },
    ]);
    assert(
      allLegalActions(s).some(
        (a) => a.kind === 'move' && a.to.col === step.col && a.to.row === step.row,
      ),
      'pike hex is a legal walk',
    );
    const a = pickAiAction(s);
    assert(a?.kind === 'move', 'AI still moves');
    assert(
      !(a.to.col === step.col && a.to.row === step.row) &&
        !(a.to.col === closer.col && a.to.row === closer.row),
      'AI does not walk onto pikes toward the hunt',
    );
  }

  {
    const s = board(
      [{ type: 'pikes', col: step.col, row: step.row }],
      [{ type: 'soldier', col: step.col, row: step.row, side: 'red' }],
    );
    const grunt = s.pieces.find((p) => p.col === step.col && p.row === step.row);
    if (grunt) grunt.hp = 1;
    assert(
      allLegalActions(s).some(
        (a) => a.kind === 'move' && a.to.col === step.col && a.to.row === step.row,
      ),
      'melee onto pikes is legal',
    );
    assert(!pickedMoveTo(s, step.col, step.row), 'AI does not melee a grunt on pikes');
  }

  {
    const s = board(
      [{ type: 'pikes', col: step.col, row: step.row }],
      [{ type: 'general', col: step.col, row: step.row, side: 'red' }],
    );
    assert(pickedMoveTo(s, step.col, step.row), 'AI walks pikes to attack the enemy general');
  }
} finally {
  UNIT_STATS.soldier.shoot = saved.shoot;
  UNIT_STATS.soldier.stamina = saved.stamina;
  UNIT_STATS.soldier.actions = saved.actions;
  resetAiChecklist();
}

console.log('repro-ai-pikes ok');
