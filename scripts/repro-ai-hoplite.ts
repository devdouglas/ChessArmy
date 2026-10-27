import { applyAction, type GameState } from '../src/engine';
import { distance, neighborInDir } from '../src/hex';
import { pickAiAction } from '../src/ai';
import { resetAiChecklist, setAiRule } from '../src/ai-config';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const origin = { col: 4, row: 5 };

function board(
  extra: { type: 'soldier' | 'archer' | 'general'; col: number; row: number; side: 'red' | 'blue' }[],
): GameState {
  const s = createStateFromTerrain(
    emptyTerrain(8, 10),
    'ai-hold',
    'pointy',
    [
      { type: 'hoplite', col: origin.col, row: origin.row, side: 'blue' },
      { type: 'general', col: 0, row: 0, side: 'blue' },
      { type: 'general', col: 0, row: 9, side: 'red' },
      ...extra,
    ],
    { blue: 'ai-enemy', red: 'player' },
  );
  s.turn = 'blue';
  s.unitsPerTurn = 3;
  return s;
}

function blueHoplite(s: GameState) {
  return s.pieces.find((p) => p.side === 'blue' && p.type === 'hoplite')!;
}

resetAiChecklist();

{
  const s = board([]);
  const hunt = { col: 0, row: 9 };
  const a = pickAiAction(s);
  assert(a?.kind === 'move', 'Attack on: hold does not freeze the army');
  const before = distance(origin, hunt, s.orientation);
  assert(
    a.kind === 'move' && distance(a.to, hunt, s.orientation) < before,
    'closes on the enemy general',
  );
}

setAiRule('aggressive', 'hunt-enemy-general', false);
setAiRule('aggressive', 'guard-owned-flags', false);

{
  const far = neighborInDir(neighborInDir(origin, 0, 'pointy'), 0, 'pointy');
  const s = board([{ type: 'soldier', col: far.col, row: far.row, side: 'red' }]);
  const h = blueHoplite(s);
  h.facing = 5;
  const a = pickAiAction(s);
  assert(a?.kind === 'rotate' && a.pieceId === h.id, 'unprovoked hold rotates, does not march');
  assert(a.dir === 0, 'turns toward the nearest enemy in Sight');
}

{
  const out = neighborInDir(
    neighborInDir(neighborInDir(origin, 0, 'pointy'), 0, 'pointy'),
    0,
    'pointy',
  );
  const s = board([{ type: 'soldier', col: out.col, row: out.row, side: 'red' }]);
  const h = blueHoplite(s);
  h.facing = 5;
  const a = pickAiAction(s);
  assert(a?.kind === 'rest' && a.pieceId === h.id, 'beyond Sight: no turn');
}

{
  const front = neighborInDir(origin, 0, 'pointy');
  const far = neighborInDir(front, 0, 'pointy');
  const s = board([{ type: 'soldier', col: far.col, row: far.row, side: 'red' }]);
  s.tokens = [...(s.tokens ?? []), { type: 'wall', col: front.col, row: front.row }];
  const h = blueHoplite(s);
  h.facing = 5;
  const a = pickAiAction(s);
  assert(a?.kind === 'rest' && a.pieceId === h.id, 'wall in the way: no turn');
}

{
  const front = neighborInDir(origin, 0, 'pointy');
  const far = neighborInDir(front, 0, 'pointy');
  const out = neighborInDir(far, 0, 'pointy');
  const s = board([{ type: 'soldier', col: out.col, row: out.row, side: 'red' }]);
  const h = blueHoplite(s);
  h.facing = 0;
  const idle = pickAiAction(s);
  assert(idle?.kind === 'rest', 'first look beyond Sight is a rest');
  const grunt = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
  grunt.col = far.col;
  grunt.row = far.row;
  const a = pickAiAction(s);
  assert(a?.kind === 'move' && a.pieceId === h.id, 'enemy entering Sight → they come');
  const before = distance(origin, far, s.orientation);
  assert(a.kind === 'move' && distance(a.to, far, s.orientation) < before, 'close on the contact');
}

