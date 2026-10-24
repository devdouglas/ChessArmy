import './style.css';
import {
  ABILITY_BLURB,
  ABILITY_IDS,
  ABILITY_LABEL,
  abilitiesOf,
  applyAction,
  clampMaxTurns,
  clampUnitsPerTurn,
  combatValue,
  defeatKind,
  flagsHeldBy,
  mapFlags,
  winByFlags,
  hasActed,
  MAX_MAX_TURNS,
  MAX_UNITS_PER_TURN,
  MIN_MAX_TURNS,
  MIN_UNITS_PER_TURN,
  passTurn,
  restPiece,
  rotatePiece,
  getPiece,
  ammoLeft,
  hpLeft,
  hpMax,
  isDepleted,
  isReloading,
  legalHighlights,
  stickyMovePlan,
  pieceAt,
  isPalisade,
  isWall,
  previewMove,
  rangeHighlights,
  resolveMovePath,
  armorColor,
  facingOf,
  hasSplash,
  HEX_ARMOR_LABEL,
  HEX_ARMOR_SIDES,
  netDamage,
  wouldRout,
  splashBlast,
  staminaLeft,
  staminaMax,
  terrainHeight,
  isElevatedTerrain,
  STOCK_UNIT_TYPES,
  UNIT_CATEGORIES,
  UNIT_CATEGORY_LABEL,
  UNIT_ROLE_LABEL,
  UNIT_STATS,
  UNIT_TYPES,
  isAbilityId,
  isCustomUnitId,
  isUnitRole,
  CLIMB_LEVEL_LABEL,
  CLIMB_LEVELS,
  SHOOT_ARCS,
  SHOOT_ARC_LABEL,
  sanitizeClimbLevel,
  sanitizeShootArc,
  sanitizeUnitCategory,
  ARMY_CONTROLS,
  ARMY_CONTROL_LABEL,
  AI_STYLES,
  AI_STYLE_LABEL,
  SIDES,
  SIDE_LABEL,
  TOKEN_LABEL,
  TOKEN_TYPES,
  BOARD_TEXT_MAX,
  sanitizeBoardText,
  tokenAt,
  tokenIsNoTouch,
  UNIT_TOKEN_LABEL,
  UNIT_TOKEN_TYPES,
  defaultArmyControls,
  defaultAiStyles,
  hotseatArmyControls,
  isAiControlled,
  isPlayerControlled,
  isSide,
  isAiStyle,
  matchHasEnemies,
  participatingSides,
  playerCasualties,
  playerTeamWon,
  sameTeam,
  sanitizeArmyControls,
  sanitizeAiStyles,
  type Action,
  type ArmyControl,
  type AiStyle,
  type GameState,
  type Highlight,
  type Piece,
  type Side,
  type Terrain,
  type TileToken,
  type TokenType,
  type UnitCategory,
  type UnitTokenType,
  type UnitType,
  hasUnitToken,
  isTokenType,
  isUnitTokenType,
  sanitizeUnitTokens,
  isWalkableTerrain,
  liftWallTerrain,
  sanitizeTokens,
  hexDamageMarks,
  isBlockedFaceRay,
} from './engine';
import {
  dirBetween,
  eq,
  hexCorners,
  hexGridExtent,
  hexToPixel,
  key,
  parseKey,
  neighborInDir,
  pixelToHex,
  type Hex,
  type HexDir,
  type HexOrientation,
} from './hex';
import {
  COLS,
  RANDOM_COLS,
  MAX_COLS,
  MAX_ROWS,
  MIN_COLS,
  MIN_ROWS,
  ROWS,
  cloneTerrain,
  createInitialState,
  createStateFromTerrain,
  DEFAULT_MAP,
  emptyTerrain,
  maxTerrainCells,
  resizeTerrain,
  facingFromStamp,
  sanitizeStampFacing,
  type ArmyStamp,
  type MapOptions,
} from './map';
import {
  deleteLevel,
  getActiveLevelId,
  getDefaultLevelId,
  getLevel,
  getLevelsOverviewFilter,
  setLevelsOverviewFilter,
  LEVEL_CATEGORIES,
  LEVEL_CATEGORY_LABEL,
  levelLabel,
  levelsInCategory,
  listLevels,
  reorderLevels,
  saveLevel,
  isLevelCategory,
  sanitizeCategory,
  sanitizeLevelText,
  sanitizeTeaserText,
  sanitizeStarRule,
  setActiveLevelId,
  setDefaultLevelId,
  starRuleLabel,
  starRuleMet,
  starRulePossible,
  DEFAULT_STAR_2,
  DEFAULT_STAR_3,
  LEVEL_TEXT_MAX,
  TEASER_TEXT_MAX,
  STAR_VALUE_MAX,
  type LevelCategory,
  type SavedLevel,
  type StarRule,
} from './levels';
import {
  PERIODS,
  PERIOD_LABEL,
  eraIsWip,
  periodOptionLabel,
  applyPeriodTheme,
  getSelectedPeriod,
  sanitizePeriod,
  setSelectedPeriod,
  type Period,
} from './period';
import {
  STOCK_FORMATION_ID,
  bothStockStamps,
  captureFormation,
  defaultArmyStamps,
  deleteFormation,
  formationCombatValue,
  getDefaultFormationId,
  getFormation,
  listFormationsInPeriod,
  saveFormation,
  setDefaultFormationId,
  slotsEqual,
  stampFormation,
  stockFormation,
} from './formations';
import { pickAiAction } from './ai';
import {
  AI_RULE_CATEGORIES,
  AI_RULE_CATEGORY_LABEL,
  aiChecklistAreStock,
  categoryRules,
  isAiRuleId,
  isAiRuleOn,
  resetAiChecklist,
  setAiRule,
} from './ai-config';
import {
  actedBadgeSvg,
  ammoBadgeSvg,
  hpBadgeSvg,
  abilityBadgeSvg,
  pieceIconSvg,
  reloadBadgeSvg,
  tokenGlyphSvg,
  noTouchMarkSvg,
  facingPikeSvg,
  staminaEmptyMarkSvg,
  staminaHexMarkSvg,
  staminaPipsHtml,
  unitTokenGlyphSvg,
  pieceShotPipsHtml,
  hpPipsHtml,
  unitQuotaPipsHtml,
  starGlyphSvg,
} from './icons';
import { copyGlyphGroups, formatCopyHtml } from './copy';
import {
  CLAMP,
  copyUnit,
  deleteCopiedUnit,
  patchUnitAbility,
  patchUnitCategory,
  patchUnitKit,
  patchUnitName,
  patchUnitShootArc,
  patchUnitStat,
  resetUnitStats,
  unitStatsAreStock,
  type EditableStat,
} from './units';
import type { AbilityId } from './abilities';
import {
  flushStore,
  getServerStatus,
  onServerStatus,
  type ServerStatus,
  syncFromServer,
} from './sync';
import {
  bestStarsForLevel,
  clearLevelWins,
  hasWonLevel,
  recordLevelWin,
} from './progress';
import pkg from '../package.json';

const APP_NAME = 'There Will Be Legions';
const APP_VERSION = pkg.version;
document.title = `${APP_NAME} — v${APP_VERSION}`;

type Mode = 'hotseat' | 'ai';
type ActionMode = 'move' | 'shoot';
type Screen = 'start' | 'play' | 'levels' | 'editor' | 'units' | 'ai';
type PlaylistKind = 'campaign' | 'tutorial' | 'historical';
type Playlist = { kind: PlaylistKind; ids: string[]; index: number };
type MapPickKind = 'ai' | 'hotseat' | 'tutorial' | 'campaign';
type RandomArmyPick = { id: string; name: string; meta: string };
type RandomSetup = {
  kind: MapPickKind;
  yoursId: string;
  theirsId: string;
  aiStyle: AiStyle;
};
type UnitTokenBrush = `unit:${UnitTokenType}`;
type EditorBrush = Terrain | UnitType | TokenType | UnitTokenBrush | 'notouch' | 'erase';

const TERRAIN_BRUSHES: { id: Terrain; label: string }[] = [
  { id: 'land', label: 'Land' },
  { id: 'water', label: 'Water' },
  { id: 'high', label: 'Hill (lvl.1)' },
  { id: 'plateau', label: 'Plateau (lvl.2)' },
  { id: 'rock', label: 'Mountain (lvl.3)' },
];

function isTerrainBrush(b: EditorBrush): b is Terrain {
  return TERRAIN_BRUSHES.some((t) => t.id === b);
}

function isUnitBrush(b: EditorBrush): b is UnitType {
  return (UNIT_TYPES as readonly string[]).includes(b);
}

function isTokenBrush(b: EditorBrush): b is TokenType {
  return isTokenType(b) && b !== 'notouch';
}

function isUnitTokenBrush(b: EditorBrush): b is UnitTokenBrush {
  return b.startsWith('unit:') && isUnitTokenType(b.slice(5));
}

function unitTokenFromBrush(b: UnitTokenBrush): UnitTokenType {
  return b.slice(5) as UnitTokenType;
}

function isNoTouchBrush(b: EditorBrush): b is 'notouch' {
  return b === 'notouch';
}

let mapOpts: MapOptions = { ...DEFAULT_MAP };
let defaultLevelId: string | null = getDefaultLevelId();
let defaultFormationId: string | null = getDefaultFormationId();
let activeLevelId: string | null = defaultLevelId ?? getActiveLevelId();
let mode: Mode = 'ai';
let screen: Screen = 'start';
let selectedPeriod: Period = getSelectedPeriod();
let randomSetup: RandomSetup | null = null;
let randomArmies: Omit<RandomSetup, 'kind'> | null = null;
const RANDOM_UNITS_PER_TURN = 6;
let state: GameState = bootState();
let briefingOpen = false;
/** Play: reread / walk-on message board. */
let boardPopup: { text: string } | null = null;
/** Editor: hex whose board text is being edited. */
let editorBoardHex: Hex | null = null;
let playlist: Playlist | null = null;
let mapPick: MapPickKind | null = null;
let unitEditorCategory: UnitCategory = sanitizeUnitCategory(selectedPeriod);
const unitEditorOpen = new Set<UnitType>();
let sidebarMoreOpen = false;
let selectedId: string | null = null;
/** Hex where both move-onto and shoot are legal — wait for Move/Shoot pick. */
let pendingHex: Hex | null = null;
let highlights: Highlight[] = [];
let hoverHex: Hex | null = null;
let hoverPath: Hex[] = [];
/** Path drawn when the dest was chosen — the unit walks this. */
let commitPath: Hex[] = [];
let aiThinking = false;
let animating = false;
let rotatePreviewDir: HexDir | null = null;

/** Editor draft */
let editorTerrain: Terrain[][] = emptyTerrain();
let editorOrientation: HexOrientation = 'flat';
let editorBrush: EditorBrush = 'land';
let editorLevelId: string | null = null;
let editorName = 'New level';
let editorCategory: LevelCategory = 'skirmish';
let editorPeriod: Period = selectedPeriod;
let editorUnitsPerTurn = 5;
let editorMaxTurns = 0;
let editorTeaserText = '';
let editorStartText = '';
let editorWinText = '';
let editorLoseText = '';
let editorStar2: StarRule = { ...DEFAULT_STAR_2 };
let editorStar3: StarRule = { ...DEFAULT_STAR_3 };
let editorPieces: ArmyStamp[] = [];
let editorTokens: TileToken[] = [];
let editorArmySide: Side = 'red';
let editorControls: Record<Side, ArmyControl> = defaultArmyControls();
let editorAiStyles: Record<Side, AiStyle> = defaultAiStyles();
let editorUnitCategory: UnitCategory = sanitizeUnitCategory(selectedPeriod);
let editorFormationId: string | null = STOCK_FORMATION_ID;
let editorFormationName = 'New army';
let editorArmiesOpen = false;
let editorGlyphsOpen = false;
/** Last copy textarea focused — glyph chips insert here. */
let editorCopyFieldId: string | null = null;
let editorPainting = false;
let editorDirty = false;
let editorPointerAbort: AbortController | null = null;
const savedLevelsFilter = getLevelsOverviewFilter();
let levelsFilter: LevelCategory = savedLevelsFilter.category;
let levelsPeriodFilter: Period = savedLevelsFilter.period;

function currentGrid(): {
  cols: number;
  rows: number;
  orientation: HexOrientation;
} {
  if (screen === 'editor') {
    return {
      cols: editorTerrain[0]?.length ?? COLS,
      rows: editorTerrain.length || ROWS,
      orientation: editorOrientation,
    };
  }
  return {
    cols: state.cols,
    rows: state.rows,
    orientation: state.orientation,
  };
}

/** Fit board to viewport (iPad portrait/landscape + desktop). */
function computeLayout() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const stacked = vw < 1024;
  const editor = screen === 'editor';
  const chromeH = stacked
    ? editor
      ? vh < 700
        ? 300
        : 360
      : vh < 700
        ? 168
        : 200
    : editor
      ? 290
      : 160;
  const sideW = stacked ? 0 : Math.min(300, vw * 0.28);
  const padX = stacked ? 16 : 28;
  const availW = Math.max(240, vw - sideW - padX);
  const availH = Math.max(220, vh - chromeH);
  const { cols, rows, orientation } = currentGrid();
  const extent = hexGridExtent(cols, rows, 1, orientation);
  const sizeByW = availW / (extent.w + 1.2);
  const sizeByH = availH / (extent.h + 0.5);
  const hex = Math.max(14, Math.min(40, Math.floor(Math.min(sizeByW, sizeByH))));

  return {
    hexSize: hex,
    pad: Math.max(18, Math.round(hex * 1.05)),
    pieceIcon: Math.max(14, Math.round(hex * 0.75)),
  };
}

let { hexSize: HEX_SIZE, pad: PAD, pieceIcon: PIECE_ICON } = computeLayout();
const MOVE_MS = 300;
const SHOT_FLIGHT_MS = 320;
const SHOT_IMPACT_MS = 280;
const HIT_FLASH_MS = 110;
const ROUT_MS = 560;

function applyLayout(next = computeLayout(), rerender = true): boolean {
  const changed =
    next.hexSize !== HEX_SIZE || next.pad !== PAD || next.pieceIcon !== PIECE_ICON;
  HEX_SIZE = next.hexSize;
  PAD = next.pad;
  PIECE_ICON = next.pieceIcon;
  if (changed && rerender) render();
  return changed;
}

function refreshLayout() {
  applyLayout(computeLayout(), true);
}

