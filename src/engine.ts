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
  type ShootArc,
  type UnitStats,
  type UnitType,
} from './roster';
import type { AbilityId, BuildStructure } from './abilities';
import { isBuildStructure } from './abilities';
import { generalInspiresEnabled } from './experimental';
export {
  ABILITY_BLURB,
  ABILITY_IDS,
  ABILITY_LABEL,
  BUILD_STRUCTURES,
  BUILD_STRUCTURE_BLURB,
  BUILD_STRUCTURE_LABEL,
  isAbilityId,
  isBuildStructure,
  type BuildStructure,
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
  STOCK_UNIT_CLASS,
  UNIT_CATEGORIES,
  UNIT_CATEGORY_LABEL,
  UNIT_CLASSES,
  UNIT_CLASS_LABEL,
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
  sanitizeUnitClass,
  stockMobility,
  statsOf,
  defaultSight,
  type AbilityId,
  type ClimbLevel,
  type HexArmorSide,
  type HexDamageSide,
  type ShootArc,
  type UnitCategory,
  type UnitClass,
  type UnitRole,
  type UnitStats,
  type UnitTraits,
  type UnitType,
} from './roster';

export const SIDES = ['red', 'blue', 'yellow', 'purple'] as const;
export type Side = (typeof SIDES)[number];
export const NEUTRAL = 'neutral' as const;
export type Affiliation = Side | typeof NEUTRAL;

export const SIDE_LABEL: Record<Side, string> = {
  red: 'Red',
  blue: 'Blue',
  yellow: 'Yellow',
  purple: 'Purple',
};

export function isSide(v: unknown): v is Side {
  return v === 'red' || v === 'blue' || v === 'yellow' || v === 'purple';
}

export function isNeutralSide(v: unknown): v is typeof NEUTRAL {
  return v === NEUTRAL;
}

export function isAffiliation(v: unknown): v is Affiliation {
  return isSide(v) || isNeutralSide(v);
}

export type ArmyControl = 'player' | 'ai-enemy' | 'ai-ally' | 'ai-hostile';
export const ARMY_CONTROLS: ArmyControl[] = ['player', 'ai-enemy', 'ai-ally', 'ai-hostile'];
export const ARMY_CONTROL_LABEL: Record<ArmyControl, string> = {
  player: 'player',
  'ai-enemy': 'ai enemy',
  'ai-ally': 'ai ally',
  'ai-hostile': 'ai hostile',
};

export function isArmyControl(v: unknown): v is ArmyControl {
  return v === 'player' || v === 'ai-enemy' || v === 'ai-ally' || v === 'ai-hostile';
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
  'grass',
  'bridge',
  'flag',
  'board',
  'tutorial',
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
  grass: 'Long grass',
  bridge: 'Bridge',
  flag: 'Flag',
  board: 'Board',
  tutorial: 'Tutorial',
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

/**
 * Editor click on a hex that already has a board. Board / terrain / unit brushes
 * open the message. Erase, unit-tokens, and other tile tokens still paint/stack.
 */
export function editorOpensBoardPopup(
  brush: string,
  hasBoard: boolean,
  first: boolean,
): boolean {
  if (!hasBoard || !first) return false;
  if (brush === 'board') return true;
  if (brush === 'erase' || brush === 'notouch') return false;
  if (brush.startsWith('unit:')) return false;
  if (isTokenType(brush)) return false;
  return true;
}
export const PIKE_DAMAGE = 1;
export const PALISADE_HP = 3;

/** Stackable promotions per piece (V chevrons). General is separate and does not use a slot. */
export const MAX_UNIT_PROMOTIONS = 5;
export const PROMOTION_TOKEN_TYPES = [
  'general',
  'range1',
  'defense1',
  'attack1',
  'ap1',
  'hp2',
  'allTerrain',
  'lunge',
  'inspire',
  'scout',
  'wealthy',
] as const;
export type PromotionTokenType = (typeof PROMOTION_TOKEN_TYPES)[number];

/** Status / story attachments (not promotions). */
export const STATUS_UNIT_TOKEN_TYPES = [
  'hidden',
  'exhausted',
  'neutral',
  'sleep',
  'story',
] as const;
export type StatusUnitTokenType = (typeof STATUS_UNIT_TOKEN_TYPES)[number];

/** Attachments on a piece. Ids must not collide with unit types in the editor brush. */
export const UNIT_TOKEN_TYPES = [
  ...STATUS_UNIT_TOKEN_TYPES,
  ...PROMOTION_TOKEN_TYPES,
] as const;
export type UnitTokenType = (typeof UNIT_TOKEN_TYPES)[number];
export const UNIT_TOKEN_LABEL: Record<UnitTokenType, string> = {
  general: 'General',
  hidden: 'Hidden',
  exhausted: 'Exhausted',
  neutral: 'Neutral',
  sleep: 'Sleep',
  story: 'Story',
  range1: 'Range +1',
  defense1: 'Defense +1',
  attack1: 'Attack +1',
  ap1: 'AP +1',
  hp2: 'HP +2',
  allTerrain: 'All terrain',
  lunge: 'Lunge',
  inspire: 'Inspire',
  scout: 'Scout',
  wealthy: 'Wealthy',
};

/** Editor / inspect blurbs when a promotion brush is selected. */
export const PROMOTION_TOKEN_BLURB: Record<PromotionTokenType, string> = {
  general:
    'Command piece. HP +1, AP max +1, value +1. Immune to rout. Does not use a promotion slot. When command-kill is on, losing every General ends the army.',
  range1: '+1 shoot range (shooters only). Stacks as a V chevron.',
  defense1: '+1 armor on every face / ring. Stacks as a V chevron.',
  attack1: '+1 melee, charge, shoot, and lunge damage. Stacks as a V chevron.',
  ap1: '+1 AP max, +1 AP / turn, and +1 spend cap. Stacks as a V chevron.',
  hp2: '+2 max HP. Stacks as a V chevron.',
  allTerrain:
    'Free climbs, swim without AP/HP upkeep, climb to mountain, Hide on forest. Stacks as a V chevron.',
  lunge:
    'Gain Lunge: thrust two hexes, melee both tiles. Zero-melee kits still thrust for 1 (+ Attack). Stacks as a V chevron.',
  inspire:
    'Gain Inspire: spend an action to inspire the friendly units chained to this one for 1 turn (+1 attack, +1 armor, no stacking). Stacks as a V chevron.',
  scout:
    'At battle start, place this unit anywhere it can stand, hidden. Roguelite: +2 map regenerates per Scout unit. Stacks as a V chevron.',
  wealthy:
    'Earn +1 gold at the end of a victorious battle. Stacks as a V chevron.',
};

/** Chevron / swatch fill per promotion kind. */
export const PROMOTION_TOKEN_COLOR: Record<PromotionTokenType, string> = {
  general: '#f0d060',
  range1: '#f0d060',
  defense1: '#8ab4e8',
  attack1: '#f0a070',
  ap1: '#9ad0a8',
  hp2: '#e87890',
  allTerrain: '#d0b878',
  lunge: '#c080e0',
  inspire: '#ffc857',
  scout: '#70c8c0',
  wealthy: '#e8c040',
};

/** Stackable promos only (General is unique and uses the star badge). */
export function isStackablePromotion(
  v: unknown,
): v is Exclude<PromotionTokenType, 'general'> {
  return isPromotionToken(v) && v !== 'general';
}

export const STORY_WHENS = ['kill', 'touch'] as const;
export type StoryWhen = (typeof STORY_WHENS)[number];

/** Message on a Story token. `kill` pops when the unit dies. `touch` pops on melee contact. */
export type PieceStory = {
  text: string;
  when: StoryWhen;
};

export function sanitizeStory(raw: unknown): PieceStory | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const s = raw as { text?: unknown; when?: unknown };
  const text = sanitizeBoardText(typeof s.text === 'string' ? s.text : '');
  if (!text) return undefined;
  return { text, when: s.when === 'touch' ? 'touch' : 'kill' };
}

/** Keep a valid story payload, and the story token whenever that payload exists. */
export function withStory(
  tokens: UnitTokenType[] | undefined,
  rawStory: unknown,
): { unitTokens?: UnitTokenType[]; story?: PieceStory } {
  const story = sanitizeStory(rawStory);
  let list = sanitizeUnitTokens(tokens);
  if (story && !list.includes('story')) list = [...list, 'story'];
  return { unitTokens: list.length ? list : undefined, story };
}

export function isUnitTokenType(v: unknown): v is UnitTokenType {
  return (UNIT_TOKEN_TYPES as readonly string[]).includes(v as string);
}

export function isPromotionToken(v: unknown): v is PromotionTokenType {
  return (PROMOTION_TOKEN_TYPES as readonly string[]).includes(v as string);
}

export function sanitizeUnitTokens(raw: unknown): UnitTokenType[] {
  if (!Array.isArray(raw)) return [];
  const out: UnitTokenType[] = [];
  let stackable = 0;
  for (const item of raw) {
    if (!isUnitTokenType(item)) continue;
    if (isPromotionToken(item)) {
      // General is unique and does not consume a stackable slot.
      if (item === 'general') {
        if (out.includes('general')) continue;
        out.push(item);
        continue;
      }
      if (stackable >= MAX_UNIT_PROMOTIONS) continue;
      out.push(item);
      stackable += 1;
      continue;
    }
    if (out.includes(item)) continue;
    out.push(item);
  }
  return out;
}

export function unitTokensOf(piece: { unitTokens?: UnitTokenType[] }): UnitTokenType[] {
  return piece.unitTokens ?? [];
}

export function promotionTokensOf(piece: {
  unitTokens?: UnitTokenType[];
}): PromotionTokenType[] {
  return unitTokensOf(piece).filter(isPromotionToken);
}

/** V-chevron promos only — General uses the star badge instead. */
export function chevronPromotionTokensOf(piece: {
  unitTokens?: UnitTokenType[];
}): Exclude<PromotionTokenType, 'general'>[] {
  return promotionTokensOf(piece).filter(isStackablePromotion);
}

export function countUnitToken(
  piece: { unitTokens?: UnitTokenType[] },
  id: UnitTokenType,
): number {
  let n = 0;
  for (const t of unitTokensOf(piece)) if (t === id) n += 1;
  return n;
}

export function hasUnitToken(
  piece: { unitTokens?: UnitTokenType[] },
  id: UnitTokenType,
): boolean {
  return countUnitToken(piece, id) > 0;
}

/** Base shoot + stacked Range +1 promotions. Melee (shoot 0) stays 0. */
export function shootRangeOf(piece: Piece): number {
  const base = statsOf(piece.type).shoot;
  if (base <= 0) return 0;
  return base + countUnitToken(piece, 'range1');
}

/** Inspiration bonus (+1 attack, +1 armor). Never stacks. See `refreshInspiration`. */
export const INSPIRE_BONUS = 1;

/** Stacked Defense +1 promotions + inspiration — added to every armor face / ring. */
export function armorBonusOf(piece: { unitTokens?: UnitTokenType[]; inspired?: boolean }): number {
  return countUnitToken(piece, 'defense1') + (piece.inspired ? INSPIRE_BONUS : 0);
}

/** Stacked Attack +1 promotions + inspiration — added to every outgoing damage value. */
export function attackBonusOf(piece: { unitTokens?: UnitTokenType[]; inspired?: boolean }): number {
  return countUnitToken(piece, 'attack1') + (piece.inspired ? INSPIRE_BONUS : 0);
}

/** Stacked AP +1 promotions — +1 max pool, +1 granted each turn, +1 spend cap. */
export function apBonusOf(piece: { unitTokens?: UnitTokenType[] }): number {
  return countUnitToken(piece, 'ap1');
}

/** Stacked HP +2 promotions — +2 max HP each. */
export function hpBonusOf(piece: { unitTokens?: UnitTokenType[] }): number {
  return countUnitToken(piece, 'hp2') * 2;
}

/** Turn-start AP grant, including AP +1 promotions. */
export function actionPointGainOf(piece: Piece): number {
  return Math.max(0, statsOf(piece.type).actionPointGain) + apBonusOf(piece);
}

/** All terrain promo — ignore climb / swim penalties, climb to mountain. */
export function hasAllTerrain(piece: { unitTokens?: UnitTokenType[] }): boolean {
  return hasUnitToken(piece, 'allTerrain');
}

/** Scout promo — pre-battle ambush placement (+ map regenerates in roguelite). */
export function hasScout(piece: { unitTokens?: UnitTokenType[] }): boolean {
  return hasUnitToken(piece, 'scout');
}

/** Stacked Wealthy promotions — +1 gold each after a win. */
export function wealthyBonusOf(piece: { unitTokens?: UnitTokenType[] }): number {
  return countUnitToken(piece, 'wealthy');
}

export function climbLevelOf(piece: Piece): number {
  if (hasAllTerrain(piece)) return 3;
  return Math.max(0, Math.min(3, statsOf(piece.type).climbLevel | 0));
}

export function canPassWater(piece: Piece): boolean {
  return statsOf(piece.type).passWater || hasAllTerrain(piece);
}

function withAttackBonus(
  base: number,
  piece: { unitTokens?: UnitTokenType[]; inspired?: boolean },
): number {
  const n = Math.max(0, base);
  if (n <= 0) return 0;
  return n + attackBonusOf(piece);
}

export function meleeDamageOf(piece: Piece): number {
  return withAttackBonus(statsOf(piece.type).meleeDamage, piece);
}

export function shootDamageOf(piece: Piece): number {
  return withAttackBonus(statsOf(piece.type).shootDamage, piece);
}

export function splashDamageOf(piece: Piece): number {
  return withAttackBonus(statsOf(piece.type).splashDamage, piece);
}

/** Kickoff Sleep token — no move / shoot / turn until hit. */
export function isSleeping(piece: { unitTokens?: UnitTokenType[] }): boolean {
  return hasUnitToken(piece, 'sleep');
}

/** Neutral token (or persisted side) — not in any army until someone walks onto it. */
export function stampAffiliation(p: {
  side: Affiliation;
  unitTokens?: UnitTokenType[];
}): Affiliation {
  return hasUnitToken(p, 'neutral') ? NEUTRAL : p.side;
}

function dropUnitToken(piece: Piece, id: UnitTokenType): void {
  const next = unitTokensOf(piece).filter((t) => t !== id);
  piece.unitTokens = next.length ? next : undefined;
}

export function isTokenType(v: unknown): v is TokenType {
  return (TOKEN_TYPES as readonly string[]).includes(v as string);
}

export function tokensAt(tokens: TileToken[] | undefined, h: Hex): TileToken[] {
  if (!tokens?.length) return [];
  return tokens.filter((t) => t.col === h.col && t.row === h.row);
}

export function tokenAt(tokens: TileToken[], h: Hex): TileToken | undefined {
  const all = tokensAt(tokens, h);
  return all[all.length - 1];
}

export function tokenOnHex(
  tokens: TileToken[] | undefined,
  h: Hex,
  type: TokenType,
): TileToken | undefined {
  const all = tokensAt(tokens, h);
  for (let i = all.length - 1; i >= 0; i--) {
    const t = all[i];
    if (t?.type === type) return t;
  }
  return undefined;
}

function hexToken(
  tokens: TileToken[] | undefined,
  h: Hex,
  pred: (t: TileToken) => boolean,
): TileToken | undefined {
  const all = tokensAt(tokens, h);
  for (let i = all.length - 1; i >= 0; i--) {
    const t = all[i];
    if (t && pred(t)) return t;
  }
  return undefined;
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
    if (!isSide(p.side)) continue;
    const tok = tokenOnHex(state.tokens, { col: p.col, row: p.row }, 'flag');
    if (tok) tok.owner = p.side;
  }
}

