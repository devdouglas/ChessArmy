/** Lunge + felled forest still hides. */
import {
  applyAction,
  canLunge,
  forestSoaksShot,
  getPiece,
  hasAbility,
  hpLeft,
  isConcealed,
  isForest,
  lungeSpots,
  UNIT_STATS,
} from '../src/engine';
import { neighborInDir, type Hex } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const O = 'pointy' as const;
const origin: Hex = { col: 4, row: 4 };
const near = neighborInDir(origin, 0, O);
const far = neighborInDir(near, 0, O);

{
  const s = createStateFromTerrain(
    emptyTerrain(9, 9),
    'lunge',
    O,
    [
      { type: 'hoplite', ...origin, side: 'red', facing: 0 },
      { type: 'soldier', ...near, side: 'blue' },
      { type: 'soldier', ...far, side: 'blue' },
    ],
  );
  s.turn = 'red';
  const me = s.pieces.find((p) => p.side === 'red')!;
  const farFoe = s.pieces.find((p) => p.col === far.col && p.row === far.row)!;
  me.abilities = ['lunge'];
  farFoe.hp = 1;
  assert(hasAbility(me, 'lunge'), 'lunge ability');
  assert(canLunge(s, me.id), 'can lunge');
  assert(
    lungeSpots(s, me).some((h) => h.col === far.col && h.row === far.row),
    'far hex is a lunge spot',
  );
  const next = applyAction(s, { kind: 'lunge', pieceId: me.id, to: far });
  const after = getPiece(next, me.id)!;
  assert(!getPiece(next, farFoe.id), 'far foe dead');
  assert(
    after.col === origin.col && after.row === origin.row,
    'kill on far hex: does not step onto it',
  );
}

{
  const s = createStateFromTerrain(
    emptyTerrain(9, 9),
    'lunge-step',
    O,
    [
      { type: 'hoplite', ...origin, side: 'red', facing: 0 },
      { type: 'soldier', ...near, side: 'blue' },
    ],
    undefined,
    [],
  );
  s.turn = 'red';
  const me = s.pieces.find((p) => p.side === 'red')!;
  me.abilities = ['lunge'];
  // Only near foe — far empty. Kill near, step to far.
  const next = applyAction(s, { kind: 'lunge', pieceId: me.id, to: far });
  const after = getPiece(next, me.id)!;
  assert(after.col === far.col && after.row === far.row, 'empty far: steps there');
}

{
  const forestHex = { col: 3, row: 3 };
  // Keep a visible red ally so flushLastHiddenArmies does not force-unhide.
  const s2 = createStateFromTerrain(
    emptyTerrain(9, 9),
    'forest-hide-2',
    O,
    [
      { type: 'scout', ...forestHex, side: 'red' },
      { type: 'soldier', col: 1, row: 1, side: 'red' },
      { type: 'archer', col: 5, row: 3, side: 'blue' },
    ],
    undefined,
    [{ type: 'forest', ...forestHex, hp: 1 }],
  );
  s2.turn = 'blue';
  const bow = s2.pieces.find((p) => p.type === 'archer')!;
  const prey = s2.pieces.find((p) => p.type === 'scout')!;
  prey.abilities = ['hide'];
  prey.revealed = undefined;
  assert(isForest(s2, forestHex), 'forest present');
  assert(forestSoaksShot(s2, forestHex), 'wood soaks');
  assert(isConcealed(s2, prey), 'hidden in forest');
  UNIT_STATS.archer.shootDamage = 3;
  const beforeHp = hpLeft(prey);
  const after = applyAction(s2, {
    kind: 'shoot',
    pieceId: bow.id,
    at: forestHex,
  });
  assert(isForest(after, forestHex), 'felled forest token remains');
  assert(!forestSoaksShot(after, forestHex), 'no wood left to soak');
  const still = getPiece(after, prey.id)!;
  assert(hpLeft(still) === beforeHp, 'first shot into live wood: unharmed');
  assert(isConcealed(after, still), 'still hidden after forest felled');
}

console.log('repro-lunge-forest ok');