function clipStamps(pieces: ArmyStamp[], cols: number, rows: number): ArmyStamp[] {
  const seen = new Set<string>();
  const out: ArmyStamp[] = [];
  for (const p of pieces) {
    if (p.col < 0 || p.col >= cols || p.row < 0 || p.row >= rows) continue;
    const k = `${p.col},${p.row}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const unitTokens = sanitizeUnitTokens(p.unitTokens);
    out.push({
      type: p.type,
      col: p.col,
      row: p.row,
      side: p.side,
      unitTokens: unitTokens.length ? unitTokens : undefined,
      facing: sanitizeStampFacing(p.side, p.facing),
    });
  }
  return out;
}

function seedArmies(cols: number, rows: number): ArmyStamp[] {
  return defaultArmyStamps(cols, rows, editorPeriod) ?? bothStockStamps(cols, rows);
}

function playArmies(
  cols: number,
  rows: number,
  level?: SavedLevel | null,
): ArmyStamp[] | null {
  if (level && Array.isArray(level.armies)) return level.armies;
  return defaultArmyStamps(cols, rows, level?.period ?? selectedPeriod);
}

function matchControls(lvl?: SavedLevel | null): Record<Side, ArmyControl> {
  if (mode === 'hotseat') return hotseatArmyControls();
  if (lvl) return sanitizeArmyControls(lvl.armyControls);
  return defaultArmyControls();
}

function applyHotseatTint() {
  const el = document.documentElement;
  if (screen === 'play' && mode === 'hotseat') {
    el.dataset.hotseat = state.winner ?? state.turn;
  } else {
    delete el.dataset.hotseat;
  }
}

function matchAiStyles(lvl?: SavedLevel | null): Record<Side, AiStyle> {
  if (lvl) return sanitizeAiStyles(lvl.aiStyles);
  if (randomArmies && mode !== 'hotseat') {
    return { ...defaultAiStyles(), blue: randomArmies.aiStyle };
  }
  return defaultAiStyles();
}

function randomArmyChoices(): RandomArmyPick[] {
  const era = selectedPeriod;
  const out: RandomArmyPick[] = [];
  if (era === 'modern') {
    out.push({ id: STOCK_FORMATION_ID, name: 'Standard', meta: `${RANDOM_COLS} wide` });
  }
  for (const f of listFormationsInPeriod(era)) {
    out.push({
      id: f.id,
      name: f.name,
      meta: `${f.slots.length} pcs · ${formationCombatValue(f.slots)}`,
    });
  }
  return out;
}

function formationByPickId(id: string, cols: number, rows: number) {
  if (id === STOCK_FORMATION_ID) return stockFormation(cols, rows);
  return getFormation(id) ?? stockFormation(cols, rows);
}

function randomMatchArmies(cols: number, rows: number): ArmyStamp[] {
  if (randomArmies) {
    return [
      ...stampFormation(
        formationByPickId(randomArmies.yoursId, cols, rows),
        'red',
        cols,
        rows,
      ),
      ...stampFormation(
        formationByPickId(randomArmies.theirsId, cols, rows),
        'blue',
        cols,
        rows,
      ),
    ];
  }
  return (
    defaultArmyStamps(cols, rows, selectedPeriod) ?? bothStockStamps(cols, rows)
  );
}

function openRandomSetup(kind: MapPickKind) {
  const picks = randomArmyChoices();
  const valid = (id: string | null | undefined) =>
    !!id && picks.some((p) => p.id === id);
  const fallback = picks[0]?.id ?? STOCK_FORMATION_ID;
  const def = valid(getDefaultFormationId())
    ? getDefaultFormationId()!
    : fallback;
  const other = picks.find((p) => p.id !== def)?.id ?? def;
  randomSetup = {
    kind,
    yoursId: valid(randomArmies?.yoursId) ? randomArmies!.yoursId : def,
    theirsId: valid(randomArmies?.theirsId) ? randomArmies!.theirsId : other,
    aiStyle: randomArmies?.aiStyle ?? 'aggressive',
  };
  render();
}

function confirmRandomSetup() {
  if (!randomSetup) return;
  if (!randomArmyChoices().length) return;
  randomArmies = {
    yoursId: randomSetup.yoursId,
    theirsId: randomSetup.theirsId,
    aiStyle: randomSetup.aiStyle,
  };
  const kind = randomSetup.kind;
  randomSetup = null;
  mapPick = null;
  mode = kind === 'hotseat' ? 'hotseat' : 'ai';
  playlist = null;
  screen = 'play';
  activeLevelId = null;
  setActiveLevelId(null);
  startMatch(true);
}

function bootState(): GameState {
  if (defaultLevelId && !getLevel(defaultLevelId)) {
    if (activeLevelId === defaultLevelId) activeLevelId = null;
    defaultLevelId = null;
    setDefaultLevelId(null);
  }
  const bootId = defaultLevelId ?? activeLevelId;
  if (bootId) {
    const lvl = getLevel(bootId);
    if (lvl) {
      activeLevelId = bootId;
      return withLevelRules(
        createStateFromTerrain(
          lvl.terrain,
          levelLabel(lvl),
          lvl.orientation,
          playArmies(lvl.cols, lvl.rows, lvl),
          matchControls(lvl),
          lvl.tokens,
          matchAiStyles(lvl),
        ),
        lvl,
      );
    }
  }
  return withLevelRules(
    createInitialState(
      mapOpts,
      randomMatchArmies(RANDOM_COLS, ROWS),
      matchControls(),
      matchAiStyles(),
    ),
  );
}

function startMatch(reshuffleRandom = true) {
  clearSelection();
  aiThinking = false;
  animating = false;
  briefingOpen = false;
  boardPopup = null;
  if (activeLevelId) {
    const lvl = getLevel(activeLevelId);
    if (lvl) {
      state = withLevelRules(
        createStateFromTerrain(
          lvl.terrain,
          levelLabel(lvl),
          lvl.orientation,
          playArmies(lvl.cols, lvl.rows, lvl),
          matchControls(lvl),
          lvl.tokens,
          matchAiStyles(lvl),
        ),
        lvl,
      );
      briefingOpen = !!sanitizeLevelText(lvl.startText) || canSkipPlayedLevel();
      applyLayout(computeLayout(), false);
      render();
      void playPendingFx();
      void maybeAi();
      return;
    }
    activeLevelId = null;
    setActiveLevelId(null);
  }
  if (reshuffleRandom) {
    mapOpts = readMapInputs();
    state = withLevelRules(
      createInitialState(
        mapOpts,
        randomMatchArmies(RANDOM_COLS, ROWS),
        matchControls(),
        matchAiStyles(),
      ),
    );
  } else {
    // Keep current terrain layout; respawn armies
    state = withLevelRules(
      createStateFromTerrain(
        state.terrain,
        undefined,
        state.orientation,
        randomMatchArmies(state.cols, state.rows),
        matchControls(),
        state.tokens,
        matchAiStyles(),
      ),
    );
  }
  applyLayout(computeLayout(), false);
  render();
  void playPendingFx();
  void maybeAi();
}

function withLevelRules(s: GameState, lvl?: SavedLevel | null): GameState {
  s.unitsPerTurn = clampUnitsPerTurn(
    lvl?.unitsPerTurn ?? RANDOM_UNITS_PER_TURN,
  );
  s.maxTurns = clampMaxTurns(lvl?.maxTurns ?? 0);
  s.aiStyles = sanitizeAiStyles(lvl?.aiStyles ?? s.aiStyles);
  s.actedIds = [];
  return s;
}

function applyEditorGrid(cols: number, rows: number): void {
  const next = resizeTerrain(editorTerrain, cols, rows);
  const same =
    next.length === editorTerrain.length &&
    (next[0]?.length ?? 0) === (editorTerrain[0]?.length ?? 0);
  if (same) {
    // Snap inputs if they were out of range
    render();
    return;
  }
  const lifted = liftWallTerrain(next, editorTokens);
  editorTerrain = lifted.terrain;
  editorPieces = clipStamps(editorPieces, next[0]?.length ?? cols, next.length);
  editorTokens = sanitizeTokens(lifted.tokens, next[0]?.length ?? cols, next.length);
  editorDirty = true;
  applyLayout(computeLayout(), false);
  render();
}

function applyEditorOrientation(o: HexOrientation): void {
  if (o !== 'pointy' && o !== 'flat') return;
  if (o === editorOrientation) return;
  editorOrientation = o;
  editorDirty = true;
  applyLayout(computeLayout(), false);
  render();
}

const app = document.querySelector<HTMLDivElement>('#app')!;

function wait(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}

async function playPendingFx(): Promise<void> {
  const hits = state.fxHits;
  const stam = state.fxStamina ?? [];
  const board = state.fxBoard;
  const gains = stam.filter((x) => x.kind === 'gain');
  const spends = stam.filter((x) => x.kind === 'spend');
  if (!hits?.length && !gains.length && !spends.length && !board) {
    if (state.fxHits || state.fxStamina || state.fxBoard) {
      state = { ...state, fxHits: undefined, fxStamina: undefined, fxBoard: undefined };
    }
    return;
  }
  state = { ...state, fxHits: undefined, fxStamina: undefined, fxBoard: undefined };
  if (hits?.length) await flashDamaged(hits);
  if (gains.length || spends.length) {
    render();
    if (gains.length) await flashStamina(gains, 'stam-gain');
    if (spends.length) await flashStamina(spends, 'stam-spend');
  }
  if (board?.text) boardPopup = { text: board.text };
}

function flashDamaged(
  hits: readonly { id: string; fatal?: boolean; routed?: boolean; dealt: number }[],
): Promise<void> {
  if (!hits.length) return Promise.resolve();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dying = false;
  let routing = false;
  let maxN = 0;
  for (const hit of hits) {
    const routed = !!hit.routed;
    const n = Math.max(0, Math.floor(hit.dealt));
    if (n <= 0 && !routed) continue;
    const el = document.querySelector(`g.piece-unit[data-id="${CSS.escape(hit.id)}"]`);
    if (!el) continue;
    el.classList.remove('hit', 'dying', 'routing');
    void (el as SVGElement).getBoundingClientRect();
    (el as SVGElement).style.setProperty('--hit-n', String(Math.max(1, n)));
    if (routed) {
      el.classList.add('routing');
      routing = true;
    } else {
      el.classList.add(hit.fatal ? 'dying' : 'hit');
      if (hit.fatal) dying = true;
    }
    if (n > maxN) maxN = n;
  }
  if (maxN <= 0 && !routing) return Promise.resolve();
  if (reduce) return wait(140);
  if (routing) return wait(Math.max(ROUT_MS, dying ? HIT_FLASH_MS * Math.max(1, maxN) + 140 : 0));
  const blink = HIT_FLASH_MS * Math.max(1, maxN);
  return wait(dying ? blink + 140 : blink);
}

function flashStamina(
  events: readonly { id: string }[],
  cls: 'stam-gain' | 'stam-spend',
): Promise<void> {
  if (!events.length) return Promise.resolve();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let any = false;
  for (const ev of events) {
    const el = document.querySelector(`g.piece-unit[data-id="${CSS.escape(ev.id)}"]`);
    if (!el) continue;
    el.classList.remove('stam-gain', 'stam-spend');
    void (el as SVGElement).getBoundingClientRect();
    el.classList.add(cls);
    any = true;
  }
  if (!any) return Promise.resolve();
  return wait(reduce ? 140 : HIT_FLASH_MS * 2);
}

function viewOrientation(): HexOrientation {
  return screen === 'editor' ? editorOrientation : state.orientation;
}

function pixelOf(h: Hex): { x: number; y: number } {
  const { x, y } = hexToPixel(h, HEX_SIZE, viewOrientation());
  return { x: x + PAD, y: y + PAD };
}

function shootMarkSvg(x: number, y: number, target: boolean): string {
  const r = HEX_SIZE * 0.18;
  const tick = HEX_SIZE * 0.28;
  const gap = HEX_SIZE * 0.065;
  const cls = target ? 'shoot-mark target' : 'shoot-mark';
  const pip = target
    ? `<circle class="crosshair-pip" r="${(HEX_SIZE * 0.032).toFixed(2)}" />`
    : '';
  return `<g class="${cls}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)})">
    <circle class="crosshair-ring" r="${r.toFixed(2)}" />
    <path class="crosshair-ticks" d="M 0 ${(-tick).toFixed(2)} V ${(-gap).toFixed(2)} M 0 ${gap.toFixed(2)} V ${tick.toFixed(2)} M ${(-tick).toFixed(2)} 0 H ${(-gap).toFixed(2)} M ${gap.toFixed(2)} 0 H ${tick.toFixed(2)}" />
    ${pip}
  </g>`;
}

function hexRotateMarkSvg(x: number, y: number, col: number, row: number): string {
  const bw = Math.max(26, HEX_SIZE * 0.88);
  const bh = Math.max(11, HEX_SIZE * 0.32);
  const fs = Math.max(6.2, HEX_SIZE * 0.19);
  return `<g class="hex-rotate-btn" data-col="${col}" data-row="${row}" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)})">
    <rect x="${(-bw / 2).toFixed(1)}" y="${(-bh / 2).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${(bh / 2).toFixed(1)}" />
    <text text-anchor="middle" dominant-baseline="middle" font-size="${fs.toFixed(1)}">Turn</text>
  </g>`;
}

/** Degrees to rotate a piece so local -Y (icon "up") matches current facing. */
function cubeDirRotation(from: Hex, dir: HexDir): number {
  const o = viewOrientation();
  const n = neighborInDir(from, dir, o);
  const a = hexToPixel(from, HEX_SIZE, o);
  const b = hexToPixel(n, HEX_SIZE, o);
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90;
}

function facingRotation(piece: Piece): number {
  return cubeDirRotation({ col: piece.col, row: piece.row }, facingOf(piece));
}

function aimedPiece(p: Piece): Piece {
  if (p.id !== selectedId || rotatePreviewDir == null) return p;
  return { ...p, facing: rotatePreviewDir };
}

/** `to` as an equivalent angle within ±180° of `from` (short arc). */
function shortestAngle(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return from + d;
}

async function animateMoveAlong(
  g: SVGGElement,
  piece: Piece,
  path: Hex[],
  stop: Hex,
  dest: Hex,
  beforeStep?: (hex: Hex) => Promise<void>,
): Promise<void> {
  const from = { col: piece.col, row: piece.row };
  const destPx = pixelOf(dest);
  const stopPx = pixelOf(stop);
  const facingEl = g.querySelector('.piece-facing');
  g.classList.add('moving');

  const bumpToward = async (fromPx: { x: number; y: number }, toPx: { x: number; y: number }) => {
    const bump = {
      x: fromPx.x + (toPx.x - fromPx.x) * 0.4,
      y: fromPx.y + (toPx.y - fromPx.y) * 0.4,
    };
    g.style.transition = `transform ${MOVE_MS * 0.55}ms ease-out`;
    g.setAttribute('transform', `translate(${bump.x}, ${bump.y})`);
    await wait(MOVE_MS * 0.55);
    g.style.transition = `transform ${MOVE_MS * 0.45}ms ease-out`;
    g.setAttribute('transform', `translate(${fromPx.x}, ${fromPx.y})`);
    await wait(MOVE_MS * 0.45);
  };

  if (eq(stop, from) || !path.length) {
    await bumpToward(stopPx, destPx);
    return;
  }

  let stopIdx = path.findIndex((h) => eq(h, stop));
  if (stopIdx < 0) stopIdx = path.length - 1;
  const walked = path.slice(0, stopIdx + 1);
  const stepMs = Math.max(90, Math.round(MOVE_MS / walked.length));
  const ori = viewOrientation();
  let prev = from;
  let deg = facingRotation(piece);

  void g.getBoundingClientRect();
  for (const h of walked) {
    if (beforeStep) await beforeStep(h);
    const step = dirBetween(prev, h, ori);
    const px = pixelOf(h);
    g.style.transition = `transform ${stepMs}ms linear`;
    if (step !== null) {
      const nextDeg = facingRotation({ ...piece, col: prev.col, row: prev.row, facing: step });
      void tweenFacing(facingEl, deg, nextDeg, stepMs);
      deg = nextDeg;
    }
    g.setAttribute('transform', `translate(${px.x}, ${px.y})`);
    await wait(stepMs);
    prev = h;
  }

  if (!eq(stop, dest)) await bumpToward(stopPx, destPx);
}

function tweenFacing(
  el: Element | null,
  from: number,
  to: number,
  ms: number,
): Promise<void> {
  if (!el) return Promise.resolve();
  const target = shortestAngle(from, to);
  if (Math.abs(target - from) < 0.25) {
    el.setAttribute('transform', `rotate(${target})`);
    return Promise.resolve();
  }
  const t0 = performance.now();
  return new Promise((resolve) => {
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / ms);
      const e = 1 - (1 - u) * (1 - u);
      el.setAttribute('transform', `rotate(${from + (target - from) * e})`);
      if (u < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

function ringArmor(type: UnitType): number {
  const s = UNIT_STATS[type];
  return s.hexArmor ? s.armorFront : s.armor;
}

function hexVerts(r: number, o: HexOrientation): { x: number; y: number }[] {
  const start = o === 'flat' ? 0 : -30;
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i + start);
    return { x: r * Math.cos(a), y: r * Math.sin(a) };
  });
}

/** Cube dir whose neighbor sits behind board-hex edge `i`. */
function edgeCubeDir(edge: number, o: HexOrientation): HexDir {
  const start = o === 'flat' ? 0 : -30;
  const edgeAng = ((60 * edge + start + 30) * Math.PI) / 180;
  const origin: Hex = { col: 2, row: 2 };
  let best: HexDir = 0;
  let bestD = Infinity;
  for (let d = 0; d < 6; d++) {
    const n = neighborInDir(origin, d as HexDir, o);
    const a = hexToPixel(origin, 10, o);
    const b = hexToPixel(n, 10, o);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const diff = Math.abs(Math.atan2(Math.sin(ang - edgeAng), Math.cos(ang - edgeAng)));
    if (diff < bestD) {
      bestD = diff;
      best = d as HexDir;
    }
  }
  return best;
}

function pieceBodySvg(piece: Piece, pr: number): string {
  const s = UNIT_STATS[piece.type];
  if (!s.hexArmor) {
    return `<circle class="piece-bg" cx="0" cy="0" r="${pr}"
      fill="${pieceColor(piece.side)}" stroke="${armorColor(s.armor)}" stroke-width="2.2" />`;
  }
  const o = viewOrientation();
  const facing = facingOf(piece);
  const rim = 3;
  const outer = hexVerts(pr, o);
  const innerR = Math.max(2, pr - rim);
  const inner = hexVerts(innerR, o);
  const bands = outer
    .map((a, i) => {
      const b = outer[(i + 1) % 6];
      const c = inner[(i + 1) % 6];
      const d = inner[i];
      const dir = edgeCubeDir(i, o);
      const rel = (((dir - facing) % 6) + 6) % 6;
      const fill = armorColor(s[HEX_ARMOR_SIDES[rel]]);
      return `<polygon class="piece-shield" points="${a.x.toFixed(2)},${a.y.toFixed(2)} ${b.x.toFixed(2)},${b.y.toFixed(2)} ${c.x.toFixed(2)},${c.y.toFixed(2)} ${d.x.toFixed(2)},${d.y.toFixed(2)}" fill="${fill}" />`;
    })
    .join('');
  return `${bands}
    <polygon class="piece-bg" points="${hexCorners(0, 0, innerR, o)}" fill="${pieceColor(piece.side)}" />`;
}

function readMapInputs(): MapOptions {
  const waterEl = app.querySelector<HTMLInputElement>('#map-water');
  const rockEl = app.querySelector<HTMLInputElement>('#map-rock');
  const palisadeEl = app.querySelector<HTMLInputElement>('#map-palisade');
  const highEl = app.querySelector<HTMLInputElement>('#map-high');
  const plateauEl = app.querySelector<HTMLInputElement>('#map-plateau');
  return {
    waterCount: waterEl ? Number(waterEl.value) : mapOpts.waterCount,
    rockCount: rockEl ? Number(rockEl.value) : mapOpts.rockCount,
    palisadeCount: palisadeEl ? Number(palisadeEl.value) : mapOpts.palisadeCount,
    highCount: highEl ? Number(highEl.value) : mapOpts.highCount,
    plateauCount: plateauEl ? Number(plateauEl.value) : mapOpts.plateauCount,
  };
}

function reset(reshuffle = true) {
  startMatch(reshuffle);
}

function showStart() {
  editorPainting = false;
  briefingOpen = false;
  boardPopup = null;
  editorBoardHex = null;
  randomSetup = null;
  screen = 'start';
  playlist = null;
  mapPick = null;
  aiThinking = false;
  animating = false;
  clearSelection();
  render();
}

function skirmishMaps(): SavedLevel[] {
  return levelsInCategory('skirmish', selectedPeriod);
}

function tutorialMaps(): SavedLevel[] {
  return levelsInCategory('tutorial', selectedPeriod);
}

/** Other play modes stay shut until every tutorial map in this era is cleared. */
function tutorialDone(): boolean {
  const maps = tutorialMaps();
  return maps.length === 0 || maps.every((l) => hasWonLevel(l.id));
}

function mapsForPick(kind: MapPickKind): SavedLevel[] {
  if (kind === 'tutorial') return tutorialMaps();
  if (kind === 'campaign') return levelsInCategory('campaign', selectedPeriod);
  return skirmishMaps();
}

function pickLocks(kind: MapPickKind): boolean {
  return kind === 'tutorial' || kind === 'campaign';
}

/** First in editor order is always open; a win on map i unlocks i+1. */
function sequenceUnlocked(maps: SavedLevel[], index: number): boolean {
  if (index <= 0) return true;
  const prev = maps[index - 1];
  return !!prev && hasWonLevel(prev.id);
}

/** Next tutorial/campaign map if this one is already cleared. */
function nextUnlockedSequential(): SavedLevel | null {
  const lvl = activeSavedLevel();
  if (!lvl || (lvl.category !== 'tutorial' && lvl.category !== 'campaign')) {
    return null;
  }
  if (!hasWonLevel(lvl.id)) return null;
  const maps = levelsInCategory(lvl.category, lvl.period);
  const i = maps.findIndex((l) => l.id === lvl.id);
  if (i < 0 || i + 1 >= maps.length) return null;
  if (!sequenceUnlocked(maps, i + 1)) return null;
  return maps[i + 1];
}

function skirmishPick(kind: MapPickKind): boolean {
  return kind === 'ai' || kind === 'hotseat';
}

function showMapPick(kind: MapPickKind) {
  if (kind !== 'tutorial' && !tutorialDone()) return;
  if (!mapsForPick(kind).length && !skirmishPick(kind)) return;
  editorPainting = false;
  briefingOpen = false;
  mapPick = kind;
  playlist = null;
  screen = 'start';
  aiThinking = false;
  animating = false;
  clearSelection();
  render();
}

function startPickedMap(id: string, kind: MapPickKind) {
  if (id === 'random') {
    if (!skirmishPick(kind)) return;
    openRandomSetup(kind);
    return;
  }
  const maps = mapsForPick(kind);
  const index = maps.findIndex((l) => l.id === id);
  if (index < 0) return;
  if (pickLocks(kind) && !sequenceUnlocked(maps, index)) return;
  mapPick = null;
  mode = kind === 'hotseat' ? 'hotseat' : 'ai';
  playlist = null;
  screen = 'play';
  activeLevelId = id;
  setActiveLevelId(id);
  startMatch(false);
}

function startPlaylist(kind: PlaylistKind) {
  if (kind !== 'tutorial' && !tutorialDone()) return;
  const levels = levelsInCategory(kind, selectedPeriod);
  if (!levels.length) return;
  playlist = { kind, ids: levels.map((l) => l.id), index: 0 };
  mode = 'ai';
  screen = 'play';
  activeLevelId = playlist.ids[0];
  setActiveLevelId(activeLevelId);
  startMatch(false);
}

function playlistLevel(): SavedLevel | null {
  if (!playlist) return null;
  const id = playlist.ids[playlist.index];
  return id ? getLevel(id) : null;
}

function playlistHasNext(): boolean {
  return !!playlist && playlist.index + 1 < playlist.ids.length;
}

function advancePlaylist() {
  if (!playlist || !playlistHasNext()) {
    showStart();
    return;
  }
  playlist = { ...playlist, index: playlist.index + 1 };
  activeLevelId = playlist.ids[playlist.index];
  setActiveLevelId(activeLevelId);
  screen = 'play';
  startMatch(false);
}

function starsEarned(): number {
  if (!playerTeamWon(state)) return 0;
  return starKinds().filter((k) => k === 'on').length;
}

function maybeRecordLevelWin(): void {
  if (screen !== 'play' || !playerTeamWon(state) || !activeLevelId) return;
  recordLevelWin(activeLevelId, starsEarned());
}

function canSkipPlayedLevel(): boolean {
  if (nextUnlockedSequential()) return true;
  return !!playlist && !!activeLevelId && hasWonLevel(activeLevelId) && playlistHasNext();
}

function skipBriefing() {
  const next = nextUnlockedSequential();
  if (next) {
    if (playlist) {
      const i = playlist.ids.indexOf(next.id);
      if (i >= 0) playlist = { ...playlist, index: i };
    }
    mode = 'ai';
    screen = 'play';
    activeLevelId = next.id;
    setActiveLevelId(next.id);
    startMatch(false);
    return;
  }
  advancePlaylist();
}

function loadEditorLevel(lvl: SavedLevel): void {
  const cols = lvl.cols || lvl.terrain[0]?.length || COLS;
  const rows = lvl.rows || lvl.terrain.length || ROWS;
  const lifted = liftWallTerrain(
    cloneTerrain(lvl.terrain),
    sanitizeTokens(lvl.tokens, cols, rows),
  );
  editorTerrain = lifted.terrain;
  editorOrientation = lvl.orientation;
  editorLevelId = lvl.id;
  editorName = lvl.name;
  editorCategory = lvl.category;
  editorPeriod = lvl.period;
  editorUnitsPerTurn = clampUnitsPerTurn(lvl.unitsPerTurn);
  editorMaxTurns = clampMaxTurns(lvl.maxTurns);
  editorTeaserText = sanitizeTeaserText(lvl.teaserText);
  editorStartText = sanitizeLevelText(lvl.startText);
  editorWinText = sanitizeLevelText(lvl.winText);
  editorLoseText = sanitizeLevelText(lvl.loseText);
  editorStar2 = sanitizeStarRule(lvl.star2, DEFAULT_STAR_2);
  editorStar3 = sanitizeStarRule(lvl.star3, DEFAULT_STAR_3);
  editorPieces = Array.isArray(lvl.armies)
    ? clipStamps(lvl.armies, cols, rows)
    : seedArmies(cols, rows);
  editorTokens = lifted.tokens;
  editorControls = sanitizeArmyControls(lvl.armyControls);
  editorAiStyles = sanitizeAiStyles(lvl.aiStyles);
}

function confirmLeaveEditor(): boolean {
  if (screen !== 'editor' || !editorDirty) return true;
  return confirm('Leave without saving this level?');
}

function unitCategoryForPeriod(period: Period): UnitCategory {
  return sanitizeUnitCategory(period);
}

function beginEditorSession(): void {
  editorUnitCategory = unitCategoryForPeriod(editorPeriod);
  editorBrush = 'land';
  editorArmySide = 'red';
  editorFormationId = STOCK_FORMATION_ID;
  editorFormationName = 'New army';
  editorPainting = false;
  editorPointerAbort?.abort();
  briefingOpen = false;
  boardPopup = null;
  editorBoardHex = null;
  screen = 'editor';
  clearSelection();
  aiThinking = false;
  animating = false;
  applyLayout(computeLayout(), false);
  render();
}

function enterLevels(syncPeriod = false) {
  if (syncPeriod) levelsPeriodFilter = selectedPeriod;
  setLevelsOverviewFilter(levelsFilter, levelsPeriodFilter);
  editorPainting = false;
  editorPointerAbort?.abort();
  briefingOpen = false;
  screen = 'levels';
  clearSelection();
  aiThinking = false;
  animating = false;
  render();
}

function playSavedLevel(id: string) {
  if (!getLevel(id)) return;
  playlist = null;
  mode = 'ai';
  screen = 'play';
  activeLevelId = id;
  setActiveLevelId(id);
  editorPainting = false;
  aiThinking = false;
  animating = false;
  startMatch(false);
}

function enterEditor(fromLevelId?: string | null) {
  const lvl = fromLevelId ? getLevel(fromLevelId) : null;
  if (!lvl) return;
  loadEditorLevel(lvl);
  editorDirty = false;
  beginEditorSession();
}

function newEditorLevel() {
  editorTerrain = emptyTerrain(COLS, ROWS);
  editorOrientation = 'flat';
  editorLevelId = null;
  editorName = 'New level';
  editorCategory = 'skirmish';
  editorPeriod = selectedPeriod;
  editorUnitsPerTurn = 5;
  editorMaxTurns = 0;
  editorTeaserText = '';
  editorStartText = '';
  editorWinText = '';
  editorLoseText = '';
  editorStar2 = { ...DEFAULT_STAR_2 };
  editorStar3 = { ...DEFAULT_STAR_3 };
  editorPieces = [];
  editorTokens = [];
  editorControls = defaultArmyControls();
  editorAiStyles = defaultAiStyles();
  editorDirty = false;
  beginEditorSession();
}

function enterEditorFromMatch() {
  editorTerrain = cloneTerrain(state.terrain);
  editorOrientation = state.orientation;
  editorLevelId = null;
  editorName = 'New level';
  editorCategory = 'skirmish';
  editorPeriod = selectedPeriod;
  editorUnitsPerTurn = clampUnitsPerTurn(state.unitsPerTurn);
  editorMaxTurns = clampMaxTurns(state.maxTurns);
  editorTeaserText = '';
  editorStartText = '';
  editorWinText = '';
  editorLoseText = '';
  editorStar2 = { ...DEFAULT_STAR_2 };
  editorStar3 = { ...DEFAULT_STAR_3 };
  editorPieces = clipStamps(
    state.pieces.map((p) => ({
      type: p.type,
      col: p.col,
      row: p.row,
      side: p.side,
      unitTokens: p.unitTokens,
      facing: p.facing,
    })),
    editorTerrain[0]?.length ?? COLS,
    editorTerrain.length || ROWS,
  );
  editorControls = sanitizeArmyControls(state.controls);
  editorAiStyles = sanitizeAiStyles(state.aiStyles);
  editorTokens = sanitizeTokens(
    state.tokens,
    editorTerrain[0]?.length ?? COLS,
    editorTerrain.length || ROWS,
  );
  editorDirty = true;
  beginEditorSession();
}

function enterUnits() {
  unitEditorCategory = unitCategoryForPeriod(selectedPeriod);
  editorPainting = false;
  editorPointerAbort?.abort();
  briefingOpen = false;
  screen = 'units';
  clearSelection();
  aiThinking = false;
  animating = false;
  render();
}

function enterAi() {
  editorPainting = false;
  editorPointerAbort?.abort();
  briefingOpen = false;
  screen = 'ai';
  clearSelection();
  aiThinking = false;
  animating = false;
  render();
}

function refreshEditorBoard() {
  const painting = editorPainting;
  const svg = app.querySelector('svg.board');
  if (svg) {
    svg.outerHTML = renderBoard();
    bindEditorBoard();
    editorPainting = painting;
  } else {
    render();
  }
}

function markEditorDirty() {
  editorDirty = true;
  const dirtyHint = app.querySelector<HTMLElement>('#editor-dirty');
  if (dirtyHint) dirtyHint.hidden = false;
}

function rotateEditorUnit(idx: number) {
  const p = editorPieces[idx];
  const next = ((facingFromStamp(p) + 1) % 6) as HexDir;
  editorPieces[idx] = {
    ...p,
    facing: sanitizeStampFacing(p.side, next),
  };
  markEditorDirty();
  refreshEditorBoard();
}

function paintEditorUnit(col: number, row: number) {
  if (!isUnitBrush(editorBrush)) return;
  const idx = editorPieces.findIndex((p) => p.col === col && p.row === row);
  if (
    idx >= 0 &&
    editorPieces[idx].type === editorBrush &&
    editorPieces[idx].side === editorArmySide
  ) {
    rotateEditorUnit(idx);
    return;
  }
  if (idx >= 0) editorPieces.splice(idx, 1);
  editorPieces.push({ type: editorBrush, col, row, side: editorArmySide });
  markEditorDirty();
  refreshEditorBoard();
}

function paintEditorToken(col: number, row: number) {
  if (!isTokenBrush(editorBrush)) return;
  if (!isWalkableTerrain(editorTerrain[row][col])) return;
  const idx = editorTokens.findIndex((t) => t.col === col && t.row === row);
  if (idx >= 0 && editorTokens[idx].type === editorBrush) return;
  const keepTouch = idx >= 0 && tokenIsNoTouch(editorTokens[idx]);
  if (idx >= 0) editorTokens.splice(idx, 1);
  editorTokens.push({
    type: editorBrush,
    col,
    row,
    ...(keepTouch ? { noTouch: true } : {}),
  });
  markEditorDirty();
  refreshEditorBoard();
}

function paintEditorNoTouch(col: number, row: number) {
  if (!isNoTouchBrush(editorBrush)) return;
  if (!isWalkableTerrain(editorTerrain[row][col])) return;
  const idx = editorTokens.findIndex((t) => t.col === col && t.row === row);
  const has = idx >= 0 && tokenIsNoTouch(editorTokens[idx]);
  if (!editorNoTouchStroke) editorNoTouchStroke = has ? 'remove' : 'add';
  if (editorNoTouchStroke === 'add' && has) return;
  if (editorNoTouchStroke === 'remove' && !has) return;
  if (editorNoTouchStroke === 'add') {
    if (idx < 0) editorTokens.push({ type: 'notouch', col, row });
    else editorTokens[idx] = { ...editorTokens[idx], noTouch: true };
  } else if (idx >= 0) {
    if (editorTokens[idx].type === 'notouch') editorTokens.splice(idx, 1);
    else {
      const next = { ...editorTokens[idx] };
      delete next.noTouch;
      editorTokens[idx] = next;
    }
  }
  markEditorDirty();
  refreshEditorBoard();
}

function paintEditorUnitToken(col: number, row: number) {
  if (!isUnitTokenBrush(editorBrush)) return;
  const kind = unitTokenFromBrush(editorBrush);
  const idx = editorPieces.findIndex((p) => p.col === col && p.row === row);
  if (idx < 0) return;
  const cur = sanitizeUnitTokens(editorPieces[idx].unitTokens);
  const has = cur.includes(kind);
  if (!editorUnitTokenStroke) editorUnitTokenStroke = has ? 'remove' : 'add';
  if (editorUnitTokenStroke === 'add' && has) return;
  if (editorUnitTokenStroke === 'remove' && !has) return;
  const next =
    editorUnitTokenStroke === 'add'
      ? [...cur, kind]
      : cur.filter((t) => t !== kind);
  editorPieces[idx] = {
    ...editorPieces[idx],
    unitTokens: next.length ? next : undefined,
  };
  markEditorDirty();
  refreshEditorBoard();
}

function paintEditorErase(col: number, row: number) {
  const pidx = editorPieces.findIndex((p) => p.col === col && p.row === row);
  const tidx = editorTokens.findIndex((t) => t.col === col && t.row === row);
  if (pidx < 0 && tidx < 0) return;
  if (pidx >= 0) editorPieces.splice(pidx, 1);
  if (tidx >= 0) editorTokens.splice(tidx, 1);
  markEditorDirty();
  refreshEditorBoard();
}

function openEditorBoard(col: number, row: number) {
  editorBoardHex = { col, row };
  editorPainting = false;
  editorPaintKey = null;
  render();
}

function paintEditorHex(col: number, row: number, first = true) {
  if (row < 0 || row >= editorTerrain.length) return;
  if (col < 0 || col >= editorTerrain[0].length) return;
  if (editorBrush === 'erase') {
    paintEditorErase(col, row);
    return;
  }
  if (isUnitBrush(editorBrush)) {
    paintEditorUnit(col, row);
    return;
  }
  if (isUnitTokenBrush(editorBrush)) {
    paintEditorUnitToken(col, row);
    return;
  }
  const boardTok = editorTokens.find(
    (t) => t.type === 'board' && t.col === col && t.row === row,
  );
  if (boardTok) {
    if (first) openEditorBoard(col, row);
    return;
  }
  const unitIdx = editorPieces.findIndex((p) => p.col === col && p.row === row);
  if (unitIdx >= 0) {
    rotateEditorUnit(unitIdx);
    return;
  }
  if (isNoTouchBrush(editorBrush)) {
    paintEditorNoTouch(col, row);
    return;
  }
  if (isTokenBrush(editorBrush)) {
    paintEditorToken(col, row);
    if (editorBrush === 'board') openEditorBoard(col, row);
    return;
  }
  if (!isTerrainBrush(editorBrush)) return;
  const prev = editorTerrain[row][col];
  if (prev === editorBrush) return;
  editorTerrain[row][col] = editorBrush;
  markEditorDirty();

  // High rims / units / tokens need a board refresh; otherwise update the hex class in place (keeps drag)
  if (
    isElevatedTerrain(prev) ||
    isElevatedTerrain(editorBrush)
  ) {
    refreshEditorBoard();
  } else {
    const poly = app.querySelector<SVGPolygonElement>(
      `polygon.hex[data-col="${col}"][data-row="${row}"]`,
    );
    if (poly) {
      const alt = editorBrush === 'land' && (col + row) % 2 ? ' alt' : '';
      poly.setAttribute('class', `hex ${editorBrush} editable${alt}`);
    }
  }
}

async function doSaveLevel(asNew: boolean, asDefault = false, thenPlay = false): Promise<void> {
  const nameEl = app.querySelector<HTMLInputElement>('#editor-name');
  if (nameEl) editorName = nameEl.value;
  const catEl = app.querySelector<HTMLSelectElement>('#editor-category');
  if (catEl) editorCategory = sanitizeCategory(catEl.value);
  const periodEl = app.querySelector<HTMLSelectElement>('#editor-period');
  if (periodEl) editorPeriod = sanitizePeriod(periodEl.value);
  const uptEl = app.querySelector<HTMLInputElement>('#editor-units-per-turn');
  if (uptEl) editorUnitsPerTurn = clampUnitsPerTurn(uptEl.value);
  const maxTurnsEl = app.querySelector<HTMLInputElement>('#editor-max-turns');
  if (maxTurnsEl) editorMaxTurns = clampMaxTurns(maxTurnsEl.value);
  const teaserEl = app.querySelector<HTMLTextAreaElement>('#editor-teaser-text');
  if (teaserEl) editorTeaserText = teaserEl.value;
  const startEl = app.querySelector<HTMLTextAreaElement>('#editor-start-text');
  if (startEl) editorStartText = startEl.value;
  const winEl = app.querySelector<HTMLTextAreaElement>('#editor-win-text');
  if (winEl) editorWinText = winEl.value;
  const loseEl = app.querySelector<HTMLTextAreaElement>('#editor-lose-text');
  if (loseEl) editorLoseText = loseEl.value;
  editorStar2 = readEditorStar(2);
  editorStar3 = readEditorStar(3);
  const saved = saveLevel(
    editorName,
    editorTerrain,
    asNew ? null : editorLevelId,
    editorOrientation,
    editorPieces,
    editorCategory,
    editorUnitsPerTurn,
    editorPeriod,
    {
      teaserText: editorTeaserText,
      startText: editorStartText,
      winText: editorWinText,
      loseText: editorLoseText,
    },
    { star2: editorStar2, star3: editorStar3 },
    editorControls,
    editorTokens,
    editorMaxTurns,
    editorAiStyles,
  );
  editorTeaserText = saved.teaserText;
  editorStartText = saved.startText;
  editorWinText = saved.winText;
  editorLoseText = saved.loseText;
  editorStar2 = saved.star2;
  editorStar3 = saved.star3;
  editorUnitsPerTurn = saved.unitsPerTurn;
  editorMaxTurns = saved.maxTurns;
  editorLevelId = saved.id;
  editorName = saved.name;
  editorTerrain = cloneTerrain(saved.terrain);
  editorTokens = saved.tokens ?? [];
  activeLevelId = saved.id;
  setActiveLevelId(saved.id);
  if (asDefault) {
    defaultLevelId = saved.id;
    setDefaultLevelId(saved.id);
  }
  const ok = await flushStore();
  editorDirty = !ok;
  if (thenPlay) {
    editorPainting = false;
    editorPointerAbort?.abort();
    playlist = null;
    mode = 'ai';
    screen = 'play';
    startMatch(false);
    return;
  }
  render();
}

function clearSelection() {
  selectedId = null;
  pendingHex = null;
  highlights = [];
  hoverHex = null;
  hoverPath = [];
  commitPath = [];
  rotatePreviewDir = null;
}

function livingOnSide(side: Side): { id: string }[] {
  return state.pieces.filter((p) => p.side === side);
}

function isSoloArmy(side: Side): boolean {
  return livingOnSide(side).length === 1;
}

function resetAim() {
  pendingHex = null;
  hoverHex = null;
  hoverPath = [];
  commitPath = [];
  rotatePreviewDir = null;
}

/** Last unit on that army stays selected when the activation / turn ends. */
function retainSelection(actingId: string): void {
  resetAim();
  const p = getPiece(state, actingId);
  if (p && isSoloArmy(p.side)) {
    selectedId = actingId;
    refreshHighlights();
    return;
  }
  selectedId = null;
  highlights = [];
}

function clearSelectionUnlessSolo(): void {
  if (selectedId) {
    const p = getPiece(state, selectedId);
    if (p && isSoloArmy(p.side)) {
      resetAim();
      refreshHighlights();
      return;
    }
  }
  clearSelection();
}

/** When a player side with one unit gets the turn, keep/restore that selection. */
function ensureSoloTurnSelection(): void {
  if (selectedId && !getPiece(state, selectedId)) {
    selectedId = null;
    highlights = [];
  }
  if (state.winner || !isPlayerControlled(state, state.turn)) return;
  const mine = livingOnSide(state.turn);
  if (mine.length !== 1) return;
  if (selectedId !== mine[0].id) {
    selectedId = mine[0].id;
    resetAim();
  }
  refreshHighlights();
}

function activeSavedLevel(): SavedLevel | null {
  return activeLevelId ? getLevel(activeLevelId) : null;
}

function levelCopy(kind: 'start' | 'win' | 'lose'): string {
  const lvl = activeSavedLevel();
  if (!lvl) return '';
  if (kind === 'start') return sanitizeLevelText(lvl.startText);
  if (kind === 'win') return sanitizeLevelText(lvl.winText);
  return sanitizeLevelText(lvl.loseText);
}

function levelStars(): { star2: StarRule; star3: StarRule } {
  const lvl = activeSavedLevel();
  return {
    star2: sanitizeStarRule(lvl?.star2, DEFAULT_STAR_2),
    star3: sanitizeStarRule(lvl?.star3, DEFAULT_STAR_3),
  };
}

function starKinds(): ['on' | 'pending' | 'off', 'on' | 'pending' | 'off', 'on' | 'pending' | 'off'] {
  const { star2, star3 } = levelStars();
  const turns = state.turnNumber;
  const cas = playerCasualties(state);
  const won = playerTeamWon(state);
  const lost = !!state.winner && !won;
  const live = (
    met: boolean,
    possible: boolean,
  ): 'on' | 'pending' | 'off' => {
    if (won) return met ? 'on' : 'off';
    if (lost) return 'off';
    return possible ? 'pending' : 'off';
  };
  return [
    live(won, true),
    live(starRuleMet(star2, turns, cas), starRulePossible(star2, turns, cas)),
    live(starRuleMet(star3, turns, cas), starRulePossible(star3, turns, cas)),
  ];
}

function flagOwnerForDraw(t: TileToken): Side | undefined {
  if (t.type !== 'flag') return t.owner;
  if (screen === 'editor') {
    const u = editorPieces.find((p) => p.col === t.col && p.row === t.row);
    if (u) return u.side;
  }
  return t.owner;
}

function flagGoalLabel(): string {
  const flags = mapFlags(screen === 'editor' ? { tokens: editorTokens } : state);
  if (!flags.length) return 'Win';
  const side =
    screen === 'play'
      ? (participatingSides(state).find((s) => isPlayerControlled(state, s)) ?? state.turn)
      : editorArmySide;
  const held = screen === 'play' ? flagsHeldBy(state, side) : flags.filter((t) => {
    const u = editorPieces.find((p) => p.col === t.col && p.row === t.row);
    return u?.side === side;
  }).length;
  if (flags.length === 1) return held ? 'Flag held' : 'Capture the flag';
  return `Capture all flags (${held}/${flags.length})`;
}

function starGoalsHtml(): string {
  const { star2, star3 } = levelStars();
  const kinds = starKinds();
  const labels = [flagGoalLabel(), starRuleLabel(star2), starRuleLabel(star3)];
  return `<ul class="star-goals" aria-label="Star goals">${labels
    .map(
      (label, i) =>
        `<li class="star-goal ${kinds[i]}" title="${escapeHtml(label)}">${starGlyphSvg(kinds[i], 16)}<span>${escapeHtml(label)}</span></li>`,
    )
    .join('')}</ul>`;
}

function endStarsHtml(): string {
  const { star2, star3 } = levelStars();
  const kinds = starKinds();
  const labels = [flagGoalLabel(), starRuleLabel(star2), starRuleLabel(star3)];
  return `<ul class="end-stars" aria-label="Stars earned">${labels
    .map(
      (label, i) =>
        `<li class="end-star ${kinds[i]}" title="${escapeHtml(label)}">${starGlyphSvg(kinds[i], 32)}</li>`,
    )
    .join('')}</ul>`;
}

function bestStarsHtml(id: string, size = 14): string {
  const best = bestStarsForLevel(id);
  const glyphs = [1, 2, 3]
    .map((n) => starGlyphSvg(n <= best ? 'on' : 'off', size))
    .join('');
  return `<span class="level-stars" aria-label="${best} of 3 stars">${glyphs}</span>`;
}

function endBestStarsHtml(): string {
  if (!activeLevelId) return '';
  const best = bestStarsForLevel(activeLevelId);
  if (best < 1) return '';
  return `<p class="end-best">Best on this map ${bestStarsHtml(activeLevelId, 16)}</p>`;
}

function readEditorStar(n: 2 | 3): StarRule {
  const fallback = n === 2 ? DEFAULT_STAR_2 : DEFAULT_STAR_3;
  const metric = app.querySelector<HTMLSelectElement>(
    `[data-star="${n}"][data-star-field="metric"]`,
  )?.value;
  const op = app.querySelector<HTMLSelectElement>(
    `[data-star="${n}"][data-star-field="op"]`,
  )?.value;
  const value = app.querySelector<HTMLInputElement>(
    `[data-star="${n}"][data-star-field="value"]`,
  )?.value;
  return sanitizeStarRule({ metric, op, value }, fallback);
}

function starRuleEditorRow(n: 2 | 3, rule: StarRule): string {
  return `<div class="star-rule-row">
    <span class="star-rule-mark">${starGlyphSvg('on', 15)}</span>
    <span class="star-rule-n">${n}</span>
    <select data-star="${n}" data-star-field="metric">
      <option value="turns"${rule.metric === 'turns' ? ' selected' : ''}>Turns</option>
      <option value="casualties"${rule.metric === 'casualties' ? ' selected' : ''}>Casualties</option>
    </select>
    <select data-star="${n}" data-star-field="op">
      <option value="lt"${rule.op === 'lt' ? ' selected' : ''}>&lt;</option>
      <option value="lte"${rule.op === 'lte' ? ' selected' : ''}>≤</option>
      <option value="eq"${rule.op === 'eq' ? ' selected' : ''}>=</option>
    </select>
    <input type="number" min="0" max="${STAR_VALUE_MAX}" value="${rule.value}" data-star="${n}" data-star-field="value" />
  </div>`;
}

function briefingBlocks(): boolean {
  return briefingOpen && !state.winner && (!!levelCopy('start') || canSkipPlayedLevel());
}

function boardBlocks(): boolean {
  return !!boardPopup && !state.winner;
}

function canControl(): boolean {
  if (briefingBlocks() || boardBlocks() || state.winner || aiThinking || animating) return false;
  return isPlayerControlled(state, state.turn);
}

/** Real options on one hex: move-onto and/or fire (not empty shoot-range). */
function hexActions(
  pieceId: string,
  hex: Hex,
): { canMove: boolean; canShoot: boolean } {
  const legal = legalHighlights(state, pieceId).filter(
    (h) => eq(h.hex, hex) && h.kind !== 'shoot-range' && h.kind !== 'rest',
  );
  return {
    canMove: legal.some((h) => h.kind === 'move' || h.kind === 'stamina'),
    canShoot: legal.some((h) => h.kind === 'shoot'),
  };
}

/** Real options anywhere: move hexes, or actual fire targets. */
function availableActions(pieceId: string): { canMove: boolean; canShoot: boolean } {
  const piece = getPiece(state, pieceId);
  if (!piece) return { canMove: false, canShoot: false };
  const all = highlightsFor(pieceId);
  const canMove = all.some((h) => h.kind === 'move' || h.kind === 'stamina');
  const canShoot =
    !isReloading(piece) && !isDepleted(piece) && all.some((h) => h.kind === 'shoot');
  return { canMove, canShoot };
}

function highlightsFor(pieceId: string): Highlight[] {
  const piece = getPiece(state, pieceId);
  if (!piece) return [];
  if (hasActed(state, pieceId)) return [];
  if (
    piece.side === state.turn &&
    canControl() &&
    (!state.scoutPieceId || state.scoutPieceId === pieceId)
  ) {
    return legalHighlights(state, pieceId);
  }
  return rangeHighlights(state, pieceId);
}

function refreshHighlights() {
  highlights = selectedId ? highlightsFor(selectedId) : [];
}

function selectPiece(id: string | null) {
  if (animating) return;
  selectedId = id;
  pendingHex = null;
  hoverHex = null;
  hoverPath = [];
  commitPath = [];
  rotatePreviewDir = null;
  refreshHighlights();
  render();
}

function canActWithSelected(): boolean {
  if (!selectedId || !canControl()) return false;
  const p = getPiece(state, selectedId);
  if (!p || p.side !== state.turn) return false;
  if (state.scoutPieceId && state.scoutPieceId !== selectedId) return false;
  if (hasActed(state, selectedId)) return false;
  return true;
}

async function resolvePending(kind: ActionMode) {
  if (!pendingHex || !selectedId || animating) return;
  const { canMove, canShoot } = hexActions(selectedId, pendingHex);
  if (kind === 'move' && !canMove) return;
  if (kind === 'shoot' && !canShoot) return;
  const hex = pendingHex;
  pendingHex = null;
  await tryAct(hex, kind);
}

async function playAnimatedAction(action: Action): Promise<void> {
  animating = true;

  if (action.kind === 'skip' || action.kind === 'rest' || action.kind === 'rotate') {
    state = applyAction(state, action);
    applyHotseatTint();
    updateChrome();
    await playPendingFx();
    animating = false;
    return;
  }

  const piece = getPiece(state, action.pieceId);
  if (!piece) {
    animating = false;
    return;
  }

  if (action.kind === 'move') {
    const path = resolveMovePath(state, piece, action.to, action.path);
    const plan = previewMove(state, piece, action.to, path);
    const g = document.querySelector<SVGGElement>(
      `g.piece-unit[data-id="${CSS.escape(piece.id)}"]`,
    );
    const flashHit = (h: (typeof plan.hits)[number]) => {
      const victim = getPiece(state, h.id);
      const dealt = victim ? Math.max(0, hpLeft(victim) - h.remaining) : 0;
      return {
        id: h.id,
        fatal: h.fatal,
        routed: h.routed,
        dealt: Math.max(dealt, h.routed ? 1 : 0),
      };
    };
    const routByHex = new Map<string, (typeof plan.hits)[number]>();
    for (const h of plan.hits) {
      if (!h.routed) continue;
      const v = getPiece(state, h.id);
      if (v) routByHex.set(key(v), h);
    }
    const flashed = new Set<string>();
    if (g) {
      await animateMoveAlong(g, piece, path, plan.stop, action.to, async (hex) => {
        const hit = routByHex.get(key(hex));
        if (!hit || flashed.has(hit.id)) return;
        flashed.add(hit.id);
        await flashDamaged([flashHit(hit)]);
      });
    } else await wait(MOVE_MS);
    const rest = plan.hits.filter((h) => !flashed.has(h.id));
    if (rest.length) await flashDamaged(rest.map(flashHit));
  } else {
    await animateShot(piece, action.at);
  }

  state = applyAction(state, action);
  applyHotseatTint();
  updateChrome();
  await playPendingFx();
  animating = false;
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string>,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function shotPoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  ctrl: { x: number; y: number } | null,
  t: number,
): { x: number; y: number } {
  if (!ctrl) {
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    };
  }
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * ctrl.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * ctrl.y + t * t * to.y,
  };
}

async function animateShot(piece: Piece, at: Hex): Promise<void> {
  const from = pixelOf({ col: piece.col, row: piece.row });
  const to = pixelOf(at);
  const stats = UNIT_STATS[piece.type];
  const arch = stats.shootArc === 'arch';
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const lift = arch ? Math.min(HEX_SIZE * 2.1, Math.max(HEX_SIZE * 0.55, dist * 0.32)) : 0;
  const ctrl = arch
    ? { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - lift }
    : null;
  const flightMs = arch ? SHOT_FLIGHT_MS + 70 : SHOT_FLIGHT_MS;
  const svg = document.querySelector('svg.board');
  if (!svg) {
    await wait(flightMs);
    return;
  }

  const layer = svgEl('g', { class: 'fx-layer' });
  svg.appendChild(layer);

  // muzzle flash
  layer.appendChild(
    svgEl('circle', {
      class: 'muzzle-flash',
      cx: String(from.x),
      cy: String(from.y),
      r: String(HEX_SIZE * 0.35),
    }),
  );

  const trail = arch
    ? svgEl('path', {
        class: 'shot-trail arch',
        fill: 'none',
        d: `M ${from.x} ${from.y} Q ${ctrl!.x} ${ctrl!.y} ${to.x} ${to.y}`,
      })
    : svgEl('line', {
        class: 'shot-trail',
        x1: String(from.x),
        y1: String(from.y),
        x2: String(to.x),
        y2: String(to.y),
      });
  layer.appendChild(trail);

  // projectile
  const bullet = svgEl('circle', {
    class: hasSplash(stats) ? 'shot-rocket' : 'shot-bullet',
    cx: String(from.x),
    cy: String(from.y),
    r: hasSplash(stats) ? '5' : '3.5',
  });
  layer.appendChild(bullet);

  const t0 = performance.now();
  await new Promise<void>((resolve) => {
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / flightMs);
      const e = 1 - (1 - u) * (1 - u);
      const p = shotPoint(from, to, ctrl, e);
      bullet.setAttribute('cx', String(p.x));
      bullet.setAttribute('cy', String(p.y));
      if (u < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });

  bullet.remove();
  trail.classList.add('fade');

  const fromHex = { col: piece.col, row: piece.row };
  const blast = hasSplash(stats) ? splashBlast(state, at, fromHex) : [at];
  const shotHits: { id: string; fatal: boolean; routed?: boolean; dealt: number }[] = [];
  for (const h of blast) {
    const { x, y } = pixelOf(h);
    layer.appendChild(
      svgEl('circle', {
        class: hasSplash(stats) ? 'impact-splash' : 'impact-hit',
        cx: String(x),
        cy: String(y),
        r: String(HEX_SIZE * 0.45),
      }),
    );
    const t = pieceAt(state, h);
    if (!t) continue;
    // Splash hits everyone (incl. friendlies); bullets skip friendlies
    if (!hasSplash(stats) && t.side === piece.side) continue;
    const dmgAmt = hasSplash(stats) ? stats.splashDamage : stats.shootDamage;
    if (dmgAmt <= 0) continue;
    const origin = hasSplash(stats) && !eq(h, at) ? at : fromHex;
    const net = netDamage(t, dmgAmt, 0, origin, state.orientation, true);
    const routed = wouldRout(state, t, origin);
    const dealt = Math.min(hpLeft(t), net);
    if (dealt <= 0 && !routed) continue;
    const fatal = routed || hpLeft(t) <= net;
    shotHits.push({
      id: t.id,
      fatal,
      routed,
      dealt: Math.max(dealt, routed ? 1 : 0),
    });
  }

  // center boom ring
  layer.appendChild(
    svgEl('circle', {
      class: hasSplash(stats) ? 'impact-ring splash' : 'impact-ring',
      cx: String(to.x),
      cy: String(to.y),
      r: String(HEX_SIZE * 0.4),
    }),
  );

  if (shotHits.length) await flashDamaged(shotHits);
  else await wait(SHOT_IMPACT_MS);
  layer.remove();
}

function drawnPathTo(hex: Hex): Hex[] {
  const piece = selectedId ? getPiece(state, selectedId) : null;
  if (!piece) return [];
  return stickyMovePlan(state, piece, hex, hoverPath).path;
}

function committedPathTo(hex: Hex): Hex[] {
  if (commitPath.length && eq(commitPath[commitPath.length - 1], hex)) return commitPath;
  return drawnPathTo(hex);
}

async function tryAct(hex: Hex, kind: ActionMode) {
  if (!canActWithSelected() || !selectedId) return;

  const { canMove, canShoot } = hexActions(selectedId, hex);
  if (kind === 'move' && !canMove) return;
  if (kind === 'shoot' && !canShoot) return;

  const action: Action =
    kind === 'move'
      ? { kind: 'move', pieceId: selectedId, to: hex, path: committedPathTo(hex) }
      : { kind: 'shoot', pieceId: selectedId, at: hex };

  const actingId = selectedId;
  pendingHex = null;
  await playAnimatedAction(action);

  if (state.scoutPieceId === actingId && (state.scoutActionsLeft ?? 0) > 0) {
    selectedId = actingId;
    hoverHex = null;
    hoverPath = [];
    commitPath = [];
    refreshHighlights();
    render();
  } else {
    retainSelection(actingId);
    render();
    await maybeAi();
  }
}

async function restSelected() {
  if (!selectedId || !canRest(selectedId) || animating) return;
  rotatePreviewDir = null;
  animating = true;
  const actingId = selectedId;
  state = restPiece(state, actingId);
  await playPendingFx();
  animating = false;
  retainSelection(actingId);
  render();
  await maybeAi();
}

function canRotate(pieceId: string): boolean {
  if (!canControl()) return false;
  const piece = getPiece(state, pieceId);
  if (!piece || piece.side !== state.turn) return false;
  if (!UNIT_STATS[piece.type].hexArmor) return false;
  if (hasActed(state, pieceId)) return false;
  if (state.scoutPieceId && state.scoutPieceId !== pieceId) return false;
  return true;
}

/** Cube dir of an adjacent rear / −2 (red) face, if this piece can spend a rotate on it. */
function redZoneDir(piece: Piece, hex: Hex): HexDir | null {
  if (!canRotate(piece.id)) return null;
  const from: Hex = { col: piece.col, row: piece.row };
  const dir = dirBetween(from, hex, state.orientation);
  if (dir === null || dir === facingOf(piece)) return null;
  const rel = (((dir - facingOf(piece)) % 6) + 6) % 6;
  if (rel !== 3 && !isBlockedFaceRay(piece, from, hex, state.orientation)) return null;
  return dir;
}

function rotateChoiceHex(): Hex | null {
  if (pendingHex || !hoverHex || !selectedId) return null;
  const piece = getPiece(state, selectedId);
  if (!piece || redZoneDir(piece, hoverHex) == null) return null;
  return hoverHex;
}

async function commitRotate(dir: HexDir) {
  if (!selectedId || !canRotate(selectedId) || animating) return;
  const actingId = selectedId;
  const piece = getPiece(state, actingId);
  if (!piece) return;
  animating = true;
  const g = app.querySelector(`[data-id="${actingId}"] .piece-facing`);
  if (g) {
    await tweenFacing(g, facingRotation(piece), facingRotation({ ...piece, facing: dir }), 140);
  }
  state = rotatePiece(state, actingId, dir);
  rotatePreviewDir = null;
  await playPendingFx();
  animating = false;
  if (state.scoutPieceId === actingId && (state.scoutActionsLeft ?? 0) > 0) {
    selectedId = actingId;
    hoverHex = null;
    hoverPath = [];
    commitPath = [];
    refreshHighlights();
    render();
  } else {
    retainSelection(actingId);
    render();
    await maybeAi();
  }
}

async function skipScout(nextId?: string) {
  if (!state.scoutPieceId || !canControl()) return;
  const actingId = state.scoutPieceId;
  await playAnimatedAction({ kind: 'skip' });
  const next = nextId ? getPiece(state, nextId) : null;
  if (next && canControl()) {
    selectPiece(next.id);
  } else {
    retainSelection(actingId);
    render();
  }
  await maybeAi();
}

async function maybeAi() {
  if (briefingBlocks() || boardBlocks() || state.winner) {
    ensureSoloTurnSelection();
    return;
  }
  if (mode === 'hotseat' || isPlayerControlled(state, state.turn)) {
    ensureSoloTurnSelection();
    render();
    return;
  }
  aiThinking = true;
  updateChrome();

  let guard = 0;
  while (isAiControlled(state, state.turn) && !state.winner && guard < 64) {
    const action = pickAiAction(state);
    if (!action) {
      state = passTurn(state);
      await playPendingFx();
      break;
    }
    const turnBefore = state.turn;
    const scoutBefore = state.scoutPieceId;
    const actedBefore = state.actedIds.length;
    await wait(180);
    await playAnimatedAction(action);
    if (
      state.turn === turnBefore &&
      state.scoutPieceId === scoutBefore &&
      state.actedIds.length === actedBefore &&
      !state.winner
    ) {
      state = passTurn(state);
      await playPendingFx();
      break;
    }
    clearSelectionUnlessSolo();
    render();
    guard += 1;
  }
  if (isAiControlled(state, state.turn) && !state.winner) {
    state = passTurn(state);
    await playPendingFx();
  }

  aiThinking = false;
  ensureSoloTurnSelection();
  render();
}

function pieceColor(side: Side): string {
  return `var(--piece-${side})`;
}

function iconInk(side: Side): string {
  return `var(--piece-${side}-ink)`;
}

function activePeriod(): Period {
  if (screen === 'editor') return editorPeriod;
  if (screen === 'play' && activeLevelId) {
    const lvl = getLevel(activeLevelId);
    if (lvl) return lvl.period;
  }
  return selectedPeriod;
}

function viewTerrain(): Terrain[][] {
  return screen === 'editor' ? editorTerrain : state.terrain;
}

function renderBoard(): string {
  const terrainGrid = viewTerrain();
  const cols = terrainGrid[0]?.length ?? state.cols;
  const rows = terrainGrid.length;
  const ori = viewOrientation();
  const extent = hexGridExtent(cols, rows, HEX_SIZE, ori);
  const w = PAD * 2 + extent.w;
  const h = PAD * 2 + extent.h;
  const editing = screen === 'editor';

  // Full ranges while selected: move tint + shoot marks together
  const allHl = !editing && selectedId ? highlights : [];
  const moveMap = new Map<string, 'move' | 'stamina'>();
  const restSet = new Set<string>();
  const shootRange = new Set<string>();
  const shootTarget = new Set<string>();
  for (const hl of allHl) {
    const k = key(hl.hex);
    if (hl.kind === 'move' || hl.kind === 'stamina') moveMap.set(k, hl.kind);
    else if (hl.kind === 'rest') restSet.add(k);
    else if (hl.kind === 'shoot') shootTarget.add(k);
    else if (hl.kind === 'shoot-range') shootRange.add(k);
  }

  const splashSet = new Set<string>();
  const pathSet = new Set<string>();
  let pathVia: Hex | null = null;
  let pathKind: 'move' | 'stamina' | null = null;
  if (!editing && hoverHex) {
    const sel = selectedId ? getPiece(state, selectedId) : null;
    const splashAim = highlights.some((h) => h.kind === 'shoot' && eq(h.hex, hoverHex!));
    if (sel && splashAim && hasSplash(UNIT_STATS[sel.type])) {
      const fromHex = { col: sel.col, row: sel.row };
      for (const n of splashBlast(state, hoverHex, fromHex)) {
        splashSet.add(key(n));
      }
    }
    const destHl = highlights.find(
      (h) => (h.kind === 'move' || h.kind === 'stamina') && eq(h.hex, hoverHex!),
    );
    if (sel && destHl) {
      pathKind = destHl.kind === 'stamina' ? 'stamina' : 'move';
      const plan = stickyMovePlan(state, sel, hoverHex, hoverPath);
      hoverPath = plan.path;
      pathVia = plan.via;
      for (const h of hoverPath) pathSet.add(key(h));
    }
  }

  let hexes = '';
  let hlOverlays = '';
  let shootMarks = '';
  let rotateMarks = '';
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const hex = { col, row };
      const { x, y } = pixelOf(hex);
      const terrain = terrainGrid[row][col];
      const k = key(hex);
      let cls = `hex ${terrain}`;
      if (terrain === 'land' && (col + row) % 2) cls += ' alt';
      if (editing) cls += ' editable';

      const pts = hexCorners(x, y, HEX_SIZE, ori);
      hexes += `<polygon class="${cls}" data-col="${col}" data-row="${row}" points="${pts}" />`;
      if (terrain === 'high') {
        hexes += `<polygon class="hex-high-rim" points="${hexCorners(x, y, HEX_SIZE * 0.72, ori)}" />`;
        hexes += `<polygon class="hex-high-top" points="${hexCorners(x, y, HEX_SIZE * 0.42, ori)}" />`;
      } else if (terrain === 'plateau') {
        hexes += `<polygon class="hex-plateau-rim" points="${hexCorners(x, y, HEX_SIZE * 0.82, ori)}" />`;
        hexes += `<polygon class="hex-plateau-mid" points="${hexCorners(x, y, HEX_SIZE * 0.58, ori)}" />`;
        hexes += `<polygon class="hex-plateau-top" points="${hexCorners(x, y, HEX_SIZE * 0.32, ori)}" />`;
      } else if (terrain === 'rock') {
        hexes += `<polygon class="hex-rock-rim" points="${hexCorners(x, y, HEX_SIZE * 0.82, ori)}" />`;
        hexes += `<polygon class="hex-rock-mid" points="${hexCorners(x, y, HEX_SIZE * 0.58, ori)}" />`;
        hexes += `<polygon class="hex-rock-top" points="${hexCorners(x, y, HEX_SIZE * 0.32, ori)}" />`;
      }
      const mv = moveMap.get(k);
      if (mv === 'move') hlOverlays += `<polygon class="hl-tint move" points="${pts}" />`;
      else if (mv === 'stamina') hlOverlays += `<polygon class="hl-tint stamina" points="${pts}" />`;
      else if (restSet.has(k)) hlOverlays += `<polygon class="hl-tint rest" points="${pts}" />`;

      if (pathSet.has(k)) {
        const end = hoverHex && eq(hoverHex, hex);
        const via = !!(pathVia && eq(pathVia, hex) && !end);
        hlOverlays += `<polygon class="hl-tint path${pathKind === 'stamina' ? ' stamina' : ''}${end ? ' path-end' : ''}${via ? ' path-via' : ''}" points="${pts}" />`;
        if (via) {
          hlOverlays += `<polygon class="path-via-mark" points="${hexCorners(x, y, HEX_SIZE * 0.52, ori)}" />`;
        }
      }

      if (pendingHex && eq(pendingHex, hex)) {
        hlOverlays += `<polygon class="hl-tint pending" points="${pts}" />`;
      }

      if (hoverHex && eq(hoverHex, hex) && rotateChoiceHex()) {
        hlOverlays += `<polygon class="hl-tint red-zone" points="${pts}" />`;
        rotateMarks += hexRotateMarkSvg(x, y, col, row);
      }

      if (splashSet.has(k)) hlOverlays += `<polygon class="hl-tint splash" points="${pts}" />`;

      if (shootTarget.has(k) || shootRange.has(k)) {
        const under =
          !!pieceAt(state, hex) || isWall(state, hex) || isPalisade(state, hex);
        shootMarks += shootMarkSvg(x, y, shootTarget.has(k) && under);
      }
    }
  }

  let staminaMarks = '';
  if (pathKind === 'stamina' && hoverHex) {
    const { x, y } = pixelOf(hoverHex);
    const occ = !!pieceAt(state, hoverHex);
    const r = HEX_SIZE * (occ ? 0.24 : 0.28);
    const dy = occ ? -HEX_SIZE * 0.46 : -HEX_SIZE * 0.06;
    staminaMarks += staminaHexMarkSvg(x, y + dy, r);
  }
  for (const k of restSet) {
    const hex = parseKey(k);
    const { x, y } = pixelOf(hex);
    const occ = !!pieceAt(state, hex);
    const r = HEX_SIZE * (occ ? 0.22 : 0.26);
    const dy = occ ? -HEX_SIZE * 0.46 : -HEX_SIZE * 0.06;
    staminaMarks += `<g class="need-rest-mark">${staminaEmptyMarkSvg(x, y + dy, r)}</g>`;
  }

  let tokensSvg = '';
  const drawTokens = editing ? editorTokens : state.tokens;
  for (const t of drawTokens) {
    const banned = tokenIsNoTouch(t);
    if (!editing && t.type === 'notouch') continue;
    const { x, y } = pixelOf({ col: t.col, row: t.row });
    const owner = flagOwnerForDraw(t);
    const mark =
      t.type === 'wall' || t.type === 'house' || t.type === 'palisade' || t.type === 'tree'
        ? tokenGlyphSvg(t.type, HEX_SIZE * 0.8, ori, null, t.hp)
        : t.type === 'flag'
          ? tokenGlyphSvg('flag', HEX_SIZE * 0.86, ori, owner)
          : t.type === 'notouch'
            ? ''
            : tokenGlyphSvg(t.type, HEX_SIZE * 0.78);
    const ban = editing && banned ? noTouchMarkSvg(HEX_SIZE * 0.38) : '';
    const read = t.type === 'board' && t.read ? ' read' : '';
    tokensSvg += `<g class="tile-token ${t.type}${read}${editing && banned ? ' notouch' : ''}" transform="translate(${x}, ${y})">${mark}${ban}</g>`;
  }

  let piecesSvg = '';
    const drawPieces: Piece[] = editing
    ? editorPieces.map((p) => ({
        id: `ed-${p.side}-${p.col}-${p.row}`,
        side: p.side,
        type: p.type,
        col: p.col,
        row: p.row,
        facing: facingFromStamp(p),
        unitTokens: p.unitTokens,
      }))
    : state.pieces;
  const dmgBoard: GameState = editing
    ? {
        ...state,
        cols: editorTerrain[0]?.length ?? state.cols,
        rows: editorTerrain.length,
        orientation: editorOrientation,
        terrain: editorTerrain,
        tokens: editorTokens,
        pieces: drawPieces,
      }
    : { ...state, pieces: state.pieces.map(aimedPiece) };
  let hexDmgSvg = '';
  for (const m of hexDamageMarks(dmgBoard)) {
    const back = ((m.dir + 3) % 6) as HexDir;
    const from = neighborInDir(m, back, ori);
    const a = pixelOf(from);
    const b = pixelOf(m);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const span = Math.hypot(dx, dy) || 1;
    const rim = HEX_SIZE * 0.74;
    const x = a.x + (dx / span) * rim;
    const y = a.y + (dy / span) * rim;
    const rot = cubeDirRotation(from, m.dir);
    const size = HEX_SIZE * (m.amount >= 2 ? 1.04 : 0.88);
    hexDmgSvg += `<g class="hex-dmg-pikes ${m.side} amt-${m.amount}" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${rot.toFixed(1)})">${facingPikeSvg(size, m.amount)}</g>`;
  }
  for (const p of drawPieces) {
    const { x, y } = pixelOf({ col: p.col, row: p.row });
    const sel = !editing && p.id === selectedId ? ' selected' : '';
    const hexed = UNIT_STATS[p.type].hexArmor;
    const pr = HEX_SIZE * (hexed ? 0.697 : 0.581);
    const badgeR = Math.max(6.5, HEX_SIZE * 0.22);
    const emptyStamina = staminaMax(p) > 0 && staminaLeft(p) <= 0;
    const stamCx = -pr * 0.65;
    const stamCy = -pr * 0.7;
    const staminaMark = emptyStamina ? staminaEmptyMarkSvg(stamCx, stamCy, badgeR) : '';
    const reloadIcon = isReloading(p)
      ? reloadBadgeSvg(pr * 0.65, -pr * 0.7, badgeR)
      : '';
    const shots = ammoLeft(p);
    const ammoIcon =
      shots !== null
        ? ammoBadgeSvg(shots, pr * 0.65, pr * 0.7, badgeR)
        : '';
    const actedIcon =
      !editing && hasActed(state, p.id)
        ? actedBadgeSvg(pr * 0.92, 0.2, badgeR)
        : '';
    const abilityIcons = abilitiesOf(p)
      .map((id, i) =>
        abilityBadgeSvg(id, -pr * 0.65 + i * badgeR * 1.65, pr * 0.7, badgeR),
      )
      .join('');
    const maxHp = hpMax(p);
    const hpIcon =
      maxHp > 1
        ? hpBadgeSvg(
            hpLeft(p),
            emptyStamina ? stamCx + badgeR * 1.7 : stamCx,
            stamCy,
            badgeR,
          )
        : '';
    const shown = aimedPiece(p);
    const rot = facingRotation(shown);
    const notch = pr + 1.2;
    const selRing = hexed
      ? `<polygon class="piece-sel" points="${hexCorners(0, 0, pr + 3.2, viewOrientation())}" fill="none" stroke="var(--sel)" stroke-width="2" />`
      : `<circle class="piece-sel" cx="0" cy="0" r="${pr + 3.2}" fill="none" stroke="var(--sel)" stroke-width="2" />`;
    piecesSvg += `
      <g class="piece-unit${isReloading(p) ? ' reloading' : ''}${isDepleted(p) ? ' depleted' : ''}" data-id="${p.id}" transform="translate(${x}, ${y})">
        ${sel ? selRing : ''}
        ${pieceBodySvg(shown, pr)}
        <g class="piece-facing" transform="rotate(${rot.toFixed(1)})">
          ${
            hexed
              ? ''
              : `<polygon class="facing-notch" points="0,${(-notch).toFixed(1)} 3.6,${(-notch + 6.5).toFixed(1)} -3.6,${(-notch + 6.5).toFixed(1)}" fill="${iconInk(p.side)}" />`
          }
          <g class="piece-glyph ${p.side}" fill="${iconInk(p.side)}" stroke="none" color="${iconInk(p.side)}">
            ${pieceIconSvg(p.type, hexed ? Math.round(PIECE_ICON * 1.2) : PIECE_ICON)}
          </g>
        </g>
        ${staminaMark}
        ${reloadIcon}
        ${hpIcon}
        ${ammoIcon}
        ${actedIcon}
        ${abilityIcons}
      </g>`;
  }

  const defs = `
    <defs>
      <pattern id="land-tex" patternUnits="userSpaceOnUse" width="24" height="22">
        <rect width="24" height="22" fill="var(--land)"/>
        <path d="M7 16 L7.6 11 M8.5 16 L7.6 11" fill="none" stroke="var(--land-blade)" stroke-width="0.85" stroke-linecap="round" opacity="0.38"/>
        <path d="M18 11 L18.5 7.2" fill="none" stroke="var(--land-blade)" stroke-width="0.75" stroke-linecap="round" opacity="0.28"/>
      </pattern>
      <pattern id="land-tex-alt" patternUnits="userSpaceOnUse" width="24" height="22">
        <rect width="24" height="22" fill="var(--land2)"/>
        <path d="M15 17 L15.6 12 M16.5 17 L15.6 12" fill="none" stroke="var(--land-blade)" stroke-width="0.85" stroke-linecap="round" opacity="0.34"/>
        <path d="M6 10 L6.4 6.4" fill="none" stroke="var(--land-blade)" stroke-width="0.75" stroke-linecap="round" opacity="0.26"/>
      </pattern>
      <pattern id="rock-tex" patternUnits="userSpaceOnUse" width="20" height="20">
        <rect width="20" height="20" fill="var(--rock)"/>
        <rect width="20" height="20" fill="var(--rock-hi)" opacity="0.28"/>
        <ellipse cx="10" cy="10" rx="9" ry="7.2" fill="none" stroke="var(--rock-lo)" stroke-width="1.1" opacity="0.7"/>
        <ellipse cx="10" cy="10" rx="6.2" ry="5" fill="none" stroke="var(--rock-hi)" stroke-width="1" opacity="0.5"/>
        <ellipse cx="10" cy="10" rx="3.4" ry="2.6" fill="none" stroke="var(--rock-lo)" stroke-width="0.9" opacity="0.55"/>
        <ellipse cx="10" cy="10" rx="1.5" ry="1.1" fill="var(--rock-hi)" opacity="0.35"/>
        <path d="M1 16 Q7 12 11 15 T19 14" fill="none" stroke="var(--rock-lo)" stroke-width="0.8" opacity="0.5"/>
      </pattern>
      <pattern id="wall-tex" patternUnits="userSpaceOnUse" width="12" height="12">
        <rect width="12" height="12" fill="var(--wall)"/>
        <rect x="0" y="0" width="12" height="5.5" fill="var(--wall-hi)"/>
        <rect x="0" y="6" width="12" height="5.5" fill="var(--wall-lo)"/>
        <path d="M0 6 H12 M6 0 V6 M0 12 H12" stroke="var(--wall-ink)" stroke-width="1"/>
        <path d="M0 0 H12 M0 0 V12" stroke="var(--wall-hi)" stroke-width="0.6" opacity="0.5"/>
      </pattern>
      <pattern id="water-tex" patternUnits="userSpaceOnUse" width="18" height="12">
        <rect width="18" height="12" fill="var(--water)"/>
        <path d="M-2 3 Q2 1 6 3 T14 3 T22 3" fill="none" stroke="var(--water-hi)" stroke-width="1.2" opacity="0.75"/>
        <path d="M-2 7 Q2 5 6 7 T14 7 T22 7" fill="none" stroke="var(--water-lo)" stroke-width="1.1" opacity="0.7"/>
        <path d="M-2 11 Q3 9 7 11 T15 11 T23 11" fill="none" stroke="var(--water-hi)" stroke-width="1" opacity="0.55"/>
        <ellipse cx="4" cy="2" rx="1.8" ry="0.6" fill="var(--water-hi)" opacity="0.25"/>
        <ellipse cx="13" cy="8" rx="2.2" ry="0.7" fill="var(--water-hi)" opacity="0.2"/>
      </pattern>
      <pattern id="high-tex" patternUnits="userSpaceOnUse" width="20" height="20">
        <rect width="20" height="20" fill="var(--high)"/>
        <rect width="20" height="20" fill="var(--high-hi)" opacity="0.45"/>
        <ellipse cx="10" cy="10" rx="8" ry="6.5" fill="none" stroke="var(--high-lo)" stroke-width="1" opacity="0.55"/>
        <ellipse cx="10" cy="10" rx="5" ry="4" fill="none" stroke="var(--high-hi)" stroke-width="1" opacity="0.5"/>
        <ellipse cx="10" cy="10" rx="2.2" ry="1.8" fill="var(--high-hi)" opacity="0.35"/>
        <path d="M1 15 Q6 12 10 14 T19 13" fill="none" stroke="var(--high-lo)" stroke-width="0.8" opacity="0.4"/>
        <path d="M2 6 Q8 3 14 5" fill="none" stroke="var(--high-hi)" stroke-width="0.7" opacity="0.35"/>
      </pattern>
      <pattern id="plateau-tex" patternUnits="userSpaceOnUse" width="20" height="20">
        <rect width="20" height="20" fill="var(--plateau)"/>
        <rect width="20" height="20" fill="var(--plateau-hi)" opacity="0.38"/>
        <ellipse cx="10" cy="10" rx="9" ry="7.2" fill="none" stroke="var(--plateau-lo)" stroke-width="1.1" opacity="0.6"/>
        <ellipse cx="10" cy="10" rx="6.2" ry="5" fill="none" stroke="var(--plateau-hi)" stroke-width="1" opacity="0.55"/>
        <ellipse cx="10" cy="10" rx="3.4" ry="2.6" fill="none" stroke="var(--plateau-lo)" stroke-width="0.9" opacity="0.5"/>
        <ellipse cx="10" cy="10" rx="1.5" ry="1.1" fill="var(--plateau-hi)" opacity="0.4"/>
        <path d="M1 16 Q7 12 11 15 T19 14" fill="none" stroke="var(--plateau-lo)" stroke-width="0.8" opacity="0.45"/>
      </pattern>
    </defs>`;

  return `<svg class="board" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    ${defs}
    <g class="hex-layer">${hexes}</g>
    <g class="token-layer">${tokensSvg}</g>
    <g class="hl-tint-layer">${hlOverlays}</g>
    <g class="piece-layer">${piecesSvg}</g>
    <g class="hex-dmg-layer">${hexDmgSvg}</g>
    <g class="shoot-mark-layer">${shootMarks}</g>
    <g class="stamina-mark-layer">${staminaMarks}</g>
    <g class="rotate-btn-layer">${rotateMarks}</g>
  </svg>`;
}

