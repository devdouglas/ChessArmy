import {
  applyAction,
  playerFlagCaptures,
  playerHpLost,
  playerKills,
  signsRead,
  type GameState,
} from '../src/engine';
import {
  starRuleMet,
  starRulePossible,
  type StarRule,
} from '../src/levels';
import { neighborInDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const redAt = { col: 3, row: 5 };
const foe = neighborInDir(redAt, 0, 'pointy');
const flagHex = neighborInDir(redAt, 1, 'pointy');
const signHex = neighborInDir(redAt, 2, 'pointy');

function board(): GameState {
  const s = createStateFromTerrain(
    emptyTerrain(8, 10),
    'stars',
    'pointy',
    [
      { type: 'soldier', col: redAt.col, row: redAt.row, side: 'red' },
      { type: 'dummy', col: foe.col, row: foe.row, side: 'blue' },
      { type: 'general', col: 0, row: 1, side: 'red' },
      { type: 'general', col: 7, row: 8, side: 'blue' },
    ],
    { red: 'player', blue: 'ai-enemy' },
    [
      { type: 'flag', col: flagHex.col, row: flagHex.row },
      { type: 'board', col: signHex.col, row: signHex.row, text: 'hello' },
    ],
  );
  s.turn = 'red';
  return s;
}

{
  const s = board();
  assert(playerHpLost(s) === 0, 'no HP lost at kickoff');
  assert(playerKills(s) === 0, 'no kills at kickoff');
  assert(playerFlagCaptures(s) === 0, 'seeded flags are not captures');
  assert(signsRead(s) === 0, 'unread');
}

{
  const s = board();
  const p = s.pieces.find((x) => x.type === 'soldier')!;
  const chip = applyAction(s, { kind: 'move', pieceId: p.id, to: foe });
  assert(playerKills(chip) === 0, 'dummy survives 1 melee');
  assert(playerHpLost(chip) === 0, 'player took no HP');
  const dummy = chip.pieces.find((x) => x.type === 'dummy')!;
  assert((dummy.hp ?? 2) === 1, 'dummy chipped');
  assert(chip.hpLost.blue === 1, 'enemy HP lost is tracked');
}

{
  const s = board();
  const dummy = s.pieces.find((p) => p.type === 'dummy')!;
  dummy.hp = 1;
  const p = s.pieces.find((x) => x.type === 'soldier')!;
  const melee = applyAction(s, { kind: 'move', pieceId: p.id, to: foe });
  assert(playerKills(melee) === 1, 'dummy kill counts as a unit killed');
  assert(!melee.pieces.some((x) => x.type === 'dummy'), 'dummy gone');
}

{
  const s = board();
  const p = s.pieces.find((x) => x.type === 'soldier')!;
  const after = applyAction(s, { kind: 'move', pieceId: p.id, to: flagHex });
  assert(playerFlagCaptures(after) === 1, 'walking onto a free flag counts');
}

{
  const s = board();
  const p = s.pieces.find((x) => x.type === 'soldier')!;
  const after = applyAction(s, { kind: 'move', pieceId: p.id, to: signHex });
  assert(signsRead(after) === 1, 'walking onto a board marks it read');
}

{
  const kills: StarRule = { metric: 'kills', op: 'gte', value: 1 };
  const hp: StarRule = { metric: 'casualties', op: 'eq', value: 0 };
  const flags: StarRule = { metric: 'flags', op: 'gte', value: 1 };
  const signs: StarRule = { metric: 'signs', op: 'gte', value: 1 };
  const stats = {
    turns: 2,
    casualties: 0,
    kills: 1,
    flags: 1,
    signs: 1,
    flagMax: 1,
    killMax: 1,
    signMax: 1,
  };
  assert(starRuleMet(kills, stats), 'kills ≥ 1 met');
  assert(starRuleMet(hp, stats), 'no HP lost met');
  assert(starRuleMet(flags, stats), 'flag captured met');
  assert(starRuleMet(signs, stats), 'sign read met');
  assert(
    !starRulePossible({ metric: 'kills', op: 'gte', value: 3 }, stats),
    'cannot kill 3 when only 1 enemy exists',
  );
  assert(
    !starRulePossible({ metric: 'casualties', op: 'eq', value: 0 }, {
      ...stats,
      casualties: 1,
    }),
    'HP lost fails no-casualty star',
  );
}

console.log('repro-stars ok');
