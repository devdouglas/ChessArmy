import { applyAction, hpLeft, legalHighlights, previewMove, UNIT_STATS } from '../src/engine';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function board() {
  const t = emptyTerrain(10, 8);
  for (let row = 0; row < 8; row++) {
    if (row === 5) continue;
    for (let col = 0; col < 10; col++) t[row][col] = 'rock';
  }
  const s = createStateFromTerrain(t, 'charge-live', 'pointy', [
    { type: 'tank', col: 1, row: 5, side: 'red' },
    { type: 'general', col: 0, row: 5, side: 'red' },
    { type: 'soldier', col: 2, row: 5, side: 'blue' },
    { type: 'soldier', col: 3, row: 5, side: 'blue' },
    { type: 'general', col: 8, row: 5, side: 'blue' },
  ]);
  s.turn = 'red';
  return s;
}

const savedHp = UNIT_STATS.soldier.hp;
const savedArmor = UNIT_STATS.soldier.armor;
const savedPass = UNIT_STATS.tank.passUnits;
const savedStam = UNIT_STATS.tank.stamina;
const savedClimb = UNIT_STATS.tank.climbLevel;
const savedCharge = UNIT_STATS.tank.charge;
const savedMelee = UNIT_STATS.tank.meleeDamage;
const savedMove = UNIT_STATS.tank.move;
const savedAbilities = [...UNIT_STATS.tank.abilities];