function endTurnButton(): string {
  if (!canControl()) return '';
  return `<button type="button" id="end-turn" class="play-end-turn">End turn</button>`;
}

function canRest(pieceId: string): boolean {
  if (!canControl()) return false;
  const piece = getPiece(state, pieceId);
  if (!piece || piece.side !== state.turn) return false;
  if (hasActed(state, pieceId) || piece.movedThisTurn) return false;
  if (state.scoutPieceId) return false;
  return true;
}

function renderActionBar(): string {
  const piece = selectedId ? getPiece(state, selectedId) : null;
  if (!piece) {
    return `<div class="action-bar idle"><span class="action-bar-hint">Select a piece</span></div>`;
  }

  const s = UNIT_STATS[piece.type];
  const previewOnly = piece.side !== state.turn || !canControl();
  const { canMove, canShoot } = availableActions(piece.id);
  const pending =
    pendingHex && canActWithSelected() ? hexActions(piece.id, pendingHex) : null;
  const choosing = !!(pending?.canMove && pending?.canShoot);

  let hint: string;
  if (choosing) {
    hint = pieceAt(state, pendingHex!)
      ? 'Pick Melee or Shoot'
      : 'Pick Move or Shoot';
  } else if (
    pending?.canMove &&
    pieceAt(state, pendingHex!) &&
    pieceAt(state, pendingHex!)!.side !== piece.side
  ) {
    hint = `Melee — ${UNIT_STATS[piece.type].meleeDamage} dmg (min 1); kill takes the hex`;
  } else if (
    state.scoutPieceId &&
    state.scoutPieceId !== piece.id &&
    piece.side === state.turn
  ) {
    hint = state.staminaBonus
      ? 'A second action is available — finish it or skip'
      : 'Scout still has an action — finish it or skip';
  } else if (hasActed(state, piece.id) && piece.side === state.turn) {
    hint = piece.actedThisTurn || piece.movedThisTurn
      ? 'Already acted this turn'
      : 'Resting this turn';
  } else if (state.staminaBonus && state.scoutPieceId === piece.id) {
    const n = staminaLeft(piece);
    hint = `A second action costs 1 stamina. ${n} stamina left.`;
  } else if (state.scoutPieceId && piece.id === state.scoutPieceId) {
    hint = 'Second scout action — move, shoot, or skip';
  } else if (state.terrain[piece.row]?.[piece.col] === 'water') {
    hint = canMove ? "In water — 1 hex, can't shoot" : "In water — can't shoot";
  } else if (!canMove && !canShoot) {
    hint = isDepleted(piece)
      ? "Empty — can't shoot"
      : isReloading(piece)
        ? "Reloading — can't shoot"
        : 'No moves or shots';
  } else if (previewOnly) {
    hint = 'Range preview';
  } else {
    hint = s.actions > 1
      ? 'Green = move · gold = climb (ends the activation) · click enemy to shoot'
      : 'Green = move · gold = climb, or the extra straight-line action · click enemy to shoot';
  }

  const left = state.scoutActionsLeft ?? 0;
  const scoutUi =
    state.scoutPieceId && canControl()
      ? `<button type="button" id="skip-scout">${
          state.staminaBonus
            ? 'Skip second action'
            : `Skip remaining action${left > 0 ? ` (${left})` : ''}`
        }</button>`
      : '';

  const extra =
    !choosing && isReloading(piece)
      ? `<span class="action-flag">reloading</span>`
      : !choosing && isDepleted(piece)
        ? `<span class="action-flag">empty</span>`
        : '';

  const restUi =
    canRest(piece.id)
      ? `<button type="button" id="rest-unit">Rest</button>`
      : '';

  return `
    <div class="action-bar${scoutUi ? ' has-skip' : ''}${restUi ? ' has-rest' : ''}">
      <div class="action-bar-piece">
        <svg class="side-icon" viewBox="-10 -10 20 20" width="26" height="26" aria-hidden="true">
          <circle cx="0" cy="0" r="9.5" fill="${pieceColor(piece.side)}" stroke="${armorColor(ringArmor(piece.type))}" stroke-width="2" />
          <g fill="${iconInk(piece.side)}" color="${iconInk(piece.side)}">${pieceIconSvg(piece.type, 13)}</g>
        </svg>
        <span>${s.name}${previewOnly ? ' · preview' : ''}</span>
        ${hpPipsHtml(hpLeft(piece), hpMax(piece), piece.side, hasUnitToken(piece, 'general'))}
        ${staminaPipsHtml(staminaLeft(piece), staminaMax(piece))}
        ${pieceShotPipsHtml(piece)}
        ${restUi}
      </div>
      ${scoutUi}
      ${extra}
      <span class="action-bar-hint">${hint}</span>
    </div>`;
}

