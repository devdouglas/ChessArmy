/**
 * Headless check for Inspire / general passive rules.
 * Run: npx esbuild scripts/repro-inspire.ts --bundle --platform=node --format=esm --outfile=/tmp/repro-inspire.mjs && node /tmp/repro-inspire.mjs
 */
const mem: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => (k in mem ? mem[k] : null),
  setItem: (k: string, v: string) => { mem[k] = String(v); },
  removeItem: (k: string) => { delete mem[k]; },
};
import {
  applyAction, canInspire, inspiredIdsOf, refreshInspiration, meleeDamageOf, armorOf,
  passTurn, getPiece, abilitiesOf, legalHighlights, type GameState, type Piece,
} from '../src/engine';
import { createInitialState } from '../src/map';
import { setGeneralInspiresEnabled } from '../src/experimental';
import { rollRoguePromotions } from '../src/roguelite';

let fails = 0;
function ok(cond: boolean, msg: string) {
  console.log((cond ? 'PASS ' : 'FAIL ') + msg);
  if (!cond) fails++;
}
function board(pieces: Partial<Piece>[]): GameState {
  const s = createInitialState(undefined as any, [], { red: 'player', blue: 'ai-enemy', yellow: 'ai-ally', purple: 'ai-enemy' } as any);
  s.terrain = s.terrain.map((r) => r.map(() => 'land' as const));
  s.tokens = [];
  s.pieces = pieces.map((p, i) => ({ id: p.id ?? `p${i}`, side: 'red', type: 'cohort', col: 0, row: 0, ...p } as Piece));
  s.turn = 'red';
  s.winner = null;
  s.actedIds = [];
  s.unitsPerTurn = 1;
  s.hadKing = { red: false, blue: false, yellow: false, purple: false } as any;
  s.scoutPieceId = null; s.scoutActionsLeft = null;
  refreshInspiration(s);
  return s;
}
const ids = (s: GameState) => [...inspiredIdsOf(s)].sort().join(',');

setGeneralInspiresEnabled(false);
// Chain along a row: A(src) - B - C, D far away, E ally adjacent to C, F enemy adjacent to B
// Use offsets on same row: neighbours at col±1.
let s = board([
  { id: 'A', col: 2, row: 4, abilities: ['inspire'] },
  { id: 'B', col: 3, row: 4 },
  { id: 'C', col: 4, row: 4 },
  { id: 'D', col: 9, row: 4 },
  { id: 'E', col: 5, row: 4, side: 'yellow' },
  { id: 'F', col: 3, row: 5, side: 'blue' },
]);
ok(ids(s) === '', 'no source → nobody inspired');
ok(canInspire(s, 'A'), 'A can inspire (ability on, own turn)');
ok(!canInspire(s, 'B'), 'B without the ability cannot inspire');
const baseMelee = meleeDamageOf(getPiece(s, 'B')!);
const baseArmor = armorOf(getPiece(s, 'B')!);
const apBefore = getPiece(s, 'A')!.actionPoints;
s = applyAction(s, { kind: 'inspire', pieceId: 'A' });
console.log('  log:', s.log.slice(-2).join(' | '));
ok(ids(s) === 'B,C', `chain propagation A→B→C, source A not self-boosted (got ${ids(s)})`);
ok(!inspiredIdsOf(s).has('E'), 'ally (yellow) excluded');
ok(!inspiredIdsOf(s).has('F'), 'enemy excluded');
ok(!inspiredIdsOf(s).has('D'), 'disconnected D excluded');
ok(meleeDamageOf(getPiece(s, 'B')!) === baseMelee + 1, `melee +1 (${baseMelee}→${meleeDamageOf(getPiece(s, 'B')!)})`);
ok(armorOf(getPiece(s, 'B')!) === baseArmor + 1, `armor +1 (${baseArmor}→${armorOf(getPiece(s, 'B')!)})`);
console.log('  A AP', apBefore, '→', getPiece(s, 'A')!.actionPoints, 'turn now', s.turn);

