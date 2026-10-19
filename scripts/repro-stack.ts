import { applyAction, type GameState } from '../src/engine';
import { UNIT_STATS } from '../src/roster';
import { runAiTurn } from '../src/ai';
import { createStateFromTerrain, emptyTerrain } from '../src/map';
import { key } from '../src/hex';

function stacks(s: GameState): string[] {
  const seen = new Map<string, string[]>();
  for (const p of s.pieces) {
    const k = key(p);
    const ids = seen.get(k) ?? [];
    ids.push(`${p.side}:${p.type}:${p.id}`);
    seen.set(k, ids);
  }
  return [...seen.values()].filter((v) => v.length > 1).map((v) => v.join(' + '));
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertNoStack(s: GameState, msg: string) {
  const hit = stacks(s);
  if (hit.length) throw new Error(`${msg}: ${hit.join(' | ')}`);
}

function line(hp: number) {
  UNIT_STATS.soldier.hp = hp;
  const s = createStateFromTerrain(emptyTerrain(8, 10), 'stack', 'pointy', [
    { type: 'soldier', col: 4, row: 5, side: 'red' },
    { type: 'general', col: 7, row: 1, side: 'red' },
    { type: 'scout', col: 2, row: 5, side: 'blue' },
    { type: 'scout', col: 3, row: 5, side: 'blue' },
    { type: 'general', col: 1, row: 9, side: 'blue' },
  ]);
  s.turn = 'blue';
  s.unitsPerTurn = 3;
  const rear = s.pieces.find((p) => p.col === 2 && p.row === 5)!;
  const front = s.pieces.find((p) => p.col === 3 && p.row === 5)!;
  return { s, rear, front };
}

const soldierHp = UNIT_STATS.soldier.hp;

{
  const { s, rear, front } = line(2);
  const after = applyAction(s, { kind: 'move', pieceId: rear.id, to: { col: 4, row: 5 } });
  const moved = after.pieces.find((p) => p.id === rear.id)!;
  const still = after.pieces.find((p) => p.id === front.id)!;
  assertNoStack(after, 'bounce through friend');
  assert(moved.col === 2 && moved.row === 5, `bounce should stay put, got ${moved.col},${moved.row}`);
  assert(still.col === 3 && still.row === 5, 'front scout stayed');
}

{
  const { s, rear } = line(1);
  const after = applyAction(s, { kind: 'move', pieceId: rear.id, to: { col: 4, row: 5 } });
  const moved = after.pieces.find((p) => p.id === rear.id)!;
  assertNoStack(after, 'kill through friend');
  assert(moved.col === 4 && moved.row === 5, `kill should take hex, got ${moved.col},${moved.row}`);
  assert(!after.pieces.some((p) => p.side === 'red' && p.type === 'soldier'), 'soldier died');
}

{
  const { s } = line(2);
  const after = runAiTurn(s, 'blue');
  assertNoStack(after, 'ai 2hp line');
}

{
  UNIT_STATS.soldier.hp = 2;
  const s = createStateFromTerrain(emptyTerrain(8, 10), 'opp', 'pointy', [
    { type: 'soldier', col: 4, row: 5, side: 'red' },
    { type: 'general', col: 7, row: 1, side: 'red' },
    { type: 'soldier', col: 3, row: 5, side: 'blue' },
    { type: 'soldier', col: 5, row: 5, side: 'blue' },
    { type: 'general', col: 1, row: 9, side: 'blue' },
  ]);
  s.turn = 'blue';
  s.unitsPerTurn = 2;
  const a = s.pieces.find((p) => p.col === 3 && p.row === 5)!;
  const b = s.pieces.find((p) => p.col === 5 && p.row === 5)!;
  const mid = applyAction(s, { kind: 'move', pieceId: a.id, to: { col: 4, row: 5 } });
  const after = applyAction(mid, { kind: 'move', pieceId: b.id, to: { col: 4, row: 5 } });
  assertNoStack(after, 'two melee same hex');
}

{
  UNIT_STATS.soldier.hp = 1;
  const s = createStateFromTerrain(emptyTerrain(8, 10), 'kill', 'pointy', [
    { type: 'soldier', col: 4, row: 5, side: 'red' },
    { type: 'general', col: 7, row: 1, side: 'red' },
    { type: 'soldier', col: 3, row: 5, side: 'blue' },
    { type: 'soldier', col: 5, row: 5, side: 'blue' },
    { type: 'general', col: 1, row: 9, side: 'blue' },
  ]);
  s.turn = 'blue';
  s.unitsPerTurn = 2;
  const a = s.pieces.find((p) => p.col === 3 && p.row === 5)!;
  const b = s.pieces.find((p) => p.col === 5 && p.row === 5)!;
  const mid = applyAction(s, { kind: 'move', pieceId: a.id, to: { col: 4, row: 5 } });
  const after = applyAction(mid, { kind: 'move', pieceId: b.id, to: { col: 4, row: 5 } });
  const aa = after.pieces.find((p) => p.id === a.id)!;
  const bb = after.pieces.find((p) => p.id === b.id)!;
  assertNoStack(after, 'second melee after capture');
  assert(aa.col === 4 && aa.row === 5, 'killer took the hex');
  assert(bb.col === 5 && bb.row === 5, 'second stayed off occupied hex');
}

UNIT_STATS.soldier.hp = soldierHp;
console.log('no stacking');