function statRow(label: string, value: string, note = '', warn = false): string {
  return `<div class="stat${warn ? ' warn' : ''}"><dt>${label}</dt><dd>${value}${
    note ? `<span class="stat-note">${note}</span>` : ''
  }</dd></div>`;
}

function renderSidebar(): string {
  const piece = selectedId ? getPiece(state, selectedId) : null;
  let detail =
    '<p class="empty-hint">Click a piece — green is move, gold is climb or the extra straight-line action, red is shoot. Dual hex: pick Move or Shoot.</p>';
  let moreStats = '';

  if (piece) {
    const s = UNIT_STATS[piece.type];
    const elev = terrainHeight(state.terrain[piece.row][piece.col]);
    const shootVal = s.shoot > 0 ? s.shoot + elev : 0;
    const shootRange =
      s.shootMin > 1 ? `${s.shootMin}–${shootVal}` : String(shootVal);
    const moveNote = [
      s.actions > 1 ? `${s.actions} actions` : '',
      s.moveBudget > 0 ? `cap ${s.moveBudget}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    const maxSt = staminaMax(piece);
    const curSt = staminaLeft(piece);
    let stamNote = '';
    let stamWarn = false;
    if (piece.staminaUsedThisTurn) {
      stamNote = 'used this turn';
      stamWarn = true;
    } else if (
      (piece.actedThisTurn || piece.movedThisTurn) &&
      curSt < maxSt &&
      s.staminaRegen > 0
    ) {
      stamNote = 'acted — no regen';
      stamWarn = true;
    } else if (
      hasActed(state, piece.id) &&
      curSt < maxSt &&
      s.staminaRegen > 0
    ) {
      stamNote = 'resting';
    } else if (
      state.terrain[piece.row]?.[piece.col] === 'water' &&
      curSt < maxSt &&
      s.staminaRegen > 0
    ) {
      stamNote = 'no regen in water';
      stamWarn = true;
    } else if (curSt < maxSt && s.staminaRegen > 0) {
      const n = Math.max(1, piece.staminaRegenWait ?? s.staminaRegen);
      stamNote = `+1 after ${n} idle turn${n === 1 ? '' : 's'}`;
    } else if (s.staminaRegen > 0) {
      stamNote = `regen ${s.staminaRegen}`;
    }

    const vitals = [
      ...(maxSt > 0
        ? [statRow('Stamina', staminaPipsHtml(curSt, maxSt), stamNote, stamWarn)]
        : []),
      statRow(
        'HP',
        hpPipsHtml(
          hpLeft(piece),
          hpMax(piece),
          piece.side,
          hasUnitToken(piece, 'general'),
        ),
        hpLeft(piece) < hpMax(piece) ? 'wounded' : '',
        hpLeft(piece) < hpMax(piece),
      ),
      ...(s.shootCooldown > 0
        ? [
            statRow(
              'Reload',
              isReloading(piece)
                ? `${piece.shootCooldown} left`
                : `${s.shootCooldown} turn${s.shootCooldown === 1 ? '' : 's'}`,
              isReloading(piece) ? 'can still move' : 'after firing',
              isReloading(piece),
            ),
          ]
        : []),
    ];

    const moreRows = [
      statRow(
        'Move',
        String(s.move > 0 ? s.move + elev : 0),
        [moveNote, elev === 2 ? '+2 from plateau' : elev === 1 ? '+1 from high' : '']
          .filter(Boolean)
          .join(' · '),
      ),
      statRow(
        'Shoot',
        shootRange,
        [
          s.shootArc === 'arch' ? 'arch over units' : 'straight',
          elev === 2 ? '+2 from plateau' : elev === 1 ? '+1 from high' : '',
          'high dest +1 · plateau dest +2',
        ]
          .filter(Boolean)
          .join(' · '),
      ),
      statRow('Melee', `${s.meleeDamage}`),
      statRow('Charge', s.charge > 0 ? String(s.charge) : '0'),
      statRow(
        'Shot',
        String(s.shootDamage),
        hasSplash(s) ? `splash ${s.splashDamage} · FF` : '',
      ),
      statRow(
        'Armor',
        s.hexArmor
          ? HEX_ARMOR_SIDES.map((side) => {
              const n = s[side];
              const tag = HEX_ARMOR_LABEL[side]
                .split(' ')
                .map((w) => w[0])
                .join('');
              return `${tag}${n > 0 ? '+' : ''}${n}`;
            }).join(' ')
          : `${s.armor > 0 ? '+' : ''}${s.armor}`,
        s.hexArmor ? 'hex · front follows last move · −2 face blocks walk and shoot' : '',
      ),
    ];
    if (s.shoot > 0) {
      moreRows.push(
        statRow(
          'Shots',
          pieceShotPipsHtml(piece),
          isReloading(piece) ? 'reloading' : isDepleted(piece) ? 'empty' : '',
          isReloading(piece) || isDepleted(piece),
        ),
      );
    }

    const abilityNotes = abilitiesOf(piece).map((id) => ABILITY_BLURB[id]);
    const extraNotes: string[] = [];
    if (s.passWater && s.passUnits) extraNotes.push('Move onto water; pathing through pieces');
    else {
      if (s.passWater) extraNotes.push('Move onto water (1 hex/action, no shoot; turn-start stamina penalty or 2 HP; no regen)');
      if (s.passUnits) extraNotes.push('Pathing through pieces');
    }
    if (s.charge > 0) extraNotes.push(
      `Charge through ${s.charge} dmg (armor applies). Like palisade: a living blocker stops you unless that hit kills it, or you land empty beyond`,
    );
    extraNotes.push(`Climb ${CLIMB_LEVEL_LABEL[sanitizeClimbLevel(s.climbLevel)]}`);
    if (hasSplash(s)) extraNotes.push('Splash: full ring; wall hits 3 tiles back-arc');

    const previewOnly = piece.side !== state.turn || !canControl();

    detail = `
      <section class="ability">
        <header class="ability-head">
          <svg class="side-icon" viewBox="-10 -10 20 20" width="28" height="28" aria-hidden="true">
            <circle cx="0" cy="0" r="9.5" fill="${pieceColor(piece.side)}" stroke="${armorColor(ringArmor(piece.type))}" stroke-width="2" />
            <g fill="${iconInk(piece.side)}" color="${iconInk(piece.side)}">${pieceIconSvg(piece.type, 14)}</g>
          </svg>
          <div>
            <h3>${s.name}</h3>
            <p class="ability-sub">${piece.side.toUpperCase()} · ${escapeHtml(s.chess)} · val ${combatValue(piece)}${
              previewOnly ? ' · preview' : ''
            }</p>
          </div>
        </header>
        <dl class="stat-grid">${vitals.join('')}</dl>
        ${
          abilityNotes.length
            ? `<ul class="ability-notes">${abilityNotes.map((n) => `<li>${n}</li>`).join('')}</ul>`
            : ''
        }
      </section>`;
    moreStats = `
        <dl class="stat-grid">${moreRows.join('')}</dl>
        ${
          extraNotes.length
            ? `<ul class="ability-notes">${extraNotes.map((n) => `<li>${n}</li>`).join('')}</ul>`
            : ''
        }`;
  }

  const log = [...state.log]
    .slice(-40)
    .reverse()
    .map((l) => `<div>${l}</div>`)
    .join('');

  return `
    <div class="sidebar has-log">
      <div class="log-block">
        <h2>Log</h2>
        <div class="log">${log}</div>
      </div>
      <div class="sidebar-rest">
        <h2>Abilities</h2>
        ${detail}
        <details class="sidebar-more" data-sidebar-more${sidebarMoreOpen ? ' open' : ''}>
          <summary>More</summary>
          ${moreStats}
          <div class="legend">
            <span class="l-move">Move</span>
            <span class="l-stamina">Stamina (climb / extra move)</span>
            <span class="l-rest">Need rest</span>
            <span class="l-shoot">Shoot (target)</span>
            <span class="l-shoot-range">Shoot range</span>
          </div>
          <dl class="rules">
            <div><dt>Water</dt><dd>shoot over, never from. Move to water units can stop on it (ends momentum that turn). From water: 1 hex/action, no shooting. Start of turn: 1 stamina penalty (not an action) or 2 HP; leftover stamina can still extra-move. No stamina regen in water, even idle</dd></div>
            <div><dt>LOS low</dt><dd>wall always blocks; palisade blocks straight shots; hill / plateau / mountain block if higher than the shooter; straight blocked by units</dd></div>
            <div><dt>Arch</dt><dd>over units and palisades; walls / higher ground still block</dd></div>
            <div><dt>LOS high</dt><dd>hill +1 / plateau +2 / mountain +3 to move and shoot; firing at elevation costs that much range; over pieces &amp; along ridge. Higher ground blocks shots from below</dd></div>
            <div><dt>Heights</dt><dd>Hill lvl.1, Plateau lvl.2, Mountain lvl.3. Step ±1 only (no land↔plateau). Climbing costs stamina. Climb level is the max height a unit can occupy</dd></div>
            <div><dt>Walls</dt><dd>token on a walkable hex; blocks walk and LOS. Rockets demolish, tile stays. House is the same, house graphic</dd></div>
            <div><dt>Palisade</dt><dd>wooden wall token. Units cannot cross. Arch shots go over; straight shots do not. Three melee hits break it (3rd takes the hex). Charge does not pass through unless that hit breaks it. Rockets smash it. Tree is the same, tree graphic</dd></div>
            <div><dt>Stamina</dt><dd>climb, tread water at turn start, or a second straight-line move after a normal move or turn (leftover steps don't carry)</dd></div>
            <div><dt>Melee</dt><dd>enter occupied hex; kill takes it; min 1 dmg vs armor. Palisades take 3 melee hits. Rout (shake + dissolve): hit a −2 (red) face while the opposite hex is an enemy, wall/palisade, or higher ground; or hit from the front while an enemy stands on a red/back hex. Friends never pin. Generals never rout</dd></div>
            <div><dt>Tile tokens</dt><dd>Pikes: walking onto the hex deals 1 damage (armor min 1). Spawn / stand still does not trigger. Palisade: wood fence, three melee hits to break, no charge through unless it falls, arch over. Tree: same as palisade, tree graphic. Wall: impassable, blocks LOS, rockets smash. House: same as wall, house graphic. Flag: walk onto it to capture. Own every flag on the map to win (one flag = take it; several = take them all). Recapture by walking onto an enemy flag. Units already on a flag at kickoff hold it. Board: first friendly walk pops the message; later walks stay quiet — click the hex to reread. Editor: click the board to set the text. Do not touch: paint on a tile or onto another token; AI will not walk that hex (players still can)</dd></div>
            <div><dt>Unit tokens</dt><dd>Paint onto a unit. General: +1 HP (gold block first in the row, last remaining), +1 value, and the General ability — killing that piece can win the match</dd></div>
            <div><dt>Shield</dt><dd>DMG = attack − shield (melee min 1). Negative shield boosts melee only — shots treat it as 0. Hex: a −2 (red) face cannot be walked or shot. Rout: red-face hit with the other side pinned (enemy / wall / high), or front hit with an enemy on the red/back hex. Friends never pin. Generals immune</dd></div>
            <div><dt>Units / turn</dt><dd>activate up to that many pieces, then End turn. Rest parks a unit that hasn't moved (checkmark, still regenerates). Hex-shield units can Turn on an adjacent rear / −2 hex (spends an action, leftover stamina still buys the extra move)</dd></div>
            <div><dt>Win</dt><dd>kill their General (if they have one), or every enemy piece. Flags on the map: capturing all of them also wins</dd></div>
          </dl>
        </details>
      </div>
    </div>`;
}

function matchStatsHtml(): string {
  const sides = participatingSides(state);
  const shown = sides.length ? sides : SIDES.filter((s) =>
    state.pieces.some((p) => p.side === s),
  );
  const cas = shown
    .map(
      (s) =>
        `<span class="${s}">${SIDE_LABEL[s]} −${state.casualties[s] ?? 0}</span>`,
    )
    .join('');
  const flags = mapFlags(state);
  const flagBit = flags.length
    ? `<span class="match-flags">${flagGoalLabel()}</span>`
    : '';
  return `<span class="match-turn">Turn ${state.turnNumber}</span><span class="match-cas">${cas}</span>${flagBit}`;
}

function sideTurnPhrase(side: Side): string {
  const name = SIDE_LABEL[side];
  const c = state.controls[side];
  if (c === 'player') {
    const humans = participatingSides(state).filter((s) =>
      isPlayerControlled(state, s),
    );
    if (humans.length <= 1) return `Your turn (${name})`;
    return `${name} to move`;
  }
  const style = AI_STYLE_LABEL[sanitizeAiStyles(state.aiStyles)[side]];
  if (c === 'ai-ally') return `${name} (AI ally · ${style})`;
  return `${name} (AI · ${style})`;
}

function opposingLoser(winner: Side): Side {
  const foes = participatingSides(state).filter((s) => !sameTeam(state, s, winner));
  return foes[0] ?? SIDES.find((s) => s !== winner) ?? 'blue';
}

function turnLabel(): string {
  const stats = matchStatsHtml();
  if (state.winner) {
    const loser = opposingLoser(state.winner);
    const how = winByFlags(state)
      ? mapFlags(state).length > 1
        ? 'all flags captured'
        : 'flag captured'
      : defeatKind(state, loser) === 'turns'
        ? 'out of turns'
        : defeatKind(state, loser) === 'wipeout'
          ? 'army destroyed'
          : 'general down';
    return `<span class="${state.winner}">${SIDE_LABEL[state.winner].toUpperCase()} wins</span> — ${how} · ${stats}`;
  }
  if ((aiThinking || animating) && isAiControlled(state, state.turn)) {
    return `${stats} · <span class="${state.turn}">${sideTurnPhrase(state.turn)}</span> moving…`;
  }
  const quota = unitQuotaPipsHtml(
    state.actedIds.length,
    state.unitsPerTurn,
    state.turn,
  );
  return `${stats} · <span class="${state.turn}">${sideTurnPhrase(state.turn)}</span>${quota ? ` ${quota}` : ''}`;
}

function renderEndOverlay(): string {
  if (!state.winner) return '';

  const vsEnemy = matchHasEnemies(state);
  const youWon = vsEnemy && playerTeamWon(state);
  const youLost = vsEnemy && !!state.winner && !playerTeamWon(state);
  const tone = youLost ? 'defeat' : 'victory';
  const inList = !!playlist;
  const lastInList = inList && !playlistHasNext();
  const listName = playlist ? LEVEL_CATEGORY_LABEL[playlist.kind] : '';

  const title =
    youWon && lastInList
      ? `${listName.toUpperCase()} COMPLETE`
      : youWon
        ? 'VICTORY'
        : youLost
          ? 'DEFEAT'
          : `${SIDE_LABEL[state.winner].toUpperCase()} WINS`;

  const loser = opposingLoser(state.winner);
  const flags = winByFlags(state);
  const how = !flags ? defeatKind(state, loser) : 'wipeout';
  const outOfTurns = how === 'turns';
  const wiped = !flags && how === 'wipeout';
  const manyFlags = mapFlags(state).length > 1;
  const winHow = flags
    ? manyFlags
      ? 'All flags captured.'
      : 'Flag captured.'
    : wiped
      ? 'Enemy army destroyed.'
      : 'Enemy general eliminated.';
  const loseHow = flags
    ? manyFlags
      ? 'The enemy captured every flag.'
      : 'The enemy captured the flag.'
    : outOfTurns
      ? 'Ran out of turns.'
      : wiped
        ? 'Your army was destroyed.'
        : 'Your general has fallen.';
  const hotseatHow = flags
    ? manyFlags
      ? `${SIDE_LABEL[state.winner]} captured every flag.`
      : `${SIDE_LABEL[state.winner]} captured the flag.`
    : outOfTurns
      ? `${SIDE_LABEL[state.winner]} wins — out of turns.`
      : wiped
        ? `${SIDE_LABEL[state.winner]} destroyed the opposing army.`
        : `${SIDE_LABEL[state.winner]} destroyed the opposing general.`;

  const custom = youWon ? levelCopy('win') : youLost ? levelCopy('lose') : '';
  const stock =
    youWon && lastInList
      ? `Cleared all ${playlist!.ids.length} ${listName.toLowerCase()} maps.`
      : youWon && inList
        ? `${winHow} ${playlist!.index + 1} / ${playlist!.ids.length}`
        : youWon
          ? winHow
          : youLost
            ? loseHow
            : hotseatHow;
  const sub = custom || stock;

  const winnerSide = state.winner;
  const cat = activeSavedLevel()?.category;
  const sequential = cat === 'tutorial' || cat === 'campaign';
  const nextBtn = youWon && sequential
    ? `<button type="button" id="end-next">Continue</button>`
    : youWon && inList && !lastInList
      ? `<button type="button" id="end-next">Next map</button>`
      : '';
  const rematchBtn =
    inList && !(youWon && sequential)
      ? `<button type="button" id="end-rematch">Replay</button>`
      : `<button type="button" id="end-rematch" class="ghost">Replay</button>`;
  const startBtn =
    youWon && sequential
      ? ''
      : inList
        ? `<button type="button" id="end-start" class="ghost">Start</button>`
        : `<button type="button" id="end-start">Done</button>`;

  return `
    <div class="end-overlay ${tone}" role="dialog" aria-label="${title}">
      <div class="end-card ${tone} side-${winnerSide}">
        <div class="end-burst" aria-hidden="true"></div>
        <svg class="end-icon" viewBox="-10 -10 20 20" width="72" height="72" aria-hidden="true">
          <circle cx="0" cy="0" r="9.5" fill="${pieceColor(winnerSide)}" />
          <g fill="${iconInk(winnerSide)}" color="${iconInk(winnerSide)}">${pieceIconSvg('general', 16)}</g>
        </svg>
        <h2 class="end-title">${title}</h2>
        ${endStarsHtml()}
        ${endBestStarsHtml()}
        <p class="end-sub${custom ? ' level-copy' : ''}">${custom ? formatCopyHtml(custom) : sub}</p>
        <p class="end-stats">${matchStatsHtml()}</p>
        <div class="end-actions">
          ${nextBtn}
          ${inList ? `${rematchBtn}${startBtn}` : `${startBtn}${rematchBtn}`}
        </div>
      </div>
    </div>`;
}

function renderStartOverlay(): string {
  if (!briefingBlocks()) return '';
  const text = levelCopy('start');
  const saved = activeSavedLevel();
  const title = saved ? levelLabel(saved) : 'Level';
  return `
    <div class="end-overlay briefing" role="dialog" aria-label="${escapeHtml(title)}">
      <div class="end-card briefing">
        <h2 class="end-title">${escapeHtml(title)}</h2>
        ${text ? `<p class="end-sub level-copy">${formatCopyHtml(text)}</p>` : ''}
        <div class="end-actions">
          <button type="button" id="briefing-go">Begin</button>
          ${
            canSkipPlayedLevel()
              ? `<button type="button" id="briefing-skip" class="ghost">Skip</button>`
              : ''
          }
        </div>
      </div>
    </div>`;
}

function renderBoardPopup(): string {
  if (!boardPopup) return '';
  return `
    <div class="end-overlay briefing board-overlay" role="dialog" aria-modal="true" aria-label="Message board">
      <div class="end-card briefing board-card">
        <h2 class="end-title">Message board</h2>
        <p class="end-sub level-copy board-copy">${formatCopyHtml(boardPopup.text)}</p>
        <div class="end-actions">
          <button type="button" id="board-close">Close</button>
        </div>
      </div>
    </div>`;
}

function renderEditorBoardPopup(): string {
  if (!editorBoardHex) return '';
  const tok = editorTokens.find(
    (t) =>
      t.type === 'board' &&
      t.col === editorBoardHex!.col &&
      t.row === editorBoardHex!.row,
  );
  if (!tok) return '';
  return `
    <div class="end-overlay briefing board-overlay" role="dialog" aria-modal="true" aria-label="Edit message board">
      <div class="end-card briefing board-card">
        <h2 class="end-title">Message board</h2>
        <label class="board-edit">
          <span class="sr-only">Message</span>
          <textarea id="board-text" maxlength="${BOARD_TEXT_MAX}" rows="6" placeholder="[hoplite] and [pikes] become icons">${escapeHtml(tok.text ?? '')}</textarea>
          <p class="muted board-hint">Wrap a unit or tile-token name in [brackets] to show its icon.</p>
        </label>
        <div class="end-actions">
          <button type="button" id="board-save">Save</button>
          <button type="button" id="board-cancel" class="ghost">Cancel</button>
        </div>
      </div>
    </div>`;
}

function closeBoardPopup() {
  boardPopup = null;
  render();
  void maybeAi();
}

function bindBoardPopup() {
  app.querySelector('#board-close')?.addEventListener('click', () => closeBoardPopup());
}

function editorBoardIndex(hex: Hex): number {
  return editorTokens.findIndex(
    (t) => t.type === 'board' && t.col === hex.col && t.row === hex.row,
  );
}

function removeEditorBoard(hex: Hex) {
  const idx = editorBoardIndex(hex);
  if (idx < 0) return;
  editorTokens.splice(idx, 1);
  markEditorDirty();
}

function closeEditorBoard() {
  editorBoardHex = null;
  render();
}

function bindEditorBoardPopup() {
  const box = app.querySelector<HTMLTextAreaElement>('#board-text');
  const hex = editorBoardHex;
  if (!hex) return;
  const idx = editorBoardIndex(hex);
  const hadText = idx >= 0 && !!sanitizeBoardText(editorTokens[idx].text);
  app.querySelector('#board-cancel')?.addEventListener('click', () => {
    if (!hadText) removeEditorBoard(hex);
    closeEditorBoard();
  });
  app.querySelector('#board-save')?.addEventListener('click', () => {
    const text = sanitizeBoardText(box?.value ?? '');
    if (!text) removeEditorBoard(hex);
    else if (idx >= 0) {
      editorTokens[idx] = { ...editorTokens[idx], text };
      markEditorDirty();
    }
    closeEditorBoard();
  });
  box?.addEventListener('focus', () => {
    editorCopyFieldId = 'board-text';
  });
  box?.focus();
}

function turnsLeft(): number | null {
  const cap = state.maxTurns ?? 0;
  if (cap <= 0) return null;
  return Math.max(0, cap - state.turnNumber + 1);
}

function turnsLeftHtml(): string {
  const left = turnsLeft();
  if (left === null) return '';
  const cls = left <= 0 ? ' out' : left <= 2 ? ' warn' : '';
  const label = left === 1 ? '1 turn left' : `${left} turns left`;
  return `<div class="turns-left${cls}" aria-live="polite">${label}</div>`;
}

function updateChrome() {
  applyHotseatTint();
  const banner = app.querySelector('.turn-banner');
  if (banner) banner.innerHTML = turnLabel();
  const goals = app.querySelector('.star-goals');
  if (goals) goals.outerHTML = starGoalsHtml();
  const slot = app.querySelector('.turns-left-slot');
  if (slot) slot.innerHTML = turnsLeftHtml();
}

function choicePending(): boolean {
  if (!pendingHex || !selectedId || !canActWithSelected()) return false;
  const { canMove, canShoot } = hexActions(selectedId, pendingHex);
  return !!(canMove && canShoot);
}

function renderHexChoice(): string {
  if (!choicePending() || !pendingHex || !selectedId) return '';
  const melee = !!pieceAt(state, pendingHex);
  return `<div class="hex-choice">
    <button type="button" data-action-mode="move">${melee ? 'Melee' : 'Move'}</button>
    <button type="button" data-action-mode="shoot">Shoot</button>
  </div>`;
}

function placeHexChoice() {
  const pop = app.querySelector<HTMLElement>('.hex-choice');
  if (!pop || !pendingHex) return;
  const stage = app.querySelector('.board-stage');
  const poly = app.querySelector<SVGPolygonElement>(
    `polygon.hex[data-col="${pendingHex.col}"][data-row="${pendingHex.row}"]`,
  );
  if (!stage || !poly) return;
  const sr = stage.getBoundingClientRect();
  const pr = poly.getBoundingClientRect();
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;
  const cx = pr.left + pr.width / 2 - sr.left;
  const above = pr.top - sr.top;
  const below = pr.bottom - sr.top;
  const flip = above < ph + 10 && sr.height - below > above;
  pop.classList.toggle('below', flip);
  const left = Math.max(pw / 2 + 4, Math.min(sr.width - pw / 2 - 4, cx));
  pop.style.left = `${left}px`;
  pop.style.top = `${flip ? below : above}px`;
  pop.classList.add('is-on');
}

function bindHexChoice() {
  const pop = app.querySelector<HTMLElement>('.hex-choice');
  if (!pop) return;
  pop.addEventListener('click', (e) => e.stopPropagation());
  pop.querySelectorAll<HTMLButtonElement>('[data-action-mode]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      void resolvePending(btn.dataset.actionMode as ActionMode);
    });
  });
}

function onHexClick(col: number, row: number) {
  if (briefingBlocks() || boardBlocks() || animating || aiThinking) return;
  const hex = { col, row };
  const occ = state.pieces.find((p) => p.col === col && p.row === row);

  // Own piece selected + can act → resolve by what that hex allows
  if (canActWithSelected() && selectedId) {
    const piece = getPiece(state, selectedId);
    const { canMove, canShoot } = hexActions(selectedId, hex);
    if (!canMove && !canShoot && piece) {
      const dir = redZoneDir(piece, hex);
      if (dir != null) {
        void commitRotate(dir);
        return;
      }
    }
    if (canMove && canShoot) {
      if (pendingHex && eq(pendingHex, hex)) {
        pendingHex = null;
        render();
        return;
      }
      commitPath = drawnPathTo(hex);
      pendingHex = hex;
      hoverHex = null;
      render();
      return;
    }
    if (canShoot) {
      void tryAct(hex, 'shoot');
      return;
    }
    if (canMove) {
      commitPath = drawnPathTo(hex);
      void tryAct(hex, 'move');
      return;
    }
  }

  if (occ) {
    const skipStaminaForOther =
      canControl() &&
      state.staminaBonus &&
      !!state.scoutPieceId &&
      occ.id !== state.scoutPieceId &&
      occ.side === state.turn;
    if (skipStaminaForOther) {
      void skipScout(occ.id);
      return;
    }
    selectPiece(occ.id);
    return;
  }

  const board = tokenAt(state.tokens, hex);
  if (board?.type === 'board' && board.read && board.text) {
    boardPopup = { text: board.text };
    render();
    return;
  }

  // Shoot-range / preview tints are not actions — keep the piece selected
  if (selectedId && highlights.some((h) => eq(h.hex, hex))) {
    return;
  }

  clearSelection();
  render();
}

let editorPaintKey: string | null = null;
let editorUnitTokenStroke: 'add' | 'remove' | null = null;
let editorNoTouchStroke: 'add' | 'remove' | null = null;

function bindEditorBoard() {
  const svg = app.querySelector<SVGSVGElement>('svg.board');
  if (!svg) return;

  editorPointerAbort?.abort();
  editorPointerAbort = new AbortController();
  const { signal } = editorPointerAbort;

  const paintAt = (e: PointerEvent) => {
    const board = app.querySelector<SVGSVGElement>('svg.board');
    if (!board) return;
    const hex = hexFromPointer(board, e.clientX, e.clientY);
    if (!hex) return;
    const k = `${hex.col},${hex.row}`;
    if (k === editorPaintKey) return;
    const first = editorPaintKey === null;
    editorPaintKey = k;
    paintEditorHex(hex.col, hex.row, first);
  };

  const stopPaint = () => {
    editorPainting = false;
    editorPaintKey = null;
    editorUnitTokenStroke = null;
    editorNoTouchStroke = null;
  };

  svg.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      editorPainting = true;
      editorPaintKey = null;
      editorUnitTokenStroke = null;
      editorNoTouchStroke = null;
      paintAt(e);
    },
    { signal },
  );
  window.addEventListener(
    'pointermove',
    (e) => {
      if (editorPainting) paintAt(e);
    },
    { signal },
  );
  window.addEventListener('pointerup', stopPaint, { signal });
  window.addEventListener('pointercancel', stopPaint, { signal });
}

function hexFromPointer(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): Hex | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  const grid = currentGrid();
  const hex = pixelToHex(pt.x - PAD, pt.y - PAD, HEX_SIZE, grid.orientation);
  if (
    hex.col < 0 ||
    hex.row < 0 ||
    hex.col >= grid.cols ||
    hex.row >= grid.rows
  ) {
    return null;
  }
  return hex;
}

function bindBoardOnly() {
  if (screen === 'editor') {
    bindEditorBoard();
    return;
  }
  const svg = app.querySelector<SVGSVGElement>('svg.board');
  if (!svg) return;

  svg.addEventListener('click', (e) => {
    const hex = hexFromPointer(svg, e.clientX, e.clientY);
    if (!hex) return;
    onHexClick(hex.col, hex.row);
  });
  svg.querySelectorAll<SVGGElement>('.hex-rotate-btn').forEach((g) => {
    g.addEventListener('click', (e) => {
      e.stopPropagation();
      const piece = selectedId ? getPiece(state, selectedId) : null;
      const col = Number(g.dataset.col);
      const row = Number(g.dataset.row);
      const at = Number.isInteger(col) && Number.isInteger(row) ? { col, row } : null;
      const dir = piece && at ? redZoneDir(piece, at) : null;
      if (dir != null) void commitRotate(dir);
    });
  });

  svg.addEventListener('pointerleave', () => {
    if (animating) return;
    paintBoardHover(null);
  });

  svg.addEventListener('pointermove', (e) => {
    if (animating) return;
    const hex = hexFromPointer(svg, e.clientX, e.clientY);
    if (!hex) {
      paintBoardHover(null);
      return;
    }
    const sel = selectedId ? getPiece(state, selectedId) : null;
    const moveHover = highlights.some(
      (h) => (h.kind === 'move' || h.kind === 'stamina') && eq(h.hex, hex),
    );
    const splashHover =
      !!sel &&
      hasSplash(UNIT_STATS[sel.type]) &&
      highlights.some((h) => h.kind === 'shoot' && eq(h.hex, hex));
    const zoneHover = !!sel && redZoneDir(sel, hex) != null;
    paintBoardHover(moveHover || splashHover || zoneHover ? hex : null);
  });
}

function paintBoardHover(next: Hex | null) {
  if (animating) return;
  const changed =
    (!!next && (!hoverHex || !eq(hoverHex, next))) || (!next && !!hoverHex);
  if (!changed) return;
  hoverHex = next;
  const sel = selectedId ? getPiece(state, selectedId) : null;
  const moveHover = !!(
    next &&
    highlights.some(
      (h) => (h.kind === 'move' || h.kind === 'stamina') && eq(h.hex, next),
    )
  );
  rotatePreviewDir = sel && next && !moveHover ? redZoneDir(sel, next) : null;
  const board = app.querySelector('svg.board');
  if (board) {
    board.outerHTML = renderBoard();
    bindBoardOnly();
    placeHexChoice();
  }
}

function levelSelectOptions(selectedId: string | null): string {
  const groups = LEVEL_CATEGORIES.map((cat) => ({
    cat,
    levels: levelsInCategory(cat),
  })).filter((g) => g.levels.length);
  const opts = [`<option value="random"${!selectedId ? ' selected' : ''}>Random map</option>`];
  for (const g of groups) {
    opts.push(`<optgroup label="${LEVEL_CATEGORY_LABEL[g.cat]}">`);
    for (const l of g.levels) {
      const tag = l.id === defaultLevelId ? ' (default)' : '';
      opts.push(
        `<option value="${l.id}"${selectedId === l.id ? ' selected' : ''}>${escapeHtml(levelLabel(l))}${tag}</option>`,
      );
    }
    opts.push('</optgroup>');
  }
  return opts.join('');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function syncDotState(s: ServerStatus = getServerStatus()): 'ok' | 'off' | 'checking' {
  if (s === 'ok') return 'ok';
  if (s === 'checking') return 'checking';
  return 'off';
}

function syncDotLabel(s: ServerStatus = getServerStatus()): string {
  if (s === 'ok') return 'Online';
  if (s === 'checking') return 'Connecting';
  if (s === 'err') return 'Server error';
  return 'Offline';
}

function appVerHtml(): string {
  const s = getServerStatus();
  const state = syncDotState(s);
  const label = syncDotLabel(s);
  return `<span class="app-ver">v${APP_VERSION}<span class="sync-dot ${state}" title="${label}" role="img" aria-label="${label}"></span></span>`;
}

function paintSyncDot(s: ServerStatus = getServerStatus()): void {
  const state = syncDotState(s);
  const label = syncDotLabel(s);
  app.querySelectorAll('.sync-dot').forEach((el) => {
    el.className = `sync-dot ${state}`;
    el.setAttribute('title', label);
    el.setAttribute('aria-label', label);
  });
}

function inEditorSection(): boolean {
  return screen === 'levels' || screen === 'editor' || screen === 'units' || screen === 'ai';
}

function renderToolbar(): string {
  const editorNav = inEditorSection()
    ? `<nav class="editor-nav" aria-label="Levels, units, and AI">
        <button type="button" id="editor-nav-levels" class="${screen === 'levels' || screen === 'editor' ? 'active' : ''}">Levels</button>
        <button type="button" id="editor-nav-units" class="${screen === 'units' ? 'active' : ''}">Units</button>
        <button type="button" id="editor-nav-ai" class="${screen === 'ai' ? 'active' : ''}">AI</button>
      </nav>`
    : '';
  return `<div class="toolbar">
    <h1><span class="app-name">${APP_NAME}</span> ${appVerHtml()}</h1>
    <button type="button" id="go-start" class="${screen === 'start' ? 'active' : ''}">Play game</button>
    ${editorNav}
  </div>`;
}

function mapPickTitle(kind: MapPickKind): string {
  if (kind === 'ai') return 'Skirmish vs AI';
  if (kind === 'hotseat') return 'Hotseat';
  if (kind === 'campaign') return 'Campaign';
  return 'Tutorial';
}

function mapPickMetaLine(l: SavedLevel, kind: MapPickKind, index: number, maps: SavedLevel[]): string {
  const armyN = Array.isArray(l.armies) ? l.armies.length : null;
  const army = armyN === null ? 'stock armies' : `${armyN} pcs`;
  const size = `${l.cols}×${l.rows} · ${l.orientation === 'flat' ? 'flat' : 'point'} · ${army}`;
  if (!pickLocks(kind)) return size;
  if (!sequenceUnlocked(maps, index)) return 'Locked · win the previous map';
  return hasWonLevel(l.id) ? `Cleared · ${size}` : size;
}

let randomMapThumb: {
  period: Period;
  cols: number;
  rows: number;
  orientation: HexOrientation;
  terrain: SavedLevel['terrain'];
  tokens: SavedLevel['tokens'];
  armies: SavedLevel['armies'];
} | null = null;

function randomMapThumbSrc() {
  if (randomMapThumb?.period === selectedPeriod) return randomMapThumb;
  const s = createInitialState(
    DEFAULT_MAP,
    defaultArmyStamps(RANDOM_COLS, ROWS, selectedPeriod),
  );
  randomMapThumb = {
    period: selectedPeriod,
    cols: s.cols,
    rows: s.rows,
    orientation: s.orientation,
    terrain: s.terrain,
    tokens: s.tokens,
    armies: s.pieces.map((p) => ({
      type: p.type,
      col: p.col,
      row: p.row,
      side: p.side,
    })),
  };
  return randomMapThumb;
}

function renderRandomMapPickOpt(kind: MapPickKind): string {
  const meta =
    kind === 'hotseat' ? 'Generated · two players' : 'Generated · vs AI';
  return `<button type="button" class="start-opt map-pick-opt map-pick-opt-random" data-pick-map="random" title="Play Randomised map" aria-label="Randomised map">
    ${renderLevelThumb(randomMapThumbSrc())}
    <span class="map-pick-copy">
      <span class="start-opt-name">Randomised map</span>
      <span class="level-teaser">Choose your army and your opponent. Now go to war!</span>
      <span class="start-opt-meta">${meta}</span>
    </span>
  </button>`;
}

function renderMapPickOpt(l: SavedLevel, kind: MapPickKind, index: number, maps: SavedLevel[]): string {
  const locked = pickLocks(kind) && !sequenceUnlocked(maps, index);
  const name = escapeHtml(levelLabel(l));
  const lock = locked
    ? `<svg class="map-pick-lock" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="3.2" y="7.2" width="9.6" height="7.4" rx="1.4" fill="currentColor"/><path d="M5.1 7.2V5.1a2.9 2.9 0 0 1 5.8 0v2.1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`
    : '';
  const stars = bestStarsForLevel(l.id);
  const starBit = stars ? ` · ${stars} star${stars === 1 ? '' : 's'}` : '';
  return `<button type="button" class="start-opt map-pick-opt${locked ? ' locked' : ''}" data-pick-map="${l.id}"${
    locked ? ' disabled' : ''
  } title="${locked ? `${name} — locked` : `Play ${name}`}" aria-label="${locked ? `${name} (locked)` : `${name}${starBit}`}">
    ${renderLevelThumb(l)}
    <span class="map-pick-copy">
      <span class="start-opt-name">${lock}${name}</span>
      ${levelTeaserHtml(l)}
      <span class="start-opt-meta">${mapPickMetaLine(l, kind, index, maps)}</span>
      ${bestStarsHtml(l.id)}
    </span>
  </button>`;
}

function renderMapPickScreen(kind: MapPickKind): string {
  const maps = mapsForPick(kind);
  const title = mapPickTitle(kind);
  const era = PERIOD_LABEL[selectedPeriod];
  const tag =
    pickLocks(kind)
      ? `Pick a map · ${era} · vs AI. Finish one to unlock the next.`
      : kind === 'hotseat'
        ? `Pick a map · ${era} · two players, one device.`
        : `Pick a map · ${era} · vs AI.`;
  const emptyCat = kind === 'hotseat' || kind === 'ai' ? 'skirmish' : kind;
  const randomOpt = skirmishPick(kind) ? renderRandomMapPickOpt(kind) : '';
  const body =
    randomOpt || maps.length
      ? `<div class="map-pick-list">${maps.map((l, i) => renderMapPickOpt(l, kind, i, maps)).join('')}${randomOpt}</div>`
      : `<p class="editor-empty">No ${emptyCat} maps for ${era.toLowerCase()}. Mark saved levels as ${LEVEL_CATEGORY_LABEL[emptyCat]} in the Editor.</p>`;
  return `
    <div class="board-wrap start-wrap">
      <div class="start-screen start-pick">
        <div class="map-pick-head">
          <p class="start-kicker">${mapPickTitle(kind)}</p>
          <button type="button" id="map-pick-back">Back</button>
        </div>
        <h2 class="start-title">${escapeHtml(title)}</h2>
        <p class="start-tag">${escapeHtml(tag)}</p>
        ${body}
      </div>
      ${renderRandomSetupOverlay()}
    </div>`;
}

function renderRandomSetupOverlay(): string {
  if (!randomSetup) return '';
  const picks = randomArmyChoices();
  const hotseat = randomSetup.kind === 'hotseat';
  const yoursLabel = hotseat ? 'Red army' : 'Your army';
  const theirsLabel = hotseat ? 'Blue army' : 'Enemy army';
  const yoursOpts = picks
    .map(
      (p) =>
        `<option value="${p.id}"${p.id === randomSetup!.yoursId ? ' selected' : ''}>${escapeHtml(p.name)} — ${escapeHtml(p.meta)}</option>`,
    )
    .join('');
  const theirsOpts = picks
    .map(
      (p) =>
        `<option value="${p.id}"${p.id === randomSetup!.theirsId ? ' selected' : ''}>${escapeHtml(p.name)} — ${escapeHtml(p.meta)}</option>`,
    )
    .join('');
  const aiOpts = AI_STYLES.map(
    (st) =>
      `<option value="${st}"${st === randomSetup!.aiStyle ? ' selected' : ''}>${AI_STYLE_LABEL[st]}</option>`,
  ).join('');
  const empty = !picks.length;
  const sub = empty
    ? `No armies for ${PERIOD_LABEL[selectedPeriod].toLowerCase()}. Save one in the Editor.`
    : hotseat
      ? 'Pick two armies for this device.'
      : 'Pick two armies. The enemy uses the AI you choose.';
  return `
    <div class="end-overlay briefing random-setup-overlay" id="random-setup-overlay" role="dialog" aria-modal="true" aria-label="Randomised battle">
      <div class="end-card briefing random-setup">
        <h2 class="end-title">Randomised battle</h2>
        <p class="end-sub">${escapeHtml(sub)}</p>
        ${
          empty
            ? ''
            : `<div class="random-setup-fields">
          <label>${yoursLabel}
            <select id="random-setup-yours">${yoursOpts}</select>
          </label>
          <label>${theirsLabel}
            <select id="random-setup-theirs">${theirsOpts}</select>
          </label>
          ${
            hotseat
              ? ''
              : `<label>Enemy AI
            <select id="random-setup-ai">${aiOpts}</select>
          </label>`
          }
        </div>`
        }
        <div class="end-actions">
          ${empty ? '' : '<button type="button" id="random-setup-go">To war</button>'}
          <button type="button" id="random-setup-cancel" class="ghost">Cancel</button>
        </div>
      </div>
    </div>`;
}

function renderStartScreen(): string {
  if (mapPick) return renderMapPickScreen(mapPick);
  const campaignN = levelsInCategory('campaign', selectedPeriod).length;
  const tutorialN = levelsInCategory('tutorial', selectedPeriod).length;
  const historicalN = levelsInCategory('historical', selectedPeriod).length;
  const skirmishN = skirmishMaps().length;
  const mapWord = (n: number) => `${n} map${n === 1 ? '' : 's'}`;
  const tutOpen = tutorialDone();
  const menuLock = tutOpen
    ? ''
    : `<svg class="map-pick-lock" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="3.2" y="7.2" width="9.6" height="7.4" rx="1.4" fill="currentColor"/><path d="M5.1 7.2V5.1a2.9 2.9 0 0 1 5.8 0v2.1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const gateAttr = (empty: boolean, emptyTitle: string, openTitle: string) =>
    !tutOpen || empty
      ? ` disabled title="${!tutOpen ? 'Finish the Tutorial to unlock' : emptyTitle}"`
      : ` title="${openTitle}"`;
  const gateMeta = (empty: boolean, emptyMeta: string, openMeta: string) =>
    !tutOpen ? 'Locked · finish Tutorial' : empty ? emptyMeta : openMeta;
  const periodPicks = PERIODS.map(
    (p) =>
      `<button type="button" class="period-pick${selectedPeriod === p ? ' active' : ''}" data-period="${p}">${PERIOD_LABEL[p]}${eraIsWip(p) ? '<span class="era-wip">under construction</span>' : ''}</button>`,
  ).join('');
  return `
    <div class="board-wrap start-wrap">
      <div class="start-screen">
        <p class="start-kicker">Hex army-chess</p>
        <h2 class="start-title"><span class="app-name">${APP_NAME}</span> ${appVerHtml()}</h2>
        <p class="start-tag">Kill the enemy General — or the whole army.</p>
        <div class="period-picks" role="radiogroup" aria-label="Period">${periodPicks}</div>
        <div class="start-menu">
          <button type="button" class="start-opt" data-start="campaign"${gateAttr(!campaignN, 'Mark saved levels as Campaign in the Editor', 'Pick a campaign map vs AI. Finish one to unlock the next.')}>
            <span class="start-opt-name">${menuLock}Campaign</span>
            <span class="start-opt-meta">${gateMeta(!campaignN, 'No campaign maps', `${mapWord(campaignN)} · vs AI`)}</span>
          </button>
          <button type="button" class="start-opt" data-start="tutorial"${tutorialN ? '' : ' disabled'}
            title="${tutorialN ? 'Pick a tutorial map vs AI. Finish one to unlock the next.' : 'Mark saved levels as Tutorial in the Editor'}">
            <span class="start-opt-name">Tutorial</span>
            <span class="start-opt-meta">${tutorialN ? `${mapWord(tutorialN)} · vs AI` : 'No tutorial maps'}</span>
          </button>
          <button type="button" class="start-opt" data-start="historical"${gateAttr(!historicalN, 'Mark saved levels as Historical in the Editor', 'Historical battles in editor order, vs AI')}>
            <span class="start-opt-name">${menuLock}Historical Battle</span>
            <span class="start-opt-meta">${gateMeta(!historicalN, 'No historical maps', `${mapWord(historicalN)} · vs AI`)}</span>
          </button>
          <button type="button" class="start-opt" data-start="ai"${gateAttr(false, '', 'Pick a skirmish map vs AI, or a randomised map')}>
            <span class="start-opt-name">${menuLock}Skirmish vs AI</span>
            <span class="start-opt-meta">${gateMeta(false, '', skirmishN ? `${mapWord(skirmishN)} · pick a map` : 'Randomised map · vs AI')}</span>
          </button>
          <button type="button" class="start-opt" data-start="random"${gateAttr(false, '', 'Generated map vs AI. Pick two armies and the enemy AI.')}>
            <span class="start-opt-name">${menuLock}Randomised Battle</span>
            <span class="start-opt-meta">${gateMeta(false, '', 'Generated map · vs AI')}</span>
          </button>
        </div>
        <div class="start-tools">
          <button type="button" class="start-reset" data-start="editor">Editor</button>
          <button type="button" id="reset-progress" class="start-reset">Reset progress</button>
        </div>
      </div>
      ${renderRandomSetupOverlay()}
    </div>`;
}

function bindToolbarEvents() {
  app.querySelector('#go-start')?.addEventListener('click', () => {
    if (screen === 'start' && !mapPick) return;
    if (screen === 'start' && mapPick) {
      showStart();
      return;
    }
    if (!confirmLeaveEditor()) return;
    showStart();
  });
  app.querySelectorAll<HTMLButtonElement>('.period-pick').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedPeriod = setSelectedPeriod(btn.dataset.period);
      render();
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-start]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.start;
      if (
        !tutorialDone() &&
        (kind === 'campaign' ||
          kind === 'historical' ||
          kind === 'ai' ||
          kind === 'random')
      ) {
        return;
      }
      if (kind === 'historical') startPlaylist(kind);
      else if (kind === 'campaign') showMapPick('campaign');
      else if (kind === 'tutorial') showMapPick('tutorial');
      else if (kind === 'ai') showMapPick('ai');
      else if (kind === 'random') openRandomSetup('ai');
      else if (kind === 'editor') enterLevels(true);
    });
  });
  app.querySelector('#reset-progress')?.addEventListener('click', () => {
    if (!confirm('Reset all tutorial and campaign progress?')) return;
    const ids = listLevels()
      .filter((l) => l.category === 'tutorial' || l.category === 'campaign')
      .map((l) => l.id);
    clearLevelWins(ids);
    render();
  });
  app.querySelector('#map-pick-back')?.addEventListener('click', () => showStart());
  app.querySelectorAll<HTMLButtonElement>('[data-pick-map]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.pickMap;
      if (!id || !mapPick) return;
      startPickedMap(id, mapPick);
    });
  });
  app.querySelector('#random-setup-yours')?.addEventListener('change', (e) => {
    if (!randomSetup) return;
    randomSetup.yoursId = (e.target as HTMLSelectElement).value;
  });
  app.querySelector('#random-setup-theirs')?.addEventListener('change', (e) => {
    if (!randomSetup) return;
    randomSetup.theirsId = (e.target as HTMLSelectElement).value;
  });
  app.querySelector('#random-setup-ai')?.addEventListener('change', (e) => {
    if (!randomSetup) return;
    const v = (e.target as HTMLSelectElement).value;
    if (isAiStyle(v)) randomSetup.aiStyle = v;
  });
  app.querySelector('#random-setup-go')?.addEventListener('click', () => confirmRandomSetup());
  const closeRandomSetup = () => {
    randomSetup = null;
    render();
  };
  app.querySelector('#random-setup-cancel')?.addEventListener('click', closeRandomSetup);
  app.querySelector('#random-setup-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeRandomSetup();
  });
  app.querySelector('#editor-nav-levels')?.addEventListener('click', () => {
    if (screen === 'levels') return;
    if (!confirmLeaveEditor()) return;
    enterLevels();
  });
  app.querySelector('#editor-nav-units')?.addEventListener('click', () => {
    if (screen === 'units') return;
    if (!confirmLeaveEditor()) return;
    enterUnits();
  });
  app.querySelector('#editor-nav-ai')?.addEventListener('click', () => {
    if (screen === 'ai') return;
    if (!confirmLeaveEditor()) return;
    enterAi();
  });
  app.querySelector('#edit-this-level')?.addEventListener('click', () => {
    if (!activeLevelId) return;
    enterEditor(activeLevelId);
  });
  app.querySelector('#edit-current-map')?.addEventListener('click', () => {
    enterEditorFromMatch();
  });
}

function terrainSwatchSvg(kind: Terrain): string {
  const o = editorOrientation;
  const size = 10;
  const pad = 4;
  const spanX = (o === 'flat' ? 2 : Math.sqrt(3)) * size;
  const spanY = (o === 'flat' ? Math.sqrt(3) : 2) * size;
  const w = spanX + pad * 2;
  const h = spanY + pad * 2;
  const pts = hexCorners(0, 0, size, o);
  const clipId = `swatch-clip-${kind}`;
  let fill = 'var(--land)';
  let stroke = 'var(--hex-stroke)';
  let sw = 1.4;
  let extra = '';
  if (kind === 'land') {
    extra = `<g clip-path="url(#${clipId})">
      <path d="M-2.4 4.6 L-1.8 0.4 M-0.8 4.6 L-1.8 0.4"
        fill="none" stroke="var(--land-blade)" stroke-width="0.8" stroke-linecap="round" opacity="0.5"/>
      <path d="M3.2 3.2 L3.6 0.2"
        fill="none" stroke="var(--land-blade)" stroke-width="0.7" stroke-linecap="round" opacity="0.38"/>
    </g>`;
  } else if (kind === 'water') {
    fill = 'var(--water)';
    stroke = 'var(--water-stroke)';
    extra = `<g clip-path="url(#${clipId})">
      <path d="M-10 -2.2 Q-4 -4.8 2 -2.2 T12 -2.2" fill="none" stroke="var(--water-hi)" stroke-width="1.2" opacity="0.8"/>
      <path d="M-10 1.6 Q-3 -0.4 3 1.6 T12 1.6" fill="none" stroke="var(--water-lo)" stroke-width="1.1" opacity="0.75"/>
      <path d="M-10 5.4 Q-2 3.4 4 5.4 T12 5.4" fill="none" stroke="var(--water-hi)" stroke-width="1" opacity="0.55"/>
    </g>`;
  } else if (kind === 'rock') {
    fill = 'var(--rock)';
    stroke = 'var(--rock-stroke)';
    sw = 2.2;
    extra = `<polygon points="${hexCorners(0, 2.6, size, o)}" fill="var(--rock-shadow)"/>
      <polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="miter"/>
      <polygon points="${hexCorners(0, 0, size * 0.82, o)}" fill="none" stroke="rgba(180,174,166,0.5)" stroke-width="1.15"/>
      <polygon points="${hexCorners(0, 0, size * 0.58, o)}" fill="none" stroke="rgba(160,156,148,0.4)" stroke-width="0.9"/>
      <polygon points="${hexCorners(0, 0, size * 0.32, o)}" fill="rgba(40,38,36,0.28)" stroke="rgba(200,196,188,0.34)" stroke-width="0.75"/>`;
  } else if (kind === 'wall') {
    fill = 'var(--wall)';
    stroke = 'var(--wall-stroke)';
    sw = 2;
    extra = `<g clip-path="url(#${clipId})">
      <rect x="-10" y="-8" width="20" height="6" fill="var(--wall-hi)" opacity="0.5"/>
      <rect x="-10" y="0.4" width="20" height="8" fill="var(--wall-lo)" opacity="0.35"/>
      <path d="M-10 -2 H10 M-10 2.6 H10" stroke="var(--wall-ink)" stroke-width="1"/>
      <path d="M0 -8 V-2 M-4 2.6 V9 M4 2.6 V9" stroke="var(--wall-ink)" stroke-width="1"/>
    </g>`;
  } else if (kind === 'high') {
    fill = 'var(--high)';
    stroke = 'var(--high-stroke)';
    sw = 1.8;
    extra = `<polygon points="${hexCorners(0, 1.3, size, o)}" fill="var(--high-shadow)"/>
      <polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="miter"/>
      <polygon points="${hexCorners(0, 0, size * 0.72, o)}" fill="none" stroke="rgba(240,220,160,0.55)" stroke-width="1.15"/>
      <polygon points="${hexCorners(0, 0, size * 0.42, o)}" fill="rgba(255,236,180,0.22)" stroke="rgba(255,245,200,0.4)" stroke-width="0.8"/>`;
  } else if (kind === 'plateau') {
    fill = 'var(--plateau)';
    stroke = 'var(--plateau-stroke)';
    sw = 2;
    extra = `<polygon points="${hexCorners(0, 2.2, size, o)}" fill="var(--plateau-shadow)"/>
      <polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="miter"/>
      <polygon points="${hexCorners(0, 0, size * 0.82, o)}" fill="none" stroke="rgba(220,214,204,0.55)" stroke-width="1.15"/>
      <polygon points="${hexCorners(0, 0, size * 0.58, o)}" fill="none" stroke="rgba(236,230,220,0.4)" stroke-width="0.9"/>
      <polygon points="${hexCorners(0, 0, size * 0.32, o)}" fill="rgba(255,250,240,0.2)" stroke="rgba(255,252,245,0.38)" stroke-width="0.75"/>`;
  }
  const body =
    kind === 'high' || kind === 'plateau' || kind === 'rock'
      ? extra
      : `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="miter"/>${extra}`;
  return `<svg class="tile-swatch" viewBox="${(-w / 2).toFixed(1)} ${(-h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" width="22" height="22" aria-hidden="true">
    <defs><clipPath id="${clipId}"><polygon points="${pts}"/></clipPath></defs>
    ${body}
  </svg>`;
}

function tokenSwatchSvg(type: TokenType): string {
  const o = editorOrientation;
  const size = 10;
  const pad = 4;
  const spanX = (o === 'flat' ? 2 : Math.sqrt(3)) * size;
  const spanY = (o === 'flat' ? Math.sqrt(3) : 2) * size;
  const w = spanX + pad * 2;
  const h = spanY + pad * 2;
  const pts = hexCorners(0, 0, size, o);
  return `<svg class="tile-swatch" viewBox="${(-w / 2).toFixed(1)} ${(-h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" width="22" height="22" aria-hidden="true">
    <polygon points="${pts}" fill="var(--land)" stroke="var(--hex-stroke)" stroke-width="1.4" stroke-linejoin="miter"/>
    ${
      type === 'wall' || type === 'house' || type === 'palisade' || type === 'tree'
        ? tokenGlyphSvg(type, size * 0.8, o)
        : type === 'flag'
          ? tokenGlyphSvg('flag', 13, o)
          : tokenGlyphSvg(type, 13)
    }
  </svg>`;
}

function renderMapPanel(): string {
  const brushes = TERRAIN_BRUSHES.map(
    (b) =>
      `<button type="button" class="brush ${b.id}${editorBrush === b.id ? ' active' : ''}" data-brush="${b.id}">${terrainSwatchSvg(b.id)}<span>${b.label}</span></button>`,
  ).join('');
  return `
    <section class="editor-panel editor-panel-map">
      <h3>Tiles</h3>
      <div class="editor-brushes">
        ${brushes}
        <button type="button" id="editor-clear" class="ghost">Clear board</button>
      </div>
    </section>`;
}

function noTouchSwatchSvg(): string {
  const o = editorOrientation;
  const size = 10;
  const pad = 4;
  const spanX = (o === 'flat' ? 2 : Math.sqrt(3)) * size;
  const spanY = (o === 'flat' ? Math.sqrt(3) : 2) * size;
  const w = spanX + pad * 2;
  const h = spanY + pad * 2;
  const pts = hexCorners(0, 0, size, o);
  return `<svg class="tile-swatch" viewBox="${(-w / 2).toFixed(1)} ${(-h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" width="22" height="22" aria-hidden="true">
    <polygon points="${pts}" fill="var(--land)" stroke="var(--hex-stroke)" stroke-width="1.4" stroke-linejoin="miter"/>
    ${noTouchMarkSvg(size * 0.72)}
  </svg>`;
}

function renderTokenPanel(): string {
  const tokens = TOKEN_TYPES.filter((t) => t !== 'notouch')
    .map(
      (t) =>
        `<button type="button" class="brush token ${t}${editorBrush === t ? ' active' : ''}" data-brush="${t}">${tokenSwatchSvg(t)}<span>${TOKEN_LABEL[t]}</span></button>`,
    )
    .join('');
  return `
    <section class="editor-panel editor-panel-tokens">
      <h3>Tile tokens</h3>
      <div class="editor-brushes">
        ${tokens}
        <button type="button" class="brush token notouch${editorBrush === 'notouch' ? ' active' : ''}" data-brush="notouch">${noTouchSwatchSvg()}<span>Do not touch</span></button>
      </div>
    </section>`;
}

function unitTokenSwatchSvg(type: UnitTokenType): string {
  const o = editorOrientation;
  const size = 10;
  const pad = 4;
  const spanX = (o === 'flat' ? 2 : Math.sqrt(3)) * size;
  const spanY = (o === 'flat' ? Math.sqrt(3) : 2) * size;
  const w = spanX + pad * 2;
  const h = spanY + pad * 2;
  const pts = hexCorners(0, 0, size, o);
  return `<svg class="tile-swatch" viewBox="${(-w / 2).toFixed(1)} ${(-h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" width="22" height="22" aria-hidden="true">
    <polygon points="${pts}" fill="var(--land)" stroke="var(--hex-stroke)" stroke-width="1.4" stroke-linejoin="miter"/>
    ${unitTokenGlyphSvg(type, 16)}
  </svg>`;
}

function renderUnitTokenPanel(): string {
  const tokens = UNIT_TOKEN_TYPES.map((t) => {
    const brush: UnitTokenBrush = `unit:${t}`;
    return `<button type="button" class="brush unit-token ${t}${editorBrush === brush ? ' active' : ''}" data-brush="${brush}">${unitTokenSwatchSvg(t)}<span>${UNIT_TOKEN_LABEL[t]}</span></button>`;
  }).join('');
  return `
    <section class="editor-panel editor-panel-unit-tokens">
      <h3>Unit tokens</h3>
      <div class="editor-brushes">
        ${tokens}
      </div>
    </section>`;
}

function unitBrushIconSvg(type: UnitType): string {
  const side = editorArmySide;
  const fill = pieceColor(side);
  const ink = iconInk(side);
  const hexed = UNIT_STATS[type].hexArmor;
  const body = hexed
    ? `<polygon points="${hexCorners(0, 0, 8.6, editorOrientation)}" fill="${fill}"/>`
    : `<circle cx="0" cy="0" r="8.2" fill="${fill}"/>`;
  return `<svg class="unit-swatch" viewBox="-10 -10 20 20" width="22" height="22" aria-hidden="true">
    ${body}
    <g fill="${ink}" color="${ink}">${pieceIconSvg(type, 12)}</g>
  </svg>`;
}

function renderArmySelectPanel(): string {
  const catUnits = UNIT_TYPES.filter(
    (t) => UNIT_STATS[t].category === editorUnitCategory,
  );
  const eraOpts = UNIT_CATEGORIES.map(
    (c) =>
      `<option value="${c}"${editorUnitCategory === c ? ' selected' : ''}>${eraIsWip(c) ? `${UNIT_CATEGORY_LABEL[c]} (under construction)` : UNIT_CATEGORY_LABEL[c]}</option>`,
  ).join('');
  const unitBrushes = catUnits
    .map(
      (t) =>
        `<button type="button" class="brush unit${editorBrush === t ? ' active' : ''}" data-brush="${t}">${unitBrushIconSvg(t)}<span>${escapeHtml(UNIT_STATS[t].name)}</span></button>`,
    )
    .join('');
  return `
    <div class="editor-top-army">
    <section class="editor-panel editor-panel-army">
      <h3>Army</h3>
      <div class="editor-armies">${SIDES.map((s) => {
        const opts = ARMY_CONTROLS.map(
          (c) =>
            `<option value="${c}"${editorControls[s] === c ? ' selected' : ''}>${ARMY_CONTROL_LABEL[c]}</option>`,
        ).join('');
        const styleOpts = AI_STYLES.map(
          (st) =>
            `<option value="${st}"${editorAiStyles[s] === st ? ' selected' : ''}>${AI_STYLE_LABEL[st]}</option>`,
        ).join('');
        const ai = editorControls[s] !== 'player';
        return `<div class="editor-army-row">
        <button type="button" class="editor-side ${s}${editorArmySide === s ? ' active' : ''}" data-army-side="${s}">${SIDE_LABEL[s]}</button>
        <select class="editor-control" data-army-control="${s}" aria-label="${SIDE_LABEL[s]} controller">${opts}</select>
        ${
          ai
            ? `<select class="editor-control editor-style" data-army-style="${s}" aria-label="${SIDE_LABEL[s]} AI style">${styleOpts}</select>`
            : ''
        }
      </div>`;
      }).join('')}</div>
      <label class="editor-cat">Era
        <select id="editor-unit-cat">${eraOpts}</select>
      </label>
      <div class="editor-army">
        ${catUnits.length ? '' : `<span class="lvl-meta">No ${UNIT_CATEGORY_LABEL[editorUnitCategory]} units</span>`}
        ${unitBrushes}
      </div>
    </section>
    <button type="button" class="brush erase${editorBrush === 'erase' ? ' active' : ''}" data-brush="erase">Erase <svg class="icon-trash" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M6.1 1.2h3.8l.45 1.3H14v1.25H2V2.5h3.65L6.1 1.2zM3.25 5h9.5l-.55 8.25A1.4 1.4 0 0 1 10.8 14.6H5.2a1.4 1.4 0 0 1-1.4-1.35L3.25 5zm2.3 1.35v6.15h1.15V6.35H5.55zm3.2 0v6.15H9.9V6.35H8.75z"/></svg></button>
    </div>`;
}

function renderLevelThumb(lvl: {
  cols: number;
  rows: number;
  orientation: HexOrientation;
  terrain: SavedLevel['terrain'];
  tokens?: SavedLevel['tokens'];
  armies?: SavedLevel['armies'];
}): string {
  const ori = lvl.orientation;
  const cols = lvl.cols;
  const rows = lvl.rows;
  const extent1 = hexGridExtent(cols, rows, 1, ori);
  const size = Math.max(
    3,
    Math.min(9, Math.floor(Math.min(156 / (extent1.w + 0.5), 96 / (extent1.h + 0.5)))),
  );
  const pad = size * 1.05;
  const extent = hexGridExtent(cols, rows, size, ori);
  const w = pad * 2 + extent.w;
  const h = pad * 2 + extent.h;
  let hexes = '';
  for (let row = 0; row < rows; row++) {
    const line = lvl.terrain[row];
    if (!line) continue;
    for (let col = 0; col < cols; col++) {
      const terrain = line[col] ?? 'land';
      const { x, y } = hexToPixel({ col, row }, size, ori);
      const cx = x + pad;
      const cy = y + pad;
      let cls = `hex ${terrain}`;
      if (terrain === 'land' && (col + row) % 2) cls += ' alt';
      hexes += `<polygon class="${cls}" points="${hexCorners(cx, cy, size, ori)}" />`;
      if (terrain === 'high') {
        hexes += `<polygon class="hex-high-rim" points="${hexCorners(cx, cy, size * 0.72, ori)}" />`;
        hexes += `<polygon class="hex-high-top" points="${hexCorners(cx, cy, size * 0.42, ori)}" />`;
      } else if (terrain === 'plateau') {
        hexes += `<polygon class="hex-plateau-rim" points="${hexCorners(cx, cy, size * 0.82, ori)}" />`;
        hexes += `<polygon class="hex-plateau-mid" points="${hexCorners(cx, cy, size * 0.58, ori)}" />`;
        hexes += `<polygon class="hex-plateau-top" points="${hexCorners(cx, cy, size * 0.32, ori)}" />`;
      } else if (terrain === 'rock') {
        hexes += `<polygon class="hex-rock-rim" points="${hexCorners(cx, cy, size * 0.82, ori)}" />`;
        hexes += `<polygon class="hex-rock-mid" points="${hexCorners(cx, cy, size * 0.58, ori)}" />`;
        hexes += `<polygon class="hex-rock-top" points="${hexCorners(cx, cy, size * 0.32, ori)}" />`;
      }
    }
  }
  for (const t of lvl.tokens ?? []) {
    const { x, y } = hexToPixel({ col: t.col, row: t.row }, size, ori);
    hexes += `<g transform="translate(${x + pad}, ${y + pad})">${
      t.type === 'wall' || t.type === 'house' || t.type === 'palisade' || t.type === 'tree'
        ? tokenGlyphSvg(t.type, size * 0.8, ori, null, t.hp)
        : t.type === 'flag'
          ? tokenGlyphSvg('flag', size * 1.15, ori, t.owner)
          : tokenGlyphSvg(t.type, size * 1.2)
    }${tokenIsNoTouch(t) ? noTouchMarkSvg(size * 0.55) : ''}</g>`;
  }
  let dots = '';
  for (const p of lvl.armies ?? []) {
    const { x, y } = hexToPixel({ col: p.col, row: p.row }, size, ori);
    dots += `<circle class="thumb-piece ${p.side}" cx="${x + pad}" cy="${y + pad}" r="${(size * 0.34).toFixed(1)}" />`;
  }
  return `<svg class="level-thumb" viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${hexes}${dots}</svg>`;
}

function levelTeaserHtml(l: SavedLevel): string {
  const t = sanitizeTeaserText(l.teaserText);
  return t ? `<span class="level-teaser">${formatCopyHtml(t)}</span>` : '';
}

function levelMetaLine(l: SavedLevel): string {
  const armyN = Array.isArray(l.armies) ? l.armies.length : null;
  const army = armyN === null ? 'stock armies' : `${armyN} pcs`;
  return `${LEVEL_CATEGORY_LABEL[l.category]} · <span class="period-tag" data-period="${l.period}">${PERIOD_LABEL[l.period]}</span> · ${l.cols}×${l.rows} · ${l.orientation === 'flat' ? 'flat' : 'point'}${l.unitsPerTurn > 1 ? ` · ${l.unitsPerTurn}u` : ''}${l.maxTurns > 0 ? ` · ${l.maxTurns}t` : ''} · ${army}${l.id === defaultLevelId ? ' · default' : ''}`;
}

function renderLevelRow(l: SavedLevel): string {
  const current = l.id === editorLevelId ? ' current' : '';
  return `<li class="level-row${current}" data-level-id="${l.id}">
    <button type="button" class="level-drag" title="Drag to reorder" aria-label="Reorder ${escapeHtml(levelLabel(l))}">
      <svg viewBox="0 0 12 16" width="12" height="16" aria-hidden="true">
        <circle cx="4" cy="3" r="1.15" fill="currentColor"/>
        <circle cx="8" cy="3" r="1.15" fill="currentColor"/>
        <circle cx="4" cy="8" r="1.15" fill="currentColor"/>
        <circle cx="8" cy="8" r="1.15" fill="currentColor"/>
        <circle cx="4" cy="13" r="1.15" fill="currentColor"/>
        <circle cx="8" cy="13" r="1.15" fill="currentColor"/>
      </svg>
    </button>
    <button type="button" class="level-open" data-edit-level="${l.id}">
      <span class="level-name">${escapeHtml(levelLabel(l))}</span>
      ${levelTeaserHtml(l)}
      ${renderLevelThumb(l)}
      <span class="level-details">
        <span class="lvl-meta">${levelMetaLine(l)}</span>
        ${bestStarsHtml(l.id)}
      </span>
    </button>
    <button type="button" class="level-play" data-play-level="${l.id}" title="Play ${escapeHtml(levelLabel(l))}">
      <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true"><path d="M2.2 1.1v9.8L11 6Z" fill="currentColor"/></svg>
    </button>
    <button type="button" class="ghost danger" data-del-level="${l.id}" title="Delete">×</button>
  </li>`;
}

function renderLevelsOverview(): string {
  const all = listLevels();
  const filters = LEVEL_CATEGORIES.map(
    (c) =>
      `<button type="button" class="levels-filter${levelsFilter === c ? ' active' : ''}" data-levels-filter="${c}">${LEVEL_CATEGORY_LABEL[c]}</button>`,
  ).join('');
  const periodFilters = PERIODS.map(
    (p) =>
      `<button type="button" class="levels-filter${levelsPeriodFilter === p ? ' active' : ''}" data-levels-period="${p}" data-period="${p}">${PERIOD_LABEL[p]}${eraIsWip(p) ? '<span class="era-wip">under construction</span>' : ''}</button>`,
  ).join('');

  const levels = levelsInCategory(levelsFilter, levelsPeriodFilter);
  const emptyBits = [
    PERIOD_LABEL[levelsPeriodFilter].toLowerCase(),
    LEVEL_CATEGORY_LABEL[levelsFilter].toLowerCase(),
  ];

  let body: string;
  if (all.length === 0) {
    body = `<p class="editor-empty">No saved levels. New level opens a blank map you paint and save.</p>`;
  } else if (levels.length === 0) {
    body = `<p class="editor-empty">No ${emptyBits.join(' ')} levels.</p>`;
  } else {
    body = `<ul class="level-catalog">${levels.map(renderLevelRow).join('')}</ul>`;
  }

  return `
    <div class="board-wrap start-wrap levels-wrap">
      ${renderToolbar()}
      <div class="levels-overview">
        <div class="levels-head">
          <h2>Levels</h2>
          <button type="button" id="level-new" class="primary">New level</button>
        </div>
        <div class="levels-filters">${filters}</div>
        <div class="levels-filters levels-filters-period">${periodFilters}</div>
        ${body}
      </div>
    </div>`;
}

function renderEditorBar(): string {
  const era = editorUnitCategory;
  const forms = listFormationsInPeriod(era);
  const grid = currentGrid();
  const eraDefault =
    defaultFormationId && forms.some((f) => f.id === defaultFormationId)
      ? defaultFormationId
      : null;
  const stockDefault = era === 'modern' && !eraDefault;
  const stockRow =
    era === 'modern'
      ? `<li class="${editorFormationId === STOCK_FORMATION_ID ? 'active' : ''}">
      <button type="button" data-load-form="${STOCK_FORMATION_ID}">Standard <span class="lvl-meta">${grid.cols} wide${stockDefault ? ' · default' : ''}</span></button>
    </li>`
      : '';
  const formRows = forms
    .map(
      (f) => `<li class="${f.id === editorFormationId ? 'active' : ''}">
          <button type="button" data-load-form="${f.id}">${escapeHtml(f.name)} <span class="lvl-meta">${f.slots.length} pcs · ${formationCombatValue(f.slots)} · ${f.cols} wide${f.id === eraDefault ? ' · default' : ''}</span></button>
          <button type="button" class="ghost danger" data-del-form="${f.id}" title="Delete">×</button>
        </li>`,
    )
    .join('');
  const formList =
    stockRow || formRows
      ? `<ul class="editor-levels editor-formations">${stockRow}${formRows}</ul>`
      : `<p class="editor-empty">No ${UNIT_CATEGORY_LABEL[era]} armies.</p>`;

  const namedForm = editorFormationId && editorFormationId !== STOCK_FORMATION_ID;
  const isDefaultForm = namedForm && editorFormationId === eraDefault;
  const armyHint = namedForm ? editorFormationName : 'Standard';
  const armyOnto = SIDE_LABEL[editorArmySide];
  const armyFlipped = editorArmySide !== 'red';

  return `
    <div class="editor-bar">
      <section class="editor-panel editor-panel-armies">
        <details data-editor-armies${editorArmiesOpen ? ' open' : ''}>
          <summary>
            <h3>Armies</h3>
            <span class="lvl-meta">${escapeHtml(armyHint)} · onto ${armyOnto}${armyFlipped ? ' (flipped)' : ''}</span>
          </summary>
          <div class="editor-fold-body">
            <div class="editor-save editor-army-save">
              <input type="text" id="army-name" value="${escapeHtml(editorFormationName)}" placeholder="Army name" maxlength="48" />
              <button type="button" id="army-save" class="primary">${namedForm ? 'Save' : 'Save new'}</button>
              <button type="button" id="army-save-as" class="ghost">Save as new</button>
              <button type="button" id="army-save-default" class="${isDefaultForm ? 'active' : ''}">${isDefaultForm ? 'Default army' : 'Save as default'}</button>
              <button type="button" id="army-clear" class="ghost">Clear</button>
            </div>
            <div class="editor-library editor-army-library">
              <span class="editor-label">Load onto ${armyOnto}${armyFlipped ? ' (flipped)' : ''} · ${UNIT_CATEGORY_LABEL[era]}</span>
              ${formList}
            </div>
          </div>
        </details>
      </section>
      <section class="editor-panel editor-panel-level">
        <div class="editor-panel-head">
          <h3>Level <span id="editor-dirty" class="editor-unsaved"${editorDirty ? '' : ' hidden'}>unsaved</span></h3>
          <div class="editor-panel-head-actions">
            <button type="button" id="editor-save" class="primary">${editorLevelId ? 'Save' : 'Save new'}</button>
            <button type="button" id="editor-save-as" class="ghost">Save as new</button>
            <button type="button" id="editor-play">Play</button>
          </div>
        </div>
        <div class="level-settings">
          <input type="text" id="editor-name" value="${escapeHtml(editorName)}" placeholder="Level name" maxlength="48" />
          <div class="level-settings-row">
            <label class="editor-cat">Category
              <select id="editor-category">
                ${LEVEL_CATEGORIES.map(
                  (c) =>
                    `<option value="${c}"${editorCategory === c ? ' selected' : ''}>${LEVEL_CATEGORY_LABEL[c]}</option>`,
                ).join('')}
              </select>
            </label>
            <label class="editor-cat">Period
              <select id="editor-period" data-period="${editorPeriod}">
                ${PERIODS.map(
                  (p) =>
                    `<option value="${p}"${editorPeriod === p ? ' selected' : ''}>${periodOptionLabel(p)}</option>`,
                ).join('')}
              </select>
            </label>
          </div>
          <div class="level-settings-row">
            <label class="editor-cat level-settings-upt">Max units / turn
              <input type="number" id="editor-units-per-turn" min="${MIN_UNITS_PER_TURN}" max="${MAX_UNITS_PER_TURN}" value="${editorUnitsPerTurn}" />
            </label>
            <label class="editor-cat level-settings-upt">Max turns
              <input type="number" id="editor-max-turns" min="${MIN_MAX_TURNS}" max="${MAX_MAX_TURNS}" value="${editorMaxTurns}" title="0 = no limit" />
            </label>
          </div>
          <p class="muted star-turns-hint">Max turns 0 = no limit. Counted in full rounds, same clock as stars.</p>
          <label class="editor-cat level-copy-field">Teaser text
            <textarea id="editor-teaser-text" maxlength="${TEASER_TEXT_MAX}" rows="2" placeholder="Shown on map lists under the title">${escapeHtml(editorTeaserText)}</textarea>
          </label>
          <label class="editor-cat level-copy-field">Start text
            <textarea id="editor-start-text" maxlength="${LEVEL_TEXT_MAX}" rows="2" placeholder="Shown at the start of the level">${escapeHtml(editorStartText)}</textarea>
          </label>
          <label class="editor-cat level-copy-field">Winning text
            <textarea id="editor-win-text" maxlength="${LEVEL_TEXT_MAX}" rows="2" placeholder="Shown when you win">${escapeHtml(editorWinText)}</textarea>
          </label>
          <label class="editor-cat level-copy-field">Losing text
            <textarea id="editor-lose-text" maxlength="${LEVEL_TEXT_MAX}" rows="2" placeholder="Shown when you lose">${escapeHtml(editorLoseText)}</textarea>
          </label>
          <p class="muted star-turns-hint">[hoplite], [pikes], [energy], [hp], [arrow]… — name in brackets becomes that item's icon.</p>
          <div class="star-rules">
            <span class="editor-label">Stars</span>
            <p class="muted star-turns-hint">Turns = full rounds, counted when the starting player begins again (after everyone else has played).</p>
            <div class="star-rule-row locked">
              <span class="star-rule-mark">${starGlyphSvg('on', 15)}</span>
              <span class="star-rule-n">1</span>
              <span class="star-rule-fixed">Win</span>
            </div>
            ${starRuleEditorRow(2, editorStar2)}
            ${starRuleEditorRow(3, editorStar3)}
          </div>
          <div class="editor-grid">
            <label>W <input type="number" id="editor-cols" min="${MIN_COLS}" max="${MAX_COLS}" value="${grid.cols}" /></label>
            <label>H <input type="number" id="editor-rows" min="${MIN_ROWS}" max="${MAX_ROWS}" value="${grid.rows}" /></label>
            <button type="button" data-ori="pointy" class="${editorOrientation === 'pointy' ? 'active' : ''}">Point up</button>
            <button type="button" data-ori="flat" class="${editorOrientation === 'flat' ? 'active' : ''}">Flat up</button>
          </div>
        </div>
      </section>
      ${renderGlyphPanel()}
    </div>`;
}

function renderGlyphPanel(): string {
  const groups = copyGlyphGroups()
    .map((g) => {
      const chips = g.glyphs
        .map(
          (item) =>
            `<button type="button" class="glyph-chip" data-copy-tag="${escapeHtml(item.tag)}" title="Insert [${escapeHtml(item.tag)}]" aria-label="Insert [${escapeHtml(item.tag)}]">${item.icon}<span class="glyph-tag">[${escapeHtml(item.tag)}]</span></button>`,
        )
        .join('');
      return `<div class="glyph-group">
        <h4 class="glyph-group-label">${escapeHtml(g.label)}</h4>
        <div class="glyph-grid">${chips}</div>
      </div>`;
    })
    .join('');
  return `
    <section class="editor-panel editor-panel-glyphs">
      <details data-editor-glyphs${editorGlyphsOpen ? ' open' : ''}>
        <summary>
          <h3>Glyphs</h3>
          <span class="lvl-meta">[name] in texts — click to insert</span>
        </summary>
        <div class="editor-fold-body">
          ${groups}
        </div>
      </details>
    </section>`;
}

function gameOverClass(): string {
  if (!state.winner) return '';
  if (matchHasEnemies(state)) {
    return playerTeamWon(state) ? 'game-over won' : 'game-over lost';
  }
  return 'game-over won';
}

function unitNumField(
  type: UnitType,
  field: EditableStat,
  label: string,
): string {
  const spec = CLAMP[field as keyof typeof CLAMP];
  const min = spec?.min ?? 0;
  const max = spec?.max ?? 99;
  const val = UNIT_STATS[type][field] as number;
  const armorish = field === 'armor' || String(field).startsWith('armor');
  const damageish = String(field).startsWith('damage');
  const tint =
    armorish || damageish ? ` style="border-color:${armorColor(val)}"` : '';
  return `<label>${label} <input type="number" min="${min}" max="${max}" value="${val}" data-unit="${type}" data-field="${field}"${tint} /></label>`;
}

function abilityGlyph(id: AbilityId): string {
  if (id === 'general') {
    return `<svg class="ability-glyph" viewBox="-8 -8 16 16" width="16" height="16" aria-hidden="true"><path d="M0 -6.5 L1.5 -2 H6 L2.2 0.6 L3.6 5 L0 2.2 L-3.6 5 L-2.2 0.6 L-6 -2 H-1.5 Z" fill="currentColor"/></svg>`;
  }
  return '';
}

function abilityPanel(type: UnitType, abilities: AbilityId[]): string {
  const picks = ABILITY_IDS.map((id) => {
    const on = abilities.includes(id);
    return `<button type="button" class="ability-pick${on ? ' active' : ''}" data-unit="${type}" data-ability="${id}" aria-pressed="${on}">
      ${abilityGlyph(id)}
      ${ABILITY_LABEL[id]}
    </button>`;
  }).join('');
  const active = abilities[0];
  const blurb = active ? ABILITY_BLURB[active] : 'None. Toggle General to make this a command piece.';
  return `<div class="ability-panel">
    <span class="unit-group-label">Abilities</span>
    <div class="ability-picks">${picks}</div>
    <p class="ability-blurb">${blurb}</p>
  </div>`;
}

function hexFacePaint(field: string, n: number): { fill: string; stroke: string } {
  if (field.startsWith('damage') && n <= 0) {
    return { fill: 'none', stroke: '#8a9688' };
  }
  return { fill: armorColor(n), stroke: '#1a1f1c' };
}

function hexSidesEditor(type: UnitType, kind: 'armor' | 'damage'): string {
  const s = UNIT_STATS[type];
  // Flat-top hex, clockwise from east. Faces: N / NE / SE / S / SW / NW.
  const v = [
    [10, 0],
    [5, 8.66],
    [-5, 8.66],
    [-10, 0],
    [-5, -8.66],
    [5, -8.66],
  ] as const;
  const faces: { field: EditableStat; a: number; b: number }[] =
    kind === 'armor'
      ? [
          { field: 'armorFront', a: 4, b: 5 },
          { field: 'armorFrontRight', a: 5, b: 0 },
          { field: 'armorFlankRight', a: 0, b: 1 },
          { field: 'armorRear', a: 1, b: 2 },
          { field: 'armorFlankLeft', a: 2, b: 3 },
          { field: 'armorFrontLeft', a: 3, b: 4 },
        ]
      : [
          { field: 'damageFront', a: 4, b: 5 },
          { field: 'damageFrontRight', a: 5, b: 0 },
          { field: 'damageFlankRight', a: 0, b: 1 },
          { field: 'damageRear', a: 1, b: 2 },
          { field: 'damageFlankLeft', a: 2, b: 3 },
          { field: 'damageFrontLeft', a: 3, b: 4 },
        ];
  const cells =
    kind === 'armor'
      ? {
          fl: unitNumField(type, 'armorFrontLeft', 'Front left'),
          front: unitNumField(type, 'armorFront', 'Front'),
          fr: unitNumField(type, 'armorFrontRight', 'Front right'),
          left: unitNumField(type, 'armorFlankLeft', 'Flank left'),
          right: unitNumField(type, 'armorFlankRight', 'Flank right'),
          rear: unitNumField(type, 'armorRear', 'Rear'),
        }
      : {
          fl: unitNumField(type, 'damageFrontLeft', 'Front left'),
          front: unitNumField(type, 'damageFront', 'Front'),
          fr: unitNumField(type, 'damageFrontRight', 'Front right'),
          left: unitNumField(type, 'damageFlankLeft', 'Flank left'),
          right: unitNumField(type, 'damageFlankRight', 'Flank right'),
          rear: unitNumField(type, 'damageRear', 'Rear'),
        };
  const wedges = faces
    .map(({ field, a, b }) => {
      const paint = hexFacePaint(field, s[field] as number);
      return `<polygon data-unit="${type}" data-hex-face="${field}" points="0,0 ${v[a][0]},${v[a][1]} ${v[b][0]},${v[b][1]}" fill="${paint.fill}" stroke="${paint.stroke}" stroke-width="0.7"/>`;
    })
    .join('');
  return `<div class="hex-armor">
    <span class="unit-group-label">${kind === 'armor' ? 'Hex armor' : 'Hex damage'}</span>
    <div class="hex-armor-grid">
      <div class="hex-armor-cell fl">${cells.fl}</div>
      <div class="hex-armor-cell front">${cells.front}</div>
      <div class="hex-armor-cell fr">${cells.fr}</div>
      <div class="hex-armor-cell left">${cells.left}</div>
      <svg class="hex-armor-glyph" viewBox="-12 -12 24 24" aria-hidden="true">
        ${wedges}
        <polygon points="0,-9.4 2.1,-5.2 -2.1,-5.2" fill="#efe4d0"/>
      </svg>
      <div class="hex-armor-cell right">${cells.right}</div>
      <div class="hex-armor-cell rear">${cells.rear}</div>
    </div>
  </div>`;
}

function renderUnitEditor(): string {
  const shown = UNIT_TYPES.filter(
    (type) => UNIT_STATS[type].category === unitEditorCategory,
  );
  const cards = shown
    .map((type) => {
      const s = UNIT_STATS[type];
      const catOpts = UNIT_CATEGORIES.map(
        (c) =>
          `<option value="${c}"${s.category === c ? ' selected' : ''}>${eraIsWip(c) ? `${UNIT_CATEGORY_LABEL[c]} (under construction)` : UNIT_CATEGORY_LABEL[c]}</option>`,
      ).join('');
      const kitOpts = STOCK_UNIT_TYPES.map(
        (r) =>
          `<option value="${r}"${s.role === r ? ' selected' : ''}>${UNIT_ROLE_LABEL[r]}</option>`,
      ).join('');
      const copied = isCustomUnitId(type);
      const open = unitEditorOpen.has(type);
      const shootExtras =
        s.shoot > 0
          ? `${unitNumField(type, 'shootDamage', 'DMG')}
          ${unitNumField(type, 'shootCooldown', 'Reload time')}
          ${unitNumField(type, 'ammo', 'Ammo limit')}
          <label class="unit-cat">Arc
            <select data-unit-arc="${type}">
              ${SHOOT_ARCS.map(
                (a) =>
                  `<option value="${a}"${s.shootArc === a ? ' selected' : ''}>${SHOOT_ARC_LABEL[a]}</option>`,
              ).join('')}
            </select>
          </label>
          ${unitNumField(type, 'shootMin', 'Min range')}
          ${unitNumField(type, 'splashDamage', 'Splash DMG')}`
          : '';
      return `<article class="unit-card">
      <details data-unit-fold="${type}"${open ? ' open' : ''}>
      <summary>
        <svg class="side-icon" viewBox="-10 -10 20 20" width="32" height="32" aria-hidden="true">
          <circle cx="0" cy="0" r="9.5" fill="#3d4a3a" stroke="${armorColor(ringArmor(type))}" stroke-width="2" data-armor-ring="${type}" />
          <g fill="#e8ebe6" color="#e8ebe6">${pieceIconSvg(type, 16)}</g>
        </svg>
        <span class="unit-card-title">${escapeHtml(s.name)}</span>
        <span class="lvl-meta unit-card-meta">${hpPipsHtml(s.hp, s.hp, 'catalog')} · ${s.value}</span>
      </summary>
      <div class="unit-card-body">
      <header>
        <div class="unit-card-id">
          <input type="text" class="unit-name" maxlength="32" value="${escapeHtml(s.name)}" data-unit-name="${type}" />
          <span class="lvl-meta">${escapeHtml(s.chess)}${copied ? ' · copy' : ''}</span>
        </div>
        <div class="unit-card-selects">
          <label class="unit-cat">Kit
            <select data-unit-kit="${type}">${kitOpts}</select>
          </label>
          <label class="unit-cat">Category
            <select data-unit-cat="${type}">${catOpts}</select>
          </label>
        </div>
      </header>
      <div class="unit-fields">
        <div class="unit-group">
          <span class="unit-group-label">Piece</span>
          ${unitNumField(type, 'hp', 'HP')}
          ${s.hexArmor ? '' : unitNumField(type, 'armor', 'Armor')}
          ${unitNumField(type, 'value', 'Value/weight')}
          ${unitNumField(type, 'actions', 'Actions')}
        </div>
        <div class="unit-group">
          <span class="unit-group-label">Move</span>
          ${unitNumField(type, 'move', 'Range')}
          ${unitNumField(type, 'moveBudget', 'Move cap')}
          ${unitNumField(type, 'stamina', 'Stamina')}
          ${unitNumField(type, 'staminaRegen', 'Stam regen')}
          ${unitNumField(type, 'meleeDamage', 'Melee dmg')}
          ${unitNumField(type, 'charge', 'Charge')}
          <label class="chk">
            <input type="checkbox" data-unit="${type}" data-field="passWater"${s.passWater ? ' checked' : ''} />
            Move to water
          </label>
          <label class="unit-cat climb-level">Climb level
            <select data-unit-climb="${type}">
              ${CLIMB_LEVELS.map(
                (lv) =>
                  `<option value="${lv}"${s.climbLevel === lv ? ' selected' : ''}>${CLIMB_LEVEL_LABEL[lv]}</option>`,
              ).join('')}
            </select>
          </label>
        </div>
        <div class="unit-group">
          <span class="unit-group-label">Shoot</span>
          ${unitNumField(type, 'shoot', 'Range')}
          ${shootExtras}
        </div>
        <div class="hex-toggles">
          <label class="chk hex-armor-toggle">
            <input type="checkbox" data-unit="${type}" data-field="hexArmor"${s.hexArmor ? ' checked' : ''} />
            Hex armor
          </label>
          <label class="chk hex-armor-toggle">
            <input type="checkbox" data-unit="${type}" data-field="hexDamage"${s.hexDamage ? ' checked' : ''} />
            Hex damage
          </label>
        </div>
        ${
          s.hexArmor || s.hexDamage
            ? `<div class="hex-sides-cols">
          ${s.hexArmor ? hexSidesEditor(type, 'armor') : ''}
          ${s.hexDamage ? hexSidesEditor(type, 'damage') : ''}
        </div>`
            : ''
        }
        ${abilityPanel(type, s.abilities)}
      </div>
      <div class="unit-card-actions">
        <button type="button" data-copy-unit="${type}">Copy</button>
        ${copied ? `<button type="button" class="ghost danger" data-del-unit="${type}">Delete</button>` : ''}
      </div>
      </div>
      </details>
    </article>`;
    })
    .join('');

  const empty = shown.length
    ? ''
    : `<p class="editor-empty">No ${UNIT_CATEGORY_LABEL[unitEditorCategory]} units. Copy one from another era and set its category.</p>`;

  const filters = UNIT_CATEGORIES.map(
    (c) =>
      `<button type="button" data-unit-filter="${c}" class="${unitEditorCategory === c ? 'active' : ''}">${UNIT_CATEGORY_LABEL[c]}${eraIsWip(c) ? '<span class="era-wip">under construction</span>' : ''}</button>`,
  ).join('');

  return `
    <div class="unit-editor">
      <div class="unit-editor-head">
        <div class="unit-filter">${filters}</div>
        <p class="editor-label" id="units-status">${
          unitStatsAreStock()
            ? 'Stock stats'
            : 'Custom stats · saved in this browser'
        }</p>
      </div>
      <div class="unit-cards">${cards}</div>
      ${empty}
      <div class="editor-save">
        <button type="button" id="units-reset" class="ghost">Reset to stock</button>
      </div>
      <details class="units-help">
        <summary>Help</summary>
        <p class="muted">Live immediately. New match to respawn ammo and HP.</p>
        <dl class="help-list">
          <dt>Piece</dt>
          <dd><strong>HP</strong> default 1</dd>
          <dd><strong>Armor</strong> −2..+2, subtracted from incoming dmg (shots ignore negatives). Ring / hex: −2 red, −1 orange, 0 green, +1 blue, +2 purple. Stock: tank +2, general +1. Hex armor: a −2 face cannot be walked or shot (those hexes are not legal move dests or fire targets). Rout: hit on a red face with the opposite hex pinned (enemy / wall / high), or hit from the front with an enemy on a red/back hex. Friends never pin. Generals immune</dd>
          <dd><strong>Hex damage</strong> check to enable. Per-face 0–2. Each live face is facing pikes on the adjacent hex only: enemies take that damage when they enter. Standing there does not pulse again. 0 is outline only</dd>
          <dd><strong>Value/weight</strong> scoring / AI. General token +1</dd>
          <dd><strong>Actions</strong> activations per turn</dd>
          <dd><strong>Category</strong> Modern / Ancient / Futuristic — filter above. Stock Ancient: Archer, Javelin, Horse archer, Chariot archer, Cohort, Hoplite, Elephant, Barbarian, Peasant, Catapult. Stock Modern: Soldier, Scout, Bazooka, Sniper, Tank, General, Tower, Dummy. Stock Futuristic: Fighter, Gunship, Bomber, Frigate, Cruiser, Dreadnought</dd>
          <dd><strong>Kit</strong> icon + pathing through pieces / infantry. Does not reset numbers. Water and climb are per-unit, not kit. Tower, Javelin, Horse archer and the spaceship kits are glyph only</dd>
          <dd><strong>Abilities</strong> granted independently of kit. General (star): all generals on a side must fall to lose by command — one of several is not enough. Pieces can also gain/lose abilities in play</dd>
          <dd><strong>Copy</strong> duplicates a unit (same kit / icon / rules). Rename, recategorize, or switch kit. Delete only copies.</dd>
          <dt>Move</dt>
          <dd><strong>Range</strong> hexes in a straight line per action. Hill +1, plateau +2, mountain +3 while standing there</dd>
          <dd><strong>Move cap</strong> total steps this activation (0 = none; scout stock 3)</dd>
          <dd><strong>Stamina</strong> pool. Spend 1 to climb, to stay in water at the start of your turn, or after a normal move or turn take a second straight-line action of the same range (new direction OK). Unused steps of an action are lost</dd>
          <dd><strong>Move to water</strong> stop on water hexes (no stamina to enter; that move ends momentum). From water: 1 hex per action, cannot shoot. Start of turn in water: 1 stamina penalty (not an action), or 2 HP if you can't pay — leftover stamina can still buy an extra 1-hex. No regen in water, even idle</dd>
          <dd><strong>Climb level</strong> max height: 0 land, Hill lvl.1, Plateau lvl.2, Mountain lvl.3. Step ±1 only</dd>
          <dd><strong>Stam regen</strong> own turns to recover 1. Any action (move, shoot, climb) resets (that End still counts). Point lands only if the unit did nothing that turn (Rest counts as idle), on land — never in water. 0 = never</dd>
          <dd><strong>Melee dmg</strong> bump an occupied hex; a kill takes the spot, else stop on the hex before. 0 = cannot melee</dd>
          <dd><strong>Charge</strong> 0 = no charge through. 1+ = damage on every unit you walk through (armor applies, including negative). Same as palisade: a living blocker stops you — click the 2nd unit and the 1st still takes the hit; you only continue if that charge would kill them (like a palisade on its last hit). Empty dest beyond: pass through the line and damage them even if they survive. Palisades: you do not pass unless that melee hit breaks them</dd>
          <dt>Shoot</dt>
          <dd><strong>Range</strong> fire distance. 0 = cannot shoot (hides the rest). Shooter on hill +1, plateau +2, mountain +3. A high target costs that much extra range</dd>
          <dd><strong>DMG</strong> bullets</dd>
          <dd><strong>Reload time</strong> own turns you can't shoot after firing</dd>
          <dd><strong>Ammo limit</strong> shots this match (0 = unlimited)</dd>
          <dd><strong>Arc</strong> Straight: units and palisades block from low. Arch: fire over units and palisades. Walls / higher ground still block</dd>
          <dd><strong>Min range</strong> closest hex you can fire</dd>
          <dd><strong>Splash DMG</strong> 0 = bullets; &gt;0 = rocket blast (bazooka/tank stock 1)</dd>
        </dl>
      </details>
    </div>`;
}

function aiCheckCell(style: AiStyle, id: string, on: boolean): string {
  return `<td class="ai-check-cell ${style}">
    <label class="ai-check-box">
      <input type="checkbox" data-ai-rule="${id}" data-ai-style="${style}"${on ? ' checked' : ''} />
      <span class="sr-only">${AI_STYLE_LABEL[style]}</span>
    </label>
  </td>`;
}

function renderAiChecklist(): string {
  const head = AI_STYLES.map(
    (st) =>
      `<th class="ai-check-col ${st}" scope="col">
        <span class="ai-check-col-name">${AI_STYLE_LABEL[st]}${st === 'aggressive' ? '<span class="ai-check-default">default</span>' : ''}</span>
      </th>`,
  ).join('');
  const groups = AI_RULE_CATEGORIES.map((cat) => {
    const rules = categoryRules(cat)
      .map(
        (rule) => `<tr>
          <th scope="row">
            <span class="ai-rule-name">${escapeHtml(rule.label)}</span>
            <span class="ai-rule-blurb">${escapeHtml(rule.blurb)}</span>
          </th>
          ${AI_STYLES.map((st) => aiCheckCell(st, rule.id, isAiRuleOn(st, rule.id))).join('')}
        </tr>`,
      )
      .join('');
    return `<tbody>
      <tr class="ai-check-group">
        <th scope="colgroup">${AI_RULE_CATEGORY_LABEL[cat]}</th>
        ${AI_STYLES.map((st) => `<td class="ai-check-cell ${st}"></td>`).join('')}
      </tr>
      ${rules}
    </tbody>`;
  }).join('');

  return `
    <div class="ai-editor">
      <div class="ai-editor-head">
        <h2>AI checklist</h2>
        <p class="editor-label" id="ai-status">${
          aiChecklistAreStock() ? 'Stock rules' : 'Custom rules · saved in this browser'
        }</p>
      </div>
      <p class="muted ai-editor-lead">Three personalities. Check a box to run that rule when the army’s AI is set to that style (level editor, next to player / AI). Default is <strong>aggressive</strong>. <strong>Advance</strong> walks the army toward the far edge together — rear first, nobody left behind. Stock = the defaults below.</p>
      <div class="ai-check-wrap">
        <table class="ai-check">
          <thead>
            <tr>
              <th scope="col">Rule</th>
              ${head}
            </tr>
          </thead>
          ${groups}
        </table>
      </div>
      <div class="editor-save">
        <button type="button" id="ai-reset" class="ghost">Reset to stock</button>
      </div>
      <details class="units-help">
        <summary>Help</summary>
        <p class="muted">Unchecked rules are skipped — the AI falls through to whatever is still on. Per-army style is stored on the level.</p>
      </details>
    </div>`;
}

function syncAiStatus() {
  const status = app.querySelector('#ai-status');
  if (status) {
    status.textContent = aiChecklistAreStock()
      ? 'Stock rules'
      : 'Custom rules · saved in this browser';
  }
}

function bindAiChecklistEvents() {
  app.querySelectorAll<HTMLInputElement>('input[data-ai-rule]').forEach((el) => {
    el.addEventListener('change', () => {
      const st = el.dataset.aiStyle;
      const id = el.dataset.aiRule;
      if (!isAiStyle(st) || !isAiRuleId(id)) return;
      setAiRule(st, id, el.checked);
      syncAiStatus();
    });
  });
  app.querySelector('#ai-reset')?.addEventListener('click', () => {
    if (!aiChecklistAreStock() && !confirm('Reset all AI personalities to stock?')) {
      return;
    }
    resetAiChecklist();
    render();
  });
  syncAiStatus();
}

function bindUnitEditorEvents() {
  const onField = (el: HTMLInputElement) => {
    const type = el.dataset.unit as UnitType | undefined;
    const field = el.dataset.field as EditableStat | undefined;
    if (!type || !field) return;
    const before = UNIT_STATS[type][field];
    if (el.type === 'checkbox') patchUnitStat(type, field, el.checked);
    else patchUnitStat(type, field, Number(el.value));
    if (
      field === 'hexArmor' ||
      field === 'hexDamage' ||
      (field === 'shoot' && Boolean(before) !== Boolean(UNIT_STATS[type].shoot))
    ) {
      render();
      return;
    }
    // Sanitize may clamp min>max; sync the live input values for this unit
    app.querySelectorAll<HTMLInputElement>(`input[data-unit="${type}"]`).forEach((inp) => {
      const f = inp.dataset.field as EditableStat;
      const v = UNIT_STATS[type][f];
      if (inp.type === 'checkbox') inp.checked = Boolean(v);
      else {
        if (Number(inp.value) !== v) inp.value = String(v);
        if (f === 'armor' || String(f).startsWith('armor') || String(f).startsWith('damage')) {
          inp.style.borderColor = armorColor(Number(v));
        }
      }
    });
    app.querySelectorAll<SVGPolygonElement>(`polygon[data-hex-face][data-unit="${type}"]`).forEach((poly) => {
      const f = poly.dataset.hexFace as EditableStat;
      const paint = hexFacePaint(f, Number(UNIT_STATS[type][f]));
      poly.setAttribute('fill', paint.fill);
      poly.setAttribute('stroke', paint.stroke);
    });
    app.querySelector(`circle[data-armor-ring="${type}"]`)?.setAttribute(
      'stroke',
      armorColor(ringArmor(type)),
    );
    const status = app.querySelector('#units-status');
    if (status) {
      status.textContent = unitStatsAreStock()
        ? 'Stock stats'
        : 'Custom stats · saved in this browser';
    }
  };
  app.querySelectorAll<HTMLInputElement>('input[data-unit]').forEach((el) => {
    el.addEventListener('change', () => onField(el));
  });
  app.querySelectorAll<HTMLDetailsElement>('[data-unit-fold]').forEach((el) => {
    el.addEventListener('toggle', () => {
      const type = el.dataset.unitFold as UnitType | undefined;
      if (!type) return;
      if (el.open) unitEditorOpen.add(type);
      else unitEditorOpen.delete(type);
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-unit-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      unitEditorCategory = sanitizeUnitCategory(btn.dataset.unitFilter);
      render();
    });
  });
  app.querySelectorAll<HTMLSelectElement>('[data-unit-cat]').forEach((el) => {
    el.addEventListener('change', () => {
      const type = el.dataset.unitCat as UnitType | undefined;
      if (!type) return;
      patchUnitCategory(type, sanitizeUnitCategory(el.value));
      render();
    });
  });
  app.querySelectorAll<HTMLSelectElement>('[data-unit-kit]').forEach((el) => {
    el.addEventListener('change', () => {
      const type = el.dataset.unitKit as UnitType | undefined;
      if (!type || !isUnitRole(el.value)) return;
      patchUnitKit(type, el.value);
      render();
    });
  });
  app.querySelectorAll<HTMLButtonElement>('.ability-pick').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.unit as UnitType | undefined;
      const id = btn.dataset.ability;
      if (!type || !isAbilityId(id)) return;
      const on = !UNIT_STATS[type].abilities.includes(id);
      patchUnitAbility(type, id, on);
      render();
    });
  });
  app.querySelectorAll<HTMLSelectElement>('[data-unit-climb]').forEach((el) => {
    el.addEventListener('change', () => {
      const type = el.dataset.unitClimb as UnitType | undefined;
      if (!type) return;
      patchUnitStat(type, 'climbLevel', sanitizeClimbLevel(el.value));
      const status = app.querySelector('#units-status');
      if (status) {
        status.textContent = unitStatsAreStock()
          ? 'Stock stats'
          : 'Custom stats · saved in this browser';
      }
    });
  });
  app.querySelectorAll<HTMLSelectElement>('[data-unit-arc]').forEach((el) => {
    el.addEventListener('change', () => {
      const type = el.dataset.unitArc as UnitType | undefined;
      if (!type) return;
      patchUnitShootArc(type, sanitizeShootArc(el.value));
      render();
    });
  });
  app.querySelectorAll<HTMLInputElement>('[data-unit-name]').forEach((el) => {
    el.addEventListener('change', () => {
      const type = el.dataset.unitName as UnitType | undefined;
      if (!type) return;
      patchUnitName(type, el.value);
      render();
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-copy-unit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.copyUnit as UnitType | undefined;
      if (!type) return;
      const id = copyUnit(type);
      if (!id) return;
      unitEditorOpen.add(id);
      unitEditorCategory = UNIT_STATS[id]?.category ?? unitEditorCategory;
      render();
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-del-unit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.delUnit as UnitType | undefined;
      if (!type) return;
      if (!confirm(`Delete ${UNIT_STATS[type]?.name ?? 'this unit'}?`)) return;
      unitEditorOpen.delete(type);
      deleteCopiedUnit(type);
      render();
    });
  });
  app.querySelector('#units-reset')?.addEventListener('click', () => {
    if (!unitStatsAreStock() && !confirm('Reset all units to stock stats?')) return;
    resetUnitStats();
    render();
  });
}

function insertCopyTag(tag: string, setters: Record<string, (v: string) => void>) {
  const token = `[${tag}]`;
  const id = editorCopyFieldId;
  const el = id ? app.querySelector<HTMLTextAreaElement>(`#${CSS.escape(id)}`) : null;
  if (!id || !el) {
    void navigator.clipboard?.writeText(token);
    return;
  }
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const next = el.value.slice(0, start) + token + el.value.slice(end);
  el.value = next;
  const caret = start + token.length;
  el.setSelectionRange(caret, caret);
  el.focus();
  setters[id]?.(next);
  if (id !== 'board-text') markEditorDirty();
}

function bindEditorEvents() {
  bindEditorBoardPopup();
  app.querySelectorAll<HTMLButtonElement>('[data-brush]').forEach((btn) => {
    btn.addEventListener('click', () => {
      editorBrush = btn.dataset.brush as EditorBrush;
      render();
    });
  });
  app.querySelector('#editor-unit-cat')?.addEventListener('change', (e) => {
    editorUnitCategory = sanitizeUnitCategory((e.target as HTMLSelectElement).value);
    if (isUnitBrush(editorBrush) && UNIT_STATS[editorBrush]?.category !== editorUnitCategory) {
      const first = UNIT_TYPES.find((t) => UNIT_STATS[t].category === editorUnitCategory);
      editorBrush = first ?? 'erase';
    }
    render();
  });
  app.querySelector('#editor-play')?.addEventListener('click', () =>
    void doSaveLevel(false, false, true),
  );
  app.querySelector('#editor-save')?.addEventListener('click', () => void doSaveLevel(false));
  app.querySelector('#editor-save-as')?.addEventListener('click', () => void doSaveLevel(true));
  app.querySelector('#editor-clear')?.addEventListener('click', () => {
    const { cols, rows } = currentGrid();
    editorTerrain = emptyTerrain(cols, rows);
    editorTokens = [];
    editorDirty = true;
    render();
  });
  const commitGridSize = () => {
    const colsEl = app.querySelector<HTMLInputElement>('#editor-cols');
    const rowsEl = app.querySelector<HTMLInputElement>('#editor-rows');
    applyEditorGrid(
      colsEl ? Number(colsEl.value) : currentGrid().cols,
      rowsEl ? Number(rowsEl.value) : currentGrid().rows,
    );
  };
  app.querySelector('#editor-cols')?.addEventListener('change', commitGridSize);
  app.querySelector('#editor-rows')?.addEventListener('change', commitGridSize);
  app.querySelectorAll<HTMLButtonElement>('[data-ori]').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyEditorOrientation(btn.dataset.ori as HexOrientation);
    });
  });
  app.querySelector('#editor-name')?.addEventListener('change', (e) => {
    editorName = (e.target as HTMLInputElement).value;
    const heading = app.querySelector('.sidebar h2');
    if (heading) heading.textContent = editorName.trim() || 'New level';
  });
  app.querySelector('#editor-category')?.addEventListener('change', (e) => {
    editorCategory = sanitizeCategory((e.target as HTMLSelectElement).value);
    editorDirty = true;
  });
  app.querySelector('#editor-period')?.addEventListener('change', (e) => {
    editorPeriod = sanitizePeriod((e.target as HTMLSelectElement).value);
    selectedPeriod = setSelectedPeriod(editorPeriod);
    editorUnitCategory = unitCategoryForPeriod(editorPeriod);
    if (isUnitBrush(editorBrush) && UNIT_STATS[editorBrush]?.category !== editorUnitCategory) {
      const first = UNIT_TYPES.find((t) => UNIT_STATS[t].category === editorUnitCategory);
      editorBrush = (first ?? 'land') as EditorBrush;
    }
    editorDirty = true;
    render();
  });
  app.querySelector('#editor-units-per-turn')?.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    editorUnitsPerTurn = clampUnitsPerTurn(el.value);
    el.value = String(editorUnitsPerTurn);
    editorDirty = true;
  });
  app.querySelector('#editor-max-turns')?.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    editorMaxTurns = clampMaxTurns(el.value);
    el.value = String(editorMaxTurns);
    editorDirty = true;
  });
  const bindLevelText = (sel: string, set: (v: string) => void) => {
    app.querySelector<HTMLTextAreaElement>(sel)?.addEventListener('change', (e) => {
      set((e.target as HTMLTextAreaElement).value);
      markEditorDirty();
    });
  };
  bindLevelText('#editor-teaser-text', (v) => {
    editorTeaserText = v;
  });
  bindLevelText('#editor-start-text', (v) => {
    editorStartText = v;
  });
  bindLevelText('#editor-win-text', (v) => {
    editorWinText = v;
  });
  bindLevelText('#editor-lose-text', (v) => {
    editorLoseText = v;
  });
  app.querySelectorAll<HTMLElement>('[data-star][data-star-field]').forEach((el) => {
    el.addEventListener('change', () => {
      editorStar2 = readEditorStar(2);
      editorStar3 = readEditorStar(3);
      const valEl = el instanceof HTMLInputElement && el.dataset.starField === 'value' ? el : null;
      if (valEl) valEl.value = String((el.dataset.star === '3' ? editorStar3 : editorStar2).value);
      markEditorDirty();
    });
  });
  app.querySelector<HTMLDetailsElement>('[data-editor-armies]')?.addEventListener('toggle', (e) => {
    editorArmiesOpen = (e.currentTarget as HTMLDetailsElement).open;
  });
  app.querySelector<HTMLDetailsElement>('[data-editor-glyphs]')?.addEventListener('toggle', (e) => {
    editorGlyphsOpen = (e.currentTarget as HTMLDetailsElement).open;
  });
  const COPY_FIELDS: Record<string, (v: string) => void> = {
    'editor-teaser-text': (v) => {
      editorTeaserText = v;
    },
    'editor-start-text': (v) => {
      editorStartText = v;
    },
    'editor-win-text': (v) => {
      editorWinText = v;
    },
    'editor-lose-text': (v) => {
      editorLoseText = v;
    },
    'board-text': () => {},
  };
  for (const id of Object.keys(COPY_FIELDS)) {
    app.querySelector<HTMLTextAreaElement>(`#${id}`)?.addEventListener('focus', () => {
      editorCopyFieldId = id;
    });
  }
  app.querySelectorAll<HTMLButtonElement>('[data-copy-tag]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.copyTag;
      if (!tag) return;
      insertCopyTag(tag, COPY_FIELDS);
      btn.classList.add('copied');
      window.setTimeout(() => btn.classList.remove('copied'), 700);
    });
  });
  app.querySelector('#army-name')?.addEventListener('change', (e) => {
    editorFormationName = (e.target as HTMLInputElement).value;
  });
  app.querySelectorAll<HTMLButtonElement>('[data-army-side]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const side = btn.dataset.armySide;
      if (!isSide(side)) return;
      editorArmySide = side;
      render();
    });
  });
  app.querySelectorAll<HTMLSelectElement>('[data-army-control]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const side = sel.dataset.armyControl;
      if (!isSide(side)) return;
      const v = sel.value;
      const next = ARMY_CONTROLS.includes(v as ArmyControl)
        ? (v as ArmyControl)
        : editorControls[side];
      const wasAi = editorControls[side] !== 'player';
      editorControls = { ...editorControls, [side]: next };
      markEditorDirty();
      if (wasAi !== (next !== 'player')) render();
    });
  });
  app.querySelectorAll<HTMLSelectElement>('[data-army-style]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const side = sel.dataset.armyStyle;
      if (!isSide(side) || !isAiStyle(sel.value)) return;
      editorAiStyles = { ...editorAiStyles, [side]: sel.value };
      markEditorDirty();
    });
  });
  const doSaveFormation = async (asNew: boolean, asDefault = false) => {
    const nameEl = app.querySelector<HTMLInputElement>('#army-name');
    if (nameEl) editorFormationName = nameEl.value;
    const { cols, rows } = currentGrid();
    const { slots } = captureFormation(editorPieces, editorArmySide, cols, rows);
    if (asDefault && slotsEqual(slots, stockFormation(cols, rows).slots)) {
      defaultFormationId = null;
      setDefaultFormationId(null);
      editorFormationId = STOCK_FORMATION_ID;
      await flushStore();
      render();
      return;
    }
    const existing =
      asNew || !editorFormationId || editorFormationId === STOCK_FORMATION_ID
        ? null
        : editorFormationId;
    const saved = saveFormation(
      editorFormationName,
      slots,
      cols,
      existing,
      editorUnitCategory,
    );
    editorFormationId = saved.id;
    editorFormationName = saved.name;
    if (asDefault) {
      defaultFormationId = saved.id;
      setDefaultFormationId(saved.id);
    }
    await flushStore();
    render();
  };
  app.querySelector('#army-save')?.addEventListener('click', () => void doSaveFormation(false));
  app.querySelector('#army-save-as')?.addEventListener('click', () => void doSaveFormation(true));
  app.querySelector('#army-save-default')?.addEventListener('click', () =>
    void doSaveFormation(false, true),
  );
  app.querySelector('#army-clear')?.addEventListener('click', () => {
    editorPieces = editorPieces.filter((p) => p.side !== editorArmySide);
    markEditorDirty();
    render();
  });
  const applyFormation = (id: string) => {
    const { cols, rows } = currentGrid();
    const form =
      id === STOCK_FORMATION_ID ? stockFormation(cols, rows) : getFormation(id);
    if (!form) return;
    const added = stampFormation(form, editorArmySide, cols, rows);
    const taken = new Set(added.map((p) => `${p.col},${p.row}`));
    editorPieces = [
      ...editorPieces.filter(
        (p) => p.side !== editorArmySide && !taken.has(`${p.col},${p.row}`),
      ),
      ...added,
    ];
    editorFormationId = form.id;
    editorFormationName =
      form.id === STOCK_FORMATION_ID ? 'New army' : form.name;
    markEditorDirty();
    render();
  };
  app.querySelectorAll<HTMLButtonElement>('[data-load-form]').forEach((btn) => {
    btn.addEventListener('click', () => applyFormation(btn.dataset.loadForm!));
  });
  app.querySelectorAll<HTMLButtonElement>('[data-del-form]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.delForm!;
      if (!confirm('Delete this army?')) return;
      deleteFormation(id);
      if (editorFormationId === id) {
        editorFormationId = STOCK_FORMATION_ID;
        editorFormationName = 'New army';
      }
      if (defaultFormationId === id) defaultFormationId = null;
      void flushStore().then(() => render());
    });
  });
  bindEditorBoard();
}