/** One of each type per hex. Paint order kept. Out of bounds / unknown types dropped. */
export function sanitizeTokens(raw: unknown, cols: number, rows: number): TileToken[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: TileToken[] = [];
  const cap = Math.max(0, cols * rows * TOKEN_TYPES.length);
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const t = item as Partial<TileToken>;
    if (!isTokenType(t.type)) continue;
    const col = Math.floor(Number(t.col));
    const row = Math.floor(Number(t.row));
    if (!Number.isFinite(col) || !Number.isFinite(row)) continue;
    if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
    const k = `${col},${row},${t.type}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const tok: TileToken = { type: t.type, col, row };
    if ((t.type === 'flag' || t.type === 'pikes') && isSide(t.owner)) tok.owner = t.owner;
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

/** Old wall terrain cells become land + a wall token. Existing tokens on the hex stay. */
export function liftWallTerrain(
  terrain: Terrain[][],
  tokens: TileToken[] = [],
): { terrain: Terrain[][]; tokens: TileToken[] } {
  const t = terrain.map((r) => [...r]);
  const out = [...tokens];
  const hasWall = new Set(
    tokens.filter((tok) => tok.type === 'wall').map((tok) => `${tok.col},${tok.row}`),
  );
  for (let row = 0; row < t.length; row++) {
    const line = t[row];
    if (!line) continue;
    for (let col = 0; col < line.length; col++) {
      if (line[col] !== 'wall') continue;
      line[col] = 'land';
      const k = `${col},${row}`;
      if (hasWall.has(k)) continue;
      hasWall.add(k);
      out.push({ type: 'wall', col, row });
    }
  }
  return { terrain: t, tokens: out };
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

/** Long grass: Hide cover like forest, but it is not wood — no shot soak, no LOS block. */
export function isGrassToken(type: TokenType | undefined): boolean {
  return type === 'grass';
}

export function isBridgeToken(type: TokenType | undefined): boolean {
  return type === 'bridge';
}

export function isWoodHpToken(type: TokenType | undefined): boolean {
  return isPalisadeToken(type) || isForestToken(type);
}

/** Wall / house token (or leftover wall terrain) — blocks walk / LOS; rockets demolish. */
export function isWall(
  state: { tokens: TileToken[]; terrain: Terrain[][] },
  h: Hex,
): boolean {
  if (hexToken(state.tokens, h, (t) => isWallToken(t.type))) return true;
  return state.terrain[h.row]?.[h.col] === 'wall';
}

export function isHouse(
  state: { tokens: TileToken[] },
  h: Hex,
): boolean {
  return !!hexToken(state.tokens, h, (t) => isHouseToken(t.type));
}

export function isPalisade(
  state: { tokens: TileToken[] },
  h: Hex,
): boolean {
  return !!hexToken(state.tokens, h, (t) => isPalisadeToken(t.type));
}

export function isForest(
  state: { tokens: TileToken[] },
  h: Hex,
): boolean {
  return !!hexToken(state.tokens, h, (t) => isForestToken(t.type));
}

export function isGrass(
  state: { tokens: TileToken[] },
  h: Hex,
): boolean {
  return !!hexToken(state.tokens, h, (t) => isGrassToken(t.type));
}

export function isBridge(
  state: { tokens: TileToken[] },
  h: Hex,
): boolean {
  return !!hexToken(state.tokens, h, (t) => isBridgeToken(t.type));
}

export function isHideToken(type: TokenType | undefined): boolean {
  return isForestToken(type) || isGrassToken(type);
}

export function isHideCover(
  state: { tokens: TileToken[] },
  h: Hex,
): boolean {
  return !!hexToken(state.tokens, h, (t) => isHideToken(t.type));
}

/** Tiles that hide a unit for Hold LOS: forest, long grass, or a house they're garrisoned in. */
export function isHideTile(
  state: { tokens: TileToken[] },
  h: Hex,
): boolean {
  return isForest(state, h) || isGrass(state, h) || isHouse(state, h);
}

/** Hidden, or taking cover in forest / long grass / house — Hold LOS contact does not fire. */
export function hidesHoldLos(state: GameState, piece: Piece): boolean {
  if (isConcealed(state, piece)) return true;
  return isHideTile(state, { col: piece.col, row: piece.row });
}

export function hasHide(piece: Piece): boolean {
  if (piece.revealed) return false;
  return hasAbility(piece, 'hide') || hasUnitToken(piece, 'hidden');
}

/** Shields cloak: invisible to hostiles until the first ranged hit that turn. */
export function shieldsConceal(
  piece: { shieldsUp?: boolean; shieldsStruck?: boolean } | null | undefined,
): boolean {
  return !!piece?.shieldsUp && !piece.shieldsStruck;
}

/** After the first shields hit — still shielded, but no longer a ranged target. */
export function shieldsBlockTargeting(
  piece: { shieldsUp?: boolean; shieldsStruck?: boolean } | null | undefined,
): boolean {
  return !!piece?.shieldsUp && !!piece.shieldsStruck;
}

/** Absorb a ranged hit on shields. First hit reveals + locks targeting; never deals damage. */
export function strikeShields(piece: Piece): boolean {
  if (!piece.shieldsUp) return false;
  piece.shieldsStruck = true;
  return true;
}

export function isConcealed(state: GameState, piece: Piece): boolean {
  if (shieldsConceal(piece)) return true;
  if (!hasHide(piece)) return false;
  if (hasUnitToken(piece, 'hidden')) return true;
  return isHideCover(state, { col: piece.col, row: piece.row });
}

export function isConcealedFrom(
  state: GameState,
  piece: Piece,
  viewer: Affiliation,
): boolean {
  if (!isConcealed(state, piece)) return false;
  return isHostile(state, piece.side, viewer);
}

export function pieceVisibleTo(
  state: GameState,
  piece: Piece,
  viewer: Affiliation,
): boolean {
  return !isConcealedFrom(state, piece, viewer);
}

export function pieceVisible(state: GameState, piece: Piece, viewers: Side[]): boolean {
  return viewers.some((v) => pieceVisibleTo(state, piece, v));
}

export function revealPiece(piece: Piece): void {
  if (hasAbility(piece, 'hide') || hasUnitToken(piece, 'hidden')) {
    piece.revealed = true;
    // The token only starts them hidden. After the break it does not keep them invisible.
    dropUnitToken(piece, 'hidden');
  }
}

/** Hide becomes valid again when the unit steps onto forest from somewhere else. */
function settleHide(state: GameState, piece: Piece, from: Hex): void {
  if (!piece.revealed || !hasAbility(piece, 'hide')) return;
  const at: Hex = { col: piece.col, row: piece.row };
  if (isHideCover(state, at) && !isHideCover(state, from)) piece.revealed = undefined;
}

function reveal(piece: Piece): void {
  revealPiece(piece);
}

/**
 * A plain walk that starts on hide cover and only ever touches hide cover (every hex
 * crossed + the stop) keeps a concealed unit hidden — and unseen by the opponent.
 * One open hex on the way, a hit, a conversion or a charge breaks it as usual.
 */
export function quietMoveOk(
  state: GameState,
  piece: Piece,
  to: Hex,
  along?: Hex[],
): boolean {
  if (!isConcealed(state, piece)) return false;
  const from: Hex = { col: piece.col, row: piece.row };
  if (!isHideCover(state, from)) return false;
  const plan = previewMove(state, piece, to, along);
  if (plan.hits.length || plan.palisadeHits.length || plan.converts.length) return false;
  if (plan.walkerDead) return false;
  const walked = walkedHexes(from, resolveMovePath(state, piece, to, along, false), plan.stop);
  return walked.length > 0 && walked.every((h) => isHideCover(state, h));
}

function noteExposedSides(state: GameState): void {
  const vis = { ...emptyHadKing(), ...(state.hadVisible ?? {}) };
  for (const p of state.pieces) {
    if (!isSide(p.side)) continue;
    if (!isConcealed(state, p)) vis[p.side] = true;
  }
  state.hadVisible = vis;
}

/**
 * Last hidden army: if a side *had* a visible piece and now only concealed
 * pieces remain, they break cover (AI also snaps to aggressive). An army that
 * started fully hidden (ambush) stays camped until it attacks or is hit.
 * If every living piece on the board is concealed, everyone unhides so a
 * human last-stand cannot stall.
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

  noteExposedSides(state);

  if (living.every((p) => isConcealed(state, p))) {
    unhide(living);
    for (const side of new Set(living.map((p) => p.side))) {
      if (isSide(side)) goAggressive(side);
    }
    return;
  }

  for (const side of participatingSides(state)) {
    const mine = living.filter((p) => p.side === side);
    if (!mine.length || !mine.every((p) => isConcealed(state, p))) continue;
    if (!state.hadVisible?.[side]) continue;
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
  return tokensAt(state.tokens, h).some(tokenIsNoTouch);
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
  return palisadeHp(hexToken(state.tokens, h, (t) => isPalisadeToken(t.type)));
}

function forestHp(tok: TileToken | undefined): number {
  if (!tok || !isForestToken(tok.type)) return 0;
  return tok.hp ?? PALISADE_HP;
}

/** Breakable wood on a hex (palisade / tree / forest). */
export function woodTokenAt(
  state: { tokens: TileToken[] },
  h: Hex,
): TileToken | undefined {
  return hexToken(state.tokens, h, (t) => isWoodHpToken(t.type));
}

export function hasBreakableWood(
  state: { tokens: TileToken[] },
  h: Hex,
): boolean {
  return !!woodTokenAt(state, h);
}

/** Obstacles the player team can break for roguelite unlocks. */
export const BREAKABLE_OBSTACLE_TYPES = [
  'palisade',
  'tree',
  'forest',
  'wall',
  'house',
  'pikes',
  'bridge',
] as const;
export type BreakableObstacleType = (typeof BREAKABLE_OBSTACLE_TYPES)[number];

export function isBreakableObstacleType(v: unknown): v is BreakableObstacleType {
  return (BREAKABLE_OBSTACLE_TYPES as readonly string[]).includes(String(v));
}

function noteObstacleBroken(state: GameState, side: string | undefined, type: string): void {
  if (!side || !isSide(side) || !type) return;
  const prev = state.brokenObstacles?.[side] ?? {};
  state.brokenObstacles = {
    ...state.brokenObstacles,
    [side]: { ...prev, [type]: (prev[type] ?? 0) + 1 },
  };
}

/** Palisade, tree, or forest. `remaining` 0 means the token is gone (forest is felled). */
function chipWoodAt(
  state: GameState,
  h: Hex,
  amount: number,
  by?: string,
): { type: TokenType; remaining: number; broken: boolean } | null {
  const tok = woodTokenAt(state, h);
  if (!tok) return null;
  const full = isForestToken(tok.type) ? forestHp(tok) : palisadeHp(tok);
  if (full <= 0) return { type: tok.type, remaining: 0, broken: false };
  const remaining = woodRemaining(full, amount);
  const type = tok.type;
  // Felled forest stays on the hex so Hide cover remains; palisade/tree still vanish.
  if (remaining <= 0 && !isForestToken(type)) {
    state.tokens = state.tokens.filter((t) => t !== tok);
  } else {
    tok.hp = remaining;
  }
  const broken = remaining <= 0;
  if (broken) noteObstacleBroken(state, by, type);
  return { type, remaining, broken };
}

/** Melee / shoot / splash amount vs wood HP (e.g. dmg 2 vs 3 HP → 1 left). */
function woodRemaining(hp: number, amount: number): number {
  return Math.max(0, hp - Math.max(0, amount));
}

/** True when this strike destroys the wood on `h` (palisade / tree). */
function breaksPalisadeAt(
  state: { tokens: TileToken[] },
  h: Hex,
  amount: number,
): boolean {
  const hp = palisadeHpAt(state, h);
  return hp > 0 && amount > 0 && woodRemaining(hp, amount) <= 0;
}

function chipForestAt(
  state: GameState,
  h: Hex,
  amount = 1,
  by?: string,
): { remaining: number; broken: boolean } | null {
  const tok = hexToken(state.tokens, h, (t) => isForestToken(t.type));
  if (!tok) return null;
  const before = forestHp(tok);
  // Already felled — no more wood soak; token stays for Hide.
  if (before <= 0) return { remaining: 0, broken: false };
  const remaining = woodRemaining(before, amount);
  tok.hp = remaining;
  const broken = remaining <= 0;
  if (broken) noteObstacleBroken(state, by, 'forest');
  return { remaining, broken };
}

/** True when forest wood still soaks shots (hp > 0). Felled forest (0) still hides. */
export function forestSoaksShot(
  state: { tokens: TileToken[] },
  h: Hex,
): boolean {
  const tok = hexToken(state.tokens, h, (t) => isForestToken(t.type));
  return !!tok && forestHp(tok) > 0;
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
  side: Affiliation;
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
  /** Remaining action points (undefined = full / `UnitStats.actionPoints`). */
  actionPoints?: number;
  /** AP already spent against this turn's spend cap. */
  apSpentThisTurn?: number;
  /** Walked this activation. */
  movedThisTurn?: boolean;
  /** Did anything this activation (move, shoot, climb). */
  actedThisTurn?: boolean;
  /** Took no action on the previous own side-turn. Rest-bonus AP grant. */
  idleLastTurn?: boolean;
  /** Cube facing (0–5). Missing → defaultFacing(side). Front follows the last walk step. */
  facing?: HexDir;
  /** Took ranged damage since last finished activation. Hold-position AI advances. */
  rangedHit?: boolean;
  /** Shields up until this side's next turn. Invisible + targetable until first ranged hit. */
  shieldsUp?: boolean;
  /** First ranged hit while shields were up this enemy period — now visible and not targetable. */
  shieldsStruck?: boolean;
  /** Inspire activated — a source until this side's next turn starts. */
  inspireUp?: boolean;
  /**
   * Derived, never set by hand: chained (same-side adjacency) to an inspiration source
   * other than itself. Rewritten from the board by `refreshInspiration` after every change.
   */
  inspired?: boolean;
  /** Hostile newly entered this piece's Sight this activation. Hold-position AI advances. */
  losHit?: boolean;
  /** Hostile piece ids this unit has already seen while holding. Missing → not scanned yet. */
  holdSawIds?: string[];
  /** Runtime ability overlay. Missing → unit stats. */
  abilities?: AbilityId[];
  /** Attachments (General, Hidden, Exhausted, Sleep, Story, promotions). Missing → none. */
  unitTokens?: UnitTokenType[];
  /** Story token copy. Ignored unless the story token is attached. */
  story?: PieceStory;
  /** Hide broken this match (moved, attacked, or was hit). */
  revealed?: boolean;
  /** Standing march. Each own turn with no other order, walk toward this hex. */
  walkTo?: Hex;
  /** This activation's march also spends AP for a second move. */
  spendMarch?: boolean;
};

/** Why a unit routed — pinch (opposite + red) vs panic (≥2 adjacent, one on red, + 3rd hit). */
export type RoutKind = 'pinched' | 'panic';

export type FxHit = {
  id: string;
  fatal: boolean;
  dealt: number;
  routed?: boolean;
  routKind?: RoutKind;
  /** Armor face/ring that applied to this hit (−2…+2). */
  armor?: number;
  /** Ranged hits always pop white; melee uses armor color when ≠ 0. */
  ranged?: boolean;
};
export type FxActionPoints = { id: string; kind: 'gain' | 'spend' };
export type FxBoard = { col: number; row: number; text: string; title?: string };

export type GameState = {
  cols: number;
  rows: number;
  orientation: HexOrientation;
  /** 0 = rectangle. Otherwise tiles from the center hex to the edge. */
  hexRadius: number;
  /** Center of a hex board. Ignored when `hexRadius` is 0. */
  hexCenter?: Hex;
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
  /** Locked piece's leftover action is a free move from stepping one level down. */
  downhillMove: boolean;
  /** One-level drops already taken whose free move is still owed. */
  downhillQueued: number;
  winner: Side | null;
  log: string[];
  /** Who drives each color. */
  controls: Record<Side, ArmyControl>;
  /** Aggressive / defensive / advance checklist for each color. Missing → aggressive. */
  aiStyles: Record<Side, AiStyle>;
  /** Snapshot at match start. King-kill win only if that side actually fielded one. */
  hadKing: Record<Side, boolean>;
  /**
   * Roguelite: player king-death does not end the match. On that side's next turn,
   * the strongest living piece inherits the General token.
   */
  generalSuccession?: boolean;
  /** True once this side has fielded a non-concealed living piece. Ambush armies stay false. */
  hadVisible: Record<Side, boolean>;
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
  /** Pieces removed per side this match, counted by unit type. Missing on old states. */
  casualtyTypes?: Partial<Record<Side, Record<string, number>>>;
  /** Kills scored by each side, keyed by the killer's unit type. */
  killByTypes?: Partial<Record<Side, Record<string, number>>>;
  /** Obstacles fully destroyed / felled this match, counted by token type per side. */
  brokenObstacles?: Partial<Record<Side, Record<string, number>>>;
  /** HP chipped per side this match (kills included). Missing on old states → 0. */
  hpLost: Record<Side, number>;
  /** Player-team flag takes this match (not kickoff seeds). */
  flagCaptures: number;
  /** One-shot drown (etc) hits for the UI to flash. Cleared after play. */
  fxHits?: FxHit[];
  /** AP grants (gold) / water-penalty spends (blue). Played at that side's turn start. */
  fxActionPoints?: FxActionPoints[];
  /** Friendly walked a message board. UI pops this then clears. */
  fxBoard?: FxBoard;
  pendingApFx?: Partial<Record<Side, string[]>>;
};

export type Action =
  | { kind: 'move'; pieceId: string; to: Hex; path?: Hex[] }
  | { kind: 'charge'; pieceId: string; to: Hex; path?: Hex[] }
  | { kind: 'lunge'; pieceId: string; to: Hex }
  | { kind: 'shoot'; pieceId: string; at: Hex }
  | { kind: 'rotate'; pieceId: string; dir: HexDir }
  | { kind: 'build'; pieceId: string; to: Hex; structure: BuildStructure }
  | { kind: 'bash'; pieceId: string }
  | { kind: 'berserk'; pieceId: string }
  | { kind: 'shields'; pieceId: string }
  | { kind: 'inspire'; pieceId: string }
  | { kind: 'reload'; pieceId: string }
  | { kind: 'skip' }; // scout skip remaining action

export type Highlight =
  | { kind: 'move'; hex: Hex; cost: number; plus?: boolean }
  /** Downhill +1, shown only. Not a destination of this action. */
  | { kind: 'plus'; hex: Hex; cost: number }
  /** Walk that spends AP (climb surcharge, or a multi-chunk / extra straight-line action). */
  | { kind: 'ap'; hex: Hex; cost: number; extra?: boolean; beyondPlus?: boolean }
  /** Would be an AP walk if more points were spendable — display only. */
  | { kind: 'apEmpty'; hex: Hex; cost: number; extra?: boolean }
  /** Crash through enemies. `extra` is past the normal move (spends 1). `unpaid` is that same tile with no AP left — display only. */
  | { kind: 'charge'; hex: Hex; cost: number; extra?: boolean; unpaid?: boolean }
  /** Lunge far hex — melee both tiles along the line. */
  | { kind: 'lunge'; hex: Hex }
  /** Valid fire target (enemy, or empty for splash). */
  | { kind: 'shoot'; hex: Hex }
  /** In weapon range + LOS, but not a legal shot (empty air / friendly). */
  | { kind: 'shoot-range'; hex: Hex }
  /** Adjacent hex Build can place on or clear. */
  | { kind: 'build'; hex: Hex };

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
  const bonus = armorBonusOf(piece);
  const side = armorSideHit(piece, from, orientation);
  if (side) return s[side] + bonus;
  return s.armor + bonus;
}

/** Effective armor on one hex face (includes Defense +1 promotions). */
export function armorFaceOf(piece: Piece, side: HexArmorSide): number {
  return statsOf(piece.type)[side] + armorBonusOf(piece);
}

/** Cube dirs of −2 hex-armor faces. Empty if hex armor is off. */
function redFaceDirs(piece: Piece): Set<HexDir> {
  const s = statsOf(piece.type);
  const blocked = new Set<HexDir>();
  if (!s.hexArmor) return blocked;
  const bonus = armorBonusOf(piece);
  const facing = facingOf(piece);
  for (let rel = 0; rel < 6; rel++) {
    if (s[HEX_ARMOR_SIDES[rel]] + bonus > -2) continue;
    blocked.add((((facing + rel) % 6) + 6) % 6 as HexDir);
  }
  return blocked;
}

/** Cube dirs a hex-armor piece cannot walk (faces at −2). */
function blockedWalkDirs(piece: Piece): Set<HexDir> {
  return redFaceDirs(piece);
}

/** Cube dirs a hex-armor piece cannot shoot (faces at −2). */
function blockedShootDirs(piece: Piece): Set<HexDir> {
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
  return withAttackBonus(s[HEX_DAMAGE_SIDES[rel]] ?? 0, piece);
}

/** Hostile hex-damage covering `hex` (sum of faces). Adjacent only. `from` is the nearest source for armor. */
export function hexDamageOn(
  state: GameState,
  hex: Hex,
  victimSide: Affiliation,
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
    const dmg = applyDamage(state, victim, f.amount, 1, from, true, false, attacker);
    const dealt = before - dmg.remaining;
    if (dealt <= 0 && !dmg.routed) continue;
    noteStrike(state, victim, before, dmg, from, true);
    state.log.push(
      dmg.routed
        ? `Facing pikes rout ${unitLog(victim)}`
        : dmg.fatal
          ? `Facing pikes kill ${unitLog(victim)}`
          : `Facing pikes hit ${unitLog(victim)} — ${dealt} HP (${dmg.remaining} HP)`,
    );
  }
}

/** Adjacent hexes painted by a hex-damage face. */
export function hexDamageMarks(state: GameState): HexDamageMark[] {
  const best = new Map<string, HexDamageMark>();
  for (const p of state.pieces) {
    if (!isSide(p.side)) continue;
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
  return (
    statsOf(piece.type).hp +
    (hasUnitToken(piece, 'general') ? 1 : 0) +
    hpBonusOf(piece)
  );
}

/** Scoring / AI weight. General token +1. */
export function combatValue(piece: Piece): number {
  return statsOf(piece.type).value + (hasUnitToken(piece, 'general') ? 1 : 0);
}

export function hpLeft(piece: Piece): number {
  return piece.hp ?? hpMax(piece);
}

export function actionPointsMax(piece: Piece): number {
  return (
    statsOf(piece.type).actionPoints +
    (hasUnitToken(piece, 'general') ? 1 : 0) +
    apBonusOf(piece)
  );
}

export function actionPointsLeft(piece: Piece): number {
  const max = actionPointsMax(piece);
  if (max <= 0) return 0;
  return piece.actionPoints ?? max;
}

/** Per-turn spend ceiling from unit stats (+ AP +1 promotions). */
export function apSpendCap(piece: Piece): number {
  return Math.max(0, statsOf(piece.type).actionPointSpendCap) + apBonusOf(piece);
}

export function apSpentThisTurnOf(piece: Piece): number {
  return Math.max(0, piece.apSpentThisTurn ?? 0);
}

/** How many AP this piece can still spend this turn (pool ∩ spend-cap). */
export function apSpendable(piece: Piece): number {
  const capLeft = Math.max(0, apSpendCap(piece) - apSpentThisTurnOf(piece));
  if (actionPointsMax(piece) <= 0) return capLeft;
  return Math.min(actionPointsLeft(piece), capLeft);
}

export function canSpendActionPoints(piece: Piece, n = 1): boolean {
  return n > 0 && apSpendable(piece) >= n;
}

/** Pool only — water upkeep. Does not touch the spend cap. */
function spendActionPointsPool(piece: Piece): void {
  const max = actionPointsMax(piece);
  if (max <= 0) return;
  piece.actionPoints = Math.max(0, actionPointsLeft(piece) - 1);
}

/** Spend against pool (if any) and the turn spend cap. */
function spendActionPoints(piece: Piece, n = 1): void {
  if (n <= 0) return;
  const max = actionPointsMax(piece);
  for (let i = 0; i < n; i++) {
    if (max > 0) {
      piece.actionPoints = Math.max(0, actionPointsLeft(piece) - 1);
    }
    piece.apSpentThisTurn = apSpentThisTurnOf(piece) + 1;
  }
}

function markActed(piece: Piece): void {
  piece.actedThisTurn = true;
}

function markMoved(piece: Piece): void {
  piece.movedThisTurn = true;
  markActed(piece);
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
  by?: Piece,
): { fatal: boolean; remaining: number; routed: boolean; routKind?: RoutKind } {
  if (isNeutralSide(victim.side)) {
    return { fatal: false, remaining: hpLeft(victim), routed: false };
  }
  const kind = routKind(state, victim, from);
  const routed = !!kind;
  const before = hpLeft(victim);
  const remaining = routed
    ? 0
    : Math.max(
        0,
        before - netDamage(victim, amount, min, from, state.orientation, ranged),
      );
  victim.hp = remaining;
  if (isSide(victim.side)) addHpLost(state, victim.side, before - remaining);
  reveal(victim);
  if (hasUnitToken(victim, 'sleep')) dropUnitToken(victim, 'sleep');
  if (markShot) victim.rangedHit = true;
  if (remaining <= 0) {
    tellStory(state, victim, 'kill');
    state.pieces = state.pieces.filter((p) => p.id !== victim.id);
    if (isSide(victim.side)) {
      const lost = state.casualties[victim.side] ?? 0;
      state.casualties = { ...state.casualties, [victim.side]: lost + 1 };
      const prev = state.casualtyTypes?.[victim.side] ?? {};
      state.casualtyTypes = {
        ...state.casualtyTypes,
        [victim.side]: { ...prev, [victim.type]: (prev[victim.type] ?? 0) + 1 },
      };
    }
    if (by && isSide(by.side) && isHostile(state, by.side, victim.side)) {
      const prevBy = state.killByTypes?.[by.side] ?? {};
      state.killByTypes = {
        ...state.killByTypes,
        [by.side]: { ...prevBy, [by.type]: (prevBy[by.type] ?? 0) + 1 },
      };
    }
    // A dead link breaks the chain at once.
    refreshInspiration(state);
    return { fatal: true, remaining: 0, routed, routKind: kind ?? undefined };
  }
  return { fatal: false, remaining, routed: false };
}

function addHpLost(state: GameState, side: Side, dealt: number): void {
  if (dealt <= 0) return;
  const cur = state.hpLost ?? emptySideCounts();
  state.hpLost = {
    ...emptySideCounts(),
    ...cur,
    [side]: (cur[side] ?? 0) + dealt,
  };
}

/**
 * Generals hold. Two paths:
 * 1) Opposite adjacent hostiles + a −2 (red) face on that axis — any hit routs
 *    (`pinched`).
 * 2) ≥2 adjacent hostiles (at least one against a −2 red face), then hit by a 3rd source (other unit / trap / water /
 *    pikes / anything whose origin is not one of those two) — `panic`.
 * Friends / terrain never pin. Attack direction alone does not invent a pincher.
 */
export function routKind(
  state: GameState,
  victim: Piece,
  from?: Hex,
): RoutKind | null {
  if (hasUnitToken(victim, 'general')) return null;
  if (isPinched(state, victim)) return 'pinched';
  if (hitByThirdWhileCrowded(state, victim, from)) return 'panic';
  return null;
}

export function wouldRout(state: GameState, victim: Piece, from?: Hex): boolean {
  return routKind(state, victim, from) != null;
}

/** Hostile pieces on the six adjacent hexes. */
export function adjacentHostiles(state: GameState, victim: Piece): Piece[] {
  const at: Hex = { col: victim.col, row: victim.row };
  const out: Piece[] = [];
  for (const h of neighbors(at, state.orientation)) {
    const p = pieceAt(state, h);
    if (!p || p.id === victim.id) continue;
    if (!isHostile(state, p.side, victim.side)) continue;
    out.push(p);
  }
  return out;
}

/** True when at least one adjacent hostile stands against a −2 (red) face. */
function hostileOnRedSide(state: GameState, victim: Piece): boolean {
  const at: Hex = { col: victim.col, row: victim.row };
  for (let d = 0; d < 6; d++) {
    const dir = d as HexDir;
    const p = pieceAt(state, neighborInDir(at, dir, state.orientation));
    if (!p || p.id === victim.id) continue;
    if (!isHostile(state, p.side, victim.side)) continue;
    if (armorOnDir(victim, dir) <= -2) return true;
  }
  return false;
}

/**
 * ≥2 adjacent hostiles (one of them on a red face) and the damage is not coming from one of those two
 * alone (ranged outsider, a third adjacent melee, trap, water, ownerless pikes).
 */
function hitByThirdWhileCrowded(
  state: GameState,
  victim: Piece,
  from?: Hex,
): boolean {
  const adj = adjacentHostiles(state, victim);
  if (adj.length < 2) return false;
  if (!hostileOnRedSide(state, victim)) return false;
  if (!from) return true;
  const source = pieceAt(state, from);
  if (!source || source.id === victim.id) return true;
  if (!isHostile(state, source.side, victim.side)) return true;
  const among = adj.some((p) => p.id === source.id);
  if (!among) return true;
  // Source is one of the adjacent hostiles — only a "3rd" if ≥3 crowd.
  return adj.length >= 3;
}

/** Two hostiles on opposite neighbors, with a −2 face on that axis. */
export function isPinched(state: GameState, victim: Piece): boolean {
  const at: Hex = { col: victim.col, row: victim.row };
  for (let d = 0; d < 3; d++) {
    const a = d as HexDir;
    const b = (((d + 3) % 6) + 6) % 6 as HexDir;
    const ha = neighborInDir(at, a, state.orientation);
    const hb = neighborInDir(at, b, state.orientation);
    const oa = pieceAt(state, ha);
    const ob = pieceAt(state, hb);
    if (!oa || !ob) continue;
    if (oa.id === victim.id || ob.id === victim.id) continue;
    if (!isHostile(state, oa.side, victim.side)) continue;
    if (!isHostile(state, ob.side, victim.side)) continue;
    if (armorOnDir(victim, a) <= -2 || armorOnDir(victim, b) <= -2) return true;
  }
  return false;
}

function armorOnDir(piece: Piece, dir: HexDir): number {
  const s = statsOf(piece.type);
  const bonus = armorBonusOf(piece);
  if (!s.hexArmor) return s.armor + bonus;
  const rel = (((dir - facingOf(piece)) % 6) + 6) % 6;
  return s[HEX_ARMOR_SIDES[rel]] + bonus;
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
  if (!isSide(piece.side)) return;
  if (tok.owner && sameTeam(state, tok.owner, piece.side)) return;
  const prev = tok.owner;
  tok.owner = piece.side;
  if (playerSides(state).some((s) => sameTeam(state, s, piece.side))) {
    state.flagCaptures = (state.flagCaptures ?? 0) + 1;
  }
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
  noteStrike(state, piece, before, dmg, hit.from, true);
  state.log.push(
    dmg.routed
      ? `Facing pikes rout ${unitLog(piece)}`
      : dmg.fatal
        ? `Facing pikes kill ${unitLog(piece)}`
        : `Facing pikes hit ${unitLog(piece)} — ${dealt} HP (${dmg.remaining} HP)`,
  );
  return dmg.fatal;
}

/** Trap tile on this hex (Build units are immune). */
function trapDamageAt(
  state: { tokens: TileToken[] },
  piece: Piece,
  hex: Hex,
): number {
  if (hasAbility(piece, 'build')) return 0;
  return tokenOnHex(state.tokens, hex, 'pikes') ? PIKE_DAMAGE : 0;
}

/**
 * Preview trap + facing-pike damage for entering `hex`.
 * Returns remaining HP (0 if dead/routed). Does not mutate.
 */
function previewEnterHazards(
  state: GameState,
  piece: Piece,
  hex: Hex,
  hp: number,
): number {
  let left = hp;
  const trap = trapDamageAt(state, piece, hex);
  if (trap > 0) {
    if (wouldRout(state, piece)) return 0;
    left -= netDamage(piece, trap, 1);
    if (left <= 0) return 0;
  }
  const face = hexDamageOn(state, hex, piece.side);
  if (face) {
    if (wouldRout(state, piece, face.from)) return 0;
    left -= netDamage(piece, face.amount, 1, face.from, state.orientation, true);
    if (left <= 0) return 0;
  }
  return left;
}

/**
 * Apply trap then facing pikes for entering `hex`.
 * True when the walker is dead/routed (and removed).
 */
function applyEnterHazards(state: GameState, piece: Piece, hex: Hex): boolean {
  if (!getPiece(state, piece.id)) return true;
  const trap = trapDamageAt(state, piece, hex);
  if (trap > 0) {
    const before = hpLeft(piece);
    const dmg = applyDamage(state, piece, trap, 1);
    const dealt = before - dmg.remaining;
    if (dealt > 0 || dmg.routed) {
      noteStrike(state, piece, before, dmg);
      state.log.push(
        dmg.routed
          ? `Pikes rout ${unitLog(piece)}`
          : dmg.fatal
            ? `Pikes kill ${unitLog(piece)}`
            : `Pikes hit ${unitLog(piece)} — ${dealt} HP (${dmg.remaining} HP)`,
      );
    }
    if (dmg.fatal) return true;
  }
  return strikeFacingPikes(state, piece, hex);
}

function pushFxCopy(state: GameState, text: string, at: Hex, title?: string): void {
  const clean = sanitizeBoardText(text);
  if (!clean) return;
  const cur = state.fxBoard;
  if (!cur) {
    state.fxBoard = { col: at.col, row: at.row, text: clean, title };
    return;
  }
  if (cur.text.split('\n\n').includes(clean)) return;
  state.fxBoard = { ...cur, text: `${cur.text}\n\n${clean}`, title: cur.title ?? title };
}

/** Story popup. `touch` is melee contact only — shots, splash, and pikes are `kill`. */
function tellStory(state: GameState, piece: Piece, when: StoryWhen): void {
  if (!hasUnitToken(piece, 'story') || !piece.story || piece.story.when !== when) return;
  pushFxCopy(state, piece.story.text, { col: piece.col, row: piece.row }, 'Story');
}

function readBoard(state: GameState, piece: Piece, tok: TileToken): void {
  if (tok.type !== 'board') return;
  if (!isSide(piece.side) || !isPlayerControlled(state, piece.side)) return;
  if (tok.read) return;
  tok.read = true;
  pushFxCopy(state, tok.text ?? '', { col: tok.col, row: tok.row });
  state.log.push(`${unitLog(piece)} reads a message board`);
}

/** Planted traps are hidden from hostile eyes. Ownerless (editor) pikes stay visible. */
export function pikesVisibleTo(
  state: GameState,
  tok: TileToken,
  viewer: Affiliation,
): boolean {
  if (tok.type !== 'pikes') return false;
  if (!tok.owner || !isSide(tok.owner)) return true;
  return sameTeam(state, tok.owner, viewer);
}

export function pikesVisible(
  state: GameState,
  tok: TileToken,
  viewers: readonly Affiliation[],
): boolean {
  return viewers.some((v) => pikesVisibleTo(state, tok, v));
}

function applyWalkTokens(
  state: GameState,
  piece: Piece,
  from: Hex,
  path: Hex[],
  stop: Hex,
  /** When set (from MovePlan), use these enter-hexes — includes a melee hex the walker dies on. */
  hazardHexes?: Hex[],
): void {
  const hexes = hazardHexes?.length ? hazardHexes : walkedHexes(from, path, stop);
  for (const h of hexes) {
    for (const tok of tokensAt(state.tokens, h)) {
      if (tok.type === 'flag') claimFlag(state, piece, tok);
      if (tok.type === 'board') readBoard(state, piece, tok);
    }
    if (applyEnterHazards(state, piece, h)) return;
  }
}

function sideLog(side: Side, label: string): string {
  return `<span class="log-side ${side}">${escLog(label)}</span>`;
}

/** Victim clause for combat logs: who died / routed / how much HP left. */
function hpBit(victim: Piece, fatal: boolean, remaining: number, routed = false): string {
  if (routed) return `${unitLog(victim)} — routed`;
  if (fatal) return `${unitLog(victim)} — killed`;
  return `${unitLog(victim)} (${remaining} HP)`;
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
  routKind?: RoutKind;
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
  /** Neutral piece ids a General claims on this walk. */
  converts: string[];
  /** Hexes entered for trap / facing-pike checks (includes a melee hex even if the walker dies there). */
  hazardHexes: Hex[];
  /** Walker died on trap / facing pikes before finishing the planned hits. */
  walkerDead?: boolean;
};

/** Open water — wet for move / upkeep / shoot. A bridge makes the hex dry. */
function inWater(state: { tokens: TileToken[]; terrain: Terrain[][] }, h: Hex): boolean {
  return terrainAt(state, h) === 'water' && !isBridge(state, h);
}

/** Move range from `at`. Water is always 1 hex. Move 0 stays planted. Height does not add steps. */
function moveRangeAt(state: GameState, piece: Piece, at: Hex): number {
  const move = statsOf(piece.type).move;
  if (move <= 0) return 0;
  if (inWater(state, at)) return 1;
  return move;
}

/** Steps still allowed this activation when Move cap is set. `null` = no cap. */
function remainingMoveBudget(state: GameState, piece: Piece): number | null {
  const cap = statsOf(piece.type).moveBudget;
  if (cap <= 0) return null;
  // Another unit's lock must not eat this piece's budget (range preview).
  if (state.scoutPieceId && state.scoutPieceId !== piece.id) return cap;
  // Count spent even before scoutPieceId is assigned (set on afterAction / march).
  return Math.max(0, cap - (state.scoutMoveSpent ?? 0));
}

function capMoveRange(state: GameState, piece: Piece, range: number): number {
  const left = remainingMoveBudget(state, piece);
  if (left === null) return range;
  return Math.min(range, left);
}

/** Extra-action range from `via` after already walking `firstDist` this click. */
function extraMoveRange(
  state: GameState,
  piece: Piece,
  via: Hex,
  firstDist: number,
): number {
  const uncapped = moveRangeAt(state, piece, via);
  const left = remainingMoveBudget(state, piece);
  if (left === null) return uncapped;
  return Math.min(uncapped, Math.max(0, left - firstDist));
}

function activationMoveRange(state: GameState, piece: Piece): number {
  const stats = statsOf(piece.type);
  if (stats.move <= 0) return 0;
  const from = { col: piece.col, row: piece.row };
  if (inWater(state, from)) return capMoveRange(state, piece, 1);
  // The downhill grant is one hex, same tile the +1 mark showed.
  if (state.downhillMove && state.scoutPieceId === piece.id) return capMoveRange(state, piece, 1);
  return capMoveRange(state, piece, stats.move);
}

function destLandsBeyond(state: GameState, piece: Piece, dest: Hex): boolean {
  const occ = pieceAt(state, dest);
  if (occ && occ.id !== piece.id) return false;
  if (isPalisade(state, dest)) return false;
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
  opts?: { charging?: boolean },
): MovePlan {
  const from: Hex = { col: piece.col, row: piece.row };
  const melee = meleeDamageOf(piece);
  const charging = !!opts?.charging;
  const abilityCharge = chargeDamageOf(piece);
  const charge = charging ? abilityCharge : 0;
  const path = resolveMovePath(state, piece, to, along, charging);
  const dest = path[path.length - 1];
  const landsBeyond = dest ? destLandsBeyond(state, piece, dest) : false;

  const hpMap = new Map(state.pieces.map((p) => [p.id, hpLeft(p)]));
  const hits: MoveHit[] = [];
  const palisadeHits: PalisadeHit[] = [];
  const converts: string[] = [];
  // Last hex this piece may occupy. Friends / living enemies are pass-through only.
  let stop = from;
  let facing = facingOf(piece);
  let prev = from;
  let walkerHp = hpLeft(piece);
  let walkerDead = false;
  const hazardHexes: Hex[] = [];

  const strike = (victim: Piece, atkFrom: Hex, amount: number): boolean => {
    if (amount <= 0) return false;
    const nextHp =
      hpOf(victim, hpMap) - netDamage(victim, amount, 1, atkFrom, state.orientation);
    const kind = routKind(state, victim, atkFrom);
    const routed = !!kind;
    const dead = routed || nextHp <= 0;
    hpMap.set(victim.id, dead ? 0 : nextHp);
    hits.push({
      id: victim.id,
      amount,
      fatal: dead,
      remaining: dead ? 0 : Math.max(0, nextHp),
      from: atkFrom,
      routed,
      routKind: kind ?? undefined,
    });
    return dead;
  };

  /** Trap / facing spears before any fight on this hex. */
  const enterHazards = (h: Hex): boolean => {
    hazardHexes.push(h);
    walkerHp = previewEnterHazards(state, piece, h, walkerHp);
    if (walkerHp > 0) return false;
    walkerDead = true;
    return true;
  };

  for (let i = 0; i < path.length; i++) {
    const h = path[i];
    const step = dirBetween(prev, h, state.orientation);
    if (step !== null) facing = step;
    const occ = pieceAt(state, h);
    if (!occ || occ.id === piece.id) {
      const pal = hexToken(state.tokens, h, (t) => isPalisadeToken(t.type));
      if (pal) {
        if (melee <= 0) break;
        // Breaking wood still means stepping onto the hex — hazards first.
        if (enterHazards(h)) break;
        const remaining = woodRemaining(palisadeHp(pal), melee);
        palisadeHits.push({ hex: h, remaining, destroyed: remaining <= 0 });
        if (remaining > 0) break;
        stop = h;
        prev = h;
        continue;
      }
      if (enterHazards(h)) {
        stop = h;
        break;
      }
      stop = h;
      prev = h;
      continue;
    }
    if (sameTeam(state, occ.side, piece.side)) {
      prev = h;
      continue;
    }
    if (isNeutralSide(occ.side)) {
      if (!canConvert(piece, occ)) break;
      if (enterHazards(h)) break;
      converts.push(occ.id);
      const isDest = i === path.length - 1;
      if (isDest) {
        stop = h;
        break;
      }
      stop = h;
      prev = h;
      continue;
    }
    const isDest = i === path.length - 1;
    const charging = charge > 0 && !isDest;
    // Entering their hex: spears / traps resolve before the hit.
    if (enterHazards(h)) break;
    // A hop (pass through, don't land) still deals charge damage.
    if (!isDest && !charging) {
      if (abilityCharge > 0) strike(occ, prev, abilityCharge);
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

  return { stop, hits, palisadeHits, facing, converts, hazardHexes, walkerDead };
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
  charging = false,
): boolean {
  const from = { col: piece.col, row: piece.row };
  if (isBlockedFaceRay(piece, from, to, state.orientation)) return false;
  if (!isStepWalk(state, from, path, to)) return false;
  const first = straightMoveStops(state, piece, undefined, undefined, charging);
  const one = first.get(key(to));
  if (one && pathsEq(one.path, path)) return true;
  if (!extraMoveAction(state, piece) || first.has(key(to))) return false;
  const planned = allMoveStops(state, piece, charging).get(key(to));
  if (planned && pathsEq(planned.path, path)) return true;
  const firstRange = activationMoveRange(state, piece);
  const blocked = blockedWalkDirs(piece);
  const via0 = path[firstRange - 1];
  const secondRange = via0
    ? extraMoveRange(state, piece, via0, firstRange)
    : capMoveRange(state, piece, statsOf(piece.type).move);
  const budgetLeft = remainingMoveBudget(state, piece);
  if (
    path.length > firstRange &&
    path.length <= firstRange + secondRange &&
    (budgetLeft === null || path.length <= budgetLeft)
  ) {
    const opts = movePathOpts(state, piece, from, charging);
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
      if (via && !pathHaltsExtra(state, piece, from, via, path.slice(0, firstRange))) return true;
    }
  }
  for (let i = 1; i < path.length; i++) {
    const via = path[i - 1];
    const a = first.get(key(via));
    if (!a || !pathsEq(a.path, path.slice(0, i))) continue;
    if (
      pieceAt(state, via) ||
      (palisadeHpAt(state, via) > 0 &&
        !breaksPalisadeAt(state, via, meleeDamageOf(piece))) ||
      pathHaltsExtra(state, piece, from, via, a.path)
    ) {
      continue;
    }
    const b = straightMoveStops(
      state,
      piece,
      via,
      extraMoveRange(state, piece, via, a.dist),
      charging,
    ).get(key(to));
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
  charging = false,
): Hex[] {
  if (drawn?.length && isLegalMovePath(state, piece, to, drawn, charging)) return drawn;
  return pathForMove(state, piece, to, charging);
}

/** Hexes walked start→to (excludes start). One or two straight-line actions. */
export function pathForMove(
  state: GameState,
  piece: Piece,
  to: Hex,
  charging = false,
): Hex[] {
  return allMoveStops(state, piece, charging).get(key(to))?.path ?? [];
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
  charging = false,
): MovePathPlan {
  const first = straightMoveStops(state, piece, undefined, undefined, charging);
  const fresh = planFromStop(allMoveStops(state, piece, charging).get(key(to)));
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
    if (!stop || pieceAt(state, via) || pathHaltsExtra(state, piece, start, via, stop.path)) continue;
    const tail = straightMoveStops(
      state,
      piece,
      via,
      extraMoveRange(state, piece, via, stop.dist),
    ).get(key(to));
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

export function terrainAt(state: { terrain: Terrain[][] }, h: Hex): Terrain {
  return state.terrain[h.row]?.[h.col] ?? 'rock';
}

function hexHeight(state: GameState, h: Hex): number {
  return terrainHeight(terrainAt(state, h));
}

function inBounds(state: GameState, h: Hex): boolean {
  if (h.col < 0 || h.row < 0 || h.col >= state.cols || h.row >= state.rows) return false;
  if (!state.hexRadius || !state.hexCenter) return true;
  return distance(h, state.hexCenter, state.orientation) <= state.hexRadius;
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

/** AI Hold Sight only — not fog. Walls / higher ground block; units and forest do not. */
export function pieceSees(state: GameState, viewer: Piece, target: Piece): boolean {
  if (viewer.id === target.id) return true;
  if (isConcealedFrom(state, target, viewer.side)) return false;
  const origin: Hex = { col: viewer.col, row: viewer.row };
  const dest: Hex = { col: target.col, row: target.row };
  const range = statsOf(viewer.type).sight + hexHeight(state, origin);
  if (hexDist(state, origin, dest) > range) return false;
  return eq(origin, dest) || losClear(state, origin, dest, true, viewer.side);
}

function shootLosMode(arc: ShootArc): { overUnits: boolean; overWood: boolean } {
  if (arc === 'arch') return { overUnits: true, overWood: true };
  if (arc === 'laser') return { overUnits: true, overWood: false };
  return { overUnits: false, overWood: false };
}

function losClear(
  state: GameState,
  from: Hex,
  to: Hex,
  mode: boolean | { overUnits: boolean; overWood: boolean },
  viewer: Affiliation,
): boolean {
  const opts =
    typeof mode === 'boolean'
      ? { overUnits: mode, overWood: mode }
      : mode;
  const cells = line(from, to, state.orientation);
  const fromH = hexHeight(state, from);
  // Wall always blocks. Intermediate terrain higher than the shooter blocks.
  // Same/lower elevation is clear (ridge / plateau). Pieces block only from height 0.
  // Arch: over units + wood. Laser: over units only. Straight: neither.
  // Destination may be elevated / occupied / wall — you can shoot *onto* it.
  // Hidden enemies do not block — you cannot see them.
  for (let i = 0; i < cells.length - 1; i++) {
    const h = cells[i]!;
    if (isWall(state, h)) return false;
    if ((isPalisade(state, h) || isForest(state, h)) && !opts.overWood) return false;
    if (hexHeight(state, h) > fromH) return false;
    const blocker = pieceAt(state, h);
    if (
      fromH === 0 &&
      !opts.overUnits &&
      blocker &&
      !isConcealedFrom(state, blocker, viewer)
    ) {
      return false;
    }
  }
  return true;
}

/** Hexes a laser damages: every cell from shooter to aim, excluding the shooter. */
export function laserBeamHexes(
  state: { orientation: HexOrientation },
  from: Hex,
  to: Hex,
): Hex[] {
  return line(from, to, state.orientation);
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
/** Ranged aim may lock a shields-cloaked enemy even though they are not drawn. */
export function rangedTargetVisible(
  state: GameState,
  target: Piece,
  shooterSide: Affiliation,
): boolean {
  if (shieldsBlockTargeting(target)) return false;
  if (shieldsConceal(target) && isHostile(state, target.side, shooterSide)) return true;
  return !isConcealedFrom(state, target, shooterSide);
}

export function splashHitsEnemy(
  state: GameState,
  at: Hex,
  from: Hex,
  shooterSide: Affiliation,
): boolean {
  for (const h of splashBlast(state, at, from)) {
    const t = pieceAt(state, h);
    if (t && isHostile(state, t.side, shooterSide) && rangedTargetVisible(state, t, shooterSide)) {
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
  shooterSide: Affiliation,
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
    hexCenter: state.hexCenter
      ? { col: state.hexCenter.col, row: state.hexCenter.row }
      : undefined,
    terrain: state.terrain.map((r) => [...r]),
    tokens: (state.tokens ?? []).map((t) => ({ ...t })),
    pieces: state.pieces.map((p) => ({
      ...p,
      abilities: p.abilities ? [...p.abilities] : undefined,
      unitTokens: p.unitTokens ? [...p.unitTokens] : undefined,
      story: p.story ? { ...p.story } : undefined,
      holdSawIds: p.holdSawIds ? [...p.holdSawIds] : undefined,
      walkTo: p.walkTo ? { col: p.walkTo.col, row: p.walkTo.row } : undefined,
    })),
    log: [...state.log],
    actedIds: [...state.actedIds],
    controls: { ...state.controls },
    aiStyles: { ...defaultAiStyles(), ...state.aiStyles },
    casualties: { ...emptySideCounts(), ...state.casualties },
    casualtyTypes: state.casualtyTypes
      ? (Object.fromEntries(
          Object.entries(state.casualtyTypes).map(([s, m]) => [s, { ...m }]),
        ) as GameState['casualtyTypes'])
      : undefined,
    killByTypes: state.killByTypes
      ? (Object.fromEntries(
          Object.entries(state.killByTypes).map(([s, m]) => [s, { ...m }]),
        ) as GameState['killByTypes'])
      : undefined,
    brokenObstacles: state.brokenObstacles
      ? (Object.fromEntries(
          Object.entries(state.brokenObstacles).map(([s, m]) => [s, { ...m }]),
        ) as GameState['brokenObstacles'])
      : undefined,
    hpLost: { ...emptySideCounts(), ...state.hpLost },
    flagCaptures: state.flagCaptures ?? 0,
    hadKing: { ...emptyHadKing(), ...state.hadKing },
    hadVisible: { ...emptyHadKing(), ...state.hadVisible },
    fxHits: state.fxHits?.map((h) => ({ ...h })),
    fxActionPoints: state.fxActionPoints?.map((h) => ({ ...h })),
    fxBoard: state.fxBoard ? { ...state.fxBoard } : undefined,
    pendingApFx: state.pendingApFx
      ? {
          red: state.pendingApFx.red ? [...state.pendingApFx.red] : undefined,
          blue: state.pendingApFx.blue ? [...state.pendingApFx.blue] : undefined,
          yellow: state.pendingApFx.yellow ? [...state.pendingApFx.yellow] : undefined,
          purple: state.pendingApFx.purple ? [...state.pendingApFx.purple] : undefined,
        }
      : undefined,
  };
}

export function abilitiesOf(piece: Piece): AbilityId[] {
  const base = [...(piece.abilities ?? statsOf(piece.type).abilities ?? [])];
  // All terrain carries Hide on forest / other hide cover.
  if (hasAllTerrain(piece) && !base.includes('hide')) base.push('hide');
  // Lunge promotion grants the ability (including to zero-melee kits).
  if (hasUnitToken(piece, 'lunge') && !base.includes('lunge')) base.push('lunge');
  // Inspire promotion grants the ability.
  if (hasUnitToken(piece, 'inspire') && !base.includes('inspire')) base.push('inspire');
  return base;
}

export function hasAbility(piece: Piece, id: AbilityId): boolean {
  return abilitiesOf(piece).includes(id);
}

/**
 * Lunge thrust damage. Attack +1 stacks. Kits with 0 melee still thrust for 1
 * when they have Lunge (ability or promotion).
 */
export function lungeDamageOf(piece: Piece): number {
  if (!hasAbility(piece, 'lunge')) return 0;
  const base = statsOf(piece.type).meleeDamage;
  return (base > 0 ? base : 1) + attackBonusOf(piece);
}

/** Charge crash damage. Ability gates it; 0 on the stat still hits for 1. */
export function chargeDamageOf(piece: Piece): number {
  if (!hasAbility(piece, 'charge')) return 0;
  return Math.max(1, statsOf(piece.type).charge) + attackBonusOf(piece);
}

/** Melee unit with javelin: shoot is a special, not a default click. */
export function javelinIsSpecial(piece: Piece): boolean {
  const s = statsOf(piece.type);
  return hasAbility(piece, 'javelin') && s.meleeDamage > 0 && s.shoot > 0;
}

/** Built fence on this hex (not tree / forest). */
function builtPalisadeAt(state: { tokens: TileToken[] }, h: Hex): TileToken | undefined {
  return hexToken(state.tokens, h, (t) => t.type === 'palisade');
}

/** Buildable tokens Remove can clear (trap / palisade / bridge — not tree or forest). */
export function buildableTokenAt(
  state: { tokens: TileToken[] },
  h: Hex,
): TileToken | undefined {
  return (
    builtPalisadeAt(state, h) ??
    hexToken(state.tokens, h, (t) => t.type === 'bridge') ??
    hexToken(state.tokens, h, (t) => t.type === 'pikes')
  );
}

/** Whether Build with `structure` can act on this already-legal spot. */
export function buildSpotMatches(
  state: { tokens: TileToken[]; terrain: Terrain[][] },
  hex: Hex,
  structure: BuildStructure,
): boolean {
  const built = buildableTokenAt(state, hex);
  if (structure === 'remove') return !!built;
  if (structure === 'bridge') {
    return terrainAt(state, hex) === 'water' && !built;
  }
  // Trap / Palisade only place on empty ground (no buildable token, not water).
  if (terrainAt(state, hex) === 'water') return false;
  return !built;
}

/**
 * Adjacent hexes Build can use. Red faces are not spots.
 * Trap/Palisade: empty walkable land. Bridge: empty water. Remove: adjacent buildables.
 * Pass `structure` to keep only matching targets.
 */
export function buildSpots(
  state: GameState,
  piece: Piece,
  structure?: BuildStructure,
): Hex[] {
  if (!hasAbility(piece, 'build')) return [];
  const from: Hex = { col: piece.col, row: piece.row };
  const blocked = blockedWalkDirs(piece);
  const out: Hex[] = [];
  for (let d = 0; d < 6; d++) {
    const dir = d as HexDir;
    if (blocked.has(dir)) continue;
    const hex = neighborInDir(from, dir, state.orientation);
    if (!inBounds(state, hex)) continue;
    if (pieceAt(state, hex)) continue;
    const built = buildableTokenAt(state, hex);
    if (built) {
      if (!structure || structure === 'remove') out.push(hex);
      continue;
    }
    const water = terrainAt(state, hex) === 'water';
    if (water) {
      // Bridge only — trap/palisade stay on land.
      if (!structure || structure === 'bridge') out.push(hex);
      continue;
    }
    if (structure === 'bridge') continue;
    if (!canWalkStep(state, piece, from, from, hex)) continue;
    if (structure && !buildSpotMatches(state, hex, structure)) continue;
    out.push(hex);
  }
  return out;
}

/** @deprecated Use buildSpots. */
export function trapSpots(state: GameState, piece: Piece): Hex[] {
  return buildSpots(state, piece);
}

/** Own turn, ability, not asleep, not already finished. Downhill bonus can be forfeited. */
function specialReady(state: GameState, pieceId: string, id: AbilityId): Piece | null {
  const piece = getPiece(state, pieceId);
  if (!piece || piece.side !== state.turn || state.winner) return null;
  if (!hasAbility(piece, id)) return null;
  if (isSleeping(piece)) return null;
  if (hasActed(state, pieceId)) return null;
  if (state.scoutPieceId && state.scoutPieceId !== pieceId) return null;
  if (!state.scoutPieceId && (piece.movedThisTurn || piece.actedThisTurn)) return null;
  if (
    !state.scoutPieceId &&
    state.actedIds.length >= clampUnitsPerTurn(state.unitsPerTurn)
  ) {
    return null;
  }
  return piece;
}

/** Drop the free downhill +1 — any other action overrules it. */
function forfeitDownhill(state: GameState, piece: Piece): void {
  if (!(state.downhillMove && state.scoutPieceId === piece.id)) return;
  state.downhillMove = false;
  state.downhillQueued = 0;
  const left = apSpendable(piece);
  // Keep the scout lock so the overruling action can spend this slot (or leftover AP).
  state.scoutActionsLeft = Math.max(1, left);
}

export function canBuild(
  state: GameState,
  pieceId: string,
  structure?: BuildStructure,
): boolean {
  const piece = specialReady(state, pieceId, 'build');
  if (!piece) return false;
  return buildSpots(state, piece, structure).length > 0;
}

/** @deprecated Use canBuild. */
export function canTrap(state: GameState, pieceId: string): boolean {
  return canBuild(state, pieceId);
}

/** Armor on one cube face, including Defense promotions. Non-hex armor is the same on every face. */
function faceArmor(piece: Piece, dir: HexDir): number {
  return armorOnDir(piece, dir);
}

export function hasShieldsUp(piece: { shieldsUp?: boolean } | null | undefined): boolean {
  return !!piece?.shieldsUp;
}

function hostileNeighbor(state: GameState, piece: Piece, hex: Hex): Piece | null {
  if (!inBounds(state, hex)) return null;
  const occ = pieceAt(state, hex);
  if (!occ || occ.id === piece.id) return null;
  if (!isHostile(state, occ.side, piece.side)) return null;
  if (isConcealedFrom(state, occ, piece.side)) return null;
  return occ;
}

/** Enemies standing on a non-red face (armor above −2). */
export function berserkFoes(state: GameState, piece: Piece): Piece[] {
  if (!hasAbility(piece, 'berserk')) return [];
  const from: Hex = { col: piece.col, row: piece.row };
  const out: Piece[] = [];
  for (let d = 0; d < 6; d++) {
    const dir = d as HexDir;
    if (faceArmor(piece, dir) <= -2) continue;
    const foe = hostileNeighbor(
      state,
      piece,
      neighborInDir(from, dir, state.orientation),
    );
    if (foe && !out.some((p) => p.id === foe.id)) out.push(foe);
  }
  return out;
}

export function canBerserk(state: GameState, pieceId: string): boolean {
  const piece = specialReady(state, pieceId, 'berserk');
  if (!piece) return false;
  return berserkFoes(state, piece).length > 0;
}

export function canShields(state: GameState, pieceId: string): boolean {
  return !!specialReady(state, pieceId, 'shields');
}

/** Inspire: 1 action, source until this side's next turn. Not while already inspiring. */
export function canInspire(state: GameState, pieceId: string): boolean {
  const piece = specialReady(state, pieceId, 'inspire');
  return !!piece && !piece.inspireUp;
}

/** Inspire ability active, or a General while the experimental passive is on. */
export function isInspirationSource(piece: Piece): boolean {
  if (!isSide(piece.side)) return false;
  if (piece.inspireUp) return true;
  return generalInspiresEnabled() && hasUnitToken(piece, 'general');
}

/**
 * Pieces chained to an inspiration source OTHER than themselves.
 * Chains run through adjacent pieces of the exact same side (allies do not count).
 * A lone source is not boosted; two sources in one chain inspire each other.
 * No stacking — membership only.
 */
export function inspiredIdsOf(state: GameState): Set<string> {
  const out = new Set<string>();
  const at = new Map<string, Piece>();
  for (const p of state.pieces) if (isSide(p.side)) at.set(key(p), p);
  const seen = new Set<string>();
  for (const start of at.values()) {
    if (seen.has(start.id)) continue;
    const chain: Piece[] = [];
    const queue: Piece[] = [start];
    seen.add(start.id);
    while (queue.length) {
      const p = queue.shift()!;
      chain.push(p);
      for (const h of hexNeighbors(state, p)) {
        const q = at.get(key(h));
        if (!q || seen.has(q.id) || q.side !== start.side) continue;
        seen.add(q.id);
        queue.push(q);
      }
    }
    if (chain.length < 2) continue;
    const sources = chain.filter(isInspirationSource);
    if (!sources.length) continue;
    for (const p of chain) {
      if (sources.length === 1 && sources[0] === p) continue;
      out.add(p.id);
    }
  }
  return out;
}

/** Recompute `inspired` on every piece from the current board. Idempotent. */
export function refreshInspiration(state: GameState): void {
  const ids = inspiredIdsOf(state);
  for (const p of state.pieces) {
    if (ids.has(p.id)) p.inspired = true;
    else if (p.inspired !== undefined) p.inspired = undefined;
  }
}

/** Spend 1 AP to cut remaining shootCooldown by 1. Available while reloading. */
export function canReload(state: GameState, pieceId: string): boolean {
  const piece = getPiece(state, pieceId);
  if (!piece || piece.side !== state.turn || state.winner) return false;
  if (!isReloading(piece)) return false;
  if (isSleeping(piece)) return false;
  if (hasActed(state, pieceId)) return false;
  if (state.scoutPieceId && state.scoutPieceId !== pieceId) return false;
  if (!state.scoutPieceId && (piece.movedThisTurn || piece.actedThisTurn)) return false;
  if (
    !state.scoutPieceId &&
    state.actedIds.length >= clampUnitsPerTurn(state.unitsPerTurn)
  ) {
    return false;
  }
  return canSpendActionPoints(piece, 1);
}

type BashStep = {
  victim: Piece;
  from: Hex;
  to: Hex | null;
  outcome: 'slam' | 'unit' | 'token' | 'forest' | 'move';
  other?: Piece;
};

/** Why a one-step shove cannot enter `to`. Height the unit could step is fine. */
function shoveBlocked(
  state: GameState,
  victim: Piece,
  from: Hex,
  to: Hex,
): 'wall' | 'height' | 'water' | null {
  if (isWall(state, to)) return 'wall';
  const fh = hexHeight(state, from);
  const th = hexHeight(state, to);
  if (th > climbLevelOf(victim)) return 'height';
  if (Math.abs(th - fh) > 1) return 'height';
  if (inWater(state, to) && !canPassWater(victim)) return 'water';
  if (enteringWater(state, from, to) && refusesWaterJump(victim)) return 'water';
  return null;
}

function planBash(state: GameState, piece: Piece): BashStep[] {
  if (!hasAbility(piece, 'bash')) return [];
  const origin: Hex = { col: piece.col, row: piece.row };
  const steps: BashStep[] = [];
  for (let d = 0; d < 6; d++) {
    const dir = d as HexDir;
    if (faceArmor(piece, dir) !== 0) continue;
    const from = neighborInDir(origin, dir, state.orientation);
    const victim = hostileNeighbor(state, piece, from);
    if (!victim) continue;
    const landing = neighborInDir(from, dir, state.orientation);
    if (!inBounds(state, landing)) {
      steps.push({ victim, from, to: landing, outcome: 'slam' });
      continue;
    }
    const blocked = shoveBlocked(state, victim, from, landing);
    if (blocked) {
      steps.push({ victim, from, to: landing, outcome: 'slam' });
      continue;
    }
    const occ = pieceAt(state, landing);
    if (occ && occ.id !== victim.id) {
      steps.push({ victim, from, to: landing, outcome: 'unit', other: occ });
      continue;
    }
    if (isPalisade(state, landing)) {
      steps.push({ victim, from, to: landing, outcome: 'token' });
      continue;
    }
    if (isForest(state, landing)) {
      steps.push({ victim, from, to: landing, outcome: 'forest' });
      continue;
    }
    steps.push({ victim, from, to: landing, outcome: 'move' });
  }
  return steps;
}

/** Hostiles a bash would shove, plus hostiles they would collide with. */
export function bashFoes(state: GameState, piece: Piece): Piece[] {
  const out: Piece[] = [];
  const add = (p: Piece | undefined) => {
    if (!p || !isHostile(state, p.side, piece.side)) return;
    if (!out.some((x) => x.id === p.id)) out.push(p);
  };
  for (const step of planBash(state, piece)) {
    add(step.victim);
    add(step.other);
  }
  return out;
}

/** True when bash deals damage (slam / collide / wood), not a free shove. */
export function bashDamages(state: GameState, piece: Piece): boolean {
  return planBash(state, piece).some((s) => s.outcome !== 'move');
}

export function canBash(state: GameState, pieceId: string): boolean {
  const piece = specialReady(state, pieceId, 'bash');
  if (!piece) return false;
  return planBash(state, piece).length > 0;
}

/** Far hexes a lunge can thrust to (straight line, 2 steps). */
export function lungeSpots(state: GameState, piece: Piece): Hex[] {
  if (lungeDamageOf(piece) <= 0) return [];
  const from: Hex = { col: piece.col, row: piece.row };
  const out: Hex[] = [];
  // Same facing gate as melee walk/shoot — red (−2) faces cannot thrust.
  const blocked = blockedWalkDirs(piece);
  for (let d = 0; d < 6; d++) {
    const dir = d as HexDir;
    if (blocked.has(dir)) continue;
    const near = neighborInDir(from, dir, state.orientation);
    const far = neighborInDir(near, dir, state.orientation);
    if (!inBounds(state, near) || !inBounds(state, far)) continue;
    if (isWall(state, near) || isWall(state, far)) continue;
    if (isPalisade(state, near) || isPalisade(state, far)) continue;
    if (!canWalkStep(state, piece, from, from, near)) continue;
    if (!canWalkStep(state, piece, from, near, far)) continue;
    const nearOcc = hostileNeighbor(state, piece, near);
    const farOcc = hostileNeighbor(state, piece, far);
    if (!nearOcc && !farOcc) continue;
    const farAny = pieceAt(state, far);
    if (farAny && sameTeam(state, farAny.side, piece.side)) continue;
    out.push(far);
  }
  return out;
}

export function canLunge(state: GameState, pieceId: string): boolean {
  const piece = specialReady(state, pieceId, 'lunge');
  if (!piece) return false;
  return lungeSpots(state, piece).length > 0;
}

/**
 * True when `hex` is level ground, or a walkable path of ≤1-height steps
 * (within the piece's climb level) leads down to level ground. Stops Scouts
 * from being dropped on sealed-off hills / mountains.
 */
function hasGroundAccess(state: GameState, piece: Piece, hex: Hex): boolean {
  if (hexHeight(state, hex) <= 0) return true;
  if (hasAllTerrain(piece)) return true;
  const climb = climbLevelOf(piece);
  const key = (h: Hex) => `${h.col},${h.row}`;
  const seen = new Set<string>([key(hex)]);
  const queue: Hex[] = [hex];
  while (queue.length) {
    const cur = queue.shift()!;
    const ch = hexHeight(state, cur);
    for (const n of hexNeighbors(state, cur)) {
      const k = key(n);
      if (seen.has(k) || !inBounds(state, n)) continue;
      if (isWall(state, n) || isPalisade(state, n)) continue;
      if (inWater(state, n) && !canPassWater(piece)) continue;
      const nh = hexHeight(state, n);
      if (nh > climb || Math.abs(nh - ch) > 1) continue;
      if (nh <= 0) return true;
      seen.add(k);
      queue.push(n);
    }
  }
  return false;
}

/** True when a Scout can ambush-deploy onto this hex (standable, empty, reachable from the plains). */
export function canScoutDeployAt(state: GameState, piece: Piece, hex: Hex): boolean {
  if (!inBounds(state, hex)) return false;
  if (isWall(state, hex) || isPalisade(state, hex)) return false;
  if (inWater(state, hex) && !canPassWater(piece)) return false;
  if (terrainHeight(terrainAt(state, hex)) > climbLevelOf(piece)) return false;
  const occ = pieceAt(state, hex);
  if (occ && occ.id !== piece.id) return false;
  if (!hasGroundAccess(state, piece, hex)) return false;
  return true;
}

/** Every standable empty hex for Scout pre-battle placement. */
export function scoutDeploySpots(state: GameState, piece: Piece): Hex[] {
  const out: Hex[] = [];
  for (let row = 0; row < state.rows; row++) {
    for (let col = 0; col < state.cols; col++) {
      const h = { col, row };
      if (canScoutDeployAt(state, piece, h)) out.push(h);
    }
  }
  return out;
}

/** Move a Scout onto `hex` and stamp Hidden. Returns null if illegal. */
export function placeScoutAt(
  state: GameState,
  pieceId: string,
  hex: Hex,
): GameState | null {
  const piece = getPiece(state, pieceId);
  if (!piece || !hasScout(piece)) return null;
  if (!canScoutDeployAt(state, piece, hex)) return null;
  const next = cloneState(state);
  const p = getPiece(next, pieceId);
  if (!p) return null;
  p.col = hex.col;
  p.row = hex.row;
  p.revealed = undefined;
  refreshInspiration(next);
  p.unitTokens = sanitizeUnitTokens([...(p.unitTokens ?? []), 'hidden']);
  return next;
}

function noteStrike(
  state: GameState,
  victim: Piece,
  before: number,
  dmg: { fatal: boolean; remaining: number; routed: boolean; routKind?: RoutKind },
  from?: Hex,
  ranged = false,
): void {
  const dealt = before - dmg.remaining;
  if (dealt <= 0 && !dmg.routed) return;
  state.fxHits = [
    ...(state.fxHits ?? []),
    {
      id: victim.id,
      fatal: dmg.fatal,
      dealt: Math.max(dealt, dmg.routed ? 1 : 0),
      routed: dmg.routed,
      routKind: dmg.routKind,
      armor: armorOf(victim, from, state.orientation),
      ranged,
    },
  ];
}

export function hasGeneral(pieces: Piece[], side: Side): boolean {
  return pieces.some((p) => p.side === side && hasUnitToken(p, 'general'));
}

/** If a piece just became a general, command-kill is now in play for that side. */
export function noteGenerals(state: GameState): void {
  for (const s of SIDES) {
    if (hasGeneral(state.pieces, s)) state.hadKing[s] = true;
  }
}

/** Strongest living piece on a side (combat value, then HP, then id). */
export function strongestPiece(pieces: Piece[], side: Side): Piece | null {
  const mine = pieces.filter((p) => p.side === side);
  if (!mine.length) return null;
  return mine.reduce((best, p) => {
    const bv = combatValue(best);
    const pv = combatValue(p);
    if (pv !== bv) return pv > bv ? p : best;
    const bh = hpLeft(best);
    const ph = hpLeft(p);
    if (ph !== bh) return ph > bh ? p : best;
    return p.id < best.id ? p : best;
  });
}

/**
 * If this side lost its last General under succession rules, crown the strongest
 * living piece. Returns the promoted piece, or null when nothing changed.
 */
export function maybeSucceedGeneral(state: GameState, side: Side): Piece | null {
  if (!state.generalSuccession) return null;
  if (!isPlayerControlled(state, side)) return null;
  if (!state.hadKing[side]) return null;
  if (hasGeneral(state.pieces, side)) return null;
  const pick = strongestPiece(state.pieces, side);
  if (!pick) return null;
  pick.unitTokens = [
    ...unitTokensOf(pick).filter((t) => t !== 'general'),
    'general',
  ];
  pick.hp = Math.min(hpMax(pick), hpLeft(pick) + 1);
  if (actionPointsMax(pick) > 0) {
    pick.actionPoints = Math.min(
      actionPointsMax(pick),
      actionPointsLeft(pick) + 1,
    );
  }
  noteGenerals(state);
  state.log.push(`${unitLog(pick)} inherits command`);
  return pick;
}

export function controlOf(state: GameState, side: Side): ArmyControl {
  return state.controls?.[side] ?? defaultArmyControls()[side];
}

export function isPlayerControlled(state: GameState, side: Side): boolean {
  return controlOf(state, side) === 'player';
}

export function isAiControlled(state: GameState, side: Side): boolean {
  const c = controlOf(state, side);
  return c === 'ai-enemy' || c === 'ai-ally' || c === 'ai-hostile';
}

/** AI that is not on the player's team. Hostile is its own team, even against other hostiles. */
function isOpponentAi(state: GameState, side: Side): boolean {
  const c = controlOf(state, side);
  return c === 'ai-enemy' || c === 'ai-hostile';
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
  // Each hostile army is its own team: players, allies, enemies, and other hostiles.
  if (controlOf(state, side) === 'ai-hostile') return `hostile-${side}`;
  const vsFoe = participatingSides(state).some((s) => isOpponentAi(state, s));
  if (vsFoe) {
    return controlOf(state, side) === 'ai-enemy' ? 'enemy' : 'player';
  }
  return `solo-${side}`;
}

export function sameTeam(state: GameState, a: Affiliation, b: Affiliation): boolean {
  if (!isSide(a) || !isSide(b)) return false;
  return a === b || coalition(state, a) === coalition(state, b);
}

export function isHostile(state: GameState, a: Affiliation, b: Affiliation): boolean {
  if (!isSide(a) || !isSide(b)) return false;
  return !sameTeam(state, a, b);
}

/** Walking onto an unaligned piece claims it — no damage. Any real army can. */
export function canConvert(attacker: Piece, occ: Piece): boolean {
  return isNeutralSide(occ.side) && isSide(attacker.side);
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

/** Same-team sides that are not player-controlled (ai allies). */
export function allySides(state: GameState): Side[] {
  const us = playerSides(state);
  if (!us.length) return [];
  return participatingSides(state).filter(
    (s) => !isPlayerControlled(state, s) && us.some((p) => sameTeam(state, s, p)),
  );
}

/** Ally pieces removed this match. */
export function allyCasualties(state: GameState): number {
  return allySides(state).reduce((n, s) => n + (state.casualties[s] ?? 0), 0);
}

export function playerHpLost(state: GameState): number {
  const lost = state.hpLost ?? emptySideCounts();
  return playerSides(state).reduce((n, s) => n + (lost[s] ?? 0), 0);
}

export function playerKills(state: GameState): number {
  const us = playerSides(state);
  if (!us.length) return 0;
  return participatingSides(state)
    .filter((s) => us.every((p) => isHostile(state, s, p)))
    .reduce((n, s) => n + (state.casualties[s] ?? 0), 0);
}

/** Enemy unit types the player team has removed this match. */
export function playerKillsByType(state: GameState): Record<string, number> {
  const us = playerSides(state);
  const out: Record<string, number> = {};
  if (!us.length) return out;
  for (const s of participatingSides(state)) {
    if (!us.every((p) => isHostile(state, s, p))) continue;
    for (const [typ, n] of Object.entries(state.casualtyTypes?.[s] ?? {})) {
      if (n) out[typ] = (out[typ] ?? 0) + n;
    }
  }
  return out;
}

/** Enemy kills scored by each player unit type this match. */
export function playerKillsWithByType(state: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of playerSides(state)) {
    for (const [typ, n] of Object.entries(state.killByTypes?.[s] ?? {})) {
      if (n) out[typ] = (out[typ] ?? 0) + n;
    }
  }
  return out;
}

/** Obstacle types the player team fully broke or felled this match. */
export function playerBrokenObstacles(state: GameState): Record<string, number> {
  const us = playerSides(state);
  const out: Record<string, number> = {};
  if (!us.length) return out;
  for (const s of us) {
    for (const [typ, n] of Object.entries(state.brokenObstacles?.[s] ?? {})) {
      if (n) out[typ] = (out[typ] ?? 0) + n;
    }
  }
  return out;
}


export function livingHostiles(state: GameState): number {
  const us = playerSides(state);
  if (!us.length) return 0;
  return state.pieces.filter((p) => us.every((s) => isHostile(state, p.side, s)))
    .length;
}

export function playerFlagCaptures(state: GameState): number {
  return state.flagCaptures ?? 0;
}

export function signsRead(state: GameState): number {
  return (state.tokens ?? []).filter((t) => t.type === 'board' && t.read).length;
}

export function signsOnMap(state: GameState): number {
  return (state.tokens ?? []).filter((t) => t.type === 'board').length;
}

export function matchHasEnemies(state: GameState): boolean {
  return participatingSides(state).some((s) => isOpponentAi(state, s));
}

export function playerTeamWon(state: GameState): boolean {
  if (!state.winner) return false;
  const humans = playerSides(state);
  if (!humans.length) return false;
  return humans.some((s) => sameTeam(state, s, state.winner!));
}

export function openingSide(pieces: { side: Affiliation }[]): Side {
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

/** Clear per-activation busy flags at end of a side's turn. */
function clearTurnFlags(state: GameState, side: Side): void {
  for (const p of state.pieces) {
    if (p.side !== side) continue;
    p.actedThisTurn = false;
    p.movedThisTurn = false;
  }
}

/** Snapshot idle status before turn flags / actedIds are cleared. */
function noteIdleLastTurn(state: GameState, side: Side): void {
  for (const p of state.pieces) {
    if (p.side !== side) continue;
    p.idleLastTurn =
      !isSleeping(p) &&
      !p.actedThisTurn &&
      !p.movedThisTurn &&
      !hasActed(state, p.id);
  }
}

/**
 * Start of a side's turn: reset spend caps and grant `actionPointGain` into the
 * pool (up to max). Sleeping / water / max≤0 skip the pool grant.
 * Idle last own turn: +1 (still capped at AP max).
 */
function grantActionPoints(state: GameState, side: Side): void {
  for (const p of state.pieces) {
    if (p.side !== side) continue;
    p.apSpentThisTurn = undefined;
    if (isSleeping(p)) continue;
    if (inWater(state, { col: p.col, row: p.row }) && !hasAllTerrain(p)) continue;
    const max = actionPointsMax(p);
    if (max <= 0) continue;
    const gain = actionPointGainOf(p) + (p.idleLastTurn ? 1 : 0);
    if (gain <= 0) continue;
    const before = actionPointsLeft(p);
    const after = Math.min(max, before + gain);
    if (after === before) continue;
    p.actionPoints = after;
    const q = state.pendingApFx ?? (state.pendingApFx = {});
    q[side] = [...(q[side] ?? []), p.id];
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
  state.downhillMove = false;
  state.downhillQueued = 0;
}

const WATER_DROWN_HP = 2;

/** 0 AP and 2 lives or fewer: the next water upkeep kills them. */
export function refusesWaterJump(piece: Piece): boolean {
  if (hasAllTerrain(piece)) return false;
  if (hpLeft(piece) > WATER_DROWN_HP) return false;
  if (actionPointsMax(piece) <= 0) return true;
  return actionPointsLeft(piece) <= 0;
}

function enteringWater(
  state: { tokens: TileToken[]; terrain: Terrain[][] },
  from: Hex,
  to: Hex,
): boolean {
  return inWater(state, to) && !inWater(state, from);
}

/** Start of a side's turn: each unit in water spends 1 AP, or takes 2 HP. */
export function applyWaterUpkeep(state: GameState, side: Side): void {
  const drowned: Piece[] = [];
  for (const p of state.pieces) {
    if (p.side !== side) continue;
    if (!inWater(state, { col: p.col, row: p.row })) continue;
    if (hasAllTerrain(p)) continue;
    if (actionPointsMax(p) > 0 && actionPointsLeft(p) > 0) {
      spendActionPointsPool(p);
      state.fxActionPoints = [...(state.fxActionPoints ?? []), { id: p.id, kind: 'spend' }];
      state.log.push(`${unitLog(p)} treads water (−1 AP)`);
    } else {
      drowned.push(p);
    }
  }
  for (const p of drowned) {
    const before = hpLeft(p);
    const dmg = applyDamage(state, p, WATER_DROWN_HP, WATER_DROWN_HP, undefined, true, false);
    const dealt = before - dmg.remaining;
    if (dealt > 0 || dmg.routed) {
      noteStrike(state, p, before, dmg, undefined, true);
    }
    if (dmg.routed) {
      state.log.push(`Water routs ${unitLog(p)}`);
    } else if (dmg.fatal) {
      state.log.push(`Water kills ${unitLog(p)} (drowned)`);
    } else {
      state.log.push(`Water hits ${unitLog(p)} — ${dealt} HP (${dmg.remaining} HP)`);
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
export function beginSideTurn(state: GameState, newRound = false, kickoff = false): void {
  if (newRound) state.turnNumber += 1;
  applyTurnLimit(state);
  if (state.winner) return;
  for (const p of state.pieces) {
    if (p.side === state.turn) {
      p.shieldsUp = undefined;
      p.shieldsStruck = undefined;
      // Inspire lasts 1 turn: it drops when its side starts again.
      p.inspireUp = undefined;
    }
  }
  maybeSucceedGeneral(state, state.turn);
  refreshInspiration(state);
  if (state.winner) return;
  // Kickoff: pieces already spawn full (or exhausted at 0). Do not grant here.
  if (!kickoff) grantActionPoints(state, state.turn);
  const queued = state.pendingApFx?.[state.turn] ?? [];
  if (queued.length) {
    const seen = new Set(
      (state.fxActionPoints ?? []).filter((x) => x.kind === 'gain').map((x) => x.id),
    );
    const extra = queued
      .filter((id) => !seen.has(id))
      .map((id) => ({ id, kind: 'gain' as const }));
    state.fxActionPoints = [...(state.fxActionPoints ?? []), ...extra];
    state.pendingApFx = {
      ...state.pendingApFx,
      [state.turn]: [],
    };
  }
  applyWaterUpkeep(state, state.turn);
  if (state.fxActionPoints?.length) {
    const live = new Set(state.pieces.map((p) => p.id));
    state.fxActionPoints = state.fxActionPoints.filter((x) => live.has(x.id));
    if (!state.fxActionPoints.length) state.fxActionPoints = undefined;
  }
  checkWin(state);
  maybeAutoEnd(state);
}

export type MarchAnim = {
  pieceId: string;
  from: Hex;
  facing: HexDir;
  path: Hex[];
  stop: Hex;
};

let queuedMarches: MarchAnim[] = [];

/** One log line per AP spent (climb / charge-extra / march chunk). */
function logApAction(state: GameState, piece: Piece, times = 1): void {
  const line = `${unitLog(piece)} spends AP`;
  for (let i = 0; i < times; i++) state.log.push(line);
}

export function takeQueuedMarches(): MarchAnim[] {
  const q = queuedMarches;
  queuedMarches = [];
  return q;
}

/** Hostile unit or palisade/tree the march can fight onto. Hidden units stay hidden. */
function marchCombatAt(state: GameState, piece: Piece, hex: Hex): boolean {
  if (meleeDamageOf(piece) <= 0) return false;
  if (!inBounds(state, hex) || isWall(state, hex)) return false;
  if (isPalisade(state, hex)) return true;
  const occ = pieceAt(state, hex);
  if (!occ || occ.id === piece.id) return false;
  if (isConcealedFrom(state, occ, piece.side)) return false;
  return isHostile(state, piece.side, occ.side);
}

function marchStepTerrain(state: GameState, piece: Piece, fromHex: Hex, toHex: Hex): boolean {
  const t = terrainAt(state, toHex);
  if (inWater(state, toHex) && !canPassWater(piece)) return false;
  if (enteringWater(state, fromHex, toHex) && refusesWaterJump(piece)) return false;
  if (terrainHeight(t) > climbLevelOf(piece)) return false;
  if (Math.abs(hexHeight(state, toHex) - hexHeight(state, fromHex)) > 1) return false;
  return true;
}

/** Own units are never a wall. The march may step through them, not land on them. */
function friendlyOccupant(state: GameState, piece: Piece, hex: Hex): Piece | undefined {
  const occ = pieceAt(state, hex);
  if (!occ || occ.id === piece.id) return undefined;
  if (!sameTeam(state, piece.side, occ.side)) return undefined;
  return occ;
}

/** Tile a standing march can enter. Climbs ignore empty AP; a lethal water jump does not. */
function marchCanEnter(state: GameState, piece: Piece, fromHex: Hex, toHex: Hex): boolean {
  if (!inBounds(state, toHex)) return false;
  if (isWall(state, toHex) || isPalisade(state, toHex)) return false;
  if (!marchStepTerrain(state, piece, fromHex, toHex)) return false;
  const occ = pieceAt(state, toHex);
  if (occ && occ.id !== piece.id && !friendlyOccupant(state, piece, toHex)) return false;
  return true;
}

/** One melee hit on the destination. True when the hex is taken. */
function applyMarchStrike(state: GameState, piece: Piece, from: Hex, target: Hex): boolean {
  const melee = meleeDamageOf(piece);
  if (melee <= 0) return false;
  const occ = pieceAt(state, target);
  if (
    occ &&
    occ.id !== piece.id &&
    isHostile(state, piece.side, occ.side) &&
    !isConcealedFrom(state, occ, piece.side)
  ) {
    tellStory(state, occ, 'touch');
    const res = applyDamage(state, occ, melee, 1, from, false, false, piece);
    state.log.push(
      `${unitLog(piece)} strikes ${hpBit(occ, res.fatal, res.remaining, res.routed)}` +
        (res.fatal ? '' : ` — stops ${from.col},${from.row}`) +
        ` ${dmgLine(state, occ, melee, 1, from)}`,
    );
    return res.fatal && !pieceAt(state, target);
  }
  const pal = hexToken(state.tokens, target, (t) => isPalisadeToken(t.type));
  if (!pal) return false;
  const remaining = woodRemaining(palisadeHp(pal), melee);
  if (remaining <= 0) {
    state.tokens = state.tokens.filter(
      (t) => !(isPalisadeToken(t.type) && t.col === target.col && t.row === target.row),
    );
    noteObstacleBroken(state, piece.side, pal.type);
    state.log.push(`${unitLog(piece)} breaks ${pal.type}`);
    return true;
  }
  pal.hp = remaining;
  state.log.push(
    `${unitLog(piece)} strikes ${pal.type} (${remaining} left) — stops ${from.col},${from.row}`,
  );
  return false;
}

/**
 * Shortest walk from the piece to `goal`, facing updated along the route.
 * Red-face steps are illegal. Climbs are included even if AP is empty —
 * execution stops until they can pay.
 */
function marchRouteInner(state: GameState, piece: Piece, goal: Hex): Hex[] | null {
  const start: Hex = { col: piece.col, row: piece.row };
  if (!inBounds(state, goal) || eq(start, goal)) return null;
  if (isSleeping(piece) || statsOf(piece.type).move <= 0) return null;
  const combatGoal = marchCombatAt(state, piece, goal);
  // A melee hex is an attack, not a destination you can queue.
  if (combatGoal) return null;
  const goalOcc = pieceAt(state, goal);
  if (goalOcc && goalOcc.id !== piece.id) return null;
  const tGoal = terrainAt(state, goal);
  if (isWall(state, goal) || isPalisade(state, goal)) return null;
  if (inWater(state, goal) && !canPassWater(piece)) return null;
  if (terrainHeight(tGoal) > climbLevelOf(piece)) return null;

  type Node = { hex: Hex; facing: HexDir; prev: Node | null };
  const startNode: Node = { hex: start, facing: facingOf(piece), prev: null };
  const seen = new Set<string>([`${start.col},${start.row},${startNode.facing}`]);
  const q: Node[] = [startNode];
  const o = state.orientation;
  let found: Node | null = null;
  while (q.length) {
    const cur = q.shift()!;
    if (eq(cur.hex, goal)) {
      found = cur;
      break;
    }
    for (let d = 0; d < 6; d++) {
      const dir = d as HexDir;
      const next = neighborInDir(cur.hex, dir, o);
      const nk = `${next.col},${next.row},${dir}`;
      if (seen.has(nk)) continue;
      const probe: Piece = { ...piece, col: cur.hex.col, row: cur.hex.row, facing: cur.facing };
      if (blockedWalkDirs(probe).has(dir)) continue;
      const combatStep = combatGoal && eq(next, goal) && marchCombatAt(state, piece, next);
      if (combatStep) {
        if (!marchStepTerrain(state, piece, cur.hex, next)) continue;
      } else if (!marchCanEnter(state, piece, cur.hex, next)) continue;
      seen.add(nk);
      q.push({ hex: next, facing: dir, prev: cur });
    }
  }
  if (!found) return null;
  const path: Hex[] = [];
  let n: Node | null = found;
  while (n && !eq(n.hex, start)) {
    path.push(n.hex);
    n = n.prev;
  }
  path.reverse();
  return path.length ? path : null;
}

/** Full route to `goal`. Empty when unreachable. */
export function marchRoute(state: GameState, piece: Piece, goal: Hex): Hex[] | null {
  return marchRouteInner(state, piece, goal);
}

/**
 * A march order is a destination this action cannot already reach.
 * Normal move range and spendable-AP extras are never orders.
 */
export function canOrderMarch(state: GameState, piece: Piece, goal: Hex): boolean {
  if (!marchRoute(state, piece, goal)) return false;
  for (const h of rangeHighlights(state, piece.id)) {
    if (!eq(h.hex, goal)) continue;
    if (h.kind === 'move' || h.kind === 'plus' || h.kind === 'ap') return false;
  }
  return true;
}

/** Drop a standing march (another order). No-op if none. */
function clearWalkOrder(state: GameState, piece: Piece): void {
  if (!piece.walkTo) return;
  piece.walkTo = undefined;
  state.log.push(`${unitLog(piece)} march cancelled`);
}

export function setWalkOrder(state: GameState, pieceId: string, dest: Hex | null): GameState {
  const piece = getPiece(state, pieceId);
  if (!piece || piece.side !== state.turn || state.winner) return state;
  if (dest) {
    if (!marchRoute(state, piece, dest)) return state;
  } else if (!piece.walkTo) {
    return state;
  }
  const next = cloneState(state);
  const p = getPiece(next, pieceId);
  if (!p) return state;
  if (dest) {
    p.walkTo = { col: dest.col, row: dest.row };
    next.log.push(`${unitLog(p)} march ordered to ${dest.col},${dest.row}`);
  } else {
    clearWalkOrder(next, p);
  }
  return next;
}

function marchEligible(state: GameState, piece: Piece): boolean {
  if (piece.side !== state.turn || !piece.walkTo || state.winner) return false;
  if (isSleeping(piece) || statsOf(piece.type).move <= 0) return false;
  if (piece.movedThisTurn || piece.actedThisTurn || hasActed(state, piece.id)) return false;
  return true;
}

/** Walk one speed-chunk toward `walkTo`. Mutates `state`. Null if they stay put. */
function applyOneMarch(state: GameState, piece: Piece): MarchAnim | null {
  if (!piece.walkTo) return null;
  const dest = piece.walkTo;
  const here: Hex = { col: piece.col, row: piece.row };
  if (eq(here, dest)) {
    piece.walkTo = undefined;
    return null;
  }
  const full = marchRouteInner(state, piece, dest);
  if (!full?.length) return null;
  const budgetLeft = remainingMoveBudget(state, piece);
  const first = capMoveRange(state, piece, moveRangeAt(state, piece, here));
  if (first <= 0) return null;
  // Extras are fresh `move` lines paid from spendable AP. Reserve 1 for the base
  // action afterAction will charge — otherwise a spend cap of N walks N+1 chunks.
  // Armed spendMarch still buys one extra when at least 2 AP remain for base+extra.
  // Move cap still covers the whole march (3+3 must not beat a cap of 5).
  const spendable = apSpendable(piece);
  const extraBudget = Math.max(
    Math.max(0, spendable - 1),
    piece.spendMarch && spendable >= 2 ? 1 : 0,
  );
  let speed = first;
  let extraLeft = extraBudget;
  const bounds = [0, first];
  const stats = statsOf(piece.type);
  const taken: Hex[] = [];
  let facing = facingOf(piece);
  let cur = here;
  let strike: Hex | null = null;
  for (const next of full) {
    if (taken.length >= speed) break;
    if (budgetLeft !== null && taken.length >= budgetLeft) break;
    const step = dirBetween(cur, next, state.orientation);
    if (step === null) break;
    const probe: Piece = { ...piece, col: cur.col, row: cur.row, facing };
    if (blockedWalkDirs(probe).has(step)) break;
    if (!canWalkStep(state, piece, here, cur, next)) break;
    if (marchCombatAt(state, piece, next) && eq(next, dest)) {
      strike = next;
      facing = step;
      break;
    }
    if (!marchCanEnter(state, piece, cur, next)) break;
    taken.push(next);
    facing = step;
    cur = next;
    const enteredWater = enteringWater(state, here, next);
    const chargeForest = stats.charge > 0 && isForest(state, next);
    const climbedNow = taken.some((h) => hexHeight(state, h) > hexHeight(state, here));
    if (
      extraLeft > 0 &&
      taken.length === speed &&
      !enteredWater &&
      !chargeForest &&
      !climbedNow
    ) {
      const add = extraMoveRange(state, piece, cur, taken.length);
      if (add > 0) {
        const capped =
          budgetLeft === null ? speed + add : Math.min(speed + add, budgetLeft);
        if (capped > speed) {
          speed = capped;
          extraLeft -= 1;
          bounds.push(speed);
        }
      }
    }
    if (enteredWater || chargeForest) break;
  }
  // A chunk that runs out on a friendly stops on the empty hex before them.
  while (taken.length && friendlyOccupant(state, piece, taken[taken.length - 1]!)) {
    taken.pop();
  }
  if (taken.length) {
    const prevHex = taken.length > 1 ? taken[taken.length - 2]! : here;
    const step = dirBetween(prevHex, taken[taken.length - 1]!, state.orientation);
    if (step !== null) facing = step;
  } else {
    facing = facingOf(piece);
  }
  const approach = taken.length ? taken[taken.length - 1]! : here;
  if (strike && dirBetween(approach, strike, state.orientation) === null) strike = null;
  if (!taken.length && !strike) return null;
  let landed = approach;
  reveal(piece);
  const prevCovered = hexDamageCoveredKeys(state, piece);
  // Hazards on tiles walked this chunk, then on the melee hex before the strike.
  if (taken.length) applyWalkTokens(state, piece, here, taken, landed);
  if (strike && getPiece(state, piece.id)) {
    if (applyEnterHazards(state, piece, strike)) {
      // Died on spears / trap entering the fight — no hit.
    } else {
      const took = applyMarchStrike(state, piece, approach, strike);
      if (took && getPiece(state, piece.id)) {
        landed = strike;
        taken.push(strike);
        for (const tok of tokensAt(state.tokens, strike)) {
          if (tok.type === 'flag') claimFlag(state, piece, tok);
          if (tok.type === 'board') readBoard(state, piece, tok);
        }
      }
    }
  }
  if (!getPiece(state, piece.id)) {
    return {
      pieceId: piece.id,
      from: here,
      facing: facingOf(piece),
      path: taken.length ? taken.slice() : strike ? [strike] : [],
      stop: landed,
    };
  }
  const animPath =
    strike && !taken.some((h) => eq(h, strike)) ? [...taken, strike] : taken.slice();
  const anim: MarchAnim = {
    pieceId: piece.id,
    from: here,
    facing: facingOf(piece),
    path: animPath,
    stop: landed,
  };
  const climbed = taken.some((h) => hexHeight(state, h) > hexHeight(state, here));
  if (!eq(landed, here)) {
    piece.col = landed.col;
    piece.row = landed.row;
    refreshInspiration(state);
  }
  settleHide(state, piece, here);
  piece.facing = facing;
  const arrived = eq(landed, dest);
  if (taken.length && !strike) {
    state.log.push(
      arrived
        ? `${unitLog(piece)} arrives at ${landed.col},${landed.row}`
        : `${unitLog(piece)} marches to ${landed.col},${landed.row}`,
    );
  } else if (arrived) {
    state.log.push(`${unitLog(piece)} arrives at ${landed.col},${landed.row}`);
  } else if (taken.length) {
    state.log.push(`${unitLog(piece)} marches to ${approach.col},${approach.row}`);
  }
  if (!getPiece(state, piece.id)) return anim;
  if (!eq(landed, here)) applyHexDamagePush(state, piece, prevCovered);
  if (!getPiece(state, piece.id)) return anim;
  let used = 0;
  for (let i = 1; i < bounds.length - 1; i++) {
    if (taken.length > bounds[i]!) used += 1;
  }
  piece.spendMarch = undefined;
  let spent = 0;
  for (let i = 0; i < used && canSpendActionPoints(piece); i++) {
    spendActionPoints(piece);
    spent += 1;
    state.fxActionPoints = [...(state.fxActionPoints ?? []), { id: piece.id, kind: 'spend' }];
  }
  if (spent > 0) logApAction(state, piece, spent);
  if (climbed && !hasAllTerrain(piece) && canSpendActionPoints(piece)) {
    spendActionPoints(piece);
  }
  markMoved(piece);
  if (stats.moveBudget > 0 && taken.length) {
    state.scoutMoveSpent = (state.scoutMoveSpent ?? 0) + taken.length;
  }
  if (arrived) piece.walkTo = undefined;
  return anim;
}

/**
 * Spend this unit's activation on one march step.
 * Other standing marches still resolve if that ends the side-turn.
 */
export function performMarch(state: GameState, pieceId: string): GameState {
  if (state.winner) return state;
  const next = cloneState(state);
  const piece = getPiece(next, pieceId);
  if (!piece || !marchEligible(next, piece)) return next;
  const anim = applyOneMarch(next, piece);
  if (!anim) return next;
  queuedMarches.push(anim);
  const live = getPiece(next, pieceId);
  if (!live) return next;
  // Base action AP is paid in afterAction. Extras / climb already spent in applyOneMarch.
  // Leftover spendable AP (unused double time, drop grants) stay as further actions.
  const enteredWater = enteringWater(next, anim.from, anim.stop);
  const dropped = downSteps(next, anim.from, anim.path, anim.stop);
  afterAction(next, live, 'move', enteredWater, dropped);
  return next;
}

/** One turn of standing marches for units that were not given another order. */
function applyStandingMarches(state: GameState): void {
  const anims: MarchAnim[] = [];
  if (state.winner) {
    queuedMarches.push(...anims);
    return;
  }
  const candidates = state.pieces.filter((p) => marchEligible(state, p));
  candidates.sort((a, b) => {
    const da = marchRouteInner(state, a, a.walkTo!)?.length ?? 9999;
    const db = marchRouteInner(state, b, b.walkTo!)?.length ?? 9999;
    return da - db;
  });
  for (const id of candidates.map((p) => p.id)) {
    const piece = getPiece(state, id);
    if (!piece || !marchEligible(state, piece)) continue;
    const anim = applyOneMarch(state, piece);
    if (!anim) continue;
    anims.push(anim);
    // performMarch pays the base action via afterAction; end-of-turn marches
    // must charge it here so extras (spendable-1) do not leave a free AP.
    const live = getPiece(state, id);
    if (live) spendActionPoints(live, 1);
  }
  queuedMarches.push(...anims);
}

function hasMarchDestination(piece: Piece): boolean {
  return !!piece.walkTo;
}

/** Someone on this side still has to be ordered. Sleepers and marchers do not. */
function sideNeedsManualPlay(state: GameState): boolean {
  if (state.scoutPieceId) return true;
  return state.pieces.some(
    (p) =>
      p.side === state.turn &&
      !isSleeping(p) &&
      !hasMarchDestination(p) &&
      !hasActed(state, p.id),
  );
}

function autoWalkProgressKey(state: GameState): string {
  const pieces = state.pieces
    .map(
      (p) =>
        `${p.id}@${p.col},${p.row}:${p.hp ?? ''}:${p.walkTo ? `${p.walkTo.col},${p.walkTo.row}` : ''}`,
    )
    .sort()
    .join('|');
  const tokens = (state.tokens ?? [])
    .map((t) => `${t.type}@${t.col},${t.row}:${t.hp ?? ''}`)
    .sort()
    .join('|');
  return `${pieces}#${tokens}`;
}

