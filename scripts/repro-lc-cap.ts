import {
  applyAction,
  legalHighlights,
  pathForMove,
  performMarch,
  resolveMovePath,
  setWalkOrder,
  stickyMovePlan,
} from '../src/engine';
import { neighborInDir, type Hex, type HexDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';
import { UNIT_STATS, DEFAULT_UNIT_STATS } from '../src/roster';
const type = 'lightcavalry';
UNIT_STATS[type] = {
  ...DEFAULT_UNIT_STATS.lightcavalry,
  // Cap repro: force the moveBudget=5 / AP pool shape under test.
  move: 3,
  moveBudget: 5,
  actionPointGain: 2,
  actionPointSpendCap: 2,
  actionPoints: 5,
  charge: 0,
  abilities: ['javelin'],
  passWater: true,
  passUnits: true,
  climbLevel: 1,
  unitClass: 'mounted',
  canHide: false,
  infantry: false,
  king: false,
  hexArmor: false,
};

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function step(from: Hex, dir: HexDir, n: number): Hex {
  let h = from;
  for (let i = 0; i < n; i++) h = neighborInDir(h, dir, 'pointy');
  return h;
}

function walk(s: Parameters<typeof legalHighlights>[0], id: string) {
  return legalHighlights(s, id).filter((h) => h.kind === 'move' || h.kind === 'ap');
}

function boot() {
  const from = { col: 7, row: 7 };
  const s = createStateFromTerrain(emptyTerrain(15, 15), 'lc-cap', 'pointy', [
    { type, col: from.col, row: from.row, side: 'red' },
    { type: 'general', col: 0, row: 0, side: 'red' },
    { type: 'soldier', col: 1, row: 13, side: 'blue' },
    { type: 'general', col: 14, row: 14, side: 'blue' },
  ]);
  s.turn = 'red';
  const u = s.pieces.find((x) => x.type === type)!;
  u.actionPoints = 5;
  return { s, u, from };
}

{
  const { s, u, from } = boot();
  const hits = walk(s, u.id);
  const max = hits.reduce((m, h) => Math.max(m, h.cost), 0);
  assert(max === 5, `click max should be 5, got ${max}`);
  assert(
    !hits.some((h) => h.cost >= 6),
    'no dest past move cap 5',
  );
  const six = step(from, 0, 6);
  assert(pathForMove(s, u, six).length === 0, 'no path to 6');
  const drawn = Array.from({ length: 6 }, (_, i) => step(from, 0, i + 1));
  assert(
    resolveMovePath(s, u, six, drawn).length === 0,
    'drawn 3+3 path must not beat move cap 5',
  );
  assert(stickyMovePlan(s, u, six, []).path.length === 0, 'sticky to 6 empty');
  const cheated = applyAction(s, { kind: 'move', pieceId: u.id, to: six, path: drawn });
  const parked = cheated.pieces.find((x) => x.id === u.id)!;
  assert(parked.col === from.col && parked.row === from.row, 'apply rejects dest past cap');
}

{
  const { s, u, from } = boot();
  const three = step(from, 0, 3);
  const mid = applyAction(s, { kind: 'move', pieceId: u.id, to: three });
  const q = mid.pieces.find((x) => x.id === u.id)!;
  assert(mid.scoutMoveSpent === 3, 'spent 3 after first action');
  const second = walk(mid, q.id);
  assert(
    second.every((h) => h.cost <= 2),
    'leftover after 3 is 2, not another full 3',
  );
}

{
  const { s, u, from } = boot();
  u.spendMarch = true;
  // Past click reach (5) but still on the 15×15 board.
  const dest = step(from, 0, 7);
  let next = setWalkOrder(s, u.id, dest);
  assert(!!next.pieces.find((x) => x.id === u.id)?.walkTo, 'march order sticks');
  next = performMarch(next, u.id);
  const q = next.pieces.find((x) => x.id === u.id)!;
  let walked = 0;
  let h = from;
  while (h.col !== q.col || h.row !== q.row) {
    h = neighborInDir(h, 0, 'pointy');
    walked++;
    if (walked > 20) break;
  }
  assert(walked === 5, `march+AP must stop at move cap 5, walked ${walked}`);
}

{
  // 1 spendable AP → single march chunk of 3 (no AP extra). Without the fix this
  // still ignored the cap once a follow-up click was fabricated; distance is the gate.
  const { s, u, from } = boot();
  u.apSpentThisTurn = 1;
  const dest = step(from, 0, 7);
  let next = setWalkOrder(s, u.id, dest);
  next = performMarch(next, u.id);
  const q = next.pieces.find((x) => x.id === u.id)!;
  let walked = 0;
  let h = from;
  while (h.col !== q.col || h.row !== q.row) {
    h = neighborInDir(h, 0, 'pointy');
    walked++;
    if (walked > 20) break;
  }
  assert(walked === 3, `single-chunk march walks 3, got ${walked}`);
}

console.log('light cavalry move cap 5: click, drawn path, and march all stop at 5');
