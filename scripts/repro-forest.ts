import {
  applyAction,
  hpLeft,
  isBlockedWalk,
  isForest,
  isPalisade,
  legalHighlights,
  tokenAt,
  type GameState,
} from '../src/engine';
import { neighborInDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const start = { col: 2, row: 5 };
const step = neighborInDir(start, 0, 'pointy');
const beyond = neighborInDir(step, 0, 'pointy');

function corridor(): ReturnType<typeof emptyTerrain> {
  const t = emptyTerrain(8, 10);
  for (let row = 0; row < 10; row++) {
    if (row === 5) continue;
    for (let col = 0; col < 8; col++) t[row][col] = 'rock';
  }
  return t;
}

function board(opts: {
  walker?: 'soldier' | 'scout' | 'barbarian';
  forestOcc?: boolean;
  extraBlue?: boolean;
}): GameState {
  const t = corridor();
  const armies: Parameters<typeof createStateFromTerrain>[3] = [
    { type: opts.walker ?? 'soldier', col: start.col, row: start.row, side: 'red' },
    { type: 'general', col: 0, row: 5, side: 'red' },
    { type: 'general', col: 7, row: 5, side: 'blue' },
  ];
  if (opts.forestOcc) {
    armies.push({ type: 'soldier', col: step.col, row: step.row, side: 'blue' });
  }
  if (opts.extraBlue) {
    armies.push({ type: 'soldier', col: beyond.col, row: beyond.row, side: 'blue' });
  }
  const s = createStateFromTerrain(
    t,
    'forest',
    'pointy',
    armies,
    undefined,
    [{ type: 'forest', col: step.col, row: step.row }],
  );
  s.turn = 'red';
  return s;
}

function readyAgain(s: GameState, id: string) {
  s.turn = 'red';
  s.actedIds = [];
  s.scoutPieceId = null;
  const p = s.pieces.find((x) => x.id === id);
  if (p) {
    p.movedThisTurn = false;
    p.staminaUsedThisTurn = false;
    p.shootCooldown = 0;
    p.firedThisTurn = false;
  }
}

{
  const s = board({});
  assert(isForest(s, step), 'forest token');
  assert(!isPalisade(s, step), 'forest is not a palisade');
  assert(!isBlockedWalk(s, step), 'forest is walkable');
  const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
  const after = applyAction(s, { kind: 'move', pieceId: p.id, to: step });
  assert(
    after.pieces.some((x) => x.id === p.id && x.col === step.col && x.row === step.row),
    'soldier walks onto forest',
  );
  assert(tokenAt(after.tokens, step)?.type === 'forest', 'trees stay');
}

{
  const s = board({ walker: 'scout' });
  const p = s.pieces.find((x) => x.type === 'scout')!;
  assert(
    legalHighlights(s, p.id).some(
      (h) => h.kind === 'move' && h.hex.col === beyond.col && h.hex.row === beyond.row,
    ),
    'scout (no charge) walks through forest',
  );
  const after = applyAction(s, { kind: 'move', pieceId: p.id, to: beyond });
  assert(
    after.pieces.some((x) => x.id === p.id && x.col === beyond.col && x.row === beyond.row),
    'scout lands beyond forest',
  );
  assert(tokenAt(after.tokens, step)?.type === 'forest', 'walk does not chip trees');
}

{
  const s = board({ walker: 'barbarian' });
  const p = s.pieces.find((x) => x.type === 'barbarian')!;
  assert(
    legalHighlights(s, p.id).some(
      (h) => h.kind === 'move' && h.hex.col === step.col && h.hex.row === step.row,
    ),
    'charger can stop on forest',
  );
  assert(
    !legalHighlights(s, p.id).some(
      (h) =>
        h.kind === 'move' && h.hex.col === beyond.col && h.hex.row === beyond.row,
    ),
    'no single-action charge through forest',
  );
}

{
  const s = board({ forestOcc: true });
  const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
  const after = applyAction(s, { kind: 'move', pieceId: p.id, to: step });
  const victim = after.pieces.find((x) => x.side === 'blue' && x.type === 'soldier');
  assert(!victim || hpLeft(victim) < 1, 'melee hits the unit in forest');
  assert(tokenAt(after.tokens, step)?.type === 'forest', 'melee does not chip trees');
}

{
  const s = board({ forestOcc: true });
  const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
  const hid = s.pieces.find((x) => x.side === 'blue' && x.type === 'soldier')!;
  assert(
    legalHighlights(s, p.id).some(
      (h) => h.kind === 'shoot' && h.hex.col === step.col && h.hex.row === step.row,
    ),
    'can shoot a unit in forest',
  );
  const hit1 = applyAction(s, { kind: 'shoot', pieceId: p.id, at: step });
  assert(tokenAt(hit1.tokens, step)?.type === 'forest', 'trees still there');
  assert(tokenAt(hit1.tokens, step)?.hp === 2, 'forest chipped to 2');
  assert(hpLeft(hit1.pieces.find((x) => x.id === hid.id)!) === hpLeft(hid), 'occupant unharmed');
  readyAgain(hit1, p.id);
  const hit2 = applyAction(hit1, { kind: 'shoot', pieceId: p.id, at: step });
  assert(tokenAt(hit2.tokens, step)?.hp === 1, 'forest chipped to 1');
  readyAgain(hit2, p.id);
  const hit3 = applyAction(hit2, { kind: 'shoot', pieceId: p.id, at: step });
  assert(!tokenAt(hit3.tokens, step), 'third shot fells the forest');
  assert(hpLeft(hit3.pieces.find((x) => x.id === hid.id)!) === hpLeft(hid), 'still unharmed on fell');
  readyAgain(hit3, p.id);
  const hit4 = applyAction(hit3, { kind: 'shoot', pieceId: p.id, at: step });
  const after = hit4.pieces.find((x) => x.id === hid.id);
  assert(!after || hpLeft(after) < hpLeft(hid), 'fourth shot hits the unit');
}

{
  const s = board({ extraBlue: true });
  const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
  assert(
    !legalHighlights(s, p.id).some(
      (h) => h.kind === 'shoot' && h.hex.col === beyond.col && h.hex.row === beyond.row,
    ),
    'straight LOS blocked by forest',
  );
}

{
  const t = corridor();
  const s = createStateFromTerrain(
    t,
    'forest-arch',
    'pointy',
    [
      { type: 'archer', col: start.col, row: start.row, side: 'red' },
      { type: 'soldier', col: beyond.col, row: beyond.row, side: 'blue' },
      { type: 'general', col: 0, row: 5, side: 'red' },
      { type: 'general', col: 7, row: 5, side: 'blue' },
    ],
    undefined,
    [{ type: 'forest', col: step.col, row: step.row }],
  );
  s.turn = 'red';
  const bow = s.pieces.find((x) => x.type === 'archer')!;
  assert(
    legalHighlights(s, bow.id).some(
      (h) => h.kind === 'shoot' && h.hex.col === beyond.col && h.hex.row === beyond.row,
    ),
    'arch fires over forest',
  );
}

{
  const t = corridor();
  const s = createStateFromTerrain(
    t,
    'forest-out',
    'pointy',
    [
      { type: 'soldier', col: start.col, row: start.row, side: 'red' },
      { type: 'soldier', col: step.col, row: step.row, side: 'blue' },
      { type: 'general', col: 0, row: 5, side: 'red' },
      { type: 'general', col: 7, row: 5, side: 'blue' },
    ],
    undefined,
    [{ type: 'forest', col: step.col, row: step.row }],
  );
  s.turn = 'blue';
  const blue = s.pieces.find((x) => x.side === 'blue' && x.type === 'soldier')!;
  assert(
    legalHighlights(s, blue.id).some(
      (h) => h.kind === 'shoot' && h.hex.col === start.col && h.hex.row === start.row,
    ),
    'unit in forest can shoot out',
  );
}

console.log('forest: walkable cover, 3 shot HP, shoot out, no charge through');