// No stacking: two sources A and C in one chain
let t = board([
  { id: 'A', col: 2, row: 4, inspireUp: true },
  { id: 'B', col: 3, row: 4 },
  { id: 'C', col: 4, row: 4, inspireUp: true },
]);
ok(ids(t) === 'A,B,C', `two chained sources inspire each other (got ${ids(t)})`);
const b = getPiece(t, 'B')!;
ok(meleeDamageOf(b) === baseMelee + 1, 'B reached by two sources still only +1 (no stacking)');
// Lone source
t = board([{ id: 'A', col: 2, row: 4, inspireUp: true }]);
ok(ids(t) === '', 'lone source gets nothing');

// Loss on disconnect: B walks away
t = board([
  { id: 'A', col: 2, row: 4, inspireUp: true },
  { id: 'B', col: 3, row: 4 },
  { id: 'C', col: 4, row: 4 },
]);
ok(ids(t) === 'B,C', 'before move B,C inspired');
const dests = legalHighlights(t, 'B').filter((h) => h.kind === 'move').map((h) => h.hex);
const far = dests.find((h) => { const tt = structuredClone(t); const bb = tt.pieces.find((p) => p.id === 'B')!; bb.col = h.col; bb.row = h.row; return inspiredIdsOf(tt).size === 0; });
console.log('  B dests', JSON.stringify(dests), 'pick', JSON.stringify(far));
const mv = applyAction(t, { kind: 'move', pieceId: 'B', to: far! });
const bAfter = getPiece(mv, 'B')!;
console.log('  B now at', bAfter.col, bAfter.row);
ok(ids(mv) === '' && !bAfter.inspired, `after B leaves, chain breaks: nobody inspired (got ${ids(mv)})`);
// Loss on death: middle link removed
t = board([
  { id: 'A', col: 2, row: 4, inspireUp: true },
  { id: 'B', col: 3, row: 4 },
  { id: 'C', col: 4, row: 4 },
]);
t.pieces = t.pieces.filter((p) => p.id !== 'B');
refreshInspiration(t);
ok(ids(t) === '', 'middle link dead → C loses inspiration');

// 1-turn expiry
s = board([
  { id: 'A', col: 2, row: 4, abilities: ['inspire'] },
  { id: 'B', col: 3, row: 4 },
  { id: 'X', col: 9, row: 9, side: 'blue' },
]);
s = applyAction(s, { kind: 'inspire', pieceId: 'A' });
let guard = 0;
while (s.turn === 'red' && guard++ < 5) s = passTurn(s);
ok(s.turn !== 'red' && ids(s) === 'B', `still inspired during enemy turn (turn=${s.turn}, ${ids(s)})`);
guard = 0;
while (s.turn !== 'red' && guard++ < 5) s = passTurn(s);
refreshInspiration(s);
ok(s.turn === 'red' && !getPiece(s, 'A')!.inspireUp && ids(s) === '', `expired at red's next turn (${ids(s)})`);
ok(canInspire(s, 'A'), 'A can inspire again next turn');

// Promotion token grants ability
const promo = board([{ id: 'P', col: 2, row: 4, unitTokens: ['inspire'] }]);
ok(abilitiesOf(getPiece(promo, 'P')!).includes('inspire'), 'inspire promotion grants the ability');
let seen = false;
for (let i = 0; i < 300 && !seen; i++) seen = rollRoguePromotions().includes('inspire' as any);
ok(seen, 'roguelite shop rolls can offer inspire');

// Experimental general passive
setGeneralInspiresEnabled(true);
const g = board([
  { id: 'G', col: 2, row: 4, unitTokens: ['general'] },
  { id: 'B', col: 3, row: 4 },
  { id: 'C', col: 4, row: 4 },
  { id: 'Y', col: 1, row: 4, side: 'yellow' },
]);
ok(ids(g) === 'B,C', `general passive inspires chain, not itself, not allies (got ${ids(g)})`);
const g2 = board([
  { id: 'G', col: 2, row: 4, unitTokens: ['general'] },
  { id: 'B', col: 3, row: 4, inspireUp: true },
]);
ok(ids(g2) === 'B,G', `general + active inspirer inspire each other (got ${ids(g2)})`);
setGeneralInspiresEnabled(false);
ok(ids(board([{ id: 'G', col: 2, row: 4, unitTokens: ['general'] }, { id: 'B', col: 3, row: 4 }])) === '', 'flag off → general does not inspire');

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
