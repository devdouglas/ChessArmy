import { applyAction, type GameState, type PieceStory } from '../src/engine';
import { neighborInDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function story(when: 'kill' | 'touch', text: string): PieceStory {
  return { text, when };
}

function match(
  mover: { type: 'soldier' | 'archer'; col: number; row: number },
  victim: { col: number; row: number; story: PieceStory; hp?: number },
): GameState {
  const s = createStateFromTerrain(
    emptyTerrain(8, 8),
    'story',
    'pointy',
    [
      { type: mover.type, col: mover.col, row: mover.row, side: 'blue' },
      {
        type: 'soldier',
        col: victim.col,
        row: victim.row,
        side: 'red',
        unitTokens: ['story'],
        story: victim.story,
      },
    ],
    { blue: 'player', red: 'ai-enemy' },
  );
  s.turn = 'blue';
  const v = s.pieces.find((p) => p.side === 'red')!;
  if (victim.hp) v.hp = victim.hp;
  return s;
}

{
  const to = { col: 3, row: 3 };
  const from = neighborInDir(to, 3, 'pointy')!;
  const s = match(
    { type: 'soldier', col: from.col, row: from.row },
    { col: to.col, row: to.row, story: story('kill', 'He dies.') },
  );
  const mover = s.pieces.find((p) => p.side === 'blue')!;
  const next = applyAction(s, { kind: 'move', pieceId: mover.id, to });
  assert(next.fxBoard?.text === 'He dies.', 'kill story on melee death');
  assert(!next.pieces.some((p) => p.side === 'red'), 'victim removed');
}

{
  const to = { col: 3, row: 3 };
  const from = neighborInDir(to, 3, 'pointy')!;
  const s = match(
    { type: 'soldier', col: from.col, row: from.row },
    { col: to.col, row: to.row, story: story('touch', 'Back off.'), hp: 5 },
  );
  const mover = s.pieces.find((p) => p.side === 'blue')!;
  const next = applyAction(s, { kind: 'move', pieceId: mover.id, to });
  const victim = next.pieces.find((p) => p.side === 'red');
  assert(next.fxBoard?.text === 'Back off.', 'touch story on melee');
  assert(!!victim && (victim.hp ?? 1) > 0, 'touch does not require a kill');
}

{
  const to = { col: 3, row: 3 };
  const from = neighborInDir(to, 3, 'pointy')!;
  const s = match(
    { type: 'soldier', col: from.col, row: from.row },
    { col: to.col, row: to.row, story: story('kill', 'He dies.'), hp: 5 },
  );
  const mover = s.pieces.find((p) => p.side === 'blue')!;
  const next = applyAction(s, { kind: 'move', pieceId: mover.id, to });
  assert(!next.fxBoard, 'non-fatal melee does not fire on kill');
}

{
  const at = { col: 4, row: 4 };
  const step = neighborInDir(at, 0, 'pointy')!;
  const from = neighborInDir(step, 0, 'pointy')!;
  const s = match(
    { type: 'archer', col: from.col, row: from.row },
    { col: at.col, row: at.row, story: story('touch', 'Do not shoot.') },
  );
  const mover = s.pieces.find((p) => p.side === 'blue')!;
  const next = applyAction(s, { kind: 'shoot', pieceId: mover.id, at });
  assert(!next.fxBoard, 'shot is not a melee touch');
  assert(!next.pieces.some((p) => p.side === 'red'), 'shot killed');
}

{
  const at = { col: 4, row: 4 };
  const step = neighborInDir(at, 0, 'pointy')!;
  const from = neighborInDir(step, 0, 'pointy')!;
  const s = match(
    { type: 'archer', col: from.col, row: from.row },
    { col: at.col, row: at.row, story: story('kill', 'Arrow.') },
  );
  const mover = s.pieces.find((p) => p.side === 'blue')!;
  const next = applyAction(s, { kind: 'shoot', pieceId: mover.id, at });
  assert(next.fxBoard?.text === 'Arrow.', 'kill story on shot');
}

console.log('story: on kill and on melee touch');
