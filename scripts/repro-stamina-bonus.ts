import {
  allLegalActions,
  applyAction,
  hasActed,
  legalHighlights,
  pathForMove,
  resolveMovePath,
  stickyMovePlan,
  staminaLeft,
  type GameState,
} from '../src/engine';
import { neighborInDir, type Hex, type HexDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';
import { runAiTurn } from '../src/ai';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function boot(opts?: { type?: string; high?: Hex }): GameState {
  const t = emptyTerrain(11, 11);
  if (opts?.high) t[opts.high.row][opts.high.col] = 'high';
  const kind = opts?.type ?? 'soldier';
  const s = createStateFromTerrain(t, 'stam-bonus', 'pointy', [
    { type: kind, col: 5, row: 5, side: 'red' },
    { type: 'general', col: 0, row: 0, side: 'red' },
    { type: 'soldier', col: 1, row: 9, side: 'blue' },
    { type: 'general', col: 10, row: 10, side: 'blue' },
  ]);
  s.turn = 'red';
  s.unitsPerTurn = 2;
  return s;
}

function red(s: GameState, type: string) {
  return s.pieces.find((p) => p.side === 'red' && p.type === type)!;
}

function walk(s: GameState, id: string) {
  return legalHighlights(s, id).filter(
    (h) => h.kind === 'move' || h.kind === 'stamina',
  );
}

function maxCost(hits: { cost: number }[]) {
  return hits.reduce((m, h) => Math.max(m, h.cost), 0);
}

function step(from: Hex, dir: HexDir, n: number): Hex {
  let h = from;
  for (let i = 0; i < n; i++) h = neighborInDir(h, dir, 'pointy');
  return h;
}

{
  const s = boot();
  const p = red(s, 'soldier');
  const green = walk(s, p.id).find((h) => h.kind === 'move');
  assert(green, 'soldier has a green move');
  assert(
    walk(s, p.id).filter((h) => h.kind === 'move').every((h) => h.cost === 1),
    'green dests are this action only (range 1)',
  );
  assert(
    walk(s, p.id).some((h) => h.kind === 'stamina' && h.extra && h.cost === 2),
    'stamina options are a second straight 1, not a doubled ray',
  );
  assert(
    walk(s, p.id).filter((h) => h.kind === 'stamina').every((h) => h.extra),
    'flat-board gold dests are extras',
  );
  const mid = applyAction(s, { kind: 'move', pieceId: p.id, to: green!.hex });
  const q = red(mid, 'soldier');
  assert(!hasActed(mid, q.id), 'no check after green move');
  assert(mid.staminaBonus, 'stamina bonus lock');
  assert(mid.turn === 'red', 'quota 2: first unit still hangs for extra');
  assert(mid.scoutPieceId === q.id, 'stays the active piece');
  assert(staminaLeft(q) === 1, 'stamina not spent yet');
  assert(
    allLegalActions(mid).some((a) => a.kind === 'skip'),
    'skip is available',
  );

  const next = walk(mid, q.id)[0];
  assert(next, 'bonus action has a move');
  assert(next.kind === 'stamina', 'bonus dests are stamina');
  assert(next.extra, 'bonus dests are extra');
  const done = applyAction(mid, { kind: 'move', pieceId: q.id, to: next.hex });
  const r = red(done, 'soldier');
  assert(hasActed(done, r.id), 'check after second action');
  assert(!done.staminaBonus, 'bonus lock cleared');
  assert(staminaLeft(r) === 0, 'second action spent 1 stamina');
}

{
  const from = { col: 5, row: 5 };
  const high = neighborInDir(from, 0, 'pointy');
  const s = boot({ high });
  const p = red(s, 'soldier');
  const gold = walk(s, p.id).find(
    (h) => h.kind === 'stamina' && h.hex.col === high.col && h.hex.row === high.row,
  );
  assert(gold, 'climb is a gold stamina move');
  assert(!gold.extra, 'climb is this-action gold, not a second action');
  const after = applyAction(s, { kind: 'move', pieceId: p.id, to: gold!.hex });
  const q = red(after, 'soldier');
  assert(hasActed(after, q.id), 'gold first move ends the activation');
  assert(!after.staminaBonus, 'no bonus after spending stamina');
  assert(staminaLeft(q) === 0, 'gold move spent stamina');
}

{
  const s = boot();
  const p = red(s, 'soldier');
  const green = walk(s, p.id).find((h) => h.kind === 'move')!;
  const mid = applyAction(s, { kind: 'move', pieceId: p.id, to: green.hex });
  const skipped = applyAction(mid, { kind: 'skip' });
  const q = red(skipped, 'soldier');
  assert(hasActed(skipped, q.id), 'skip still finishes the unit');
  assert(staminaLeft(q) === 1, 'skip does not spend stamina');
}

{
  const s = boot({ type: 'scout' });
  const p = red(s, 'scout');
  const from = { col: p.col, row: p.row };
  const first = walk(s, p.id);
  const greenFirst = first.filter((h) => h.kind === 'move');
  assert(maxCost(greenFirst) === 2, 'this-action dests are range 2, not 4');
  assert(
    greenFirst.every((h) => h.cost <= 2),
    'green dests never include leftover-carry steps',
  );
  const four = step(from, 5, 4);
  assert(
    !first.some((h) => h.hex.col === four.col && h.hex.row === four.row),
    'first action cannot spend stamina: 2+2 is not on the first click',
  );

  const two = step(from, 5, 2);
  const afterTwo = applyAction(s, { kind: 'move', pieceId: p.id, to: two });
  const q = red(afterTwo, 'scout');
  assert(!afterTwo.staminaBonus, 'first scout action does not buy the stamina extra');
  assert(afterTwo.scoutPieceId === q.id, 'stays the active piece');
  assert(afterTwo.scoutActionsLeft === 1, 'one action point left');
  assert(staminaLeft(q) === staminaLeft(p), 'stamina unused until action points are gone');
  const at = { col: q.col, row: q.row };
  const second = walk(afterTwo, q.id);
  const greenSecond = second.filter((h) => h.kind === 'move');
  assert(maxCost(greenSecond) === 1, 'move cap leftover after 2 is 1');
  const oneMore = step(at, 5, 1);
  assert(
    second.some((h) => h.kind === 'move' && h.hex.col === oneMore.col && h.hex.row === oneMore.row),
    'last action point can walk the leftover hex without stamina',
  );
  const turn = step(at, 0, 1);
  assert(
    second.some((h) => h.hex.col === turn.col && h.hex.row === turn.row),
    'second action may change direction',
  );
  const threeMore = step(at, 5, 3);
  assert(
    second.some(
      (h) => h.kind === 'stamina' && h.hex.col === threeMore.col && h.hex.row === threeMore.row,
    ),
    'last action + stamina is a 1+2 option',
  );
  assert(
    !second.some((h) => {
      const far = step(at, 5, 4);
      return h.hex.col === far.col && h.hex.row === far.row;
    }),
    'no 4th hex from here: last AP is 1, extra is 2',
  );
  const stamPath = pathForMove(afterTwo, q, threeMore);
  assert(stamPath.length === 3, '1+2 path is three hexes');
  const via = oneMore;
  assert(
    stamPath[0].col === via.col && stamPath[0].row === via.row,
    '1+2 splits after the last action of 1',
  );
  const bent = step(oneMore, 0, 2);
  const bentPath = pathForMove(afterTwo, q, bent);
  assert(bentPath.length === 3, '1 then 2 is allowed');
  assert(
    !pathForMove(afterTwo, q, step(at, 5, 4)).length,
    'no 4th hex: leftover does not stack onto the extra action',
  );
  const sticky = stickyMovePlan(afterTwo, q, step(via, 0, 2), stamPath);
  assert(sticky.via, 'hover keeps the last-action waypoint');
  assert(
    sticky.path[0].col === via.col && sticky.path[0].row === via.row,
    'turning for the extra action keeps the last 1',
  );
  const drawn12 = [oneMore, step(at, 5, 2), threeMore];
  const kept = resolveMovePath(afterTwo, q, threeMore, drawn12);
  assert(
    kept.length === 3 && kept[0].col === drawn12[0].col && kept[0].row === drawn12[0].row,
    'move follows the drawn 1+2',
  );
  const walked = applyAction(afterTwo, {
    kind: 'move',
    pieceId: q.id,
    to: threeMore,
    path: drawn12,
  });
  const w = red(walked, 'scout');
  assert(w.col === threeMore.col && w.row === threeMore.row, 'drawn path dest is occupied');
  assert(staminaLeft(w) === 0, 'following the 2-leg path spends stamina');
  assert(hasActed(walked, w.id), 'last action + stamina finishes the unit');

  const lastGreen = applyAction(afterTwo, { kind: 'move', pieceId: q.id, to: oneMore });
  const last = red(lastGreen, 'scout');
  assert(lastGreen.staminaBonus, 'spending the last action point buys the stamina extra');
  assert(staminaLeft(last) === staminaLeft(q), 'stamina not spent until the extra is taken');

  const one = step(from, 5, 1);
  const afterOne = applyAction(s, { kind: 'move', pieceId: p.id, to: one });
  const r = red(afterOne, 'scout');
  assert(!afterOne.staminaBonus, 'short first action still leaves an action point');
  const leftover = walk(afterOne, r.id);
  assert(maxCost(leftover.filter((h) => h.kind === 'move')) === 2, 'stop after 1: leftover step is dead, next action is still 2');
  assert(
    leftover.filter((h) => h.kind === 'move').every((h) => h.cost <= 2),
    'no 3rd/4th hex from the first action leftover',
  );
}

{
  const from = { col: 5, row: 5 };
  const s = createStateFromTerrain(emptyTerrain(11, 11), 'run-through', 'pointy', [
    { type: 'scout', col: 5, row: 5, side: 'red' },
    { type: 'soldier', ...step(from, 5, 1), side: 'red' },
    { type: 'soldier', ...step(from, 5, 2), side: 'red' },
    { type: 'soldier', ...step(from, 5, 3), side: 'red' },
    { type: 'general', col: 0, row: 0, side: 'red' },
    { type: 'soldier', col: 1, row: 9, side: 'blue' },
    { type: 'general', col: 10, row: 10, side: 'blue' },
  ]);
  s.turn = 'red';
  s.unitsPerTurn = 2;
  const p = s.pieces.find((x) => x.type === 'scout')!;
  s.scoutPieceId = p.id;
  s.scoutActionsLeft = 1;
  const dest = step(from, 5, 4);
  assert(
    walk(s, p.id).some((h) => h.hex.col === dest.col && h.hex.row === dest.row),
    'last action + stamina run reaches the 4th hex through 3 units',
  );
  const path = pathForMove(s, p, dest);
  assert(path.length === 4, 'straight run path is 2+2 through the line');
  const after = applyAction(s, { kind: 'move', pieceId: p.id, to: dest, path });
  const q = after.pieces.find((x) => x.id === p.id)!;
  assert(q.col === dest.col && q.row === dest.row, 'ends on the 4th square');
  assert(
    after.pieces.filter((x) => x.side === 'red' && x.type === 'soldier').length === 3,
    'passed units are still there',
  );
  assert(
    path.some((h) => h.col === step(from, 5, 2).col && h.row === step(from, 5, 2).row),
    'straight run passes the unit on the action-break hex',
  );
}

{
  const s = boot();
  s.unitsPerTurn = 1;
  const p = red(s, 'soldier');
  const green = walk(s, p.id).find((h) => h.kind === 'move')!;
  const after = applyAction(s, { kind: 'move', pieceId: p.id, to: green.hex });
  assert(after.turn === 'red', 'last unit green move stays the side');
  assert(after.staminaBonus, 'last unit unused stamina hangs for Spend stamina');
  assert(staminaLeft(red(after, 'soldier')) === 1, 'extra not spent until taken');
}

{
  const s = boot();
  s.turn = 'blue';
  const after = runAiTurn(s, 'blue');
  assert(after.turn === 'red' || after.winner, 'AI turn completes');
  const blue = after.pieces.find((p) => p.side === 'blue' && p.type === 'soldier');
  if (blue && hasActed(after, blue.id) === false) {
    assert(!after.staminaBonus || after.turn !== 'blue', 'AI not stuck in bonus');
  }
}

console.log('stamina bonus: extra action is a fresh straight line, leftover does not carry');
