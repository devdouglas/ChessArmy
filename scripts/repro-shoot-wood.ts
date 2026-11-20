/** Any ranged unit can shoot breakable wood (palisade / tree / forest). */
import {
  applyAction,
  isPalisade,
  isForest,
  legalHighlights,
  shootDamageOf,
  splashDamageOf,
  tokenOnHex,
} from '../src/engine';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

{
  const s = createStateFromTerrain(emptyTerrain(10, 8), 'shoot-palisade', 'pointy', [
    { type: 'archer', col: 1, row: 4, side: 'red' },
    { type: 'general', col: 0, row: 4, side: 'red' },
    { type: 'general', col: 9, row: 4, side: 'blue' },
  ]);
  s.turn = 'red';
  const fence = { col: 4, row: 4 };
  s.tokens = [{ type: 'palisade', col: fence.col, row: fence.row }];
  const gun = s.pieces.find((p) => p.type === 'archer')!;
  assert(shootDamageOf(gun) === 1, 'archer shoot dmg 1');
  assert(
    legalHighlights(s, gun.id).some(
      (h) => h.kind === 'shoot' && h.hex.col === fence.col && h.hex.row === fence.row,
    ),
    'archer can aim at a palisade',
  );
  const after = applyAction(s, { kind: 'shoot', pieceId: gun.id, at: fence });
  const wood = tokenOnHex(after.tokens, fence, 'palisade');
  assert(!!wood && wood.hp === 2, 'archer dmg 1 → 3 HP fence to 2');
  assert(isPalisade(after, fence), 'fence still stands after one arrow');
}

{
  // dmg 2 vs 3 HP needs two hits
  const s = createStateFromTerrain(emptyTerrain(10, 8), 'shoot-dmg2', 'pointy', [
    { type: 'ballista', col: 1, row: 4, side: 'red' },
    { type: 'general', col: 0, row: 0, side: 'red' },
    { type: 'general', col: 9, row: 0, side: 'blue' },
  ]);
  s.turn = 'red';
  const fence = { col: 4, row: 4 };
  s.tokens = [{ type: 'palisade', col: fence.col, row: fence.row, hp: 3 }];
  const gun = s.pieces.find((p) => p.type === 'ballista')!;
  assert(shootDamageOf(gun) === 2, 'ballista shoot dmg 2');
  let next = applyAction(s, { kind: 'shoot', pieceId: gun.id, at: fence });
  const wood = tokenOnHex(next.tokens, fence, 'palisade');
  assert(!!wood && wood.hp === 1, 'first dmg 2 hit → 1 HP left');
  assert(isPalisade(next, fence), 'fence still up after one bolt');

  // Force a fresh activation for the second shot (ignore reload pacing).
  const live = next.pieces.find((p) => p.id === gun.id)!;
  live.shootCooldown = 0;
  live.firedThisTurn = false;
  live.actedThisTurn = false;
  live.movedThisTurn = false;
  live.apSpentThisTurn = 0;
  live.actionPoints = 2;
  next.turn = 'red';
  next.actedIds = [];
  next.scoutPieceId = null;
  next.scoutActionsLeft = null;
  next = applyAction(next, { kind: 'shoot', pieceId: gun.id, at: fence });
  assert(!isPalisade(next, fence), 'second dmg 2 hit fells the 3 HP fence');
}

{
  const s = createStateFromTerrain(emptyTerrain(10, 8), 'shoot-forest', 'pointy', [
    { type: 'sniper', col: 1, row: 4, side: 'red' },
    { type: 'general', col: 0, row: 4, side: 'red' },
    { type: 'general', col: 9, row: 4, side: 'blue' },
  ]);
  s.turn = 'red';
  const grove = { col: 5, row: 4 };
  s.tokens = [{ type: 'forest', col: grove.col, row: grove.row }];
  const gun = s.pieces.find((p) => p.type === 'sniper')!;
  assert(
    legalHighlights(s, gun.id).some(
      (h) => h.kind === 'shoot' && h.hex.col === grove.col && h.hex.row === grove.row,
    ),
    'sniper can aim at empty forest',
  );
  const after = applyAction(s, { kind: 'shoot', pieceId: gun.id, at: grove });
  const wood = tokenOnHex(after.tokens, grove, 'forest');
  assert(!!wood && (wood.hp ?? 3) < 3, 'sniper chips forest HP');
  assert(isForest(after, grove), 'forest still stands');
}

{
  const s = createStateFromTerrain(emptyTerrain(10, 8), 'shoot-wall', 'pointy', [
    { type: 'archer', col: 1, row: 4, side: 'red' },
    { type: 'general', col: 0, row: 4, side: 'red' },
    { type: 'general', col: 9, row: 4, side: 'blue' },
  ]);
  s.turn = 'red';
  const stone = { col: 4, row: 4 };
  s.tokens = [{ type: 'wall', col: stone.col, row: stone.row }];
  const gun = s.pieces.find((p) => p.type === 'archer')!;
  assert(
    !legalHighlights(s, gun.id).some(
      (h) => h.kind === 'shoot' && h.hex.col === stone.col && h.hex.row === stone.row,
    ),
    'archer still cannot shoot a stone wall',
  );
}

{
  const s = createStateFromTerrain(emptyTerrain(10, 8), 'ballista-fence', 'pointy', [
    { type: 'ballista', col: 1, row: 4, side: 'red' },
    { type: 'general', col: 0, row: 4, side: 'red' },
    { type: 'general', col: 9, row: 4, side: 'blue' },
  ]);
  s.turn = 'red';
  const fence = { col: 4, row: 4 };
  s.tokens = [{ type: 'palisade', col: fence.col, row: fence.row, hp: 2 }];
  const gun = s.pieces.find((p) => p.type === 'ballista')!;
  const after = applyAction(s, { kind: 'shoot', pieceId: gun.id, at: fence });
  assert(!isPalisade(after, fence), 'ballista laser fells a 2 HP palisade');
}

{
  // Splash chips wood for splash damage — does not free-demolish palisades.
  const s = createStateFromTerrain(emptyTerrain(10, 8), 'splash-fence', 'pointy', [
    { type: 'catapult', col: 1, row: 4, side: 'red' },
    { type: 'general', col: 0, row: 0, side: 'red' },
    { type: 'general', col: 9, row: 0, side: 'blue' },
  ]);
  s.turn = 'red';
  const fence = { col: 4, row: 4 };
  s.tokens = [{ type: 'palisade', col: fence.col, row: fence.row, hp: 3 }];
  const gun = s.pieces.find((p) => p.type === 'catapult')!;
  assert(splashDamageOf(gun) === 1, 'catapult splash dmg 1');
  const after = applyAction(s, { kind: 'shoot', pieceId: gun.id, at: fence });
  const wood = tokenOnHex(after.tokens, fence, 'palisade');
  assert(!!wood && wood.hp === 2, 'splash dmg 1 → 3 HP fence to 2');
  assert(isPalisade(after, fence), 'splash does not one-shot a palisade');
}

console.log('repro-shoot-wood: ok');