function bindLevelsEvents() {
  app.querySelector('#level-new')?.addEventListener('click', () => newEditorLevel());
  app.querySelectorAll<HTMLButtonElement>('[data-levels-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.levelsFilter;
      if (isLevelCategory(v)) {
        levelsFilter = v;
        setLevelsOverviewFilter(levelsFilter, levelsPeriodFilter);
        render();
      }
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-levels-period]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.levelsPeriod;
      if (v === 'ancient' || v === 'modern' || v === 'futuristic') {
        levelsPeriodFilter = v;
        selectedPeriod = setSelectedPeriod(v);
        setLevelsOverviewFilter(levelsFilter, levelsPeriodFilter);
        render();
      }
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-edit-level]').forEach((btn) => {
    btn.addEventListener('click', () => enterEditor(btn.dataset.editLevel));
  });
  app.querySelectorAll<HTMLButtonElement>('[data-play-level]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      playSavedLevel(btn.dataset.playLevel!);
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-del-level]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.delLevel!;
      if (!confirm('Delete this level?')) return;
      deleteLevel(id);
      if (editorLevelId === id) {
        editorLevelId = null;
        editorName = 'New level';
        editorCategory = 'skirmish';
        editorPeriod = selectedPeriod;
        editorTeaserText = '';
        editorStartText = '';
        editorWinText = '';
        editorLoseText = '';
        editorStar2 = { ...DEFAULT_STAR_2 };
        editorStar3 = { ...DEFAULT_STAR_3 };
      }
      if (defaultLevelId === id) defaultLevelId = null;
      if (activeLevelId === id) activeLevelId = getActiveLevelId();
      void flushStore().then(() => render());
    });
  });
  bindLevelReorder();
}

