import {
  allLegalActions,
  applyAction,
  hasUnitToken,
  legalHighlights,
  passTurn,
  restPiece,
  staminaLeft,
  type GameState,
} from '../src/engine';
import { neighborInDir } from '../src/hex';
import { pickAiAction } from '../src/ai';
import { resetAiChecklist, setAiRule } from '../src/ai-config';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

resetAiChecklist();
setAiRule('aggressive', 'hold-position', false);

function board(
  extra: {
    type: 'soldier' | 'archer' | 'cohort';
    col: number;
    row: number;
    side: 'red' | 'blue';
    unitTokens?: ('sleep' | 'general')[];
  }[],
): GameState {
  const s = createStateFromTerrain(
    emptyTerrain(8, 10),
    'sleep',
    'pointy',
    [
      { type: 'general', col: 0, row: 9, side: 'red' },
      ...extra,
    ],
    { blue: 'ai-enemy', red: 'player' },
  );
  s.turn = 'blue';
  s.unitsPerTurn = 6;
  return s;
}

{
  const s = board([
    { type: 'soldier', col: 3, row: 2, side: 'blue', unitTokens: ['sleep'] },
    { type: 'soldier', col: 5, row: 2, side: 'blue' },
  ]);
  const sleeper = s.pieces.find((p) => p.side === 'blue' && p.col === 3)!;
  const awake = s.pieces.find((p) => p.side === 'blue' && p.col === 5)!;
  assert(hasUnitToken(sleeper, 'sleep'), 'token stamped');
  assert(legalHighlights(s, sleeper.id).length === 0, 'sleeper has no move/shoot');
  const a = pickAiAction(s);
  assert(a, 'awake unit still acts');
  assert(a!.pieceId !== sleeper.id, 'AI plays the awake soldier first');
  assert(a!.pieceId === awake.id, 'picks the waking ally');
}

{
  const s = board([
    { type: 'soldier', col: 3, row: 4, side: 'blue', unitTokens: ['sleep'] },
  ]);
  const sleeper = s.pieces.find((p) => p.side === 'blue' && p.col === 3)!;
  assert(
    !allLegalActions(s).some((a) => a.pieceId === sleeper.id),
    'sleeper has no action',
  );
  assert(pickAiAction(s) == null, 'alone, sleeper does not rest');
  assert(restPiece(s, sleeper.id) === s, 'rest is illegal while asleep');
  sleeper.stamina = 0;
  const ended = passTurn(s);
  const still = ended.pieces.find((p) => p.id === sleeper.id)!;
  assert(hasUnitToken(still, 'sleep'), 'end turn does not wake');
  assert(staminaLeft(still) === 0, 'asleep unit does not gain stamina');
}

{
  const at = { col: 4, row: 4 };
  const foe = neighborInDir(at, 0, 'pointy');
  const s = board([
    { type: 'soldier', col: at.col, row: at.row, side: 'blue', unitTokens: ['sleep'] },
    { type: 'soldier', col: foe.col, row: foe.row, side: 'red' },
  ]);
  const sleeper = s.pieces.find((p) => p.side === 'blue' && p.col === at.col)!;
  assert(
    !allLegalActions(s).some((a) => a.kind !== 'skip' && a.pieceId === sleeper.id),
    'adjacent melee still waits',
  );
  assert(pickAiAction(s) == null, 'asleep unit does not swing');
}

{
  const s = board([
    { type: 'cohort', col: 3, row: 4, side: 'blue', unitTokens: ['sleep'] },
    { type: 'archer', col: 3, row: 8, side: 'red' },
  ]);
  const sleeper = s.pieces.find((p) => p.type === 'cohort')!;
  const archer = s.pieces.find((p) => p.type === 'archer')!;
  sleeper.hp = 3;
  s.turn = 'red';
  const shot = applyAction(s, { kind: 'shoot', pieceId: archer.id, at: { col: 3, row: 4 } });
  const woke = shot.pieces.find((p) => p.id === sleeper.id)!;
  assert(!hasUnitToken(woke, 'sleep'), 'hit drops sleep');
  shot.turn = 'blue';
  shot.actedIds = [];
  assert(legalHighlights(shot, woke.id).length > 0, 'awake unit can move');
  const a = pickAiAction(shot);
  assert(a && a.pieceId === woke.id && a.kind !== 'rest', 'woken AI does not keep resting');
}

console.log('sleep: not active until hit; no rest; no stamina');
