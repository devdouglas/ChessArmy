import {
  applyAction,
  legalHighlights,
  type GameState,
} from '../src/engine';
import { isExperimentalOn, resetExperimental, setExperimental } from '../src/experimental';
import { defaultFacing, neighborInDir, type HexDir } from '../src/hex';
import { UNIT_STATS } from '../src/roster';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function moveOnto(s: GameState, pieceId: string, col: number, row: number) {
  return legalHighlights(s, pieceId).some(
    (h) =>
      (h.kind === 'move' || h.kind === 'stamina') &&
      h.hex.col === col &&
      h.hex.row === row,
  );
}

function shootAt(s: GameState, pieceId: string, col: number, row: number) {
  return legalHighlights(s, pieceId).some(
    (h) =>
      (h.kind === 'shoot' || h.kind === 'shoot-range') &&
      h.hex.col === col &&
      h.hex.row === row,
  );
}

function board(): GameState {
  const s = createStateFromTerrain(emptyTerrain(8, 10), 'hex-armor-walk', 'pointy', [
    { type: 'soldier', col: 4, row: 5, side: 'red' },
    { type: 'general', col: 7, row: 1, side: 'red' },
    { type: 'soldier', col: 1, row: 8, side: 'blue' },
    { type: 'general', col: 1, row: 9, side: 'blue' },
  ]);
  s.turn = 'red';
  return s;
}

const saved = {
  hexArmor: UNIT_STATS.soldier.hexArmor,
  armorFront: UNIT_STATS.soldier.armorFront,
  armorFrontLeft: UNIT_STATS.soldier.armorFrontLeft,
  armorFrontRight: UNIT_STATS.soldier.armorFrontRight,
  armorFlankLeft: UNIT_STATS.soldier.armorFlankLeft,
  armorFlankRight: UNIT_STATS.soldier.armorFlankRight,
  armorRear: UNIT_STATS.soldier.armorRear,
  move: UNIT_STATS.soldier.move,
  shoot: UNIT_STATS.soldier.shoot,
  shootMin: UNIT_STATS.soldier.shootMin,
};

try {
  UNIT_STATS.soldier.move = 2;
  UNIT_STATS.soldier.shoot = 2;
  UNIT_STATS.soldier.shootMin = 1;
  UNIT_STATS.soldier.hexArmor = true;
  UNIT_STATS.soldier.armorFront = 0;
  UNIT_STATS.soldier.armorFrontLeft = 0;
  UNIT_STATS.soldier.armorFrontRight = 0;
  UNIT_STATS.soldier.armorFlankLeft = 0;
  UNIT_STATS.soldier.armorFlankRight = 0;
  UNIT_STATS.soldier.armorRear = -2;

  const s = board();
  const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
  const from = { col: p.col, row: p.row };
  const facing = defaultFacing('red');
  const rear = ((facing + 3) % 6) as HexDir;
  const back1 = neighborInDir(from, rear, 'pointy');
  const back2 = neighborInDir(back1, rear, 'pointy');
  const front1 = neighborInDir(from, facing, 'pointy');
  const front2 = neighborInDir(front1, facing, 'pointy');
  const flank = neighborInDir(from, ((facing + 1) % 6) as HexDir, 'pointy');

  assert(!moveOnto(s, p.id, back1.col, back1.row), '−2 rear adjacent is not a move dest');
  assert(!moveOnto(s, p.id, back2.col, back2.row), '−2 rear ray is not a move dest');
  assert(moveOnto(s, p.id, front1.col, front1.row), 'front still walkable');
  assert(moveOnto(s, p.id, front2.col, front2.row), 'front range-2 still walkable');
  assert(moveOnto(s, p.id, flank.col, flank.row), 'non-−2 flank still walkable');

  const bounced = applyAction(s, { kind: 'move', pieceId: p.id, to: back1 });
  assert(bounced === s, 'apply onto −2 rear hex is a no-op');

  assert(!shootAt(s, p.id, back1.col, back1.row), '−2 rear adjacent is not a shoot dest');
  assert(!shootAt(s, p.id, back2.col, back2.row), '−2 rear ray is not a shoot dest');
  assert(shootAt(s, p.id, front1.col, front1.row), 'front still in shoot range');
  const bouncedShot = applyAction(s, { kind: 'shoot', pieceId: p.id, at: back1 });
  assert(bouncedShot === s, 'apply shoot onto −2 rear hex is a no-op');

  UNIT_STATS.soldier.hexArmor = false;
  const off = board();
  const pOff = off.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
  const backOff = neighborInDir(
    { col: pOff.col, row: pOff.row },
    rear,
    'pointy',
  );
  assert(
    moveOnto(off, pOff.id, backOff.col, backOff.row),
    'hex armor off: rear −2 does not block walk',
  );

  UNIT_STATS.soldier.hexArmor = true;
  assert(isExperimentalOn('block-red-move'), 'stock: block-red-move on');
  assert(isExperimentalOn('block-red-shoot'), 'stock: block-red-shoot on');

  setExperimental('block-red-move', false);
  const walkOpen = board();
  const pWalk = walkOpen.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
  const backWalk = neighborInDir(
    { col: pWalk.col, row: pWalk.row },
    rear,
    'pointy',
  );
  assert(
    moveOnto(walkOpen, pWalk.id, backWalk.col, backWalk.row),
    'move off: −2 rear is walkable',
  );
  assert(
    !shootAt(walkOpen, pWalk.id, backWalk.col, backWalk.row),
    'move off: −2 rear still not shootable',
  );

  setExperimental('block-red-move', true);
  setExperimental('block-red-shoot', false);
  const shootOpen = board();
  const pShoot = shootOpen.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
  const backShoot = neighborInDir(
    { col: pShoot.col, row: pShoot.row },
    rear,
    'pointy',
  );
  assert(
    !moveOnto(shootOpen, pShoot.id, backShoot.col, backShoot.row),
    'shoot off: −2 rear still not walkable',
  );
  assert(
    shootAt(shootOpen, pShoot.id, backShoot.col, backShoot.row),
    'shoot off: −2 rear is shootable',
  );

  setExperimental('block-red-move', false);
  const bothOpen = board();
  const pBoth = bothOpen.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
  const backBoth = neighborInDir(
    { col: pBoth.col, row: pBoth.row },
    rear,
    'pointy',
  );
  assert(
    moveOnto(bothOpen, pBoth.id, backBoth.col, backBoth.row),
    'both off: −2 rear is walkable',
  );
  assert(
    shootAt(bothOpen, pBoth.id, backBoth.col, backBoth.row),
    'both off: −2 rear is shootable',
  );
} finally {
  Object.assign(UNIT_STATS.soldier, saved);
  resetExperimental();
}

console.log('hex armor −2 face: walk and shoot ray omitted');
