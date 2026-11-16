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
/** Preferred hunt step for this layout (Attack toward red). */
const pref = { col: 5, row: 6 };
const step = neighborInDir(start, 0, 'pointy');

function board(
  tokens: { type: 'pikes'; col: number; row: number; owner?: 'red' | 'blue' }[],
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
  stamina: UNIT_STATS.soldier.actionPoints,
  actions: UNIT_STATS.soldier.actions,
};

try {
  UNIT_STATS.soldier.shoot = 0;
  UNIT_STATS.soldier.actionPoints = 0;
  UNIT_STATS.soldier.actions = 1;
  resetAiChecklist();
  setAiRule('aggressive', 'hold-position', false);

  {
    const s = board([{ type: 'pikes', col: pref.col, row: pref.row }]);
    assert(
      allLegalActions(s).some(
        (a) => a.kind === 'move' && a.to.col === pref.col && a.to.row === pref.row,
      ),
      'pike hex is a legal walk',
    );
    assert(!pickedMoveTo(s, pref.col, pref.row), 'AI does not walk onto visible ownerless pikes');
  }

  {
    // Enemy-planted traps are hidden — AI walks the preferred hunt step onto them.
    const s = board([{ type: 'pikes', col: pref.col, row: pref.row, owner: 'red' }]);
    assert(pickedMoveTo(s, pref.col, pref.row), 'AI walks onto enemy-planted traps it cannot see');
  }

  {
    const s = board([{ type: 'pikes', col: pref.col, row: pref.row, owner: 'blue' }]);
    assert(!pickedMoveTo(s, pref.col, pref.row), 'AI still avoids its own visible traps');
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
  UNIT_STATS.soldier.actionPoints = saved.actionPoints;
  UNIT_STATS.soldier.actions = saved.actions;
  resetAiChecklist();
}

console.log('repro-ai-pikes ok');
