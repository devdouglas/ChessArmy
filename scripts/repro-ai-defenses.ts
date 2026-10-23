import { type GameState } from '../src/engine';
import { neighborInDir } from '../src/hex';
import { UNIT_STATS } from '../src/roster';
import { pickAiAction } from '../src/ai';
import { resetAiChecklist, setAiRule } from '../src/ai-config';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const ori = 'pointy' as const;
const start = { col: 4, row: 5 };
const mid = neighborInDir(start, 0, ori);
const cover = neighborInDir(mid, 0, ori);
const hunt = neighborInDir(cover, 0, ori);

function rocketBoard(): GameState {
  const s = createStateFromTerrain(
    emptyTerrain(8, 10),
    'ai-defenses-rocket',
    ori,
    [
      { type: 'bazooka', col: start.col, row: start.row, side: 'blue' },
      { type: 'general', col: 1, row: 1, side: 'blue' },
      { type: 'general', col: hunt.col, row: hunt.row, side: 'red' },
    ],
    { blue: 'ai-enemy', red: 'player' },
    [{ type: 'wall', col: cover.col, row: cover.row }],
    { blue: 'aggressive', red: 'aggressive' },
  );
  s.turn = 'blue';
  return s;
}

function palisadeBoard(): GameState {
  const s = createStateFromTerrain(
    emptyTerrain(8, 10),
    'ai-defenses-melee',
    ori,
    [
      { type: 'soldier', col: start.col, row: start.row, side: 'blue' },
      { type: 'general', col: 1, row: 1, side: 'blue' },
      { type: 'general', col: cover.col, row: cover.row, side: 'red' },
    ],
    { blue: 'ai-enemy', red: 'player' },
    [{ type: 'palisade', col: mid.col, row: mid.row, hp: 3 }],
    { blue: 'aggressive', red: 'aggressive' },
  );
  s.turn = 'blue';
  return s;
}

function shotWall(s: GameState) {
  const a = pickAiAction(s);
  return a?.kind === 'shoot' && a.at.col === cover.col && a.at.row === cover.row;
}

function meleePalisade(s: GameState) {
  const a = pickAiAction(s);
  return a?.kind === 'move' && a.to.col === mid.col && a.to.row === mid.row;
}

const saved = {
  shoot: UNIT_STATS.soldier.shoot,
  stamina: UNIT_STATS.soldier.stamina,
};

try {
  UNIT_STATS.soldier.shoot = 0;
  UNIT_STATS.soldier.stamina = 0;
  resetAiChecklist();
  setAiRule('aggressive', 'hold-position', false);

  {
    const s = rocketBoard();
    assert(shotWall(s), 'stock targets-defenses rockets a wall on the hunt path');
  }

  setAiRule('aggressive', 'targets-defenses', false);
  {
    const s = rocketBoard();
    assert(!shotWall(s), 'unchecked targets-defenses does not rocket that wall');
  }

  resetAiChecklist();
  setAiRule('aggressive', 'hold-position', false);
  {
    const s = palisadeBoard();
    assert(
      meleePalisade(s),
      'stock targets-defenses melees a palisade on the hunt path',
    );
  }

  setAiRule('aggressive', 'targets-defenses', false);
  setAiRule('aggressive', 'break-palisades', false);
  {
    const s = palisadeBoard();
    assert(
      !meleePalisade(s),
      'unchecked targets-defenses does not melee that palisade',
    );
  }
} finally {
  UNIT_STATS.soldier.shoot = saved.shoot;
  UNIT_STATS.soldier.stamina = saved.stamina;
  resetAiChecklist();
}

console.log('repro-ai-defenses ok');
