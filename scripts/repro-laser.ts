/** Laser: arch-like targeting (through units); pierce damage on the beam. */
import {
  applyAction,
  getPiece,
  hpLeft,
  laserBeamHexes,
  legalHighlights,
  UNIT_STATS,
} from '../src/engine';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(UNIT_STATS.ballista.shootArc === 'laser', 'ballista is laser');

{
  const s = createStateFromTerrain(emptyTerrain(10, 8), 'laser', 'pointy', [
    { type: 'ballista', col: 1, row: 4, side: 'red' },
    { type: 'soldier', col: 3, row: 4, side: 'red' },
    { type: 'soldier', col: 5, row: 4, side: 'blue' },
    { type: 'general', col: 0, row: 0, side: 'red' },
    { type: 'general', col: 9, row: 0, side: 'blue' },
  ]);
  s.turn = 'red';
  const gun = s.pieces.find((p) => p.type === 'ballista')!;
  const friend = s.pieces.find((p) => p.type === 'soldier' && p.side === 'red')!;
  const foe = s.pieces.find((p) => p.type === 'soldier' && p.side === 'blue')!;
  const aim = { col: foe.col, row: foe.row };
  const beam = laserBeamHexes(s, { col: gun.col, row: gun.row }, aim);
  assert(
    beam.some((h) => h.col === friend.col && h.row === friend.row),
    'friendly sits on the beam',
  );

  const shots = legalHighlights(s, gun.id).filter((h) => h.kind === 'shoot');
  assert(
    shots.some((h) => h.hex.col === foe.col && h.hex.row === foe.row),
    'enemy beyond a friendly is a laser target (arch-like aim)',
  );
  assert(
    !shots.some((h) => h.hex.col === friend.col && h.hex.row === friend.row),
    'friendly is not an aim hex (same as arch)',
  );
  assert(
    !shots.some((h) => h.hex.col === 6 && h.hex.row === 4),
    'empty air past units is range-only, not an aim hex',
  );

  const hpFriend = hpLeft(friend);
  const hpFoe = hpLeft(foe);
  const after = applyAction(s, { kind: 'shoot', pieceId: gun.id, at: aim });
  const friendAfter = getPiece(after, friend.id);
  const foeAfter = getPiece(after, foe.id);
  assert(
    !friendAfter || hpLeft(friendAfter) < hpFriend,
    'laser damages friendly on the line when aiming at the foe',
  );
  assert(
    !foeAfter || hpLeft(foeAfter) < hpFoe,
    'laser damages the aimed foe',
  );
}

{
  const s = createStateFromTerrain(emptyTerrain(10, 8), 'laser-stack', 'pointy', [
    { type: 'ballista', col: 1, row: 4, side: 'red' },
    { type: 'soldier', col: 3, row: 4, side: 'blue' },
    { type: 'soldier', col: 5, row: 4, side: 'blue' },
    { type: 'general', col: 0, row: 0, side: 'red' },
    { type: 'general', col: 9, row: 0, side: 'blue' },
  ]);
  s.turn = 'red';
  const gun = s.pieces.find((p) => p.type === 'ballista')!;
  const near = s.pieces.find((p) => p.col === 3)!;
  const far = s.pieces.find((p) => p.col === 5)!;
  assert(
    legalHighlights(s, gun.id).some(
      (h) => h.kind === 'shoot' && h.hex.col === far.col && h.hex.row === far.row,
    ),
    'can target the far enemy through the near one',
  );
  const hpNear = hpLeft(near);
  const hpFar = hpLeft(far);
  const after = applyAction(s, {
    kind: 'shoot',
    pieceId: gun.id,
    at: { col: far.col, row: far.row },
  });
  const nearAfter = getPiece(after, near.id);
  const farAfter = getPiece(after, far.id);
  assert(!nearAfter || hpLeft(nearAfter) < hpNear, 'near enemy also takes beam damage');
  assert(!farAfter || hpLeft(farAfter) < hpFar, 'far enemy takes beam damage');
}

{
  const t = emptyTerrain(10, 8);
  const s = createStateFromTerrain(t, 'laser-wood', 'pointy', [
    { type: 'ballista', col: 1, row: 4, side: 'red' },
    { type: 'soldier', col: 5, row: 4, side: 'blue' },
    { type: 'general', col: 0, row: 0, side: 'red' },
    { type: 'general', col: 9, row: 0, side: 'blue' },
  ]);
  s.turn = 'red';
  s.tokens = [{ type: 'palisade', col: 3, row: 4 }];
  const gun = s.pieces.find((p) => p.type === 'ballista')!;
  const foe = s.pieces.find((p) => p.type === 'soldier' && p.side === 'blue')!;
  assert(
    !legalHighlights(s, gun.id).some(
      (h) => h.kind === 'shoot' && h.hex.col === foe.col && h.hex.row === foe.row,
    ),
    'palisade still blocks laser LOS',
  );
}

console.log('repro-laser: ok');
