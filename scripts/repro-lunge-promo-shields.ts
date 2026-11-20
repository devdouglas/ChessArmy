/** Lunge promo + attack stack; shields targetable then lock. */
import {
  abilitiesOf,
  applyAction,
  canLunge,
  getPiece,
  hasAbility,
  hpLeft,
  isConcealedFrom,
  lungeDamageOf,
  lungeSpots,
  rangeHighlights,
  shieldsBlockTargeting,
  shieldsConceal,
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
  // Archer + lunge promo + attack1 → can lunge for 1+1=2
  const s = createStateFromTerrain(
    emptyTerrain(9, 9),
    'lunge-promo',
    O,
    [
      { type: 'archer', ...origin, side: 'red', facing: 0 },
      { type: 'soldier', ...near, side: 'blue' },
      { type: 'soldier', ...far, side: 'blue' },
    ],
  );
  s.turn = 'red';
  const me = s.pieces.find((p) => p.side === 'red')!;
  me.unitTokens = ['lunge', 'attack1'];
  const nearFoe = s.pieces.find((p) => p.col === near.col && p.row === near.row)!;
  const farFoe = s.pieces.find((p) => p.col === far.col && p.row === far.row)!;
  nearFoe.hp = 5;
  farFoe.hp = 5;
  assert(hasAbility(me, 'lunge'), 'promo grants lunge');
  assert(abilitiesOf(me).includes('lunge'), 'abilitiesOf lists lunge');
  assert(lungeDamageOf(me) === 2, `lunge dmg 2 got ${lungeDamageOf(me)}`);
  assert(canLunge(s, me.id), 'archer can lunge');
  assert(
    lungeSpots(s, me).some((h) => h.col === far.col && h.row === far.row),
    'far is lunge spot',
  );
  const next = applyAction(s, { kind: 'lunge', pieceId: me.id, to: far });
  const afterNear = getPiece(next, nearFoe.id)!;
  const afterFar = getPiece(next, farFoe.id)!;
  assert(hpLeft(afterNear) === 3, `near took 2, left ${hpLeft(afterNear)}`);
  assert(hpLeft(afterFar) === 3, `far took 2, left ${hpLeft(afterFar)}`);
}

{
  // Shields: concealed + aimable → first hit reveals + blocks aim
  const shootFrom: Hex = { col: 2, row: 4 };
  const targetHex: Hex = { col: 5, row: 4 };
  const s = createStateFromTerrain(
    emptyTerrain(9, 9),
    'shields-cloak',
    O,
    [
      { type: 'archer', ...shootFrom, side: 'red', facing: 0 },
      { type: 'hoplite', ...targetHex, side: 'blue' },
    ],
  );
  s.turn = 'blue';
  const tank = s.pieces.find((p) => p.side === 'blue')!;
  tank.abilities = ['shields'];
  const afterShields = applyAction(s, { kind: 'shields', pieceId: tank.id });
  const shielded = getPiece(afterShields, tank.id)!;
  assert(shielded.shieldsUp, 'shields up');
  assert(shieldsConceal(shielded), 'concealed before hit');
  assert(isConcealedFrom(afterShields, shielded, 'red'), 'red cannot see');

  // Enemy shoots on their turn while blue shields remain.
  afterShields.turn = 'red';
  const archer = afterShields.pieces.find((p) => p.side === 'red')!;
  archer.acted = undefined;
  const aims = rangeHighlights(afterShields, archer.id);
  assert(
    aims.some(
      (h) =>
        h.kind === 'shoot' &&
        h.hex.col === targetHex.col &&
        h.hex.row === targetHex.row,
    ),
    'still aimable while cloaked',
  );

  const hpBefore = hpLeft(shielded);
  const shot = applyAction(afterShields, {
    kind: 'shoot',
    pieceId: archer.id,
    at: targetHex,
  });
  const hit = getPiece(shot, tank.id)!;
  assert(hit.shieldsStruck, 'first hit marks struck');
  assert(!shieldsConceal(hit), 'no longer concealed');
  assert(shieldsBlockTargeting(hit), 'blocks further aiming');
  assert(hpLeft(hit) === hpBefore, 'no damage through shields');
  assert(!isConcealedFrom(shot, hit, 'red'), 'now visible to red');

  const aims2 = rangeHighlights(shot, archer.id);
  assert(
    !aims2.some(
      (h) =>
        h.kind === 'shoot' &&
        h.hex.col === targetHex.col &&
        h.hex.row === targetHex.row,
    ),
    'not aimable after first hit',
  );
}

console.log('ok: lunge promo + shields cloak');