function bindLevelReorder() {
  const catalog = app.querySelector<HTMLUListElement>('.level-catalog');
  if (!catalog) return;
  const cat = levelsFilter;
  const period = levelsPeriodFilter;
  catalog.querySelectorAll<HTMLLIElement>('.level-row').forEach((row) => {
    row.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('.level-play, .danger, [data-play-level], [data-del-level]')) return;
      const fromHandle = !!t?.closest('.level-drag');
      if (fromHandle) {
        e.preventDefault();
        e.stopPropagation();
      }
      const startY = e.clientY;
      let active = fromHandle;
      if (active) {
        row.classList.add('dragging');
        catalog.classList.add('reordering');
      }

      const place = (clientY: number) => {
        const others = [...catalog.querySelectorAll<HTMLLIElement>('.level-row')].filter(
          (n) => n !== row,
        );
        let placed = false;
        for (const over of others) {
          const box = over.getBoundingClientRect();
          if (clientY < box.top + box.height / 2) {
            catalog.insertBefore(row, over);
            placed = true;
            break;
          }
        }
        if (!placed) catalog.appendChild(row);
      };

      const onMove = (ev: PointerEvent) => {
        if (!active) {
          if (Math.abs(ev.clientY - startY) < 8) return;
          active = true;
          row.classList.add('dragging');
          catalog.classList.add('reordering');
        }
        ev.preventDefault();
        place(ev.clientY);
      };

      const finish = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
        const wasActive = active;
        row.classList.remove('dragging');
        catalog.classList.remove('reordering');
        if (!wasActive) return;
        if (!fromHandle) {
          row.addEventListener(
            'click',
            (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
            },
            { capture: true, once: true },
          );
        }
        const ids = [...catalog.querySelectorAll<HTMLElement>('.level-row')]
          .map((li) => li.dataset.levelId)
          .filter((id): id is string => !!id);
        if (reorderLevels(cat, period, ids)) void flushStore();
      };

      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
    });
  });
}