{
  const far = neighborInDir(neighborInDir(origin, 0, 'pointy'), 0, 'pointy');
  const s = board([{ type: 'soldier', col: far.col, row: far.row, side: 'red' }]);
  const h = blueHoplite(s);
  h.facing = 0;
  const a = pickAiAction(s);
  assert(a?.kind === 'rest' && a.pieceId === h.id, 'already facing → hold');
}

{
  const adj = neighborInDir(origin, 0, 'pointy');
  const s = board([{ type: 'soldier', col: adj.col, row: adj.row, side: 'red' }]);
  const h = blueHoplite(s);
  h.facing = 0;
  const a = pickAiAction(s);
  assert(a?.kind === 'move' && a.to.col === adj.col && a.to.row === adj.row, 'adjacent enemy → attack');
}

{
  const front = neighborInDir(origin, 0, 'pointy');
  const far = neighborInDir(front, 0, 'pointy');
  const s = board([{ type: 'archer', col: far.col, row: far.row, side: 'red' }]);
  const h = blueHoplite(s);
  h.facing = 0;
  h.rangedHit = true;
  const a = pickAiAction(s);
  assert(a?.kind === 'move' && a.pieceId === h.id, 'arrow hit → they come');
  assert(a.to.col === far.col && a.to.row === far.row, 'in reach → try to attack');
}

{
  const front = neighborInDir(origin, 0, 'pointy');
  const mid = neighborInDir(front, 0, 'pointy');
  const far = neighborInDir(mid, 0, 'pointy');
  const s = board([{ type: 'archer', col: far.col, row: far.row, side: 'red' }]);
  const h = blueHoplite(s);
  h.facing = 0;
  h.rangedHit = true;
  const a = pickAiAction(s);
  assert(a?.kind === 'move' && a.pieceId === h.id, 'arrow hit, out of reach → close on nearest');
  const before = distance(origin, far, s.orientation);
  const after = distance(a.to, far, s.orientation);
  assert(after < before, 'step toward the nearest unit');
}

{
  const front = neighborInDir(origin, 0, 'pointy');
  const far = neighborInDir(front, 0, 'pointy');
  const s = board([{ type: 'archer', col: far.col, row: far.row, side: 'red' }]);
  s.turn = 'red';
  const archer = s.pieces.find((p) => p.type === 'archer')!;
  const shot = applyAction(s, { kind: 'shoot', pieceId: archer.id, at: origin });
  const h = shot.pieces.find((p) => p.side === 'blue' && p.type === 'hoplite')!;
  assert(h.rangedHit, 'a real shot marks the unit');
  shot.turn = 'blue';
  shot.actedIds = [];
  const a = pickAiAction(shot);
  assert(a?.kind === 'move' && a.to.col === far.col && a.to.row === far.row, 'shot provokes an attack if they can reach');
}

{
  const far = neighborInDir(neighborInDir(origin, 0, 'pointy'), 0, 'pointy');
  const s = board([
    { type: 'soldier', col: far.col, row: far.row, side: 'red' },
    { type: 'soldier', col: 6, row: 5, side: 'blue' },
  ]);
  const grunt = s.pieces.find((p) => p.side === 'blue' && p.type === 'soldier')!;
  const a = pickAiAction(s);
  assert(a, 'AI still acts');
  assert(a.kind === 'rotate' || a.kind === 'rest', 'unprovoked soldiers hold too');
  assert(a.pieceId === grunt.id || a.pieceId === blueHoplite(s).id, 'a holding unit acts');
}

{
  const near = neighborInDir(origin, 1, 'pointy');
  const s = board([{ type: 'soldier', col: near.col, row: near.row, side: 'red' }]);
  const h = blueHoplite(s);
  h.facing = 0;
  h.rangedHit = true;
  const a = pickAiAction(s);
  assert(
    a?.kind === 'move' && a.to.col === near.col && a.to.row === near.row,
    'provoked: attack the nearest unit, not the far general',
  );
}

