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
    walk(s, p.id).some((h) => h.kind === 'stamina' && h.cost === 2),
    'stamina options are a second straight 1, not a doubled ray',
  );
  const mid = applyAction(s, { kind: 'move', pieceId: p.id, to: green!.hex });
  const q = red(mid, 'soldier');
  assert(!hasActed(mid, q.id), 'no check after green move');
  assert(mid.staminaBonus, 'stamina bonus lock');
  assert(mid.scoutPieceId === q.id, 'stays the active piece');
  assert(staminaLeft(q) === 1, 'stamina not spent yet');
  assert(
    allLegalActions(mid).some((a) => a.kind === 'skip'),
    'skip is available',
  );

  const next = walk(mid, q.id)[0];
  assert(next, 'bonus action has a move');
  assert(next.kind === 'stamina', 'bonus dests are stamina');
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
  const fourHl = first.find(
    (h) => h.kind === 'stamina' && h.hex.col === four.col && h.hex.row === four.row,
  );
  assert(fourHl, '2+2 along the same axis is a stamina option');
  const fourPath = pathForMove(s, p, four);
  assert(fourPath.length === 4, '2+2 path is four hexes');
  const via = step(from, 5, 2);
  assert(
    fourPath[1].col === via.col && fourPath[1].row === via.row,
    '2+2 splits after the first action of 2',
  );
  const bent = step(step(from, 5, 1), 0, 2);
  const bentPath = pathForMove(s, p, bent);
  assert(bentPath.length === 3, '1 then 2 is allowed (leftover of action 1 is dead)');
  assert(
    !pathForMove(s, p, step(from, 5, 5)).length,
    'no 5th hex: leftover does not stack onto the extra action',
  );
  const sticky = stickyMovePlan(s, p, step(via, 0, 2), fourPath);
  assert(sticky.via, 'hover keeps the first-action waypoint');
  assert(
    sticky.path[1].col === via.col && sticky.path[1].row === via.row,
    'turning for the extra action keeps the first 2',
  );
  const three = step(from, 5, 3);
  const drawn12 = [step(from, 5, 1), step(from, 5, 2), three];
  const kept = resolveMovePath(s, p, three, drawn12);
  assert(
    kept.length === 3 && kept[0].col === drawn12[0].col && kept[0].row === drawn12[0].row,
    'move follows the drawn 1+2, not a replanned 2+1',
  );
  const walked = applyAction(s, { kind: 'move', pieceId: p.id, to: three, path: drawn12 });
  const w = red(walked, 'scout');
  assert(w.col === three.col && w.row === three.row, 'drawn path dest is occupied');
  assert(staminaLeft(w) === 0, 'following the 2-leg path spends stamina');

  const two = step(from, 5, 2);
  const afterTwo = applyAction(s, { kind: 'move', pieceId: p.id, to: two });
  const q = red(afterTwo, 'scout');
  assert(afterTwo.staminaBonus, '2-hex move still buys the extra action');
  const second = walk(afterTwo, q.id);
  assert(maxCost(second) === 2, 'second action is a fresh range 2');
  const turn = step({ col: q.col, row: q.row }, 0, 2);
  assert(
    second.some((h) => h.hex.col === turn.col && h.hex.row === turn.row),
    'second action may change direction',
  );

  const one = step(from, 5, 1);
  const afterOne = applyAction(s, { kind: 'move', pieceId: p.id, to: one });
  const r = red(afterOne, 'scout');
  const leftover = walk(afterOne, r.id);
  assert(maxCost(leftover) === 2, 'stop after 1: leftover step is dead, extra action is still 2');
  assert(
    leftover.every((h) => h.cost <= 2),
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
  const dest = step(from, 5, 4);
  assert(
    walk(s, p.id).some((h) => h.hex.col === dest.col && h.hex.row === dest.row),
    'range 2 stamina run reaches the 4th hex through 3 units',
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
  s.turn = 'blue';
  const after = runAiTurn(s, 'blue');
  assert(after.turn === 'red' || after.winner, 'AI turn completes');
  const blue = after.pieces.find((p) => p.side === 'blue' && p.type === 'soldier');
  if (blue && hasActed(after, blue.id) === false) {
    assert(!after.staminaBonus || after.turn !== 'blue', 'AI not stuck in bonus');
  }
}

console.log('stamina bonus: extra action is a fresh straight line, leftover does not carry');
