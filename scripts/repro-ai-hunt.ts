import { type GameState } from '../src/engine';
import { neighborInDir } from '../src/hex';
import { UNIT_STATS } from '../src/roster';
import { pickAiAction } from '../src/ai';
import { resetAiChecklist, setAiRule } from '../src/ai-config';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const saved = {
  shoot: UNIT_STATS.soldier.shoot,
  stamina: UNIT_STATS.soldier.stamina,
};

function muteRanged(): void {
  UNIT_STATS.soldier.shoot = 0;
  UNIT_STATS.soldier.stamina = 0;
}

function restore(): void {
  UNIT_STATS.soldier.shoot = saved.shoot;
  UNIT_STATS.soldier.stamina = saved.stamina;
  resetAiChecklist();
}

function army(
  pieces: Parameters<typeof createStateFromTerrain>[3],
  terrain = emptyTerrain(8, 10),
): GameState {
  const s = createStateFromTerrain(
    terrain,
    'ai-hunt',
    'pointy',
    pieces,
    { blue: 'ai-enemy', red: 'player' },
    [],
    { blue: 'aggressive', red: 'aggressive' },
  );
  s.turn = 'blue';
  s.unitsPerTurn = 6;
  return s;
}

muteRanged();
try {
  resetAiChecklist();
  setAiRule('aggressive', 'advance-front', true);
  setAiRule('aggressive', 'keep-line', false);
  setAiRule('aggressive', 'hold-position', false);
  {
    // Blue sits below mid, so Advance wants row 0. Red is further down.
    const from = { col: 3, row: 5 };
    const s = army([
      { type: 'soldier', col: from.col, row: from.row, side: 'blue' },
      { type: 'soldier', col: 3, row: 8, side: 'red' },
    ]);
    const a = pickAiAction(s);
    assert(a?.kind === 'move', 'aggressive still marches when both hunts are on');
    assert(
      a?.kind === 'move' && a.to.row > from.row,
      'Attack beats Advance — close on the enemy, do not walk the far edge',
    );
  }

  resetAiChecklist();
  setAiRule('aggressive', 'hold-position', false);
  {
    const from = { col: 4, row: 5 };
    const near = neighborInDir(from, 1, 'pointy');
    const s = army([
      { type: 'soldier', col: from.col, row: from.row, side: 'blue' },
      { type: 'peasant', col: near.col, row: near.row, side: 'red' },
      { type: 'general', col: 4, row: 9, side: 'red' },
    ]);
    const a = pickAiAction(s);
    assert(
      a?.kind === 'move' && a.to.col === near.col && a.to.row === near.row,
      'Attack closes on the nearest unit, not the far general',
    );
  }

  resetAiChecklist();
  setAiRule('aggressive', 'hold-position', false);
  {
    const from = { col: 4, row: 5 };
    const toward = neighborInDir(from, 0, 'pointy');
    const away = neighborInDir(from, 3, 'pointy');
    const t = emptyTerrain(8, 10);
    t[away.row][away.col] = 'high';
    const s = army(
      [
        { type: 'soldier', col: from.col, row: from.row, side: 'blue' },
        { type: 'soldier', col: toward.col, row: toward.row + 1, side: 'red' },
      ],
      t,
    );
    const a = pickAiAction(s);
    assert(a?.kind === 'move', 'ridge nearby still marches');
    assert(
      a?.kind === 'move' && !(a.to.col === away.col && a.to.row === away.row),
      'prefer-high-ground does not retreat onto a ridge away from the hunt',
    );
    assert(
      a?.kind === 'move' && a.to.row > from.row,
      'no-flee still forces a step toward the nearest enemy',
    );
  }
} finally {
  restore();
}

console.log('repro-ai-hunt ok');
