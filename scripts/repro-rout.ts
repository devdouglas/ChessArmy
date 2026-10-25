import {
  applyAction,
  hpLeft,
  previewMove,
  wouldRout,
  type GameState,
} from '../src/engine';
import { defaultFacing, neighborInDir, type Hex, type HexDir } from '../src/hex';
import { UNIT_STATS } from '../src/roster';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const O = 'pointy' as const;
const at: Hex = { col: 4, row: 5 };
const face = defaultFacing('red');
const rear = ((face + 3) % 6) as HexDir;
const back = neighborInDir(at, rear, O);
const front = neighborInDir(at, face, O);

function board(
  extra: {
    tokens?: { type: 'wall' | 'palisade'; col: number; row: number }[];
    terrain?: (t: string[][]) => void;
    victim?: { type?: 'soldier' | 'general'; unitTokens?: ('general')[] };
    pin?: { type: 'soldier'; side: 'red' | 'blue' } | null;
    /** Where the attacker stands. Default rear (red face). */
    from?: 'front' | 'rear';
  } = {},
): GameState {
  const t = emptyTerrain(8, 10);
  extra.terrain?.(t);
  const victimType = extra.victim?.type ?? 'soldier';
  const atkHex = extra.from === 'front' ? front : back;
  const other = extra.from === 'front' ? back : front;
  const pin = extra.pin === null ? [] : extra.pin
    ? [{ type: extra.pin.type, col: other.col, row: other.row, side: extra.pin.side }]
    : [{ type: 'soldier' as const, col: other.col, row: other.row, side: 'blue' as const }];
  const s = createStateFromTerrain(
    t,
    'rout',
    O,
    [
      {
        type: victimType,
        col: at.col,
        row: at.row,
        side: 'red',
        unitTokens: extra.victim?.unitTokens,
      },
      { type: 'general', col: 1, row: 1, side: 'red' },
      { type: 'soldier', col: atkHex.col, row: atkHex.row, side: 'blue' },
      { type: 'general', col: 1, row: 9, side: 'blue' },
      ...pin,
    ],
    undefined,
    extra.tokens,
  );
  s.turn = 'blue';
  const victim = s.pieces.find(
    (p) => p.col === at.col && p.row === at.row,
  )!;
  victim.facing = face;
  const atk = s.pieces.find((p) => p.col === atkHex.col && p.row === atkHex.row);
  if (atk) atk.facing = extra.from === 'front' ? rear : face;
  return s;
}

function attacker(s: GameState, hex: Hex = back) {
  return s.pieces.find((p) => p.col === hex.col && p.row === hex.row)!;
}

function victim(s: GameState) {
  return s.pieces.find((p) => p.col === at.col && p.row === at.row);
}

function bump(s: GameState) {
  const a = attacker(s);
  return applyAction(s, { kind: 'move', pieceId: a.id, to: at });
}

const saved = {
  hexArmor: UNIT_STATS.soldier.hexArmor,
  armorFront: UNIT_STATS.soldier.armorFront,
  armorFrontLeft: UNIT_STATS.soldier.armorFrontLeft,
  armorFrontRight: UNIT_STATS.soldier.armorFrontRight,
  armorFlankLeft: UNIT_STATS.soldier.armorFlankLeft,
  armorFlankRight: UNIT_STATS.soldier.armorFlankRight,
  armorRear: UNIT_STATS.soldier.armorRear,
  hp: UNIT_STATS.soldier.hp,
  melee: UNIT_STATS.soldier.meleeDamage,
  armor: UNIT_STATS.soldier.armor,
  genHex: UNIT_STATS.general.hexArmor,
  genRear: UNIT_STATS.general.armorRear,
  genHp: UNIT_STATS.general.hp,
};

