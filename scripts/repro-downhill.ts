import {
  applyAction,
  actionPointsLeft,
  apSpendable,
  legalHighlights,
  plusStepPlan,
  type GameState,
} from '../src/engine';
import { neighborInDir, type Hex, type HexDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function step(from: Hex, dir: HexDir, n: number): Hex {
  let h = from;
  for (let i = 0; i < n; i++) h = neighborInDir(h, dir, 'pointy');
  return h;
}

function setup(type: string, ap?: number): { s: GameState; p: GameState['pieces'][number]; land: Hex; high: Hex; beyond: Hex } {
  const land = { col: 4, row: 5 };
  const dir = 2 as HexDir;
  const high = step(land, dir, 1);
  const beyond = step(land, ((dir + 3) % 6) as HexDir, 1);
  const t = emptyTerrain(8, 10);
  t[high.row][high.col] = 'high';
  const s = createStateFromTerrain(t, 'plateau', 'pointy', [
    { type, col: high.col, row: high.row, side: 'red' },
    { type: 'general', col: 7, row: 1, side: 'red' },
    { type: 'soldier', col: 1, row: 8, side: 'blue' },
    { type: 'general', col: 1, row: 9, side: 'blue' },
  ]);
  s.turn = 'red';
  const p = s.pieces.find((x) => x.type === type && x.side === 'red')!;
  if (ap !== undefined) p.actionPoints = ap;
  return { s, p, land, high, beyond };
}

{
  const { s, p, land, beyond } = setup('cohort', 1);
  const moved = applyAction(s, { kind: 'move', pieceId: p.id, to: land });
  const live = moved.pieces.find((x) => x.id === p.id)!;
  assert(moved.downhillMove, 'drop with 1 AP grants free +1 immediately');
  assert(apSpendable(live) === 0, 'drop spent the only AP');
  assert(
    legalHighlights(moved, p.id).some(
      (h) => h.kind === 'move' && h.plus && h.hex.col === beyond.col && h.hex.row === beyond.row,
    ),
    'free +1 is highlighted',
  );
  const done = applyAction(moved, { kind: 'move', pieceId: p.id, to: beyond });
  assert(done !== moved, 'free +1 applies (no snap-back)');
  const parked = done.pieces.find((x) => x.id === p.id)!;
  assert(parked.col === beyond.col && parked.row === beyond.row, 'free +1 lands on the bonus hex');
  assert(actionPointsLeft(parked) === 0, 'free +1 spends no AP');
}

{
  const { s, p, land, beyond } = setup('cohort', 2);
  const moved = applyAction(s, { kind: 'move', pieceId: p.id, to: land });
  const live = moved.pieces.find((x) => x.id === p.id)!;
  assert(moved.downhillMove, 'drop with leftover AP still grants free +1 now');
  assert(actionPointsLeft(live) === 1, 'leftover pool AP remains');
  assert(
    legalHighlights(moved, p.id).some(
      (h) => h.kind === 'move' && h.plus && h.hex.col === beyond.col && h.hex.row === beyond.row,
    ),
    'free +1 shows before leftover AP is spent',
  );
  const done = applyAction(moved, { kind: 'move', pieceId: p.id, to: beyond });
  const parked = done.pieces.find((x) => x.id === p.id)!;
  assert(parked.col === beyond.col && parked.row === beyond.row, 'bonus hex with leftover AP');
  assert(actionPointsLeft(parked) === 1, 'bonus hex did not burn leftover AP');
  assert(!done.downhillMove, 'free +1 is consumed');
  assert(done.scoutPieceId === p.id, 'leftover AP stays on scout lock');
  assert((done.scoutActionsLeft ?? 0) === 1, 'one leftover AP action remains');
}

{
  const { s, p, land, beyond } = setup('cohort', 1);
  const plan = plusStepPlan(s, p.id, beyond);
  assert(plan && plan.landing.col === land.col && plan.landing.row === land.row, 'plus plan via drop');
  const hopped = applyAction(s, {
    kind: 'move',
    pieceId: p.id,
    to: plan!.landing,
    path: plan!.landingPath,
  });
  const finished = applyAction(hopped, {
    kind: 'move',
    pieceId: p.id,
    to: beyond,
    path: plan!.bonusPath,
  });
  assert(finished !== hopped, 'plus-click bonus applies');
  const arrived = finished.pieces.find((x) => x.id === p.id)!;
  assert(arrived.col === beyond.col && arrived.row === beyond.row, 'plus click lands');
  assert(actionPointsLeft(arrived) === 0, 'plus click is one AP total');
}

{
  const { s, p, beyond } = setup('cohort', 2);
  assert(
    legalHighlights(s, p.id).some(
      (h) => h.kind === 'plus' && h.hex.col === beyond.col && h.hex.row === beyond.row,
    ),
    'plus mark shows even when a second AP would remain after the drop',
  );
  assert(plusStepPlan(s, p.id, beyond), 'plus click works with leftover capacity');
}

console.log('downhill: free +1 applies, same-AP bonus, leftover AP after');