function bindEvents() {
  bindToolbarEvents();
  if (screen === 'start') return;
  if (screen === 'levels') {
    bindLevelsEvents();
    return;
  }
  if (screen === 'editor') {
    bindEditorEvents();
    return;
  }
  if (screen === 'units') {
    bindUnitEditorEvents();
    return;
  }
  if (screen === 'ai') {
    bindAiChecklistEvents();
    return;
  }

  app.querySelector('#new-map')?.addEventListener('click', () => {
    if (activeLevelId) startMatch(false);
    else reset(true);
  });
  app.querySelector('#start-hotseat')?.addEventListener('click', () => {
    mode = 'hotseat';
    playlist = null;
    startMatch(false);
  });
  app.querySelector('#end-rematch')?.addEventListener('click', () => reset(false));
  app.querySelector('#end-next')?.addEventListener('click', () => skipBriefing());
  app.querySelector('#end-start')?.addEventListener('click', () => showStart());
  bindBoardPopup();
  app.querySelector('#briefing-go')?.addEventListener('click', () => {
    briefingOpen = false;
    render();
    void maybeAi();
  });
  app.querySelector('#briefing-skip')?.addEventListener('click', () => skipBriefing());
  app.querySelector('#level-select')?.addEventListener('change', (e) => {
    const v = (e.target as HTMLSelectElement).value;
    if (v === 'random') {
      activeLevelId = null;
      setActiveLevelId(null);
      startMatch(true);
    } else {
      activeLevelId = v;
      setActiveLevelId(v);
      startMatch(false);
    }
  });
  app.querySelector('#skip-scout')?.addEventListener('click', () => {
    void skipScout();
  });
  app.querySelector('#rest-unit')?.addEventListener('click', () => {
    void restSelected();
  });
  app.querySelector('#end-turn')?.addEventListener('click', () => {
    void (async () => {
      if (!canControl() || animating) return;
      animating = true;
      const actingId = selectedId;
      state = passTurn(state);
      applyHotseatTint();
      updateChrome();
      await playPendingFx();
      animating = false;
      if (actingId) retainSelection(actingId);
      else clearSelection();
      ensureSoloTurnSelection();
      render();
      void maybeAi();
    })();
  });
  bindHexChoice();
  app.querySelector<HTMLDetailsElement>('[data-sidebar-more]')?.addEventListener('toggle', (e) => {
    sidebarMoreOpen = (e.currentTarget as HTMLDetailsElement).open;
  });
  placeHexChoice();
  app.querySelector('#map-water')?.addEventListener('change', (e) => {
    mapOpts.waterCount = Number((e.target as HTMLInputElement).value);
  });
  app.querySelector('#map-rock')?.addEventListener('change', (e) => {
    mapOpts.rockCount = Number((e.target as HTMLInputElement).value);
  });
  app.querySelector('#map-palisade')?.addEventListener('change', (e) => {
    mapOpts.palisadeCount = Number((e.target as HTMLInputElement).value);
  });
  app.querySelector('#map-high')?.addEventListener('change', (e) => {
    mapOpts.highCount = Number((e.target as HTMLInputElement).value);
  });
  app.querySelector('#map-plateau')?.addEventListener('change', (e) => {
    mapOpts.plateauCount = Number((e.target as HTMLInputElement).value);
  });
  bindBoardOnly();
}

