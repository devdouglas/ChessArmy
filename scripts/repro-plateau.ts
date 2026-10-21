import {
  applyAction,
  hpLeft,
  legalHighlights,
  passTurn,
  pathForMove,
  staminaLeft,
  type GameState,
} from '../src/engine';
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

function walkOnto(s: GameState, id: string, h: Hex) {
  return legalHighlights(s, id).some(
    (x) =>
      (x.kind === 'move' || x.kind === 'stamina') &&
      x.hex.col === h.col &&
      x.hex.row === h.row,
  );
}

function shootAt(s: GameState, id: string, h: Hex) {
  return legalHighlights(s, id).some(
    (x) =>
      (x.kind === 'shoot' || x.kind === 'shoot-range') &&
      x.hex.col === h.col &&
      x.hex.row === h.row,
  );
}

function make(
  red: Hex,
  extras: { high?: Hex[]; plateau?: Hex[]; water?: Hex[]; rock?: Hex[] },
  type = 'soldier',
  enemy?: Hex,
): GameState {
  const t = emptyTerrain(8, 10);
  for (const h of extras.high ?? []) t[h.row][h.col] = 'high';
  for (const h of extras.plateau ?? []) t[h.row][h.col] = 'plateau';
  for (const h of extras.water ?? []) t[h.row][h.col] = 'water';
  for (const h of extras.rock ?? []) t[h.row][h.col] = 'rock';
  const s = createStateFromTerrain(t, 'plateau', 'pointy', [
    { type, col: red.col, row: red.row, side: 'red' },
    { type: 'general', col: 7, row: 1, side: 'red' },
    { type: 'soldier', col: enemy?.col ?? 1, row: enemy?.row ?? 8, side: 'blue' },
    { type: 'general', col: 1, row: 9, side: 'blue' },
  ]);
  s.turn = 'red';
  return s;
}

const saved = {
  shoot: UNIT_STATS.soldier.shoot,
  shootMin: UNIT_STATS.soldier.shootMin,
  splashDamage: UNIT_STATS.soldier.splashDamage,
  stamina: UNIT_STATS.soldier.stamina,
  staminaRegen: UNIT_STATS.soldier.staminaRegen,
  move: UNIT_STATS.scout.move,
};

