import {
  applyAction,
  canConvert,
  hasAbility,
  hasUnitToken,
  hpLeft,
  isHostile,
  isNeutralSide,
  legalHighlights,
  stampAffiliation,
  type GameState,
} from '../src/engine';
import { neighborInDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const at = { col: 4, row: 7 };
const step = neighborInDir(at, 2, 'pointy');

function board(): GameState {
  const s = createStateFromTerrain(
    emptyTerrain(8, 10),
    'neutral',
    'pointy',
    [
      { type: 'general', col: at.col, row: at.row, side: 'red' },
      { type: 'soldier', col: 2, row: 7, side: 'red' },
      { type: 'soldier', col: step.col, row: step.row, side: 'blue', unitTokens: ['neutral'] },
      { type: 'soldier', col: 6, row: 8, side: 'blue' },
      { type: 'general', col: 1, row: 9, side: 'blue' },
    ],
  );
  s.turn = 'red';
  return s;
}

{
  const stamp = { type: 'soldier', col: 0, row: 0, side: 'red' as const, unitTokens: ['neutral' as const] };
  assert(stampAffiliation(stamp) === 'neutral', 'token makes the stamp unaligned');
  assert(stampAffiliation({ ...stamp, unitTokens: undefined }) === 'red', 'without token it stays the army');
}

{
  const s = board();
  const levy = s.pieces.find((p) => p.col === step.col && p.row === step.row)!;
  const gen = s.pieces.find((p) => p.side === 'red' && p.type === 'general')!;
  const grunt = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
  assert(levy.type === 'soldier', 'keeps its unit type');
  assert(isNeutralSide(levy.side), 'kickoff unaligned');
  assert(hasUnitToken(levy, 'neutral'), 'token still on');
  assert(!isHostile(s, levy.side, 'red'), 'not an enemy');
  assert(hasAbility(gen, 'general'), 'red general');
  assert(canConvert(gen, levy), 'general can convert');
  assert(!canConvert(grunt, levy), 'grunt cannot convert');
  assert(
    legalHighlights(s, grunt.id).every(
      (h) => !(h.kind === 'move' && h.hex.col === step.col && h.hex.row === step.row),
    ),
    'soldier cannot walk onto the hex',
  );
  assert(
    legalHighlights(s, gen.id).some(
      (h) => h.kind === 'move' && h.hex.col === step.col && h.hex.row === step.row,
    ),
    'general can walk onto the hex',
  );
}

{
  const s = board();
  const before = s.pieces.find((p) => p.col === step.col && p.row === step.row)!;
  const hp = hpLeft(before);
  const gen = s.pieces.find((p) => p.side === 'red' && p.type === 'general')!;
  const after = applyAction(s, { kind: 'move', pieceId: gen.id, to: step });
  const claimed = after.pieces.find((p) => p.col === step.col && p.row === step.row)!;
  const walker = after.pieces.find((p) => p.id === gen.id)!;
  assert(claimed.side === 'red', 'converted to red');
  assert(!isNeutralSide(claimed.side), 'no longer unaligned');
  assert(!hasUnitToken(claimed, 'neutral'), 'token drops on convert');
  assert(hpLeft(claimed) === hp, 'no damage');
  assert(
    walker.col !== claimed.col || walker.row !== claimed.row,
    'general does not stack on the claimed piece',
  );
  assert(
    after.log.some((line) => line.includes('converts')),
    'log says converts',
  );
}

{
  const s = createStateFromTerrain(
    emptyTerrain(8, 10),
    'neutral-token',
    'pointy',
    [
      { type: 'soldier', col: at.col, row: at.row, side: 'red', unitTokens: ['general'] },
      { type: 'hoplite', col: step.col, row: step.row, side: 'red', unitTokens: ['neutral'] },
      { type: 'soldier', col: 6, row: 8, side: 'blue' },
      { type: 'general', col: 1, row: 9, side: 'blue' },
    ],
  );
  s.turn = 'red';
  const star = s.pieces.find((p) => p.col === at.col)!;
  const levy = s.pieces.find((p) => p.type === 'hoplite')!;
  assert(isNeutralSide(levy.side), 'neutral token unaligns even same-stamp army');
  assert(canConvert(star, levy), 'general token converts');
  const after = applyAction(s, { kind: 'move', pieceId: star.id, to: step });
  assert(after.pieces.find((p) => p.type === 'hoplite')!.side === 'red', 'token-general claims it');
}

console.log('neutral token: unaligns the stamped unit until a general touches');
