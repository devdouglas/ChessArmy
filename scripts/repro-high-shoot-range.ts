import { applyAction, legalHighlights, type GameState } from '../src/engine';
import { neighborInDir, type Hex, type HexDir } from '../src/hex';
import { UNIT_STATS } from '../src/roster';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function step(from: Hex, dir: HexDir, n: number): Hex {
  let h = from;
  for (let i = 0; i < n; i++) h = neighborInDir(h, dir, 'pointy');
  return h;
}

function shootAt(s: GameState, pieceId: string, h: Hex) {
  return legalHighlights(s, pieceId).some(
    (x) => (x.kind === 'shoot' || x.kind === 'shoot-range') && x.hex.col === h.col && x.hex.row === h.row,
  );
}

function board(highAt: Hex, enemyAt: Hex): GameState {
  const t = emptyTerrain(8, 10);
  t[highAt.row][highAt.col] = 'high';
  const s = createStateFromTerrain(t, 'high-shoot', 'pointy', [
    { type: 'soldier', col: 4, row: 5, side: 'red' },
    { type: 'general', col: 7, row: 1, side: 'red' },
    { type: 'soldier', col: enemyAt.col, row: enemyAt.row, side: 'blue' },
    { type: 'general', col: 1, row: 9, side: 'blue' },
  ]);
  s.turn = 'red';
  return s;
}

const saved = {
  shoot: UNIT_STATS.soldier.shoot,
  shootMin: UNIT_STATS.soldier.shootMin,
  splashDamage: UNIT_STATS.soldier.splashDamage,
};

try {
  UNIT_STATS.soldier.shoot = 4;
  UNIT_STATS.soldier.shootMin = 1;
  UNIT_STATS.soldier.splashDamage = 0;

  const from = { col: 4, row: 5 };
  const dir = 2 as HexDir;
  const d2 = step(from, dir, 2);
  const d3 = step(from, dir, 3);
  const d4 = step(from, dir, 4);

  const s4 = board(d4, d4);
  const red4 = s4.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
  assert(!shootAt(s4, red4.id, d4), 'range 4 cannot shoot high at distance 4');
  const bounced = applyAction(s4, { kind: 'shoot', pieceId: red4.id, at: d4 });
  assert(bounced === s4, 'apply shoot onto max-range high is a no-op');

  const s3 = board(d3, d3);
  const red3 = s3.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
  assert(shootAt(s3, red3.id, d3), 'range 4 can still shoot high at distance 3');

  const s2 = board(d2, d2);
  const red2 = s2.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
  assert(shootAt(s2, red2.id, d2), 'range 4 can still shoot high at distance 2');

  const landOnly = createStateFromTerrain(emptyTerrain(8, 10), 'high-shoot-land', 'pointy', [
    { type: 'soldier', col: from.col, row: from.row, side: 'red' },
    { type: 'general', col: 7, row: 1, side: 'red' },
    { type: 'soldier', col: d4.col, row: d4.row, side: 'blue' },
    { type: 'general', col: 1, row: 9, side: 'blue' },
  ]);
  landOnly.turn = 'red';
  const redLand = landOnly.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
  assert(shootAt(landOnly, redLand.id, d4), 'range 4 still shoots land at distance 4');
} finally {
  Object.assign(UNIT_STATS.soldier, saved);
}

console.log('high target +1 shoot range: dist 4 blocked, 3 and 2 ok');
