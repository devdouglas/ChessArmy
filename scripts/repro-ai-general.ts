import { allLegalActions, type Action, type GameState } from '../src/engine';
import { neighborInDir } from '../src/hex';
import { pickAiAction } from '../src/ai';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const origin = { col: 4, row: 5 };
const adj = neighborInDir(origin, 0, 'pointy');
const far = neighborInDir(adj, 0, 'pointy');

function board(
  extra: { type: 'soldier' | 'general' | 'catapult'; col: number; row: number; side: 'red' | 'blue' }[],
): GameState {
  const s = createStateFromTerrain(
    emptyTerrain(8, 10),
    'ai-general',
    'pointy',
    [
      { type: 'general', col: origin.col, row: origin.row, side: 'blue' },
      { type: 'general', col: 1, row: 9, side: 'red' },
      ...extra,
    ],
    { blue: 'ai-enemy', red: 'player' },
  );
  s.turn = 'blue';
  s.unitsPerTurn = 3;
  return s;
}

function hitsHex(a: Action | null, hex: { col: number; row: number }) {
  if (!a) return false;
  if (a.kind === 'shoot') return a.at.col === hex.col && a.at.row === hex.row;
  if (a.kind === 'move') return a.to.col === hex.col && a.to.row === hex.row;
  return false;
}

function blueGeneralId(s: GameState) {
  return s.pieces.find((p) => p.side === 'blue' && p.type === 'general')!.id;
}

{
  const s = board([{ type: 'soldier', col: far.col, row: far.row, side: 'red' }]);
  const gid = blueGeneralId(s);
  assert(
    allLegalActions(s).some(
      (a) => a.kind === 'shoot' && a.pieceId === gid && a.at.col === far.col && a.at.row === far.row,
    ),
    'general can shoot the distant grunt',
  );
  const a = pickAiAction(s);
  assert(a, 'AI still acts');
  assert(!(a.pieceId === gid && hitsHex(a, far)), 'general does not snipe a grunt');
  assert(
    !(a.kind === 'shoot' && a.pieceId === gid && a.at.col === far.col && a.at.row === far.row),
    'general does not shoot a grunt out of melee',
  );
}

{
  const s = board([{ type: 'soldier', col: adj.col, row: adj.row, side: 'red' }]);
  const a = pickAiAction(s);
  assert(hitsHex(a, adj), 'general fights back against melee');
}

{
  const s = board([{ type: 'catapult', col: adj.col, row: adj.row, side: 'red' }]);
  const gid = blueGeneralId(s);
  const a = pickAiAction(s);
  assert(a, 'AI still acts vs melee-0 neighbor');
  assert(!hitsHex(a, adj) || a.pieceId !== gid, 'melee-0 neighbor is not a melee threat');
}

{
  const s = board([]);
  const redGen = s.pieces.find((p) => p.side === 'red' && p.type === 'general')!;
  redGen.col = far.col;
  redGen.row = far.row;
  const a = pickAiAction(s);
  assert(hitsHex(a, far), 'general still attacks the enemy general');
}

{
  const s = board([
    { type: 'soldier', col: adj.col, row: adj.row, side: 'blue' },
    { type: 'soldier', col: far.col, row: far.row, side: 'red' },
  ]);
  const grunt = s.pieces.find((p) => p.side === 'blue' && p.type === 'soldier')!;
  const a = pickAiAction(s);
  assert(a?.pieceId === grunt.id && hitsHex(a, far), 'non-general still attacks the army');
}

{
  const s = board([{ type: 'soldier', col: 2, row: 5, side: 'blue' }]);
  const grunt = s.pieces.find((p) => p.side === 'blue' && p.type === 'soldier')!;
  const gid = blueGeneralId(s);
  const a = pickAiAction(s);
  assert(a && a.kind !== 'skip', 'AI still acts');
  assert(a.pieceId === grunt.id, 'general waits; army moves first');
  assert(a.pieceId !== gid, 'general is not first activation');
}

console.log('repro-ai-general ok');
