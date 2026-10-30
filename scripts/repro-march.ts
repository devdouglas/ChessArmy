import { pickAiAction } from '../src/ai';
import {
  beginSideTurn,
  getPiece,
  isAiControlled,
  marchRoute,
  passTurn,
  performMarch,
  restPiece,
  setMarchDoubleTime,
  setWalkOrder,
  staminaLeft,
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

  const fight = board();
  const fightLine = forward(fight, 1);
  const foe = fight.pieces.find((p) => p.side === 'blue')!;
  fight.pieces.push({ ...foe, id: `${foe.id}-spare`, col: 0, row: 0, hp: 1 });
  foe.col = fightLine.path[0]!.col;
  foe.row = fightLine.path[0]!.row;
  foe.hp = 3;
  let fightState = setWalkOrder(fight, fightLine.piece.id, fightLine.path[0]!);
  const fighter = getPiece(fightState, fightLine.piece.id)!;
  const fightRoute = marchRoute(fightState, fighter, fightLine.path[0]!)!;
  assert(fightRoute.length === 1, 'enemy hex is a march destination');
  for (const hp of [2, 1]) {
    fightState = passTurn(fightState);
    const still = getPiece(fightState, foe.id)!;
    assert(still.hp === hp, `melee chips the defender to ${hp}, got ${still.hp}`);
    const red = getPiece(fightState, fighter.id)!;
    assert(red.col === fightLine.piece.col && red.row === fightLine.piece.row, 'survivor keeps the attacker off the hex');
    assert(red.walkTo, 'order stays until the defender dies');
    fightState = passTurn(fightState);
  }
  fightState = passTurn(fightState);
  assert(!getPiece(fightState, foe.id), 'third strike kills');
  const taker = getPiece(fightState, fighter.id)!;
  assert(taker.col === foe.col && taker.row === foe.row, 'kill takes the destination');
  assert(!taker.walkTo, 'order clears once the hex is taken');

  const wood = board();
  const woodLine = forward(wood, 1);
  const gate = woodLine.path[0]!;
  wood.tokens = [...wood.tokens, { type: 'palisade', col: gate.col, row: gate.row, hp: 3 }];
  let woodState = setWalkOrder(wood, woodLine.piece.id, gate);
  const chopper = getPiece(woodState, woodLine.piece.id)!;
  assert(marchRoute(woodState, chopper, gate)?.length === 1, 'palisade is a march destination');
  woodState = passTurn(woodState);
  woodState = passTurn(woodState);
  woodState = passTurn(woodState);
  const gateTok = woodState.tokens.find((t) => t.col === gate.col && t.row === gate.row && t.type === 'palisade');
  assert(gateTok?.hp === 1, `two strikes leave the palisade on 1, got ${gateTok?.hp}`);
  const chopperMid = getPiece(woodState, chopper.id)!;
  assert(chopperMid.col === woodLine.piece.col && chopperMid.walkTo, 'palisade holds until it breaks');
  woodState = passTurn(woodState);
  woodState = passTurn(woodState);
  assert(
    !woodState.tokens.some((t) => t.type === 'palisade' && t.col === gate.col && t.row === gate.row),
    'third strike breaks the palisade',
  );
  const chopperDone = getPiece(woodState, chopper.id)!;
  assert(chopperDone.col === gate.col && chopperDone.row === gate.row, 'breaking it takes the hex');
  assert(!chopperDone.walkTo, 'order clears once the token is gone');

  const rush = board();
  const rushLine = forward(rush, 2);
  const rushee = rush.pieces.find((p) => p.side === 'blue')!;
  rush.pieces.push({ ...rushee, id: `${rushee.id}-far`, col: 0, row: 0, hp: 1 });
  rushee.col = rushLine.path[1]!.col;
  rushee.row = rushLine.path[1]!.row;
  rushee.hp = 1;
  const rushState = performMarch(
    setWalkOrder(rush, rushLine.piece.id, rushLine.path[1]!),
    rushLine.piece.id,
  );
  const rushed = getPiece(rushState, rushLine.piece.id)!;
  assert(
    rushed.col === rushee.col && rushed.row === rushee.row,
    'in-range march walks up and takes the kill',
  );
  assert(!getPiece(rushState, rushee.id), 'in-range march kills on the way in');
  assert(!rushed.walkTo, 'order clears after the kill');

  const squad = board();
  squad.unitsPerTurn = 4;
  const leader = squad.pieces.find((p) => p.side === 'red')!;
  const face = defaultFacing('red');
  const wing = {
    ...leader,
    id: `${leader.id}-wing`,
    col: leader.col + 1,
    row: leader.row,
    walkTo: undefined,
  };
  squad.pieces.push(wing);
  const wingPath = [];
  let wingAt = { col: wing.col, row: wing.row };
  for (let i = 0; i < 4; i++) {
    wingAt = neighborInDir(wingAt, face, squad.orientation);
    wingPath.push(wingAt);
  }
  let held = setWalkOrder(squad, wing.id, wingPath[3]!);
  held = restPiece(held, leader.id);
  const heldWing = getPiece(held, wing.id)!;
  assert(held.turn === 'red', 'without auto walk the other unit still gets a turn');
  assert(
    heldWing.col === wing.col && heldWing.row === wing.row,
    'walker waits for End turn when auto walk is off',
  );

  setExperimental('auto-walk', true);
  const auto = board();
  auto.unitsPerTurn = 4;
  const autoLead = auto.pieces.find((p) => p.side === 'red')!;
  const autoWing = {
    ...autoLead,
    id: `${autoLead.id}-wing`,
    col: autoLead.col + 1,
    row: autoLead.row,
    walkTo: undefined,
  };
  auto.pieces.push(autoWing);
  const autoPath = [];
  let autoAt = { col: autoWing.col, row: autoWing.row };
  for (let i = 0; i < 4; i++) {
    autoAt = neighborInDir(autoAt, face, auto.orientation);
    autoPath.push(autoAt);
  }
  let passed = setWalkOrder(auto, autoWing.id, autoPath[3]!);
  passed = restPiece(passed, autoLead.id);
  const marched = getPiece(passed, autoWing.id)!;
  assert(passed.turn === 'blue', 'auto walk ends the turn once unordered units have acted');
  assert(
    marched.col === autoPath[1]!.col && marched.row === autoPath[1]!.row,
    'the unit with a destination marches on that auto end',
  );
  assert(marched.walkTo, 'its order stays until it arrives');

  const waiting = board();
  waiting.unitsPerTurn = 4;
  const waitLead = waiting.pieces.find((p) => p.side === 'red')!;
  const waitWing = {
    ...waitLead,
    id: `${waitLead.id}-wing`,
    col: waitLead.col + 1,
    row: waitLead.row,
    walkTo: undefined,
  };
  const waitOther = {
    ...waitLead,
    id: `${waitLead.id}-other`,
    col: waitLead.col + 2,
    row: waitLead.row,
    walkTo: undefined,
  };
  waiting.pieces.push(waitWing, waitOther);
  const waitPath = [];
  let waitAt = { col: waitWing.col, row: waitWing.row };
  for (let i = 0; i < 2; i++) {
    waitAt = neighborInDir(waitAt, face, waiting.orientation);
    waitPath.push(waitAt);
  }
  let still = setWalkOrder(waiting, waitWing.id, waitPath[1]!);
  still = restPiece(still, waitLead.id);
  const stillWing = getPiece(still, waitWing.id)!;
  assert(still.turn === 'red', 'a unit with no destination still to play holds the turn');
  assert(stillWing.col === waitWing.col, 'walker does not march early');

  const chain = board();
  chain.unitsPerTurn = 4;
  const chainA = chain.pieces.find((p) => p.side === 'red')!;
  const chainB = {
    ...chainA,
    id: `${chainA.id}-b`,
    col: chainA.col + 1,
    row: chainA.row,
    walkTo: undefined,
  };
  chain.pieces.push(chainB);
  const pathA = [];
  const pathB = [];
  let aAt = { col: chainA.col, row: chainA.row };
  let bAt = { col: chainB.col, row: chainB.row };
  for (let i = 0; i < 4; i++) {
    aAt = neighborInDir(aAt, face, chain.orientation);
    bAt = neighborInDir(bAt, face, chain.orientation);
    pathA.push(aAt);
    pathB.push(bAt);
  }
  let chained = setWalkOrder(chain, chainA.id, pathA[3]!);
  chained = setWalkOrder(chained, chainB.id, pathB[3]!);
  chained.turn = 'blue';
  chained = passTurn(chained);
  const movedA = getPiece(chained, chainA.id)!;
  const movedB = getPiece(chained, chainB.id)!;
  assert(chained.turn === 'blue', 'a fully ordered side auto-passes back to the side that must play');
  assert(movedA.col === pathA[1]!.col && movedA.row === pathA[1]!.row, 'first ordered unit marched');
  assert(movedB.col === pathB[1]!.col && movedB.row === pathB[1]!.row, 'second ordered unit marched');

  const last = board();
  const lastLine = forward(last, 1);
  let arrived = setWalkOrder(last, lastLine.piece.id, lastLine.path[0]!);
  beginSideTurn(arrived);
  const arrivedPiece = getPiece(arrived, lastLine.piece.id)!;
  assert(arrived.turn === 'blue', 'a legal last step still auto-walks into the next side');
  assert(
    arrivedPiece.col === lastLine.path[0]!.col && arrivedPiece.row === lastLine.path[0]!.row,
    'the last step enters the destination',
  );
  assert(!arrivedPiece.walkTo, 'arriving clears the order');

  const stuck = board();
  const stuckLine = forward(stuck, 1);
  let heldTurn = setWalkOrder(stuck, stuckLine.piece.id, stuckLine.path[0]!);
  const gateHex = stuckLine.path[0]!;
  heldTurn.terrain[gateHex.row]![gateHex.col] = 'wall';
  beginSideTurn(heldTurn);
  const heldPiece = getPiece(heldTurn, stuckLine.piece.id)!;
  assert(heldTurn.turn === 'red', 'a march that cannot step does not skip the turn');
  assert(
    heldPiece.col === stuckLine.piece.col && heldPiece.row === stuckLine.piece.row,
    'the unit stays put when the destination closes',
  );
  assert(heldPiece.walkTo, 'the order stays so it can be cancelled');

  const farm = createStateFromTerrain(
    emptyTerrain(10, 8),
    'farm',
    'flat',
    [
      { type: 'peasant', col: 5, row: 5, side: 'red' },
      { type: 'dummy', col: 0, row: 0, side: 'blue' },
    ],
  );
  const peasant = farm.pieces.find((p) => p.side === 'red')!;
  const marchFace = defaultFacing('red');
  const farmPath = [];
  let farmAt = { col: peasant.col, row: peasant.row };
  for (let i = 0; i < 4; i++) {
    farmAt = neighborInDir(farmAt, marchFace, farm.orientation);
    farmPath.push(farmAt);
  }
  const dest = farmPath[3]!;
  let orderedFarm = setWalkOrder(farm, peasant.id, dest);
  orderedFarm = performMarch(orderedFarm, peasant.id);
  assert(orderedFarm.turn === 'blue', 'ordering spends the turn and reaches the scarecrows');
  const twoPasses = passTurn(passTurn(orderedFarm));
  const mid = getPiece(twoPasses, peasant.id)!;
  assert(twoPasses.turn === 'blue', 'two empty AI passes hand the turn straight back');
  assert(mid.walkTo, 'two passes do not finish a longer march');
  assert(
    mid.col !== dest.col || mid.row !== dest.row,
    'the old two-pass bailout stops the peasant mid-path',
  );

  let drained = orderedFarm;
  let drain = 0;
  while (isAiControlled(drained, drained.turn) && !drained.winner && drain < 32) {
    assert(pickAiAction(drained) === null, 'a scarecrow has nothing to do');
    drained = passTurn(drained);
    drain += 1;
  }
  const home = getPiece(drained, peasant.id)!;
  assert(home.col === dest.col && home.row === dest.row, 'draining empty AI turns finishes the march');
  assert(!home.walkTo, 'arriving still clears the order');
  assert(drained.turn === 'red', 'the turn comes back once the destination is taken');
  assert(drain > 2, 'the march needs more than the old two passes');

  const spendBoard = createStateFromTerrain(
    emptyTerrain(10, 8),
    'spend',
    'flat',
    [
      { type: 'peasant', col: 5, row: 5, side: 'red' },
      { type: 'dummy', col: 0, row: 0, side: 'blue' },
    ],
  );
  const spender = spendBoard.pieces.find((p) => p.side === 'red')!;
  const spendPath = [];
  let spendAt = { col: spender.col, row: spender.row };
  for (let i = 0; i < 4; i++) {
    spendAt = neighborInDir(spendAt, marchFace, spendBoard.orientation);
    spendPath.push(spendAt);
  }
  const armed = setWalkOrder(spendBoard, spender.id, spendPath[3]!);
  getPiece(armed, spender.id)!.spendMarch = true;
  const boosted = performMarch(armed, spender.id);
  const after = getPiece(boosted, spender.id)!;
  assert(
    after.col === spendPath[1]!.col && after.row === spendPath[1]!.row,
    'spend energy walks two hexes',
  );
  assert(staminaLeft(after) === 0, 'the extra hex spends 1 stamina');
  assert(!after.spendMarch, 'the spend is consumed');
  assert(after.walkTo, 'a longer order stays');

  const queued = setWalkOrder(spendBoard, spender.id, spendPath[3]!);
  getPiece(queued, spender.id)!.spendMarch = true;
  const ended = passTurn(queued);
  const stood = getPiece(ended, spender.id)!;
  assert(
    stood.col === spendPath[1]!.col && stood.row === spendPath[1]!.row,
    'ending the turn with spend energy still walks two hexes',
  );
  assert(staminaLeft(stood) === 0, 'the standing march spends the stamina');
  assert(!stood.spendMarch, 'a spent march does not stay armed');

  setExperimental('auto-walk', false);
  setMarchDoubleTime(true);
  const dt = createStateFromTerrain(
    emptyTerrain(10, 8),
    'double',
    'flat',
    [
      { type: 'peasant', col: 5, row: 7, side: 'red' },
      { type: 'dummy', col: 0, row: 0, side: 'blue' },
    ],
  );
  const dtPiece = dt.pieces.find((p) => p.side === 'red')!;
  dtPiece.stamina = 2;
  const dtPath = [];
  let dtAt = { col: dtPiece.col, row: dtPiece.row };
  for (let i = 0; i < 7; i++) {
    dtAt = neighborInDir(dtAt, marchFace, dt.orientation);
    dtPath.push(dtAt);
  }
  let dtState = setWalkOrder(dt, dtPiece.id, dtPath[6]!);
  dtState = performMarch(dtState, dtPiece.id);
  let dtAtPiece = getPiece(dtState, dtPiece.id)!;
  assert(
    dtAtPiece.col === dtPath[2]!.col && dtAtPiece.row === dtPath[2]!.row,
    'double time spends the whole pool (move 1 + 2 stamina)',
  );
  assert(staminaLeft(dtAtPiece) === 0, 'double time leaves no stamina');
  dtState = passTurn(dtState);
  assert(dtState.turn === 'red', 'without auto walk the next red turn is waiting');
  dtAtPiece = getPiece(dtState, dtPiece.id)!;
  dtAtPiece.stamina = 2;
  dtState = performMarch(dtState, dtPiece.id);
  dtAtPiece = getPiece(dtState, dtPiece.id)!;
  assert(
    dtAtPiece.col === dtPath[5]!.col && dtAtPiece.row === dtPath[5]!.row,
    'the next turn spends the refilled pool again',
  );
  assert(staminaLeft(dtAtPiece) === 0, 'the second turn also empties stamina');
  setMarchDoubleTime(false);
} finally {
  UNIT_STATS.soldier.move = savedMove;
  setMarchDoubleTime(false);
  resetExperimental();
}

console.log('walk-to orders: route, speed, wall, rest, melee, auto walk, spend energy, double time');
