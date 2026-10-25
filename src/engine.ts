/**
 * Pure rules engine for Chess Army prototype.
 * Question: does this army-chess ruleset feel right to play?
 */

import {
  axisDir,
  defaultFacing,
  dirBetween,
  distance,
  eq,
  incomingDir,
  isHexDir,
  key,
  line,
  neighborInDir,
  neighbors,
  parseKey,
  type Hex,
  type HexDir,
  type HexOrientation,
  type PathOpts,
} from './hex';
import {
  HEX_ARMOR_LABEL,
  HEX_ARMOR_SIDES,
  HEX_DAMAGE_SIDES,
  statsOf,
  type HexArmorSide,
  type UnitStats,
  type UnitType,
} from './roster';
import { type AbilityId } from './abilities';
import { isExperimentalOn } from './experimental';

export {
  ABILITY_BLURB,
  ABILITY_IDS,
  ABILITY_LABEL,
  isAbilityId,
} from './abilities';

export {
  CLIMB_LEVEL_LABEL,
  CLIMB_LEVELS,
  DEFAULT_UNIT_STATS,
  GLYPH_ONLY_KITS,
  HEX_ARMOR_LABEL,
  HEX_ARMOR_SIDES,
  HEX_DAMAGE_LABEL,
  HEX_DAMAGE_SIDES,
  KIT_TRAITS,
  SHOOT_ARCS,
  SHOOT_ARC_LABEL,
  STOCK_UNIT_TYPES,
  TRAIT_FIELDS,
  UNIT_CATEGORIES,
  UNIT_CATEGORY_LABEL,
  UNIT_ROLE_LABEL,
  UNIT_STATS,
  UNIT_TYPES,
  isCustomUnitId,
  isKnownUnit,
  isUnitRole,
  roleOf,
  sanitizeClimbLevel,
  sanitizeShootArc,
  sanitizeUnitCategory,
  stockMobility,
  statsOf,
  type AbilityId,
  type ClimbLevel,
  type HexArmorSide,
  type HexDamageSide,
  type ShootArc,
  type UnitCategory,
  type UnitRole,
  type UnitStats,
  type UnitTraits,
  type UnitType,
} from './roster';

export const SIDES = ['red', 'blue', 'yellow', 'purple'] as const;
export type Side = (typeof SIDES)[number];

export const SIDE_LABEL: Record<Side, string> = {
  red: 'Red',
  blue: 'Blue',
  yellow: 'Yellow',
  purple: 'Purple',
};

export function isSide(v: unknown): v is Side {
  return v === 'red' || v === 'blue' || v === 'yellow' || v === 'purple';
}

export type ArmyControl = 'player' | 'ai-enemy' | 'ai-ally';
export const ARMY_CONTROLS: ArmyControl[] = ['player', 'ai-enemy', 'ai-ally'];
export const ARMY_CONTROL_LABEL: Record<ArmyControl, string> = {
  player: 'player',
  'ai-enemy': 'ai enemy',
  'ai-ally': 'ai ally',
};

export function isArmyControl(v: unknown): v is ArmyControl {
  return v === 'player' || v === 'ai-enemy' || v === 'ai-ally';
}

export function defaultArmyControls(): Record<Side, ArmyControl> {
  return {
    red: 'player',
    blue: 'ai-enemy',
    yellow: 'ai-enemy',
    purple: 'ai-enemy',
  };
}

export function hotseatArmyControls(): Record<Side, ArmyControl> {
  return {
    red: 'player',
    blue: 'player',
    yellow: 'player',
    purple: 'player',
  };
}

export function sanitizeArmyControls(raw: unknown): Record<Side, ArmyControl> {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const fallback = defaultArmyControls();
  const out = { ...fallback };
  for (const s of SIDES) {
    if (isArmyControl(src[s])) out[s] = src[s];
  }
  return out;
}

/** How an AI army plays. Default is aggressive (current ruleset). */
export type AiStyle = 'aggressive' | 'defensive' | 'advance';
export const AI_STYLES: AiStyle[] = ['aggressive', 'defensive', 'advance'];
export const AI_STYLE_LABEL: Record<AiStyle, string> = {
  aggressive: 'aggressive',
  defensive: 'defensive',
  advance: 'advance',
};

export function isAiStyle(v: unknown): v is AiStyle {
  return v === 'aggressive' || v === 'defensive' || v === 'advance';
}

export function defaultAiStyles(): Record<Side, AiStyle> {
  return {
    red: 'aggressive',
    blue: 'aggressive',
    yellow: 'aggressive',
    purple: 'aggressive',
  };
}

export function sanitizeAiStyles(raw: unknown): Record<Side, AiStyle> {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out = defaultAiStyles();
  for (const s of SIDES) {
    if (isAiStyle(src[s])) out[s] = src[s];
  }
  return out;
}

export function aiStyleOf(state: GameState, side: Side): AiStyle {
  const v = state.aiStyles?.[side];
  return isAiStyle(v) ? v : 'aggressive';
}

export function emptySideCounts(): Record<Side, number> {
  return { red: 0, blue: 0, yellow: 0, purple: 0 };
}

export function emptyHadKing(): Record<Side, boolean> {
  return { red: false, blue: false, yellow: false, purple: false };
}

export type Terrain = 'land' | 'water' | 'rock' | 'wall' | 'high' | 'plateau';

export const TOKEN_TYPES = [
  'pikes',
  'wall',
  'house',
  'palisade',
  'tree',
  'forest',
  'flag',
  'board',
  'notouch',
] as const;
export type TokenType = (typeof TOKEN_TYPES)[number];
export type TileToken = {
  type: TokenType;
  col: number;
  row: number;
  owner?: Side;
  /** Palisade / tree / forest hits left. Missing → full (`PALISADE_HP`). */
  hp?: number;
  /** AI will not walk this hex (standalone token, or painted onto another). */
  noTouch?: boolean;
  /** Message board copy. */
  text?: string;
  /** A friendly has walked on this board — click to reread. Match-only, not saved. */
  read?: boolean;
};

export const TOKEN_LABEL: Record<TokenType, string> = {
  pikes: 'Pikes',
  wall: 'Wall',
  house: 'House',
  palisade: 'Palisade',
  tree: 'Tree',
  forest: 'Forest',
  flag: 'Flag',
  board: 'Board',
  notouch: 'Do not touch',
};
export const BOARD_TEXT_MAX = 280;

export function sanitizeBoardText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, BOARD_TEXT_MAX);
}
export const PIKE_DAMAGE = 1;
export const PALISADE_HP = 3;

/** Attachments on a piece. Ids must not collide with unit types in the editor brush. */
export const UNIT_TOKEN_TYPES = ['general', 'hidden'] as const;
export type UnitTokenType = (typeof UNIT_TOKEN_TYPES)[number];
export const UNIT_TOKEN_LABEL: Record<UnitTokenType, string> = {
  general: 'General',
  hidden: 'Hidden',
};

export function isUnitTokenType(v: unknown): v is UnitTokenType {
  return (UNIT_TOKEN_TYPES as readonly string[]).includes(v as string);
}

export function sanitizeUnitTokens(raw: unknown): UnitTokenType[] {
  if (!Array.isArray(raw)) return [];
  const out: UnitTokenType[] = [];
  for (const item of raw) {
    if (!isUnitTokenType(item) || out.includes(item)) continue;
    out.push(item);
  }
  return out;
}

export function unitTokensOf(piece: { unitTokens?: UnitTokenType[] }): UnitTokenType[] {
  return piece.unitTokens ?? [];
}

export function hasUnitToken(
  piece: { unitTokens?: UnitTokenType[] },
  id: UnitTokenType,
): boolean {
  return unitTokensOf(piece).includes(id);
}

export function isTokenType(v: unknown): v is TokenType {
  return (TOKEN_TYPES as readonly string[]).includes(v as string);
}

export function tokenAt(tokens: TileToken[], h: Hex): TileToken | undefined {
  return tokens.find((t) => t.col === h.col && t.row === h.row);
}

export function mapFlags(state: { tokens?: TileToken[] }): TileToken[] {
  return (state.tokens ?? []).filter((t) => t.type === 'flag');
}

export function flagsHeldBy(state: GameState, side: Side): number {
  return mapFlags(state).filter((t) => t.owner && sameTeam(state, t.owner, side)).length;
}

export function teamHoldsAllFlags(state: GameState, side: Side): boolean {
  const flags = mapFlags(state);
  return flags.length > 0 && flags.every((t) => !!t.owner && sameTeam(state, t.owner, side));
}

export function winByFlags(state: GameState): boolean {
  return !!state.winner && teamHoldsAllFlags(state, state.winner);
}

/** Units already standing on a flag claim it (match start). */
export function seedFlagOwners(state: GameState): void {
  for (const p of state.pieces) {
    const tok = tokenAt(state.tokens, { col: p.col, row: p.row });
    if (tok?.type === 'flag') tok.owner = p.side;
  }
}