try {
  UNIT_STATS.soldier.hexArmor = true;
  UNIT_STATS.soldier.armorFront = 0;
  UNIT_STATS.soldier.armorFrontLeft = 0;
  UNIT_STATS.soldier.armorFrontRight = 0;
  UNIT_STATS.soldier.armorFlankLeft = 0;
  UNIT_STATS.soldier.armorFlankRight = 0;
  UNIT_STATS.soldier.armorRear = -2;
  UNIT_STATS.soldier.hp = 5;
  UNIT_STATS.soldier.meleeDamage = 1;
  UNIT_STATS.soldier.armor = 0;

  {
    const s = board();
    const v = victim(s)!;
    const a = attacker(s);
    assert(wouldRout(s, v, { col: a.col, row: a.row }), 'enemy on opposite → would rout');
    const plan = previewMove(s, a, at);
    assert(plan.hits.length === 1 && plan.hits[0].routed, 'preview marks routed');
    assert(plan.hits[0].fatal && plan.hits[0].remaining === 0, 'rout is fatal');
    const after = bump(s);
    assert(!after.pieces.some((p) => p.id === v.id), 'routed unit is gone');
    assert(
      after.log.some((line) => line.includes('routed') || line.includes('routs')),
      `log mentions rout, got ${after.log.at(-1)}`,
    );
    const net = 1 - -2;
    assert(net < 5, 'sanity: melee would not have killed on HP');
  }

  {
    const s = board({ pin: null, tokens: [{ type: 'wall', col: front.col, row: front.row }] });
    const v = victim(s)!;
    const a = attacker(s);
    assert(!wouldRout(s, v, { col: a.col, row: a.row }), 'wall on opposite does not rout');
    assert(bump(s).pieces.some((p) => p.id === v.id), 'wall pin survives');
  }

  {
    const s = board({ pin: null, tokens: [{ type: 'palisade', col: front.col, row: front.row }] });
    const v = victim(s)!;
    const a = attacker(s);
    assert(!wouldRout(s, v, { col: a.col, row: a.row }), 'palisade on opposite does not rout');
    assert(bump(s).pieces.some((p) => p.id === v.id), 'palisade pin survives');
  }

  {
    const s = board({
      pin: null,
      terrain: (t) => {
        t[front.row][front.col] = 'high';
      },
    });
    const v = victim(s)!;
    const a = attacker(s);
    assert(!wouldRout(s, v, { col: a.col, row: a.row }), 'higher ground on opposite does not rout');
    assert(bump(s).pieces.some((p) => p.id === v.id), 'hill pin survives');
  }

  {
    const s = board({
      pin: null,
      terrain: (t) => {
        t[at.row][at.col] = 'high';
        t[front.row][front.col] = 'high';
        t[back.row][back.col] = 'high';
      },
    });
    const v = victim(s)!;
    const a = attacker(s);
    assert(!wouldRout(s, v, { col: a.col, row: a.row }), 'same-height ridge is not a pin');
    const after = bump(s);
    const live = after.pieces.find((p) => p.id === v.id);
    assert(live, 'ridge hit does not rout');
    assert(hpLeft(live!) < 5, 'still took melee');
  }

  {
    const s = board({ pin: null });
    const v = victim(s)!;
    const a = attacker(s);
    assert(!wouldRout(s, v, { col: a.col, row: a.row }), 'open opposite does not rout');
    const after = bump(s);
    const live = after.pieces.find((p) => p.id === v.id)!;
    assert(live, 'open rear-hit survives');
    assert(hpLeft(live) === 5 - (1 - -2), `took boosted melee, hp ${hpLeft(live)}`);
  }

  {
    const s = board({ pin: { type: 'soldier', side: 'red' } });
    const v = victim(s)!;
    const a = attacker(s);
    assert(!wouldRout(s, v, { col: a.col, row: a.row }), 'friendly on opposite does not rout');
    assert(bump(s).pieces.some((p) => p.id === v.id), 'friend pin survives');
  }

  {
    const s = board({ from: 'front' });
    const v = victim(s)!;
    const a = attacker(s, front);
    assert(wouldRout(s, v, { col: a.col, row: a.row }), 'front hit + enemy on red/back → rout');
    const plan = previewMove(s, a, at);
    assert(plan.hits[0]?.routed, 'front sandwich preview routed');
    const after = applyAction(s, { kind: 'move', pieceId: a.id, to: at });
    assert(!after.pieces.some((p) => p.id === v.id), 'front sandwich routed');
  }

  {
    const s = board({ from: 'front', pin: null });
    const v = victim(s)!;
    const a = attacker(s, front);
    assert(!wouldRout(s, v, { col: a.col, row: a.row }), 'front hit, open back does not rout');
    const after = applyAction(s, { kind: 'move', pieceId: a.id, to: at });
    assert(after.pieces.some((p) => p.id === v.id), 'open front hit survives');
  }

  {
    const s = board({ from: 'front', pin: { type: 'soldier', side: 'red' } });
    const v = victim(s)!;
    const a = attacker(s, front);
    assert(!wouldRout(s, v, { col: a.col, row: a.row }), 'front hit + friendly on back does not rout');
    assert(
      applyAction(s, { kind: 'move', pieceId: a.id, to: at }).pieces.some((p) => p.id === v.id),
      'friend on back survives a front hit',
    );
  }

  {
    const s = board({ victim: { unitTokens: ['general'] } });
    const v = victim(s)!;
    const a = attacker(s);
    assert(!wouldRout(s, v, { col: a.col, row: a.row }), 'general token never routs');
    const after = bump(s);
    assert(after.pieces.some((p) => p.id === v.id), 'general token holds');
  }

  UNIT_STATS.general.hexArmor = true;
  UNIT_STATS.general.armorRear = -2;
  UNIT_STATS.general.hp = 5;
  {
    const s = board({ victim: { type: 'general' } });
    const v = victim(s)!;
    const a = attacker(s);
    assert(!wouldRout(s, v, { col: a.col, row: a.row }), 'general unit never routs');
    assert(bump(s).pieces.some((p) => p.id === v.id), 'general unit holds');
  }

  {
    const s = board({ from: 'front', victim: { type: 'general' } });
    const v = victim(s)!;
    const a = attacker(s, front);
    assert(!wouldRout(s, v, { col: a.col, row: a.row }), 'general unit never routs from front sandwich');
  }

  console.log('rout: opposite-unit sandwich with a red face; terrain does not pin; generals hold');
} finally {
  UNIT_STATS.soldier.hexArmor = saved.hexArmor;
  UNIT_STATS.soldier.armorFront = saved.armorFront;
  UNIT_STATS.soldier.armorFrontLeft = saved.armorFrontLeft;
  UNIT_STATS.soldier.armorFrontRight = saved.armorFrontRight;
  UNIT_STATS.soldier.armorFlankLeft = saved.armorFlankLeft;
  UNIT_STATS.soldier.armorFlankRight = saved.armorFlankRight;
  UNIT_STATS.soldier.armorRear = saved.armorRear;
  UNIT_STATS.soldier.hp = saved.hp;
  UNIT_STATS.soldier.meleeDamage = saved.melee;
  UNIT_STATS.soldier.armor = saved.armor;
  UNIT_STATS.general.hexArmor = saved.genHex;
  UNIT_STATS.general.armorRear = saved.genRear;
  UNIT_STATS.general.hp = saved.genHp;
}
