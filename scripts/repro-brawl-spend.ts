import { readFileSync } from 'node:fs';
import {
  applyAction,
  canBuyStaminaExtra,
  canSpendStamina,
  getPiece,
  legalHighlights,
  staminaLeft,
  UNIT_STATS,
  type GameState,
  type Highlight,
} from '../src/engine';
import { applyRemoteUnitStats } from '../src/units';
import { createStateFromTerrain } from '../src/map';
import { runAiTurn } from '../src/ai';

const units = JSON.parse(readFileSync('public/data/units.json', 'utf8'));
applyRemoteUnitStats(units);
const lvl = JSON.parse(readFileSync('public/data/levels/lvl-mvlx72gq-dlcxh.json', 'utf8'));

function boot(): GameState {
  const s = createStateFromTerrain(
    lvl.terrain,
    lvl.name,
    lvl.orientation,
    lvl.armies,
    lvl.armyControls,
    lvl.tokens,
    lvl.aiStyles,
  );
  s.unitsPerTurn = lvl.unitsPerTurn;
  return s;
}

function extras(s: GameState, id: string) {
  return legalHighlights(s, id).filter((h: Highlight) => h.kind === 'stamina' && h.extra);
}

function dump(label: string, s: GameState) {
  const p = s.pieces.find((x) => x.side === 'red')!;
  const hits = legalHighlights(s, p.id);
  const extra = extras(s, p.id);
  const stam = hits.filter((h) => h.kind === 'stamina');
  console.log(label, {
    turn: s.turn,
    scout: s.scoutPieceId,
    bonus: s.staminaBonus,
    acted: s.actedIds,
    pos: `${p.col},${p.row}`,
    stam: staminaLeft(p),
    used: !!p.staminaUsedThisTurn,
    canSpend: canSpendStamina(p),
    statsStam: UNIT_STATS[p.type]?.stamina,
    move: UNIT_STATS[p.type]?.move,
    nLegal: hits.length,
    nStam: stam.length,
    nExtra: extra.length,
    stamKinds: stam.map((h) => `${h.hex.col},${h.hex.row}:extra=${!!h.extra}`),
  });
}

let s = boot();
const id = s.pieces.find((p) => p.side === 'red')!.id;
dump('start', s);

const green = legalHighlights(s, id).find((h) => h.kind === 'move');
if (!green) throw new Error('no green');
s = applyAction(s, { kind: 'move', pieceId: id, to: green.hex });
dump('after green', s);

s = runAiTurn(s, 'blue');
dump('after AI', s);

const p = getPiece(s, id)!;
const offer = canBuyStaminaExtra(s, p.id);
if (s.turn !== 'red') throw new Error('should be player turn after AI');
if (!offer) throw new Error('Spend stamina should be available after enemy turn');
if (extras(s, p.id).length === 0) throw new Error('extra dests should exist after AI');
console.log('wouldOfferSpend', offer, 'turn', s.turn, 'pos', `${p.col},${p.row}`);