function render() {
  maybeRecordLevelWin();
  const maxT = maxTerrainCells();
  applyPeriodTheme(activePeriod());
  applyHotseatTint();
  app.classList.toggle(
    'start-screen',
    screen === 'start' || screen === 'levels' || screen === 'units' || screen === 'ai',
  );

  if (screen === 'start') {
    app.innerHTML = renderStartScreen();
    bindEvents();
    return;
  }

  if (screen === 'levels') {
    app.innerHTML = renderLevelsOverview();
    bindEvents();
    return;
  }

  if (screen === 'units') {
    app.innerHTML = `
      <div class="board-wrap start-wrap levels-wrap unit-editor-wrap">
        ${renderToolbar()}
        ${renderUnitEditor()}
      </div>
    `;
    bindEvents();
    return;
  }

  if (screen === 'ai') {
    app.innerHTML = `
      <div class="board-wrap start-wrap levels-wrap unit-editor-wrap">
        ${renderToolbar()}
        ${renderAiChecklist()}
      </div>
    `;
    bindEvents();
    return;
  }

  if (screen === 'editor') {
    app.innerHTML = `
      <div class="board-wrap editor-mode">
        ${renderToolbar()}
        <div class="editor-top">
          <div class="editor-top-paint">
            ${renderMapPanel()}
            ${renderTokenPanel()}
            ${renderUnitTokenPanel()}
          </div>
          ${renderArmySelectPanel()}
        </div>
        <div class="board-stage">
          ${renderBoard()}
        </div>
        ${renderEditorBar()}
      </div>
      ${renderEditorBoardPopup()}
      <aside class="sidebar">
        <h2>${escapeHtml(editorName.trim() || 'New level')}</h2>
        <p class="muted">This is the level. Set width × height and hex orientation, then paint land, water, Hill (lvl.1), Plateau (lvl.2), and Mountain (lvl.3). Heights connect by ±1 — no land↔plateau jumps. Walls are tokens on walkable tiles. Paint units onto the selected side, or load a saved army (Blue gets the formation flipped). Click a placed unit to turn it one hex face. Save as default army uses that preset on random maps and on levels with no stamped armies.</p>
        <p class="muted">Levels / Units / AI in the header switches library, roster, and the AI checklist. Point up = pointy-top hexes. Flat up = flat-top. Saving stores the pieces currently on the board. Category: <strong>Campaign</strong> and <strong>Tutorial</strong> pick a map (win one to unlock the next). <strong>Historical</strong> playlists on Start follow the drag order in Levels. <strong>Skirmish</strong> pick a map. AI armies pick aggressive, defensive, or advance next to the controller.</p>
      </aside>
    `;
    bindEvents();
    return;
  }

  const pl = playlist;
  const plLvl = playlistLevel();
  const hotseatBtn =
    mode === 'hotseat'
      ? ''
      : `<button type="button" id="start-hotseat">Start hotseat</button>`;
  const modeHint = matchHasEnemies(state)
    ? participatingSides(state).some((s) => state.controls[s] === 'ai-ally')
      ? 'vs AI + allies'
      : 'vs AI'
    : participatingSides(state).filter((s) => isPlayerControlled(state, s))
          .length > 1
      ? 'Hotseat'
      : mode === 'hotseat'
        ? 'Hotseat'
        : 'vs AI';
  const levelSelect = pl
    ? ''
    : `<label>Level
          <select id="level-select">${levelSelectOptions(activeLevelId)}</select>
        </label>
        <span class="map-hint">${modeHint}</span>`;
  const mapParams = pl
    ? `<div class="map-params">
        <button type="button" id="new-map">Restart level</button>
        ${hotseatBtn}
        <button type="button" id="edit-this-level">Edit level</button>
        <span class="playlist-progress">${LEVEL_CATEGORY_LABEL[pl.kind]} ${plLvl ? escapeHtml(levelLabel(plLvl)) : pl.index + 1} / ${pl.ids.length}</span>
      </div>`
    : !activeLevelId
    ? `<div class="map-params">
        ${levelSelect}
        <button type="button" id="new-map">New map</button>
        ${hotseatBtn}
        <button type="button" id="edit-current-map">Edit this map</button>
        <label>Water <input type="number" id="map-water" min="0" max="${maxT}" value="${mapOpts.waterCount}" /></label>
        <label>Hill <input type="number" id="map-high" min="0" max="${maxT}" value="${mapOpts.highCount}" /></label>
        <label>Plateau <input type="number" id="map-plateau" min="0" max="${maxT}" value="${mapOpts.plateauCount}" /></label>
        <label>Mountain <input type="number" id="map-rock" min="0" max="${maxT}" value="${mapOpts.rockCount}" /></label>
        <label>Palisades <input type="number" id="map-palisade" min="0" max="${maxT}" value="${mapOpts.palisadeCount}" /></label>
        <span class="map-hint">mid belt · climb costs stamina · water 1 hex/action, turn-start stamina penalty or 2 HP · heights ±1 · elevation +shoot / dest −range</span>
      </div>`
    : `<div class="map-params">
        ${levelSelect}
        <button type="button" id="new-map">Restart level</button>
        ${hotseatBtn}
        <button type="button" id="edit-this-level">Edit level</button>
      </div>`;

  app.innerHTML = `
    <div class="board-wrap ${gameOverClass()}">
      ${renderToolbar()}
      ${mapParams}
      <div class="turn-banner">${turnLabel()}</div>
      ${starGoalsHtml()}
      <div class="board-stage">
        <div class="turns-left-slot">${turnsLeftHtml()}</div>
        ${renderBoard()}
        ${renderHexChoice()}
        ${endTurnButton()}
        ${state.winner ? renderEndOverlay() : renderStartOverlay()}
        ${renderBoardPopup()}
      </div>
      ${renderActionBar()}
    </div>
    ${renderSidebar()}
  `;
  bindEvents();
}

let layoutTimer = 0;
function scheduleLayoutRefresh() {
  window.clearTimeout(layoutTimer);
  layoutTimer = window.setTimeout(refreshLayout, 120);
}

onServerStatus((s) => {
  paintSyncDot(s);
});

async function initServerSync(): Promise<void> {
  const { applied } = await syncFromServer();
  defaultLevelId = getDefaultLevelId();
  if (applied && screen === 'play' && !playlist) {
    activeLevelId = defaultLevelId ?? getActiveLevelId();
    state = bootState();
    applyLayout(computeLayout(), false);
    render();
    return;
  }
  if (applied) {
    render();
    return;
  }
  paintSyncDot();
}

render();
void initServerSync();
window.addEventListener('resize', scheduleLayoutRefresh);
window.addEventListener('orientationchange', () => {
  window.setTimeout(refreshLayout, 220);
});