{
  const front = neighborInDir(origin, 0, 'pointy');
  const far = neighborInDir(front, 0, 'pointy');
  const out = neighborInDir(far, 0, 'pointy');
  const s = board([{ type: 'soldier', col: out.col, row: out.row, side: 'red' }]);
  s.tokens = [...(s.tokens ?? []), { type: 'forest', col: far.col, row: far.row }];
  const h = blueHoplite(s);
  h.facing = 0;
  pickAiAction(s);
  const grunt = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
  grunt.col = far.col;
  grunt.row = far.row;
  const a = pickAiAction(s);
  assert(a?.kind === 'rest' || a?.kind === 'rotate', 'forest cover: no LOS charge');
  assert(a?.kind !== 'move', 'entering forest does not pull holders');
}

{
  const front = neighborInDir(origin, 0, 'pointy');
  const far = neighborInDir(front, 0, 'pointy');
  const out = neighborInDir(far, 0, 'pointy');
  const s = board([{ type: 'soldier', col: out.col, row: out.row, side: 'red' }]);
  s.tokens = [...(s.tokens ?? []), { type: 'house', col: far.col, row: far.row }];
  const h = blueHoplite(s);
  h.facing = 0;
  pickAiAction(s);
  const grunt = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
  grunt.col = far.col;
  grunt.row = far.row;
  const a = pickAiAction(s);
  assert(a?.kind !== 'move', 'house cover: no LOS charge');
}

{
  const front = neighborInDir(origin, 0, 'pointy');
  const far = neighborInDir(front, 0, 'pointy');
  const out = neighborInDir(far, 0, 'pointy');
  const s = board([{ type: 'soldier', col: out.col, row: out.row, side: 'red' }]);
  const h = blueHoplite(s);
  h.facing = 0;
  pickAiAction(s);
  const grunt = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
  grunt.col = far.col;
  grunt.row = far.row;
  grunt.unitTokens = ['hidden'];
  const a = pickAiAction(s);
  assert(a?.kind !== 'move', 'hidden token: no LOS charge');
}

{
  const front = neighborInDir(origin, 0, 'pointy');
  const far = neighborInDir(front, 0, 'pointy');
  const out = neighborInDir(far, 0, 'pointy');
  const s = board([{ type: 'soldier', col: out.col, row: out.row, side: 'red' }]);
  s.tokens = [...(s.tokens ?? []), { type: 'forest', col: origin.col, row: origin.row }];
  const h = blueHoplite(s);
  h.facing = 0;
  pickAiAction(s);
  const grunt = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
  grunt.col = far.col;
  grunt.row = far.row;
  const a = pickAiAction(s);
  assert(a?.kind !== 'move', 'holder in forest is not pulled out by Sight');
}

{
  const front = neighborInDir(origin, 0, 'pointy');
  const far = neighborInDir(front, 0, 'pointy');
  const out = neighborInDir(far, 0, 'pointy');
  const s = board([{ type: 'soldier', col: out.col, row: out.row, side: 'red' }]);
  s.tokens = [...(s.tokens ?? []), { type: 'house', col: origin.col, row: origin.row }];
  const h = blueHoplite(s);
  h.facing = 0;
  pickAiAction(s);
  const grunt = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
  grunt.col = far.col;
  grunt.row = far.row;
  const a = pickAiAction(s);
  assert(a?.kind !== 'move', 'holder in a house is not pulled out by Sight');
}

setAiRule('aggressive', 'hunt-enemy-general', true);
setAiRule('aggressive', 'hold-position', false);
{
  const far = neighborInDir(neighborInDir(origin, 0, 'pointy'), 0, 'pointy');
  const s = board([
    { type: 'soldier', col: far.col, row: far.row, side: 'red' },
    { type: 'soldier', col: 6, row: 5, side: 'blue' },
  ]);
  const grunt = s.pieces.find((p) => p.side === 'blue' && p.type === 'soldier')!;
  const a = pickAiAction(s);
  assert(a?.kind === 'move', 'unchecked hold: army closes');
  assert(a.pieceId === grunt.id || a.pieceId === blueHoplite(s).id, 'a mobile unit walks');
}
resetAiChecklist();

console.log('repro-ai-hoplite ok');
