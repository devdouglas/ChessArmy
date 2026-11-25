/** Lunge cannot thrust out a −2 (red) hex-armor face. */
import {
  canLunge,
  lungeSpots,
} from '../src/engine';
import { neighborInDir, type Hex } from '../src/hex';
import { UNIT_STATS } from '../src/roster';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const O = 'pointy' as const;
const origin: Hex = { col: 4, row: 4 };
const frontNear = neighborInDir(origin, 0, O);
const frontFar = neighborInDir(frontNear, 0, O);
const rearNear = neighborInDir(origin, 3, O);
const rearFar = neighborInDir(rearNear, 3, O);

const saved = {
  hexArmor: UNIT_STATS.hoplite.hexArmor,
  armorFront: UNIT_STATS.hoplite.armorFront,
  armorFrontLeft: UNIT_STATS.hoplite.armorFrontLeft,
  armorFrontRight: UNIT_STATS.hoplite.armorFrontRight,
  armorFlankLeft: UNIT_STATS.hoplite.armorFlankLeft,
  armorFlankRight: UNIT_STATS.hoplite.armorFlankRight,
  armorRear: UNIT_STATS.hoplite.armorRear,
};

try {
  UNIT_STATS.hoplite.hexArmor = true;
  UNIT_STATS.hoplite.armorFront = 0;
  UNIT_STATS.hoplite.armorFrontLeft = 0;
  UNIT_STATS.hoplite.armorFrontRight = 0;
  UNIT_STATS.hoplite.armorFlankLeft = 0;
  UNIT_STATS.hoplite.armorFlankRight = 0;
  UNIT_STATS.hoplite.armorRear = -2;

  const s = createStateFromTerrain(
    emptyTerrain(9, 9),
    'lunge-redface',
    O,
    [
      {
        type: 'hoplite',
        ...origin,
        side: 'red',
        facing: 0,
        unitTokens: ['lunge'],
      },
      { type: 'soldier', ...frontNear, side: 'blue' },
      { type: 'soldier', ...frontFar, side: 'blue' },
      { type: 'soldier', ...rearNear, side: 'blue' },
      { type: 'soldier', ...rearFar, side: 'blue' },
    ],
  );
  s.turn = 'red';
  const me = s.pieces.find((p) => p.side === 'red')!;
  assert(canLunge(s, me.id), 'can lunge forward');
  const spots = lungeSpots(s, me);
  assert(
    spots.some((h) => h.col === frontFar.col && h.row === frontFar.row),
    'front far is legal',
  );
  assert(
    !spots.some((h) => h.col === rearFar.col && h.row === rearFar.row),
    'rear (red face) lunge blocked',
  );
} finally {
  Object.assign(UNIT_STATS.hoplite, saved);
}

console.log('repro-lunge-redface: ok');