let autoEnding = false;

/** True when a standing march would actually step or strike this turn. */
function sideCanAutoMarch(state: GameState): boolean {
  for (const p of state.pieces) {
    if (!marchEligible(state, p)) continue;
    const clone = cloneState(state);
    const piece = getPiece(clone, p.id);
    if (piece && applyOneMarch(clone, piece)) return true;
  }
  return false;
}

/**
 * End the side when every unit without a destination has acted.
 * Chains into the next side when that side is already fully ordered.
 * A side that cannot take a step keeps the turn, so the march can be cancelled.
 * Stops if a full lap moves nobody, so a blocked march does not spin.
 */
function maybeAutoEnd(state: GameState): void {
  if (autoEnding || state.winner) return;
  if (sideNeedsManualPlay(state)) return;
  autoEnding = true;
  try {
    let guard = 0;
    let idle = 0;
    while (!state.winner && !sideNeedsManualPlay(state) && guard < 128) {
      if (!sideCanAutoMarch(state)) break;
      const before = autoWalkProgressKey(state);
      state.log.push(sideLog(state.turn, 'Auto walk'));
      endSideTurn(state);
      guard += 1;
      if (state.winner) break;
      if (autoWalkProgressKey(state) === before) idle += 1;
      else idle = 0;
      if (idle >= Math.max(1, participatingSides(state).length)) break;
    }
  } finally {
    autoEnding = false;
  }
}

