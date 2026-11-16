import {
  actionPointsLeft,
  allLegalActions,
  applyAction,
  canBash,
  canBerserk,
  canShields,
  getPiece,
  hasActed,
  hasShieldsUp,
  hpLeft,
  legalHighlights,
  passTurn,
  tokenOnHex,
  UNIT_STATS,
} from '../src/engine';
import { neighborInDir, type Hex, type HexDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const O = 'pointy' as const;

function at(origin: Hex, dir: HexDir, steps = 1): Hex {
  let h = origin;
  for (let i = 0; i < steps; i++) h = neighborInDir(h, dir, O);
  return h;
}

function boot(
  red: { type: 'soldier' | 'hoplite' | 'archer'; col: number; row: number; facing?: HexDir }[],
  blue: { type: 'soldier' | 'hoplite' | 'archer'; col: number; row: number }[],
  tokens: { type: 'wall' | 'palisade' | 'forest'; col: number; row: number; hp?: number }[] = [],
) {
  const terrain = emptyTerrain(9, 9);
  const s = createStateFromTerrain(
    terrain,
    'bash',
    O,
    [
      ...red.map((p) => ({ ...p, side: 'red' as const })),
      ...blue.map((p) => ({ ...p, side: 'blue' as const })),
    ],
    undefined,
    tokens,
  );
  s.turn = 'red';
  return { s, terrain };
}

{
  const origin: Hex = { col: 4, row: 4 };
  const foe = at(origin, 0);
  const past = at(origin, 0, 2);
  const { s } = boot(
    [{ type: 'soldier', ...origin, facing: 0 }],
    [
      { type: 'hoplite', ...foe },
      { type: 'soldier', col: 0, row: 0 },
    ],
  );
  const basher = s.pieces.find((p) => p.side === 'red')!;
  const enemy = s.pieces.find((p) => p.col === foe.col && p.row === foe.row)!;
  basher.abilities = ['bash'];
  basher.hp = 6;
  enemy.hp = 5;
  assert(canBash(s, basher.id), 'bash ready on a green face');
  assert(allLegalActions(s).some((a) => a.kind === 'bash'), 'bash is a legal action');
  const next = applyAction(s, { kind: 'bash', pieceId: basher.id });
  const shoved = getPiece(next, enemy.id)!;
  assert(shoved.col === past.col && shoved.row === past.row, 'open ground: one step back');
  assert(hpLeft(shoved) === 5, 'open ground: no damage');
  assert(next.scoutPieceId === basher.id, 'bash leaves leftover AP');
  assert(actionPointsLeft(getPiece(next, basher.id)!) === 1, 'bash spends 1');
}

{
  const origin: Hex = { col: 4, row: 4 };
  const foe = at(origin, 0);
  const past = at(origin, 0, 2);
  const { s } = boot(
    [{ type: 'soldier', ...origin, facing: 0 }],
    [
      { type: 'hoplite', ...foe },
      { type: 'hoplite', ...past },
      { type: 'soldier', col: 0, row: 0 },
    ],
  );
  const basher = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
  const enemy = s.pieces.find((p) => p.col === foe.col && p.row === foe.row)!;
  const block = s.pieces.find((p) => p.col === past.col && p.row === past.row)!;
  basher.abilities = ['bash'];
  enemy.hp = 5;
  block.hp = 5;
  const next = applyAction(s, { kind: 'bash', pieceId: basher.id });
  const shoved = getPiece(next, enemy.id)!;
  assert(shoved.col === foe.col && shoved.row === foe.row, 'unit collision: stays');
  assert(hpLeft(shoved) === 4, 'unit collision: pushed takes melee');
  assert(hpLeft(getPiece(next, block.id)!) === 4, 'unit collision: blocker takes melee');
}

{
  const origin: Hex = { col: 4, row: 4 };
  const foe = at(origin, 0);
  const past = at(origin, 0, 2);
  const { s } = boot(
    [{ type: 'soldier', ...origin, facing: 0 }],
    [
      { type: 'hoplite', ...foe },
      { type: 'soldier', col: 0, row: 0 },
    ],
    [{ type: 'wall', ...past }],
  );
  const basher = s.pieces.find((p) => p.side === 'red')!;
  const enemy = s.pieces.find((p) => p.type === 'hoplite')!;
  basher.abilities = ['bash'];
  enemy.hp = 5;
  const next = applyAction(s, { kind: 'bash', pieceId: basher.id });
  const shoved = getPiece(next, enemy.id)!;
  assert(shoved.col === foe.col && shoved.row === foe.row, 'wall: stays');
  assert(hpLeft(shoved) === 4, 'wall: pushed unit takes damage');
}

{
  const origin: Hex = { col: 4, row: 4 };
  const foe = at(origin, 0);
  const past = at(origin, 0, 2);
  const { s } = boot(
    [{ type: 'soldier', ...origin, facing: 0 }],
    [
      { type: 'hoplite', ...foe },
      { type: 'soldier', col: 0, row: 0 },
    ],
  );
  s.terrain[past.row]![past.col] = 'plateau';
  const basher = s.pieces.find((p) => p.side === 'red')!;
  const enemy = s.pieces.find((p) => p.type === 'hoplite')!;
  basher.abilities = ['bash'];
  enemy.hp = 5;
  const next = applyAction(s, { kind: 'bash', pieceId: basher.id });
  const shoved = getPiece(next, enemy.id)!;
  assert(shoved.col === foe.col && shoved.row === foe.row, 'high ground: stays');
  assert(hpLeft(shoved) === 4, 'high ground: pushed unit takes damage');
}

{
  const origin: Hex = { col: 4, row: 4 };
  const foe = at(origin, 0);
  const past = at(origin, 0, 2);
  const { s } = boot(
    [{ type: 'soldier', ...origin, facing: 0 }],
    [
      { type: 'hoplite', ...foe },
      { type: 'soldier', col: 0, row: 0 },
    ],
  );
  s.terrain[past.row]![past.col] = 'high';
  const basher = s.pieces.find((p) => p.side === 'red')!;
  const enemy = s.pieces.find((p) => p.type === 'hoplite')!;
  basher.abilities = ['bash'];
  enemy.hp = 5;
  const next = applyAction(s, { kind: 'bash', pieceId: basher.id });
  const shoved = getPiece(next, enemy.id)!;
  assert(shoved.col === past.col && shoved.row === past.row, 'one-level hill: steps up');
  assert(hpLeft(shoved) === 5, 'reachable height: no slam');
}

{
  const origin: Hex = { col: 4, row: 4 };
  const foe = at(origin, 0);
  const past = at(origin, 0, 2);
  const { s } = boot(
    [{ type: 'soldier', ...origin, facing: 0 }],
    [
      { type: 'hoplite', ...foe },
      { type: 'soldier', col: 0, row: 0 },
    ],
    [{ type: 'palisade', ...past }],
  );
  const basher = s.pieces.find((p) => p.side === 'red')!;
  const enemy = s.pieces.find((p) => p.type === 'hoplite')!;
  basher.abilities = ['bash'];
  enemy.hp = 5;
  const next = applyAction(s, { kind: 'bash', pieceId: basher.id });
  const shoved = getPiece(next, enemy.id)!;
  const wood = tokenOnHex(next.tokens, past, 'palisade');
  assert(shoved.col === foe.col && shoved.row === foe.row, 'palisade: stays');
  assert(hpLeft(shoved) === 4, 'palisade: unit takes 1');
  assert(wood?.hp === 2, 'palisade: token takes 1');
}

{
  const origin: Hex = { col: 4, row: 4 };
  const foe = at(origin, 0);
  const past = at(origin, 0, 2);
  const { s } = boot(
    [{ type: 'soldier', ...origin, facing: 0 }],
    [
      { type: 'hoplite', ...foe },
      { type: 'soldier', col: 0, row: 0 },
    ],
    [{ type: 'forest', ...past, hp: 3 }],
  );
  const basher = s.pieces.find((p) => p.side === 'red')!;
  const enemy = s.pieces.find((p) => p.type === 'hoplite')!;
  basher.abilities = ['bash'];
  enemy.hp = 5;
  const next = applyAction(s, { kind: 'bash', pieceId: basher.id });
  const shoved = getPiece(next, enemy.id)!;
  const wood = tokenOnHex(next.tokens, past, 'forest');
  assert(shoved.col === past.col && shoved.row === past.row, 'forest: enters');
  assert(hpLeft(shoved) === 4, 'forest: unit takes 1');
  assert(wood?.hp === 2, 'forest: token takes 1');
}

{
  const prev = UNIT_STATS.hoplite.armorRear;
  UNIT_STATS.hoplite.armorRear = -2;
  try {
    const origin: Hex = { col: 4, row: 4 };
    const front = at(origin, 0);
    const rear = at(origin, 3);
    const { s } = boot(
      [{ type: 'hoplite', ...origin, facing: 0 }],
      [
        { type: 'soldier', ...front },
        { type: 'soldier', ...rear },
        { type: 'soldier', col: 0, row: 0 },
      ],
    );
    const basher = s.pieces.find((p) => p.type === 'hoplite')!;
    const frontFoe = s.pieces.find((p) => p.col === front.col && p.row === front.row)!;
    const rearFoe = s.pieces.find((p) => p.col === rear.col && p.row === rear.row)!;
    basher.abilities = ['berserk'];
    frontFoe.hp = 5;
    rearFoe.hp = 5;
    assert(canBerserk(s, basher.id), 'berserk ready');
    const armor = UNIT_STATS.soldier.armor;
    UNIT_STATS.soldier.armor = -2;
    try {
      const next = applyAction(s, { kind: 'berserk', pieceId: basher.id });
      assert(hpLeft(getPiece(next, frontFoe.id)!) === 2, 'berserk: melee 1 into armor -2 deals 3');
      assert(hpLeft(getPiece(next, rearFoe.id)!) === 5, 'berserk: red face is skipped');
    } finally {
      UNIT_STATS.soldier.armor = armor;
    }
  } finally {
    UNIT_STATS.hoplite.armorRear = prev;
  }
}

{
  const origin: Hex = { col: 4, row: 4 };
  const shooter = at(origin, 0, 2);
  const { s } = boot(
    [{ type: 'soldier', ...origin, facing: 0 }],
    [{ type: 'archer', ...shooter }],
  );
  const tank = s.pieces.find((p) => p.side === 'red')!;
  const bow = s.pieces.find((p) => p.type === 'archer')!;
  tank.abilities = ['shields'];
  tank.hp = 4;
  assert(canShields(s, tank.id), 'shields ready');
  assert(actionPointsLeft(tank) === 2, 'starts full');
  const raised = applyAction(s, { kind: 'shields', pieceId: tank.id });
  const up = getPiece(raised, tank.id)!;
  assert(hasShieldsUp(up), 'shields stay up into the enemy turn');
  assert(actionPointsLeft(up) === 1, 'shields spends 1');
  assert(raised.scoutPieceId === null, 'leftover AP cannot be spent');
  assert(hasActed(raised, tank.id) || raised.turn !== 'red', 'activation ended');
  assert(raised.turn === 'blue', 'side turn passed');
  const shot = legalHighlights(raised, bow.id).find(
    (h) => h.hex.col === up.col && h.hex.row === up.row && (h.kind === 'shoot' || h.kind === 'shoot-range'),
  );
  assert(shot?.kind === 'shoot-range', 'shielded unit is not a fire target');
  const refused = applyAction(raised, { kind: 'shoot', pieceId: bow.id, at: { col: up.col, row: up.row } });
  assert(hpLeft(getPiece(refused, tank.id)!) === 4, 'shot does not land');
  assert(hasShieldsUp(getPiece(refused, tank.id)!), 'refused shot does not drop shields');
  const reds = passTurn(refused);
  assert(reds.turn === 'red', 'back to red');
  assert(!hasShieldsUp(getPiece(reds, tank.id)!), 'shields drop at this side\'s next turn');
}

{
  const { s } = boot(
    [
      { type: 'soldier', col: 4, row: 4, facing: 0 },
      { type: 'soldier', col: 4, row: 6, facing: 0 },
    ],
    [{ type: 'soldier', col: 0, row: 0 }],
  );
  s.unitsPerTurn = 2;
  const a = s.pieces.find((p) => p.side === 'red' && p.row === 4)!;
  const b = s.pieces.find((p) => p.side === 'red' && p.row === 6)!;
  a.abilities = ['shields'];
  a.hp = 4;
  b.hp = 4;
  const next = applyAction(s, { kind: 'shields', pieceId: a.id });
  assert(next.turn === 'red', 'other unit still to act');
  assert(next.scoutPieceId === null, 'shields does not open a second action');
  assert(hasActed(next, a.id), 'shielder has acted');
  assert(!hasActed(next, b.id), 'partner has not acted');
  assert(actionPointsLeft(getPiece(next, a.id)!) === 1, 'partner turn does not refund the spend');
}

console.log('bash / berserk / shields ok');