try {
  const from = { col: 4, row: 5 };
  const dir = 2 as HexDir;
  const high = step(from, dir, 1);
  const plateau = step(from, dir, 2);
  const jump = neighborInDir(from, 0, 'pointy');

  {
    UNIT_STATS.soldier.stamina = 0;
    const s = make(from, { high: [high], plateau: [jump, plateau] });
    const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
    assert(!walkOnto(s, p.id, jump), 'land cannot step onto adjacent plateau');
    assert(!walkOnto(s, p.id, high), 'land cannot climb high with 0 stamina');
    const bounced = applyAction(s, { kind: 'move', pieceId: p.id, to: jump });
    assert(bounced === s, 'apply land→plateau is a no-op');
    UNIT_STATS.soldier.stamina = saved.stamina;
  }

  {
    const s = make(from, { high: [high], plateau: [jump, plateau] });
    const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
    assert(walkOnto(s, p.id, high), 'land can still climb adjacent high');
  }

  {
    const s = make(high, { high: [high], plateau: [plateau, from] });
    const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
    assert(walkOnto(s, p.id, plateau), 'high can climb adjacent plateau');
    assert(walkOnto(s, p.id, from), 'high can still walk down to land');
  }

  {
    UNIT_STATS.soldier.stamina = 0;
    const s = make(plateau, { high: [high], plateau: [plateau] });
    const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
    const drop = neighborInDir(plateau, 0, 'pointy');
    assert(walkOnto(s, p.id, high), 'plateau can step down to high');
    assert(!walkOnto(s, p.id, drop), 'plateau cannot jump down to adjacent land');
    UNIT_STATS.soldier.stamina = saved.stamina;
  }

  {
    UNIT_STATS.scout.move = 2;
    const s = make(from, { high: [high], plateau: [plateau] }, 'scout');
    const p = s.pieces.find((x) => x.side === 'red' && x.type === 'scout')!;
    assert(walkOnto(s, p.id, plateau), 'range 2 land→high→plateau is one climb');
  }

  {
    const s = make(high, { high: [high], plateau: [plateau] }, 'tank');
    const p = s.pieces.find((x) => x.side === 'red' && x.type === 'tank')!;
    assert(!walkOnto(s, p.id, plateau), 'climb 0 cannot enter plateau');
  }

  {
    const ridge = [plateau, step(plateau, dir, 1), step(plateau, dir, 2), step(plateau, dir, 3)];
    const s = make(plateau, { high: [high], plateau: ridge });
    const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
    assert(walkOnto(s, p.id, ridge[3]), 'plateau +2 move: range 1 walks 3 along the ridge');
    assert(!walkOnto(s, p.id, step(plateau, dir, 4)), 'plateau +2 move does not walk 4');
  }

  {
    const s = make(high, { high: [high, step(high, 0, 1), step(high, 0, 2)] });
    const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
    assert(walkOnto(s, p.id, step(high, 0, 2)), 'high +1 move: range 1 walks 2 along the ridge');
  }

  UNIT_STATS.soldier.shoot = 4;
  UNIT_STATS.soldier.shootMin = 1;
  UNIT_STATS.soldier.splashDamage = 0;

  const d2 = step(from, dir, 2);
  const d3 = step(from, dir, 3);
  const d4 = step(from, dir, 4);

  {
    const s = make(from, { plateau: [d4] }, 'soldier', d4);
    const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
    assert(!shootAt(s, p.id, d4), 'range 4 cannot shoot plateau at distance 4');
  }
  {
    const s = make(from, { plateau: [d3] }, 'soldier', d3);
    const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
    assert(!shootAt(s, p.id, d3), 'range 4 cannot shoot plateau at distance 3 (3+2)');
  }
  {
    const s = make(from, { plateau: [d2] }, 'soldier', d2);
    const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
    assert(shootAt(s, p.id, d2), 'range 4 can shoot plateau at distance 2');
  }

  {
    const origin = { col: 5, row: 2 };
    const down = 5 as HexDir;
    const d6 = step(origin, down, 6);
    const d7 = step(origin, down, 7);
    const t = emptyTerrain(12, 12);
    t[origin.row][origin.col] = 'plateau';
    const s = createStateFromTerrain(t, 'plateau-shoot', 'pointy', [
      { type: 'soldier', col: origin.col, row: origin.row, side: 'red' },
      { type: 'general', col: 10, row: 1, side: 'red' },
      { type: 'soldier', col: d6.col, row: d6.row, side: 'blue' },
      { type: 'general', col: 1, row: 10, side: 'blue' },
    ]);
    s.turn = 'red';
    const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
    assert(shootAt(s, p.id, d6), 'range 4 on plateau shoots land at distance 6');
    assert(!shootAt(s, p.id, d7), 'range 4 on plateau does not shoot land at 7');
  }

  {
    const wet = step(from, dir, 1);
    UNIT_STATS.soldier.stamina = 0;
    const s = make(from, { water: [wet] });
    const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
    assert(walkOnto(s, p.id, wet), 'can enter water with 0 stamina');
    UNIT_STATS.soldier.stamina = saved.stamina;
  }

  {
    const wet = step(from, dir, 1);
    const s = make(from, { water: [wet] });
    const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
    assert(walkOnto(s, p.id, wet), 'swim unit can stop on water');
    const hl = legalHighlights(s, p.id).find(
      (x) => (x.kind === 'move' || x.kind === 'stamina') && x.hex.col === wet.col && x.hex.row === wet.row,
    );
    assert(hl?.kind === 'move', 'entering water is a normal move, not a stamina spend');
    const after = applyAction(s, { kind: 'move', pieceId: p.id, to: wet });
    const q = after.pieces.find((x) => x.id === p.id)!;
    assert(q.col === wet.col && q.row === wet.row, 'lands on water');
    assert(staminaLeft(q) === staminaLeft(p), 'entering water does not spend stamina');
    assert(!after.staminaBonus, 'water landing kills stamina bonus');
    assert(after.scoutPieceId === null, 'water landing ends the activation');
  }

  {
    const wet = step(from, dir, 1);
    const beyond = step(from, dir, 2);
    UNIT_STATS.scout.move = 2;
    const s = make(from, { water: [wet] }, 'scout');
    const p = s.pieces.find((x) => x.side === 'red' && x.type === 'scout')!;
    assert(walkOnto(s, p.id, wet), 'scout can step onto water');
    const through = pathForMove(s, p, beyond);
    assert(
      !through.some((h) => h.col === wet.col && h.row === wet.row),
      'cannot pass through water',
    );
  }

  {
    const wet = from;
    const one = step(from, dir, 1);
    const two = step(from, dir, 2);
    UNIT_STATS.scout.move = 2;
    const s = make(wet, { water: [wet] }, 'scout');
    const p = s.pieces.find((x) => x.side === 'red' && x.type === 'scout')!;
    assert(staminaLeft(p) === 0, 'turn-start water tax spends stamina');
    assert(walkOnto(s, p.id, one), 'from water, 1 hex');
    assert(!walkOnto(s, p.id, two), 'from water, not 2 hexes with 0 stamina left');
  }

  {
    const wet = from;
    const tgt = step(from, dir, 2);
    const s = make(wet, { water: [wet] }, 'scout', tgt);
    const p = s.pieces.find((x) => x.side === 'red' && x.type === 'scout')!;
    assert(!shootAt(s, p.id, tgt), 'cannot shoot from water');
    assert(
      !legalHighlights(s, p.id).some((h) => h.kind === 'shoot' || h.kind === 'shoot-range'),
      'no shoot tiles when selected in water',
    );
    const fired = applyAction(s, { kind: 'shoot', pieceId: p.id, at: tgt });
    assert(fired === s, 'apply shoot from water is a no-op');
  }

  {
    const wet = from;
    const one = step(from, dir, 1);
    const two = step(from, dir, 2);
    UNIT_STATS.soldier.stamina = 2;
    const s = make(wet, { water: [wet] });
    const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
    assert(staminaLeft(p) === 1, 'water penalty leaves leftover stamina');
    assert(walkOnto(s, p.id, one), 'from water, normal 1 hex');
    assert(walkOnto(s, p.id, two), 'leftover stamina still buys a second 1-hex from water');
    const hl = legalHighlights(s, p.id).find(
      (x) => x.hex.col === two.col && x.hex.row === two.row,
    );
    assert(hl?.kind === 'stamina', 'second hex from water is a stamina action');
    UNIT_STATS.soldier.stamina = saved.stamina;
  }

  {
    const wet = step(from, dir, 1);
    UNIT_STATS.soldier.staminaRegen = 0;
    const s = make(from, { water: [wet] });
    const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
    p.hp = 4;
    let cur = applyAction(s, { kind: 'move', pieceId: p.id, to: wet });
    cur = passTurn(cur);
    const q = cur.pieces.find((x) => x.id === p.id)!;
    assert(staminaLeft(q) === 0, 'next turn in water spends 1 stamina');
    assert(hpLeft(q) === 4, 'paid stamina, no drown');
    cur = passTurn(cur);
    cur = passTurn(cur);
    const r = cur.pieces.find((x) => x.id === p.id)!;
    assert(hpLeft(r) === 2, 'no stamina left → 2 HP drown');
    UNIT_STATS.soldier.staminaRegen = saved.staminaRegen;
  }

  {
    const wet = step(from, dir, 1);
    const s = make(from, { water: [wet] }, 'tank');
    const p = s.pieces.find((x) => x.side === 'red' && x.type === 'tank')!;
    assert(!walkOnto(s, p.id, wet), 'tank cannot enter water');
  }

  {
    const peak = step(from, dir, 1);
    const s = make(from, { rock: [peak] });
    const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
    assert(!walkOnto(s, p.id, peak), 'climb 2 cannot step land→mountain');
  }

  {
    const savedClimb = UNIT_STATS.soldier.climbLevel;
    UNIT_STATS.soldier.climbLevel = 3;
    const peak = step(plateau, dir, 1);
    const s = make(plateau, { high: [high], plateau: [plateau], rock: [peak] });
    const p = s.pieces.find((x) => x.side === 'red' && x.type === 'soldier')!;
    assert(walkOnto(s, p.id, peak), 'climb 3 plateau→mountain');
    UNIT_STATS.soldier.climbLevel = savedClimb;
  }
} finally {
  Object.assign(UNIT_STATS.soldier, {
    shoot: saved.shoot,
    shootMin: saved.shootMin,
    splashDamage: saved.splashDamage,
    stamina: saved.stamina,
    staminaRegen: saved.staminaRegen,
  });
  UNIT_STATS.scout.move = saved.move;
}

console.log('plateau +2: walk only via high, shoot tax +2');
