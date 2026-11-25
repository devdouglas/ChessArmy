import {
  actionPointGainOf,
  actionPointsLeft,
  actionPointsMax,
  applyWaterUpkeep,
  apSpendCap,
  armorBonusOf,
  armorColor,
  armorOf,
  attackBonusOf,
  canPassWater,
  climbLevelOf,
  countUnitToken,
  hasAbility,
  hasAllTerrain,
  hpBonusOf,
  hpLeft,
  hpMax,
  isConcealed,
  isConcealedFrom,
  isRedFaceRay,
  legalHighlights,
  meleeDamageOf,
  netDamage,
  refusesWaterJump,
  sanitizeUnitTokens,
  shootDamageOf,
  shootRangeOf,
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

function shootAt(s: GameState, pieceId: string, h: Hex) {
  return legalHighlights(s, pieceId).some(
    (x) =>
      (x.kind === 'shoot' || x.kind === 'shoot-range') &&
      x.hex.col === h.col &&
      x.hex.row === h.row,
  );
}

{
  const stacked = sanitizeUnitTokens([
    'range1',
    'range1',
    'range1',
    'range1',
    'range1',
    'range1',
    'sleep',
  ]);
  assert(
    stacked.filter((t) => t === 'range1').length === 5,
    'cap stackable promotions at 5',
  );
  assert(stacked.includes('sleep'), 'status tokens kept');

  const withGeneral = sanitizeUnitTokens([
    'range1',
    'general',
    'range1',
    'range1',
    'range1',
    'range1',
    'range1',
    'range1',
    'general',
    'sleep',
  ]);
  assert(withGeneral.filter((t) => t === 'general').length === 1, 'General promo stays unique');
  assert(
    withGeneral.filter((t) => t === 'range1').length === 5,
    'General does not consume a stackable promo slot',
  );
  assert(withGeneral.includes('sleep'), 'status tokens kept with General');
}

const saved = { shoot: UNIT_STATS.archer.shoot, shootMin: UNIT_STATS.archer.shootMin };
try {
  UNIT_STATS.archer.shoot = 3;
  UNIT_STATS.archer.shootMin = 1;

  const from = { col: 4, row: 5 };
  const dir = 2 as HexDir;
  const d3 = step(from, dir, 3);
  const d4 = step(from, dir, 4);
  const d5 = step(from, dir, 5);

  const s = createStateFromTerrain(emptyTerrain(8, 10), 'promo-range', 'pointy', [
    {
      type: 'archer',
      col: from.col,
      row: from.row,
      side: 'red',
      unitTokens: ['range1', 'range1'],
    },
    { type: 'general', col: 7, row: 1, side: 'red' },
    { type: 'soldier', col: d5.col, row: d5.row, side: 'blue' },
    { type: 'general', col: 1, row: 9, side: 'blue' },
  ]);
  s.turn = 'red';
  const archer = s.pieces.find((p) => p.side === 'red' && p.type === 'archer')!;
  assert(countUnitToken(archer, 'range1') === 2, 'two Range +1 stamps');
  assert(shootRangeOf(archer) === 5, '3 base + 2 promotions');
  assert(shootAt(s, archer.id, d3), 'still hits base range');
  assert(shootAt(s, archer.id, d4), 'one promo extends to 4');
  assert(shootAt(s, archer.id, d5), 'two promos extend to 5');
} finally {
  Object.assign(UNIT_STATS.archer, saved);
}

{
  const mixed = sanitizeUnitTokens([
    'range1',
    'defense1',
    'range1',
    'defense1',
    'attack1',
    'ap1',
  ]);
  assert(mixed.length === 5, 'mixed promos still cap at 5');
  assert(mixed.filter((t) => t === 'ap1').length === 0, 'drops past the fifth slot');
  assert(mixed.filter((t) => t === 'attack1').length === 1, 'keeps first five slots');
}

{
  const armorSaved = {
    armor: UNIT_STATS.soldier.armor,
    hexArmor: UNIT_STATS.cohort.hexArmor,
    armorFront: UNIT_STATS.cohort.armorFront,
    armorRear: UNIT_STATS.cohort.armorRear,
  };
  try {
    UNIT_STATS.soldier.armor = 0;
    const soft = createStateFromTerrain(emptyTerrain(6, 6), 'promo-def', 'pointy', [
      {
        type: 'soldier',
        col: 2,
        row: 2,
        side: 'blue',
        unitTokens: ['defense1', 'defense1'],
      },
      { type: 'general', col: 0, row: 0, side: 'blue' },
      { type: 'soldier', col: 4, row: 4, side: 'red' },
      { type: 'general', col: 5, row: 5, side: 'red' },
    ]);
    const victim = soft.pieces.find((p) => p.side === 'blue' && p.type === 'soldier')!;
    assert(armorBonusOf(victim) === 2, 'two Defense +1');
    assert(armorOf(victim) === 2, 'ring armor 0+2');
    assert(armorColor(armorOf(victim)) === '#8b5cf6', 'border shifts to purple');
    assert(netDamage(victim, 3, 1) === 1, 'soak 2 from 3 dmg');

    UNIT_STATS.cohort.hexArmor = true;
    UNIT_STATS.cohort.armorFront = -2;
    UNIT_STATS.cohort.armorRear = 0;
    const hexed = createStateFromTerrain(emptyTerrain(6, 6), 'promo-hex-def', 'pointy', [
      {
        type: 'cohort',
        col: 2,
        row: 2,
        side: 'blue',
        facing: 2,
        unitTokens: ['defense1'],
      },
      { type: 'general', col: 0, row: 0, side: 'blue' },
      { type: 'soldier', col: 4, row: 4, side: 'red' },
      { type: 'general', col: 5, row: 5, side: 'red' },
    ]);
    const phalanx = hexed.pieces.find((p) => p.type === 'cohort')!;
    const fromFront = neighborInDir(
      { col: phalanx.col, row: phalanx.row },
      2,
      'pointy',
    );
    assert(
      !isRedFaceRay(phalanx, { col: phalanx.col, row: phalanx.row }, fromFront, 'pointy'),
      'Defense +1 lifts −2 front out of red',
    );
    assert(
      armorOf(phalanx, fromFront, 'pointy') === -1,
      'front face −2+1 = −1',
    );
    assert(armorColor(-1) === '#e89030', '−1 face is orange');
  } finally {
    Object.assign(UNIT_STATS.soldier, { armor: armorSaved.armor });
    Object.assign(UNIT_STATS.cohort, {
      hexArmor: armorSaved.hexArmor,
      armorFront: armorSaved.armorFront,
      armorRear: armorSaved.armorRear,
    });
  }
}

{
  const atkSaved = { meleeDamage: UNIT_STATS.soldier.meleeDamage, shootDamage: UNIT_STATS.archer.shootDamage };
  try {
    UNIT_STATS.soldier.meleeDamage = 1;
    UNIT_STATS.archer.shootDamage = 1;
    const s = createStateFromTerrain(emptyTerrain(6, 6), 'promo-atk', 'pointy', [
      {
        type: 'soldier',
        col: 2,
        row: 2,
        side: 'red',
        unitTokens: ['attack1', 'attack1'],
      },
      {
        type: 'archer',
        col: 3,
        row: 2,
        side: 'red',
        unitTokens: ['attack1'],
      },
      { type: 'general', col: 0, row: 0, side: 'red' },
      { type: 'soldier', col: 4, row: 4, side: 'blue' },
      { type: 'general', col: 5, row: 5, side: 'blue' },
    ]);
    const grunt = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
    const bow = s.pieces.find((p) => p.type === 'archer')!;
    assert(attackBonusOf(grunt) === 2, 'two Attack +1');
    assert(meleeDamageOf(grunt) === 3, 'melee 1+2');
    assert(shootDamageOf(bow) === 2, 'shot 1+1');
  } finally {
    Object.assign(UNIT_STATS.soldier, { meleeDamage: atkSaved.meleeDamage });
    Object.assign(UNIT_STATS.archer, { shootDamage: atkSaved.shootDamage });
  }
}

{
  const apSaved = {
    actionPoints: UNIT_STATS.soldier.actionPoints,
    actionPointGain: UNIT_STATS.soldier.actionPointGain,
    actionPointSpendCap: UNIT_STATS.soldier.actionPointSpendCap,
  };
  try {
    UNIT_STATS.soldier.actionPoints = 2;
    UNIT_STATS.soldier.actionPointGain = 1;
    UNIT_STATS.soldier.actionPointSpendCap = 2;
    const s = createStateFromTerrain(emptyTerrain(6, 6), 'promo-ap', 'pointy', [
      {
        type: 'soldier',
        col: 2,
        row: 2,
        side: 'red',
        unitTokens: ['ap1', 'ap1'],
      },
      { type: 'general', col: 0, row: 0, side: 'red' },
      { type: 'soldier', col: 4, row: 4, side: 'blue' },
      { type: 'general', col: 5, row: 5, side: 'blue' },
    ]);
    const grunt = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
    assert(actionPointsMax(grunt) === 4, 'max AP 2+2');
    assert(actionPointGainOf(grunt) === 3, 'gain 1+2');
    assert(apSpendCap(grunt) === 4, 'spend cap 2 + 2 AP promos');
  } finally {
    Object.assign(UNIT_STATS.soldier, apSaved);
  }
}

{
  const hpSaved = UNIT_STATS.soldier.hp;
  try {
    UNIT_STATS.soldier.hp = 2;
    const s = createStateFromTerrain(emptyTerrain(6, 6), 'promo-hp', 'pointy', [
      {
        type: 'soldier',
        col: 2,
        row: 2,
        side: 'red',
        unitTokens: ['hp2', 'hp2'],
      },
      { type: 'general', col: 0, row: 0, side: 'red' },
      { type: 'soldier', col: 4, row: 4, side: 'blue' },
      { type: 'general', col: 5, row: 5, side: 'blue' },
    ]);
    const grunt = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
    assert(hpBonusOf(grunt) === 4, 'two HP +2 → +4');
    assert(hpMax(grunt) === 6, 'max HP 2+4');
    assert(hpLeft(grunt) === 6, 'spawn at full new max');
    grunt.hp = 3;
    assert(hpLeft(grunt) === 3, 'wounded stays wounded');
    const fresh = { ...grunt, hp: undefined, unitTokens: ['hp2'] };
    assert(hpMax(fresh) === 4, 'one HP +2');
    assert(hpLeft(fresh) === 4, 'undefined hp = full new max');
  } finally {
    UNIT_STATS.soldier.hp = hpSaved;
  }
}

{
  const terrSaved = {
    climbLevel: UNIT_STATS.soldier.climbLevel,
    passWater: UNIT_STATS.soldier.passWater,
    actionPoints: UNIT_STATS.soldier.actionPoints,
  };
  try {
    UNIT_STATS.soldier.climbLevel = 0;
    UNIT_STATS.soldier.passWater = false;
    UNIT_STATS.soldier.actionPoints = 2;
    const t = emptyTerrain(6, 6);
    const from = { col: 2, row: 2 };
    const hill = neighborInDir(from, 0, 'pointy');
    t[hill.row][hill.col] = 'high';
    const s = createStateFromTerrain(t, 'promo-terrain', 'pointy', [
      {
        type: 'soldier',
        col: from.col,
        row: from.row,
        side: 'red',
        unitTokens: ['allTerrain'],
      },
      { type: 'general', col: 0, row: 0, side: 'red' },
      { type: 'soldier', col: 4, row: 4, side: 'blue' },
      { type: 'general', col: 5, row: 5, side: 'blue' },
    ]);
    s.turn = 'red';
    const grunt = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
    assert(hasAllTerrain(grunt), 'all terrain token');
    assert(climbLevelOf(grunt) === 3, 'climb to mountain');
    assert(canPassWater(grunt), 'can enter water');
    assert(!refusesWaterJump({ ...grunt, actionPoints: 0, hp: 1 }), 'no drown gate');
    const climbHit = legalHighlights(s, grunt.id).find(
      (h) => h.hex.col === hill.col && h.hex.row === hill.row,
    );
    assert(climbHit, 'can step onto hill with climb 0 base');
    assert(climbHit!.kind === 'move', 'climb is free move not AP surcharge');

    s.terrain[from.row][from.col] = 'water';
    grunt.actionPoints = 2;
    applyWaterUpkeep(s, 'red');
    assert(actionPointsLeft(grunt) === 2, 'no swim AP loss');
  } finally {
    Object.assign(UNIT_STATS.soldier, terrSaved);
  }
}

{
  assert(!UNIT_STATS.soldier.canHide, 'stock soldier has no hide');
  const start = { col: 2, row: 5 };
  const woods = neighborInDir(start, 0, 'pointy');
  const s = createStateFromTerrain(
    emptyTerrain(8, 10),
    'promo-hide',
    'pointy',
    [
      {
        type: 'soldier',
        col: woods.col,
        row: woods.row,
        side: 'blue',
        unitTokens: ['allTerrain'],
      },
      { type: 'soldier', col: start.col, row: start.row, side: 'red' },
      { type: 'general', col: 0, row: 5, side: 'red' },
      { type: 'general', col: 7, row: 5, side: 'blue' },
    ],
    undefined,
    [{ type: 'forest', col: woods.col, row: woods.row }],
  );
  s.turn = 'red';
  const scout = s.pieces.find((p) => p.side === 'blue' && p.type === 'soldier')!;
  assert(hasAbility(scout, 'hide'), 'All terrain grants Hide');
  assert(isConcealed(s, scout), 'concealed in forest');
  assert(isConcealedFrom(s, scout, 'red'), 'enemies cannot see them');
}

console.log('promotions: Range / Defense / Attack / AP / HP / All terrain');