function endSideTurn(state: GameState): void {
  const finished = state.turn;
  clearScoutLock(state);
  applyStandingMarches(state);
  for (const p of state.pieces) p.spendMarch = undefined;
  checkWin(state);
  if (state.winner) return;
  tickShootCooldowns(state, finished);
  noteIdleLastTurn(state, finished);
  clearTurnFlags(state, finished);
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

/** True if another unit can still activate after `piece` is parked. */
function moreActivationsAfter(state: GameState, piece: Piece): boolean {
  const cap = clampUnitsPerTurn(state.unitsPerTurn);
  const n = state.actedIds.includes(piece.id)
    ? state.actedIds.length
    : state.actedIds.length + 1;
  return (
    n < cap &&
    state.pieces.some(
      (p) =>
        p.side === state.turn &&
        p.id !== piece.id &&
        !state.actedIds.includes(p.id) &&
        !isSleeping(p),
    )
  );
}

/** Finish this piece's activation; end the side-turn if the unit quota is spent. */
function finishActivation(state: GameState, piece: Piece): void {
  piece.rangedHit = undefined;
  piece.losHit = undefined;
  clearScoutLock(state);
  if (!state.actedIds.includes(piece.id)) state.actedIds.push(piece.id);
  checkWin(state);
  if (state.winner) return;
  if (!moreActivationsAfter(state, piece)) endSideTurn(state);
  else maybeAutoEnd(state);
}

function sideDefeated(state: GameState, side: Side): boolean {
  const mine = state.pieces.filter((p) => p.side === side);
  if (mine.length === 0) return true;
  if (state.hadKing[side] && !hasGeneral(mine, side)) {
    // Roguelite player: wait for succession on their next turn.
    if (state.generalSuccession && isPlayerControlled(state, side)) return false;
    return true;
  }
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
  // Vs AI: a dead human is a loss even if an ai-ally still has pieces.
  // Two foe teams (a hostile and an enemy, or two hostiles) keep fighting.
  if (matchHasEnemies(state)) {
    const humans = parts.filter((s) => isPlayerControlled(state, s));
    if (humans.length && humans.every((s) => sideDefeated(state, s))) {
      const foeTeams = new Set(
        live.filter((s) => isOpponentAi(state, s)).map((s) => coalition(state, s)),
      );
      const foe = live.find((s) => isOpponentAi(state, s));
      if (foe && foeTeams.size === 1) {
        state.winner = foe;
        return;
      }
    }
  }
  const liveTeams = new Set(live.map((s) => coalition(state, s)));
  if (liveTeams.size === 1) {
    state.winner = live[0];
    return;
  }
  const holder = parts.find((s) => teamHoldsAllFlags(state, s));
  if (holder) state.winner = holder;
}

/** Steps whose destination is exactly one height below the hex they left. */
function downSteps(state: GameState, from: Hex, path: Hex[], stop: Hex): number {
  let n = 0;
  let prev = from;
  for (const h of walkedHexes(from, path, stop)) {
    if (hexHeight(state, prev) - hexHeight(state, h) === 1) n += 1;
    prev = h;
  }
  return n;
}

/** Pay one owed downhill move. Move only — free, cannot shoot. */
function payDownhill(state: GameState, piece: Piece): void {
  state.downhillQueued = Math.max(0, (state.downhillQueued ?? 0) - 1);
  state.scoutPieceId = piece.id;
  state.scoutActionsLeft = 1;
  state.downhillMove = true;
  state.log.push(`${unitLog(piece)} downhill move`);
  checkWin(state);
}

function afterAction(
  state: GameState,
  piece: Piece,
  kind:
    | 'move'
    | 'shoot'
    | 'rotate'
    | 'build'
    | 'bash'
    | 'berserk'
    | 'reload'
    | 'inspire'
    | 'lunge',
  enteredWater = false,
  downCount = 0,
  /** Broke after the swim tax — base 1-hex from water does not need another AP. */
  freeWaterStep = false,
): void {
  markActed(piece);

  const downhillFree = state.downhillMove && state.scoutPieceId === piece.id;
  const free = downhillFree || freeWaterStep;

  // Stepping into water from land ends momentum. Already-wet is a normal activation
  // — the turn-start swim cost is a pool penalty (not against the spend cap).
  if (kind === 'move' && enteredWater) {
    if (!free && !hasAllTerrain(piece)) spendActionPoints(piece, 1);
    finishActivation(state, piece);
    return;
  }

  // Hill→land, plateau→hill, mountain→plateau. Flat ground and climbs do not.
  // A drop of 2+ cannot be stepped. The free +1 is part of this same AP —
  // leftover pool AP waits until after that bonus hex.
  if (kind === 'move' && downCount > 0) {
    if (!free) spendActionPoints(piece, 1);
    state.downhillQueued = (state.downhillQueued ?? 0) + downCount;
    payDownhill(state, piece);
    return;
  }

  if ((state.downhillQueued ?? 0) > 0 && state.scoutPieceId === piece.id) {
    if (!free) spendActionPoints(piece, 1);
    payDownhill(state, piece);
    return;
  }

  if (state.downhillMove) state.downhillMove = false;

  if (!free) spendActionPoints(piece, 1);

  const leftover = apSpendable(piece);
  if (leftover > 0) {
    state.scoutPieceId = piece.id;
    state.scoutActionsLeft = leftover;
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

function pathChargesThrough(state: GameState, piece: Piece, path: Hex[]): boolean {
  if (path.length < 2) return false;
  const from: Hex = { col: piece.col, row: piece.row };
  for (let i = 0; i < path.length - 1; i++) {
    const occ = occupantAt(state, piece, from, path[i]!);
    if (occ && isHostile(state, occ.side, piece.side)) return true;
  }
  return false;
}

/** Path rules for a piece (shared by highlights + charge resolution). */
function movePathOpts(
  state: GameState,
  piece: Piece,
  from: Hex = { col: piece.col, row: piece.row },
  charging = false,
): Omit<PathOpts, 'maxDist'> {
  const stats = statsOf(piece.type);
  const charge = charging ? chargeDamageOf(piece) : 0;
  const melee = meleeDamageOf(piece);
  const climb = climbLevelOf(piece);
  return {
    cols: state.cols,
    rows: state.rows,
    orientation: state.orientation,
    canStop: (h: Hex) => {
      if (!inBounds(state, h)) return false;
      const t = terrainAt(state, h);
      if (isWall(state, h)) return false;
      if (inWater(state, h) && !canPassWater(piece)) return false;
      if (terrainHeight(t) > climb) return false;
      const occ = occupantAt(state, piece, from, h);
      if (isPalisade(state, h)) {
        if (occ) {
          return isHostile(state, occ.side, piece.side) && melee > 0;
        }
        return melee > 0;
      }
      if (!occ) return true;
      if (canConvert(piece, occ)) return true;
      // Occupied dest is melee — 0 melee dmg cannot bump an enemy hex.
      return isHostile(state, occ.side, piece.side) && melee > 0;
    },
    canPass: (h: Hex) => {
      if (!inBounds(state, h)) return false;
      const t = terrainAt(state, h);
      if (isWall(state, h)) return false;
      if (isPalisade(state, h)) {
        return melee > 0 && breaksPalisadeAt(state, h, melee);
      }
      if (isForest(state, h) && charge > 0) return false;
      if (inWater(state, h)) return false;
      if (terrainHeight(t) > climb) return false;
      if (stats.passUnits) return true;
      const occ = occupantAt(state, piece, from, h);
      if (!occ) return true;
      // Charge may path onto/past a blocker (like a palisade). Occupied dest
      // behind only resolves if this charge would kill them; empty dest trampling
      // still goes through survivors. previewMove is the gate.
      if (charge > 0 && isHostile(state, occ.side, piece.side)) return true;
      if (charge > 0 && canConvert(piece, occ)) return true;
      return sameTeam(state, occ.side, piece.side);
    },
  };
}

/** Height only changes by 1 per step. Climbing needs 2 spendable AP (action + surcharge). */
function canWalkStep(
  state: GameState,
  piece: Piece,
  origin: Hex,
  fromHex: Hex,
  toHex: Hex,
): boolean {
  if (isWall(state, toHex)) return false;
  if (isPalisade(state, toHex)) return meleeDamageOf(piece) > 0;
  if (inWater(state, toHex) && !canPassWater(piece)) return false;
  if (enteringWater(state, fromHex, toHex) && refusesWaterJump(piece)) return false;
  const fh = hexHeight(state, fromHex);
  const th = hexHeight(state, toHex);
  if (th > climbLevelOf(piece)) return false;
  if (Math.abs(th - fh) > 1) return false;
  if (th > hexHeight(state, origin) && !hasAllTerrain(piece)) {
    if (actionPointsMax(piece) <= 0) return false;
    if (!canSpendActionPoints(piece, 2)) return false;
  }
  return true;
}

function pathClimbs(state: GameState, from: Hex, dest: Hex, path: Hex[]): boolean {
  const startH = hexHeight(state, from);
  if (hexHeight(state, dest) > startH) return true;
  return path.some((p) => hexHeight(state, p) > startH);
}

function pathEntersWater(state: GameState, from: Hex, dest: Hex, path: Hex[]): boolean {
  if (inWater(state, from)) return false;
  if (inWater(state, dest)) return true;
  return path.some((p) => inWater(state, p));
}

function pathSpendsAp(
  state: GameState,
  piece: Piece,
  from: Hex,
  dest: Hex,
  path: Hex[],
): boolean {
  if (hasAllTerrain(piece)) return false;
  return pathClimbs(state, from, dest, path);
}

/** Climb or entering water: no extra AP action / two-action chain through that hex. */
function pathHaltsExtra(
  state: GameState,
  piece: Piece,
  from: Hex,
  dest: Hex,
  path: Hex[],
): boolean {
  return (
    pathSpendsAp(state, piece, from, dest, path) ||
    pathEntersWater(state, from, dest, path)
  );
}

/** AP still available this activation (scout lock tracks leftover after the last spend). */
function remainingActionPoints(state: GameState, piece: Piece): number {
  if (state.scoutPieceId === piece.id) return Math.max(0, state.scoutActionsLeft ?? 0);
  return apSpendable(piece);
}

/** True when this click can chain a second move chunk (needs ≥2 spendable AP). */
function extraMoveAction(state: GameState, piece: Piece): boolean {
  return remainingActionPoints(state, piece) >= 2;
}

/** True if this piece can still spend ≥1 AP this activation. */
export function canBuyApExtra(state: GameState, pieceId: string): boolean {
  const piece = getPiece(state, pieceId);
  if (!piece || piece.side !== state.turn || state.winner) return false;
  if (hasActed(state, pieceId)) return false;
  if (state.scoutPieceId && state.scoutPieceId !== pieceId) return false;
  if (
    !state.scoutPieceId &&
    state.actedIds.length >= clampUnitsPerTurn(state.unitsPerTurn)
  ) {
    return false;
  }
  if (state.downhillMove && state.scoutPieceId === piece.id) return false;
  return canSpendActionPoints(piece, 1);
}

type StraightStop = { dist: number; path: Hex[]; via: Hex | null; firstDist: number };

/** Legal stop-hexes along the six hex axes, with the line walked to each. */
function straightMoveStops(
  state: GameState,
  piece: Piece,
  from: Hex = { col: piece.col, row: piece.row },
  range = activationMoveRange(state, piece),
  charging = false,
): Map<string, StraightStop> {
  const opts = movePathOpts(state, piece, from, charging);
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
 * Same-direction AP run: firstRange + extra `move` as one ray.
 * Via need not be a stop — pass through units if you don't turn.
 */
function straightExtraStops(
  state: GameState,
  piece: Piece,
  first: Map<string, StraightStop>,
  charging = false,
): Map<string, StraightStop> {
  const start = { col: piece.col, row: piece.row };
  const firstRange = activationMoveRange(state, piece);
  const extraMove = extraMoveRange(state, piece, start, firstRange);
  const left = remainingMoveBudget(state, piece);
  const max = left === null ? firstRange + extraMove + 3 : left;
  const opts = movePathOpts(state, piece, start, charging);
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
        firstClimb = pathHaltsExtra(state, piece, start, via, path.slice());
      }
      if (stop && dist > firstRange && via && !firstClimb && !first.has(key(next))) {
        if (dist <= firstRange + extraMoveRange(state, piece, via, firstRange)) {
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
  charging = false,
): Map<string, StraightStop> {
  const start = { col: piece.col, row: piece.row };
  const startKey = key(start);
  const out = new Map<string, StraightStop>();
  if (statsOf(piece.type).move <= 0) return out;
  for (const [, a] of first) {
    const via = a.path[a.path.length - 1];
    if (!via) continue;
    if (pieceAt(state, via)) continue;
    if (palisadeHpAt(state, via) > 0 && !breaksPalisadeAt(state, via, meleeDamageOf(piece))) {
      continue;
    }
    if (pathHaltsExtra(state, piece, start, via, a.path)) continue;
    const second = straightMoveStops(
      state,
      piece,
      via,
      extraMoveRange(state, piece, via, a.dist),
      charging,
    );
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

type PlusReach = { landing: Hex; landingPath: Hex[]; bonusPath: Hex[] };

/** Free downhill bonus: one hex past the drop. A climb is not free. */
function plusBonusStops(state: GameState, piece: Piece, first: Map<string, StraightStop>): Map<string, PlusReach> {
  const from: Hex = { col: piece.col, row: piece.row };
  const fromKey = key(from);
  const left = remainingMoveBudget(state, piece);
  const out = new Map<string, PlusReach>();
  for (const [k, stop] of first) {
    if (stop.via) continue;
    const landing = parseKey(k);
    if (downSteps(state, from, stop.path, landing) <= 0) continue;
    if (pathEntersWater(state, from, landing, stop.path)) continue;
    // Free +1 still burns the move cap.
    if (left !== null && stop.dist + 1 > left) continue;
    const bonus = straightMoveStops(state, piece, landing, 1);
    for (const [bk, b] of bonus) {
      if (bk === fromKey) continue;
      const held = first.get(bk);
      if (held && !held.via) continue;
      const hex = parseKey(bk);
      if (pathSpendsAp(state, piece, landing, hex, b.path)) continue;
      const prev = out.get(bk);
      if (prev && stop.dist >= prev.landingPath.length) continue;
      out.set(bk, { landing, landingPath: stop.path, bonusPath: b.path });
    }
  }
  return out;
}

/**
 * One hex past the free +1, and not still on the landing's ring.
 * A tile beside a free hex at the same depth stays unmarked.
 */
function energyBeyondPlus(
  state: GameState,
  piece: Piece,
  first: Map<string, StraightStop>,
  plus: Map<string, PlusReach>,
): Map<string, StraightStop> {
  const startKey = key({ col: piece.col, row: piece.row });
  const out = new Map<string, StraightStop>();
  for (const [pk, info] of plus) {
    const fromPlus = parseKey(pk);
    const beside = new Set(hexNeighbors(state, info.landing).map((h) => key(h)));
    const further = straightMoveStops(state, piece, fromPlus, 1);
    for (const [dk, b] of further) {
      if (dk === startKey || plus.has(dk) || first.has(dk) || beside.has(dk)) continue;
      const path = [...info.landingPath, ...info.bonusPath, ...b.path];
      const prev = out.get(dk);
      if (prev && prev.dist <= path.length) continue;
      out.set(dk, {
        dist: path.length,
        path,
        via: fromPlus,
        firstDist: info.landingPath.length,
      });
    }
  }
  return out;
}

function allMoveStops(
  state: GameState,
  piece: Piece,
  charging = false,
): Map<string, StraightStop> {
  const first = straightMoveStops(state, piece, undefined, undefined, charging);
  const start = { col: piece.col, row: piece.row };
  const left = remainingMoveBudget(state, piece);
  const trim = (m: Map<string, StraightStop>) => {
    for (const k of [...m.keys()]) {
      if (isBlockedFaceRay(piece, start, parseKey(k), state.orientation)) m.delete(k);
      else if (left !== null && (m.get(k)?.dist ?? 0) > left) m.delete(k);
    }
    return m;
  };
  if (!extraMoveAction(state, piece)) return trim(new Map(first));
  const out = new Map(first);
  for (const [k, stop] of straightExtraStops(state, piece, first, charging)) {
    keepBetterStop(out, k, stop);
  }
  for (const [k, stop] of twoActionStops(state, piece, first, charging)) {
    keepBetterStop(out, k, stop);
  }
  const plus = plusBonusStops(state, piece, first);
  for (const [k, stop] of energyBeyondPlus(state, piece, first, plus)) {
    keepBetterStop(out, k, stop);
  }
  return trim(out);
}

export type PlusStep = { landing: Hex; landingPath: Hex[]; bonusPath: Hex[] };

/**
 * Downhill landing that reaches `goal` on the free extra move.
 * The landing is a normal stop — the second step does not spend AP.
 */
export function plusStepPlan(state: GameState, pieceId: string, goal: Hex): PlusStep | null {
  const piece = getPiece(state, pieceId);
  if (!piece || isSleeping(piece)) return null;
  if (state.downhillMove && state.scoutPieceId === piece.id) return null;
  const from: Hex = { col: piece.col, row: piece.row };
  if (eq(from, goal)) return null;
  const reach = allMoveStops(state, piece);
  let best: (PlusStep & { first: number; second: number }) | null = null;
  for (const [k, stop] of reach) {
    if (stop.via) continue;
    const landing = parseKey(k);
    if (downSteps(state, from, stop.path, landing) <= 0) continue;
    if (pathEntersWater(state, from, landing, stop.path)) continue;
    const bonus = straightMoveStops(state, piece, landing, 1);
    const next = bonus.get(key(goal));
    if (!next) continue;
    if (pathSpendsAp(state, piece, landing, goal, next.path)) continue;
    const cand = {
      landing,
      landingPath: stop.path,
      bonusPath: next.path,
      first: stop.dist,
      second: next.dist,
    };
    if (
      !best ||
      cand.first < best.first ||
      (cand.first === best.first && cand.second < best.second)
    ) {
      best = cand;
    }
  }
  if (!best) return null;
  return { landing: best.landing, landingPath: best.landingPath, bonusPath: best.bonusPath };
}

/** Move/shoot range for a piece (ignores whose turn it is). */
export function rangeHighlights(state: GameState, pieceId: string): Highlight[] {
  const piece = getPiece(state, pieceId);
  if (!piece) return [];
  if (isSleeping(piece)) return [];

  const stats = statsOf(piece.type);
  const from: Hex = { col: piece.col, row: piece.row };
  const out: Highlight[] = [];
  for (const hex of buildSpots(state, piece)) out.push({ kind: 'build', hex });

  const fromTerrain = terrainAt(state, from);
  if (lungeDamageOf(piece) > 0) {
    for (const hex of lungeSpots(state, piece)) {
      out.push({ kind: 'lunge', hex });
    }
  }
  const reach = allMoveStops(state, piece);

  const inDownhill = state.downhillMove && state.scoutPieceId === piece.id;
  const plusReach = inDownhill ? new Map<string, PlusReach>() : plusBonusStops(state, piece, reach);
  const plain = new Map<string, StraightStop>();
  for (const [k, stop] of reach) if (!stop.via) plain.set(k, stop);
  const frontier = new Set(energyBeyondPlus(state, piece, plain, plusReach).keys());
  if (inDownhill) {
    const beside = new Set(hexNeighbors(state, from).map((h) => key(h)));
    for (const [fk, stop] of plain) {
      if (pathSpendsAp(state, piece, from, parseKey(fk), stop.path)) continue;
      const further = straightMoveStops(state, piece, parseKey(fk), 1);
      for (const dk of further.keys()) {
        if (dk === key(from) || plain.has(dk) || beside.has(dk)) continue;
        frontier.add(dk);
      }
    }
  }
  for (const [k, { dist, path, via }] of reach) {
    if (plusReach.has(k)) continue;
    const h = parseKey(k);
    const climbs = pathSpendsAp(state, piece, from, h, path);
    const extra = !!via;
    const throughFree = path.some((step) => plusReach.has(key(step)));
    // Full extra moves that run through the free hex stop at the one-hex frontier.
    if (throughFree && !frontier.has(k)) continue;
    if (inDownhill && via && !frontier.has(k)) continue;
    const pastFree = frontier.has(k) && (throughFree || (inDownhill && !!via));
    if (inDownhill && !via && !climbs) {
      out.push({ kind: 'move', hex: h, cost: dist, plus: true });
    } else if (climbs || extra) {
      out.push({
        kind: 'ap',
        hex: h,
        cost: dist,
        extra,
        beyondPlus: pastFree || undefined,
      });
    } else {
      out.push({ kind: 'move', hex: h, cost: dist });
    }
  }
  if (!inDownhill) {
    for (const pk of plusReach.keys()) out.push({ kind: 'plus', hex: parseKey(pk), cost: 0 });
  }

  if (chargeDamageOf(piece) > 0) {
    const canPay = canSpendActionPoints(piece, 1);
    // Survey extra reach when spendable AP is empty so those tiles can show the crossed bolt.
    const survey =
      canPay || actionPointsMax(piece) <= 0
        ? piece
        : {
            ...piece,
            actionPoints: Math.max(1, actionPointsLeft(piece) || actionPointsMax(piece)),
            apSpentThisTurn: 0,
          };
    const charged = allMoveStops(state, survey, true);
    for (const [k, { dist, path, via }] of charged) {
      if (!pathChargesThrough(state, piece, path)) continue;
      const h = parseKey(k);
      // A crash inside the normal move is just that move. AP is only the extra reach (or a climb).
      const needsAp = !!via || pathSpendsAp(state, piece, from, h, path);
      if (needsAp && !canPay) {
        out.push({ kind: 'charge', hex: h, cost: dist, extra: true, unpaid: true });
        continue;
      }
      out.push({ kind: 'charge', hex: h, cost: dist, extra: needsAp || undefined });
    }
  }

  // Display-only: climbs / extras that need more AP than is currently spendable.
  if (actionPointsMax(piece) > 0 && !canSpendActionPoints(piece, 2)) {
    const fresh: Piece = {
      ...piece,
      actionPoints: actionPointsMax(piece),
      apSpentThisTurn: 0,
    };
    for (const [k, { dist, via }] of allMoveStops(state, fresh)) {
      if (reach.has(k)) continue;
      out.push({ kind: 'apEmpty', hex: parseKey(k), cost: dist, extra: !!via });
    }
  } else if (refusesWaterJump(piece)) {
    // No AP pool to fake. Extra HP is enough to open the water step.
    const spared: Piece = { ...piece, hp: WATER_DROWN_HP + 1 };
    for (const [k, { dist, via }] of allMoveStops(state, spared)) {
      if (reach.has(k)) continue;
      const h = parseKey(k);
      if (!inWater(state, h)) continue;
      out.push({ kind: 'apEmpty', hex: h, cost: dist, extra: !!via });
    }
  }

  // Shoot — show full LOS range; only enemy (or splash aim) is actionable.
  // Downhill bonus is optional — shooting forfeits it.
  if (
    stats.shoot <= 0 ||
    isReloading(piece) ||
    isDepleted(piece) ||
    inWater(state, from)
  ) {
    return out; // move highlights only while reloading / empty / in water / no gun
  }

  const shootRange = shootRangeOf(piece) + terrainHeight(fromTerrain);
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
      // Stone walls / houses: rockets only. Wood (palisade / tree) is a bullet target.
      if (isWall(state, h) && !splash) continue;
      // Splash (bazooka/tank) can't impact on open water — bridges / cover are fine
      if (splash && inWater(state, h) && !isBlockedWalk(state, h)) continue;
      if (!losClear(state, from, h, shootLosMode(stats.shootArc), piece.side)) continue;

      const rawTarget = pieceAt(state, h);
      const target =
        rawTarget && rangedTargetVisible(state, rawTarget, piece.side)
          ? rawTarget
          : undefined;

      // Laser uses the same aim targets as arch/straight (enemy / wood).
      // Difference is resolve: the beam damages every unit on the line.
      // Never highlight friendly-occupied tiles as shoot targets.
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
      } else if (hasBreakableWood(state, h)) {
        // Empty palisade / tree / forest — chip with shoot damage
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
 * (including a leftover scout action).
 */
export function rotatePiece(state: GameState, pieceId: string, dir: HexDir): GameState {
  if (state.winner) return state;
  if (!isHexDir(dir)) return state;
  const next = cloneState(state);
  next.fxHits = [];
  next.fxActionPoints = [];
  next.fxBoard = undefined;
  const piece = getPiece(next, pieceId);
  if (!piece || piece.side !== next.turn) return state;
  if (!statsOf(piece.type).hexArmor) return state;
  if (isSleeping(piece)) return state;
  if (hasActed(next, piece.id)) return state;
  if (next.scoutPieceId && next.scoutPieceId !== piece.id) return state;
  forfeitDownhill(next, piece);
  const prevCovered = hexDamageCoveredKeys(next, piece);
  clearWalkOrder(next, piece);
  piece.facing = dir;
  next.log.push(`${unitLog(piece)} turns`);
  applyHexDamagePush(next, piece, prevCovered);
  afterAction(next, piece, 'rotate');
  return resolveNoMoves(next);
}

/** End the current side-turn (skip leftover units / scout lock). */
export function passTurn(state: GameState, keepFx = false): GameState {
  const next = cloneState(state);
  if (!keepFx) {
    next.fxHits = [];
    next.fxActionPoints = [];
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
  refreshInspiration(applied);
  const out = resolveNoMoves(applied);
  if (out !== applied) refreshInspiration(out);
  return out;
}

function applyActionInner(state: GameState, action: Action): GameState {
  if (action.kind === 'rotate') return rotatePiece(state, action.pieceId, action.dir);

  const next = cloneState(state);
  next.fxHits = [];
  next.fxActionPoints = [];
  next.fxBoard = undefined;
  if (next.winner) return next;
  // Combat below reads `inspired` — make sure it matches this board.
  refreshInspiration(next);

  if (action.kind === 'skip') {
    if (next.scoutPieceId) {
      const scout = getPiece(next, next.scoutPieceId);
      next.log.push(
        `${scout ? unitLog(scout) : sideLog(next.turn, 'Scout')} skips remaining action`,
      );
      if (scout) {
        forfeitDownhill(next, scout);
        finishActivation(next, scout);
      } else {
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

  // Any real order replaces a standing march.
  clearWalkOrder(next, piece);

  // Downhill +1 is optional — anything but the free bonus walk forfeits it.
  if (action.kind !== 'move' && action.kind !== 'charge') {
    forfeitDownhill(next, piece);
  }

  const highlights = legalHighlights(next, piece.id);

  if (action.kind === 'build') {
    if (!isBuildStructure(action.structure)) return state;
    if (!canBuild(next, piece.id, action.structure)) return state;
    if (!buildSpots(next, piece, action.structure).some((h) => eq(h, action.to))) {
      return state;
    }
    reveal(piece);
    const fence = builtPalisadeAt(next, action.to);
    const bridge = tokenOnHex(next.tokens, action.to, 'bridge');
    const pikes = tokenOnHex(next.tokens, action.to, 'pikes');
    if (action.structure === 'remove') {
      if (pikes) {
        next.tokens = next.tokens.filter(
          (t) => !(t.type === 'pikes' && t.col === action.to.col && t.row === action.to.row),
        );
        noteObstacleBroken(next, piece.side, 'pikes');
        next.log.push(`${unitLog(piece)} clears pikes`);
      } else if (fence) {
        next.tokens = next.tokens.filter(
          (t) => !(t.type === 'palisade' && t.col === action.to.col && t.row === action.to.row),
        );
        noteObstacleBroken(next, piece.side, 'palisade');
        next.log.push(`${unitLog(piece)} dismantles a palisade`);
      } else if (bridge) {
        next.tokens = next.tokens.filter(
          (t) => !(t.type === 'bridge' && t.col === action.to.col && t.row === action.to.row),
        );
        noteObstacleBroken(next, piece.side, 'bridge');
        next.log.push(`${unitLog(piece)} dismantles a bridge`);
      } else {
        return state;
      }
    } else if (fence || bridge || pikes) {
      return state;
    } else if (!isSide(piece.side)) {
      return state;
    } else if (action.structure === 'pikes') {
      next.tokens = [
        ...next.tokens,
        { type: 'pikes', col: action.to.col, row: action.to.row, owner: piece.side },
      ];
      next.log.push(`${unitLog(piece)} plants pikes`);
    } else if (action.structure === 'bridge') {
      if (terrainAt(next, action.to) !== 'water') return state;
      next.tokens = [
        ...next.tokens,
        { type: 'bridge', col: action.to.col, row: action.to.row },
      ];
      next.log.push(`${unitLog(piece)} builds a bridge`);
    } else {
      next.tokens = [
        ...next.tokens,
        { type: 'palisade', col: action.to.col, row: action.to.row },
      ];
      next.log.push(`${unitLog(piece)} builds a palisade`);
    }
    afterAction(next, piece, 'build');
    return next;
  }

  if (action.kind === 'shields') {
    if (!canShields(next, piece.id)) return state;
    piece.shieldsUp = true;
    next.log.push(`${unitLog(piece)} raises shields`);
    spendActionPoints(piece, 1);
    markActed(piece);
    finishActivation(next, piece);
    return next;
  }

  if (action.kind === 'inspire') {
    if (!canInspire(next, piece.id)) return state;
    piece.inspireUp = true;
    refreshInspiration(next);
    const lit = next.pieces.filter((p) => p.side === piece.side && p.inspired).length;
    next.log.push(
      `${unitLog(piece)} inspires` + (lit ? ` (${lit} inspired)` : ' — no one beside it'),
    );
    afterAction(next, piece, 'inspire');
    return next;
  }

  if (action.kind === 'reload') {
    if (!canReload(next, piece.id)) return state;
    // Keep firedThisTurn so the end-of-turn tick still skips once after a fire.
    piece.shootCooldown = Math.max(0, (piece.shootCooldown ?? 0) - 1);
    next.log.push(
      `${unitLog(piece)} reloads` +
        ((piece.shootCooldown ?? 0) > 0 ? ` (${piece.shootCooldown} left)` : ''),
    );
    afterAction(next, piece, 'reload');
    return next;
  }

  if (action.kind === 'bash') {
    if (!canBash(next, piece.id)) return state;
    reveal(piece);
    const amount = Math.max(1, meleeDamageOf(piece));
    const steps = planBash(next, piece);
    const bits: string[] = [];
    const dmgLines: string[] = [];
    for (const step of steps) {
      const victim = getPiece(next, step.victim.id);
      if (!victim) continue;
      if (step.outcome === 'unit' && step.other && step.to) {
        const other = getPiece(next, step.other.id);
        const beforeV = hpLeft(victim);
        const dmgV = applyDamage(next, victim, amount, 1, step.to, false, false, piece);
        noteStrike(next, victim, beforeV, dmgV, step.to);
        bits.push(hpBit(victim, dmgV.fatal, dmgV.remaining, dmgV.routed));
        dmgLines.push(dmgLine(next, victim, amount, 1, step.to));
        if (other) {
          const beforeO = hpLeft(other);
          const dmgO = applyDamage(next, other, amount, 1, step.from, false, false, piece);
          noteStrike(next, other, beforeO, dmgO, step.from);
          bits.push(hpBit(other, dmgO.fatal, dmgO.remaining, dmgO.routed));
          dmgLines.push(dmgLine(next, other, amount, 1, step.from));
        }
        continue;
      }
      if (step.outcome === 'slam' && step.to) {
        const before = hpLeft(victim);
        const dmg = applyDamage(next, victim, amount, 1, step.to, false, false, piece);
        noteStrike(next, victim, before, dmg, step.to);
        bits.push(
          `${hpBit(victim, dmg.fatal, dmg.remaining, dmg.routed)} slams`,
        );
        dmgLines.push(dmgLine(next, victim, amount, 1, step.to));
        continue;
      }
      if ((step.outcome === 'token' || step.outcome === 'forest') && step.to) {
        const wood = chipWoodAt(next, step.to, 1, piece.side);
        const before = hpLeft(victim);
        const dmg = applyDamage(next, victim, 1, 0, step.to, true, true, piece);
        noteStrike(next, victim, before, dmg, step.to, true);
        const woodBit = wood
          ? wood.remaining > 0
            ? `${wood.type} (${wood.remaining} left)`
            : wood.type
          : 'token';
        bits.push(`${hpBit(victim, dmg.fatal, dmg.remaining, dmg.routed)} / ${woodBit}`);
        dmgLines.push(dmgLine(next, victim, 1, 0, step.to, true));
      }
    }
    for (const step of steps) {
      if (step.outcome !== 'move' && step.outcome !== 'forest') continue;
      if (!step.to) continue;
      const victim = getPiece(next, step.victim.id);
      if (!victim) continue;
      const taken = next.pieces.some(
        (p) => p.id !== victim.id && p.col === step.to!.col && p.row === step.to!.row,
      );
      if (taken || isPalisade(next, step.to) || isWall(next, step.to)) continue;
      victim.col = step.to.col;
      victim.row = step.to.row;
      applyWalkTokens(next, victim, step.from, [step.to], step.to);
      refreshInspiration(next);
    }
    next.log.push(
      `${unitLog(piece)} bashes` +
        (bits.length ? ` ${bits.join(', ')}` : '') +
        dmgLines.join(''),
    );
    afterAction(next, piece, 'bash');
    return next;
  }

  if (action.kind === 'berserk') {
    if (!canBerserk(next, piece.id)) return state;
    reveal(piece);
    const fromHex: Hex = { col: piece.col, row: piece.row };
    const amount = meleeDamageOf(piece);
    const floor = amount > 0 ? 1 : 0;
    const bits: string[] = [];
    const dmgLines: string[] = [];
    for (const foe of berserkFoes(next, piece)) {
      const victim = getPiece(next, foe.id);
      if (!victim) continue;
      const before = hpLeft(victim);
      const dmg = applyDamage(next, victim, amount, floor, fromHex, false, false, piece);
      noteStrike(next, victim, before, dmg, fromHex);
      bits.push(hpBit(victim, dmg.fatal, dmg.remaining, dmg.routed));
      dmgLines.push(dmgLine(next, victim, amount, floor, fromHex));
    }
    next.log.push(
      `${unitLog(piece)} berserks ${bits.join(', ')}` + dmgLines.join(''),
    );
    afterAction(next, piece, 'berserk');
    return next;
  }

  if (action.kind === 'lunge') {
    if (!canLunge(next, piece.id)) return state;
    if (!lungeSpots(next, piece).some((h) => eq(h, action.to))) return state;
    reveal(piece);
    const fromHex: Hex = { col: piece.col, row: piece.row };
    let dir: HexDir | null = null;
    let near: Hex | null = null;
    for (let d = 0; d < 6; d++) {
      const n = neighborInDir(fromHex, d as HexDir, next.orientation);
      const f = neighborInDir(n, d as HexDir, next.orientation);
      if (eq(f, action.to)) {
        dir = d as HexDir;
        near = n;
        break;
      }
    }
    if (dir == null || !near) return state;
    const far = action.to;
    const amount = lungeDamageOf(piece);
    const floor = amount > 0 ? 1 : 0;
    const bits: string[] = [];
    const dmgLines: string[] = [];
    let killedFar = false;
    for (const h of [near, far]) {
      const foe = hostileNeighbor(next, piece, h);
      if (!foe) continue;
      const victim = getPiece(next, foe.id);
      if (!victim) continue;
      const before = hpLeft(victim);
      const dmg = applyDamage(next, victim, amount, floor, fromHex, false, false, piece);
      noteStrike(next, victim, before, dmg, fromHex);
      bits.push(hpBit(victim, dmg.fatal, dmg.remaining, dmg.routed));
      dmgLines.push(dmgLine(next, victim, amount, floor, fromHex));
      if (eq(h, far) && dmg.fatal) killedFar = true;
    }
    const nearClear = !pieceAt(next, near);
    const farClear = !pieceAt(next, far);
    let stepped = false;
    if (!killedFar && nearClear && farClear) {
      piece.col = far.col;
      piece.row = far.row;
      refreshInspiration(next);
      applyWalkTokens(next, piece, fromHex, [near, far], far);
      settleHide(next, piece, fromHex);
      stepped = true;
    }
    next.log.push(
      `${unitLog(piece)} lunges` +
        (bits.length ? ` ${bits.join(', ')}` : '') +
        (stepped
          ? ` → ${far.col},${far.row}`
          : killedFar
            ? ' — holds (kill on far hex)'
            : '') +
        dmgLines.join(''),
    );
    afterAction(next, piece, 'lunge');
    return next;
  }

  if (action.kind === 'move' || action.kind === 'charge') {
    const charging = action.kind === 'charge';
    const hit = charging
      ? highlights.find((h) => h.kind === 'charge' && eq(h.hex, action.to))
      : highlights.find(
          (h) => (h.kind === 'move' || h.kind === 'ap') && eq(h.hex, action.to),
        );
    if (!hit) return state;
    const fromHex = { col: piece.col, row: piece.row };
    // Swim tax already drained the pool; the base 1-hex from water still fires.
    const freeWaterStep =
      inWater(next, fromHex) &&
      hit.kind === 'move' &&
      !canSpendActionPoints(piece, 1);
    if (charging) {
      if (hit.kind !== 'charge' || hit.unpaid) return state;
      // extra = climb surcharge and/or second chunk → base action +1.
      if (hit.extra && !canSpendActionPoints(piece, 2)) return state;
    } else if (hit.kind === 'ap') {
      if (!canSpendActionPoints(piece, 2)) return state;
    } else if (hit.kind !== 'move') {
      return state;
    } else {
      // Free downhill +1 is already paid by the drop that granted it.
      const freeDownhill =
        !!hit.plus && next.downhillMove && next.scoutPieceId === piece.id;
      if (!freeDownhill && !freeWaterStep && !canSpendActionPoints(piece, 1)) {
        return state;
      }
    }

    // Cover-to-cover walks stay hidden; decide before reveal() clears the state.
    const quiet = !charging && quietMoveOk(next, piece, action.to, action.path);
    if (!quiet) reveal(piece);
    const plan = previewMove(next, piece, action.to, action.path, { charging });
    const walkPath = resolveMovePath(next, piece, action.to, action.path, charging);
    const prevCovered = hexDamageCoveredKeys(next, piece);
    const hitBits: string[] = [];
    const dmgLines: string[] = [];

    // Traps / facing spears resolve on enter — before melee / charge hits.
    for (const h of plan.hazardHexes) {
      if (applyEnterHazards(next, piece, h)) break;
    }

    const walkerLive = !!getPiece(next, piece.id);
    if (walkerLive) {
      for (const id of plan.converts) {
        const claimed = getPiece(next, id);
        if (!claimed || !isNeutralSide(claimed.side) || !isSide(piece.side)) continue;
        hitBits.push(unitLog(claimed));
        claimed.side = piece.side;
        dropUnitToken(claimed, 'neutral');
        refreshInspiration(next);
        const flag = tokenOnHex(next.tokens, { col: claimed.col, row: claimed.row }, 'flag');
        if (flag) flag.owner = piece.side;
      }

      for (const mh of plan.hits) {
        const victim = getPiece(next, mh.id);
        if (!victim) continue;
        tellStory(next, victim, 'touch');
        applyDamage(next, victim, mh.amount, 1, mh.from, false, false, piece);
        hitBits.push(hpBit(victim, mh.fatal, mh.remaining, mh.routed));
        dmgLines.push(dmgLine(next, victim, mh.amount, 1, mh.from));
      }

      for (const ph of plan.palisadeHits) {
        const tok = hexToken(next.tokens, ph.hex, (t) => isPalisadeToken(t.type));
        if (!tok) continue;
        if (ph.destroyed) {
          next.tokens = next.tokens.filter(
            (t) =>
              !(isPalisadeToken(t.type) && t.col === ph.hex.col && t.row === ph.hex.row),
          );
          noteObstacleBroken(next, piece.side, tok.type);
          hitBits.push(tok.type);
        } else {
          tok.hp = ph.remaining;
          hitBits.push(`${tok.type} (${ph.remaining} left)`);
        }
      }
    }

    const bounced = !eq(plan.stop, action.to);
    const apTag = hit.kind === 'ap' && !hit.extra ? ' (AP)' : '';
    const brokePal =
      plan.palisadeHits.some((p) => p.destroyed) && plan.hits.length === 0;
    const converted = plan.converts.length > 0 && plan.hits.length === 0;
    if (hitBits.length) {
      next.log.push(
        `${unitLog(piece)} ${
          converted
            ? 'converts'
            : bounced
              ? 'strikes'
              : brokePal
                ? 'breaks'
                : charging
                  ? 'charges'
                  : 'hits'
        } ${hitBits.join(', ')}` +
          (bounced
            ? ` — stops ${plan.stop.col},${plan.stop.row}`
            : ` → ${action.to.col},${action.to.row}`) +
          apTag +
          dmgLines.join(''),
      );
    } else if (walkerLive && quiet) {
      // Hidden step — nothing for the opponent to read in the log.
    } else if (walkerLive && bounced) {
      next.log.push(
        `${unitLog(piece)} stops short of ${action.to.col},${action.to.row}${apTag}`,
      );
    } else if (walkerLive) {
      next.log.push(
        `${unitLog(piece)} moves to ${action.to.col},${action.to.row}${apTag}`,
      );
    }

    const enteredWater = !inWater(next, fromHex) && inWater(next, plan.stop);
    const taken = next.pieces.some(
      (p) => p.id !== piece.id && p.col === plan.stop.col && p.row === plan.stop.row,
    );
    const palStanding = isPalisade(next, plan.stop);
    if (walkerLive && !taken && !palStanding) {
      piece.col = plan.stop.col;
      piece.row = plan.stop.row;
      refreshInspiration(next);
      // Flags / boards on hexes we occupy (hazards already resolved above).
      for (const h of walkedHexes(fromHex, walkPath, plan.stop)) {
        for (const tok of tokensAt(next.tokens, h)) {
          if (tok.type === 'flag') claimFlag(next, piece, tok);
          if (tok.type === 'board') readBoard(next, piece, tok);
        }
      }
      settleHide(next, piece, fromHex);
    }
    if (piece.walkTo && piece.col === piece.walkTo.col && piece.row === piece.walkTo.row) {
      piece.walkTo = undefined;
    }
    piece.facing = plan.facing;
    if (getPiece(next, piece.id)) applyHexDamagePush(next, piece, prevCovered);
    // Climb / charge-extra surcharge (+1). afterAction spends the base action AP.
    if (hit.kind === 'charge' && hit.extra) {
      spendActionPoints(piece);
      logApAction(next, piece);
    } else if (hit.kind === 'ap') {
      spendActionPoints(piece);
      if (hit.extra) logApAction(next, piece);
    }
    markMoved(piece);
    if (statsOf(piece.type).moveBudget > 0) {
      next.scoutMoveSpent = (next.scoutMoveSpent ?? 0) + hit.cost;
    }

    const walked = walkedHexes(fromHex, walkPath, plan.stop);
    const last = walked[walked.length - 1];
    const beforeLast = walked.length > 1 ? walked[walked.length - 2] : fromHex;
    const tailDrop =
      last && hexHeight(next, beforeLast) - hexHeight(next, last) === 1 ? 1 : 0;
    // The opening drop already paid for the free hex inside this walk.
    // A later drop, including the AP extra step, still grants downhill.
    const dropped =
      hit.kind === 'ap' && hit.beyondPlus
        ? tailDrop
        : downSteps(next, fromHex, walkPath, plan.stop);
    afterAction(next, piece, 'move', enteredWater, dropped, freeWaterStep);
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
    const splash = splashDamageOf(piece);
    for (const h of blast) {
      // Breakable wood takes the same blast damage units do (not a free demolish).
      if (hasBreakableWood(next, h)) {
        const forestSoak = forestSoaksShot(next, h);
        const wood = chipWoodAt(next, h, splash, piece.side);
        if (wood) {
          hitBits.push(
            wood.remaining > 0
              ? `${TOKEN_LABEL[wood.type]} (${wood.remaining} left)`
              : TOKEN_LABEL[wood.type],
          );
        }
        // Live forest wood soaks the occupant; felled forest still hides but no longer soaks.
        if (forestSoak) continue;
      }
      const t = pieceAt(next, h);
      // Splash hits everyone in the blast — friendlies included. Shields absorb (no dmg).
      if (t && splash > 0 && strikeShields(t)) {
        hitBits.push('shields');
      } else if (t && splash > 0) {
        const origin = eq(h, action.at) ? fromHex : action.at;
        const dmg = applyDamage(next, t, splash, 0, origin, true, true, piece);
        hitBits.push(hpBit(t, dmg.fatal, dmg.remaining, dmg.routed));
        dmgLines.push(dmgLine(next, t, splash, 0, origin, true));
      }
      // Stone walls / houses still crumble under rockets; tile underneath stays.
      if (isWall(next, h)) {
        const tok = hexToken(next.tokens, h, (item) => isWallToken(item.type));
        const kind = tok?.type ?? 'wall';
        if (terrainAt(next, h) === 'wall') next.terrain[h.row][h.col] = 'land';
        next.tokens = next.tokens.filter(
          (item) =>
            !(isWallToken(item.type) && item.col === h.col && item.row === h.row),
        );
        noteObstacleBroken(next, piece.side, kind);
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
  } else if (stats.shootArc === 'laser') {
    const fromHex: Hex = { col: piece.col, row: piece.row };
    const beam = laserBeamHexes(next, fromHex, action.at);
    const shot = shootDamageOf(piece);
    const hitBits: string[] = [];
    const dmgLines: string[] = [];
    for (const h of beam) {
      const forestSoak = forestSoaksShot(next, h);
      const wood = chipWoodAt(next, h, shot, piece.side);
      if (wood) {
        hitBits.push(
          wood.remaining > 0
            ? `${TOKEN_LABEL[wood.type]} (${wood.remaining} left)`
            : TOKEN_LABEL[wood.type],
        );
        // Live forest wood soaks; felled forest no longer protects the occupant.
        if (forestSoak) continue;
      }
      const t = pieceAt(next, h);
      if (!t || t.id === piece.id) continue;
      if (strikeShields(t)) {
        hitBits.push(`${unitLog(t)} shields`);
        continue;
      }
      const dmg = applyDamage(next, t, shot, 0, fromHex, true, true, piece);
      hitBits.push(hpBit(t, dmg.fatal, dmg.remaining, dmg.routed));
      dmgLines.push(dmgLine(next, t, shot, 0, fromHex, true));
    }
    next.log.push(
      `${unitLog(piece)} lasers toward ${action.at.col},${action.at.row}` +
        (hitBits.length ? ` — hits ${hitBits.join(' + ')}` : ' — no hits') +
        (stats.shootCooldown > 0 ? ' — reloading' : '') +
        ammoLog(piece, stats) +
        dmgLines.join(''),
    );
  } else {
    const t = pieceAt(next, action.at);
    const fromHex: Hex = { col: piece.col, row: piece.row };
    const shot = shootDamageOf(piece);
    if (!t || sameTeam(next, t.side, piece.side)) {
      const wood = chipWoodAt(next, action.at, shot, piece.side);
      if (!wood) return state;
      next.log.push(
        `${unitLog(piece)} shoots ${TOKEN_LABEL[wood.type]} at ${action.at.col},${action.at.row}` +
          (wood.remaining > 0
            ? ` — ${wood.remaining} left`
            : ' — destroyed') +
          (stats.shootCooldown > 0 ? ' — reloading' : '') +
          ammoLog(piece, stats),
      );
      afterAction(next, piece, 'shoot');
      return next;
    }
    if (strikeShields(t)) {
      next.log.push(
        `${unitLog(piece)} shoots ${unitLog(t)} at ${action.at.col},${action.at.row} — shields hold`,
      );
      afterAction(next, piece, 'shoot');
      return next;
    }
    if (isForest(next, action.at) && forestSoaksShot(next, action.at)) {
      const chip = chipForestAt(next, action.at, shot, piece.side);
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
    const dmg = applyDamage(next, t, shot, 0, fromHex, true, true, piece);
    next.log.push(
      `${unitLog(piece)} shoots ${unitLog(t)} at ${action.at.col},${action.at.row}` +
        (dmg.routed ? ' — routs' : dmg.fatal ? ' — kills' : ` — ${dmg.remaining} HP`) +
        (stats.shootCooldown > 0 ? ' — reloading' : '') +
        ammoLog(piece, stats) +
        dmgLine(next, t, shot, 0, fromHex, true),
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
    if (isSleeping(p)) continue;
    for (const h of legalHighlights(state, p.id)) {
      if (h.kind === 'move' || h.kind === 'ap') {
        actions.push({
          kind: 'move',
          pieceId: p.id,
          to: h.hex,
        });
      } else if (h.kind === 'charge' && !h.unpaid) {
        actions.push({ kind: 'charge', pieceId: p.id, to: h.hex });
      } else if (h.kind === 'shoot') {
        actions.push({ kind: 'shoot', pieceId: p.id, at: h.hex });
      }
      // shoot-range / apEmpty are display-only
    }
    if (canBuild(state, p.id, 'pikes')) {
      for (const to of buildSpots(state, p, 'pikes')) {
        // AI keeps planting traps; players pick Trap / Palisade / Bridge / Remove in the dock.
        actions.push({ kind: 'build', pieceId: p.id, to, structure: 'pikes' });
      }
    }
    if (canBash(state, p.id)) actions.push({ kind: 'bash', pieceId: p.id });
    if (canBerserk(state, p.id)) actions.push({ kind: 'berserk', pieceId: p.id });
    if (canLunge(state, p.id)) {
      for (const to of lungeSpots(state, p)) {
        actions.push({ kind: 'lunge', pieceId: p.id, to });
      }
    }
    if (canShields(state, p.id)) actions.push({ kind: 'shields', pieceId: p.id });
    if (canInspire(state, p.id)) actions.push({ kind: 'inspire', pieceId: p.id });
    if (canReload(state, p.id)) actions.push({ kind: 'reload', pieceId: p.id });
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
