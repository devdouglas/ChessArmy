/** Trap / facing spears kill the walker before their melee resolves. */
import {
  applyAction,
  hexDamageOn,
  previewMove,
  type GameState,
} from '../src/engine';
import { defaultFacing, neighborInDir, type Hex } from '../src/hex';
import { UNIT_STATS } from '../src/roster';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const O = 'pointy' as const;
const victimHex: Hex = { col: 4, row: 5 };
const face = defaultFacing('red');
const fromHex = neighborInDir(victimHex, face, O);

const saved = {
  hp: UNIT_STATS.soldier.hp,
  melee: UNIT_STATS.soldier.meleeDamage,
  armor: UNIT_STATS.soldier.armor,
  hexDamage: UNIT_STATS.soldier.hexDamage,
  dmgFront: UNIT_STATS.soldier.damageFront,
};

try {
  UNIT_STATS.soldier.hp = 1;
  UNIT_STATS.soldier.meleeDamage = 3;
  UNIT_STATS.soldier.armor = 0;

  {
    const t = emptyTerrain(8, 10);
    const s = createStateFromTerrain(
      t,
      'trap',
      O,
      [
        { type: 'soldier', col: victimHex.col, row: victimHex.row, side: 'red' },
        { type: 'general', col: 1, row: 1, side: 'red' },
        { type: 'soldier', col: fromHex.col, row: fromHex.row, side: 'blue' },
        { type: 'general', col: 1, row: 9, side: 'blue' },
      ],
      undefined,
      [{ type: 'pikes', col: victimHex.col, row: victimHex.row }],
    );
    s.turn = 'blue';
    const atk = s.pieces.find((p) => p.col === fromHex.col && p.row === fromHex.row)!;
    const vic = s.pieces.find((p) => p.col === victimHex.col && p.row === victimHex.row)!;
    const plan = previewMove(s, atk, victimHex);
    assert(plan.walkerDead, 'trap on melee hex → walkerDead');
    assert(plan.hits.length === 0, 'trap kill → no melee hit planned');
    const after = applyAction(s, { kind: 'move', pieceId: atk.id, to: victimHex });
    assert(!after.pieces.some((p) => p.id === atk.id), 'attacker died on trap');
    assert(after.pieces.some((p) => p.id === vic.id), 'victim unharmed');
  }

  {
    UNIT_STATS.soldier.hexDamage = true;
    UNIT_STATS.soldier.damageFront = 2;
    const t = emptyTerrain(8, 10);
    const spearHex = neighborInDir(victimHex, ((face + 3) % 6) as 0 | 1 | 2 | 3 | 4 | 5, O);
    // Layout: spear unit faces into victimHex; attacker walks into victimHex from the other side.
    const s = createStateFromTerrain(
      t,
      'spears',
      O,
      [
        { type: 'soldier', col: victimHex.col, row: victimHex.row, side: 'red' },
        { type: 'general', col: 1, row: 1, side: 'red' },
        { type: 'soldier', col: fromHex.col, row: fromHex.row, side: 'blue' },
        {
          type: 'soldier',
          col: spearHex.col,
          row: spearHex.row,
          side: 'red',
          facing: face,
        },
        { type: 'general', col: 1, row: 9, side: 'blue' },
      ],
    ) as GameState;
    s.turn = 'blue';
    const atk = s.pieces.find((p) => p.col === fromHex.col && p.row === fromHex.row)!;
    const vic = s.pieces.find((p) => p.col === victimHex.col && p.row === victimHex.row)!;
    const spear = s.pieces.find((p) => p.col === spearHex.col && p.row === spearHex.row)!;
    spear.facing = face;
    const cover = hexDamageOn(s, victimHex, 'blue');
    assert(cover && cover.amount > 0, 'victim hex is covered by facing spears');
    const plan = previewMove(s, atk, victimHex);
    assert(plan.walkerDead, 'facing spears on melee hex → walkerDead');
    assert(plan.hits.length === 0, 'spear kill → no melee hit planned');
    const after = applyAction(s, { kind: 'move', pieceId: atk.id, to: victimHex });
    assert(!after.pieces.some((p) => p.id === atk.id), 'attacker died on spears');
    assert(after.pieces.some((p) => p.id === vic.id), 'victim unharmed by dead attacker');
  }

  console.log('enter-hazards: trap / facing spears kill before melee');
} finally {
  UNIT_STATS.soldier.hp = saved.hp;
  UNIT_STATS.soldier.meleeDamage = saved.melee;
  UNIT_STATS.soldier.armor = saved.armor;
  UNIT_STATS.soldier.hexDamage = saved.hexDamage;
  UNIT_STATS.soldier.damageFront = saved.dmgFront;
}