/** One token per hex. Out of bounds / unknown types dropped. */
export function sanitizeTokens(raw: unknown, cols: number, rows: number): TileToken[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: TileToken[] = [];
  const cap = Math.max(0, cols * rows);
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const t = item as Partial<TileToken>;
    if (!isTokenType(t.type)) continue;
    const col = Math.floor(Number(t.col));
    const row = Math.floor(Number(t.row));
    if (!Number.isFinite(col) || !Number.isFinite(row)) continue;
    if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
    const k = `${col},${row}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const tok: TileToken = { type: t.type, col, row };
    if (t.type === 'flag' && isSide(t.owner)) tok.owner = t.owner;
    if (t.noTouch === true) tok.noTouch = true;
    if (t.type === 'board') {
      const text = sanitizeBoardText(t.text);
      if (text) tok.text = text;
    }
    if (isWoodHpToken(t.type)) {
      const hp = Math.floor(Number(t.hp));
      // Old cap was 2 and we always wrote hp:2 for fresh tokens → treat as full.
      if (Number.isFinite(hp) && hp === 1) tok.hp = 1;
    }
    out.push(tok);
    if (out.length >= cap) break;
  }
  return out;
}

/** Old wall terrain cells become land + a wall token. One token per hex. */
export function liftWallTerrain(
  terrain: Terrain[][],
  tokens: TileToken[] = [],
): { terrain: Terrain[][]; tokens: TileToken[] } {
  const t = terrain.map((r) => [...r]);
  const byHex = new Map(tokens.map((tok) => [`${tok.col},${tok.row}`, tok] as const));
  for (let row = 0; row < t.length; row++) {
    const line = t[row];
    if (!line) continue;
    for (let col = 0; col < line.length; col++) {
      if (line[col] !== 'wall') continue;
      line[col] = 'land';
      byHex.set(`${col},${row}`, { type: 'wall', col, row });
    }
  }
  return { terrain: t, tokens: [...byHex.values()] };
}

/** Impassable solid terrain leftover from old saves. Mountain is climbable height 3. */
export function isSolidTerrain(t: Terrain): boolean {
  return t === 'wall';
}

export function isWallToken(type: TokenType | undefined): boolean {
  return type === 'wall' || type === 'house';
}

export function isHouseToken(type: TokenType | undefined): boolean {
  return type === 'house';
}

export function isPalisadeToken(type: TokenType | undefined): boolean {
  return type === 'palisade' || type === 'tree';
}

export function isForestToken(type: TokenType | undefined): boolean {
  return type === 'forest';
}

export function isWoodHpToken(type: TokenType | undefined): boolean {
  return isPalisadeToken(type) || isForestToken(type);
}

/** Wall / house token (or leftover wall terrain) — blocks walk / LOS; rockets demolish. */
export function isWall(
  state: { tokens: TileToken[]; terrain: Terrain[][] },
  h: Hex,
): boolean {
  if (isWallToken(tokenAt(state.tokens, h)?.type)) return true;
  return state.terrain[h.row]?.[h.col] === 'wall';
}

export function isHouse(
  state: { tokens: TileToken[] },
  h: Hex,
): boolean {
  return isHouseToken(tokenAt(state.tokens, h)?.type);
}

export function isPalisade(
  state: { tokens: TileToken[] },
  h: Hex,
): boolean {
  return isPalisadeToken(tokenAt(state.tokens, h)?.type);
}

export function isForest(
  state: { tokens: TileToken[] },
  h: Hex,
): boolean {
  return isForestToken(tokenAt(state.tokens, h)?.type);
}

export function isHideToken(type: TokenType | undefined): boolean {
  return isForestToken(type);
}

export function isHideCover(
  state: { tokens: TileToken[] },
  h: Hex,
): boolean {
  return isHideToken(tokenAt(state.tokens, h)?.type);
}

export function hasHide(piece: Piece): boolean {
  if (piece.revealed) return false;
  return statsOf(piece.type).canHide || hasUnitToken(piece, 'hidden');
}

export function isConcealed(state: GameState, piece: Piece): boolean {
  if (!hasHide(piece)) return false;
  if (hasUnitToken(piece, 'hidden')) return true;
  return isHideCover(state, { col: piece.col, row: piece.row });
}

export function isConcealedFrom(state: GameState, piece: Piece, viewer: Side): boolean {
  if (!isConcealed(state, piece)) return false;
  return isHostile(state, piece.side, viewer);
}

export function pieceVisibleTo(state: GameState, piece: Piece, viewer: Side): boolean {
  return !isConcealedFrom(state, piece, viewer);
}

export function pieceVisible(state: GameState, piece: Piece, viewers: Side[]): boolean {
  return viewers.some((v) => pieceVisibleTo(state, piece, v));
}

function reveal(piece: Piece): void {
  if (statsOf(piece.type).canHide || hasUnitToken(piece, 'hidden')) {
    piece.revealed = true;
  }
}

/**
 * Last hidden army: if a side's remaining pieces are all still concealed, they
 * break cover. AI sides also snap to aggressive. If every living piece on the
 * board is concealed, everyone unhides (so a human last-stand cannot stall).
 */
export function flushLastHiddenArmies(state: GameState): void {
  if (state.winner) return;
  const living = state.pieces;
  if (!living.length) return;

  const unhide = (mine: Piece[]) => {
    for (const p of mine) reveal(p);
  };
  const goAggressive = (side: Side) => {
    if (!isAiControlled(state, side)) return;
    if (aiStyleOf(state, side) === 'aggressive') return;
    state.aiStyles = { ...state.aiStyles, [side]: 'aggressive' };
  };

  if (living.every((p) => isConcealed(state, p))) {
    unhide(living);
    for (const side of new Set(living.map((p) => p.side))) goAggressive(side);
    return;
  }

  for (const side of participatingSides(state)) {
    const mine = living.filter((p) => p.side === side);
    if (!mine.length || !mine.every((p) => isConcealed(state, p))) continue;
    unhide(mine);
    goAggressive(side);
  }
}

export function tokenIsNoTouch(t: TileToken | undefined): boolean {
  return t?.type === 'notouch' || t?.noTouch === true;
}

export function isNoTouch(
  state: { tokens?: TileToken[] },
  h: Hex,
): boolean {
  return tokenIsNoTouch(tokenAt(state.tokens ?? [], h));
}

/** Stone wall or wooden palisade — units cannot enter. */
export function isBlockedWalk(
  state: { tokens: TileToken[]; terrain: Terrain[][] },
  h: Hex,
): boolean {
  return isWall(state, h) || isPalisade(state, h);
}

function palisadeHp(tok: TileToken | undefined): number {
  if (!tok || !isPalisadeToken(tok.type)) return 0;
  return tok.hp ?? PALISADE_HP;
}

function palisadeHpAt(
  state: { tokens: TileToken[] },
  h: Hex,
): number {
  return palisadeHp(tokenAt(state.tokens, h));
}

function forestHp(tok: TileToken | undefined): number {
  if (!tok || !isForestToken(tok.type)) return 0;
  return tok.hp ?? PALISADE_HP;
}

function chipForestAt(state: GameState, h: Hex): { remaining: number } | null {
  const tok = tokenAt(state.tokens, h);
  if (!tok || !isForestToken(tok.type)) return null;
  const remaining = Math.max(0, forestHp(tok) - 1);
  if (remaining <= 0) {
    state.tokens = state.tokens.filter(
      (t) => !(isForestToken(t.type) && t.col === h.col && t.row === h.row),
    );
  } else {
    tok.hp = remaining;
  }
  return { remaining };
}

export function isWalkableTerrain(t: Terrain): boolean {
  return t !== 'wall';
}

/** Walkable elevation. Land/water/wall = 0, hill = +1, plateau = +2, mountain = +3. */
export function terrainHeight(t: Terrain): number {
  if (t === 'rock') return 3;
  if (t === 'plateau') return 2;
  if (t === 'high') return 1;
  return 0;
}

export function isElevatedTerrain(t: Terrain): boolean {
  return terrainHeight(t) > 0;
}

export type Piece = {
  id: string;
  side: Side;
  type: UnitType;
  col: number;
  row: number;
  /** Kickoff hex. AI return-to-start. Missing → current hex. */
  startCol?: number;
  startRow?: number;
  /** Turns of shoot cooldown remaining (can't shoot while > 0). */
  shootCooldown?: number;
  /** Fired this turn — cooldown won't tick until the following end-turn. */
  firedThisTurn?: boolean;
  /** Remaining shots when the unit has a finite ammo cap. */
  ammo?: number;
  /** Remaining hitpoints (undefined = full / `UnitStats.hp`). */
  hp?: number;
  /** Remaining stamina (undefined = full / `UnitStats.stamina`). */
  stamina?: number;
  /** Spent stamina already this activation. */
  staminaUsedThisTurn?: boolean;
  /** Walked this activation — idle regen does not tick. */
  movedThisTurn?: boolean;
  /** Did anything this activation (move, shoot, climb). Idle regen requires none of this. */
  actedThisTurn?: boolean;
  /** Own-turn Ends left until +1 stamina can land (grant only while idle). */
  staminaRegenWait?: number;
  /** Cube facing (0–5). Missing → defaultFacing(side). Front follows the last walk step. */
  facing?: HexDir;
  /** Took ranged damage since last finished activation. Hoplite AI advances. */
  rangedHit?: boolean;
  /** Runtime ability overlay. Missing → unit stats. */
  abilities?: AbilityId[];
  /** Attachments (General, …). Missing → none. */
  unitTokens?: UnitTokenType[];
  /** Hide broken this match (moved, attacked, or was hit). */
  revealed?: boolean;
};

export type FxHit = { id: string; fatal: boolean; dealt: number; routed?: boolean };
export type FxStamina = { id: string; kind: 'gain' | 'spend' };
export type FxBoard = { col: number; row: number; text: string };

export type GameState = {
  cols: number;
  rows: number;
  orientation: HexOrientation;
  terrain: Terrain[][]; // [row][col]
  /** Overlay stamps. One per hex. Missing on old states → []. */
  tokens: TileToken[];
  pieces: Piece[];
  turn: Side;
  /** Scout mid-turn: remaining actions for selected piece id */
  scoutActionsLeft: number | null;
  scoutPieceId: string | null;
  /** Path-cost spent on moves this scout activation (budget 3 → no 2+2). */
  scoutMoveSpent: number | null;
  /** Locked piece's leftover action is a stamina buy (after a non-stamina move). */
  staminaBonus: boolean;
  winner: Side | null;
  log: string[];
  /** Who drives each color. */
  controls: Record<Side, ArmyControl>;
  /** Aggressive / defensive / advance checklist for each color. Missing → aggressive. */
  aiStyles: Record<Side, AiStyle>;
  /** Snapshot at match start. King-kill win only if that side actually fielded one. */
  hadKing: Record<Side, boolean>;
  /** How many pieces this side may activate before the turn ends. Default 1. */
  unitsPerTurn: number;
  /** Full rounds allowed. 0 = no limit. */
  maxTurns: number;
  /** Piece ids that already finished an activation this side-turn. */
  actedIds: string[];
  /** Side that opened the match. A level turn ticks when this side starts again. */
  startingSide: Side;
  /** Level turns. 1 on the opening action; +1 when `startingSide` starts after everyone else. */
  turnNumber: number;
  /** Pieces removed per side this match. */
  casualties: Record<Side, number>;
  /** One-shot drown (etc) hits for the UI to flash. Cleared after play. */
  fxHits?: FxHit[];
  /** Stamina grants (gold) / water-penalty spends (blue). Played at that side's turn start. */
  fxStamina?: FxStamina[];
  /** Friendly walked a message board. UI pops this then clears. */
  fxBoard?: FxBoard;
  pendingStaminaFx?: Partial<Record<Side, string[]>>;
};

export type Action =
  | { kind: 'move'; pieceId: string; to: Hex; path?: Hex[] }
  | { kind: 'shoot'; pieceId: string; at: Hex }
  | { kind: 'rotate'; pieceId: string; dir: HexDir }
  | { kind: 'rest'; pieceId: string }
  | { kind: 'skip' }; // scout skip remaining action

export type Highlight =
  | { kind: 'move'; hex: Hex; cost: number }
  /** Walk that spends 1 stamina (climb, or the extra straight-line action). */
  | { kind: 'stamina'; hex: Hex; cost: number }
  /** Would be a stamina walk if the pool weren't empty — display only. */
  | { kind: 'rest'; hex: Hex; cost: number }
  /** Valid fire target (enemy, or empty for splash). */
  | { kind: 'shoot'; hex: Hex }
  /** In weapon range + LOS, but not a legal shot (empty air / friendly). */
  | { kind: 'shoot-range'; hex: Hex };

/** Ring / hex-face color. Scale is −2..+2. */
export function armorColor(armor: number): string {
  if (armor <= -2) return '#dc4646';
  if (armor === -1) return '#e89030';
  if (armor === 1) return '#3d8ee0';
  if (armor >= 2) return '#8b5cf6';
  return '#3dba6a';
}

export function facingOf(piece: Piece): HexDir {
  return isHexDir(piece.facing) ? piece.facing : defaultFacing(piece.side);
}

export function armorSideHit(
  piece: Piece,
  from?: Hex,
  orientation?: HexOrientation,
): HexArmorSide | null {
  const s = statsOf(piece.type);
  if (!s.hexArmor || !from || orientation === undefined) return null;
  const incoming = incomingDir(from, { col: piece.col, row: piece.row }, orientation);
  if (incoming === null) return null;
  const rel = (((incoming - facingOf(piece)) % 6) + 6) % 6;
  return HEX_ARMOR_SIDES[rel] ?? null;
}

export function armorOf(piece: Piece, from?: Hex, orientation?: HexOrientation): number {
  const s = statsOf(piece.type);
  const side = armorSideHit(piece, from, orientation);
  if (side) return s[side];
  return s.armor;
}

/** Cube dirs of −2 hex-armor faces. Empty if hex armor is off. */
function redFaceDirs(piece: Piece): Set<HexDir> {
  const s = statsOf(piece.type);
  const blocked = new Set<HexDir>();
  if (!s.hexArmor) return blocked;
  const facing = facingOf(piece);
  for (let rel = 0; rel < 6; rel++) {
    if (s[HEX_ARMOR_SIDES[rel]] > -2) continue;
    blocked.add((((facing + rel) % 6) + 6) % 6 as HexDir);
  }
  return blocked;
}

/** Cube dirs a hex-armor piece cannot walk (faces at −2). */
function blockedWalkDirs(piece: Piece): Set<HexDir> {
  if (!isExperimentalOn('block-red-move')) return new Set();
  return redFaceDirs(piece);
}

/** Cube dirs a hex-armor piece cannot shoot (faces at −2). */
function blockedShootDirs(piece: Piece): Set<HexDir> {
  if (!isExperimentalOn('block-red-shoot')) return new Set();
  return redFaceDirs(piece);
}

/** True when `to` sits on a −2 hex-armor ray from `from`. */
export function isRedFaceRay(piece: Piece, from: Hex, to: Hex, o: HexOrientation): boolean {
  const dir = axisDir(from, to, o);
  return dir !== null && redFaceDirs(piece).has(dir);
}

/** True when walking `from`→`to` is banned by a red face. */
export function isBlockedFaceRay(piece: Piece, from: Hex, to: Hex, o: HexOrientation): boolean {
  const dir = axisDir(from, to, o);
  return dir !== null && blockedWalkDirs(piece).has(dir);
}

/** True when shooting `from`→`to` is banned by a red face. */
export function isBlockedShootRay(piece: Piece, from: Hex, to: Hex, o: HexOrientation): boolean {
  const dir = axisDir(from, to, o);
  return dir !== null && blockedShootDirs(piece).has(dir);
}

function hexDamageFaceAmount(piece: Piece, dir: HexDir): number {
  const s = statsOf(piece.type);
  if (!s.hexDamage) return 0;
  const rel = (((dir - facingOf(piece)) % 6) + 6) % 6;
  return Math.max(0, s[HEX_DAMAGE_SIDES[rel]] ?? 0);
}

/** Hostile hex-damage covering `hex` (sum of faces). Adjacent only. `from` is the nearest source for armor. */
export function hexDamageOn(
  state: GameState,
  hex: Hex,
  victimSide: Side,
): { amount: number; from: Hex } | null {
  if (isBlockedWalk(state, hex)) return null;
  let amount = 0;
  let from: Hex | null = null;
  for (const p of state.pieces) {
    if (!isHostile(state, p.side, victimSide)) continue;
    const origin = { col: p.col, row: p.row };
    const dir = dirBetween(origin, hex, state.orientation);
    if (dir === null) continue;
    const n = hexDamageFaceAmount(p, dir);
    if (n <= 0) continue;
    amount += n;
    if (!from) from = origin;
  }
  if (amount <= 0 || !from) return null;
  return { amount, from };
}

export type HexDamageMark = {
  col: number;
  row: number;
  dir: HexDir;
  amount: number;
  side: Side;
};

function hexDamageFaces(
  state: GameState,
  piece: Piece,
): { hex: Hex; dir: HexDir; amount: number }[] {
  const s = statsOf(piece.type);
  if (!s.hexDamage) return [];
  const origin = { col: piece.col, row: piece.row };
  const facing = facingOf(piece);
  const out: { hex: Hex; dir: HexDir; amount: number }[] = [];
  for (let rel = 0; rel < 6; rel++) {
    const amount = s[HEX_DAMAGE_SIDES[rel]] ?? 0;
    if (amount <= 0) continue;
    const dir = (((facing + rel) % 6) + 6) % 6 as HexDir;
    const h = neighborInDir(origin, dir, state.orientation);
    if (!inBounds(state, h) || isBlockedWalk(state, h)) continue;
    out.push({ hex: h, dir, amount });
  }
  return out;
}

function hexDamageCoveredKeys(state: GameState, piece: Piece): Set<string> {
  return new Set(hexDamageFaces(state, piece).map((f) => key(f.hex)));
}

/** Enemies newly covered if `piece` stood as `after`. */
export function hexDamagePushHits(
  state: GameState,
  piece: Piece,
  after: Pick<Piece, 'col' | 'row'> & { facing?: HexDir },
): Piece[] {
  const prev = hexDamageCoveredKeys(state, piece);
  const moved: Piece = { ...piece, col: after.col, row: after.row, facing: after.facing };
  const hits: Piece[] = [];
  for (const f of hexDamageFaces(state, moved)) {
    if (prev.has(key(f.hex))) continue;
    const v = pieceAt(state, f.hex);
    if (!v || v.id === piece.id) continue;
    if (!isHostile(state, piece.side, v.side)) continue;
    hits.push(v);
  }
  return hits;
}

function applyHexDamagePush(state: GameState, attacker: Piece, prevCovered: Set<string>): void {
  if (!statsOf(attacker.type).hexDamage) return;
  const from: Hex = { col: attacker.col, row: attacker.row };
  for (const f of hexDamageFaces(state, attacker)) {
    if (prevCovered.has(key(f.hex))) continue;
    const victim = pieceAt(state, f.hex);
    if (!victim || victim.id === attacker.id) continue;
    if (!isHostile(state, attacker.side, victim.side)) continue;
    const before = hpLeft(victim);
    const dmg = applyDamage(state, victim, f.amount, 1, from, true, false);
    const dealt = before - dmg.remaining;
    if (dealt <= 0 && !dmg.routed) continue;
    state.fxHits = [
      ...(state.fxHits ?? []),
      { id: victim.id, fatal: dmg.fatal, dealt: Math.max(dealt, dmg.routed ? 1 : 0), routed: dmg.routed },
    ];
    state.log.push(
      dmg.routed
        ? `${unitLog(victim)} routs on facing pikes`
        : dmg.fatal
          ? `${unitLog(victim)} dies on facing pikes`
          : `${unitLog(victim)} is caught by facing pikes — ${dealt} HP (${dmg.remaining} HP)`,
    );
  }
}

/** Adjacent hexes painted by a hex-damage face. */
export function hexDamageMarks(state: GameState): HexDamageMark[] {
  const best = new Map<string, HexDamageMark>();
  for (const p of state.pieces) {
    for (const f of hexDamageFaces(state, p)) {
      const k = key(f.hex);
      const prev = best.get(k);
      if (!prev || f.amount > prev.amount) {
        best.set(k, {
          col: f.hex.col,
          row: f.hex.row,
          dir: f.dir,
          amount: f.amount,
          side: p.side,
        });
      }
    }
  }
  return [...best.values()];
}

/** Damage after the target's armor. Negative armor boosts melee only; shots and facing pikes ignore it. */
export function netDamage(
  piece: Piece,
  amount: number,
  min = 0,
  from?: Hex,
  orientation?: HexOrientation,
  ranged = false,
): number {
  const shield = armorOf(piece, from, orientation);
  const soak = ranged ? Math.max(0, shield) : shield;
  return Math.max(min, amount - soak);
}

export function hasSplash(stats: UnitStats): boolean {
  return stats.splashDamage > 0;
}

export function isReloading(piece: Piece): boolean {
  return (piece.shootCooldown ?? 0) > 0;
}

/** True when the unit has a finite ammo cap and none left. */
export function isDepleted(piece: Piece): boolean {
  const cap = statsOf(piece.type).ammo;
  if (cap <= 0) return false;
  return (piece.ammo ?? 0) <= 0;
}

/** Remaining shots, or null if ammo is unlimited. */
export function ammoLeft(piece: Piece): number | null {
  const cap = statsOf(piece.type).ammo;
  if (cap <= 0) return null;
  return piece.ammo ?? 0;
}

function ammoLog(piece: Piece, stats: UnitStats): string {
  if (stats.ammo <= 0) return '';
  return (piece.ammo ?? 0) <= 0 ? ' — empty' : ` — ${piece.ammo} ammo`;
}

export function hpMax(piece: Piece): number {
  return statsOf(piece.type).hp + (hasUnitToken(piece, 'general') ? 1 : 0);
}

/** Scoring / AI weight. General token +1. */
export function combatValue(piece: Piece): number {
  return statsOf(piece.type).value + (hasUnitToken(piece, 'general') ? 1 : 0);
}

export function hpLeft(piece: Piece): number {
  return piece.hp ?? hpMax(piece);
}

export function staminaMax(piece: Piece): number {
  return statsOf(piece.type).stamina + (hasUnitToken(piece, 'general') ? 1 : 0);
}

export function staminaLeft(piece: Piece): number {
  const max = staminaMax(piece);
  if (max <= 0) return 0;
  return piece.stamina ?? max;
}

export function canSpendStamina(piece: Piece): boolean {
  return staminaLeft(piece) > 0 && !piece.staminaUsedThisTurn;
}

function spendStaminaPool(piece: Piece): void {
  const max = staminaMax(piece);
  if (max <= 0) return;
  piece.stamina = Math.max(0, staminaLeft(piece) - 1);
  restartStaminaWait(piece);
}

function spendStamina(piece: Piece): void {
  spendStaminaPool(piece);
  piece.staminaUsedThisTurn = true;
}

/** Any action while below max restarts the idle countdown. */
function markActed(piece: Piece): void {
  piece.actedThisTurn = true;
  if (staminaLeft(piece) < staminaMax(piece)) restartStaminaWait(piece);
}

/** Moving while below max restarts the idle countdown. */
function markMoved(piece: Piece): void {
  piece.movedThisTurn = true;
  markActed(piece);
}

function restartStaminaWait(piece: Piece): void {
  const regen = statsOf(piece.type).staminaRegen;
  if (regen > 0 && staminaLeft(piece) < staminaMax(piece)) {
    piece.staminaRegenWait = regen;
  }
}

function hpOf(piece: Piece, hpMap?: Map<string, number>): number {
  return hpMap?.get(piece.id) ?? hpLeft(piece);
}

function applyDamage(
  state: GameState,
  victim: Piece,
  amount: number,
  min = 0,
  from?: Hex,
  ranged = false,
  markShot = ranged,
): { fatal: boolean; remaining: number; routed: boolean } {
  const routed = wouldRout(state, victim, from);
  const remaining = routed
    ? 0
    : Math.max(
        0,
        hpLeft(victim) - netDamage(victim, amount, min, from, state.orientation, ranged),
      );
  victim.hp = remaining;
  reveal(victim);
  if (markShot) victim.rangedHit = true;
  if (remaining <= 0) {
    state.pieces = state.pieces.filter((p) => p.id !== victim.id);
    const lost = state.casualties[victim.side] ?? 0;
    state.casualties = { ...state.casualties, [victim.side]: lost + 1 };
    return { fatal: true, remaining: 0, routed };
  }
  return { fatal: false, remaining, routed: false };
}

/**
 * Generals hold. Otherwise: a hostile on the exact opposite hex, and
 * one of those two faces is −2 (red). Friends never pin. Terrain does not.
 */
export function wouldRout(state: GameState, victim: Piece, from?: Hex): boolean {
  if (!from) return false;
  if (hasAbility(victim, 'general')) return false;
  const at: Hex = { col: victim.col, row: victim.row };
  const incoming = incomingDir(from, at, state.orientation);
  if (incoming === null) return false;
  const oppDir = (((incoming + 3) % 6) + 6) % 6 as HexDir;
  const opp = neighborInDir(at, oppDir, state.orientation);
  const occ = pieceAt(state, opp);
  if (!occ || occ.id === victim.id || !isHostile(state, occ.side, victim.side)) {
    return false;
  }
  return armorOnDir(victim, incoming) <= -2 || armorOnDir(victim, oppDir) <= -2;
}

function armorOnDir(piece: Piece, dir: HexDir): number {
  const s = statsOf(piece.type);
  if (!s.hexArmor) return s.armor;
  const rel = (((dir - facingOf(piece)) % 6) + 6) % 6;
  return s[HEX_ARMOR_SIDES[rel]];
}

function escLog(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function unitLog(piece: Piece): string {
  return `<span class="log-side ${piece.side}">${escLog(statsOf(piece.type).name)}</span>`;
}

/** Hexes actually entered: origin exclusive through stop inclusive. */
function walkedHexes(from: Hex, path: Hex[], stop: Hex): Hex[] {
  if (eq(from, stop)) return [];
  const out: Hex[] = [];
  for (const h of path) {
    out.push(h);
    if (eq(h, stop)) return out;
  }
  return out;
}

function claimFlag(state: GameState, piece: Piece, tok: TileToken): void {
  if (tok.type !== 'flag') return;
  if (tok.owner && sameTeam(state, tok.owner, piece.side)) return;
  const prev = tok.owner;
  tok.owner = piece.side;
  const many = mapFlags(state).length > 1;
  const noun = many ? 'a flag' : 'the flag';
  state.log.push(
    prev
      ? `${unitLog(piece)} recaptures ${noun}`
      : `${unitLog(piece)} captures ${noun}`,
  );
}

function strikeFacingPikes(state: GameState, piece: Piece, hex: Hex): boolean {
  const hit = hexDamageOn(state, hex, piece.side);
  if (!hit) return false;
  const before = hpLeft(piece);
  const dmg = applyDamage(state, piece, hit.amount, 1, hit.from, true, false);
  const dealt = before - dmg.remaining;
  if (dealt <= 0 && !dmg.routed) return false;
  state.fxHits = [
    ...(state.fxHits ?? []),
    { id: piece.id, fatal: dmg.fatal, dealt: Math.max(dealt, dmg.routed ? 1 : 0), routed: dmg.routed },
  ];
  state.log.push(
    dmg.routed
      ? `${unitLog(piece)} routs on facing pikes`
      : dmg.fatal
        ? `${unitLog(piece)} dies on facing pikes`
        : `${unitLog(piece)} steps into facing pikes — ${dealt} HP (${dmg.remaining} HP)`,
  );
  return dmg.fatal;
}

function readBoard(state: GameState, piece: Piece, tok: TileToken): void {
  if (tok.type !== 'board') return;
  if (!isPlayerControlled(state, piece.side)) return;
  if (tok.read) return;
  tok.read = true;
  const text = sanitizeBoardText(tok.text);
  if (text) state.fxBoard = { col: tok.col, row: tok.row, text };
  state.log.push(`${unitLog(piece)} reads a message board`);
}

function applyWalkTokens(
  state: GameState,
  piece: Piece,
  from: Hex,
  path: Hex[],
  stop: Hex,
): void {
  for (const h of walkedHexes(from, path, stop)) {
    const tok = tokenAt(state.tokens, h);
    if (tok?.type === 'flag') claimFlag(state, piece, tok);
    if (tok?.type === 'board') readBoard(state, piece, tok);
    if (tok?.type === 'pikes') {
      const before = hpLeft(piece);
      const dmg = applyDamage(state, piece, PIKE_DAMAGE, 1);
      const dealt = before - dmg.remaining;
      if (dealt > 0) {
        state.fxHits = [...(state.fxHits ?? []), { id: piece.id, fatal: dmg.fatal, dealt }];
        state.log.push(
          dmg.fatal
            ? `${unitLog(piece)} dies on pikes`
            : `${unitLog(piece)} steps on pikes — ${dealt} HP (${dmg.remaining} HP)`,
        );
        if (dmg.fatal) return;
      }
    }
    if (strikeFacingPikes(state, piece, h)) return;
  }
}

function sideLog(side: Side, label: string): string {
  return `<span class="log-side ${side}">${escLog(label)}</span>`;
}

function hpBit(victim: Piece, fatal: boolean, remaining: number, routed = false): string {
  if (routed) return `${unitLog(victim)} routed`;
  return fatal ? `${unitLog(victim)} killed` : `${unitLog(victim)} (${remaining} HP)`;
}

/** net = attack − shield; negative shield adds melee only. Melee floors at 1. */
function dmgLine(
  state: GameState,
  victim: Piece,
  amount: number,
  min = 0,
  from?: Hex,
  ranged = false,
): string {
  const side = armorSideHit(victim, from, state.orientation);
  const raw = armorOf(victim, from, state.orientation);
  const shield = ranged ? Math.max(0, raw) : raw;
  const net = netDamage(victim, amount, min, from, state.orientation, ranged);
  const face = side ? ` ${HEX_ARMOR_LABEL[side].toLowerCase()}` : '';
  return `<span class="log-dmg">DMG: ${net} (attack ${amount} - shield ${shield}${face})</span>`;
}

export type MoveHit = {
  id: string;
  amount: number;
  fatal: boolean;
  remaining: number;
  from: Hex;
  routed?: boolean;
};

export type PalisadeHit = {
  hex: Hex;
  remaining: number;
  destroyed: boolean;
};

export type MovePlan = {
  stop: Hex;
  hits: MoveHit[];
  palisadeHits: PalisadeHit[];
  facing: HexDir;
};

function inWater(state: GameState, h: Hex): boolean {
  return terrainAt(state, h) === 'water';
}

/** Standing elevation added to a move action from `at` (hill +1, plateau +2, mountain +3). Water is always 1 hex. Move 0 stays planted. */
function moveRangeAt(state: GameState, piece: Piece, at: Hex): number {
  const move = statsOf(piece.type).move;
  if (move <= 0) return 0;
  if (inWater(state, at)) return 1;
  return move + hexHeight(state, at);
}

function activationMoveRange(state: GameState, piece: Piece): number {
  const stats = statsOf(piece.type);
  if (stats.move <= 0) return 0;
  const from = { col: piece.col, row: piece.row };
  if (inWater(state, from)) return 1;
  const elev = hexHeight(state, from);
  // Stamina's extra action is a fresh straight line of `move`. Leftover
  // steps from the previous action (stop after 1 of 2, etc.) do not carry.
  if (state.staminaBonus && state.scoutPieceId === piece.id) {
    return stats.move + elev;
  }
  let moveRange = stats.move;
  if (stats.actions > 1 && stats.moveBudget > 0) {
    const spent =
      state.scoutPieceId === piece.id ? (state.scoutMoveSpent ?? 0) : 0;
    moveRange = Math.min(stats.move, Math.max(0, stats.moveBudget - spent));
  }
  return moveRange + elev;
}

function destLandsBeyond(state: GameState, piece: Piece, dest: Hex): boolean {
  const occ = pieceAt(state, dest);
  if (occ && occ.id !== piece.id) return false;
  if (isPalisadeToken(tokenAt(state.tokens, dest)?.type)) return false;
  return true;
}

/**
 * Where a move actually ends: occupying an enemy hex is melee.
 * A kill takes the hex; a melee survivor leaves the attacker on the hex before.
 * Charge (charge > 0) hits every mid-path enemy. Same gate as palisade: you only
 * continue to a unit behind if this hit would destroy the blocker (click the 2nd,
 * the 1st still eats the charge). Empty dest beyond: pass through the line and
 * damage them even if they survive.
 * Palisade: one melee hit per hex. Charge does not pass unless that hit breaks it.
 */
export function previewMove(
  state: GameState,
  piece: Piece,
  to: Hex,
  along?: Hex[],
): MovePlan {
  const from: Hex = { col: piece.col, row: piece.row };
  const stats = statsOf(piece.type);
  const melee = Math.max(0, stats.meleeDamage);
  const charge = Math.max(0, stats.charge);
  const path = resolveMovePath(state, piece, to, along);
  const dest = path[path.length - 1];
  const landsBeyond = dest ? destLandsBeyond(state, piece, dest) : false;

  const hpMap = new Map(state.pieces.map((p) => [p.id, hpLeft(p)]));
  const hits: MoveHit[] = [];
  const palisadeHits: PalisadeHit[] = [];
  // Last hex this piece may occupy. Friends / living enemies are pass-through only.
  let stop = from;
  let facing = facingOf(piece);
  let prev = from;

  const strike = (victim: Piece, atkFrom: Hex, amount: number): boolean => {
    if (amount <= 0) return false;
    const nextHp =
      hpOf(victim, hpMap) - netDamage(victim, amount, 1, atkFrom, state.orientation);
    const routed = wouldRout(state, victim, atkFrom);
    const dead = routed || nextHp <= 0;
    hpMap.set(victim.id, dead ? 0 : nextHp);
    hits.push({
      id: victim.id,
      amount,
      fatal: dead,
      remaining: dead ? 0 : Math.max(0, nextHp),
      from: atkFrom,
      routed,
    });
    return dead;
  };

  for (let i = 0; i < path.length; i++) {
    const h = path[i];
    const step = dirBetween(prev, h, state.orientation);
    if (step !== null) facing = step;
    const occ = pieceAt(state, h);
    if (!occ || occ.id === piece.id) {
      const pal = tokenAt(state.tokens, h);
      if (isPalisadeToken(pal?.type)) {
        if (melee <= 0) break;
        const remaining = Math.max(0, palisadeHp(pal) - 1);
        palisadeHits.push({ hex: h, remaining, destroyed: remaining <= 0 });
        if (remaining > 0) break;
        stop = h;
        prev = h;
        continue;
      }
      stop = h;
      prev = h;
      continue;
    }
    if (sameTeam(state, occ.side, piece.side)) {
      prev = h;
      continue;
    }
    const isDest = i === path.length - 1;
    const charging = charge > 0 && !isDest;
    if (!isDest && !charging) {
      prev = h;
      continue;
    }
    const died = strike(occ, prev, isDest ? melee : charge);
    if (charging) {
      if (died) stop = h;
      prev = h;
      if (!died && !landsBeyond) break;
      continue;
    }
    if (!died) break;
    stop = h;
    prev = h;
  }

  return { stop, hits, palisadeHits, facing };
}

function pathsEq(a: Hex[], b: Hex[]): boolean {
  return a.length === b.length && a.every((h, i) => eq(h, b[i]));
}

function isStepWalk(state: GameState, from: Hex, path: Hex[], dest: Hex): boolean {
  if (!path.length || !eq(path[path.length - 1], dest)) return false;
  let cur = from;
  for (const h of path) {
    if (dirBetween(cur, h, state.orientation) === null) return false;
    cur = h;
  }
  return true;
}

/** True when `path` is a legal 1- or 2-action walk to `to` (the drawn option). */
function isLegalMovePath(
  state: GameState,
  piece: Piece,
  to: Hex,
  path: Hex[],
): boolean {
  const from = { col: piece.col, row: piece.row };
  if (isBlockedFaceRay(piece, from, to, state.orientation)) return false;
  if (!isStepWalk(state, from, path, to)) return false;
  const first = straightMoveStops(state, piece);
  const one = first.get(key(to));
  if (one && pathsEq(one.path, path)) return true;
  if (!extraMoveAction(state, piece) || first.has(key(to))) return false;
  const planned = allMoveStops(state, piece).get(key(to));
  if (planned && pathsEq(planned.path, path)) return true;
  const firstRange = activationMoveRange(state, piece);
  const blocked = blockedWalkDirs(piece);
  const via0 = path[firstRange - 1];
  const secondRange = via0 ? moveRangeAt(state, piece, via0) : statsOf(piece.type).move;
  if (path.length > firstRange && path.length <= firstRange + secondRange) {
    const opts = movePathOpts(state, piece, from);
    let cur = from;
    let dir: HexDir | null = null;
    let ok = true;
    for (let i = 0; i < path.length; i++) {
      const h = path[i];
      const step = dirBetween(cur, h, state.orientation);
      if (step === null || blocked.has(step) || (dir !== null && step !== dir)) {
        ok = false;
        break;
      }
      dir = step;
      if (!canWalkStep(state, piece, from, cur, h)) {
        ok = false;
        break;
      }
      const last = i === path.length - 1;
      if (last ? !opts.canStop(h) : !opts.canPass(h)) {
        ok = false;
        break;
      }
      cur = h;
    }
    if (ok) {
      const via = path[firstRange - 1];
      if (via && !pathHaltsExtra(state, from, via, path.slice(0, firstRange))) return true;
    }
  }
  for (let i = 1; i < path.length; i++) {
    const via = path[i - 1];
    const a = first.get(key(via));
    if (!a || !pathsEq(a.path, path.slice(0, i))) continue;
    if (pieceAt(state, via) || palisadeHpAt(state, via) > 1 || pathHaltsExtra(state, from, via, a.path)) continue;
    const b = straightMoveStops(state, piece, via, moveRangeAt(state, piece, via)).get(key(to));
    if (b && pathsEq(b.path, path.slice(i))) return true;
  }
  return false;
}

/** Drawn path if still legal; otherwise the canonical option to `to`. */
export function resolveMovePath(
  state: GameState,
  piece: Piece,
  to: Hex,
  drawn?: Hex[],
): Hex[] {
  if (drawn?.length && isLegalMovePath(state, piece, to, drawn)) return drawn;
  return pathForMove(state, piece, to);
}

/** Hexes walked start→to (excludes start). One or two straight-line actions. */
export function pathForMove(state: GameState, piece: Piece, to: Hex): Hex[] {
  return allMoveStops(state, piece).get(key(to))?.path ?? [];
}

export type MovePathPlan = { path: Hex[]; via: Hex | null };

function planFromStop(stop: StraightStop | undefined): MovePathPlan {
  if (!stop) return { path: [], via: null };
  const via = stop.via && !eq(stop.via, stop.path[stop.path.length - 1]!) ? stop.via : null;
  return { path: stop.path, via };
}

/**
 * Prefer keeping the already-drawn path. Trim if `to` is on it; otherwise keep
 * the first-action waypoint when the dest is still a fresh second-action ray.
 */
export function stickyMovePlan(
  state: GameState,
  piece: Piece,
  to: Hex,
  prev: Hex[],
): MovePathPlan {
  const first = straightMoveStops(state, piece);
  const fresh = planFromStop(allMoveStops(state, piece).get(key(to)));
  if (!fresh.path.length) return { path: [], via: null };

  const onPrev = prev.findIndex((h) => eq(h, to));
  if (!fresh.via) {
    if (onPrev >= 0) return { path: prev.slice(0, onPrev + 1), via: null };
    return fresh;
  }
  if (onPrev >= 0) {
    const path = prev.slice(0, onPrev + 1);
    const via =
      fresh.via && path.some((h) => eq(h, fresh.via!)) && !eq(fresh.via, to)
        ? fresh.via
        : null;
    return { path, via };
  }

  const start = { col: piece.col, row: piece.row };
  for (let i = Math.min(prev.length, activationMoveRange(state, piece)); i >= 1; i--) {
    const via = prev[i - 1];
    const stop = first.get(key(via));
    if (!stop || pieceAt(state, via) || pathHaltsExtra(state, start, via, stop.path)) continue;
    const tail = straightMoveStops(state, piece, via, moveRangeAt(state, piece, via)).get(key(to));
    if (!tail) continue;
    return { path: [...prev.slice(0, i), ...tail.path], via };
  }
  return fresh;
}

export function stickyPathForMove(
  state: GameState,
  piece: Piece,
  to: Hex,
  prev: Hex[],
): Hex[] {
  return stickyMovePlan(state, piece, to, prev).path;
}

export function pieceAt(state: GameState, h: Hex): Piece | undefined {
  return state.pieces.find((p) => p.col === h.col && p.row === h.row);
}

export function getPiece(state: GameState, id: string): Piece | undefined {
  return state.pieces.find((p) => p.id === id);
}

export function terrainAt(state: GameState, h: Hex): Terrain {
  return state.terrain[h.row]?.[h.col] ?? 'rock';
}

function hexHeight(state: GameState, h: Hex): number {
  return terrainHeight(terrainAt(state, h));
}

function inBounds(state: GameState, h: Hex): boolean {
  return h.col >= 0 && h.row >= 0 && h.col < state.cols && h.row < state.rows;
}

function hexDist(state: GameState, a: Hex, b: Hex): number {
  return distance(a, b, state.orientation);
}

function hexNeighbors(state: GameState, h: Hex): Hex[] {
  return neighbors(h, state.orientation);
}

/** Firing at elevation costs that much extra range (hill +1, plateau +2, mountain +3). */
function highTargetTax(state: GameState, to: Hex): number {
  return hexHeight(state, to);
}

function losClear(
  state: GameState,
  from: Hex,
  to: Hex,
  overUnits: boolean,
  viewer: Side,
): boolean {
  const cells = line(from, to, state.orientation);
  const fromH = hexHeight(state, from);
  // Wall always blocks. Intermediate terrain higher than the shooter blocks.
  // Same/lower elevation is clear (ridge / plateau). Pieces block only from height 0.
  // Arch: fire over units even from low. Terrain LOS unchanged.
  // Destination may be elevated / occupied / wall — you can shoot *onto* it.
  // Hidden enemies do not block — you cannot see them.
  for (let i = 0; i < cells.length - 1; i++) {
    const h = cells[i];
    if (isWall(state, h)) return false;
    if ((isPalisade(state, h) || isForest(state, h)) && !overUnits) return false;
    if (hexHeight(state, h) > fromH) return false;
    const blocker = pieceAt(state, h);
    if (
      fromH === 0 &&
      !overUnits &&
      blocker &&
      !isConcealedFrom(state, blocker, viewer)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Splash blast from impact `at`, shot fired from `from`.
 * Walls block forward spread — only the back/side arch (toward the shooter) is hit
 * when impacting a wall; splash never continues through solid cover.
 */
export function splashBlast(state: GameState, at: Hex, from: Hex): Hex[] {
  const out: Hex[] = [at];
  const impactSolid = isBlockedWalk(state, at);
  const atDist = hexDist(state, from, at);

  // Concrete/rock hit: only 3 splash tiles — impact + 2 closest toward shooter
  if (impactSolid) {
    const back = hexNeighbors(state, at)
      .filter((n) => inBounds(state, n) && hexDist(state, from, n) <= atDist)
      .sort((a, b) => hexDist(state, from, a) - hexDist(state, from, b));
    for (const n of back.slice(0, 2)) out.push(n);
    return out;
  }

  for (const n of hexNeighbors(state, at)) {
    if (!inBounds(state, n)) continue;

    // Open impact: can clip an adjacent wall/rock, but not hexes in its shadow
    if (isBlockedWalk(state, n)) {
      out.push(n);
      continue;
    }
    if (inSolidShadow(state, from, at, n)) continue;
    out.push(n);
  }
  return out;
}

/** True if `n` sits in the shadow behind solid cover adjacent to impact `at`. */
function inSolidShadow(state: GameState, from: Hex, at: Hex, n: Hex): boolean {
  for (const s of hexNeighbors(state, at)) {
    if (!inBounds(state, s) || !isBlockedWalk(state, s)) continue;
    if (eq(s, n)) return false;
    // n is behind solid s (from the shot) if farther from shooter than s and touches s
    if (hexDist(state, s, n) === 1 && hexDist(state, from, n) > hexDist(state, from, s)) {
      // Only treat as shadow when n is not merely beside the cover in a mutual triangle
      // with a clear shot angle — require n to be further along the from→s axis
      if (hexDist(state, from, n) >= hexDist(state, from, s) + hexDist(state, s, n)) return true;
    }
  }
  return false;
}

/** True if aiming splash at `at` would damage at least one enemy. */
export function splashHitsEnemy(
  state: GameState,
  at: Hex,
  from: Hex,
  shooterSide: Side,
): boolean {
  for (const h of splashBlast(state, at, from)) {
    const t = pieceAt(state, h);
    if (
      t &&
      isHostile(state, t.side, shooterSide) &&
      !isConcealedFrom(state, t, shooterSide)
    ) {
      return true;
    }
  }
  return false;
}

/** True if splash would hit an enemy, or this hex is a wall to demolish. */
function splashHasTarget(
  state: GameState,
  at: Hex,
  from: Hex,
  shooterSide: Side,
): boolean {
  if (splashHitsEnemy(state, at, from, shooterSide)) return true;
  // Walls: must aim at the wall itself (not the tile in front) so the rocket impacts on it
  return isBlockedWalk(state, at);
}

export const MIN_UNITS_PER_TURN = 1;
export const MAX_UNITS_PER_TURN = 12;

export function clampUnitsPerTurn(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 1;
  return Math.max(MIN_UNITS_PER_TURN, Math.min(MAX_UNITS_PER_TURN, Math.floor(v)));
}

export const MIN_MAX_TURNS = 0;
export const MAX_MAX_TURNS = 99;

export function clampMaxTurns(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(MIN_MAX_TURNS, Math.min(MAX_MAX_TURNS, Math.floor(v)));
}

export function timedOut(state: GameState): boolean {
  const cap = state.maxTurns ?? 0;
  return cap > 0 && state.turnNumber > cap;
}

export function hasActed(state: GameState, id: string): boolean {
  return state.actedIds.includes(id);
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    terrain: state.terrain.map((r) => [...r]),
    tokens: (state.tokens ?? []).map((t) => ({ ...t })),
    pieces: state.pieces.map((p) => ({
      ...p,
      abilities: p.abilities ? [...p.abilities] : undefined,
      unitTokens: p.unitTokens ? [...p.unitTokens] : undefined,
    })),
    log: [...state.log],
    actedIds: [...state.actedIds],
    controls: { ...state.controls },
    aiStyles: { ...defaultAiStyles(), ...state.aiStyles },
    casualties: { ...emptySideCounts(), ...state.casualties },
    hadKing: { ...emptyHadKing(), ...state.hadKing },
    fxHits: state.fxHits?.map((h) => ({ ...h })),
    fxStamina: state.fxStamina?.map((h) => ({ ...h })),
    fxBoard: state.fxBoard ? { ...state.fxBoard } : undefined,
    pendingStaminaFx: state.pendingStaminaFx
      ? {
          red: state.pendingStaminaFx.red ? [...state.pendingStaminaFx.red] : undefined,
          blue: state.pendingStaminaFx.blue ? [...state.pendingStaminaFx.blue] : undefined,
          yellow: state.pendingStaminaFx.yellow
            ? [...state.pendingStaminaFx.yellow]
            : undefined,
          purple: state.pendingStaminaFx.purple
            ? [...state.pendingStaminaFx.purple]
            : undefined,
        }
      : undefined,
  };
}

export function abilitiesOf(piece: Piece): AbilityId[] {
  const base = piece.abilities ?? statsOf(piece.type).abilities ?? [];
  if (hasUnitToken(piece, 'general') && !base.includes('general')) {
    return [...base, 'general'];
  }
  return base;
}

export function hasAbility(piece: Piece, id: AbilityId): boolean {
  return abilitiesOf(piece).includes(id);
}

export function grantAbility(piece: Piece, id: AbilityId): void {
  const cur = abilitiesOf(piece);
  if (cur.includes(id)) {
    piece.abilities = [...cur];
    return;
  }
  piece.abilities = [...cur, id];
}

export function revokeAbility(piece: Piece, id: AbilityId): void {
  piece.abilities = abilitiesOf(piece).filter((a) => a !== id);
}

export function hasGeneral(pieces: Piece[], side: Side): boolean {
  return pieces.some((p) => p.side === side && hasAbility(p, 'general'));
}

/** If a piece just became a general, command-kill is now in play for that side. */
export function noteGenerals(state: GameState): void {
  for (const s of SIDES) {
    if (hasGeneral(state.pieces, s)) state.hadKing[s] = true;
  }
}

export function controlOf(state: GameState, side: Side): ArmyControl {
  return state.controls?.[side] ?? defaultArmyControls()[side];
}

export function isPlayerControlled(state: GameState, side: Side): boolean {
  return controlOf(state, side) === 'player';
}

export function isAiControlled(state: GameState, side: Side): boolean {
  const c = controlOf(state, side);
  return c === 'ai-enemy' || c === 'ai-ally';
}

export function participatingSides(state: GameState): Side[] {
  return SIDES.filter(
    (s) =>
      state.pieces.some((p) => p.side === s) ||
      !!state.hadKing[s] ||
      (state.casualties[s] ?? 0) > 0,
  );
}

function coalition(state: GameState, side: Side): string {
  const vsEnemy = participatingSides(state).some(
    (s) => controlOf(state, s) === 'ai-enemy',
  );
  if (vsEnemy) {
    return controlOf(state, side) === 'ai-enemy' ? 'enemy' : 'player';
  }
  return `solo-${side}`;
}

export function sameTeam(state: GameState, a: Side, b: Side): boolean {
  return a === b || coalition(state, a) === coalition(state, b);
}

export function isHostile(state: GameState, a: Side, b: Side): boolean {
  return !sameTeam(state, a, b);
}

export function playerSides(state: GameState): Side[] {
  return participatingSides(state).filter((s) => isPlayerControlled(state, s));
}

/** Whose eyes the board is drawn for. Hotseat: current player. Vs AI: the human team. */
export function viewingSides(state: GameState): Side[] {
  if (state.winner) return participatingSides(state);
  const players = playerSides(state);
  const eyes = players.length <= 1 ? (players[0] ?? state.turn) : state.turn;
  return participatingSides(state).filter((s) => sameTeam(state, s, eyes));
}

export function playerCasualties(state: GameState): number {
  return playerSides(state).reduce((n, s) => n + (state.casualties[s] ?? 0), 0);
}

export function matchHasEnemies(state: GameState): boolean {
  return participatingSides(state).some((s) => controlOf(state, s) === 'ai-enemy');
}

export function playerTeamWon(state: GameState): boolean {
  if (!state.winner) return false;
  const humans = playerSides(state);
  if (!humans.length) return false;
  return humans.some((s) => sameTeam(state, s, state.winner!));
}

export function openingSide(pieces: { side: Side }[]): Side {
  return SIDES.find((s) => pieces.some((p) => p.side === s)) ?? 'red';
}

function nextLivingSide(state: GameState, from: Side): Side {
  const i0 = SIDES.indexOf(from);
  const parts = participatingSides(state);
  for (let k = 1; k <= SIDES.length; k++) {
    const s = SIDES[(i0 + k) % SIDES.length];
    if (parts.includes(s) && !sideDefeated(state, s)) return s;
  }
  return from;
}

/**
 * Every own-turn End advances the countdown. Any action (move, shoot, climb)
 * resets it to `regen` (this End still counts, so remaining is regen-1). Only a
 * fully idle End on land can grant — water never refills, even parked.
 * Otherwise spend/shoot/walk + regen 1 would refill the same turn.
 */
function tickStamina(state: GameState, side: Side): void {
  for (const p of state.pieces) {
    if (p.side !== side) continue;
    const busy = !!p.actedThisTurn || !!p.movedThisTurn;
    p.actedThisTurn = false;
    p.movedThisTurn = false;
    p.staminaUsedThisTurn = false;
    const max = staminaMax(p);
    const regen = statsOf(p.type).staminaRegen;
    if (max <= 0 || regen <= 0) continue;
    if (staminaLeft(p) >= max) {
      p.staminaRegenWait = undefined;
      continue;
    }
    const wait = (p.staminaRegenWait ?? regen) - 1;
    const wet = inWater(state, { col: p.col, row: p.row });
    if (!busy && wait <= 0 && !wet) {
      p.stamina = Math.min(max, staminaLeft(p) + 1);
      p.staminaRegenWait = staminaLeft(p) < max ? regen : undefined;
      const q = state.pendingStaminaFx ?? (state.pendingStaminaFx = {});
      q[side] = [...(q[side] ?? []), p.id];
    } else {
      p.staminaRegenWait = Math.max(0, wait);
    }
  }
}

function tickShootCooldowns(state: GameState, side: Side): void {
  for (const p of state.pieces) {
    if (p.side !== side) continue;
    if (p.firedThisTurn) {
      // Fired this activation — keep cooldown for the next one
      p.firedThisTurn = false;
      continue;
    }
    if ((p.shootCooldown ?? 0) > 0) {
      p.shootCooldown = (p.shootCooldown ?? 0) - 1;
    }
  }
}

function clearScoutLock(state: GameState): void {
  state.scoutActionsLeft = null;
  state.scoutPieceId = null;
  state.scoutMoveSpent = null;
  state.staminaBonus = false;
}

const WATER_DROWN_HP = 2;

/** Start of a side's turn: each unit in water spends 1 stamina, or takes 2 HP. */
export function applyWaterUpkeep(state: GameState, side: Side): void {
  const drowned: Piece[] = [];
  for (const p of state.pieces) {
    if (p.side !== side) continue;
    if (!inWater(state, { col: p.col, row: p.row })) continue;
    if (staminaMax(p) > 0 && staminaLeft(p) > 0) {
      spendStaminaPool(p);
      state.fxStamina = [...(state.fxStamina ?? []), { id: p.id, kind: 'spend' }];
      state.log.push(`${unitLog(p)} treads water (−1 stamina)`);
    } else {
      drowned.push(p);
    }
  }
  for (const p of drowned) {
    const before = hpLeft(p);
    const remaining = Math.max(0, before - WATER_DROWN_HP);
    const dealt = before - remaining;
    p.hp = remaining;
    if (dealt > 0) {
      state.fxHits = [...(state.fxHits ?? []), { id: p.id, fatal: remaining <= 0, dealt }];
    }
    if (remaining <= 0) {
      state.pieces = state.pieces.filter((x) => x.id !== p.id);
      const lost = state.casualties[p.side] ?? 0;
      state.casualties = { ...state.casualties, [p.side]: lost + 1 };
      state.log.push(`${unitLog(p)} drowns`);
    } else {
      state.log.push(`${unitLog(p)} drowns — ${WATER_DROWN_HP} HP (${remaining} HP)`);
    }
  }
}

function applyTurnLimit(state: GameState): void {
  if (state.winner || !timedOut(state)) return;
  const parts = participatingSides(state);
  const start = state.startingSide ?? 'red';
  const foe =
    parts.find((s) => !sameTeam(state, s, start) && !sideDefeated(state, s)) ??
    parts.find((s) => !sameTeam(state, s, start));
  if (foe) state.winner = foe;
}

/** Match start / after the turn flag flips onto `state.turn`. */
export function beginSideTurn(state: GameState, newRound = false, _kickoff = false): void {
  if (newRound) state.turnNumber += 1;
  applyTurnLimit(state);
  if (state.winner) return;
  const queued = state.pendingStaminaFx?.[state.turn] ?? [];
  if (queued.length) {
    const seen = new Set(
      (state.fxStamina ?? []).filter((x) => x.kind === 'gain').map((x) => x.id),
    );
    const extra = queued
      .filter((id) => !seen.has(id))
      .map((id) => ({ id, kind: 'gain' as const }));
    state.fxStamina = [...(state.fxStamina ?? []), ...extra];
    state.pendingStaminaFx = {
      ...state.pendingStaminaFx,
      [state.turn]: [],
    };
  }
  applyWaterUpkeep(state, state.turn);
  if (state.fxStamina?.length) {
    const live = new Set(state.pieces.map((p) => p.id));
    state.fxStamina = state.fxStamina.filter((x) => live.has(x.id));
    if (!state.fxStamina.length) state.fxStamina = undefined;
  }
  checkWin(state);
}

function endSideTurn(state: GameState): void {
  const finished = state.turn;
  clearScoutLock(state);
  tickShootCooldowns(state, finished);
  tickStamina(state, finished);
  state.actedIds = [];
  const next = nextLivingSide(state, finished);
  const start = state.startingSide ?? 'red';
  const n = SIDES.length;
  const fi = SIDES.indexOf(finished);
  let newRound = next === start;
  if (!newRound) {
    for (let i = 1; i <= n; i++) {
      const s = SIDES[(fi + i) % n];
      if (s === start) {
        newRound = true;
        break;
      }
      if (s === next) break;
    }
  }
  state.turn = next;
  beginSideTurn(state, newRound);
}

/** Finish this piece's activation; end the side-turn if the unit quota is spent. */
function finishActivation(state: GameState, piece: Piece): void {
  piece.rangedHit = undefined;
  clearScoutLock(state);
  if (!state.actedIds.includes(piece.id)) state.actedIds.push(piece.id);
  const cap = clampUnitsPerTurn(state.unitsPerTurn);
  const more =
    state.actedIds.length < cap &&
    state.pieces.some((p) => p.side === state.turn && !state.actedIds.includes(p.id));
  if (!more) endSideTurn(state);
  checkWin(state);
}

function sideDefeated(state: GameState, side: Side): boolean {
  const mine = state.pieces.filter((p) => p.side === side);
  if (mine.length === 0) return true;
  if (state.hadKing[side] && !hasGeneral(mine, side)) return true;
  return false;
}

/** Why the loser is out: no pieces left, their fielded king was killed, or the turn cap. */
export function defeatKind(
  state: GameState,
  loser: Side,
): 'wipeout' | 'king' | 'turns' {
  if (timedOut(state)) return 'turns';
  if (!state.pieces.some((p) => p.side === loser)) return 'wipeout';
  return 'king';
}

function checkWin(state: GameState): void {
  flushLastHiddenArmies(state);
  const parts = participatingSides(state);
  if (parts.length < 2) return;
  const teams = new Set(parts.map((s) => coalition(state, s)));
  if (teams.size < 2) return;
  const live = parts.filter((s) => !sideDefeated(state, s));
  if (live.length === 0) {
    state.winner = state.turn;
    return;
  }
  const liveTeams = new Set(live.map((s) => coalition(state, s)));
  if (liveTeams.size === 1) {
    state.winner = live[0];
    return;
  }
  const holder = parts.find((s) => teamHoldsAllFlags(state, s));
  if (holder) state.winner = holder;
}

function afterAction(
  state: GameState,
  piece: Piece,
  kind: 'move' | 'shoot' | 'rotate',
  enteredWater = false,
): void {
  markActed(piece);

  // Stepping into water from land ends momentum. Already-wet is a normal activation
  // — the turn-start swim cost is a pool penalty, not staminaUsedThisTurn.
  if (kind === 'move' && enteredWater) {
    finishActivation(state, piece);
    return;
  }

  if (state.staminaBonus && state.scoutPieceId === piece.id) {
    if (!piece.staminaUsedThisTurn) spendStamina(piece);
    finishActivation(state, piece);
    return;
  }

  const leftover = leftoverActionPoints(state, piece);
  if (leftover > 0) {
    state.scoutPieceId = piece.id;
    state.scoutActionsLeft = leftover;
    state.staminaBonus = false;
    checkWin(state);
    return;
  }

  // Unused stamina after every action point is spent buys one extra action.
  if (
    (kind === 'move' || kind === 'rotate') &&
    !piece.staminaUsedThisTurn &&
    canSpendStamina(piece)
  ) {
    state.scoutPieceId = piece.id;
    state.scoutActionsLeft = 1;
    state.staminaBonus = true;
    checkWin(state);
    return;
  }

  finishActivation(state, piece);
}

/** Occupancy as if `piece` already stands on `from` (start hex vacated). */
function occupantAt(
  state: GameState,
  piece: Piece,
  from: Hex,
  h: Hex,
): Piece | undefined {
  if (eq(h, from)) return undefined;
  const occ = pieceAt(state, h);
  if (!occ || occ.id === piece.id) return undefined;
  if (isConcealedFrom(state, occ, piece.side)) return undefined;
  return occ;
}

/** Path rules for a piece (shared by highlights + charge resolution). */
function movePathOpts(
  state: GameState,
  piece: Piece,
  from: Hex = { col: piece.col, row: piece.row },
): Omit<PathOpts, 'maxDist'> {
  const stats = statsOf(piece.type);
  return {
    cols: state.cols,
    rows: state.rows,
    orientation: state.orientation,
    canStop: (h: Hex) => {
      if (!inBounds(state, h)) return false;
      const t = terrainAt(state, h);
      if (isWall(state, h)) return false;
      if (t === 'water' && !stats.passWater) return false;
      if (terrainHeight(t) > stats.climbLevel) return false;
      const occ = occupantAt(state, piece, from, h);
      if (isPalisade(state, h)) {
        if (occ) {
          return isHostile(state, occ.side, piece.side) && stats.meleeDamage > 0;
        }
        return stats.meleeDamage > 0;
      }
      if (!occ) return true;
      // Occupied dest is melee — 0 melee dmg cannot bump an enemy hex.
      return isHostile(state, occ.side, piece.side) && stats.meleeDamage > 0;
    },
    canPass: (h: Hex) => {
      if (!inBounds(state, h)) return false;
      const t = terrainAt(state, h);
      if (isWall(state, h)) return false;
      if (isPalisade(state, h)) {
        return stats.meleeDamage > 0 && palisadeHpAt(state, h) <= 1;
      }
      if (isForest(state, h) && stats.charge > 0) return false;
      if (t === 'water') return false;
      if (terrainHeight(t) > stats.climbLevel) return false;
      if (stats.passUnits) return true;
      const occ = occupantAt(state, piece, from, h);
      if (!occ) return true;
      // Charge may path onto/past a blocker (like a palisade). Occupied dest
      // behind only resolves if this charge would kill them; empty dest trampling
      // still goes through survivors. previewMove is the gate.
      if (stats.charge > 0 && isHostile(state, occ.side, piece.side)) return true;
      return sameTeam(state, occ.side, piece.side);
    },
  };
}

/** Height only changes by 1 per step. Climbing needs stamina. */
function canWalkStep(
  state: GameState,
  piece: Piece,
  origin: Hex,
  fromHex: Hex,
  toHex: Hex,
): boolean {
  const stats = statsOf(piece.type);
  const t = terrainAt(state, toHex);
  if (isWall(state, toHex)) return false;
  if (isPalisade(state, toHex)) return stats.meleeDamage > 0;
  if (t === 'water' && !stats.passWater) return false;
  const fh = hexHeight(state, fromHex);
  const th = hexHeight(state, toHex);
  if (th > stats.climbLevel) return false;
  if (Math.abs(th - fh) > 1) return false;
  if (th > hexHeight(state, origin) && !canSpendStamina(piece)) return false;
  return true;
}

function pathClimbs(state: GameState, from: Hex, dest: Hex, path: Hex[]): boolean {
  const startH = hexHeight(state, from);
  if (hexHeight(state, dest) > startH) return true;
  return path.some((p) => hexHeight(state, p) > startH);
}

function pathEntersWater(state: GameState, from: Hex, dest: Hex, path: Hex[]): boolean {
  if (terrainAt(state, from) === 'water') return false;
  if (terrainAt(state, dest) === 'water') return true;
  return path.some((p) => terrainAt(state, p) === 'water');
}

function pathSpendsStamina(state: GameState, from: Hex, dest: Hex, path: Hex[]): boolean {
  return pathClimbs(state, from, dest, path);
}

/** Climb or entering water: no extra stamina action / two-action chain through that hex. */
function pathHaltsExtra(state: GameState, from: Hex, dest: Hex, path: Hex[]): boolean {
  return pathSpendsStamina(state, from, dest, path) || pathEntersWater(state, from, dest, path);
}

/** Action points still available this activation, including the one about to be spent. */
function remainingActionPoints(state: GameState, piece: Piece): number {
  const stats = statsOf(piece.type);
  if (state.staminaBonus && state.scoutPieceId === piece.id) return 0;
  if (state.scoutPieceId === piece.id) return Math.max(1, state.scoutActionsLeft ?? 1);
  return Math.max(1, stats.actions);
}

/** Action points left after the action about to resolve. */
function leftoverActionPoints(state: GameState, piece: Piece): number {
  return Math.max(0, remainingActionPoints(state, piece) - 1);
}

function extraMoveAction(state: GameState, piece: Piece): boolean {
  return (
    canSpendStamina(piece) &&
    !state.staminaBonus &&
    remainingActionPoints(state, piece) <= 1
  );
}

type StraightStop = { dist: number; path: Hex[]; via: Hex | null; firstDist: number };

/** Legal stop-hexes along the six hex axes, with the line walked to each. */
function straightMoveStops(
  state: GameState,
  piece: Piece,
  from: Hex = { col: piece.col, row: piece.row },
  range = activationMoveRange(state, piece),
): Map<string, StraightStop> {
  const opts = movePathOpts(state, piece, from);
  const out = new Map<string, StraightStop>();
  if (range <= 0) return out;
  const blocked = blockedWalkDirs(piece);
  for (let d = 0; d < 6; d++) {
    if (blocked.has(d as HexDir)) continue;
    const path: Hex[] = [];
    let cur = from;
    for (let dist = 1; dist <= range; dist++) {
      const next = neighborInDir(cur, d as HexDir, state.orientation);
      if (!inBounds(state, next)) break;
      if (!canWalkStep(state, piece, from, cur, next)) break;
      const stop = opts.canStop(next);
      const pass = opts.canPass(next);
      if (!stop && !pass) break;
      path.push(next);
      if (stop) out.set(key(next), { dist, path: path.slice(), via: null, firstDist: dist });
      if (!pass) break;
      cur = next;
    }
  }
  return out;
}

/**
 * Same-direction stamina run: firstRange + extra `move` as one ray.
 * Via need not be a stop — pass through units if you don't turn.
 */
function straightExtraStops(
  state: GameState,
  piece: Piece,
  first: Map<string, StraightStop>,
): Map<string, StraightStop> {
  const start = { col: piece.col, row: piece.row };
  const firstRange = activationMoveRange(state, piece);
  const extraMove = statsOf(piece.type).move;
  const max = firstRange + extraMove + 2;
  const opts = movePathOpts(state, piece, start);
  const out = new Map<string, StraightStop>();
  if (firstRange <= 0 || extraMove <= 0) return out;
  const blocked = blockedWalkDirs(piece);
  for (let d = 0; d < 6; d++) {
    if (blocked.has(d as HexDir)) continue;
    const path: Hex[] = [];
    let cur = start;
    let via: Hex | null = null;
    let firstClimb = false;
    for (let dist = 1; dist <= max; dist++) {
      const next = neighborInDir(cur, d as HexDir, state.orientation);
      if (!inBounds(state, next)) break;
      if (!canWalkStep(state, piece, start, cur, next)) break;
      const stop = opts.canStop(next);
      const pass = opts.canPass(next);
      if (!stop && !pass) break;
      path.push(next);
      if (dist === firstRange) {
        via = next;
        firstClimb = pathHaltsExtra(state, start, via, path.slice());
      }
      if (stop && dist > firstRange && via && !firstClimb && !first.has(key(next))) {
        if (dist <= firstRange + moveRangeAt(state, piece, via)) {
          out.set(key(next), {
            dist,
            path: path.slice(),
            via,
            firstDist: firstRange,
          });
        }
      }
      if (!pass) break;
      cur = next;
    }
  }
  return out;
}

/**
 * Second straight-line action after a non-climb stop. First-action dests win.
 * Prefers a longer first leg so leftover steps of action 1 are not "spent" later.
 * Turning cannot use an occupied hex as the waypoint.
 */
function twoActionStops(
  state: GameState,
  piece: Piece,
  first: Map<string, StraightStop>,
): Map<string, StraightStop> {
  const start = { col: piece.col, row: piece.row };
  const startKey = key(start);
  const out = new Map<string, StraightStop>();
  if (statsOf(piece.type).move <= 0) return out;
  for (const [, a] of first) {
    const via = a.path[a.path.length - 1];
    if (!via) continue;
    if (pieceAt(state, via)) continue;
    if (palisadeHpAt(state, via) > 1) continue;
    if (pathHaltsExtra(state, start, via, a.path)) continue;
    const second = straightMoveStops(state, piece, via, moveRangeAt(state, piece, via));
    for (const [dk, b] of second) {
      if (dk === startKey || first.has(dk)) continue;
      const dist = a.dist + b.dist;
      const prev = out.get(dk);
      if (prev && (a.dist < prev.firstDist || (a.dist === prev.firstDist && dist >= prev.dist))) {
        continue;
      }
      out.set(dk, {
        dist,
        path: [...a.path, ...b.path],
        via,
        firstDist: a.dist,
      });
    }
  }
  return out;
}

function keepBetterStop(
  out: Map<string, StraightStop>,
  k: string,
  stop: StraightStop,
): void {
  const prev = out.get(k);
  if (prev && (stop.firstDist < prev.firstDist || (stop.firstDist === prev.firstDist && stop.dist >= prev.dist))) {
    return;
  }
  out.set(k, stop);
}

function allMoveStops(state: GameState, piece: Piece): Map<string, StraightStop> {
  const first = straightMoveStops(state, piece);
  if (!extraMoveAction(state, piece)) return first;
  const out = new Map(first);
  for (const [k, stop] of straightExtraStops(state, piece, first)) keepBetterStop(out, k, stop);
  for (const [k, stop] of twoActionStops(state, piece, first)) keepBetterStop(out, k, stop);
  const start = { col: piece.col, row: piece.row };
  for (const k of [...out.keys()]) {
    if (isBlockedFaceRay(piece, start, parseKey(k), state.orientation)) out.delete(k);
  }
  return out;
}

/** Move/shoot range for a piece (ignores whose turn it is). */
export function rangeHighlights(state: GameState, pieceId: string): Highlight[] {
  const piece = getPiece(state, pieceId);
  if (!piece) return [];

  const stats = statsOf(piece.type);
  const from: Hex = { col: piece.col, row: piece.row };
  const out: Highlight[] = [];

  const fromTerrain = terrainAt(state, from);
  const reach = allMoveStops(state, piece);
  const stamAction = state.staminaBonus && state.scoutPieceId === piece.id;

  for (const [k, { dist, path, via }] of reach) {
    const h = parseKey(k);
    const climbs = pathSpendsStamina(state, from, h, path);
    if (climbs || stamAction || via) {
      out.push({ kind: 'stamina', hex: h, cost: dist });
    } else {
      out.push({ kind: 'move', hex: h, cost: dist });
    }
  }

  if (staminaMax(piece) > 0 && staminaLeft(piece) <= 0) {
    const fresh: Piece = {
      ...piece,
      stamina: Math.max(1, staminaMax(piece)),
      staminaUsedThisTurn: false,
    };
    for (const [k, { dist }] of allMoveStops(state, fresh)) {
      if (reach.has(k)) continue;
      out.push({ kind: 'rest', hex: parseKey(k), cost: dist });
    }
  }

  // Shoot — show full LOS range; only enemy (or splash aim) is actionable
  if (
    stats.shoot <= 0 ||
    isReloading(piece) ||
    isDepleted(piece) ||
    fromTerrain === 'water'
  ) {
    return out; // move highlights only while reloading / empty / in water / no gun
  }

  const shootRange = stats.shoot + terrainHeight(fromTerrain);
  const shootMin = stats.shootMin;
  const splash = hasSplash(stats);

  for (let row = 0; row < state.rows; row++) {
    for (let col = 0; col < state.cols; col++) {
      const h = { col, row };
      if (eq(h, from)) continue;
      if (isBlockedShootRay(piece, from, h, state.orientation)) continue;
      const d = hexDist(state, from, h);
      if (d < shootMin || d + highTargetTax(state, h) > shootRange) continue;
      const terrain = terrainAt(state, h);
      if (terrain === 'rock' && !isWall(state, h)) continue; // can't shoot into rock
      // Walls / palisades: only rockets can impact (to demolish); bullets treat like blocked aim
      if (isBlockedWalk(state, h) && !splash) continue;
      // Splash (bazooka/tank) can't impact on water — except cover sitting on it
      if (splash && terrain === 'water' && !isBlockedWalk(state, h)) continue;
      if (!losClear(state, from, h, stats.shootArc === 'arch', piece.side)) continue;

      const rawTarget = pieceAt(state, h);
      const target =
        rawTarget && isConcealedFrom(state, rawTarget, piece.side)
          ? undefined
          : rawTarget;
      // Never highlight friendly-occupied tiles as shoot range
      if (target && sameTeam(state, target.side, piece.side)) continue;

      if (splash) {
        // Actionable if blast hits an enemy or a concrete wall
        if (splashHasTarget(state, h, from, piece.side)) {
          out.push({ kind: 'shoot', hex: h });
        } else {
          out.push({ kind: 'shoot-range', hex: h });
        }
      } else if (target && isHostile(state, target.side, piece.side)) {
        out.push({ kind: 'shoot', hex: h });
      } else {
        // Visible range only — no thin-air shots for bullets
        out.push({ kind: 'shoot-range', hex: h });
      }
    }
  }

  return out;
}

/** Legal actions for the current turn's piece. */
export function legalHighlights(state: GameState, pieceId: string): Highlight[] {
  if (state.winner) return [];
  const piece = getPiece(state, pieceId);
  if (!piece || piece.side !== state.turn) return [];
  if (state.scoutPieceId && state.scoutPieceId !== pieceId) return [];
  if (hasActed(state, pieceId)) return [];
  if (
    !state.scoutPieceId &&
    state.actedIds.length >= clampUnitsPerTurn(state.unitsPerTurn)
  ) {
    return [];
  }
  return rangeHighlights(state, pieceId);
}

/**
 * Spend one action to face `dir`. Legal whenever the piece can still act
 * (including a leftover scout / stamina-bonus action). Unused stamina still
 * buys the extra move. Not idle — no regen.
 */
export function rotatePiece(state: GameState, pieceId: string, dir: HexDir): GameState {
  if (state.winner) return state;
  if (!isHexDir(dir)) return state;
  const next = cloneState(state);
  next.fxHits = [];
  next.fxStamina = [];
  next.fxBoard = undefined;
  const piece = getPiece(next, pieceId);
  if (!piece || piece.side !== next.turn) return state;
  if (!statsOf(piece.type).hexArmor) return state;
  if (hasActed(next, piece.id)) return state;
  if (next.scoutPieceId && next.scoutPieceId !== piece.id) return state;
  const prevCovered = hexDamageCoveredKeys(next, piece);
  piece.facing = dir;
  next.log.push(`${unitLog(piece)} turns`);
  applyHexDamagePush(next, piece, prevCovered);
  afterAction(next, piece, 'rotate');
  return resolveNoMoves(next);
}

/**
 * Park this piece: checkmark, spends a units/turn slot, still idle for regen.
 * Illegal after a walk (Rest is for units that haven't moved).
 */
export function restPiece(state: GameState, pieceId: string): GameState {
  if (state.winner) return state;
  const next = cloneState(state);
  next.fxHits = [];
  next.fxStamina = [];
  next.fxBoard = undefined;
  const piece = getPiece(next, pieceId);
  if (!piece || piece.side !== next.turn) return state;
  if (piece.movedThisTurn) return state;
  if (hasActed(next, piece.id)) return state;
  if (next.scoutPieceId && next.scoutPieceId !== piece.id) return state;
  next.log.push(`${unitLog(piece)} rests`);
  finishActivation(next, piece);
  return resolveNoMoves(next);
}

/** End the current side-turn (skip leftover units / scout lock). */
export function passTurn(state: GameState, keepFx = false): GameState {
  const next = cloneState(state);
  if (!keepFx) {
    next.fxHits = [];
    next.fxStamina = [];
    next.fxBoard = undefined;
  }
  if (next.winner) return next;
  next.log.push(sideLog(next.turn, 'End turn'));
  endSideTurn(next);
  checkWin(next);
  return next;
}

/** If the side to move has nothing to do (or a dangling scout lock), pass. */
export function resolveNoMoves(state: GameState): GameState {
  let s = state;
  let guard = 0;
  while (!s.winner && guard < 12) {
    if (s.scoutPieceId && !getPiece(s, s.scoutPieceId)) {
      s = passTurn(s, true);
      guard += 1;
      continue;
    }
    if (allLegalActions(s).length > 0) break;
    s = passTurn(s, true);
    guard += 1;
  }
  return s;
}

export function applyAction(state: GameState, action: Action): GameState {
  const applied = applyActionInner(state, action);
  if (applied === state) return state;
  return resolveNoMoves(applied);
}

function applyActionInner(state: GameState, action: Action): GameState {
  if (action.kind === 'rotate') return rotatePiece(state, action.pieceId, action.dir);
  if (action.kind === 'rest') return restPiece(state, action.pieceId);

  const next = cloneState(state);
  next.fxHits = [];
  next.fxStamina = [];
  next.fxBoard = undefined;
  if (next.winner) return next;

  if (action.kind === 'skip') {
    if (next.scoutPieceId) {
      const scout = getPiece(next, next.scoutPieceId);
      next.log.push(
        `${scout ? unitLog(scout) : sideLog(next.turn, 'Scout')} skips ${
          next.staminaBonus ? 'second action' : 'remaining action'
        }`,
      );
      if (scout) finishActivation(next, scout);
      else {
        clearScoutLock(next);
        checkWin(next);
      }
    }
    return next;
  }

  const piece = getPiece(next, action.pieceId);
  if (!piece || piece.side !== next.turn) return state;
  if (next.scoutPieceId && next.scoutPieceId !== piece.id) return state;
  if (hasActed(next, piece.id)) return state;

  const highlights = legalHighlights(next, piece.id);

  if (action.kind === 'move') {
    const hit = highlights.find(
      (h) => (h.kind === 'move' || h.kind === 'stamina') && eq(h.hex, action.to),
    );
    if (!hit || (hit.kind !== 'move' && hit.kind !== 'stamina')) return state;

    reveal(piece);
    const plan = previewMove(next, piece, action.to, action.path);
    const hitBits: string[] = [];
    const dmgLines: string[] = [];
    for (const mh of plan.hits) {
      const victim = getPiece(next, mh.id);
      if (!victim) continue;
      applyDamage(next, victim, mh.amount, 1, mh.from);
      hitBits.push(hpBit(victim, mh.fatal, mh.remaining, mh.routed));
      dmgLines.push(dmgLine(next, victim, mh.amount, 1, mh.from));
    }

    for (const ph of plan.palisadeHits) {
      const tok = tokenAt(next.tokens, ph.hex);
      if (!tok || !isPalisadeToken(tok.type)) continue;
      if (ph.destroyed) {
        next.tokens = next.tokens.filter(
          (t) =>
            !(isPalisadeToken(t.type) && t.col === ph.hex.col && t.row === ph.hex.row),
        );
        hitBits.push(tok.type);
      } else {
        tok.hp = ph.remaining;
        hitBits.push(`${tok.type} (${ph.remaining} left)`);
      }
    }

    const bounced = !eq(plan.stop, action.to);
    const staminaTag = hit.kind === 'stamina' ? ' (stamina)' : '';
    const brokePal =
      plan.palisadeHits.some((p) => p.destroyed) && plan.hits.length === 0;
    if (hitBits.length) {
      next.log.push(
        `${unitLog(piece)} ${
          bounced
            ? 'strikes'
            : brokePal
              ? 'breaks'
              : plan.hits.some((h) => h.routed)
                ? 'routs'
                : plan.hits.some((h) => h.fatal)
                  ? 'captures'
                  : statsOf(piece.type).charge > 0
                    ? 'charges'
                    : 'hits'
        } ${hitBits.join(', ')}` +
          (bounced
            ? ` — stops ${plan.stop.col},${plan.stop.row}`
            : ` → ${action.to.col},${action.to.row}`) +
          staminaTag +
          dmgLines.join(''),
      );
    } else if (bounced) {
      next.log.push(
        `${unitLog(piece)} stops short of ${action.to.col},${action.to.row}${staminaTag}`,
      );
    } else {
      next.log.push(
        `${unitLog(piece)} moves to ${action.to.col},${action.to.row}${staminaTag}`,
      );
    }

    const fromHex = { col: piece.col, row: piece.row };
    const prevCovered = hexDamageCoveredKeys(next, piece);
    const walkPath = resolveMovePath(next, piece, action.to, action.path);
    const enteredWater = !inWater(next, fromHex) && inWater(next, plan.stop);
    const taken = next.pieces.some(
      (p) => p.id !== piece.id && p.col === plan.stop.col && p.row === plan.stop.row,
    );
    const palStanding = isPalisadeToken(tokenAt(next.tokens, plan.stop)?.type);
    if (!taken && !palStanding) {
      piece.col = plan.stop.col;
      piece.row = plan.stop.row;
      applyWalkTokens(next, piece, fromHex, walkPath, plan.stop);
    }
    piece.facing = plan.facing;
    if (getPiece(next, piece.id)) applyHexDamagePush(next, piece, prevCovered);
    if (hit.kind === 'stamina') spendStamina(piece);
    markMoved(piece);
    if (statsOf(piece.type).moveBudget > 0) {
      next.scoutMoveSpent = (next.scoutMoveSpent ?? 0) + hit.cost;
    }

    afterAction(next, piece, 'move', enteredWater);
    return next;
  }

  // shoot
  const shootOk = highlights.some((h) => h.kind === 'shoot' && eq(h.hex, action.at));
  if (!shootOk) return state;

  const stats = statsOf(piece.type);
  reveal(piece);
  if (stats.ammo > 0) {
    piece.ammo = Math.max(0, (piece.ammo ?? stats.ammo) - 1);
  }
  if (stats.shootCooldown > 0) {
    piece.shootCooldown = stats.shootCooldown;
    piece.firedThisTurn = true;
  }

  if (hasSplash(stats)) {
    const fromHex: Hex = { col: piece.col, row: piece.row };
    const blast = splashBlast(next, action.at, fromHex);
    const hitBits: string[] = [];
    const dmgLines: string[] = [];
    for (const h of blast) {
      if (isForest(next, h)) {
        const chip = chipForestAt(next, h);
        if (chip) {
          hitBits.push(
            chip.remaining > 0 ? `forest (${chip.remaining} left)` : 'forest',
          );
        }
        continue;
      }
      const t = pieceAt(next, h);
      // Splash hits everyone in the blast — friendlies included
      if (t && stats.splashDamage > 0) {
        const origin = eq(h, action.at) ? fromHex : action.at;
        const dmg = applyDamage(next, t, stats.splashDamage, 0, origin, true);
        hitBits.push(hpBit(t, dmg.fatal, dmg.remaining, dmg.routed));
        dmgLines.push(dmgLine(next, t, stats.splashDamage, 0, origin, true));
      }
      // Concrete walls and palisades crumble under rockets; the tile underneath stays
      if (isBlockedWalk(next, h)) {
        const tok = tokenAt(next.tokens, h);
        const kind = tok?.type ?? (isPalisade(next, h) ? 'palisade' : 'wall');
        if (terrainAt(next, h) === 'wall') next.terrain[h.row][h.col] = 'land';
        next.tokens = next.tokens.filter(
          (item) =>
            !(
              (isWallToken(item.type) || isPalisadeToken(item.type)) &&
              item.col === h.col &&
              item.row === h.row
            ),
        );
        hitBits.push(kind);
      }
    }
    next.log.push(
      `${unitLog(piece)} fires at ${action.at.col},${action.at.row}` +
        (hitBits.length ? ` — hits ${hitBits.join(' + ')}` : ' — splash misses') +
        (stats.shootCooldown > 0 ? ' — reloading' : '') +
        ammoLog(piece, stats) +
        dmgLines.join(''),
    );
  } else {
    const t = pieceAt(next, action.at);
    if (!t || sameTeam(next, t.side, piece.side)) return state;
    const fromHex: Hex = { col: piece.col, row: piece.row };
    if (isForest(next, action.at)) {
      const chip = chipForestAt(next, action.at);
      const cover =
        chip && chip.remaining > 0
          ? `forest (${chip.remaining} left)`
          : 'forest felled';
      next.log.push(
        `${unitLog(piece)} shoots into ${cover} at ${action.at.col},${action.at.row}` +
          ` — ${unitLog(t)} unharmed` +
          (stats.shootCooldown > 0 ? ' — reloading' : '') +
          ammoLog(piece, stats),
      );
      afterAction(next, piece, 'shoot');
      return next;
    }
    const dmg = applyDamage(next, t, stats.shootDamage, 0, fromHex, true);
    next.log.push(
      `${unitLog(piece)} shoots ${unitLog(t)} at ${action.at.col},${action.at.row}` +
        (dmg.routed ? ' — routed' : dmg.fatal ? ' — killed' : ` — ${dmg.remaining} HP`) +
        (stats.shootCooldown > 0 ? ' — reloading' : '') +
        ammoLog(piece, stats) +
        dmgLine(next, t, stats.shootDamage, 0, fromHex, true),
    );
  }

  afterAction(next, piece, 'shoot');
  return next;
}

/** All legal actions for the current side (for AI). */
export function allLegalActions(state: GameState): Action[] {
  if (state.winner) return [];
  const actions: Action[] = [];
  const pieces =
    state.scoutPieceId
      ? state.pieces.filter((p) => p.id === state.scoutPieceId)
      : state.pieces.filter((p) => p.side === state.turn && !hasActed(state, p.id));

  for (const p of pieces) {
    for (const h of legalHighlights(state, p.id)) {
      if (h.kind === 'move' || h.kind === 'stamina') {
        actions.push({
          kind: 'move',
          pieceId: p.id,
          to: h.hex,
        });
      } else if (h.kind === 'shoot') {
        actions.push({ kind: 'shoot', pieceId: p.id, at: h.hex });
      }
      // shoot-range / rest are display-only
    }
    if (statsOf(p.type).hexArmor) {
      const cur = facingOf(p);
      for (let d = 0; d < 6; d++) {
        if (d === cur) continue;
        actions.push({ kind: 'rotate', pieceId: p.id, dir: d as HexDir });
      }
    }
  }
  if (state.scoutPieceId && state.scoutActionsLeft) {
    actions.push({ kind: 'skip' });
  }
  return actions;
}
