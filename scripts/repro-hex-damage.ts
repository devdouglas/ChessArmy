import {
  applyAction,
  beginSideTurn,
  hexDamageMarks,
  hexDamageOn,
  hpLeft,
  passTurn,
  type GameState,
} from '../src/engine';
import { defaultFacing, neighborInDir } from '../src/hex';
import { UNIT_STATS } from '../src/roster';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const origin = { col: 4, row: 5 };
const face = defaultFacing('blue');
const front = neighborInDir(origin, face, 'pointy');
const front2 = neighborInDir(front, face, 'pointy');
const sideStep = neighborInDir(front, ((face + 1) % 6) as 0 | 1 | 2 | 3 | 4 | 5, 'pointy');

function board(tokens: { type: 'wall'; col: number; row: number }[] = []): GameState {
  const s = createStateFromTerrain(
    emptyTerrain(8, 10),
    'hex-damage',
    'pointy',
    [
      { type: 'soldier', col: sideStep.col, row: sideStep.row, side: 'red' },
      { type: 'general', col: 1, row: 1, side: 'red' },
      { type: 'soldier', col: origin.col, row: origin.row, side: 'blue' },
      { type: 'general', col: 1, row: 9, side: 'blue' },
    ],
    undefined,
    tokens,
  );
  s.turn = 'red';
  const blue = s.pieces.find((p) => p.side === 'blue' && p.type === 'soldier')!;
  blue.facing = face;
  return s;
}

function redSoldier(s: GameState) {
  return s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
}

const saved = {
  hexDamage: UNIT_STATS.soldier.hexDamage,
  damageFront: UNIT_STATS.soldier.damageFront,
  hp: UNIT_STATS.soldier.hp,
  armor: UNIT_STATS.soldier.armor,
};

