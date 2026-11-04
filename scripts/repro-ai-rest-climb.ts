import { staminaLeft, type GameState } from '../src/engine';
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
    'ai-rest-climb',
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

UNIT_STATS.soldier.shoot = 0;
try {
  resetAiChecklist();
  setAiRule('aggressive', 'hold-position', false);

  {
    const from = { col: 4, row: 5 };
    const hill = neighborInDir(from, 0, 'pointy');
    const t = emptyTerrain(8, 10);
    t[hill.row][hill.col] = 'high';
    const s = army(
      [
        { type: 'soldier', col: from.col, row: from.row, side: 'blue' },
        { type: 'soldier', col: hill.col, row: hill.row, side: 'red' },
      ],
      t,
    );
    const blue = s.pieces.find((p) => p.side === 'blue' && p.type === 'soldier')!;
    blue.stamina = 0;
    assert(staminaLeft(blue) <= 0, 'setup: empty energy');
    const a = pickAiAction(s);
    assert(a?.kind === 'rest' && a.pieceId === blue.id, 'empty energy vs uphill hunt → Rest');
  }

  {
    const from = { col: 4, row: 5 };
    const flat = neighborInDir(from, 0, 'pointy');
    const s = army([
      { type: 'soldier', col: from.col, row: from.row, side: 'blue' },
      { type: 'soldier', col: flat.col, row: flat.row, side: 'red' },
    ]);
    const blue = s.pieces.find((p) => p.side === 'blue' && p.type === 'soldier')!;
    blue.stamina = 0;
    const a = pickAiAction(s);
    assert(
      a?.kind === 'move' && a.to.col === flat.col && a.to.row === flat.row,
      'empty energy vs same-height hunt still melee / closes',
    );
  }

  {
    const from = { col: 4, row: 5 };
    const hill = neighborInDir(from, 0, 'pointy');
    const t = emptyTerrain(8, 10);
    t[hill.row][hill.col] = 'high';
    const s = army(
      [
        { type: 'soldier', col: from.col, row: from.row, side: 'blue' },
        { type: 'soldier', col: hill.col, row: hill.row, side: 'red' },
      ],
      t,
    );
    const blue = s.pieces.find((p) => p.side === 'blue' && p.type === 'soldier')!;
    blue.stamina = Math.max(1, staminaLeft(blue) || UNIT_STATS.soldier.stamina);
    const a = pickAiAction(s);
    assert(
      a?.kind === 'move' && a.to.col === hill.col && a.to.row === hill.row,
      'with energy, climb-melee the uphill hunt instead of Rest',
    );
  }
} finally {
  restore();
}

console.log('repro-ai-rest-climb ok');
