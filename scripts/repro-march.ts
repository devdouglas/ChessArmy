import {
  getPiece,
  marchRoute,
  passTurn,
  performMarch,
  restPiece,
  setWalkOrder,
  type GameState,
} from '../src/engine';
import { isExperimentalOn, resetExperimental, setExperimental } from '../src/experimental';
import { defaultFacing, neighborInDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';
import { UNIT_STATS } from '../src/roster';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function board(): GameState {
  const s = createStateFromTerrain(emptyTerrain(10, 10), 'march', 'pointy', [
    { type: 'soldier', col: 4, row: 5, side: 'red' },
    { type: 'soldier', col: 0, row: 0, side: 'blue' },
  ]);
  s.turn = 'red';
  return s;
}

function forward(s: GameState, steps: number) {
  const p = s.pieces.find((x) => x.side === 'red')!;
  const facing = defaultFacing('red');
  const path = [];
  let cur = { col: p.col, row: p.row };
  for (let i = 0; i < steps; i++) {
    cur = neighborInDir(cur, facing, s.orientation);
    path.push(cur);
  }
  return { piece: p, path, facing };
}

const savedMove = UNIT_STATS.soldier.move;

try {
  UNIT_STATS.soldier.move = 2;
  resetExperimental();
  assert(!isExperimentalOn('walk-orders'), 'march orders default off');

  const off = board();
  const offLine = forward(off, 4);
  offLine.piece.walkTo = offLine.path[3];
  const offAfter = passTurn(off);
  const offPiece = getPiece(offAfter, offLine.piece.id)!;
  assert(
    offPiece.col === offLine.piece.col && offPiece.row === offLine.piece.row,
    'feature off: standing order does not move',
  );

  setExperimental('walk-orders', true);
  const s = board();
  const line = forward(s, 4);
  const ordered = setWalkOrder(s, line.piece.id, line.path[3]!);
  const mover = getPiece(ordered, line.piece.id)!;
  assert(mover.walkTo && mover.walkTo.col === line.path[3]!.col, 'order stored');
  const route = marchRoute(ordered, mover, mover.walkTo!)!;
  assert(route.length === 4, `straight route is 4, got ${route?.length}`);

  let cur = ordered;
  cur = passTurn(cur);
  let at = getPiece(cur, mover.id)!;
  assert(at.col === line.path[1]!.col && at.row === line.path[1]!.row, 'first turn walks move 2');
  assert(at.walkTo, 'order remains until arrival');
  assert(cur.turn === 'blue', 'turn passed after the march');
  cur = passTurn(cur);
  assert(cur.turn === 'red', 'blue pass returns to red');
  cur = passTurn(cur);
  at = getPiece(cur, mover.id)!;
  assert(at.col === line.path[3]!.col && at.row === line.path[3]!.row, 'second red turn arrives');
  assert(!at.walkTo, 'order clears on arrival');

  const blocked = board();
  const around = forward(blocked, 4);
  blocked.terrain[around.path[1]!.row][around.path[1]!.col] = 'wall';
  const aroundOrder = setWalkOrder(blocked, around.piece.id, around.path[3]!);
  const aroundPiece = getPiece(aroundOrder, around.piece.id)!;
  const aroundRoute = marchRoute(aroundOrder, aroundPiece, around.path[3]!)!;
  assert(aroundRoute.length > 0, 'route exists around the wall');
  assert(
    !aroundRoute.some((h) => h.col === around.path[1]!.col && h.row === around.path[1]!.row),
    'route does not step on the wall',
  );

  const rested = board();
  const restLine = forward(rested, 3);
  let restState = setWalkOrder(rested, restLine.piece.id, restLine.path[2]!);
  restState = restPiece(restState, restLine.piece.id);
  const restedPiece = getPiece(restState, restLine.piece.id)!;
  assert(
    restedPiece.col === restLine.piece.col && restedPiece.row === restLine.piece.row,
    'rest is another order: no march that turn',
  );
  assert(restedPiece.walkTo, 'march order survives a rest');

  const stepped = board();
  const stepLine = forward(stepped, 4);
  let steppedState = setWalkOrder(stepped, stepLine.piece.id, stepLine.path[3]!);
  steppedState = performMarch(steppedState, stepLine.piece.id);
  const steppedPiece = getPiece(steppedState, stepLine.piece.id)!;
  assert(
    steppedPiece.col === stepLine.path[1]!.col && steppedPiece.row === stepLine.path[1]!.row,
    'ordering them walks one speed chunk now',
  );
  assert(steppedState.turn === 'blue', 'that step spends the activation');
  assert(steppedPiece.walkTo, 'order stays after the first step');
} finally {
  UNIT_STATS.soldier.move = savedMove;
  resetExperimental();
}

console.log('walk-to orders: route, speed, wall, rest');
