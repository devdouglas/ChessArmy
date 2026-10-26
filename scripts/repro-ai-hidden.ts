import {
  aiStyleOf,
  isConcealed,
  previewMove,
  type GameState,
} from '../src/engine';
import { pickAiAction } from '../src/ai';
import { resetAiChecklist } from '../src/ai-config';
import { neighborInDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

resetAiChecklist();

const red = { col: 4, row: 4 };
const woods = neighborInDir(red, 0, 'pointy');

function campBoard(): GameState {
  const s = createStateFromTerrain(
    emptyTerrain(9, 11),
    'hide-ai-camp',
    'pointy',
    [
      { type: 'soldier', col: 4, row: 1, side: 'red' },
      { type: 'barbarian', col: 4, row: 8, side: 'blue' },
      { type: 'soldier', col: 1, row: 9, side: 'blue' },
    ],
    { blue: 'ai-enemy', red: 'player' },
    [{ type: 'forest', col: 4, row: 8 }],
    { blue: 'aggressive', red: 'aggressive' },
  );
  s.turn = 'blue';
  s.unitsPerTurn = 6;
  return s;
}

{
  const s = campBoard();
  const barb = s.pieces.find((p) => p.type === 'barbarian')!;
  assert(isConcealed(s, barb), 'forest barbarian starts concealed');
  const a = pickAiAction(s);
  assert(a, 'visible soldier still acts');
  assert(a!.pieceId !== barb.id, 'hidden unit does not walk while a visible unit can act');
  assert(isConcealed(s, barb), 'camping did not break hide');
}

{
  const s = createStateFromTerrain(
    emptyTerrain(9, 11),
    'hide-ai-ambush',
    'pointy',
    [
      { type: 'soldier', col: red.col, row: red.row, side: 'red' },
      { type: 'barbarian', col: woods.col, row: woods.row, side: 'blue' },
      { type: 'dummy', col: 0, row: 10, side: 'blue' },
    ],
    { blue: 'ai-enemy', red: 'player' },
    [{ type: 'forest', col: woods.col, row: woods.row }],
    { blue: 'defensive', red: 'aggressive' },
  );
  s.turn = 'blue';
  s.unitsPerTurn = 6;
  const barb = s.pieces.find((p) => p.type === 'barbarian')!;
  assert(isConcealed(s, barb), 'ambusher still hidden');
  const a = pickAiAction(s);
  assert(a?.kind === 'move' && a.pieceId === barb.id, 'hidden melee when adjacent');
  if (a.kind !== 'move') throw new Error('narrow');
  const plan = previewMove(s, barb, a.to);
  assert(
    plan.hits.some((h) => h.id.startsWith('red-soldier')),
    'charge/melee actually hits the adjacent soldier',
  );
}

{
  const s = createStateFromTerrain(
    emptyTerrain(9, 11),
    'hide-ai-shoot',
    'pointy',
    [
      { type: 'soldier', col: 4, row: 1, side: 'red' },
      {
        type: 'archer',
        col: 4,
        row: 4,
        side: 'blue',
        unitTokens: ['hidden'],
      },
      { type: 'dummy', col: 0, row: 10, side: 'blue' },
    ],
    { blue: 'ai-enemy', red: 'player' },
    [],
    { blue: 'advance', red: 'aggressive' },
  );
  s.turn = 'blue';
  s.unitsPerTurn = 6;
  const bow = s.pieces.find((p) => p.type === 'archer')!;
  assert(isConcealed(s, bow), 'hidden-token archer starts concealed');
  const a = pickAiAction(s);
  assert(a?.kind === 'shoot' && a.pieceId === bow.id, 'hidden shoot when in range');
  assert(a.kind === 'shoot' && a.at.col === 4 && a.at.row === 1, 'looses at the soldier');
}

{
  const s = campBoard();
  s.aiStyles = { ...s.aiStyles, blue: 'defensive' };
  s.pieces = s.pieces.filter((p) => !(p.side === 'blue' && p.type === 'soldier'));
  const barb = s.pieces.find((p) => p.type === 'barbarian')!;
  assert(isConcealed(s, barb), 'still hidden after the last visible ally dies');
  const a = pickAiAction(s);
  assert(!isConcealed(s, barb), 'only-hidden army breaks cover');
  assert(barb.revealed, 'revealed flag set');
  assert(aiStyleOf(s, 'blue') === 'aggressive', 'that AI snaps to aggressive');
  assert(a?.kind === 'move' && a.pieceId === barb.id, 'aggressive last-stand marches');
}

{
  const s = createStateFromTerrain(
    emptyTerrain(9, 11),
    'hide-ai-all',
    'pointy',
    [
      { type: 'barbarian', col: 2, row: 2, side: 'red' },
      { type: 'barbarian', col: 6, row: 8, side: 'blue' },
    ],
    { blue: 'ai-enemy', red: 'player' },
    [
      { type: 'forest', col: 2, row: 2 },
      { type: 'forest', col: 6, row: 8 },
    ],
    { blue: 'defensive', red: 'defensive' },
  );
  assert(
    s.pieces.every((p) => !isConcealed(s, p)),
    'kickoff unhides when only hidden units remain',
  );
  assert(aiStyleOf(s, 'blue') === 'aggressive', 'AI side goes aggressive');
  assert(aiStyleOf(s, 'red') === 'defensive', 'human style unchanged');
}

{
  const s = createStateFromTerrain(
    emptyTerrain(11, 11),
    'hide-ai-ambush-army',
    'pointy',
    [
      { type: 'archer', col: 5, row: 9, side: 'red', unitTokens: ['general'] },
      { type: 'wolf', col: 2, row: 5, side: 'blue' },
      { type: 'wolf', col: 8, row: 4, side: 'blue' },
    ],
    { blue: 'ai-enemy', red: 'player' },
    [
      { type: 'forest', col: 2, row: 5 },
      { type: 'forest', col: 8, row: 4 },
    ],
    { blue: 'aggressive', red: 'aggressive' },
  );
  s.turn = 'blue';
  s.unitsPerTurn = 5;
  const wolves = s.pieces.filter((p) => p.type === 'wolf');
  assert(wolves.length === 2 && wolves.every((p) => isConcealed(s, p)), 'ambush wolves start hidden');
  const a = pickAiAction(s);
  assert(
    !a || a.kind === 'skip' || a.kind === 'rest',
    'hidden ambush army does not walk',
  );
  assert(
    wolves.every((p) => isConcealed(s, p)),
    'kickoff ambush stays camped',
  );
}

resetAiChecklist();
console.log('repro-ai-hidden ok');