try {
  UNIT_STATS.soldier.hexDamage = true;
  UNIT_STATS.soldier.damageFront = 1;

  {
    const spawn = { col: front.col, row: front.row };
    const s = createStateFromTerrain(
      emptyTerrain(8, 10),
      'hex-damage-kickoff',
      'pointy',
      [
        { type: 'soldier', col: spawn.col, row: spawn.row, side: 'red' },
        { type: 'general', col: 1, row: 1, side: 'red' },
        { type: 'soldier', col: origin.col, row: origin.row, side: 'blue' },
        { type: 'general', col: 1, row: 9, side: 'blue' },
      ],
    );
    const blue = s.pieces.find((p) => p.side === 'blue' && p.type === 'soldier')!;
    blue.facing = face;
    const red = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
    assert(hpLeft(red) === UNIT_STATS.soldier.hp, 'kickoff does not pulse facing pikes');
    assert(hexDamageOn(s, spawn, 'red')?.amount === 1, 'spawn hex is covered');
  }

  {
    const s = board();
    const marks = hexDamageMarks(s);
    assert(
      marks.some((m) => m.col === front.col && m.row === front.row && m.dir === face && m.amount === 1 && m.side === 'blue'),
      'front hex is painted outward',
    );
    assert(
      !marks.some((m) => m.col === front2.col && m.row === front2.row),
      'only the adjacent hex is painted',
    );
    assert(!hexDamageOn(s, front2, 'red'), 'second hex is safe');
    assert(
      !marks.some((m) => m.col === origin.col && m.row === origin.row),
      'source hex is not painted',
    );
    const own = s.pieces.find((x) => x.side === 'blue' && x.type === 'soldier')!;
    assert(!hexDamageOn(s, front, own.side), 'own facing pikes do not hit the owner');
  }

  {
    const s = board();
    const p = redSoldier(s);
    assert(hpLeft(p) === UNIT_STATS.soldier.hp, 'standing off-ray is safe');
    const after = applyAction(s, { kind: 'move', pieceId: p.id, to: front });
    const moved = after.pieces.find((x) => x.id === p.id);
    assert(!moved, '1hp soldier dies entering facing pikes');
    assert(after.log.some((l) => l.includes('dies on facing pikes')), 'enter death is logged');
  }

  {
    UNIT_STATS.soldier.hp = 3;
    const s = board();
    const p = redSoldier(s);
    let after = applyAction(s, { kind: 'move', pieceId: p.id, to: front });
    const moved = after.pieces.find((x) => x.id === p.id)!;
    assert(hpLeft(moved) === 2, 'enter deals 1');
    if (after.scoutPieceId) after = applyAction(after, { kind: 'skip' });
    assert(after.turn === 'blue', 'red spent their activation');
    const bluePassed = passTurn(after);
    assert(bluePassed.turn === 'red', 'back to red');
    const red = bluePassed.pieces.find((x) => x.id === p.id)!;
    assert(hpLeft(red) === 2, 'staying on the hex does not pulse again');
    assert(!bluePassed.log.some((l) => l.includes('endures facing pikes')), 'no upkeep hit');
    UNIT_STATS.soldier.hp = saved.hp;
  }

  {
    const s = board([{ type: 'wall', col: front.col, row: front.row }]);
    assert(!hexDamageOn(s, front, 'red'), 'wall on the adjacent hex blocks it');
    assert(!hexDamageOn(s, front2, 'red'), 'second hex was never in range');
    const marks = hexDamageMarks(s);
    assert(!marks.some((m) => m.col === front.col && m.row === front.row), 'no paint on the wall');
  }

  {
    UNIT_STATS.soldier.damageFront = 2;
    UNIT_STATS.soldier.hp = 3;
    const s = board();
    const p = redSoldier(s);
    const after = applyAction(s, { kind: 'move', pieceId: p.id, to: front });
    const moved = after.pieces.find((x) => x.id === p.id)!;
    assert(hpLeft(moved) === 1, 'front 2 deals 2 on enter');
    UNIT_STATS.soldier.hp = saved.hp;
    UNIT_STATS.soldier.damageFront = 1;
  }

  {
    UNIT_STATS.soldier.hp = 3;
    UNIT_STATS.soldier.armor = -1;
    const s = board();
    const p = redSoldier(s);
    const after = applyAction(s, { kind: 'move', pieceId: p.id, to: front });
    const moved = after.pieces.find((x) => x.id === p.id)!;
    assert(hpLeft(moved) === 2, 'hex damage ignores negative armor like shots');
    assert(!moved.rangedHit, 'facing pikes are not a shot');
    UNIT_STATS.soldier.hp = saved.hp;
    UNIT_STATS.soldier.armor = saved.armor;
  }

  {
    const s = board();
    s.turn = 'red';
    const p = redSoldier(s);
    p.col = front.col;
    p.row = front.row;
    const hp = hpLeft(p);
    beginSideTurn(s, false, true);
    assert(hpLeft(p) === hp, 'start of turn does not pulse facing pikes');
  }

  {
    UNIT_STATS.soldier.hp = 3;
    const s = createStateFromTerrain(
      emptyTerrain(8, 10),
      'hex-damage-push',
      'pointy',
      [
        { type: 'soldier', col: front2.col, row: front2.row, side: 'red' },
        { type: 'general', col: 1, row: 1, side: 'red' },
        { type: 'soldier', col: origin.col, row: origin.row, side: 'blue' },
        { type: 'general', col: 1, row: 9, side: 'blue' },
      ],
    );
    s.turn = 'blue';
    const blue = s.pieces.find((p) => p.side === 'blue' && p.type === 'soldier')!;
    blue.facing = face;
    const after = applyAction(s, { kind: 'move', pieceId: blue.id, to: front });
    const red = after.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
    assert(red, 'enemy still there');
    assert(hpLeft(red) === 2, 'walking the damage hex onto the enemy deals 1');
    assert(after.log.some((l) => l.includes('caught by facing pikes')), 'push is logged');
    UNIT_STATS.soldier.hp = saved.hp;
  }
} finally {
  UNIT_STATS.soldier.hexDamage = saved.hexDamage;
  UNIT_STATS.soldier.damageFront = saved.damageFront;
  UNIT_STATS.soldier.hp = saved.hp;
  UNIT_STATS.soldier.armor = saved.armor;
}

console.log('repro-hex-damage ok');
