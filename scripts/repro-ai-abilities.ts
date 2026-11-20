import { type GameState, UNIT_STATS } from '../src/engine';
import { neighborInDir, type Hex, type HexDir } from '../src/hex';
import { pickAiAction } from '../src/ai';
import { resetAiChecklist, setAiRule } from '../src/ai-config';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const O = 'pointy' as const;

function at(origin: Hex, dir: HexDir, steps = 1): Hex {
  let h = origin;
  for (let i = 0; i < steps; i++) h = neighborInDir(h, dir, O);
  return h;
}

function board(
  pieces: { type: string; col: number; row: number; side: 'red' | 'blue'; facing?: HexDir }[],
  tokens: { type: 'wall' | 'palisade'; col: number; row: number }[] = [],
): GameState {
  const s = createStateFromTerrain(
    emptyTerrain(9, 9),
    'ai-abilities',
    O,
    pieces.map((p) => ({
      type: p.type as 'soldier',
      col: p.col,
      row: p.row,
      side: p.side,
      facing: p.facing,
    })),
    { blue: 'ai-enemy', red: 'player' },
    tokens,
    { blue: 'aggressive', red: 'aggressive' },
  );
  s.turn = 'blue';
  return s;
}

resetAiChecklist();
setAiRule('aggressive', 'hold-position', false);

{
  const origin: Hex = { col: 4, row: 4 };
  const front = at(origin, 0);
  const side = at(origin, 1);
  const s = board([
    { type: 'hoplite', ...origin, side: 'blue', facing: 0 },
    { type: 'soldier', ...front, side: 'red' },
    { type: 'soldier', ...side, side: 'red' },
    { type: 'soldier', col: 0, row: 0, side: 'red' },
  ]);
  const me = s.pieces.find((p) => p.side === 'blue')!;
  me.abilities = ['berserk'];
  const a = pickAiAction(s);
  assert(a?.kind === 'berserk' && a.pieceId === me.id, 'berserk when it hits multiple foes');
}

{
  const origin: Hex = { col: 4, row: 4 };
  const front = at(origin, 0);
  const s = board([
    { type: 'hoplite', ...origin, side: 'blue', facing: 0 },
    { type: 'soldier', ...front, side: 'red' },
    { type: 'soldier', col: 0, row: 0, side: 'red' },
  ]);
  const me = s.pieces.find((p) => p.side === 'blue')!;
  me.abilities = ['berserk'];
  setAiRule('aggressive', 'use-abilities', false);
  const a = pickAiAction(s);
  assert(a?.kind !== 'berserk', 'use-abilities off skips berserk');
  setAiRule('aggressive', 'use-abilities', true);
}

{
  const origin: Hex = { col: 4, row: 4 };
  const foe = at(origin, 0);
  const s = board([
    { type: 'hoplite', ...origin, side: 'blue', facing: 0 },
    { type: 'soldier', ...foe, side: 'red' },
    { type: 'soldier', col: 0, row: 0, side: 'red' },
  ]);
  const me = s.pieces.find((p) => p.side === 'blue')!;
  me.abilities = ['bash'];
  me.hp = 4;
  // Soft shove only — open ground behind. Real melee (walk) should win.
  const a = pickAiAction(s);
  assert(a?.kind !== 'bash', 'shove-only bash is not treated as an attack');
  assert(
    a?.kind === 'move' && a.to.col === foe.col && a.to.row === foe.row,
    'shove-only bash loses to walk melee',
  );
}

{
  const origin: Hex = { col: 4, row: 4 };
  const foe = at(origin, 0);
  const past = at(origin, 0, 2);
  const side = at(origin, 1);
  const s = board(
    [
      { type: 'hoplite', ...origin, side: 'blue', facing: 0 },
      { type: 'soldier', ...foe, side: 'red' },
      { type: 'soldier', ...side, side: 'red' },
      { type: 'soldier', col: 0, row: 8, side: 'red' },
    ],
    [{ type: 'wall', ...past }],
  );
  const me = s.pieces.find((p) => p.side === 'blue')!;
  me.abilities = ['bash'];
  me.hp = 6;
  // Slam one foe into a wall; another on a green face if armor allows — prefer bash.
  // Hoplite hex armor: only green faces bash. Force flat armor 0 so both fronts bash.
  const saved = {
    hex: UNIT_STATS.hoplite.hexArmor,
    armor: UNIT_STATS.hoplite.armor,
  };
  UNIT_STATS.hoplite.hexArmor = false;
  UNIT_STATS.hoplite.armor = 0;
  try {
    const a = pickAiAction(s);
    assert(a?.kind === 'bash' && a.pieceId === me.id, 'damaging bash when it slams into a wall');
  } finally {
    UNIT_STATS.hoplite.hexArmor = saved.hex;
    UNIT_STATS.hoplite.armor = saved.armor;
  }
}

{
  const origin: Hex = { col: 4, row: 4 };
  const adj = at(origin, 0);
  const s = board([
    { type: 'cohort', ...origin, side: 'blue', facing: 0 },
    { type: 'soldier', ...adj, side: 'red' },
    { type: 'soldier', col: 0, row: 0, side: 'red' },
  ]);
  // Adjacent foe: shoot and melee both legal. Shoot-first off — use-abilities still throws.
  setAiRule('aggressive', 'shoot-first', false);
  const a = pickAiAction(s);
  assert(a?.kind === 'shoot', 'javelin kit throws when use-abilities is on even if shoot-first is off');
  setAiRule('aggressive', 'shoot-first', true);
}

resetAiChecklist();
console.log('repro-ai-abilities ok');
