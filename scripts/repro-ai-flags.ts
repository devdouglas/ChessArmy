import { allLegalActions, flagsHeldBy, type GameState } from '../src/engine';
import { distance, neighborInDir } from '../src/hex';
import { UNIT_STATS } from '../src/roster';
import { pickAiAction } from '../src/ai';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const start = { col: 4, row: 5 };
const step = neighborInDir(start, 0, 'pointy');
const step2 = neighborInDir(step, 0, 'pointy');

function board(
  tokens: { type: 'flag'; col: number; row: number; owner?: 'red' | 'blue' }[],
  extra: { type: 'soldier' | 'general'; col: number; row: number; side: 'red' | 'blue' }[] = [],
): GameState {
  const s = createStateFromTerrain(
    emptyTerrain(8, 10),
    'ai-flags',
    'pointy',
    [
      { type: 'soldier', col: start.col, row: start.row, side: 'blue' },
      { type: 'general', col: 7, row: 1, side: 'blue' },
      { type: 'general', col: 1, row: 9, side: 'red' },
      ...extra,
    ],
    { blue: 'ai-enemy', red: 'player' },
    tokens,
  );
  s.turn = 'blue';
  return s;
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

  {
    const s = board([{ type: 'flag', col: step.col, row: step.row }]);
    assert(
      allLegalActions(s).some(
        (a) => a.kind === 'move' && a.to.col === step.col && a.to.row === step.row,
      ),
      'flag hex is a legal walk',
    );
    const a = pickAiAction(s);
    assert(a?.kind === 'move', 'AI still moves');
    assert(
      !(a.to.col === step.col && a.to.row === step.row),
      'AI does not capture a free flag',
    );
    assert(flagsHeldBy(s, 'blue') === 0, 'did not start holding it');
  }

  {
    const s = board([
      { type: 'flag', col: step.col, row: step.row, owner: 'red' },
      { type: 'flag', col: 0, row: 0 },
    ]);
    assert(!s.winner, 'mixed flags do not auto-win');
    const a = pickAiAction(s);
    assert(a?.kind === 'move', 'AI still moves vs enemy flag');
    assert(
      !(a.to.col === step.col && a.to.row === step.row),
      'AI does not capture an enemy flag',
    );
  }

  {
    const s = board([
      { type: 'flag', col: step2.col, row: step2.row, owner: 'blue' },
      { type: 'flag', col: 0, row: 0 },
    ]);
    assert(!s.winner, 'own flag plus a free flag does not auto-win');
    const me = s.pieces.find((p) => p.side === 'blue' && p.type === 'soldier')!;
    const before = distance(start, step2, s.orientation);
    const a = pickAiAction(s);
    assert(a?.kind === 'move' && a.pieceId === me.id, 'army walks toward own flag');
    const after = distance(a.to, step2, s.orientation);
    assert(after < before, 'AI closes on the flag it already holds');
  }

  {
    const s = board(
      [
        { type: 'flag', col: step.col, row: step.row },
        { type: 'flag', col: 0, row: 0 },
      ],
      [{ type: 'general', col: step.col, row: step.row, side: 'red' }],
    );
    const a = pickAiAction(s);
    assert(
      a?.kind === 'move' && a.to.col === step.col && a.to.row === step.row,
      'AI still walks a flag hex to hit the enemy general',
    );
  }
} finally {
  UNIT_STATS.soldier.shoot = saved.shoot;
  UNIT_STATS.soldier.stamina = saved.stamina;
  UNIT_STATS.soldier.actions = saved.actions;
}

console.log('repro-ai-flags ok');
