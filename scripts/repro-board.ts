import {
  applyAction,
  editorOpensBoardPopup,
  isPlayerControlled,
  sanitizeTokens,
  tokenAt,
  type GameState,
} from '../src/engine';
import { neighborInDir } from '../src/hex';
import { createStateFromTerrain, emptyTerrain } from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const at = { col: 4, row: 5 };
const step = neighborInDir(at, 2, 'pointy');

function board(): GameState {
  const s = createStateFromTerrain(
    emptyTerrain(8, 10),
    'board',
    'pointy',
    [
      { type: 'soldier', col: at.col, row: at.row, side: 'red' },
      { type: 'general', col: 1, row: 1, side: 'red' },
      { type: 'soldier', col: 6, row: 8, side: 'blue' },
      { type: 'general', col: 1, row: 9, side: 'blue' },
    ],
    undefined,
    [{ type: 'board', col: step.col, row: step.row, text: '  hold the ridge  ' }],
  );
  s.turn = 'red';
  return s;
}

{
  const cleaned = sanitizeTokens(
    [{ type: 'board', col: 2, row: 2, text: ' hello\nthere ', read: true }],
    8,
    10,
  );
  assert(cleaned[0]?.type === 'board', 'board token kept');
  assert(cleaned[0]?.text === 'hello\nthere', 'text trimmed, newlines kept');
  assert(!cleaned[0]?.read, 'read is match-only, not saved');
}

{
  assert(editorOpensBoardPopup('board', true, true), 'board brush edits existing');
  assert(editorOpensBoardPopup('land', true, true), 'land click (editor default) edits existing');
  assert(editorOpensBoardPopup('water', true, true), 'terrain click edits existing');
  assert(!editorOpensBoardPopup('land', true, false), 'drag does not reopen');
  assert(!editorOpensBoardPopup('land', false, true), 'empty hex does not popup');
  assert(!editorOpensBoardPopup('pikes', true, true), 'other tokens still stack');
  assert(!editorOpensBoardPopup('erase', true, true), 'erase still erases');
  assert(!editorOpensBoardPopup('soldier', true, true), 'unit brush still paints');
  assert(!editorOpensBoardPopup('unit:general', true, true), 'unit token still stamps');
}

{
  const s = board();
  const tok = tokenAt(s.tokens, step)!;
  assert(tok.type === 'board' && !tok.read, 'unread at kickoff');
  const soldier = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
  assert(isPlayerControlled(s, soldier.side), 'red is player');
  const after = applyAction(s, { kind: 'move', pieceId: soldier.id, to: step });
  const read = tokenAt(after.tokens, step);
  assert(read?.read, 'friendly walk marks read');
  assert(after.fxBoard?.text === 'hold the ridge', `popup queued, got ${after.fxBoard?.text}`);
  assert(
    after.log.some((line) => line.includes('message board')),
    'log mentions the board',
  );
  assert(after.staminaBonus, 'unused stamina still hangs after the walk');
  assert(after.scoutPieceId === soldier.id, 'bonus lock is this walker');
  const skipped = applyAction(after, { kind: 'skip' });
  assert(!skipped.staminaBonus, 'skip clears the unarmed extra');
  assert(!skipped.scoutPieceId, 'skip clears the scout lock');
}

{
  const s = board();
  tokenAt(s.tokens, step)!.read = true;
  const soldier = s.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
  const after = applyAction(s, { kind: 'move', pieceId: soldier.id, to: step });
  assert(!after.fxBoard, 'already-read walk does not popup');
  assert(tokenAt(after.tokens, step)?.read, 'stays read');
}

{
  const s = board();
  s.turn = 'blue';
  const enemy = s.pieces.find((p) => p.side === 'blue' && p.type === 'soldier')!;
  enemy.col = at.col;
  enemy.row = at.row;
  const after = applyAction(s, { kind: 'move', pieceId: enemy.id, to: step });
  assert(!tokenAt(after.tokens, step)?.read, 'enemy walk does not reveal');
  assert(!after.fxBoard, 'enemy walk does not popup');
}

console.log('board: friendly walk pops and reveals; enemy does not; text saved without read');