try {
  UNIT_STATS.soldier.hp = 2;
  UNIT_STATS.soldier.armor = 0;
  UNIT_STATS.tank.passUnits = false;
  UNIT_STATS.tank.stamina = 0;
  UNIT_STATS.tank.climbLevel = 0;
  UNIT_STATS.tank.charge = 1;
  UNIT_STATS.tank.meleeDamage = 1;
  if (!UNIT_STATS.tank.abilities.includes('charge')) {
    UNIT_STATS.tank.abilities = [...UNIT_STATS.tank.abilities, 'charge'];
  }

  const firstHex = { col: 2, row: 5 };
  const secondHex = { col: 3, row: 5 };
  const beyond = { col: 4, row: 5 };

  {
    const s = board();
    const tank = s.pieces.find((p) => p.type === 'tank' && p.side === 'red')!;
    const plan = previewMove(s, tank, firstHex);
    assert(plan.hits.length === 1, `melee the front, got ${plan.hits.length} hits`);
    assert(plan.hits[0].remaining === 1, 'front survives at 1');
    assert(plan.stop.col === 1 && plan.stop.row === 5, `bounce before survivor, stop ${plan.stop.col},${plan.stop.row}`);

    const after = applyAction(s, { kind: 'move', pieceId: tank.id, to: firstHex });
    const moved = after.pieces.find((p) => p.id === tank.id)!;
    const front = after.pieces.find((p) => p.col === 2 && p.row === 5)!;
    const back = after.pieces.find((p) => p.col === 3 && p.row === 5)!;
    assert(moved.col === 1 && moved.row === 5, 'tank stays put');
    assert(hpLeft(front) === 1, 'front took the hit');
    assert(hpLeft(back) === 2, 'back unit untouched');
    const free = legalHighlights(s, tank.id).filter((h) => h.kind === 'charge');
    assert(
      free.some((h) => h.hex.col === beyond.col && !h.extra),
      'a crash inside the normal move needs no energy',
    );
    assert(!free.some((h) => h.extra), 'no pool → no extra-reach charge marks');
    const blocked = applyAction(s, { kind: 'charge', pieceId: tank.id, to: { col: 5, row: 5 } });
    const stuck = blocked.pieces.find((p) => p.id === tank.id)!;
    assert(stuck.col === 1 && stuck.row === 5, 'unpaid charge does not move');
    const hopped = applyAction(s, { kind: 'charge', pieceId: tank.id, to: beyond });
    const hopper = hopped.pieces.find((p) => p.id === tank.id)!;
    assert(hopper.col === beyond.col && hopper.row === beyond.row, 'in-move charge lands');
    assert(!hopped.log.some((l) => l.includes('spends energy')), 'in-move charge spends nothing');
  }

  UNIT_STATS.tank.stamina = Math.max(1, savedStam);
  {
    const s = board();
    const tank = s.pieces.find((p) => p.type === 'tank' && p.side === 'red')!;
    tank.stamina = 0;
    const marks = legalHighlights(s, tank.id).filter((h) => h.kind === 'charge');
    assert(
      marks.some((h) => h.hex.col === 5 && h.unpaid),
      'an empty pool leaves the extra charge tile as a crossed-bolt mark',
    );
    assert(!marks.some((h) => h.extra && !h.unpaid), 'empty pool cannot pay for the extra');
    const blocked = applyAction(s, { kind: 'charge', pieceId: tank.id, to: { col: 5, row: 5 } });
    const stuck = blocked.pieces.find((p) => p.id === tank.id)!;
    assert(stuck.col === 1, 'clicking the crossed tile does not move');
  }

  {
    const s = board();
    const tank = s.pieces.find((p) => p.type === 'tank' && p.side === 'red')!;
    assert(
      legalHighlights(s, tank.id).some(
        (h) => h.kind === 'charge' && h.hex.col === secondHex.col && h.hex.row === secondHex.row,
      ),
      'second unit is a charge dest',
    );
    const plan = previewMove(s, tank, secondHex, undefined, { charging: true });
    assert(plan.hits.length === 1, `blocker eats the charge, got ${plan.hits.length} hits`);
    assert(plan.hits[0].remaining === 1, 'front took charge, survived');
    assert(plan.stop.col === 1 && plan.stop.row === 5, 'blocked, bounce');
    const after = applyAction(s, { kind: 'charge', pieceId: tank.id, to: secondHex });
    const front = after.pieces.find((p) => p.col === 2 && p.row === 5)!;
    const back = after.pieces.find((p) => p.col === 3 && p.row === 5)!;
    assert(hpLeft(front) === 1, 'front blocked the click-through');
    assert(hpLeft(back) === 2, 'second unit not reached');
  }

  {
    const s = board();
    const tank = s.pieces.find((p) => p.type === 'tank' && p.side === 'red')!;
    const plan = previewMove(s, tank, beyond, undefined, { charging: true });
    assert(plan.hits.length === 2, `empty dest trampling, got ${plan.hits.length}`);
    assert(plan.hits.every((h) => !h.fatal && h.remaining === 1), 'both survive at 1');
    assert(plan.stop.col === 4 && plan.stop.row === 5, 'lands empty beyond');
    const after = applyAction(s, { kind: 'charge', pieceId: tank.id, to: beyond });
    const moved = after.pieces.find((p) => p.id === tank.id)!;
    const blues = after.pieces.filter((p) => p.side === 'blue' && p.type === 'soldier');
    assert(moved.col === 4 && moved.row === 5, 'tank at empty dest');
    assert(blues.length === 2, 'both still alive');
    assert(blues.every((p) => hpLeft(p) === 1), 'both took charge');
  }

  UNIT_STATS.soldier.hp = 1;
  {
    const s = board();
    const tank = s.pieces.find((p) => p.type === 'tank' && p.side === 'red')!;
    const plan = previewMove(s, tank, secondHex, undefined, { charging: true });
    assert(plan.hits.length === 2, `kill first then melee second, got ${plan.hits.length}`);
    assert(plan.hits[0].fatal, 'first died to charge');
    assert(plan.hits[1].fatal, 'second died to melee');
    const after = applyAction(s, { kind: 'charge', pieceId: tank.id, to: secondHex });
    const moved = after.pieces.find((p) => p.id === tank.id)!;
    assert(moved.col === 3 && moved.row === 5, 'occupies second after killing the blocker');
    assert(!after.pieces.some((p) => p.side === 'blue' && p.type === 'soldier'), 'both dead');
  }

  UNIT_STATS.soldier.hp = 2;
  UNIT_STATS.tank.passUnits = true;
  UNIT_STATS.tank.move = 3;
  UNIT_STATS.tank.stamina = 0;
  {
    const s = board();
    const tank = s.pieces.find((p) => p.type === 'tank' && p.side === 'red')!;
    const after = applyAction(s, { kind: 'move', pieceId: tank.id, to: beyond });
    const moved = after.pieces.find((p) => p.id === tank.id)!;
    const blues = after.pieces.filter((p) => p.side === 'blue' && p.type === 'soldier');
    assert(moved.col === 4 && moved.row === 5, 'hop lands beyond the line');
    assert(blues.length === 2 && blues.every((p) => hpLeft(p) === 1), 'hop still deals charge damage');
    assert(!moved.staminaUsedThisTurn, 'a hop does not spend the charge action');
  }

  UNIT_STATS.tank.stamina = 1;
  UNIT_STATS.tank.passUnits = false;
  UNIT_STATS.tank.move = 3;
  {
    const s = board();
    const tank = s.pieces.find((p) => p.type === 'tank' && p.side === 'red')!;
    const far = { col: 5, row: 5 };
    const hl = legalHighlights(s, tank.id).find((h) => h.kind === 'charge' && h.hex.col === far.col);
    assert(hl?.extra, 'past the normal move the charge spends energy');
    const after = applyAction(s, { kind: 'charge', pieceId: tank.id, to: far });
    const moved = after.pieces.find((p) => p.id === tank.id)!;
    assert(moved.col === far.col && moved.row === far.row, 'extra charge lands');
    assert(
      moved.stamina === 0 && after.log.some((l) => l.includes('spends energy')),
      'picking that tile spends 1 energy',
    );
  }
} finally {
  UNIT_STATS.soldier.hp = savedHp;
  UNIT_STATS.soldier.armor = savedArmor;
  UNIT_STATS.tank.passUnits = savedPass;
  UNIT_STATS.tank.stamina = savedStam;
  UNIT_STATS.tank.climbLevel = savedClimb;
  UNIT_STATS.tank.charge = savedCharge;
  UNIT_STATS.tank.meleeDamage = savedMelee;
  UNIT_STATS.tank.move = savedMove;
  UNIT_STATS.tank.abilities = savedAbilities;
}

console.log('charge: blocker stops occupied dest unless killed; empty dest trampling');
