import './style.css';
import { playSfx } from './sfx';
import { installSfx, sfxAction, sfxActionPoints, sfxControlsHtml, sfxHits, sfxObserve, sfxShot, sfxStep } from './sfx-hooks';
import {
  ABILITY_BLURB,
  ABILITY_IDS,
  ABILITY_LABEL,
  BUILD_STRUCTURE_BLURB,
  BUILD_STRUCTURE_LABEL,
  BUILD_STRUCTURES,
  abilitiesOf,
  hasAbility,
  javelinIsSpecial,
  canBuild,
  buildSpotMatches,
  canBash,
  canBerserk,
  canLunge,
  canShields,
  canInspire,
  refreshInspiration,
  canReload,
  berserkFoes,
  isConcealed,
  isHideCover,
  applyAction,
  clampMaxTurns,
  clampUnitsPerTurn,
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
  canOrderMarch,
  marchRoute,
  plusStepPlan,
  performMarch,
  setWalkOrder,
  takeQueuedMarches,
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
  isBridge,
  isForest,
  isPalisade,
  isWall,
  pieceVisible,
  pikesVisible,
  quietMoveOk,
  revealPiece,
  viewingSides,
  previewMove,
  rangeHighlights,
  resolveMovePath,
  armorColor,
  armorOf,
  facingOf,
  hasSplash,
  HEX_ARMOR_SIDES,
  netDamage,
  routKind,
  splashBlast,
  actionPointsLeft,
  actionPointsMax,
  apSpendCap,
  apSpentThisTurnOf,
  refusesWaterJump,
  canSpendActionPoints,
  terrainHeight,
  isElevatedTerrain,
  STOCK_UNIT_TYPES,
  UNIT_CATEGORIES,
  UNIT_CATEGORY_LABEL,
  UNIT_CLASSES,
  UNIT_CLASS_LABEL,
  sanitizeUnitClass,
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
  defaultSight,
  ARMY_CONTROLS,
  ARMY_CONTROL_LABEL,
  AI_STYLES,
  AI_STYLE_LABEL,
  SIDES,
  SIDE_LABEL,
  TOKEN_LABEL,
  TOKEN_TYPES,
  BOARD_TEXT_MAX,
  editorOpensBoardPopup,
  sanitizeBoardText,
  tokenOnHex,
  tokenIsNoTouch,
  MAX_UNIT_PROMOTIONS,
  PROMOTION_TOKEN_BLURB,
  PROMOTION_TOKEN_TYPES,
  STATUS_UNIT_TOKEN_TYPES,
  UNIT_TOKEN_LABEL,
  armorBonusOf,
  chevronPromotionTokensOf,
  countUnitToken,
  isPromotionToken,
  isStackablePromotion,
  meleeDamageOf,
  promotionTokensOf,
  shootDamageOf,
  splashDamageOf,
  defaultArmyControls,
  defaultAiStyles,
  hotseatArmyControls,
  isAiControlled,
  isPlayerControlled,
  isSide,
  isNeutralSide,
  stampAffiliation,
  isAiStyle,
  matchHasEnemies,
  participatingSides,
  allyCasualties,
  allySides,
  playerCasualties,
  playerFlagCaptures,
  playerHpLost,
  playerKills,
  playerBrokenObstacles,
  playerKillsByType,
  playerSides,
  livingHostiles,
  signsOnMap,
  signsRead,
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
  type Affiliation,
  type Side,
  type Terrain,
  type TileToken,
  type TokenType,
  type UnitCategory,
  type PromotionTokenType,
  type UnitTokenType,
  type UnitType,
  hasGeneral,
  hasScout,
  hasUnitToken,
  isSleeping,
  maybeSucceedGeneral,
  placeScoutAt,
  scoutDeploySpots,
  unitTokensOf,
  wealthyBonusOf,
  isTokenType,
  isUnitTokenType,
  sanitizeUnitTokens,
  sanitizeStory,
  withStory,
  isWalkableTerrain,
  liftWallTerrain,
  sanitizeTokens,
  hexDamageMarks,
  isRedFaceRay,
} from './engine';
import {
  cubeToOffset,
  dirBetween,
  distance,
  eq,
  hexCorners,
  hexDisk,
  hexGridExtent,
  hexToPixel,
  key,
  parseKey,
  neighborInDir,
  offsetToCube,
  pixelToHex,
  type Hex,
  type HexDir,
  type HexOrientation,
} from './hex';
import {
  FLAT_GLYPH_TOKENS,
  HEIGHT_STEP,
  TOKEN_LIFT,
  structureLift,
  cornerAt,
  hexesWithin,
  neighbourAcross,
  northEdges,
  pointInPolygon,
  southEdges,
  terrainLift,
} from './heights';
import {
  ARMY_EDGES,
  ARMY_EDGE_LABEL,
  COLS,
  DEFAULT_ARMY_EDGE,
  RANDOM_COLS,
  RANDOM_ROWS,
  ROGUE_HEX_RADIUS,
  createRogueInitialState,
  MAX_COLS,
  MAX_ROWS,
  MIN_COLS,
  MIN_ROWS,
  ROWS,
  cloneTerrain,
  clampGridSize,
  createInitialState,
  createStateFromTerrain,
  DEFAULT_MAP,
  DEFAULT_ROGUE_MAP,
  emptyTerrain,
  inferEdgeOwners,
  isArmyEdge,
  maxTerrainCells,
  resizeTerrain,
  facingFromStamp,
  sanitizeStampFacing,
  settleRandomSpawnHeights,
  type ArmyEdge,
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
  levelAudioUrl,
  sanitizeLevelAudio,
  sanitizeLevelText,
  sanitizeTeaserText,
  sanitizeStarMetric,
  sanitizeStarRule,
  starMetricIsLoss,
  STAR_METRIC_LABEL,
  STAR_METRICS,
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
  type StarStats,
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
import {
  BUILTIN_TERRAIN_PRESETS,
  listBuiltinTerrainPresets,
  resetBuiltinTerrainPreset,
  saveBuiltinTerrainPreset,
  DEFAULT_TERRAIN_PRESET_ID,
  LAYER_BIASES,
  LAYER_BIAS_LABEL,
  MAX_TERRAIN_DIFFICULTY,
  MIRROR_AXES,
  TERRAIN_DIFFICULTY_LABEL,
  MIRROR_AXIS_LABEL,
  MIRROR_MODES,
  MIRROR_MODE_LABEL,
  MAX_CLEAR_RADIUS,
  MAX_LAYER_AMOUNT,
  TERRAIN_LAYER_IDS,
  TERRAIN_LAYER_LABEL,
  cloneTerrainConfig,
  deleteTerrainPreset,
  describePlaced,
  findTerrainPresetByName,
  uniqueTerrainName,
  generateTerrain,
  getTerrainPreset,
  listUserTerrainPresets,
  randomSeed,
  saveTerrainPreset,
  type LayerBias,
  type MirrorAxis,
  type MirrorMode,
  type TerrainConfig,
  type TerrainLayerId,
  type TerrainPreset,
} from './terrain-gen';
import { pickAiAction } from './ai';
import {
  ROGUE_STAR_LABELS,
  advanceRogueRun,
  buyRogueShopOffer,
  createRogueRun,
  openRogueShop,
  rogueArmyStamps,
  rogueBattleLabel,
  rogueGoal,
  roguePromoGold,
  rogueScoutRegenPer,
  rogueUnitCost,
  rogueUnitPool,
  survivorTypes,
  survivorUnits,
  roguePromoCost,
  takeRoguePromotionOffer,
  type RogueRun,
  type RogueShop,
} from './roguelite';
import {
  getRogueConfig,
  listRogueRegionPresets,
  loadRogueConfig,
  recordRogueBattleWin,
  recordRogueMatchProgress,
  recordRogueNoLossBattle,
  recordRogueRunCompleted,
  sanitizeUnlock,
  regionAvailableInBattle,
  regionRogueCfg,
  hasRogueConfigOverride,
  type RogueConfig,
} from './roguelite-config';
import {
  applyRogueRowEnabled,
  getRogueAdminEra,
  getRogueAdminUsedOnly,
  persistRogueAdminDraft,
  readRogueAdminForm,
  renderRogueConfigPage,
  isRogueAdminEra,
  renderRogueUnlocksPage,
  resetRogueAdminDraft,
  setRogueAdminEra,
  setRogueAdminUsedOnly,
} from './roguelite-admin';
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
  hiddenBadgeSvg,
  exhaustedBadgeSvg,
  neutralBadgeSvg,
  storyBadgeSvg,
  sleepZsSvg,
  unitRankBadgesSvg,
  pieceIconSvg,
  reloadBadgeSvg,
  tokenGlyphSvg,
  palisadeObjectSvg,
  bridgeObjectSvg,
  noTouchMarkSvg,
  facingPikeSvg,
  apEmptyMarkSvg,
  apHexMarkSvg,
  actionGlyphSvg,
  tutorialHandSvg,
  type ActionGlyphId,
  actionPointsPipsHtml,
  unitTokenGlyphSvg,
  pieceShotPipsHtml,
  hpPipsHtml,
  starGlyphSvg,
  coinGlyphSvg,
} from './icons';
import { copyGlyphGroups, copyMentionedActions, copyMentionsTutorial, formatCopyHtml } from './copy';
import {
  CLAMP,
  copyUnit,
  deleteCopiedUnit,
  patchUnitAbility,
  patchUnitCategory,
  patchUnitClass,
  patchUnitKit,
  patchUnitName,
  patchUnitShootArc,
  patchUnitStat,
  resetUnitStats,
  unitStatsAreStock,
  type EditableStat,
} from './units';
import type { AbilityId, BuildStructure } from './abilities';
import { isBuildStructure } from './abilities';
import {
  deleteLevelAudio,
  flushStore,
  getServerStatus,
  listLevelAudio,
  onServerStatus,
  uploadLevelAudio,
  type ServerStatus,
  syncFromServer,
} from './sync';
import {
  DEFAULT_TTS_VOICE_ID,
  DEFAULT_TTS_VOICE_NAME,
  generateTts,
  listTtsVoices,
  loadTtsVoiceId,
  saveTtsVoiceId,
  textForTts,
  ttsTakeLabel,
  type TtsVoice,
} from './tts';
import {
  bestStarsForLevel,
  clearLevelWins,
  hasWonLevel,
  recordLevelWin,
} from './progress';
import {
  getAccountLoginUrl,
  getAccountRegisterUrl,
  getAccountStatus,
  getAccountUser,
  isEraAdmin,
  syncAccountProgress,
} from './account';
import {
  mountCampaignEditor,
  type CampaignEditorHandle,
} from './campaign/editor';
import {
  mountCampaignPlay,
  type CampaignPlayHandle,
} from './campaign/play';
import pkg from '../package.json';

const APP_NAME = 'There Will Be Legions';
const APP_VERSION = pkg.version;
document.title = `${APP_NAME} — v${APP_VERSION}`;

type Mode = 'hotseat' | 'ai';
type ActionMode = 'move' | 'shoot' | 'charge' | 'lunge';
type Screen =
  | 'start'
  | 'play'
  | 'levels'
  | 'editor'
  | 'units'
  | 'ai'
  | 'roguelite'
  | 'unlocks'
  | 'campaign-map'
  | 'campaign-play';
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
type EditorBrush =
  | Terrain
  | UnitType
  | TokenType
  | UnitTokenBrush
  | 'notouch'
  | 'erase'
  | 'clear-promotions';

const TRASH_ICON_SVG = `<svg class="icon-trash" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M6.1 1.2h3.8l.45 1.3H14v1.25H2V2.5h3.65L6.1 1.2zM3.25 5h9.5l-.55 8.25A1.4 1.4 0 0 1 10.8 14.6H5.2a1.4 1.4 0 0 1-1.4-1.35L3.25 5zm2.3 1.35v6.15h1.15V6.35H5.55zm3.2 0v6.15H9.9V6.35H8.75z"/></svg>`;

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
let campaignEditor: CampaignEditorHandle | null = null;
let campaignPlay: CampaignPlayHandle | null = null;
let selectedPeriod: Period = getSelectedPeriod();
let randomSetup: RandomSetup | null = null;
let randomArmies: Omit<RandomSetup, 'kind'> | null = null;
/** Active roguelite run (null = normal play). */
let rogueRun: RogueRun | null = null;
/** Post-victory recruit shop for the active run. */
let rogueShop: RogueShop | null = null;
/** Star→pile coin FX already played for this shop open. */
let rogueGoldFxPlayed = false;
/** Pending promotion assign: pick a survivor after choosing an offer. */
let roguePromoAssign: { index: number; promo: PromotionTokenType } | null =
  null;
/** Pre-battle Scout ambush: place hidden units (+ rogue map regenerates). */
let scoutPrep: { regenLeft: number; placingId: string | null } | null = null;
const RANDOM_UNITS_PER_TURN = 6;
let state: GameState = bootState();
let briefingOpen = false;
/** Play: reread / walk-on message board. */
let boardPopup: { text: string; title?: string } | null = null;
/** Bouncing hands on Tutorial tokens after a message with [tutorial] closes. */
let tutorialHands: Hex[] | null = null;
/** Dock buttons named in that same message (`[rest]`, `[end turn]`, …). */
let tutorialDock: ActionGlyphId[] | null = null;
/** Editor: hex whose board text is being edited. */
let editorBoardHex: Hex | null = null;
let editorStoryHex: Hex | null = null;
let playlist: Playlist | null = null;
let mapPick: MapPickKind | null = null;
let unitEditorCategory: UnitCategory = sanitizeUnitCategory(selectedPeriod);
const unitEditorOpen = new Set<UnitType>();
let selectedId: string | null = null;
/** Hex where both move-onto and shoot are legal — wait for Move/Shoot pick. */
let pendingHex: Hex | null = null;
/** Occupied rotate target: Run = turn, Select = pick the unit on the hex. */
let pendingRunSelect: { dir: HexDir; selectId: string } | null = null;
let highlights: Highlight[] = [];
let hoverHex: Hex | null = null;
let hoverPath: Hex[] = [];
/** Path drawn when the dest was chosen — the unit walks this. */
let commitPath: Hex[] = [];
let aiThinking = false;
let animating = false;
let rotatePreviewDir: HexDir | null = null;
/** Player pref: narration on intro / victory / lose popups. Default on. */
const POPUP_AUDIO_KEY = 'chessarmy-popup-audio-v1';
let popupAudioOn = loadPopupAudio();
/** Active special mode for the selected unit (hide / javelin / charge / build). */
let specialMode: AbilityId | null = null;
/** What Build places / clears while specialMode is build. */
let buildStructure: BuildStructure = 'pikes';
/** Build-structure picker flyout, opened from the Build dock button. */
let buildPickOpen = false;

function loadPopupAudio(): boolean {
  try {
    return localStorage.getItem(POPUP_AUDIO_KEY) !== '0';
  } catch {
    return true;
  }
}

function persistPopupAudio(): void {
  try {
    localStorage.setItem(POPUP_AUDIO_KEY, popupAudioOn ? '1' : '0');
  } catch {
    /* ignore quota / private mode */
  }
}

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
let editorStartAudio = '';
let editorWinAudio = '';
let editorLoseAudio = '';
type EditorAudioSlot = 'start' | 'win' | 'lose';
let editorAudioPick: EditorAudioSlot | null = null;
let editorAudioFiles: string[] | null = null;
let editorAudioError = '';
let editorAudioPlaying: EditorAudioSlot | null = null;
let levelAudio: HTMLAudioElement | null = null;
let audioPickAbort: AbortController | null = null;
type EditorTtsTake = { file: string; label: string };
type EditorTtsState = {
  slot: EditorAudioSlot;
  voices: TtsVoice[] | null;
  voiceId: string;
  generating: boolean;
  saving: boolean;
  takes: EditorTtsTake[];
  selectedFile: string | null;
  playingFile: string | null;
  error: string;
};
let editorTts: EditorTtsState | null = null;
let ttsPreviewAudio: HTMLAudioElement | null = null;
let editorStar2: StarRule = { ...DEFAULT_STAR_2 };
let editorStar3: StarRule = { ...DEFAULT_STAR_3 };
let editorPieces: ArmyStamp[] = [];
let editorTokens: TileToken[] = [];
let editorArmySide: Side = 'red';
/** Where the next army load stamps. One color per edge. */
let editorLoadEdge: ArmyEdge = 'bottom';
let editorEdgeOwner: Record<ArmyEdge, Side | null> = {
  bottom: 'red',
  top: 'blue',
  left: 'yellow',
  right: 'purple',
};
let editorControls: Record<Side, ArmyControl> = defaultArmyControls();
let editorAiStyles: Record<Side, AiStyle> = defaultAiStyles();
let editorUnitCategory: UnitCategory = sanitizeUnitCategory(selectedPeriod);
let editorFormationId: string | null = STOCK_FORMATION_ID;
let editorFormationName = 'New army';
let editorArmiesOpen = false;
let editorTerrainGenOpen = false;
let editorTerrainPresetId: string | null = DEFAULT_TERRAIN_PRESET_ID;
/** Terrain presets screen: the editor with only the generator + a preview board. */
let editorTerrainOnly = false;
let editorTerrainName = BUILTIN_TERRAIN_PRESETS[0]!.name;
let editorTerrainCfg: TerrainConfig = cloneTerrainConfig(BUILTIN_TERRAIN_PRESETS[0]!);
let editorTerrainSeed = randomSeed();
let editorTerrainLockSeed = false;
let editorTerrainStatus = '';
let editorGlyphsOpen = false;
let editorGlyphQuery = '';
/** Last copy textarea focused — glyph chips insert here. */
let editorCopyFieldId: string | null = null;
let editorPainting = false;
let editorDirty = false;
/** One snapshot per paint stroke / discrete editor action. */
type EditorUndoSnap = {
  terrain: Terrain[][];
  tokens: TileToken[];
  pieces: ArmyStamp[];
};
const EDITOR_UNDO_MAX = 50;
let editorUndoStack: EditorUndoSnap[] = [];
/** Avoid pushing once per hex while dragging. */
let editorStrokeUndoPushed = false;
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
const MOVE_MS = 200;
const REVEAL_MS = 520;
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
    const packed = withStory(p.unitTokens, p.story);
    out.push({
      type: p.type,
      col: p.col,
      row: p.row,
      side: p.side,
      unitTokens: packed.unitTokens,
      story: packed.story,
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
  if (rogueRun && mode !== 'hotseat') {
    return { ...defaultAiStyles(), blue: rogueRun.aiStyle };
  }
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
  if (rogueRun) return rogueArmyStamps(rogueRun);
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

function clearRogueShop() {
  rogueShop = null;
  rogueGoldFxPlayed = false;
  roguePromoAssign = null;
  scoutPrep = null;
}

/** Player-controlled pieces carrying the Scout promotion. */
function playerScoutPieces(): Piece[] {
  return state.pieces
    .filter(
      (p) =>
        hasScout(p) && isSide(p.side) && isPlayerControlled(state, p.side),
    )
    .sort((a, b) => a.row - b.row || a.col - b.col);
}

function scoutPrepBlocks(): boolean {
  return !!scoutPrep && !state.winner;
}

/** Open pre-battle Scout ambush UI when the player has Scout units. */
function maybeStartScoutPrep(keepRegen?: number): void {
  const scouts = playerScoutPieces();
  if (!scouts.length) {
    scoutPrep = null;
    return;
  }
  const regenLeft =
    keepRegen !== undefined
      ? keepRegen
      : rogueRun
        ? scouts.length * rogueScoutRegenPer()
        : 0;
  scoutPrep = { regenLeft, placingId: null };
}

function finishScoutPrep(): void {
  scoutPrep = null;
  selectedId = null;
  highlights = [];
  render();
  void maybeAi();
}

function beginScoutPlace(pieceId: string): void {
  if (!scoutPrep) return;
  const p = getPiece(state, pieceId);
  if (
    !p ||
    !hasScout(p) ||
    !isSide(p.side) ||
    !isPlayerControlled(state, p.side)
  ) {
    return;
  }
  scoutPrep.placingId = scoutPrep.placingId === pieceId ? null : pieceId;
  selectedId = scoutPrep.placingId;
  refreshHighlights();
  render();
}

function commitScoutPlace(hex: Hex): void {
  if (!scoutPrep?.placingId) return;
  const next = placeScoutAt(state, scoutPrep.placingId, hex);
  if (!next) return;
  state = next;
  scoutPrep.placingId = null;
  selectedId = null;
  highlights = [];
  render();
}

const ROGUE_TERRAIN_KEY = 'chessarmy-rogue-terrain'; // legacy, cleared on load
/** Terrain preset id for roguelite maps. '' = classic random. Never saved. */
const ROGUE_TERRAIN_AUTO = 'auto';
let rogueTerrainId: string = ROGUE_TERRAIN_AUTO;
try {
  localStorage.removeItem(ROGUE_TERRAIN_KEY);
} catch {
  /* private mode */
}

/** Presets Auto may roll, plus a manual pick even if it is currently disabled. */
function rogueTerrainPool(): TerrainPreset[] {
  const ids = new Set(listRogueRegionPresets().map((r) => r.id));
  return [...listBuiltinTerrainPresets(), ...listUserTerrainPresets()].filter((p) => ids.has(p.id));
}

/** Name / id of the terrain the current roguelite map was built with. */
let rogueMapTerrainName = '';
let rogueMapTerrainId = '';
/** This roguelite run has lost at least one player unit. */
let rogueRunLostUnit = false;
/** Defeat stats already written for the current ended match. */
let rogueLossRecorded = false;

function rogueTerrainPreset(): TerrainPreset | null {
  const p = pickRogueTerrain();
  rogueMapTerrainName = p ? p.name : 'Classic random';
  rogueMapTerrainId = p ? p.id : '';
  return p;
}

function pickWeightedTerrain(pool: TerrainPreset[]): TerrainPreset {
  const weights = pool.map((p) => Math.max(0, regionRogueCfg(p.id).weight));
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return pool[Math.floor(Math.random() * pool.length)]!;
  let roll = Math.random() * sum;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}

function pickRogueTerrain(): TerrainPreset | null {
  if (rogueTerrainId === '') return null; // Classic random
  if (rogueTerrainId !== ROGUE_TERRAIN_AUTO) {
    const p = getTerrainPreset(rogueTerrainId);
    if (p) return p;
    // Gone: fall through to Auto.
  }
  const battle = rogueRun?.battle ?? 1;
  const all = rogueTerrainPool().filter((p) => regionAvailableInBattle(p.id, battle));
  if (!all.length) return null;
  return pickWeightedTerrain(all);
}

function setRogueTerrainId(id: string): void {
  rogueTerrainId = id === ROGUE_TERRAIN_AUTO || getTerrainPreset(id) ? id : '';
}

/** Roguelite: find a new location, keep remaining attempts. */
function regenScoutMap(): void {
  if (!scoutPrep || scoutPrep.regenLeft <= 0 || !rogueRun) return;
  const left = scoutPrep.regenLeft - 1;
  scoutPrep = null;
  mapOpts = { ...DEFAULT_ROGUE_MAP };
  state = withLevelRules(
    createRogueInitialState(
      mapOpts,
      rogueArmyStamps(rogueRun),
      matchControls(),
      matchAiStyles(),
      ROGUE_HEX_RADIUS,
      rogueTerrainPreset(),
    ),
  );
  clearSelection();
  maybeStartScoutPrep(left);
  applyLayout(computeLayout(), false);
  render();
}

function startRogueRun() {
  if (eraPlayLocked()) return;
  rogueRunLostUnit = false;
  rogueLossRecorded = false;
  if (!rogueUnitPool(selectedPeriod, 'start', 1).length) return;
  rogueRunCompletionRecorded = false;
  rogueRun = createRogueRun(selectedPeriod, 'aggressive');
  clearRogueShop();
  randomArmies = null;
  randomSetup = null;
  mapPick = null;
  playlist = null;
  mapOpts = { ...DEFAULT_ROGUE_MAP };
  mode = 'ai';
  screen = 'play';
  activeLevelId = null;
  setActiveLevelId(null);
  startMatch(true);
}

/** If the match ended before the player's next turn, crown a general for the next army. */
function ensureRogueEndSuccession() {
  if (!rogueRun || !state.generalSuccession) return;
  for (const s of playerSides(state)) {
    maybeSucceedGeneral(state, s);
  }
}

function armyCounts(pieces: { side: string; type: string }[], side = 'red'): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of pieces) {
    if (p.side !== side) continue;
    out[p.type] = (out[p.type] ?? 0) + 1;
  }
  return out;
}

function noteRogueRunLosses(): void {
  if (!rogueRun) return;
  if (playerCasualties(state) > 0) rogueRunLostUnit = true;
}

/** Persist kills / purse / no-loss / composition from the match that just ended. */
function flushRogueMatchProgress(won: boolean): void {
  if (!rogueRun) return;
  noteRogueRunLosses();
  const patch = {
    kills: playerKillsByType(state),
    broken: playerBrokenObstacles(state),
    gold: rogueRun.gold,
    lostUnit: rogueRunLostUnit,
    army: won ? armyCounts(state.pieces, 'red') : undefined,
  };
  if (won) {
    recordRogueBattleWin(
      rogueRun.battle,
      rogueMapTerrainId || undefined,
      { ...patch, noLossBattle: rogueRunLostUnit ? undefined : rogueRun.battle },
    );
  } else {
    recordRogueMatchProgress(rogueRun.battle, patch);
  }
}

/** Open the victory shop once (1g per earned star + Wealthy, rolls 3 offers). Also after battle 10 if continuing. */
function ensureRogueShop() {
  if (!rogueRun || !state.winner || !playerTeamWon(state)) return;
  if (rogueShop) return;
  // Stars first (general-alive is pre-succession), then crown a heir for the next fight.
  const starGold = starKinds().filter((k) => k === 'on').length;
  const wealthyGold = state.pieces
    .filter((p) => p.side === 'red')
    .reduce((n, p) => n + wealthyBonusOf(p), 0);
  ensureRogueEndSuccession();
  const opened = openRogueShop(rogueRun, starGold, wealthyGold);
  rogueRun = opened.run;
  rogueShop = opened.shop;
  flushRogueMatchProgress(true);
  if (rogueRun.battle >= rogueGoal() && !rogueRunCompletionRecorded) {
    recordRogueRunCompleted();
    rogueRunCompletionRecorded = true;
  }
}

function ensureRogueLossProgress(): void {
  if (!rogueRun || !state.winner || playerTeamWon(state) || rogueLossRecorded) return;
  rogueLossRecorded = true;
  flushRogueMatchProgress(false);
}

function buyRogueOffer(index: number) {
  if (!rogueRun || !rogueShop) return;
  const next = buyRogueShopOffer(rogueRun, rogueShop, index);
  if (!next) return;
  rogueRun = next.run;
  rogueShop = next.shop;
  render();
}

/** Survivors who still have a stackable promotion slot (General does not count). */
function roguePromoCandidates(): Piece[] {
  return state.pieces
    .filter(
      (p) =>
        p.side === 'red' &&
        chevronPromotionTokensOf(p).length < MAX_UNIT_PROMOTIONS,
    )
    .sort((a, b) => a.row - b.row || a.col - b.col);
}

function beginRoguePromoAssign(index: number) {
  if (!rogueRun || !rogueShop) return;
  const promo = rogueShop.promotions[index];
  if (promo == null) return;
  if (!roguePromoCandidates().length) return;
  if (rogueRun.gold < roguePromoCost(rogueShop)) return;
  roguePromoAssign = { index, promo };
  render();
}

function cancelRoguePromoAssign() {
  if (!roguePromoAssign) return;
  roguePromoAssign = null;
  render();
}

/** Stamp the pending promotion onto a survivor; it rides until that unit dies. */
function confirmRoguePromoAssign(pieceId: string) {
  if (!rogueRun || !rogueShop || !roguePromoAssign) return;
  const piece = getPiece(state, pieceId);
  if (!piece || piece.side !== 'red') return;
  if (chevronPromotionTokensOf(piece).length >= MAX_UNIT_PROMOTIONS) return;
  const taken = takeRoguePromotionOffer(
    rogueRun,
    rogueShop,
    roguePromoAssign.index,
  );
  if (!taken || taken.promo !== roguePromoAssign.promo) return;
  playSfx('promotion_gain');
  const unitTokens = sanitizeUnitTokens([
    ...(piece.unitTokens ?? []),
    taken.promo,
  ]);
  const nextPiece = { ...piece, unitTokens };
  // HP +2 raises max — bump current HP too so the gain is felt immediately.
  if (taken.promo === 'hp2') {
    nextPiece.hp = hpLeft(piece) + 2;
  }
  state = {
    ...state,
    pieces: state.pieces.map((p) => (p.id === pieceId ? nextPiece : p)),
  };
  rogueRun = taken.run;
  rogueShop = taken.shop;
  roguePromoAssign = null;
  render();
}

function advanceRogueBattle() {
  if (!rogueRun || !state.winner || !playerTeamWon(state)) return;
  ensureRogueShop();
  const purchased = rogueShop?.purchased ?? [];
  const next = advanceRogueRun(
    rogueRun,
    survivorUnits(state.pieces, 'red'),
    purchased,
  );
  clearRogueShop();
  if (!next) {
    rogueRun = null;
    clearRogueShop();
    showStart();
    return;
  }
  rogueRun = next;
  startMatch(true);
}

function openRandomSetup(kind: MapPickKind) {
  if (eraPlayLocked()) return;
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
  if (eraPlayLocked()) return;
  if (!randomArmyChoices().length) return;
  rogueRun = null;
  clearRogueShop();
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
          lvl.hexRadius,
        ),
        lvl,
      );
    }
  }
  return withLevelRules(
    createInitialState(
      mapOpts,
      randomMatchArmies(RANDOM_COLS, RANDOM_ROWS),
      matchControls(),
      matchAiStyles(),
    ),
  );
}

function startMatch(reshuffleRandom = true) {
  specialMode = null;
  for (const k of Object.keys(rememberedSelectId) as Side[]) {
    delete rememberedSelectId[k];
  }
  autoSelectedForTurnKey = null;
  clearSelection();
  aiThinking = false;
  animating = false;
  briefingOpen = false;
  boardPopup = null;
  tutorialHands = null;
  tutorialDock = null;
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
          lvl.hexRadius,
        ),
        lvl,
      );
      briefingOpen = !!sanitizeLevelText(lvl.startText) || canSkipPlayedLevel();
      scoutPrep = null;
      if (!briefingOpen) maybeStartScoutPrep();
      applyLayout(computeLayout(), false);
      render();
      void playPendingFx();
      if (!briefingOpen && !scoutPrepBlocks()) void maybeAi();
      return;
    }
    activeLevelId = null;
    setActiveLevelId(null);
  }
  if (reshuffleRandom) {
    // Rogue ignores the start-screen map form — denser forest by default.
    mapOpts = rogueRun ? { ...DEFAULT_ROGUE_MAP } : readMapInputs();
    state = withLevelRules(
      rogueRun
        ? createRogueInitialState(
            mapOpts,
            rogueArmyStamps(rogueRun),
            matchControls(),
            matchAiStyles(),
            ROGUE_HEX_RADIUS,
            rogueTerrainPreset(),
          )
        : createInitialState(
            mapOpts,
            randomMatchArmies(RANDOM_COLS, RANDOM_ROWS),
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
        state.hexRadius,
      ),
    );
    settleRandomSpawnHeights(state);
  }
  scoutPrep = null;
  maybeStartScoutPrep();
  rogueLossRecorded = false;
  if (rogueRun && !rogueRunLostUnit) recordRogueNoLossBattle(rogueRun.battle);
  applyLayout(computeLayout(), false);
  render();
  void playPendingFx();
  if (!scoutPrepBlocks()) void maybeAi();
}

function withLevelRules(s: GameState, lvl?: SavedLevel | null): GameState {
  s.unitsPerTurn = clampUnitsPerTurn(
    lvl?.unitsPerTurn ?? RANDOM_UNITS_PER_TURN,
  );
  s.maxTurns = clampMaxTurns(lvl?.maxTurns ?? 0);
  s.aiStyles = sanitizeAiStyles(lvl?.aiStyles ?? s.aiStyles);
  s.actedIds = [];
  s.generalSuccession = !!rogueRun;
  return s;
}

let editorHex = false;
let editorRadius = 5;
let editorHexCenter: Hex | null = null;
/** Rectangle height to restore when Hex is turned off. */
let editorRectRows = ROWS;

function editorBoardCenter(): Hex {
  const { cols, rows } = currentGrid();
  return editorHexCenter ?? { col: Math.floor((cols - 1) / 2), row: Math.floor((rows - 1) / 2) };
}

function inEditorHex(col: number, row: number): boolean {
  if (!editorHex || !editorHexCenter) return true;
  return distance({ col, row }, editorHexCenter, editorOrientation) <= editorRadius;
}

/** Move the current paint onto a new grid, matched through the center. */
function transplantBoard(
  nextCols: number,
  nextRows: number,
  nextCenter: Hex,
  keep: (h: Hex) => boolean,
  mode: 'cube' | 'offset' = 'cube',
): void {
  const o = editorOrientation;
  const oldCenter = editorBoardCenter();
  const oldT = editorTerrain;
  const oc = offsetToCube(oldCenter, o);
  const nc = offsetToCube(nextCenter, o);
  const terrain: Terrain[][] = Array.from({ length: nextRows }, () =>
    Array.from({ length: nextCols }, () => 'land' as Terrain),
  );
  const srcOf = (cell: Hex): Hex => {
    if (mode === 'offset') {
      return {
        col: cell.col - nextCenter.col + oldCenter.col,
        row: cell.row - nextCenter.row + oldCenter.row,
      };
    }
    const c = offsetToCube(cell, o);
    const q = c.q - nc.q + oc.q;
    const r = c.r - nc.r + oc.r;
    return cubeToOffset({ q, r, s: -q - r }, o);
  };
  const destOf = (cell: Hex): Hex => {
    if (mode === 'offset') {
      return {
        col: cell.col - oldCenter.col + nextCenter.col,
        row: cell.row - oldCenter.row + nextCenter.row,
      };
    }
    const c = offsetToCube(cell, o);
    const q = c.q - oc.q + nc.q;
    const r = c.r - oc.r + nc.r;
    return cubeToOffset({ q, r, s: -q - r }, o);
  };
  for (let row = 0; row < nextRows; row++) {
    for (let col = 0; col < nextCols; col++) {
      const cell = { col, row };
      if (!keep(cell)) continue;
      const src = srcOf(cell);
      const prev = oldT[src.row]?.[src.col];
      if (prev) terrain[row][col] = prev;
    }
  }
  const move = <T extends { col: number; row: number }>(items: T[]): T[] =>
    items.flatMap((p) => {
      const dest = destOf(p);
      if (dest.col < 0 || dest.row < 0 || dest.col >= nextCols || dest.row >= nextRows) return [];
      if (!keep(dest)) return [];
      return [{ ...p, col: dest.col, row: dest.row }];
    });
  editorTerrain = terrain;
  editorPieces = move(editorPieces);
  editorTokens = move(editorTokens);
}

function finishEditorShape(): void {
  editorDirty = true;
  applyLayout(computeLayout(), false);
  render();
}

function applyHexBoard(mode: 'cube' | 'offset' = 'cube'): void {
  let radius = Math.max(1, Math.min(10, Math.floor(editorRadius) || 1));
  let disk = hexDisk(radius, editorOrientation);
  while ((disk.cols > MAX_COLS || disk.rows > MAX_ROWS) && radius > 1) {
    radius -= 1;
    disk = hexDisk(radius, editorOrientation);
  }
  editorRadius = radius;
  transplantBoard(
    disk.cols,
    disk.rows,
    disk.center,
    (h) => distance(h, disk.center, editorOrientation) <= radius,
    mode,
  );
  editorHex = true;
  editorHexCenter = disk.center;
  finishEditorShape();
}

function applyRectBoard(cols: number, rows: number): void {
  const size = clampGridSize(cols, rows);
  const center = {
    col: Math.floor((size.cols - 1) / 2),
    row: Math.floor((size.rows - 1) / 2),
  };
  transplantBoard(size.cols, size.rows, center, () => true);
  editorHex = false;
  editorHexCenter = null;
  finishEditorShape();
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
  if (editorHex) {
    applyHexBoard('offset');
    return;
  }
  editorDirty = true;
  applyLayout(computeLayout(), false);
  render();
}

const app = document.querySelector<HTMLDivElement>('#app')!;

function wait(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}

async function playQueuedMarches(): Promise<void> {
  const steps = takeQueuedMarches();
  if (steps.length) playSfx('auto_walk');
  for (const step of steps) {
    const live = getPiece(state, step.pieceId);
    const g = document.querySelector<SVGGElement>(
      `g.piece-unit[data-id="${CSS.escape(step.pieceId)}"]`,
    );
    if (!g) continue;
    const ghost: Piece = {
      ...(live ?? {
        id: step.pieceId,
        side: 'red',
        type: 'soldier',
      }),
      col: step.from.col,
      row: step.from.row,
      facing: step.facing,
    };
    const aim = step.path[step.path.length - 1] ?? step.stop;
    await animateMoveAlong(g, ghost, step.path, step.stop, aim);
  }
}

async function playPendingFx(): Promise<void> {
  await playQueuedMarches();
  const hits = state.fxHits;
  const stam = state.fxActionPoints ?? [];
  const board = state.fxBoard;
  const gains = stam.filter((x) => x.kind === 'gain');
  const spends = stam.filter((x) => x.kind === 'spend');
  if (!hits?.length && !gains.length && !spends.length && !board) {
    if (state.fxHits || state.fxActionPoints || state.fxBoard) {
      state = { ...state, fxHits: undefined, fxActionPoints: undefined, fxBoard: undefined };
    }
    return;
  }
  state = { ...state, fxHits: undefined, fxActionPoints: undefined, fxBoard: undefined };
  if (hits?.length) await flashDamaged(hits);
  if (gains.length || spends.length) {
    render();
    if (gains.length) await flashActionPoints(gains, 'ap-gain');
    if (spends.length) await flashActionPoints(spends, 'ap-spend');
  }
  if (board?.text) playSfx('board_message_open');
  if (board?.text) boardPopup = { text: board.text, title: board.title };
}

function damagePopColor(hit: {
  armor?: number;
  ranged?: boolean;
}): string {
  if (hit.ranged) return '#ffffff';
  const armor = hit.armor ?? 0;
  // Green (0) / no modifier → white; otherwise shield scale color.
  if (armor === 0) return '#ffffff';
  return armorColor(armor);
}

function spawnDamagePops(
  hits: readonly {
    id: string;
    dealt: number;
    armor?: number;
    ranged?: boolean;
    routed?: boolean;
    routKind?: 'pinched' | 'panic';
  }[],
): void {
  // HTML overlay (not SVG) so pops survive the post-hit board re-render.
  let layer = document.querySelector<HTMLElement>('.dmg-pop-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'dmg-pop-layer';
    document.body.appendChild(layer);
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const hit of hits) {
    const routed = !!hit.routed;
    const n = Math.max(0, Math.floor(hit.dealt));
    if (n <= 0 && !routed) continue;
    const el = document.querySelector<SVGGElement>(
      `g.piece-unit[data-id="${CSS.escape(hit.id)}"]`,
    );
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height * 0.22;
    const pop = document.createElement('div');
    pop.className = reduce
      ? `dmg-pop reduce${routed ? ' rout' : ''}`
      : `dmg-pop${routed ? ' rout' : ''}`;
    pop.style.setProperty('--x', `${x}px`);
    pop.style.setProperty('--y', `${y}px`);
    if (routed) {
      pop.style.setProperty('--dmg-scale', '1.05');
      pop.textContent =
        hit.routKind === 'panic' ? 'routing: panic' : 'routing: pinched';
    } else {
      // −1 = base; each extra point of damage +10% size.
      pop.style.setProperty('--dmg-scale', String(1 + (n - 1) * 0.1));
      pop.style.color = damagePopColor(hit);
      pop.textContent = `−${n}`;
    }
    layer.appendChild(pop);
    window.setTimeout(() => pop.remove(), reduce ? 280 : routed ? 900 : 720);
  }
}

function flashDamaged(
  hits: readonly {
    id: string;
    fatal?: boolean;
    routed?: boolean;
    dealt: number;
    armor?: number;
    ranged?: boolean;
  }[],
): Promise<void> {
  if (!hits.length) return Promise.resolve();
  sfxHits(hits, (id) => getPiece(state, id)?.type);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dying = false;
  let routing = false;
  let maxN = 0;
  const pops: {
    id: string;
    dealt: number;
    armor?: number;
    ranged?: boolean;
    routed?: boolean;
  }[] = [];
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
    if (routed || n > 0) pops.push(hit);
    if (n > maxN) maxN = n;
  }
  if (pops.length) spawnDamagePops(pops);
  if (maxN <= 0 && !routing) return Promise.resolve();
  if (reduce) return wait(140);
  if (routing) return wait(Math.max(ROUT_MS, dying ? HIT_FLASH_MS * Math.max(1, maxN) + 140 : 0));
  const blink = HIT_FLASH_MS * Math.max(1, maxN);
  return wait(dying ? blink + 140 : blink);
}

function flashActionPoints(
  events: readonly { id: string }[],
  cls: 'ap-gain' | 'ap-spend',
): Promise<void> {
  if (!events.length) return Promise.resolve();
  sfxActionPoints(cls === 'ap-gain' ? 'gain' : 'spend');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let any = false;
  for (const ev of events) {
    const el = document.querySelector(`g.piece-unit[data-id="${CSS.escape(ev.id)}"]`);
    if (!el) continue;
    el.classList.remove('ap-gain', 'ap-spend');
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

/** Raised-tile state for the board last drawn (see heights.ts). Lift is px, up = positive. */
let liftMap = new Map<string, number>();
let tileKind = new Map<string, string>();
/** Palisade plinth / bridge-deck lift (px). Does not raise the tile itself. */
let coverLiftMap = new Map<string, number>();
let boardTopExtra = 0;

function liftOf(h: Hex): number {
  return liftMap.get(key(h)) ?? 0;
}

function coverLiftOf(h: Hex): number {
  return coverLiftMap.get(key(h)) ?? 0;
}

/** Centre of a tile's top face (already raised/sunk by its height). */
function pixelOf(h: Hex): { x: number; y: number } {
  const { x, y } = hexToPixel(h, HEX_SIZE, viewOrientation());
  return { x: x + PAD, y: y + PAD - liftOf(h) };
}

/** Walkable / built surface: tile top plus a palisade plinth or bridge deck, if any. */
function surfacePixelOf(h: Hex): { x: number; y: number } {
  const p = pixelOf(h);
  return { x: p.x, y: p.y - coverLiftOf(h) };
}

/** Where a unit stands: the surface plus its small token lift. */
function unitPixelOf(h: Hex): { x: number; y: number } {
  const p = surfacePixelOf(h);
  return { x: p.x, y: p.y - TOKEN_LIFT };
}

/** Work out each drawn tile's height from terrain only. Palisades and bridges do not raise the tile. */
function buildLiftMap(
  terrainGrid: Terrain[][],
  tokens: { type: string; col: number; row: number }[],
  editing: boolean,
  ori: HexOrientation,
): void {
  const lifts = new Map<string, number>();
  const kinds = new Map<string, string>();
  const covers = new Map<string, number>();
  const rows = terrainGrid.length;
  const cols = terrainGrid[0]?.length ?? 0;
  for (const t of tokens) {
    const extra = structureLift(t.type);
    if (extra) covers.set(key({ col: t.col, row: t.row }), extra);
  }
  let top = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const hex = { col, row };
      if (editing) {
        if (!inEditorHex(col, row)) continue;
      } else if (
        state.hexRadius > 0 &&
        state.hexCenter &&
        distance(hex, state.hexCenter, ori) > state.hexRadius
      ) {
        continue;
      }
      const k = key(hex);
      const terrain = terrainGrid[row][col];
      const lift = terrainLift(terrain);
      lifts.set(k, lift);
      kinds.set(k, terrain);
      const peak = lift + (covers.get(k) ?? 0);
      if (peak > top) top = peak;
    }
  }
  liftMap = lifts;
  tileKind = kinds;
  coverLiftMap = covers;
  boardTopExtra = top > 0 ? Math.ceil(top + TOKEN_LIFT) : 0;
}

/** South walls (with a seam between each stacked slab) for a tile higher than its neighbours. */
function tileWallsSvg(hex: Hex, cx: number, cy: number, ori: HexOrientation): string {
  const lift = liftOf(hex);
  const kind = tileKind.get(key(hex)) ?? 'land';
  let out = '';
  for (const e of southEdges(hex, ori)) {
    const nbLift = liftMap.get(key(e.nb)) ?? 0;
    const drop = lift - nbLift;
    if (drop < 0.5) continue;
    const [x1, y1] = cornerAt(cx, cy, HEX_SIZE, e.a, ori);
    const [x2, y2] = cornerAt(cx, cy, HEX_SIZE, e.a + 1, ori);
    const f = (n: number) => n.toFixed(2);
    out += `<polygon class="wall-face ${kind} ${e.face}" points="${f(x1)},${f(y1)} ${f(x2)},${f(y2)} ${f(x2)},${f(y2 + drop)} ${f(x1)},${f(y1 + drop)}" />`;
    for (let lv = Math.floor(nbLift / HEIGHT_STEP) + 1; lv * HEIGHT_STEP < lift - 0.01; lv++) {
      if (lv * HEIGHT_STEP <= nbLift + 0.01) continue;
      const off = lift - lv * HEIGHT_STEP;
      out += `<line class="wall-seam" x1="${f(x1)}" y1="${f(y1 + off)}" x2="${f(x2)}" y2="${f(y2 + off)}" />`;
      out += `<line class="wall-seam-hi" x1="${f(x1)}" y1="${f(y1 + off + 1)}" x2="${f(x2)}" y2="${f(y2 + off + 1)}" />`;
    }
    out += `<line class="wall-lip" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" />`;
    if (tileKind.get(key(e.nb)) === 'water') {
      out += `<line class="wall-waterline" x1="${f(x1)}" y1="${f(y1 + drop)}" x2="${f(x2)}" y2="${f(y2 + drop)}" />`;
    }
  }
  return out;
}

/** Sheen, soft shadow cast onto this (lower) tile, sunken-water lip and rim light. */
function tileTopFxSvg(hex: Hex, cx: number, cy: number, terrain: Terrain, ori: HexOrientation): string {
  const k = key(hex);
  const lift = liftOf(hex);
  const f = (n: number) => n.toFixed(2);
  const top = hexCorners(cx, cy, HEX_SIZE, ori);
  let out = '';
  if (terrain === 'high' || terrain === 'plateau' || terrain === 'rock') {
    out += `<polygon class="tile-sheen ${terrain}" points="${top}" />`;
  }
  let clipped = '';
  if (terrain === 'water') {
    clipped += `<polygon class="water-lip" points="${hexCorners(cx, cy, HEX_SIZE * 0.91, ori)}" />`;
  }
  for (let i = 0; i < 6; i++) {
    const nb = neighbourAcross(hex, i, ori);
    const nbLift = liftMap.get(key(nb));
    if (nbLift === undefined) continue;
    const rise = nbLift - lift;
    if (rise < 0.5) continue;
    const [x1, y1] = cornerAt(cx, cy, HEX_SIZE, i, ori);
    const [x2, y2] = cornerAt(cx, cy, HEX_SIZE, i + 1, ori);
    // A higher tile to the south overlaps us, so its shadow sits where its top meets ours.
    const south = Math.sin(((o2a(ori) + 60 * i + 30) * Math.PI) / 180) > 0.2;
    const sh = south ? -rise : 0;
    const w = 7 + rise * 0.35;
    const op = Math.min(0.5, 0.18 + rise * 0.018);
    const line = (width: number, o: number) =>
      `<line x1="${f(x1)}" y1="${f(y1 + sh)}" x2="${f(x2)}" y2="${f(y2 + sh)}" stroke="#0b0906" stroke-width="${f(width)}" stroke-linecap="butt" opacity="${f(o)}" />`;
    clipped += line(w, op * 0.4) + line(w * 0.62, op * 0.4) + line(w * 0.3, op * 0.5);
  }
  if (clipped) {
    const id = `tc-${hex.col}-${hex.row}`;
    out += `<clipPath id="${id}"><polygon points="${top}" /></clipPath><g clip-path="url(#${id})" pointer-events="none">${clipped}</g>`;
  }
  const kind = tileKind.get(k);
  if (kind === 'water' || kind === 'high' || kind === 'plateau' || kind === 'rock') {
    const pts: string[] = [];
    for (const e of northEdges(ori)) {
      const [ax, ay] = cornerAt(cx, cy, HEX_SIZE, e.a, ori);
      const [bx, by] = cornerAt(cx, cy, HEX_SIZE, e.a + 1, ori);
      if (!pts.length) pts.push(`${f(ax)},${f(ay)}`);
      pts.push(`${f(bx)},${f(by)}`);
    }
    out += `<polyline class="tile-rim ${kind}" points="${pts.join(' ')}" />`;
  }
  return out;
}

function o2a(ori: HexOrientation): number {
  return ori === 'flat' ? 0 : -30;
}

function putTile(map: Map<string, string>, k: string, svg: string): void {
  map.set(k, (map.get(k) ?? '') + svg);
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
  sfxStep(piece, path.length);
  const destPx = unitPixelOf(dest);
  const stopPx = unitPixelOf(stop);
  const facingEl = g.querySelector('.piece-facing');
  // Lift the walking unit out of its tile group so raised tiles it passes
  // never hide it mid-step; the next render puts it back in its tile.
  g.ownerSVGElement?.appendChild(g);
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
    const px = unitPixelOf(h);
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

function ringArmorOf(piece: Piece): number {
  const s = UNIT_STATS[piece.type];
  const base = s.hexArmor ? s.armorFront : s.armor;
  return base + armorBonusOf(piece);
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

/** Soft gold bloom that follows the token silhouette (no ring). */
function pieceInspireBloomSvg(piece: Piece, pr: number, live: Piece): string {
  if (!live.inspired && !live.inspireUp) return '';
  const role = live.inspireUp && live.inspired ? 'both' : live.inspireUp ? 'source' : 'inspired';
  const hexed = UNIT_STATS[piece.type].hexArmor;
  const shape = hexed
    ? `<polygon points="${hexCorners(0, 0, pr, viewOrientation())}" />`
    : `<circle cx="0" cy="0" r="${pr.toFixed(2)}" />`;
  return `<g class="piece-inspire-bloom ${role}" aria-hidden="true">${shape}</g>`;
}

/** Status / promo chip used in the action bar and the selected-unit panel. */
function inspiredLabelHtml(kind: 'action-bar-promo' | 'ability-promo'): string {
  const title =
    'Inspired: +1 attack, +1 armor (no stacking). Lost when no longer chained to a source.';
  return `<span class="${kind} inspired" title="${escapeHtml(title)}" aria-label="inspired">${actionGlyphSvg('inspire', { className: 'inspire-chip-glyph', em: '14' })}<span>inspired</span></span>`;
}

/** Promotion tokens + current Inspired status, on the right of the unit detail header. */
function unitDetailPromosHtml(piece: Piece): string {
  const promos = [
    ...(hasUnitToken(piece, 'general') ? (['general'] as const) : []),
    ...chevronPromotionTokensOf(piece),
  ];
  const chips = promos.map((id) => {
    const label = UNIT_TOKEN_LABEL[id];
    return `<span class="ability-promo" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"><svg viewBox="-12 -12 24 24" width="18" height="18" aria-hidden="true">${unitTokenGlyphSvg(id, 16)}</svg><span>${escapeHtml(label)}</span></span>`;
  });
  if (piece.inspired) chips.push(inspiredLabelHtml('ability-promo'));
  if (!chips.length) return '';
  return `<div class="ability-promos">${chips.join('')}</div>`;
}

function pieceBodySvg(piece: Piece, pr: number): string {
  const s = UNIT_STATS[piece.type];
  const bonus = armorBonusOf(piece);
  if (!s.hexArmor) {
    return `<circle class="piece-bg" cx="0" cy="0" r="${pr}"
      fill="${pieceColor(piece.side)}" stroke="${armorColor(s.armor + bonus)}" stroke-width="2.2" />`;
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
      const fill = armorColor(s[HEX_ARMOR_SIDES[rel]] + bonus);
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
  const forestEl = app.querySelector<HTMLInputElement>('#map-forest');
  const highEl = app.querySelector<HTMLInputElement>('#map-high');
  const plateauEl = app.querySelector<HTMLInputElement>('#map-plateau');
  return {
    waterCount: waterEl ? Number(waterEl.value) : mapOpts.waterCount,
    rockCount: rockEl ? Number(rockEl.value) : mapOpts.rockCount,
    palisadeCount: palisadeEl ? Number(palisadeEl.value) : mapOpts.palisadeCount,
    forestCount: forestEl ? Number(forestEl.value) : mapOpts.forestCount,
    highCount: highEl ? Number(highEl.value) : mapOpts.highCount,
    plateauCount: plateauEl ? Number(plateauEl.value) : mapOpts.plateauCount,
  };
}

function reset(reshuffle = true) {
  startMatch(reshuffle);
}

function destroyCampaignEditor() {
  campaignEditor?.destroy();
  campaignEditor = null;
}

function destroyCampaignPlay() {
  campaignPlay?.destroy();
  campaignPlay = null;
}

function showStart() {
  destroyCampaignEditor();
  destroyCampaignPlay();
  editorPainting = false;
  briefingOpen = false;
  boardPopup = null;
  tutorialHands = null;
  tutorialDock = null;
  editorBoardHex = null;
  editorStoryHex = null;
  randomSetup = null;
  rogueRun = null;
  clearRogueShop();
  screen = 'start';
  playlist = null;
  mapPick = null;
  aiThinking = false;
  animating = false;
  clearSelection();
  render();
}

async function enterCampaignPlay() {
  destroyCampaignEditor();
  destroyCampaignPlay();
  screen = 'campaign-play';
  app.classList.remove('start-screen', 'editor-screen');
  app.innerHTML = '';
  campaignPlay = await mountCampaignPlay(app, {
    onBack: () => showStart(),
  });
}

async function enterCampaignMap() {
  destroyCampaignPlay();
  destroyCampaignEditor();
  screen = 'campaign-map';
  app.classList.remove('start-screen', 'editor-screen');
  app.innerHTML = '';
  campaignEditor = await mountCampaignEditor(app, {
    onBack: () => showStart(),
  });
}

function skirmishMaps(): SavedLevel[] {
  return levelsInCategory('skirmish', selectedPeriod);
}

function tutorialMaps(): SavedLevel[] {
  return levelsInCategory('tutorial', selectedPeriod);
}

function eraPlayLocked(period: Period = selectedPeriod): boolean {
  return eraIsWip(period) && !isEraAdmin();
}

function lockIconHtml(): string {
  return `<svg class="map-pick-lock" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="3.2" y="7.2" width="9.6" height="7.4" rx="1.4" fill="currentColor"/><path d="M5.1 7.2V5.1a2.9 2.9 0 0 1 5.8 0v2.1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
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
  if (eraPlayLocked()) return;
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
  if (eraPlayLocked()) return;
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
  rogueRun = null;
  clearRogueShop();
  randomArmies = null;
  mode = kind === 'hotseat' ? 'hotseat' : 'ai';
  playlist = null;
  screen = 'play';
  activeLevelId = id;
  setActiveLevelId(id);
  startMatch(false);
}

function startPlaylist(kind: PlaylistKind) {
  if (eraPlayLocked()) return;
  const levels = levelsInCategory(kind, selectedPeriod);
  if (!levels.length) return;
  rogueRun = null;
  clearRogueShop();
  randomArmies = null;
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
  editorStartAudio = sanitizeLevelAudio(lvl.startAudio);
  editorWinAudio = sanitizeLevelAudio(lvl.winAudio);
  editorLoseAudio = sanitizeLevelAudio(lvl.loseAudio);
  editorAudioPick = null;
  editorAudioError = '';
  editorStar2 = sanitizeStarRule(lvl.star2, DEFAULT_STAR_2);
  editorStar3 = sanitizeStarRule(lvl.star3, DEFAULT_STAR_3);
  editorHex = lvl.hexRadius > 0;
  editorRadius = editorHex ? lvl.hexRadius : Math.max(1, Math.floor(cols / 2));
  editorRectRows = editorHex ? Math.max(MIN_ROWS, editorRadius * 2) : rows;
  if (editorHex) {
    const disk = hexDisk(editorRadius, editorOrientation);
    editorHexCenter =
      disk.cols === cols && disk.rows === rows
        ? disk.center
        : { col: Math.floor((cols - 1) / 2), row: Math.floor((rows - 1) / 2) };
  } else {
    editorHexCenter = null;
  }
  editorPieces = Array.isArray(lvl.armies)
    ? clipStamps(lvl.armies, cols, rows)
    : seedArmies(cols, rows);
  editorTokens = lifted.tokens;
  if (editorHex && editorHexCenter) {
    const center = editorHexCenter;
    const on = (p: { col: number; row: number }) =>
      distance(p, center, editorOrientation) <= editorRadius;
    editorPieces = editorPieces.filter(on);
    editorTokens = editorTokens.filter(on);
  }
  editorControls = sanitizeArmyControls(lvl.armyControls);
  editorAiStyles = sanitizeAiStyles(lvl.aiStyles);
}

function confirmLeaveEditor(): boolean {
  if (screen !== 'editor' || !editorDirty || editorTerrainOnly) return true;
  return confirm('Leave without saving this level?');
}

function unitCategoryForPeriod(period: Period): UnitCategory {
  return sanitizeUnitCategory(period);
}

function ownedEditorEdge(side: Side): ArmyEdge {
  return (
    ARMY_EDGES.find((e) => editorEdgeOwner[e] === side) ?? DEFAULT_ARMY_EDGE[side]
  );
}

function syncEditorEdgesFromPieces(): void {
  const { cols, rows } = currentGrid();
  editorEdgeOwner = inferEdgeOwners(editorPieces, cols, rows);
  for (const s of SIDES) {
    if (ARMY_EDGES.some((e) => editorEdgeOwner[e] === s)) continue;
    const d = DEFAULT_ARMY_EDGE[s];
    if (editorEdgeOwner[d] === null) editorEdgeOwner[d] = s;
  }
  editorLoadEdge = ownedEditorEdge(editorArmySide);
}

function claimEditorEdge(side: Side, edge: ArmyEdge): Side | null {
  const prev = editorEdgeOwner[edge];
  for (const e of ARMY_EDGES) {
    if (editorEdgeOwner[e] === side) editorEdgeOwner[e] = null;
  }
  editorEdgeOwner[edge] = side;
  return prev && prev !== side ? prev : null;
}

function beginEditorSession(terrainOnly = false): void {
  editorTerrainOnly = terrainOnly;
  editorUnitCategory = unitCategoryForPeriod(editorPeriod);
  editorBrush = 'land';
  editorArmySide = 'red';
  syncEditorEdgesFromPieces();
  editorFormationId = STOCK_FORMATION_ID;
  editorFormationName = 'New army';
  editorPainting = false;
  clearEditorUndo();
  editorPointerAbort?.abort();
  briefingOpen = false;
  boardPopup = null;
  tutorialHands = null;
  tutorialDock = null;
  editorBoardHex = null;
  editorStoryHex = null;
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

function newEditorLevel(terrainOnly = false) {
  editorTerrain = emptyTerrain(COLS, ROWS);
  editorOrientation = 'flat';
  editorHex = false;
  editorRadius = Math.max(1, Math.floor(COLS / 2));
  editorHexCenter = null;
  editorRectRows = ROWS;
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
  editorStartAudio = '';
  editorWinAudio = '';
  editorLoseAudio = '';
  editorAudioPick = null;
  editorStar2 = { ...DEFAULT_STAR_2 };
  editorStar3 = { ...DEFAULT_STAR_3 };
  editorPieces = [];
  editorTokens = [];
  editorControls = defaultArmyControls();
  editorAiStyles = defaultAiStyles();
  editorDirty = false;
  beginEditorSession(terrainOnly);
}

/** Start-menu tool: configure terrain presets on a throwaway preview board. */
function enterTerrainPresets() {
  editorTerrainGenOpen = true;
  editorTerrainStatus = '';
  newEditorLevel(true);
}

function enterEditorFromMatch() {
  editorTerrain = cloneTerrain(state.terrain);
  editorOrientation = state.orientation;
  editorHex = state.hexRadius > 0;
  editorRadius = editorHex ? state.hexRadius : Math.max(1, Math.floor(state.cols / 2));
  editorHexCenter = editorHex && state.hexCenter ? { ...state.hexCenter } : null;
  editorRectRows = editorHex ? Math.max(MIN_ROWS, editorRadius * 2) : state.rows;
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
  editorStartAudio = '';
  editorWinAudio = '';
  editorLoseAudio = '';
  editorAudioPick = null;
  editorStar2 = { ...DEFAULT_STAR_2 };
  editorStar3 = { ...DEFAULT_STAR_3 };
  editorPieces = clipStamps(
    state.pieces.map((p) => ({
      type: p.type,
      col: p.col,
      row: p.row,
      side: p.side,
      unitTokens: p.unitTokens,
      story: p.story,
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

let rogueAdminDraft: RogueConfig | null = null;
let rogueAdminDirty = false;
let rogueRunCompletionRecorded = false;

function cloneRogueConfig(cfg: RogueConfig): RogueConfig {
  return JSON.parse(JSON.stringify(cfg)) as RogueConfig;
}

function routeHash(): string {
  try {
    return location.hash.replace(/^#/, '');
  } catch {
    return '';
  }
}

function wantsRogueAdminRoute(): boolean {
  try {
    const q = new URLSearchParams(location.search);
    return q.get('roguelite') === '1' || routeHash() === 'roguelite';
  } catch {
    return false;
  }
}

function wantsUnlocksRoute(): boolean {
  try {
    const q = new URLSearchParams(location.search);
    return q.get('unlocks') === '1' || routeHash() === 'unlocks';
  } catch {
    return false;
  }
}

function enterRogueConfig() {
  editorPainting = false;
  editorPointerAbort?.abort();
  briefingOpen = false;
  if (!rogueAdminDraft) rogueAdminDraft = cloneRogueConfig(getRogueConfig());
  screen = 'roguelite';
  clearSelection();
  aiThinking = false;
  animating = false;
  render();
}

function enterRogueUnlocks() {
  editorPainting = false;
  editorPointerAbort?.abort();
  briefingOpen = false;
  screen = 'unlocks';
  clearSelection();
  aiThinking = false;
  animating = false;
  render();
}

function syncRogueAdminForm(): HTMLElement | null {
  const root = app.querySelector<HTMLElement>('#rogue-admin');
  if (!root || !rogueAdminDraft) return root;
  rogueAdminDraft = readRogueAdminForm(root, rogueAdminDraft);
  return root;
}

function persistRogueAdminNow(): void {
  if (!rogueAdminDraft) return;
  persistRogueAdminDraft(rogueAdminDraft);
  rogueAdminDirty = false;
  const el = app.querySelector('#rogue-admin-dirty');
  if (el) el.textContent = hasRogueConfigOverride() ? 'Using a local override' : 'Shipped defaults';
}

function bindRogueEraFilter(): void {
  app.querySelectorAll<HTMLButtonElement>('[data-rogue-era]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const era = btn.dataset.rogueEra;
      if (!isRogueAdminEra(era) || era === getRogueAdminEra()) return;
      if (screen === 'roguelite') {
        syncRogueAdminForm();
        persistRogueAdminNow();
      }
      setRogueAdminEra(era);
      render();
    });
  });
}

function bindRogueConfigEvents(): void {
  bindRogueEraFilter();
  const root = app.querySelector<HTMLElement>('#rogue-admin');
  if (!root || !rogueAdminDraft) return;

  const rerenderOn = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    if (target.closest('[data-unlock-type]')) return true;
    const usedOnlyBox = target.closest('[data-rogue-used-only]');
    if (usedOnlyBox instanceof HTMLInputElement) {
      setRogueAdminUsedOnly(usedOnlyBox.checked);
      return true;
    }
    if (
      getRogueAdminUsedOnly() &&
      target.closest('[data-flag="used"], [data-flag="enabled"]')
    ) {
      return true;
    }
    return false;
  };

  const prepareEnabledToggle = (target: EventTarget | null) => {
    if (!(target instanceof HTMLInputElement) || target.dataset.flag !== 'used') return;
    const row = target.closest<HTMLElement>('tr[data-unit], tr[data-promo]');
    if (row) applyRogueRowEnabled(row, target.checked);
  };

  root.addEventListener('input', (e) => {
    prepareEnabledToggle(e.target);
    syncRogueAdminForm();
    persistRogueAdminNow();
    if (rerenderOn(e.target)) render();
  });
  root.addEventListener('change', (e) => {
    prepareEnabledToggle(e.target);
    syncRogueAdminForm();
    persistRogueAdminNow();
    if (rerenderOn(e.target)) render();
  });

  const addCondition = (name: string) => {
    if (!rogueAdminDraft || !name) return;
    const extra = { type: 'playGames' as const, count: 1 };
    if (name.startsWith('u:')) {
      const id = name.slice(2);
      const cur = rogueAdminDraft.units[id] ?? {};
      const unlock = sanitizeUnlock(cur.unlock).filter((c) => c.type !== 'always');
      rogueAdminDraft.units[id] = { ...cur, unlock: sanitizeUnlock([...unlock, extra]) };
    } else if (name.startsWith('p:')) {
      const id = name.slice(2);
      const cur = rogueAdminDraft.promotions[id] ?? {};
      const unlock = sanitizeUnlock(cur.unlock).filter((c) => c.type !== 'always');
      rogueAdminDraft.promotions[id] = { ...cur, unlock: sanitizeUnlock([...unlock, extra]) };
    }
    persistRogueAdminNow();
    render();
  };

  root.querySelectorAll<HTMLButtonElement>('[data-unlock-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      syncRogueAdminForm();
      addCondition(btn.dataset.unlockAdd ?? '');
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-unlock-del]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('[data-unlock-index]');
      if (row) row.remove();
      syncRogueAdminForm();
      persistRogueAdminNow();
      render();
    });
  });

  root.querySelector('#rogue-cfg-reset')?.addEventListener('click', () => {
    if (!confirm('Reset to the shipped roguelite.json and drop this browser’s override?')) return;
    void resetRogueAdminDraft().then((cfg) => {
      rogueAdminDraft = cloneRogueConfig(cfg);
      rogueAdminDirty = false;
      render();
    });
  });
  const jumpTo = (sel: string) => {
    const row = app.querySelector<HTMLElement>(sel);
    if (!row) return;
    row.scrollIntoView({ block: 'center' });
    row.classList.add('rogue-jump');
    window.setTimeout(() => row.classList.remove('rogue-jump'), 1600);
  };
  root.querySelectorAll<HTMLButtonElement>('[data-jump-unit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.jumpUnit;
      if (id) jumpTo(`tr[data-unit="${CSS.escape(id)}"]`);
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-jump-promo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.jumpPromo;
      if (id) jumpTo(`tr[data-promo="${CSS.escape(id)}"]`);
    });
  });
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

function clearEditorUndo() {
  editorUndoStack = [];
  editorStrokeUndoPushed = false;
}

function cloneEditorUndoSnap(): EditorUndoSnap {
  return {
    terrain: editorTerrain.map((row) => row.slice()),
    tokens: editorTokens.map((t) => ({ ...t })),
    pieces: editorPieces.map((p) => ({
      ...p,
      unitTokens: p.unitTokens ? [...p.unitTokens] : undefined,
      story: p.story ? { ...p.story } : undefined,
    })),
  };
}

function syncEditorUndoButton() {
  const btn = app.querySelector<HTMLButtonElement>('#editor-undo');
  if (btn) btn.disabled = editorUndoStack.length === 0;
}

function pushEditorUndo() {
  editorUndoStack.push(cloneEditorUndoSnap());
  if (editorUndoStack.length > EDITOR_UNDO_MAX) editorUndoStack.shift();
  syncEditorUndoButton();
}

/** First mutation in a drag stroke — one undo step for the whole stroke. */
function ensureEditorStrokeUndo() {
  if (editorStrokeUndoPushed) return;
  pushEditorUndo();
  editorStrokeUndoPushed = true;
}

function undoEditor() {
  const snap = editorUndoStack.pop();
  if (!snap) return;
  editorTerrain = snap.terrain;
  editorTokens = snap.tokens;
  editorPieces = snap.pieces;
  editorBoardHex = null;
  editorStoryHex = null;
  editorDirty = true;
  render();
}

function rotateEditorUnit(idx: number) {
  const p = editorPieces[idx];
  const next = ((facingFromStamp(p) + 1) % 6) as HexDir;
  ensureEditorStrokeUndo();
  editorPieces[idx] = {
    ...p,
    facing: sanitizeStampFacing(p.side, next),
  };
  markEditorDirty();
  refreshEditorBoard();
}

function paintEditorUnit(col: number, row: number) {
  if (!isUnitBrush(editorBrush)) return;
  const side: Affiliation = editorArmySide;
  const idx = editorPieces.findIndex((p) => p.col === col && p.row === row);
  if (
    idx >= 0 &&
    editorPieces[idx].type === editorBrush &&
    editorPieces[idx].side === side
  ) {
    rotateEditorUnit(idx);
    return;
  }
  ensureEditorStrokeUndo();
  if (idx >= 0) editorPieces.splice(idx, 1);
  editorPieces.push({
    type: editorBrush,
    col,
    row,
    side,
    unitTokens: UNIT_STATS[editorBrush].king ? ['general'] : undefined,
  });
  markEditorDirty();
  refreshEditorBoard();
}

function paintEditorToken(col: number, row: number) {
  if (!isTokenBrush(editorBrush)) return;
  if (!isWalkableTerrain(editorTerrain[row][col])) return;
  if (editorBrush === 'bridge' && editorTerrain[row][col] !== 'water') return;
  const same = editorTokens.findIndex(
    (t) => t.col === col && t.row === row && t.type === editorBrush,
  );
  if (same >= 0) return;
  ensureEditorStrokeUndo();
  editorTokens.push({ type: editorBrush, col, row });
  markEditorDirty();
  refreshEditorBoard();
}

function paintEditorNoTouch(col: number, row: number) {
  if (!isNoTouchBrush(editorBrush)) return;
  if (!isWalkableTerrain(editorTerrain[row][col])) return;
  const here = editorTokens
    .map((t, i) => ({ t, i }))
    .filter((x) => x.t.col === col && x.t.row === row);
  const has = here.some((x) => tokenIsNoTouch(x.t));
  if (!editorNoTouchStroke) editorNoTouchStroke = has ? 'remove' : 'add';
  if (editorNoTouchStroke === 'add' && has) return;
  if (editorNoTouchStroke === 'remove' && !has) return;
  ensureEditorStrokeUndo();
  if (editorNoTouchStroke === 'add') {
    editorTokens.push({ type: 'notouch', col, row });
  } else {
    for (let i = editorTokens.length - 1; i >= 0; i--) {
      const t = editorTokens[i];
      if (t.col !== col || t.row !== row) continue;
      if (t.type === 'notouch') editorTokens.splice(i, 1);
      else if (t.noTouch) {
        const next = { ...t };
        delete next.noTouch;
        editorTokens[i] = next;
      }
    }
  }
  markEditorDirty();
  refreshEditorBoard();
}

/** Peel the last promotion off a unit. One click = one chevron. */
function paintEditorClearPromotions(col: number, row: number) {
  const idx = editorPieces.findIndex((p) => p.col === col && p.row === row);
  if (idx < 0) return;
  const cur = sanitizeUnitTokens(editorPieces[idx].unitTokens);
  let drop = -1;
  for (let i = cur.length - 1; i >= 0; i--) {
    if (isPromotionToken(cur[i])) {
      drop = i;
      break;
    }
  }
  if (drop < 0) return;
  ensureEditorStrokeUndo();
  const next = [...cur.slice(0, drop), ...cur.slice(drop + 1)];
  editorPieces[idx] = {
    ...editorPieces[idx],
    unitTokens: next.length ? next : undefined,
  };
  markEditorDirty();
  refreshEditorBoard();
}

function paintEditorUnitToken(col: number, row: number, first = true) {
  if (!isUnitTokenBrush(editorBrush)) return;
  const kind = unitTokenFromBrush(editorBrush);
  const idx = editorPieces.findIndex((p) => p.col === col && p.row === row);
  if (idx < 0) return;
  if (kind === 'story') {
    if (!first) return;
    openEditorStory(col, row);
    return;
  }
  const cur = sanitizeUnitTokens(editorPieces[idx].unitTokens);
  const has = cur.includes(kind);
  const promo = isPromotionToken(kind);
  const stackable = isStackablePromotion(kind);
  const stackableCount = chevronPromotionTokensOf({ unitTokens: cur }).length;
  const kindCount = countUnitToken({ unitTokens: cur }, kind);
  if (!editorUnitTokenStroke) {
    if (stackable) {
      editorUnitTokenStroke =
        stackableCount < MAX_UNIT_PROMOTIONS ? 'add' : kindCount > 0 ? 'remove' : 'add';
    } else {
      // Status tokens and unique General: toggle on/off.
      editorUnitTokenStroke = has ? 'remove' : 'add';
    }
  }
  if (editorUnitTokenStroke === 'add') {
    if (stackable) {
      if (stackableCount >= MAX_UNIT_PROMOTIONS) return;
    } else if (promo) {
      if (has) return; // General — unique, free slot
    } else if (has) {
      return;
    }
  } else if (kindCount <= 0) {
    return;
  }
  ensureEditorStrokeUndo();
  let next: typeof cur;
  if (editorUnitTokenStroke === 'add') {
    next = [...cur, kind];
  } else if (stackable) {
    const drop = cur.lastIndexOf(kind);
    next = drop < 0 ? cur : [...cur.slice(0, drop), ...cur.slice(drop + 1)];
  } else {
    next = cur.filter((t) => t !== kind);
  }
  editorPieces[idx] = {
    ...editorPieces[idx],
    unitTokens: next.length ? next : undefined,
  };
  markEditorDirty();
  refreshEditorBoard();
}

function topTokenIndex(col: number, row: number): number {
  let forest = -1;
  let house = -1;
  let last = -1;
  for (let i = 0; i < editorTokens.length; i++) {
    const t = editorTokens[i];
    if (t.col !== col || t.row !== row) continue;
    last = i;
    if (t.type === 'forest' || t.type === 'grass') forest = i;
    else if (t.type === 'house') house = i;
  }
  if (forest >= 0) return forest;
  if (house >= 0) return house;
  return last;
}

function paintEditorErase(col: number, row: number) {
  const pidx = editorPieces.findIndex((p) => p.col === col && p.row === row);
  const tidx = topTokenIndex(col, row);
  if (pidx < 0 && tidx < 0) return;
  ensureEditorStrokeUndo();
  if (pidx >= 0) editorPieces.splice(pidx, 1);
  if (tidx >= 0) editorTokens.splice(tidx, 1);
  markEditorDirty();
  refreshEditorBoard();
}

function openEditorBoard(col: number, row: number) {
  editorBoardHex = { col, row };
  editorStoryHex = null;
  editorPainting = false;
  editorPaintKey = null;
  render();
}

function openEditorStory(col: number, row: number) {
  editorStoryHex = { col, row };
  editorBoardHex = null;
  editorPainting = false;
  editorPaintKey = null;
  render();
}

function paintEditorHex(col: number, row: number, first = true) {
  if (row < 0 || row >= editorTerrain.length) return;
  if (col < 0 || col >= editorTerrain[0].length) return;
  if (!inEditorHex(col, row)) return;
  if (editorBrush === 'erase') {
    paintEditorErase(col, row);
    return;
  }
  if (editorBrush === 'clear-promotions') {
    paintEditorClearPromotions(col, row);
    return;
  }
  if (isUnitTokenBrush(editorBrush)) {
    paintEditorUnitToken(col, row, first);
    return;
  }
  const boardTok = editorTokens.find(
    (t) => t.type === 'board' && t.col === col && t.row === row,
  );
  // Before unit brushes — otherwise a selected soldier eats the click.
  if (editorOpensBoardPopup(editorBrush, !!boardTok, first)) {
    openEditorBoard(col, row);
    return;
  }
  if (isUnitBrush(editorBrush)) {
    paintEditorUnit(col, row);
    return;
  }
  if (boardTok && editorBrush === 'board') return;
  const unitIdx = editorPieces.findIndex((p) => p.col === col && p.row === row);
  if (unitIdx >= 0) {
    if (isTokenBrush(editorBrush) && !isNoTouchBrush(editorBrush)) {
      paintEditorToken(col, row);
      if (editorBrush === 'board') openEditorBoard(col, row);
      return;
    }
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
  ensureEditorStrokeUndo();
  editorTerrain[row][col] = editorBrush;
  markEditorDirty();

  // High rims / units / tokens need a board refresh; otherwise update the hex class in place (keeps drag)
  if (
    isElevatedTerrain(prev) ||
    isElevatedTerrain(editorBrush) ||
    prev === 'water' ||
    editorBrush === 'water'
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
      startAudio: editorStartAudio,
      winAudio: editorWinAudio,
      loseAudio: editorLoseAudio,
    },
    { star2: editorStar2, star3: editorStar3 },
    editorControls,
    editorTokens,
    editorMaxTurns,
    editorAiStyles,
    editorHex ? editorRadius : 0,
  );
  editorTeaserText = saved.teaserText;
  editorStartText = saved.startText;
  editorWinText = saved.winText;
  editorLoseText = saved.loseText;
  editorStartAudio = saved.startAudio;
  editorWinAudio = saved.winAudio;
  editorLoseAudio = saved.loseAudio;
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

/** Last unit each side had selected — restored at the start of their next turn. */
const rememberedSelectId: Partial<Record<Side, string>> = {};
/** `${turnNumber}:${side}` we already ran turn-start auto-select for (avoids re-picking mid-turn). */
let autoSelectedForTurnKey: string | null = null;

function turnSelectKey(): string {
  return `${state.turnNumber}:${state.turn}`;
}

function clearSelection() {
  selectedId = null;
  pendingHex = null;
  pendingRunSelect = null;
  highlights = [];
  hoverHex = null;
  hoverPath = [];
  commitPath = [];
  rotatePreviewDir = null;
  specialMode = null;
}

function livingOnSide(side: Side) {
  return state.pieces.filter((p) => p.side === side);
}

function isSoloArmy(side: Affiliation): boolean {
  if (!isSide(side)) return false;
  return livingOnSide(side).length === 1;
}

function resetAim() {
  pendingHex = null;
  pendingRunSelect = null;
  hoverHex = null;
  hoverPath = [];
  commitPath = [];
  rotatePreviewDir = null;
}

function rememberSelect(id: string | null): void {
  if (!id) return;
  const p = getPiece(state, id);
  if (p && isSide(p.side)) rememberedSelectId[p.side] = id;
}

/** Last unit on that army stays selected when the activation / turn ends. */
function retainSelection(actingId: string): void {
  resetAim();
  rememberSelect(actingId);
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
    rememberSelect(selectedId);
    const p = getPiece(state, selectedId);
    if (p && isSoloArmy(p.side)) {
      resetAim();
      refreshHighlights();
      return;
    }
  }
  clearSelection();
}

/**
 * Turn start: solo army → select that unit.
 * Multi → restore the unit selected at the end of the previous turn,
 * preferring one with no march destination (walkTo) yet.
 * Mid-turn after an action: do not re-select for multi armies.
 */
function ensureTurnSelection(): void {
  if (selectedId && !getPiece(state, selectedId)) {
    selectedId = null;
    highlights = [];
  }
  if (state.winner || !isPlayerControlled(state, state.turn)) return;
  const mine = livingOnSide(state.turn);
  if (!mine.length) return;

  if (mine.length === 1) {
    autoSelectedForTurnKey = turnSelectKey();
    if (selectedId !== mine[0].id) {
      selectedId = mine[0].id;
      rememberSelect(selectedId);
      resetAim();
    }
    specialMode = defaultSpecialMode(mine[0]);
    refreshHighlights();
    return;
  }

  // Multi: only auto-select once when this side's turn begins.
  const key = turnSelectKey();
  if (autoSelectedForTurnKey === key) return;
  autoSelectedForTurnKey = key;

  const remembered = mine.find((p) => p.id === rememberedSelectId[state.turn]);
  if (!remembered) return;
  // Prefer a unit with no march destination; fall back to the remembered one.
  const free = mine.filter((p) => !p.walkTo);
  const pick = !remembered.walkTo ? remembered : (free[0] ?? remembered);
  selectedId = pick.id;
  rememberSelect(selectedId);
  resetAim();
  specialMode = defaultSpecialMode(pick);
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

function levelAudioFile(kind: 'start' | 'win' | 'lose'): string {
  const lvl = activeSavedLevel();
  if (!lvl) return '';
  if (kind === 'start') return sanitizeLevelAudio(lvl.startAudio);
  if (kind === 'win') return sanitizeLevelAudio(lvl.winAudio);
  return sanitizeLevelAudio(lvl.loseAudio);
}

/** Intro, victory, or lose popup that has a narration file. */
function currentPopupAudio(): { key: string; url: string } | null {
  if (screen !== 'play') return null;
  const lvl = activeSavedLevel();
  if (!lvl) return null;
  let kind: 'start' | 'win' | 'lose' | null = null;
  if (state.winner) {
    const vsEnemy = matchHasEnemies(state);
    if (vsEnemy && playerTeamWon(state)) kind = 'win';
    else if (vsEnemy && !playerTeamWon(state)) kind = 'lose';
  } else if (briefingBlocks()) {
    kind = 'start';
  }
  if (!kind) return null;
  const url = levelAudioUrl(levelAudioFile(kind));
  if (!url) return null;
  return { key: `${lvl.id}:${kind}`, url };
}

let narrationAudio: HTMLAudioElement | null = null;
/** URL last started. Closing a popup leaves this playing. */
let narrationUrl: string | null = null;
/** Popup key last rendered, so a reopened briefing can restart a finished clip. */
let narrationShownKey: string | null = null;
/** Next sync should start the current clip over (user turned narration back on). */
let narrationReplay = false;

function narrationEl(): HTMLAudioElement {
  if (!narrationAudio) {
    narrationAudio = new Audio();
    narrationAudio.preload = 'auto';
  }
  return narrationAudio;
}

function syncPopupNarration(): void {
  const spec = currentPopupAudio();
  if (!popupAudioOn) {
    narrationAudio?.pause();
    narrationReplay = false;
    narrationShownKey = spec?.key ?? null;
    return;
  }
  if (!spec) {
    narrationShownKey = null;
    narrationReplay = false;
    return;
  }
  const justOpened = narrationShownKey !== spec.key;
  narrationShownKey = spec.key;
  const el = narrationEl();
  const sameFile = narrationUrl === spec.url;
  if (sameFile && !justOpened && !narrationReplay) return;
  if (sameFile && justOpened && !narrationReplay && !el.paused && !el.ended) {
    return;
  }
  if (!sameFile) {
    narrationUrl = spec.url;
    el.src = spec.url;
  } else if (el.ended || narrationReplay) {
    try {
      el.currentTime = 0;
    } catch {
      /* metadata not in yet — src already starts at 0 */
    }
  }
  narrationReplay = false;
  void el.play().catch(() => {});
}

function speakerSvg(on: boolean): string {
  const waves = on
    ? `<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16.5 9.2a3.6 3.6 0 010 5.6M19 7a7 7 0 010 10"/>`
    : `<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16 10l5 5M21 10l-5 5"/>`;
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 9.2v5.6h4.1L12.2 19V5L7.1 9.2H3z"/>${waves}</svg>`;
}

function popupAudioButton(): string {
  if (!currentPopupAudio()) return '';
  const on = popupAudioOn;
  return `<button type="button" class="popup-audio${on ? ' on' : ''}" id="popup-audio" aria-pressed="${on ? 'true' : 'false'}" aria-label="${on ? 'Narration on' : 'Narration off'}">${speakerSvg(on)}</button>`;
}

function paintPopupAudioButton(): void {
  const btn = app.querySelector<HTMLButtonElement>('#popup-audio');
  if (!btn) return;
  btn.classList.toggle('on', popupAudioOn);
  btn.setAttribute('aria-pressed', popupAudioOn ? 'true' : 'false');
  btn.setAttribute('aria-label', popupAudioOn ? 'Narration on' : 'Narration off');
  btn.innerHTML = speakerSvg(popupAudioOn);
}

function togglePopupAudio(): void {
  const el = narrationAudio;
  const spec = currentPopupAudio();
  if (popupAudioOn && el && spec && el.paused && !el.ended) {
    void el.play().catch(() => {});
    return;
  }
  popupAudioOn = !popupAudioOn;
  persistPopupAudio();
  narrationReplay = popupAudioOn;
  syncPopupNarration();
  paintPopupAudioButton();
}

function levelStars(): { star2: StarRule; star3: StarRule } {
  const lvl = activeSavedLevel();
  return {
    star2: sanitizeStarRule(lvl?.star2, DEFAULT_STAR_2),
    star3: sanitizeStarRule(lvl?.star3, DEFAULT_STAR_3),
  };
}

function matchStarStats(): StarStats {
  const kills = playerKills(state);
  return {
    turns: state.turnNumber,
    casualties: playerHpLost(state),
    unitsLost: playerCasualties(state),
    alliesLost: allyCasualties(state),
    kills,
    flags: playerFlagCaptures(state),
    signs: signsRead(state),
    flagMax: mapFlags(state).length,
    killMax: kills + livingHostiles(state),
    signMax: signsOnMap(state),
  };
}

function playerGeneralAlive(): boolean {
  return playerSides(state).some((s) => hasGeneral(state.pieces, s));
}

function starKinds(): ['on' | 'pending' | 'off', 'on' | 'pending' | 'off', 'on' | 'pending' | 'off'] {
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
  if (rogueRun) {
    const gen = playerGeneralAlive();
    const noLoss = playerCasualties(state) === 0;
    return [
      live(won, true),
      live(won && gen, gen),
      live(won && noLoss, noLoss),
    ];
  }
  const { star2, star3 } = levelStars();
  const stats = matchStarStats();
  return [
    live(won, true),
    live(starRuleMet(star2, stats), starRulePossible(star2, stats)),
    live(starRuleMet(star3, stats), starRulePossible(star3, stats)),
  ];
}

function flagOwnerForDraw(t: TileToken): Side | undefined {
  if (t.type !== 'flag') return t.owner;
  if (screen === 'editor') {
    const u = editorPieces.find((p) => p.col === t.col && p.row === t.row);
    if (u) {
      const side = stampAffiliation(u);
      if (isSide(side)) return side;
    }
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
    return u ? stampAffiliation(u) === side : false;
  }).length;
  if (flags.length === 1) return held ? 'Flag held' : 'Capture the flag';
  return `Capture all flags (${held}/${flags.length})`;
}

function matchStarLabels(): [string, string, string] {
  if (rogueRun) {
    return [ROGUE_STAR_LABELS[0], ROGUE_STAR_LABELS[1], ROGUE_STAR_LABELS[2]];
  }
  const { star2, star3 } = levelStars();
  return [flagGoalLabel(), starRuleLabel(star2), starRuleLabel(star3)];
}

function starGoalsHtml(): string {
  const kinds = starKinds();
  const labels = matchStarLabels();
  const terrain =
    rogueRun && rogueMapTerrainName
      ? `<li class="star-goal rogue-terrain" title="Terrain of this map"><span>${escapeHtml(rogueMapTerrainName)}</span></li>`
      : '';
  return `<ul class="star-goals" aria-label="Star goals">${labels
    .map(
      (label, i) =>
        `<li class="star-goal ${kinds[i]}" title="${escapeHtml(label)}">${starGlyphSvg(kinds[i], 16)}<span>${escapeHtml(label)}</span></li>`,
    )
    .join('')}${terrain}</ul>`;
}

function packedEndStars(): { kind: 'on' | 'off'; label: string }[] {
  const kinds = starKinds();
  const labels = matchStarLabels();
  const earned: { kind: 'on'; label: string }[] = [];
  const missed: { kind: 'off'; label: string }[] = [];
  kinds.forEach((kind, i) => {
    if (kind === 'on') earned.push({ kind: 'on', label: labels[i]! });
    else missed.push({ kind: 'off', label: labels[i]! });
  });
  return [...earned, ...missed];
}

function endStarsHtml(): string {
  const packed = packedEndStars();
  const n = packed.filter((s) => s.kind === 'on').length;
  return `<ul class="end-stars" aria-label="${n} of 3 stars">${packed
    .map(
      (s) =>
        `<li class="end-star ${s.kind}" title="${escapeHtml(s.label)}">${starGlyphSvg(s.kind, 32)}</li>`,
    )
    .join('')}</ul>`;
}

/** Visual coin stack for the roguelite victory wallet. */
function rogueGoldPileHtml(count: number): string {
  const n = Math.max(0, Math.min(10, Math.floor(count)));
  if (n < 1) {
    return `<div class="rogue-gold-pile empty" aria-hidden="true"><span class="rogue-pile-coin" style="--x:0px;--y:0px;--z:0">${coinGlyphSvg(26)}</span></div>`;
  }
  const coins = Array.from({ length: n }, (_, i) => {
    const x = ((i % 3) - 1) * 7 + (i > 5 ? 2 : 0);
    const y = -Math.floor(i / 1.6) * 4;
    return `<span class="rogue-pile-coin" style="--x:${x}px;--y:${y}px;--z:${i}">${coinGlyphSvg(26)}</span>`;
  }).join('');
  return `<div class="rogue-gold-pile" aria-hidden="true">${coins}</div>`;
}

/** Star→pile reward strip on the mid-run victory shop. */
function rogueGoldRewardHtml(
  gold: number,
  starGold: number,
  wealthyGold = 0,
): string {
  const stars = Math.max(0, Math.floor(starGold));
  const wealth = Math.max(0, Math.floor(wealthyGold));
  const gain = stars + wealth;
  const total = Math.max(0, Math.floor(gold));
  const base = Math.max(0, total - gain);
  const settled = rogueGoldFxPlayed || gain < 1;
  const shown = settled ? total : base;
  const fly =
    settled
      ? ''
      : Array.from({ length: gain }, (_, i) => {
          const dx = (i - (gain - 1) / 2) * 2.35;
          return `<span class="rogue-fly-coin" data-i="${i}" style="--i:${i};--n:${gain};--dx:${dx}rem">${coinGlyphSvg(24)}</span>`;
        }).join('');
  const wealthNote =
    wealth > 0 ? `<span class="rogue-gold-wealth">+${wealth} Wealthy</span>` : '';
  return `<div class="rogue-gold-reward${settled ? ' settled' : ''}" data-base="${base}" data-gain="${gain}" data-total="${total}">
    ${rogueGoldPileHtml(shown)}
    <div class="rogue-fly-layer" aria-hidden="true">${fly}</div>
    <span class="rogue-gold-amount"><span class="rogue-gold-num">${shown}</span> gold${wealthNote}</span>
  </div>`;
}

/** Count up wallet as star coins land in the pile. */
function playRogueGoldFx() {
  const root = app.querySelector('.rogue-gold-reward:not(.settled)') as HTMLElement | null;
  if (!root || rogueGoldFxPlayed) return;
  playSfx('rogue_gold');
  rogueGoldFxPlayed = true;
  const base = Number(root.dataset.base ?? 0);
  const gain = Number(root.dataset.gain ?? 0);
  const total = Number(root.dataset.total ?? base + gain);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const paint = (n: number) => {
    const num = root.querySelector('.rogue-gold-num');
    const pile = root.querySelector('.rogue-gold-pile');
    if (num) num.textContent = String(n);
    if (pile) pile.outerHTML = rogueGoldPileHtml(n);
  };
  if (reduce || gain < 1) {
    paint(total);
    root.classList.add('settled');
    return;
  }
  // Star pop delays 0.28/0.56/0.84s + pop ~0.35s, then coin flight 0.55s.
  const landAt = (i: number) => 280 + i * 280 + 350 + 550;
  for (let i = 0; i < gain; i++) {
    window.setTimeout(() => {
      if (!root.isConnected) return;
      paint(base + i + 1);
      root.querySelector(`.rogue-fly-coin[data-i="${i}"]`)?.classList.add('landed');
      if (i === gain - 1) root.classList.add('settled');
    }, landAt(i));
  }
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
  const metrics = STAR_METRICS.map(
    (m) =>
      `<option value="${m}"${rule.metric === m ? ' selected' : ''}>${STAR_METRIC_LABEL[m]}</option>`,
  ).join('');
  return `<div class="star-rule-row">
    <span class="star-rule-mark">${starGlyphSvg('on', 15)}</span>
    <span class="star-rule-n">${n}</span>
    <select data-star="${n}" data-star-field="metric">
      ${metrics}
    </select>
    <select data-star="${n}" data-star-field="op">
      <option value="lt"${rule.op === 'lt' ? ' selected' : ''}>&lt;</option>
      <option value="lte"${rule.op === 'lte' ? ' selected' : ''}>≤</option>
      <option value="eq"${rule.op === 'eq' ? ' selected' : ''}>=</option>
      <option value="gte"${rule.op === 'gte' ? ' selected' : ''}>≥</option>
      <option value="gt"${rule.op === 'gt' ? ' selected' : ''}>&gt;</option>
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
  if (
    briefingBlocks() ||
    boardBlocks() ||
    scoutPrepBlocks() ||
    state.winner ||
    aiThinking ||
    animating
  ) {
    return false;
  }
  return isPlayerControlled(state, state.turn);
}

/** Specials filter dests. Spendable AP extras are always shown. */
function filterPlayerHighlights(piece: Piece, list: Highlight[]): Highlight[] {
  let out = list;
  const javelinOn = specialMode === 'javelin' && javelinIsSpecial(piece);
  if (javelinOn) {
    // Throws stay available, but walk/melee dests still show for non-throw tiles.
    return out.filter(
      (h) =>
        h.kind === 'shoot' ||
        h.kind === 'shoot-range' ||
        h.kind === 'move' ||
        h.kind === 'ap' ||
        h.kind === 'plus' ||
        h.kind === 'apEmpty',
    );
  }
  if (specialMode === 'charge' && hasAbility(piece, 'charge')) {
    return out.filter((h) => h.kind === 'charge');
  }
  if (specialMode === 'lunge' && hasAbility(piece, 'lunge')) {
    return out.filter((h) => h.kind === 'lunge');
  }
  if (specialMode === 'hide' && hasAbility(piece, 'hide')) {
    return out.filter(
      (h) =>
        (h.kind === 'move' || h.kind === 'ap') && isHideCover(state, h.hex),
    );
  }
  if (specialMode === 'build' && hasAbility(piece, 'build')) {
    return out.filter(
      (h) =>
        h.kind === 'build' && buildSpotMatches(state, h.hex, buildStructure),
    );
  }
  out = out.filter(
    (h) => h.kind !== 'charge' && h.kind !== 'build' && h.kind !== 'lunge',
  );
  if (javelinIsSpecial(piece)) {
    out = out.filter((h) => h.kind !== 'shoot' && h.kind !== 'shoot-range');
  }
  return out;
}

/** Unfiltered apEmpty dests for empty-AP marks (busy icons still draw in normal time). */
function restDestHighlights(pieceId: string): Highlight[] {
  const piece = getPiece(state, pieceId);
  if (!piece || hasActed(state, pieceId)) return [];
  const list =
    piece.side === state.turn &&
    canControl() &&
    (!state.scoutPieceId || state.scoutPieceId === pieceId)
      ? legalHighlights(state, pieceId)
      : rangeHighlights(state, pieceId);
  return list.filter((h) => h.kind === 'apEmpty');
}

/** Hexes that draw the empty-AP mark for this unit. */
function emptyApKeys(pieceId: string): Set<string> {
  const marks = new Set<string>();
  if (screen === 'editor' || !canControl()) return marks;
  const actor = getPiece(state, pieceId);
  if (!actor) return marks;
  const fromHeight = terrainHeight(state.terrain[actor.row]?.[actor.col] ?? 'land');
  const viewers = viewingSides(state);
  const occupied = (hex: Hex) => {
    const p = pieceAt(state, hex);
    return !!p && pieceVisible(state, p, viewers);
  };
  for (const hl of restDestHighlights(pieceId)) {
    if (hl.kind !== 'apEmpty') continue;
    const terrain = state.terrain[hl.hex.row]?.[hl.hex.col] ?? 'land';
    if (terrain === 'water' && !isBridge(state, hl.hex) && refusesWaterJump(actor)) {
      marks.add(key(hl.hex));
      continue;
    }
    const blocked =
      occupied(hl.hex) ||
      terrainHeight(terrain) > fromHeight ||
      isWall(state, hl.hex) ||
      isPalisade(state, hl.hex) ||
      isForest(state, hl.hex);
    if (blocked || !isElevatedTerrain(terrain)) marks.add(key(hl.hex));
  }
  return marks;
}

/** Visible enemy this unit can strike. Palisade and tree use the normal move tint. */
function meleeRangeHex(actor: Piece, hex: Hex): boolean {
  if (meleeDamageOf(actor) <= 0) return false;
  const occ = pieceAt(state, hex);
  if (!occ || occ.id === actor.id) return false;
  if (!pieceVisible(state, occ, viewingSides(state))) return false;
  if (isNeutralSide(occ.side)) return false;
  return !sameTeam(state, occ.side, actor.side);
}

function actingHighlights(pieceId: string): Highlight[] {
  const piece = getPiece(state, pieceId);
  if (!piece) return [];
  return filterPlayerHighlights(piece, legalHighlights(state, pieceId));
}

/** Real options on one hex: move-onto and/or fire (not empty shoot-range). */
function hexActions(
  pieceId: string,
  hex: Hex,
): { canMove: boolean; canShoot: boolean; canCharge: boolean; canLunge: boolean } {
  const legal = actingHighlights(pieceId).filter(
    (h) => eq(h.hex, hex) && h.kind !== 'shoot-range' && h.kind !== 'apEmpty',
  );
  return {
    canMove: legal.some((h) => h.kind === 'move' || h.kind === 'ap'),
    canShoot: legal.some((h) => h.kind === 'shoot'),
    canCharge: legal.some((h) => h.kind === 'charge' && !h.unpaid),
    canLunge: legal.some((h) => h.kind === 'lunge'),
  };
}

/** Base action AP (0 on free downhill) + climb/extra surcharge. */
function apCostForHighlight(piece: Piece, hl: Highlight): number {
  const downhillFree = !!(state.downhillMove && state.scoutPieceId === piece.id);
  const base = downhillFree ? 0 : 1;
  if (hl.kind === 'move' || hl.kind === 'plus' || hl.kind === 'shoot' || hl.kind === 'build') {
    return base;
  }
  if (hl.kind === 'ap') return base + 1;
  if (hl.kind === 'charge' && !hl.unpaid) return base + (hl.extra ? 1 : 0);
  return 0;
}

/** AP that the current hover / pending hex action would spend. */
function previewApSpend(piece: Piece): number {
  if (!canActWithSelected() || piece.id !== selectedId) return 0;
  const list = actingHighlights(piece.id);
  const at = hoverHex ?? pendingHex;
  if (!at) return 0;
  const hits = list.filter(
    (h) =>
      eq(h.hex, at) &&
      (h.kind === 'move' ||
        h.kind === 'ap' ||
        h.kind === 'plus' ||
        h.kind === 'shoot' ||
        h.kind === 'build' ||
        (h.kind === 'charge' && !h.unpaid)),
  );
  if (!hits.length) return 0;
  // Prefer the costly move/charge over a concurrent shoot when both are on the hex.
  const preferred =
    hits.find((h) => h.kind === 'ap') ??
    hits.find((h) => h.kind === 'charge') ??
    hits.find((h) => h.kind === 'move' || h.kind === 'plus') ??
    hits.find((h) => h.kind === 'build') ??
    hits[0]!;
  return apCostForHighlight(piece, preferred);
}

function pieceApPipsHtml(piece: Piece): string {
  return actionPointsPipsHtml({
    max: actionPointsMax(piece),
    left: actionPointsLeft(piece),
    spendCap: apSpendCap(piece),
    spentThisTurn: apSpentThisTurnOf(piece),
    previewSpend: previewApSpend(piece),
  });
}

/** Board hover only redraws the SVG — poke dock/sidebar AP bolts too. */
function paintApPips(): void {
  const piece = selectedId ? getPiece(state, selectedId) : null;
  if (!piece || actionPointsMax(piece) <= 0) return;
  const html = pieceApPipsHtml(piece);
  app.querySelectorAll('.ap-pips').forEach((el) => {
    el.outerHTML = html;
  });
}

/** Real options anywhere: move hexes, fire targets, or charge dests. */
function availableActions(pieceId: string): {
  canMove: boolean;
  canShoot: boolean;
  canCharge: boolean;
} {
  const piece = getPiece(state, pieceId);
  if (!piece) return { canMove: false, canShoot: false, canCharge: false };
  const all = highlightsFor(pieceId);
  const canMove = all.some((h) => h.kind === 'move' || h.kind === 'ap');
  const canShoot =
    !isReloading(piece) && !isDepleted(piece) && all.some((h) => h.kind === 'shoot');
  const canCharge = all.some((h) => h.kind === 'charge' && !h.unpaid);
  return { canMove, canShoot, canCharge };
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
    return actingHighlights(pieceId);
  }
  // Preview / enemy turn: same extra-move filter so gold AP dests don't
  // remount (and replay fade-in) on every AI step while you stay selected.
  return filterPlayerHighlights(piece, rangeHighlights(state, pieceId));
}

function refreshHighlights() {
  if (scoutPrep?.placingId) {
    const piece = getPiece(state, scoutPrep.placingId);
    highlights = piece
      ? scoutDeploySpots(state, piece).map((hex) => ({
          kind: 'move' as const,
          hex,
          cost: 0,
        }))
      : [];
    return;
  }
  highlights = selectedId ? highlightsFor(selectedId) : [];
}

function syncMarchSpend(pieceId: string | null, on: boolean): void {
  if (!pieceId) return;
  const piece = getPiece(state, pieceId);
  if (!piece) return;
  piece.spendMarch = on && canSpendActionPoints(piece) ? true : undefined;
}

/** Dedicated javelin kits start with throw mode on. */
function defaultSpecialMode(piece: Piece | null | undefined): AbilityId | null {
  if (!piece || !javelinIsSpecial(piece)) return null;
  return UNIT_STATS[piece.type]?.role === 'javelin' ? 'javelin' : null;
}

function selectPiece(id: string | null) {
  if (animating) return;
  const changed = selectedId !== id;
  if (changed) syncMarchSpend(selectedId, false);
  selectedId = id;
  rememberSelect(id);
  pendingHex = null;
  pendingRunSelect = null;
  hoverHex = null;
  hoverPath = [];
  commitPath = [];
  rotatePreviewDir = null;
  if (changed) {
    buildPickOpen = false;
    specialMode = defaultSpecialMode(id ? getPiece(state, id) : null);
  }
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

function remountPlayBoard(): void {
  const board = app.querySelector('svg.board');
  if (!board) {
    render();
    return;
  }
  board.outerHTML = renderBoard();
  bindBoardOnly();
}

/** Hidden units are omitted from the SVG — stamp cover broken, paint them, then pause. */
async function showBreakCover(piece: Piece): Promise<void> {
  if (pieceVisible(state, piece, viewingSides(state))) return;
  playSfx('reveal');
  revealPiece(piece);
  remountPlayBoard();
  const g = document.querySelector<SVGGElement>(
    `g.piece-unit[data-id="${CSS.escape(piece.id)}"]`,
  );
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ms = reduce ? 160 : REVEAL_MS;
  if (g && !reduce) {
    g.classList.add('revealing');
    await wait(ms);
    g.classList.remove('revealing');
  } else {
    await wait(ms);
  }
}

async function playAnimatedAction(action: Action): Promise<void> {
  animating = true;
  const turnBefore = state.turn;
  sfxAction(action, 'pieceId' in action ? getPiece(state, action.pieceId) : null, state.pieces);

  if (
    action.kind === 'move' ||
    action.kind === 'charge' ||
    action.kind === 'lunge' ||
    action.kind === 'shoot' ||
    action.kind === 'rotate' ||
    action.kind === 'build' ||
    action.kind === 'bash' ||
    action.kind === 'berserk'
  ) {
    const actor = getPiece(state, action.pieceId);
    // Cover-to-cover walks stay hidden: don't stamp cover broken, don't draw the step.
    const quiet =
      !!actor && action.kind === 'move' && quietMoveOk(state, actor, action.to, action.path);
    if (actor && !quiet) await showBreakCover(actor);
  }

  if (action.kind === 'lunge') {
    const actor = getPiece(state, action.pieceId);
    const g = actor
      ? document.querySelector<SVGGElement>(
          `g.piece-unit[data-id="${CSS.escape(actor.id)}"]`,
        )
      : null;
    if (actor && g) {
      await animateMoveAlong(g, actor, [action.to], action.to, action.to);
    } else await wait(MOVE_MS);
    state = applyAction(state, action);
    if (state.turn !== turnBefore) specialMode = null;
    applyHotseatTint();
    updateChrome();
    await playPendingFx();
    animating = false;
    return;
  }

  if (action.kind === 'berserk') {
    const actor = getPiece(state, action.pieceId);
    const g = actor
      ? document.querySelector<SVGGElement>(
          `g.piece-unit[data-id="${CSS.escape(actor.id)}"]`,
        )
      : null;
    if (actor && g) {
      const from = { col: actor.col, row: actor.row };
      for (const foe of berserkFoes(state, actor)) {
        await animateMoveAlong(g, actor, [], from, { col: foe.col, row: foe.row });
      }
    }
    state = applyAction(state, action);
    if (state.turn !== turnBefore) specialMode = null;
    applyHotseatTint();
    updateChrome();
    await playPendingFx();
    animating = false;
    return;
  }

  if (
    action.kind === 'skip' ||
    action.kind === 'rotate' ||
    action.kind === 'build' ||
    action.kind === 'bash' ||
    action.kind === 'shields' ||
    action.kind === 'inspire' ||
    action.kind === 'reload'
  ) {
    state = applyAction(state, action);
    if (state.turn !== turnBefore) specialMode = null;
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

  if (action.kind === 'move' || action.kind === 'charge') {
    const charging = action.kind === 'charge';
    const path = resolveMovePath(state, piece, action.to, action.path, charging);
    const plan = previewMove(state, piece, action.to, path, { charging });
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
        routKind: h.routKind,
        dealt: Math.max(dealt, h.routed ? 1 : 0),
        armor: victim ? armorOf(victim, h.from, state.orientation) : 0,
        ranged: false,
      };
    };
    const routByHex = new Map<string, (typeof plan.hits)[number]>();
    for (const h of plan.hits) {
      if (!h.routed) continue;
      const v = getPiece(state, h.id);
      if (v) routByHex.set(key(v), h);
    }
    const flashed = new Set<string>();
    const beforeStep = async (hex: Hex) => {
      const hit = routByHex.get(key(hex));
      if (!hit || flashed.has(hit.id)) return;
      flashed.add(hit.id);
      await flashDamaged([flashHit(hit)]);
    };
    // Kill that takes the hex: bump (melee anim) → death → then step on.
    // Survivors already bump via stop≠dest; kills used to walk straight onto the corpse.
    const destVictim = pieceAt(state, action.to);
    const occupyKill =
      !!destVictim &&
      destVictim.id !== piece.id &&
      eq(plan.stop, action.to) &&
      plan.hits.some((h) => h.id === destVictim.id && h.fatal);
    if (g) {
      if (occupyKill) {
        const approach =
          path.length >= 2 ? path[path.length - 2]! : { col: piece.col, row: piece.row };
        await animateMoveAlong(g, piece, path, approach, action.to, beforeStep);
        const killHits = plan.hits.filter((h) => h.id === destVictim.id && !flashed.has(h.id));
        for (const h of killHits) flashed.add(h.id);
        if (killHits.length) await flashDamaged(killHits.map(flashHit));
        const stepper: Piece = { ...piece, col: approach.col, row: approach.row };
        await animateMoveAlong(g, stepper, [action.to], action.to, action.to);
      } else {
        await animateMoveAlong(g, piece, path, plan.stop, action.to, beforeStep);
      }
    } else await wait(MOVE_MS);
    const rest = plan.hits.filter((h) => !flashed.has(h.id));
    if (rest.length) await flashDamaged(rest.map(flashHit));
  } else {
    await animateShot(piece, action.at);
  }

  state = applyAction(state, action);
  if (state.turn !== turnBefore) specialMode = null;
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
  const from = unitPixelOf({ col: piece.col, row: piece.row });
  const to = unitPixelOf(at);
  const stats = UNIT_STATS[piece.type];
  const arch = stats.shootArc === 'arch';
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const lift = arch ? Math.min(HEX_SIZE * 2.1, Math.max(HEX_SIZE * 0.55, dist * 0.32)) : 0;
  const ctrl = arch
    ? { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - lift }
    : null;
  const flightMs = arch ? SHOT_FLIGHT_MS + 70 : SHOT_FLIGHT_MS;
  sfxShot(piece, flightMs, (stats.splashDamage ?? 0) > 0);
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
  const shotHits: {
    id: string;
    fatal: boolean;
    routed?: boolean;
    routKind?: 'pinched' | 'panic';
    dealt: number;
    armor?: number;
    ranged?: boolean;
  }[] = [];
  for (const h of blast) {
    const { x, y } = unitPixelOf(h);
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
    const dmgAmt = hasSplash(stats)
      ? splashDamageOf(piece)
      : shootDamageOf(piece);
    if (dmgAmt <= 0) continue;
    const origin = hasSplash(stats) && !eq(h, at) ? at : fromHex;
    const net = netDamage(t, dmgAmt, 0, origin, state.orientation, true);
    const kind = routKind(state, t, origin);
    const routed = !!kind;
    const dealt = Math.min(hpLeft(t), net);
    if (dealt <= 0 && !routed) continue;
    const fatal = routed || hpLeft(t) <= net;
    shotHits.push({
      id: t.id,
      fatal,
      routed,
      routKind: kind ?? undefined,
      dealt: Math.max(dealt, routed ? 1 : 0),
      armor: armorOf(t, origin, state.orientation),
      ranged: true,
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
  return stickyMovePlan(state, piece, hex, hoverPath, specialMode === 'charge').path;
}

function committedPathTo(hex: Hex): Hex[] {
  if (commitPath.length && eq(commitPath[commitPath.length - 1], hex)) return commitPath;
  return drawnPathTo(hex);
}

function plusOnlyHex(hex: Hex): boolean {
  const marked = highlights.some((h) => h.kind === 'plus' && eq(h.hex, hex));
  if (!marked) return false;
  return !highlights.some(
    (h) =>
      (h.kind === 'move' || h.kind === 'ap' || (h.kind === 'charge' && !h.unpaid)) &&
      eq(h.hex, hex),
  );
}

/** Walk the downhill step, then the free +1, in this turn. No AP spend, no march. */
async function tryPlusStep(hex: Hex) {
  if (!canActWithSelected() || !selectedId || animating) return;
  const plan = plusStepPlan(state, selectedId, hex);
  if (!plan) return;
  const actingId = selectedId;
  pendingHex = null;
  hoverHex = null;
  hoverPath = [];
  commitPath = [];
  await playAnimatedAction({
    kind: 'move',
    pieceId: actingId,
    to: plan.landing,
    path: plan.landingPath,
  });
  const still = getPiece(state, actingId);
  if (still && state.downhillMove && state.scoutPieceId === actingId && eq(
    { col: still.col, row: still.row },
    plan.landing,
  )) {
    await playAnimatedAction({
      kind: 'move',
      pieceId: actingId,
      to: hex,
      path: plan.bonusPath,
    });
  }
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

async function tryAct(hex: Hex, kind: ActionMode) {
  if (!canActWithSelected() || !selectedId) return;

  const { canMove, canShoot, canCharge, canLunge: lungeOk } = hexActions(selectedId, hex);
  if (kind === 'move' && !canMove) return;
  if (kind === 'shoot' && !canShoot) return;
  if (kind === 'charge' && !canCharge) return;
  if (kind === 'lunge' && !lungeOk) return;

  const action: Action =
    kind === 'charge'
      ? { kind: 'charge', pieceId: selectedId, to: hex, path: committedPathTo(hex) }
      : kind === 'lunge'
        ? { kind: 'lunge', pieceId: selectedId, to: hex }
        : kind === 'move'
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

async function placeBuild(hex: Hex) {
  if (!selectedId || animating || !canControl()) return;
  if (!canBuild(state, selectedId, buildStructure)) return;
  if (!buildSpotMatches(state, hex, buildStructure)) return;
  const actingId = selectedId;
  const structure = buildStructure;
  await playAnimatedAction({
    kind: 'build',
    pieceId: actingId,
    to: hex,
    structure,
  });
  // Keep the build row open so the unit can place again while it still has AP.
  if (canBuild(state, actingId)) {
    specialMode = 'build';
    buildPickOpen = true;
    selectedId = actingId;
    hoverHex = null;
    hoverPath = [];
    commitPath = [];
    refreshHighlights();
    render();
    return;
  }
  specialMode = null;
  buildPickOpen = false;
  if (state.scoutPieceId === actingId && (state.scoutActionsLeft ?? 0) > 0) {
    selectedId = actingId;
    hoverHex = null;
    hoverPath = [];
    commitPath = [];
    refreshHighlights();
    render();
    return;
  }
  retainSelection(actingId);
  render();
  await maybeAi();
}

async function useInstantSpecial(
  kind: 'bash' | 'berserk' | 'shields' | 'inspire' | 'reload',
) {
  if (!selectedId || animating || !canControl()) return;
  const ok =
    kind === 'bash'
      ? canBash(state, selectedId)
      : kind === 'berserk'
        ? canBerserk(state, selectedId)
        : kind === 'shields'
          ? canShields(state, selectedId)
          : kind === 'inspire'
            ? canInspire(state, selectedId)
            : canReload(state, selectedId);
  if (!ok) return;
  const actingId = selectedId;
  specialMode = null;
  await playAnimatedAction({ kind, pieceId: actingId });
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
  if (rel !== 3 && !isRedFaceRay(piece, from, hex, state.orientation)) return null;
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
  specialMode = null;
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
  if (briefingBlocks() || boardBlocks() || scoutPrepBlocks() || state.winner) {
    ensureTurnSelection();
    return;
  }
  if (mode === 'hotseat' || isPlayerControlled(state, state.turn)) {
    ensureTurnSelection();
    render();
    return;
  }
  aiThinking = true;
  updateChrome();

  let guard = 0;
  // An empty side (scarecrows) used to pass once and quit. Auto walk spends
  // the player's turn on that pass and hands it straight back, so the march
  // stopped after two steps with nobody able to move.
  while (isAiControlled(state, state.turn) && !state.winner && guard < 256) {
    const action = pickAiAction(state);
    if (!action) {
      state = passTurn(state);
      specialMode = null;
      await playPendingFx();
      if (boardBlocks()) break;
      guard += 1;
      continue;
    }
    const turnBefore = state.turn;
    const scoutBefore = state.scoutPieceId;
    const actedBefore = state.actedIds.length;
    await wait(180);
    await playAnimatedAction(action);
    if (boardBlocks()) break;
    if (
      state.turn === turnBefore &&
      state.scoutPieceId === scoutBefore &&
      state.actedIds.length === actedBefore &&
      !state.winner
    ) {
      state = passTurn(state);
      specialMode = null;
      await playPendingFx();
      if (boardBlocks()) break;
      guard += 1;
      continue;
    }
    if (!isAiControlled(state, state.turn)) break;
    clearSelectionUnlessSolo();
    render();
    guard += 1;
  }

  aiThinking = false;
  ensureTurnSelection();
  render();
}

function pieceColor(side: Affiliation): string {
  return `var(--piece-${side})`;
}

function iconInk(side: Affiliation): string {
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
  const editing = screen === 'editor';
  buildLiftMap(terrainGrid, editing ? editorTokens : state.tokens, editing, ori);
  const topExtra = boardTopExtra;
  const h = PAD * 2 + extent.h + topExtra;
  const viewers = viewingSides(state);
  const seenOcc = (hex: Hex): boolean => {
    const p = pieceAt(state, hex);
    if (!p) return false;
    if (editing) return true;
    return pieceVisible(state, p, viewers);
  };

  // Dest overlay is yours-to-act only. Rebuilding it on every AI step remounts
  // AP bolts and they flash while the unit stays selected.
  // Scout prep also paints deploy spots while a scout is picked to drop.
  const allHl =
    !editing &&
    (scoutPrep?.placingId || (selectedId && canControl()))
      ? highlights
      : [];
  const moveMap = new Map<string, 'move' | 'ap' | 'charge' | 'lunge'>();
  const buildSet = new Set<string>();
  const plusMove = new Set<string>();
  const plusOnly = new Set<string>();
  const restSet = new Set<string>();
  const shootRange = new Set<string>();
  const shootTarget = new Set<string>();
  for (const hl of allHl) {
    const k = key(hl.hex);
    if (hl.kind === 'plus') plusOnly.add(k);
    if (hl.kind === 'build') buildSet.add(k);
    if (hl.kind === 'move' && hl.plus) plusMove.add(k);
    if (
      hl.kind === 'move' ||
      hl.kind === 'ap' ||
      (hl.kind === 'charge' && !hl.unpaid) ||
      hl.kind === 'lunge'
    ) {
      moveMap.set(k, hl.kind);
    } else if (hl.kind === 'shoot') shootTarget.add(k);
    else if (hl.kind === 'shoot-range') shootRange.add(k);
  }
  const actor = selectedId ? getPiece(state, selectedId) : null;
  const fromHeight = actor
    ? terrainHeight(state.terrain[actor.row]?.[actor.col] ?? 'land')
    : 0;
  if (!editing && selectedId && canControl()) {
    for (const k of emptyApKeys(selectedId)) restSet.add(k);
  }
  // Climb marks only. Same height or lower is not a climb, even on a hill.
  const restBusy = (hex: Hex) => {
    const occ = seenOcc(hex);
    const terrain = state.terrain[hex.row]?.[hex.col] ?? 'land';
    return (
      occ ||
      terrainHeight(terrain) > fromHeight ||
      (terrain === 'water' &&
        !isBridge(state, hex) &&
        !!actor &&
        refusesWaterJump(actor)) ||
      isWall(state, hex) ||
      isPalisade(state, hex) ||
      isForest(state, hex)
    );
  };

  const splashSet = new Set<string>();
  const pathSet = new Set<string>();
  let pathVia: Hex | null = null;
  let pathKind: 'move' | 'ap' | 'charge' | null = null;
  const marchSet = new Set<string>();
  let marchEnd: Hex | null = null;
  const selForMarch = !editing && selectedId ? getPiece(state, selectedId) : null;
  const marchOn =
    !!selForMarch && canControl() && selForMarch.side === state.turn;
  if (!editing && hoverHex) {
    const sel = selForMarch;
    const splashAim = highlights.some((h) => h.kind === 'shoot' && eq(h.hex, hoverHex!));
    if (sel && splashAim && hasSplash(UNIT_STATS[sel.type])) {
      const fromHex = { col: sel.col, row: sel.row };
      for (const n of splashBlast(state, hoverHex, fromHex)) {
        splashSet.add(key(n));
      }
    }
    const plusPlan =
      sel && highlights.some((h) => h.kind === 'plus' && eq(h.hex, hoverHex!))
        ? plusStepPlan(state, sel.id, hoverHex)
        : null;
    const previewMarch =
      !plusPlan &&
      specialMode !== 'build' &&
      specialMode !== 'charge' &&
      specialMode !== 'lunge' &&
      specialMode !== 'hide' &&
      marchOn &&
      sel &&
      !splashAim &&
      canOrderMarch(state, sel, hoverHex)
        ? marchRoute(state, sel, hoverHex)
        : null;
    if (plusPlan) {
      pathKind = 'move';
      hoverPath = [...plusPlan.landingPath, ...plusPlan.bonusPath];
      for (const h of hoverPath) pathSet.add(key(h));
    } else if (previewMarch?.length) {
      for (const h of previewMarch) marchSet.add(key(h));
      marchEnd = previewMarch[previewMarch.length - 1] ?? null;
    } else {
      const destHl = highlights.find(
        (h) =>
          (h.kind === 'move' || h.kind === 'ap' || (h.kind === 'charge' && !h.unpaid)) &&
          eq(h.hex, hoverHex!),
      );
      if (sel && destHl) {
        pathKind =
          destHl.kind === 'charge'
            ? 'charge'
            : destHl.kind === 'ap'
              ? 'ap'
              : 'move';
        const plan = stickyMovePlan(
          state,
          sel,
          hoverHex,
          hoverPath,
          destHl.kind === 'charge',
        );
        hoverPath = plan.path;
        pathVia = plan.via;
        for (const h of hoverPath) pathSet.add(key(h));
      }
    }
  }
  if (marchOn && selForMarch?.walkTo && !marchSet.size) {
    const committed = marchRoute(state, selForMarch, selForMarch.walkTo);
    if (committed?.length) {
      for (const h of committed) marchSet.add(key(h));
      marchEnd = committed[committed.length - 1] ?? null;
    }
  }

  type TileDraw = {
    k: string;
    x: number;
    baseY: number;
    walls: string;
    top: string;
    fx: string;
    tint: string;
  };
  const tiles: TileDraw[] = [];
  const tokensByTile = new Map<string, string>();
  const piecesByTile = new Map<string, string>();
  const houseByTile = new Map<string, string>();
  const forestByTile = new Map<string, string>();
  /** Long grass behind a unit that is not hiding in it. */
  const grassUnderByTile = new Map<string, string>();
  /** Grass tokens wait here until we know which unit (if any) stands in them. */
  const grassMarks: { tk: string; g: string; col: number; row: number }[] = [];
  let shootMarks = '';
  let rotateMarks = '';
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const hex = { col, row };
      if (editing) {
        if (!inEditorHex(col, row)) continue;
      } else if (
        state.hexRadius > 0 &&
        state.hexCenter &&
        distance(hex, state.hexCenter, ori) > state.hexRadius
      ) {
        continue;
      }
      const { x, y } = pixelOf(hex);
      const terrain = terrainGrid[row][col];
      const k = key(hex);
      let topSvg = '';
      let tintSvg = '';
      let cls = `hex ${terrain}`;
      if (terrain === 'land' && (col + row) % 2) cls += ' alt';
      if (editing) cls += ' editable';

      const pts = hexCorners(x, y, HEX_SIZE, ori);
      topSvg += `<polygon class="${cls}" data-col="${col}" data-row="${row}" points="${pts}" />`;
      if (terrain === 'high') {
        topSvg += `<polygon class="hex-high-rim" points="${hexCorners(x, y, HEX_SIZE * 0.72, ori)}" />`;
        topSvg += `<polygon class="hex-high-top" points="${hexCorners(x, y, HEX_SIZE * 0.42, ori)}" />`;
      } else if (terrain === 'plateau') {
        topSvg += `<polygon class="hex-plateau-rim" points="${hexCorners(x, y, HEX_SIZE * 0.82, ori)}" />`;
        topSvg += `<polygon class="hex-plateau-mid" points="${hexCorners(x, y, HEX_SIZE * 0.58, ori)}" />`;
        topSvg += `<polygon class="hex-plateau-top" points="${hexCorners(x, y, HEX_SIZE * 0.32, ori)}" />`;
      } else if (terrain === 'rock') {
        topSvg += `<polygon class="hex-rock-rim" points="${hexCorners(x, y, HEX_SIZE * 0.82, ori)}" />`;
        topSvg += `<polygon class="hex-rock-mid" points="${hexCorners(x, y, HEX_SIZE * 0.58, ori)}" />`;
        topSvg += `<polygon class="hex-rock-top" points="${hexCorners(x, y, HEX_SIZE * 0.32, ori)}" />`;
      }
      const meleeHex = !editing && !!actor && meleeRangeHex(actor, hex);
      const mv = moveMap.get(k);
      const enemyMelee = meleeHex && (mv === 'move' || mv === 'ap' || mv === 'charge');
      const plusTile = plusMove.has(k) || (plusOnly.has(k) && !moveMap.has(k));
      if (enemyMelee && !plusTile) tintSvg += `<polygon class="hl-tint melee" points="${pts}" />`;
      else if (plusTile) tintSvg += `<polygon class="hl-tint plus" points="${pts}" />`;
      else if (mv === 'move') tintSvg += `<polygon class="hl-tint move" points="${pts}" />`;
      else if (mv === 'ap') tintSvg += `<polygon class="hl-tint ap" points="${pts}" />`;
      else if (mv === 'charge') tintSvg += `<polygon class="hl-tint charge" points="${pts}" />`;
      else if (buildSet.has(k)) tintSvg += `<polygon class="hl-tint build" points="${pts}" />`;
      else if (restSet.has(k)) tintSvg += `<polygon class="hl-tint ap-empty" points="${pts}" />`;

      if (!enemyMelee && pathSet.has(k)) {
        const end = hoverHex && eq(hoverHex, hex);
        const via = !!(pathVia && eq(pathVia, hex) && !end);
        tintSvg += `<polygon class="hl-tint path${
          pathKind === 'ap' ? ' ap' : pathKind === 'charge' ? ' charge' : ''
        }${end ? ' path-end' : ''}${via ? ' path-via' : ''}" points="${pts}" />`;
        if (via) {
          tintSvg += `<polygon class="path-via-mark" points="${hexCorners(x, y, HEX_SIZE * 0.52, ori)}" />`;
        }
      }
      if (!enemyMelee && marchSet.has(k)) {
        const end = !!(marchEnd && eq(marchEnd, hex));
        tintSvg += `<polygon class="hl-tint path march${end ? ' path-end' : ''}" points="${pts}" />`;
      } else if (
        !meleeHex &&
        !editing &&
        state.pieces.some(
          (p) => p.side === state.turn && p.walkTo && eq(p.walkTo, hex),
        )
      ) {
        tintSvg += `<polygon class="hl-tint march-dest" points="${pts}" />`;
      }

      if (pendingHex && eq(pendingHex, hex)) {
        tintSvg += `<polygon class="hl-tint pending" points="${pts}" />`;
      }

      if (hoverHex && eq(hoverHex, hex) && rotateChoiceHex()) {
        tintSvg += `<polygon class="hl-tint red-zone" points="${pts}" />`;
        rotateMarks += hexRotateMarkSvg(x, y, col, row);
      }

      if (splashSet.has(k)) tintSvg += `<polygon class="hl-tint splash" points="${pts}" />`;

      if (shootTarget.has(k) || shootRange.has(k)) {
        const under =
          seenOcc(hex) ||
          isWall(state, hex) ||
          isPalisade(state, hex) ||
          isForest(state, hex);
        shootMarks += shootMarkSvg(x, y, shootTarget.has(k) && under);
      }
      tiles.push({
        k,
        x,
        baseY: y + liftOf(hex),
        walls: tileWallsSvg(hex, x, y, ori),
        top: topSvg,
        fx: tileTopFxSvg(hex, x, y, terrain, ori),
        tint: tintSvg,
      });
    }
  }

  let apMarks = '';
  const apMarkHexes = new Set<string>();
  // Climb bolts only — no orange icon on spendable-AP "extra" move tiles.
  if (canActWithSelected()) {
    for (const hl of allHl) {
      if (hl.kind !== 'ap' || hl.extra) continue;
      if (actor && meleeRangeHex(actor, hl.hex)) continue;
      apMarkHexes.add(key(hl.hex));
    }
    if (
      pathKind === 'ap' &&
      hoverHex &&
      !(actor && meleeRangeHex(actor, hoverHex))
    ) {
      const dest = hoverHex;
      const hoverAp = allHl.find(
        (h): h is Extract<Highlight, { kind: 'ap' }> =>
          h.kind === 'ap' && eq(h.hex, dest),
      );
      if (hoverAp && !hoverAp.extra) apMarkHexes.add(key(dest));
    }
  }
  const placeStaminaMark = (k: string, svg: (x: number, y: number, r: number) => string) => {
    const hex = parseKey(k);
    const { x, y } = surfacePixelOf(hex);
    const occ = seenOcc(hex);
    const r = HEX_SIZE * (occ ? 0.24 : 0.28);
    const dy = occ ? -HEX_SIZE * 0.46 : -HEX_SIZE * 0.06;
    apMarks += svg(x, y + dy, r);
  };
  for (const k of apMarkHexes) {
    placeStaminaMark(k, apHexMarkSvg);
  }
  // Charge past normal move: gold bolt while AP can be spent, crossed bolt once gone.
  if (specialMode === 'charge') {
    for (const hl of allHl) {
      if (hl.kind !== 'charge' || !hl.extra) continue;
      const k = key(hl.hex);
      if (hl.unpaid) {
        if (restSet.has(k)) continue;
        placeStaminaMark(k, (x, y, r) => apEmptyMarkSvg(x, y, r));
      } else if (!(actor && meleeRangeHex(actor, hl.hex))) {
        placeStaminaMark(k, apHexMarkSvg);
      }
    }
  }
  // Crossed bolts for climbs / water you can't pay — not for unpaid extra-move tiles.
  const extraEmptyKeys = new Set(
    allHl.filter((h) => h.kind === 'apEmpty' && h.extra).map((h) => key(h.hex)),
  );
  for (const k of restSet) {
    if (plusOnly.has(k) && !moveMap.has(k)) continue;
    if (extraEmptyKeys.has(k)) continue;
    const hex = parseKey(k);
    const { x, y } = surfacePixelOf(hex);
    const occ = seenOcc(hex);
    const busy = restBusy(hex);
    const r = HEX_SIZE * (occ ? 0.22 : 0.26);
    const dy = occ ? -HEX_SIZE * 0.46 : -HEX_SIZE * 0.06;
    apMarks += `<g class="need-ap-mark${busy ? '' : ' ghost'}">${apEmptyMarkSvg(x, y + dy, r, !busy)}</g>`;
  }
  const plusFont = Math.max(10, HEX_SIZE * 0.36);
  const plusLabel = new Set(plusMove);
  for (const k of plusOnly) {
    if (!moveMap.has(k)) plusLabel.add(k);
  }
  for (const k of plusLabel) {
    const hex = parseKey(k);
    const { x, y } = surfacePixelOf(hex);
    apMarks += `<text class="hl-plus-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="${plusFont.toFixed(1)}">+1</text>`;
  }

  let tutorialSvg = '';
  const drawTokens = editing ? editorTokens : state.tokens;
  const occupiedHouse = (col: number, row: number) =>
    editing
      ? editorPieces.some((p) => p.col === col && p.row === row)
      : !!pieceAt(state, { col, row });
  for (const t of drawTokens) {
    const banned = tokenIsNoTouch(t);
    if (!editing && t.type === 'notouch') continue;
    if (!editing && t.type === 'pikes' && !pikesVisible(state, t, viewers)) continue;
    if (
      !editing &&
      t.type === 'tutorial' &&
      !tutorialHands?.some((h) => h.col === t.col && h.row === t.row)
    ) {
      continue;
    }
    const tp = pixelOf({ col: t.col, row: t.row });
    const cover = structureLift(t.type);
    const x = tp.x;
    const y = tp.y - (FLAT_GLYPH_TOKENS.has(t.type) ? cover : TOKEN_LIFT);
    const owner = flagOwnerForDraw(t);
    const garrison = t.type === 'house' && occupiedHouse(t.col, t.row);
    const mark =
      t.type === 'palisade'
        ? palisadeObjectSvg(HEX_SIZE, cover, ori, t.hp)
        : t.type === 'bridge'
          ? bridgeObjectSvg(HEX_SIZE, cover, ori)
          : t.type === 'wall' ||
              t.type === 'house' ||
              t.type === 'tree' ||
              t.type === 'forest' ||
              t.type === 'grass'
            ? tokenGlyphSvg(t.type, HEX_SIZE * 0.8, ori, null, t.hp, garrison)
            : t.type === 'flag'
              ? tokenGlyphSvg('flag', HEX_SIZE * 0.86, ori, owner)
              : t.type === 'notouch'
                ? ''
                : tokenGlyphSvg(t.type, HEX_SIZE * 0.78);
    const ban = editing && banned ? noTouchMarkSvg(HEX_SIZE * 0.38) : '';
    const read = t.type === 'board' && t.read ? ' read' : '';
    const armed = !editing && t.type === 'tutorial';
    const body = armed ? `<g class="tutorial-hand">${mark}${ban}</g>` : `${mark}${ban}`;
    const g = `<g class="tile-token ${t.type}${garrison ? ' occupied' : ''}${read}${editing && banned ? ' notouch' : ''}" transform="translate(${x}, ${y})">${body}</g>`;
    const tk = key({ col: t.col, row: t.row });
    if (t.type === 'grass') grassMarks.push({ tk, g, col: t.col, row: t.row });
    else if (t.type === 'forest') putTile(forestByTile, tk, g);
    else if (t.type === 'house') putTile(houseByTile, tk, g);
    else if (!editing && t.type === 'tutorial') tutorialSvg += g;
    else putTile(tokensByTile, tk, g);
  }

  let promoSvg = '';
  const drawPieces: Piece[] = editing
    ? editorPieces.map((p) => ({
        id: `ed-${p.side}-${p.col}-${p.row}`,
        side: stampAffiliation(p),
        type: p.type,
        col: p.col,
        row: p.row,
        facing: facingFromStamp(p),
        unitTokens: p.unitTokens,
        story: p.story,
      }))
    : state.pieces.filter((p) => pieceVisible(state, p, viewers));
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
    : { ...state, pieces: drawPieces.map(aimedPiece) };
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
    const { x, y } = unitPixelOf({ col: p.col, row: p.row });
    const sel = !editing && p.id === selectedId ? ' selected' : '';
    const hexed = UNIT_STATS[p.type].hexArmor;
    const pr = HEX_SIZE * (hexed ? 0.697 : 0.581);
    const badgeR = Math.max(6.5, HEX_SIZE * 0.22);
    const emptyStamina = actionPointsMax(p) > 0 && actionPointsLeft(p) <= 0;
    // Exhausted mark: your eyes only (hotseat: current player), fixed bottom-left.
    const ownAp =
      editing || (isSide(p.side) && viewingSides(state).includes(p.side));
    const stamCx = -pr * 0.65;
    const stamCy = -pr * 0.7;
    const bottomLeft = -pr * 0.65;
    const bottomY = pr * 0.7;
    const showExhausted = !editing && emptyStamina && ownAp;
    const exhaustedIcon = showExhausted
      ? exhaustedBadgeSvg(bottomLeft, bottomY, badgeR)
      : '';
    const bottomBadgeOffset = showExhausted ? 1 : 0;
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
    // Dock actions are not piece badges. Charge / lunge are editor-only here.
    const boardAbilities = abilitiesOf(p).filter((id) => {
      if (
        id === 'hide' ||
        id === 'javelin' ||
        id === 'shields' ||
        id === 'bash' ||
        id === 'berserk' ||
        id === 'inspire'
      ) {
        return false;
      }
      if (id === 'charge' || id === 'lunge') return editing;
      return true;
    });
    const abilityIcons = boardAbilities
      .map((id, i) =>
        abilityBadgeSvg(
          id,
          bottomLeft + (bottomBadgeOffset + i) * badgeR * 1.65,
          bottomY,
          badgeR,
        ),
      )
      .join('');
    const statusMarks: Array<'hidden'> = [];
    if (!editing && isConcealed(state, p)) statusMarks.push('hidden');
    const isGeneral = hasUnitToken(p, 'general');
    const tokenMarks = unitTokensOf(p).filter(
      (id) =>
        !isPromotionToken(id) &&
        (id === 'story' ||
          (id === 'neutral' && editing) ||
          (editing && (id === 'hidden' || id === 'exhausted'))),
    );
    const hideIcons = [...tokenMarks, ...statusMarks]
      .map((id, i) => {
        const cx =
          bottomLeft + (bottomBadgeOffset + boardAbilities.length + i) * badgeR * 1.65;
        const cy = bottomY;
        return id === 'hidden'
          ? hiddenBadgeSvg(cx, cy, badgeR)
          : id === 'exhausted'
            ? exhaustedBadgeSvg(cx, cy, badgeR)
            : id === 'neutral'
              ? neutralBadgeSvg(cx, cy, badgeR)
              : storyBadgeSvg(cx, cy, badgeR);
      })
      .join('');
    const promos = chevronPromotionTokensOf(p);
    // Rank stack (Vs + optional general star) above forest/house.
    if (promos.length > 0 || isGeneral) {
      promoSvg += `<g class="piece-promos" transform="translate(${x}, ${y})">${unitRankBadgesSvg(
        promos,
        isGeneral,
        0,
        -(pr + badgeR * 0.95),
        badgeR * 1.05,
      )}</g>`;
    }
    const sleepMark = hasUnitToken(p, 'sleep')
      ? sleepZsSvg(pr * 0.5, -pr * 0.58, badgeR)
      : '';
    const maxHp = hpMax(p);
    const hpIcon =
      maxHp > 1 ? hpBadgeSvg(hpLeft(p), stamCx, stamCy, badgeR) : '';
    const shown = aimedPiece(p);
    const rot = facingRotation(shown);
    const notch = pr + 1.2;
    const selRing = hexed
      ? `<polygon class="piece-sel" points="${hexCorners(0, 0, pr + 3.2, viewOrientation())}" fill="none" stroke="var(--sel)" stroke-width="2" />`
      : `<circle class="piece-sel" cx="0" cy="0" r="${pr + 3.2}" fill="none" stroke="var(--sel)" stroke-width="2" />`;
    putTile(piecesByTile, key({ col: p.col, row: p.row }), `
      <g class="piece-unit${isReloading(p) ? ' reloading' : ''}${isDepleted(p) ? ' depleted' : ''}${!editing && p.inspired ? ' inspired' : ''}${!editing && p.inspireUp ? ' inspiring' : ''}" data-id="${p.id}" transform="translate(${x}, ${y})">
        <ellipse class="piece-contact" cx="0" cy="${(TOKEN_LIFT + pr * 0.86).toFixed(2)}" rx="${(pr * 0.82).toFixed(2)}" ry="${(pr * 0.3).toFixed(2)}" />
        ${!editing ? pieceInspireBloomSvg(shown, pr, p) : ''}
        ${sel ? selRing : ''}
        ${
          p.shieldsUp
            ? `<circle class="piece-shields" cx="0" cy="0" r="${(pr + 5.2).toFixed(1)}" fill="none" stroke="#8fd4ff" stroke-width="1.7" stroke-dasharray="2.6 1.8" />`
            : ''
        }
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
        ${reloadIcon}
        ${hpIcon}
        ${ammoIcon}
        ${actedIcon}
        ${exhaustedIcon}
        ${abilityIcons}
        ${hideIcons}
        ${sleepMark}
      </g>`);
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
      <filter id="inspire-glow" x="-120%" y="-120%" width="340%" height="340%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="tight"/>
        <feGaussianBlur in="SourceGraphic" stdDeviation="5.4" result="wide"/>
        <feMerge>
          <feMergeNode in="wide"/>
          <feMergeNode in="tight"/>
          <feMergeNode in="tight"/>
        </feMerge>
      </filter>
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

  // Back-to-front by base (un-raised) position. Each tile brings its own
  // tokens, highlights and units, so a raised tile in front hides what is behind it.
  // Long grass: a unit hiding in it is covered by the blades; any other unit stands on top.
  for (const gm of grassMarks) {
    const occ = drawPieces.find((p) => p.col === gm.col && p.row === gm.row);
    const covered = !!occ && isConcealed(editing ? dmgBoard : state, occ);
    putTile(covered ? forestByTile : grassUnderByTile, gm.tk, gm.g);
  }
  tiles.sort((a, b) => a.baseY - b.baseY || a.x - b.x);
  let tilesSvg = '';
  for (const t of tiles) {
    const take = (m: Map<string, string>) => {
      const v = m.get(t.k) ?? '';
      m.delete(t.k);
      return v;
    };
    tilesSvg += `<g class="tile">${t.walls}${t.top}${t.fx}${take(tokensByTile)}${take(grassUnderByTile)}<g class="hl-tint-layer">${t.tint}</g>${take(piecesByTile)}${take(houseByTile)}${take(forestByTile)}</g>`;
  }
  // Anything standing on a cell that was not drawn as a tile still shows.
  for (const m of [tokensByTile, grassUnderByTile, piecesByTile, houseByTile, forestByTile]) {
    for (const v of m.values()) tilesSvg += v;
  }

  return `<svg class="board" viewBox="0 ${-topExtra} ${w} ${h}" width="${w}" height="${h}">
    ${defs}
    <g class="hex-layer">${tilesSvg}</g>
    <g class="promo-layer">${promoSvg}</g>
    <g class="hex-dmg-layer">${hexDmgSvg}</g>
    <g class="shoot-mark-layer">${shootMarks}</g>
    <g class="ap-mark-layer">${apMarks}</g>
    <g class="rotate-btn-layer">${rotateMarks}</g>
    <g class="tutorial-hand-layer">${tutorialSvg}</g>
  </svg>`;
}

function dockIcon(kind: ActionGlyphId): string {
  return actionGlyphSvg(kind, { className: 'dock-ico' });
}

function dockButton(
  id: string,
  label: string,
  enabled: boolean,
  opts: {
    pressed?: boolean;
    title?: string;
    className?: string;
    icon: ActionGlyphId;
    ariaHasPopup?: string;
    ariaExpanded?: boolean;
    ariaControls?: string;
  },
): string {
  const on = !!opts.pressed;
  const cls = ['dock-btn', opts.className ?? '', on ? 'is-on' : ''].filter(Boolean).join(' ');
  const title = opts.title ? ` title="${escapeHtml(opts.title)}"` : '';
  const pressed = opts.pressed !== undefined ? ` aria-pressed="${on ? 'true' : 'false'}"` : '';
  const hasPopup = opts.ariaHasPopup
    ? ` aria-haspopup="${escapeHtml(opts.ariaHasPopup)}"`
    : '';
  const expanded =
    opts.ariaExpanded !== undefined ? ` aria-expanded="${opts.ariaExpanded ? 'true' : 'false'}"` : '';
  const controls = opts.ariaControls
    ? ` aria-controls="${escapeHtml(opts.ariaControls)}"`
    : '';
  const cue = tutorialDock?.includes(opts.icon)
    ? `<span class="dock-tutorial" aria-hidden="true"><svg class="tutorial-hand" viewBox="-8 -10 16 21" width="44" height="58">${tutorialHandSvg(18)}</svg></span>`
    : '';
  return `<span class="dock-slot">${cue}<button type="button" id="${id}" class="${cls}"${pressed}${hasPopup}${expanded}${controls}${title}${
    enabled ? '' : ' disabled'
  }>${dockIcon(opts.icon)}<span class="dock-label">${label}</span></button></span>`;
}



function setSpecialMode(mode: AbilityId | null): void {
  if (mode === 'build') {
    if (specialMode === 'build' && buildPickOpen) {
      specialMode = null;
      buildPickOpen = false;
    } else {
      specialMode = 'build';
      buildPickOpen = true;
    }
  } else {
    buildPickOpen = false;
    specialMode = specialMode === mode ? null : mode;
  }
  pendingHex = null;
  hoverHex = null;
  hoverPath = [];
  commitPath = [];
  refreshHighlights();
  render();
}

function renderActionBar(): string {
  const piece = selectedId ? getPiece(state, selectedId) : null;
  if (!piece) {
    return `<div class="action-bar idle"><span class="action-bar-hint">Select a piece</span></div>`;
  }

  const s = UNIT_STATS[piece.type];
  const { canMove, canShoot, canCharge } = availableActions(piece.id);
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
    hint = `Melee — ${meleeDamageOf(piece)} dmg (min 1); kill takes the hex`;
  } else if (state.downhillMove && state.scoutPieceId === piece.id) {
    hint = 'Downhill — free move, or another action to skip it';
  } else if (
    state.terrain[piece.row]?.[piece.col] === 'water' &&
    !isBridge(state, { col: piece.col, row: piece.row })
  ) {
    hint = canMove ? "In water — 1 hex, can't shoot" : "In water — can't shoot";
  } else if (isSleeping(piece)) {
    hint = 'Sleeping — not active';
  } else if (piece.shieldsUp) {
    hint = piece.shieldsStruck
      ? 'Shields up — revealed; no longer a ranged target'
      : 'Shields up — invisible to enemies, still aimable until first hit';
  } else if (!canMove && !canShoot && !canCharge) {
    hint = isDepleted(piece)
      ? "Empty — can't shoot"
      : isReloading(piece)
        ? canReload(state, piece.id)
          ? 'Reloading — Reload (1 AP) or move'
          : "Reloading — can't shoot"
        : 'No moves or shots';
  } else {
    hint = '';
  }

  if (
    !choosing &&
    piece.side === state.turn &&
    canControl() &&
    !(state.scoutPieceId && state.scoutPieceId !== piece.id)
  ) {
    if (piece.walkTo) {
      hint = `March ${piece.walkTo.col},${piece.walkTo.row} · another order cancels`;
    }
  }

  const extra =
    !choosing && isReloading(piece)
      ? `<span class="action-flag">reloading</span>`
      : !choosing && isDepleted(piece)
        ? `<span class="action-flag">empty</span>`
        : '';
  const promos = [
    ...(hasUnitToken(piece, 'general') ? (['general'] as const) : []),
    ...chevronPromotionTokensOf(piece),
  ];
  const inspiredChip = piece.inspired ? inspiredLabelHtml('action-bar-promo') : '';
  const promoIcons =
    promos.length || inspiredChip
      ? `<span class="action-bar-promos">${promos
          .map((id) => {
            const label = UNIT_TOKEN_LABEL[id];
            return `<span class="action-bar-promo" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"><svg viewBox="-12 -12 24 24" width="26" height="26" aria-hidden="true">${unitTokenGlyphSvg(id, 18)}</svg></span>`;
          })
          .join('')}${inspiredChip}</span>`
      : '';

  const meta = [extra, hint ? `<span class="action-bar-hint">${hint}</span>` : '']
    .filter(Boolean)
    .join('');

  const melee = meleeDamageOf(piece);
  const range = s.shoot > 0 ? shootDamageOf(piece) || s.shootDamage : 0;
  const insp = piece.inspired ? ' (incl. +1 inspired)' : '';
  const inspCls = piece.inspired ? ' inspired' : '';
  const inspMark = piece.inspired
    ? `<span class="action-bar-insp-mark" aria-hidden="true">${actionGlyphSvg('inspire', { className: 'inspire-stat-glyph', em: '12' })}</span>`
    : '';
  const meleeStat = `<span class="action-bar-dmg${inspCls}" title="Melee damage${insp}">${inspMark}Melee ${melee}</span>`;
  const shots = pieceShotPipsHtml(piece);
  const rangeStat =
    s.shoot > 0
      ? `<span class="action-bar-dmg${inspCls}" title="Ranged damage${insp}">${inspMark}Range ${range}</span>`
      : '';
  const hpNow = hpLeft(piece);
  const hpTop = hpMax(piece);

  return `
    <div class="action-bar">
      <div class="action-bar-left">
        <span class="action-bar-identity">
          <svg class="side-icon" viewBox="-10 -10 20 20" width="26" height="26" aria-hidden="true">
            <circle cx="0" cy="0" r="9.5" fill="${pieceColor(piece.side)}" stroke="${armorColor(ringArmorOf(piece))}" stroke-width="2" />
            <g fill="${iconInk(piece.side)}" color="${iconInk(piece.side)}">${pieceIconSvg(piece.type, 13)}</g>
          </svg>
          <span class="action-bar-name">${s.name}</span>
          <span class="action-bar-hp${hpTop > 5 ? ' is-many' : ''}">
            ${hpPipsHtml(hpNow, hpTop, piece.side)}
            <span class="action-bar-hp-count">${hpNow}</span>
          </span>
        </span>
        <span class="action-bar-combat">
          ${meleeStat}
          ${shots || rangeStat ? `<span class="action-bar-ranged">${shots}${rangeStat}</span>` : ''}
        </span>
      </div>
      <div class="action-bar-center">${pieceApPipsHtml(piece)}</div>
      <div class="action-bar-right">${promoIcons}</div>
      <div class="action-bar-break" aria-hidden="true"></div>
      ${meta ? `<div class="action-bar-meta">${meta}</div>` : ''}
    </div>`;
}

function dockSpecials(piece: Piece): AbilityId[] {
  return abilitiesOf(piece).filter((id) => id !== 'javelin' || javelinIsSpecial(piece));
}

function specialDockEnabled(piece: Piece, id: AbilityId): boolean {
  if (!canControl() || piece.side !== state.turn) return false;
  if (isSleeping(piece) || hasActed(state, piece.id)) return false;
  if (id === 'build') {
    return canBuild(state, piece.id, buildStructure);
  }
  if (id === 'bash') return canBash(state, piece.id);
  if (id === 'berserk') return canBerserk(state, piece.id);
  if (id === 'lunge') return canLunge(state, piece.id);
  if (id === 'shields') return canShields(state, piece.id);
  if (id === 'inspire') return canInspire(state, piece.id);
  if (id === 'charge') return legalHighlights(state, piece.id).some((h) => h.kind === 'charge');
  if (id === 'javelin') return !isReloading(piece) && !isDepleted(piece);
  return true;
}

/** End turn — floats above the unit selection bar, board bottom-right. */
function renderEndTurn(): string {
  return `<div class="play-end-cluster">${dockButton('end-turn', 'End turn', canControl(), {
    icon: 'end',
    className: 'play-end-turn',
  })}</div>`;
}

/** Specials (or stub). */
function renderUnitDock(): string {
  const piece = selectedId ? getPiece(state, selectedId) : null;
  const specials = piece ? dockSpecials(piece) : [];
  const showReload = !!(piece && isReloading(piece));
  const cols = Math.max(1, specials.length + (showReload ? 1 : 0));
  const specialBtns = specials.length
    ? specials
        .map((id) => {
          const on = specialDockEnabled(piece!, id);
          return dockButton(`special-${id}`, ABILITY_LABEL[id], on, {
            icon: id,
            pressed: specialMode === id,
            title: ABILITY_BLURB[id],
            ...(id === 'build'
              ? {
                  ariaHasPopup: 'menu',
                  ariaExpanded: buildPickOpen,
                  ariaControls: 'build-pick',
                }
              : {}),
          });
        })
        .join('')
    : showReload
      ? ''
      : dockButton('special-action', 'Special', false, { icon: 'special', title: 'No special' });
  const reloadBtn = showReload
    ? dockButton(
        'special-reload',
        'Reload',
        canReload(state, piece!.id),
        {
          icon: 'reload',
          title: 'Spend 1 AP to cut reload time by 1',
        },
      )
    : '';
  const showBuildPick =
    !!piece && buildPickOpen && specialMode === 'build' && hasAbility(piece, 'build');
  if (showBuildPick) {
    const n = BUILD_STRUCTURES.length;
    return `<div class="unit-dock-wrap">
    <div class="unit-dock build-pick" id="build-pick" role="menu" aria-label="Build structure" style="grid-template-columns: repeat(${n}, minmax(0, 1fr))">
      ${BUILD_STRUCTURES.map((s) => {
        const icon =
          s === 'pikes' ? 'trap' : s === 'palisade' ? 'palisade' : s === 'bridge' ? 'bridge' : 'remove';
        return dockButton(`build-kind-${s}`, BUILD_STRUCTURE_LABEL[s], true, {
          icon,
          pressed: buildStructure === s,
          title: BUILD_STRUCTURE_BLURB[s],
          className: 'build-kind',
        });
      }).join('')}
    </div>
  </div>`;
  }
  return `<div class="unit-dock-wrap">
    <div class="unit-dock" role="toolbar" aria-label="Unit actions" style="grid-template-columns: repeat(${cols}, minmax(0, 1fr))">
      ${specialBtns}${reloadBtn}
    </div>
  </div>`;
}

function statRow(label: string, value: string, note = '', warn = false): string {
  return `<div class="stat${warn ? ' warn' : ''}"><dt>${label}</dt><dd>${value}${
    note ? `<span class="stat-note">${note}</span>` : ''
  }</dd></div>`;
}

function renderMapParams(): string {
  const pl = playlist;
  const plLvl = playlistLevel();
  const maxT = maxTerrainCells();
  const hotseatBtn =
    mode === 'hotseat'
      ? ''
      : `<button type="button" id="start-hotseat">Start hotseat</button>`;
  const hostileMatch = participatingSides(state).some(
    (s) => state.controls[s] === 'ai-hostile',
  );
  const modeHint = matchHasEnemies(state)
    ? participatingSides(state).some((s) => state.controls[s] === 'ai-ally')
      ? hostileMatch
        ? 'vs hostile + allies'
        : 'vs AI + allies'
      : hostileMatch
        ? 'vs hostile'
        : 'vs AI'
    : participatingSides(state).filter((s) => isPlayerControlled(state, s))
          .length > 1
      ? 'Hotseat'
      : mode === 'hotseat'
        ? 'Hotseat'
        : 'vs AI';
  const playing = activeLevelId
    ? (() => {
        const l = getLevel(activeLevelId);
        return l ? levelLabel(l) : 'Level';
      })()
    : 'Random map';
  const levelSelect = pl
    ? ''
    : `<button type="button" id="open-levels">Levels</button>
        <span class="map-hint">${escapeHtml(playing)} · ${modeHint}</span>`;
  if (pl) {
    return `<div class="map-params">
        <button type="button" id="new-map">Restart level</button>
        ${hotseatBtn}
        <button type="button" id="edit-this-level">Edit level</button>
        <span class="playlist-progress">${LEVEL_CATEGORY_LABEL[pl.kind]} ${plLvl ? escapeHtml(levelLabel(plLvl)) : pl.index + 1} / ${pl.ids.length}</span>
      </div>`;
  }
  if (!activeLevelId && rogueRun) {
    const opt = (p: { id: string; name: string }) =>
      `<option value="${p.id}"${p.id === rogueTerrainId ? ' selected' : ''}>${escapeHtml(p.name)}</option>`;
    return `<div class="map-params">
        ${levelSelect}
        ${hotseatBtn}
        <label>Terrain
          <select id="rogue-terrain">
            <option value="${ROGUE_TERRAIN_AUTO}"${rogueTerrainId === ROGUE_TERRAIN_AUTO ? ' selected' : ''}>Auto (from config)</option>
            <option value=""${rogueTerrainId ? '' : ' selected'}>Classic random</option>
            ${rogueTerrainPool().map(opt).join('')}
          </select>
        </label>
        <button type="button" id="rogue-generate">Generate</button>
      </div>`;
  }
  if (!activeLevelId) {
    return `<div class="map-params">
        ${levelSelect}
        <button type="button" id="new-map">New map</button>
        ${hotseatBtn}
        <button type="button" id="edit-current-map">Edit this map</button>
        <label>Water <input type="number" id="map-water" min="0" max="${maxT}" value="${mapOpts.waterCount}" /></label>
        <label>Hill <input type="number" id="map-high" min="0" max="${maxT}" value="${mapOpts.highCount}" /></label>
        <label>Plateau <input type="number" id="map-plateau" min="0" max="${maxT}" value="${mapOpts.plateauCount}" /></label>
        <label>Mountain <input type="number" id="map-rock" min="0" max="${maxT}" value="${mapOpts.rockCount}" /></label>
        <label>Palisades <input type="number" id="map-palisade" min="0" max="${maxT}" value="${mapOpts.palisadeCount}" /></label>
        <label>Forests <input type="number" id="map-forest" min="0" max="${maxT}" value="${mapOpts.forestCount}" /></label>
      </div>`;
  }
  return `<div class="map-params">
        ${levelSelect}
        <button type="button" id="new-map">Restart level</button>
        ${hotseatBtn}
        <button type="button" id="edit-this-level">Edit level</button>
      </div>`;
}

function renderSidebar(): string {
  const piece = selectedId ? getPiece(state, selectedId) : null;
  let detail = '';

  if (piece) {
    const s = UNIT_STATS[piece.type];
    const maxAp = actionPointsMax(piece);
    const vitals = [
      statRow('HP', hpPipsHtml(hpLeft(piece), hpMax(piece), piece.side)),
      statRow(
        'Move',
        s.moveBudget > 0 ? `${s.move} (max ${s.moveBudget})` : String(s.move),
      ),
      ...(s.shoot > 0 && s.shootCooldown > 0
        ? [
            statRow(
              'Reload',
              isReloading(piece)
                ? `${piece.shootCooldown} left`
                : `${s.shootCooldown} turn${s.shootCooldown === 1 ? '' : 's'}`,
              '',
              isReloading(piece),
            ),
          ]
        : []),
      statRow('Melee DMG', String(meleeDamageOf(piece))),
      ...(s.shoot > 0
        ? [statRow('Range DMG', String(shootDamageOf(piece) || s.shootDamage))]
        : []),
      ...(maxAp > 0 ? [statRow('AP', pieceApPipsHtml(piece))] : []),
    ];

    detail = `
      <section class="ability">
        <header class="ability-head">
          <svg class="side-icon" viewBox="-10 -10 20 20" width="28" height="28" aria-hidden="true">
            <circle cx="0" cy="0" r="9.5" fill="${pieceColor(piece.side)}" stroke="${armorColor(ringArmorOf(piece))}" stroke-width="2" />
            <g fill="${iconInk(piece.side)}" color="${iconInk(piece.side)}">${pieceIconSvg(piece.type, 14)}</g>
          </svg>
          <div>
            <h3>${s.name}</h3>
          </div>
          ${unitDetailPromosHtml(piece)}
        </header>
        <dl class="stat-grid">${vitals.join('')}</dl>
      </section>`;
  }

  const log = [...state.log]
    .slice(-40)
    .reverse()
    .map((l) => `<div>${l}</div>`)
    .join('');

  return `
    <div class="sidebar has-log">
      ${renderMapParams()}
      <div class="log-block">
        <h2>Log</h2>
        <div class="log">${log}</div>
      </div>
      <div class="sidebar-rest">
        <h2>Abilities</h2>
        ${detail}
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
  const youLost = playerCasualties(state);
  const youHp = playerHpLost(state);
  const alliesLost = allyCasualties(state);
  const hasAllies = allySides(state).length > 0;
  const youBit =
    playerSides(state).length > 0
      ? `<span class="match-you">You −${youLost} unit${youLost === 1 ? '' : 's'} · ${youHp} HP${
          hasAllies ? ` · allies −${alliesLost}` : ''
        }</span>`
      : '';
  const rogueBit = rogueRun
    ? `<span class="match-rogue">${rogueBattleLabel(rogueRun)} · ${rogueRun.playerArmy.length}v${rogueRun.enemyArmy.length} · ${rogueRun.gold}g</span>`
    : '';
  return `${rogueBit}<span class="match-turn">Turn ${state.turnNumber}</span>${youBit}<span class="match-cas">${cas}</span>${flagBit}`;
}

/** Dock cue while an AI enemy/ally takes their turn. */
function renderOtherTurnBanner(): string {
  if (state.winner) return '';
  if (!playerSides(state).length) return '';
  if (isPlayerControlled(state, state.turn)) return '';
  const side = state.turn;
  const kind = allySides(state).includes(side) ? 'Ally' : 'Enemy';
  return `<div class="other-turn-banner ${side}" role="status" aria-live="polite">${kind} <span class="${side}">${SIDE_LABEL[side]}</span> turn</div>`;
}

function opposingLoser(winner: Side): Side {
  const foes = participatingSides(state).filter((s) => !sameTeam(state, s, winner));
  return foes[0] ?? SIDES.find((s) => s !== winner) ?? 'blue';
}

/** Roguelite hover resume — HP, shoot dmg, abilities (stock or live piece). */
function rogueUnitResume(type: UnitType, piece?: Piece): string {
  const s = UNIT_STATS[type];
  const hp = piece ? hpLeft(piece) : s.hp;
  const max = piece ? hpMax(piece) : s.hp;
  const parts: string[] = [max !== hp ? `HP ${hp}/${max}` : `HP ${hp}`];
  if (s.shoot > 0) {
    const dmg = piece ? shootDamageOf(piece) || s.shootDamage : s.shootDamage;
    parts.push(`Shoot dmg ${dmg}`);
  }
  const abs = piece ? abilitiesOf(piece) : s.abilities;
  parts.push(
    abs.length
      ? `Abilities: ${abs.map((id) => ABILITY_LABEL[id]).join(', ')}`
      : 'No abilities',
  );
  return parts.join(' · ');
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

  const goalBattles = rogueGoal();
  const endlessOk = getRogueConfig().globals.endlessAfterGoal;
  const rogueGoalWin =
    !!rogueRun && youWon && rogueRun.battle === goalBattles;
  const rogueEndless =
    !!rogueRun && youWon && rogueRun.battle > goalBattles;
  const rogueMid = !!rogueRun && youWon && rogueRun.battle < goalBattles;
  const rogueContinue = rogueMid || (endlessOk && (rogueGoalWin || rogueEndless));
  const title =
    rogueGoalWin
      ? 'ROGUELITE COMPLETE'
      : youWon && lastInList
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
  const living = rogueRun ? survivorTypes(state.pieces, 'red') : [];
  const lostForGood =
    rogueRun && youWon
      ? Math.max(0, rogueRun.playerArmy.length - living.length)
      : 0;
  const shop = rogueContinue ? rogueShop : null;
  const boughtNames =
    shop?.purchased.map((t) => UNIT_STATS[t].name).join(', ') ?? '';
  const rogueShopBlurb = `${
    lostForGood
      ? `${lostForGood} unit${lostForGood === 1 ? '' : 's'} lost forever. `
      : 'No permanent losses. '
  }${starKinds().filter((k) => k === 'on').length} gold from stars. Buy recruits — leftover coin carries.`;
  const stock =
    rogueGoalWin
      ? `Ten battles cleared. Your army: ${living.map((t) => UNIT_STATS[t].name).join(', ') || 'none'}. Continue for endless battles, or stop here.`
      : rogueEndless
        ? `${winHow} ${rogueBattleLabel(rogueRun!)} (endless). ${rogueShopBlurb}`
        : rogueMid
          ? `${winHow} ${rogueBattleLabel(rogueRun!)}. ${rogueShopBlurb}`
          : rogueRun && youLost
            ? `${loseHow} Run over at ${rogueBattleLabel(rogueRun)}.`
            : youWon && lastInList
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
  const nextBtn = rogueContinue
    ? `<button type="button" id="end-rogue-next">${
        rogueGoalWin ? 'Continue' : 'Next battle'
      }</button>`
    : youWon && sequential
      ? `<button type="button" id="end-next">Continue</button>`
      : youWon && inList && !lastInList
        ? `<button type="button" id="end-next">Next map</button>`
        : '';
  const rematchBtn = rogueRun
    ? youLost
      ? `<button type="button" id="end-rogue-retry">Try again</button>`
      : ''
    : inList && !(youWon && sequential)
      ? `<button type="button" id="end-rematch">Replay</button>`
      : `<button type="button" id="end-rematch" class="ghost">Replay</button>`;
  const startBtn =
    rogueRun && youLost
      ? `<button type="button" id="end-start" class="ghost">Done</button>`
      : rogueGoalWin
        ? `<button type="button" id="end-start" class="ghost">Done</button>`
        : rogueContinue
          ? `<button type="button" id="end-start" class="ghost">Abandon</button>`
          : youWon && sequential
            ? ''
            : inList
              ? `<button type="button" id="end-start" class="ghost">Start</button>`
              : `<button type="button" id="end-start">Done</button>`;

  const goldRewardHtml =
    shop && rogueRun
      ? rogueGoldRewardHtml(rogueRun.gold, shop.starGold, shop.wealthyGold)
      : '';
  const canPromo = roguePromoCandidates().length > 0;
  const shopHtml =
    shop && rogueRun
      ? `<div class="rogue-shop">
          <div class="rogue-shop-head">
            ${
              shop.purchased.length
                ? `<span class="rogue-shop-bought">Bought: ${escapeHtml(boughtNames)}</span>`
                : `<span class="rogue-shop-hint">Pick any you can afford — leftover coin carries</span>`
            }
          </div>
          <div class="rogue-unit-block">
            <div class="rogue-shop-offers">
              ${
                shop.offers.length
                  ? shop.offers
                      .map((type, i) => {
                        const s = UNIT_STATS[type];
                        const cost = rogueUnitCost(type);
                        const can = rogueRun!.gold >= cost;
                        return `<button type="button" class="rogue-offer rogue-unit${can ? '' : ' unaffordable'}" data-rogue-buy="${i}"${can ? '' : ' disabled'}>
                          <svg class="side-icon" viewBox="-10 -10 20 20" width="36" height="36" aria-hidden="true">
                            <circle cx="0" cy="0" r="9.5" fill="${pieceColor('red')}" stroke="${armorColor(s.armor)}" stroke-width="2" />
                            <g fill="${iconInk('red')}" color="${iconInk('red')}">${pieceIconSvg(type, 16)}</g>
                          </svg>
                          <span class="rogue-offer-name">${escapeHtml(s.name)}</span>
                          <span class="rogue-offer-cost">${cost}g</span>
                          <span class="rogue-unit-tip">${escapeHtml(rogueUnitResume(type))}</span>
                        </button>`;
                      })
                      .join('')
                  : `<p class="rogue-shop-empty">Shelf empty — continue when ready.</p>`
              }
            </div>
            ${
              shop.offers.length
                ? `<p class="rogue-unit-detail">Hover a recruit</p>`
                : ''
            }
          </div>
          <div class="rogue-shop-head rogue-promo-head">
            <span class="rogue-shop-hint">${
              shop.freePromoTaken
                ? `Extra promotions — ${roguePromoGold()}g each, assign to a survivor`
                : getRogueConfig().globals.firstPromoFree
                  ? `Promotions — first free, extras ${roguePromoGold()}g; assign to a survivor (keeps until death)`
                  : `Promotions — ${roguePromoGold()}g each, assign to a survivor (keeps until death)`
            }</span>
          </div>
          <div class="rogue-promo-block">
            <div class="rogue-shop-offers rogue-shop-promos">
              ${
                shop.promotions.length
                  ? shop.promotions
                      .map((promo, i) => {
                        const label = UNIT_TOKEN_LABEL[promo];
                        const blurb = PROMOTION_TOKEN_BLURB[promo].replace(
                          / Stacks as a V chevron\./,
                          '',
                        );
                        const cost = roguePromoCost(shop);
                        const canPay = canPromo && rogueRun!.gold >= cost;
                        return `<button type="button" class="rogue-offer rogue-promo ${promo}${canPay ? '' : ' unaffordable'}" data-rogue-promo="${i}"${canPay ? '' : ' disabled'}>
                          <span class="rogue-promo-glyph"><svg viewBox="-14 -14 28 28" width="40" height="40" aria-hidden="true">${unitTokenGlyphSvg(promo, 24)}</svg></span>
                          <span class="rogue-offer-name">${escapeHtml(label)}</span>
                          <span class="rogue-offer-cost">${cost ? `${cost}g` : 'free'}</span>
                          <span class="rogue-promo-tip">${escapeHtml(blurb)}</span>
                        </button>`;
                      })
                      .join('')
                  : `<p class="rogue-shop-empty">No promotions left.</p>`
              }
            </div>
            ${
              shop.promotions.length
                ? `<p class="rogue-promo-detail">Hover a promotion</p>`
                : ''
            }
          </div>
        </div>`
      : '';

  return `
    <div class="end-overlay ${tone}" role="dialog" aria-label="${title}">
      <div class="end-card ${tone} side-${winnerSide}${currentPopupAudio() ? ' has-narration' : ''}${shop ? ' has-rogue-shop' : ''}">
        <div class="end-burst" aria-hidden="true"></div>
        <svg class="end-icon" viewBox="-10 -10 20 20" width="72" height="72" aria-hidden="true">
          <circle cx="0" cy="0" r="9.5" fill="${pieceColor(winnerSide)}" />
          <g fill="${iconInk(winnerSide)}" color="${iconInk(winnerSide)}">${pieceIconSvg('general', 16)}</g>
        </svg>
        <h2 class="end-title">${title}</h2>
        ${endStarsHtml()}
        ${goldRewardHtml}
        ${endBestStarsHtml()}
        <p class="end-sub${custom ? ' level-copy' : ''}">${custom ? formatCopyHtml(custom) : sub}</p>
        ${shopHtml}
        <p class="end-stats">${matchStatsHtml()}</p>
        <div class="end-actions">
          ${nextBtn}
          ${
            youLost
              ? inList || rogueRun
                ? `${rematchBtn}${startBtn}`
                : `${rematchBtn}${startBtn}`
              : inList
                ? `${rematchBtn}${startBtn}`
                : `${startBtn}${rematchBtn}`
          }
        </div>
        ${popupAudioButton()}
      </div>
    </div>`;
}

function renderRoguePromoAssign(): string {
  if (!roguePromoAssign || !rogueShop) return '';
  const { promo } = roguePromoAssign;
  const label = UNIT_TOKEN_LABEL[promo];
  const targets = roguePromoCandidates();
  const rows = targets.length
    ? targets
        .map((p) => {
          const s = UNIT_STATS[p.type];
          const promos = promotionTokensOf(p);
          const stacked = chevronPromotionTokensOf(p);
          const slotsLeft = MAX_UNIT_PROMOTIONS - stacked.length;
          const promoList = promos.length
            ? `<span class="rogue-promo-target-promos">${promos
                .map((id) => {
                  const name = UNIT_TOKEN_LABEL[id];
                  return `<span class="rogue-promo-target-promo" title="${escapeHtml(name)}">
                    <svg viewBox="-12 -12 24 24" width="22" height="22" aria-hidden="true">${unitTokenGlyphSvg(id, 16)}</svg>
                    <span>${escapeHtml(name)}</span>
                  </span>`;
                })
                .join('')}<span class="rogue-promo-target-rank">${slotsLeft} slot${slotsLeft === 1 ? '' : 's'} free</span></span>`
            : `<span class="rogue-promo-target-rank">No promotions · ${MAX_UNIT_PROMOTIONS} slots free</span>`;
          const resume = rogueUnitResume(p.type, p);
          return `<button type="button" class="rogue-promo-target" data-rogue-promo-target="${escapeHtml(p.id)}" data-rogue-resume="${escapeHtml(resume)}">
            <svg class="side-icon" viewBox="-10 -10 20 20" width="40" height="40" aria-hidden="true">
              <circle cx="0" cy="0" r="9.5" fill="${pieceColor('red')}" stroke="${armorColor(s.armor)}" stroke-width="2" />
              <g fill="${iconInk('red')}" color="${iconInk('red')}">${pieceIconSvg(p.type, 16)}</g>
            </svg>
            <span class="rogue-promo-target-meta">
              <span class="rogue-promo-target-name">${escapeHtml(s.name)}</span>
              ${promoList}
            </span>
          </button>`;
        })
        .join('')
    : `<p class="rogue-shop-empty">No survivors with a free promotion slot.</p>`;
  return `
    <div class="end-overlay rogue-promo-overlay" role="dialog" aria-modal="true" aria-label="Assign ${escapeHtml(label)}">
      <div class="end-card briefing rogue-promo-card">
        <h2 class="end-title">Assign ${escapeHtml(label)}</h2>
        <p class="end-sub">Choose a surviving unit. The promotion stays until that unit dies.</p>
        <div class="rogue-unit-block rogue-promo-assign-block">
          <div class="rogue-promo-targets">${rows}</div>
          ${
            targets.length
              ? `<p class="rogue-unit-detail" id="rogue-assign-detail">Hover a unit</p>`
              : ''
          }
        </div>
        <div class="end-actions">
          <button type="button" id="rogue-promo-cancel" class="ghost">Cancel</button>
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
      <div class="end-card briefing${currentPopupAudio() ? ' has-narration' : ''}">
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
        ${popupAudioButton()}
      </div>
    </div>`;
}

/** Pre-battle Scout ambush popup — pinned to the lower end of the map. */
function renderScoutPrep(): string {
  if (!scoutPrepBlocks() || !scoutPrep) return '';
  const scouts = playerScoutPieces();
  const placeBtns = scouts
    .map((p) => {
      const s = UNIT_STATS[p.type];
      const on = scoutPrep!.placingId === p.id;
      const hidden = hasUnitToken(p, 'hidden');
      return `<button type="button" class="scout-prep-btn${on ? ' is-on' : ''}${hidden ? ' is-placed' : ''}" data-scout-place="${p.id}" title="${escapeHtml(hidden ? 'Already placed — click to move again' : `Place ${s.name} hidden`)}">
        <span class="scout-prep-label">Place scout</span>
        <svg class="side-icon" viewBox="-10 -10 20 20" width="22" height="22" aria-hidden="true">
          <circle cx="0" cy="0" r="9.5" fill="${pieceColor(p.side)}" stroke="${armorColor(ringArmorOf(p))}" stroke-width="2" />
          <g fill="${iconInk(p.side)}" color="${iconInk(p.side)}">${pieceIconSvg(p.type, 12)}</g>
        </svg>
      </button>`;
    })
    .join('');
  const regenBtn =
    rogueRun && scoutPrep.regenLeft > 0
      ? `<button type="button" id="scout-regen" class="scout-prep-btn scout-regen" title="Find new location">Find new location (${scoutPrep.regenLeft})</button>`
      : rogueRun
        ? `<span class="scout-prep-muted">No new locations left</span>`
        : '';
  const hint = scoutPrep.placingId
    ? 'Highlighted hexes are legal drops — click one to hide there'
    : 'Pick a Scout to place, or begin with default positions';
  return `<div class="scout-prep-popup" role="dialog" aria-label="Scout placement">
    <div class="scout-prep-card">
      <p class="scout-prep-hint">${hint}</p>
      <div class="scout-prep-actions">${placeBtns}${regenBtn}</div>
      <button type="button" id="scout-begin" class="scout-prep-begin">Begin battle</button>
    </div>
  </div>`;
}

function renderBoardPopup(): string {
  if (!boardPopup) return '';
  const title = boardPopup.title || 'Message board';
  return `
    <div class="end-overlay briefing board-overlay" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="end-card briefing board-card">
        <h2 class="end-title">${escapeHtml(title)}</h2>
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
          <p class="muted board-hint">Wrap a name in [brackets] for its icon. [tutorial] drops bouncing hands on Tutorial tokens after this closes. [rest] in that message also points one at the Rest button.</p>
        </label>
        <div class="end-actions">
          <button type="button" id="board-save">Save</button>
          <button type="button" id="board-delete" class="ghost">Delete</button>
          <button type="button" id="board-cancel" class="ghost">Cancel</button>
        </div>
      </div>
    </div>`;
}

function armTutorialHands(text: string): void {
  if (!copyMentionsTutorial(text)) return;
  const spots = state.tokens
    .filter((t) => t.type === 'tutorial')
    .map((t) => ({ col: t.col, row: t.row }));
  tutorialHands = spots.length ? spots : null;
  const dock = copyMentionedActions(text);
  tutorialDock = dock.length ? dock : null;
}

function clearTutorialCue(): void {
  if (!tutorialHands && !tutorialDock) return;
  tutorialHands = null;
  tutorialDock = null;
  queueMicrotask(() => render());
}

function closeBoardPopup() {
  const text = boardPopup?.text ?? '';
  boardPopup = null;
  armTutorialHands(text);
  void (async () => {
    render();
    await maybeAi();
  })();
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
  const savedText = idx >= 0 ? sanitizeBoardText(editorTokens[idx].text) : '';
  app.querySelector('#board-cancel')?.addEventListener('click', () => {
    if (!hadText) removeEditorBoard(hex);
    closeEditorBoard();
  });
  app.querySelector('#board-delete')?.addEventListener('click', () => {
    if (idx >= 0) {
      pushEditorUndo();
      removeEditorBoard(hex);
    }
    closeEditorBoard();
  });
  app.querySelector('#board-save')?.addEventListener('click', () => {
    const text = sanitizeBoardText(box?.value ?? '');
    if (!text) {
      if (idx >= 0) {
        if (hadText) pushEditorUndo();
        removeEditorBoard(hex);
      }
      closeEditorBoard();
      return;
    }
    if (idx >= 0 && text !== savedText) {
      pushEditorUndo();
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

function renderEditorStoryPopup(): string {
  if (!editorStoryHex) return '';
  const piece = editorPieces.find(
    (p) => p.col === editorStoryHex!.col && p.row === editorStoryHex!.row,
  );
  if (!piece) return '';
  const story = sanitizeStory(piece.story);
  const when = story?.when ?? 'kill';
  return `
    <div class="end-overlay briefing board-overlay" role="dialog" aria-modal="true" aria-label="Edit story">
      <div class="end-card briefing board-card">
        <h2 class="end-title">Story</h2>
        <label class="board-edit">
          <span class="sr-only">Message</span>
          <textarea id="story-text" maxlength="${BOARD_TEXT_MAX}" rows="6" placeholder="[hoplite] and [pikes] become icons">${escapeHtml(story?.text ?? '')}</textarea>
          <p class="muted board-hint">Wrap a name in [brackets] for its icon. [tutorial] drops bouncing hands on Tutorial tokens after this closes. [rest] in that message also points one at the Rest button. Leave the message empty to remove the token.</p>
        </label>
        <label class="board-edit">
          <span class="board-when-label">When</span>
          <select id="story-when">
            <option value="kill"${when === 'kill' ? ' selected' : ''}>On kill</option>
            <option value="touch"${when === 'touch' ? ' selected' : ''}>On touch</option>
          </select>
        </label>
        <div class="end-actions">
          <button type="button" id="story-save">Save</button>
          <button type="button" id="story-cancel" class="ghost">Cancel</button>
        </div>
      </div>
    </div>`;
}

function closeEditorStory() {
  editorStoryHex = null;
  render();
}

function bindEditorStoryPopup() {
  const box = app.querySelector<HTMLTextAreaElement>('#story-text');
  const whenEl = app.querySelector<HTMLSelectElement>('#story-when');
  const hex = editorStoryHex;
  if (!hex) return;
  const idx = editorPieces.findIndex((p) => p.col === hex.col && p.row === hex.row);
  app.querySelector('#story-cancel')?.addEventListener('click', () => closeEditorStory());
  app.querySelector('#story-save')?.addEventListener('click', () => {
    if (idx < 0) {
      closeEditorStory();
      return;
    }
    const text = sanitizeBoardText(box?.value ?? '');
    const when = whenEl?.value === 'touch' ? 'touch' : 'kill';
    const cur = editorPieces[idx];
    const tokens = sanitizeUnitTokens(cur.unitTokens).filter((t) => t !== 'story');
    if (!text) {
      const next = { ...cur, unitTokens: tokens.length ? tokens : undefined };
      delete next.story;
      editorPieces[idx] = next;
    } else {
      editorPieces[idx] = {
        ...cur,
        unitTokens: sanitizeUnitTokens([...tokens, 'story']),
        story: { text, when },
      };
    }
    markEditorDirty();
    closeEditorStory();
  });
  box?.addEventListener('focus', () => {
    editorCopyFieldId = 'story-text';
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
  const goals = app.querySelector('.star-goals');
  if (goals) goals.outerHTML = starGoalsHtml();
  const slot = app.querySelector('.turns-left-slot');
  if (slot) slot.innerHTML = turnsLeftHtml();
  const dock = app.querySelector('.play-dock');
  if (dock) {
    const next = renderOtherTurnBanner();
    const cur = dock.querySelector('.other-turn-banner');
    if (next) {
      if (cur) cur.outerHTML = next;
      else dock.insertAdjacentHTML('afterbegin', next);
    } else if (cur) {
      cur.remove();
    }
  }
}

function choicePending(): boolean {
  if (!pendingHex || !selectedId || !canActWithSelected()) return false;
  if (pendingRunSelect) return true;
  const { canMove, canShoot } = hexActions(selectedId, pendingHex);
  return !!(canMove && canShoot);
}

function renderHexChoice(): string {
  if (!choicePending() || !pendingHex || !selectedId) return '';
  if (pendingRunSelect) {
    return `<div class="hex-choice">
      <button type="button" data-run-select="run">Run</button>
      <button type="button" data-run-select="select">Select</button>
    </div>`;
  }
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
  pop.querySelectorAll<HTMLButtonElement>('[data-run-select]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const choice = btn.dataset.runSelect;
      const pending = pendingRunSelect;
      pendingRunSelect = null;
      pendingHex = null;
      if (!pending) return;
      if (choice === 'select') {
        selectPiece(pending.selectId);
        return;
      }
      void commitRotate(pending.dir);
    });
  });
}

function trySetMarch(piece: Piece, hex: Hex): boolean {
  if (!canControl() || state.winner) return false;
  // Charge / build / lunge / hide own the board. Javelin throw does not block marches.
  if (
    specialMode === 'charge' ||
    specialMode === 'build' ||
    specialMode === 'lunge' ||
    specialMode === 'hide'
  ) {
    return false;
  }
  if (piece.side !== state.turn || isSleeping(piece)) return false;
  if (UNIT_STATS[piece.type].move <= 0) return false;
  if (state.scoutPieceId && state.scoutPieceId !== piece.id) return false;
  // The armed second action is a normal move or shot, not another march order.
  if (piece.movedThisTurn || hasActed(state, piece.id)) return false;
  if (eq(hex, { col: piece.col, row: piece.row })) return false;
  // In-range moves (including spendable AP extras) are actions — not march orders.
  // Re-clicking the destination does not cancel; give another order instead.
  if (!canOrderMarch(state, piece, hex)) return false;
  const acting = canActWithSelected() && selectedId === piece.id;
  playSfx('march_order');
  void commitMarch(piece.id, hex, acting);
  return true;
}

async function commitMarch(pieceId: string, dest: Hex | null, stepNow: boolean): Promise<void> {
  if (animating) return;
  animating = true;
  const turnBefore = state.turn;
  let next = setWalkOrder(state, pieceId, dest);
  if (dest && stepNow) next = performMarch(next, pieceId);
  state = next;
  if (state.turn !== turnBefore) specialMode = null;
  hoverHex = null;
  hoverPath = [];
  commitPath = [];
  pendingHex = null;
  await playPendingFx();
  animating = false;
  const still = getPiece(state, pieceId);
  if (still && still.side === state.turn && canControl()) {
    selectedId = pieceId;
    refreshHighlights();
  } else {
    retainSelection(pieceId);
  }
  ensureTurnSelection();
  render();
  if (dest) await maybeAi();
}

function onHexClick(col: number, row: number) {
  if (briefingBlocks() || boardBlocks() || animating || aiThinking) return;
  clearTutorialCue();
  const hex = { col, row };
  if (scoutPrepBlocks()) {
    if (scoutPrep?.placingId) commitScoutPlace(hex);
    return;
  }
  const rawOcc = state.pieces.find((p) => p.col === col && p.row === row);
  const occ =
    rawOcc && pieceVisible(state, rawOcc, viewingSides(state)) ? rawOcc : undefined;

  // Own piece selected + can act → resolve by what that hex allows
  if (canActWithSelected() && selectedId) {
    const piece = getPiece(state, selectedId);
    if (
      piece &&
      specialMode === 'build' &&
      highlights.some((h) => h.kind === 'build' && eq(h.hex, hex))
    ) {
      void placeBuild(hex);
      return;
    }
    if (piece && plusOnlyHex(hex)) {
      void tryPlusStep(hex);
      return;
    }
    const { canMove, canShoot, canCharge, canLunge: lungeOk } = hexActions(
      selectedId,
      hex,
    );
    if (!canMove && !canShoot && !canCharge && !lungeOk && piece) {
      const dir = redZoneDir(piece, hex);
      if (dir != null) {
        if (occ && occ.id !== piece.id) {
          // Occupied red-face: Run (turn) or Select the unit there.
          pendingHex = hex;
          pendingRunSelect = { dir, selectId: occ.id };
          render();
          return;
        }
        void commitRotate(dir);
        return;
      }
    }
    if (lungeOk && (specialMode === 'lunge' || !canMove && !canShoot && !canCharge)) {
      void tryAct(hex, 'lunge');
      return;
    }
    if (canCharge) {
      commitPath = drawnPathTo(hex);
      void tryAct(hex, 'charge');
      return;
    }
    if (specialMode === 'javelin' && canShoot) {
      void tryAct(hex, 'shoot');
      return;
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
      if (piece && trySetMarch(piece, hex)) return;
      commitPath = drawnPathTo(hex);
      void tryAct(hex, 'move');
      return;
    }
  }

  if (selectedId) {
    const piece = getPiece(state, selectedId);
    if (piece && trySetMarch(piece, hex)) return;
  }

  if (occ) {
    const skipApForOther =
      canControl() &&
      !!state.scoutPieceId &&
      (state.scoutActionsLeft ?? 0) > 0 &&
      occ.id !== state.scoutPieceId &&
      occ.side === state.turn;
    if (skipApForOther) {
      void skipScout(occ.id);
      return;
    }
    if (occ.id !== selectedId) playSfx('unit_select');
    selectPiece(occ.id);
    return;
  }

  const board = tokenOnHex(state.tokens, hex, 'board');
  if (board?.read && board.text) {
    playSfx('board_message_open');
    boardPopup = { text: board.text };
    render();
    return;
  }

  // Shoot-range / preview tints are not actions — keep the piece selected
  if (selectedId && highlights.some((h) => eq(h.hex, hex))) {
    playSfx('invalid_move');
    return;
  }

  // Empty-AP mark: the move needs action points. Keep this unit selected.
  if (selectedId && emptyApKeys(selectedId).has(key(hex))) {
    playSfx('ap_empty');
    return;
  }

  if (selectedId) playSfx('unit_deselect');
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
  if (editorTerrainOnly) return; // preview only: the board is not paintable
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
    editorStrokeUndoPushed = false;
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
  const px = pt.x - PAD;
  const py = pt.y - PAD;
  const ori = grid.orientation;
  const inGrid = (h: Hex) =>
    h.col >= 0 && h.row >= 0 && h.col < grid.cols && h.row < grid.rows;
  const ground = pixelToHex(px, py, HEX_SIZE, ori);
  if (boardTopExtra > 0 || liftMap.size) {
    // Raised tiles: test the visible shapes (top + south walls), front-most first.
    const cands = hexesWithin(ground, 2, ori)
      .filter((h) => inGrid(h) && liftMap.has(key(h)))
      .map((h) => ({ h, base: hexToPixel(h, HEX_SIZE, ori) }))
      .sort((a, b) => b.base.y - a.base.y || b.base.x - a.base.x);
    for (const { h, base } of cands) {
      const lift = liftOf(h);
      const cx = base.x;
      const cy = base.y - lift;
      const top: [number, number][] = [];
      for (let i = 0; i < 6; i++) top.push(cornerAt(cx, cy, HEX_SIZE, i, ori));
      if (pointInPolygon(px, py, top)) return h;
      for (const e of southEdges(h, ori)) {
        const drop = lift - (liftMap.get(key(e.nb)) ?? 0);
        if (drop < 0.5) continue;
        const a = top[e.a];
        const b = top[(e.a + 1) % 6];
        if (
          pointInPolygon(px, py, [
            a,
            b,
            [b[0], b[1] + drop],
            [a[0], a[1] + drop],
          ])
        ) {
          return h;
        }
      }
    }
  }
  return inGrid(ground) ? ground : null;
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
      clearTutorialCue();
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
      (h) =>
        (h.kind === 'move' ||
          h.kind === 'ap' ||
          h.kind === 'charge' ||
          h.kind === 'plus' ||
          h.kind === 'build') &&
        eq(h.hex, hex),
    );
    const shootHover = highlights.some((h) => h.kind === 'shoot' && eq(h.hex, hex));
    const splashHover =
      !!sel &&
      hasSplash(UNIT_STATS[sel.type]) &&
      shootHover;
    const zoneHover = !!sel && redZoneDir(sel, hex) != null;
    const marchHover =
      specialMode !== 'build' &&
      specialMode !== 'charge' &&
      specialMode !== 'lunge' &&
      specialMode !== 'hide' &&
      !!sel &&
      canControl() &&
      sel.side === state.turn &&
      canOrderMarch(state, sel, hex);
    paintBoardHover(
      moveHover || shootHover || splashHover || zoneHover || marchHover ? hex : null,
    );
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
      (h) =>
        (h.kind === 'move' || h.kind === 'ap' || h.kind === 'charge' || h.kind === 'plus') &&
        eq(h.hex, next),
    )
  );
  rotatePreviewDir = sel && next && !moveHover ? redZoneDir(sel, next) : null;
  const board = app.querySelector('svg.board');
  if (board) {
    board.outerHTML = renderBoard();
    bindBoardOnly();
    placeHexChoice();
  }
  paintApPips();
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

function renderAccountLine(): string {
  const signed = getAccountUser();
  if (signed) {
    const profile = signed.profileUrl
      ? `<a href="${escapeHtml(signed.profileUrl)}">profile</a>`
      : 'profile';
    const logout = signed.logoutUrl
      ? ` · <a href="${escapeHtml(signed.logoutUrl)}">log out</a>`
      : '';
    const err = getAccountStatus() === 'err' ? ' · could not reach WordPress' : '';
    return `<p class="start-account">Signed in as ${escapeHtml(signed.name)} · progress on your ${profile}${logout}${err}</p>`;
  }
  const login = getAccountLoginUrl();
  if (!login) return '';
  const register = getAccountRegisterUrl();
  const reg = register
    ? ` or <a href="${escapeHtml(register)}">create an account</a>`
    : '';
  return `<p class="start-account">Progress is saved in this browser. <a href="${escapeHtml(login)}">Log in</a>${reg} to keep it on your profile.</p>`;
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
  return screen === 'levels' || screen === 'editor' || screen === 'units' || screen === 'ai' || screen === 'roguelite' || screen === 'unlocks';
}

function renderToolbar(): string {
  const terrainOnly = screen === 'editor' && editorTerrainOnly;
  const editorNav = inEditorSection() && !terrainOnly
    ? `<nav class="editor-nav" aria-label="Levels, units, AI, roguelite, and unlocks">
        <button type="button" id="editor-nav-levels" class="${screen === 'levels' || screen === 'editor' ? 'active' : ''}">Levels</button>
        <button type="button" id="editor-nav-units" class="${screen === 'units' ? 'active' : ''}">Units</button>
        <button type="button" id="editor-nav-ai" class="${screen === 'ai' ? 'active' : ''}">AI</button>
        <button type="button" id="editor-nav-roguelite" class="${screen === 'roguelite' ? 'active' : ''}">Roguelite</button>
        <button type="button" id="editor-nav-unlocks" class="${screen === 'unlocks' ? 'active' : ''}">Unlocks</button>
        <button type="button" id="editor-nav-sound" title="Open the There Will Be Legions sound studio (http://127.0.0.1:5198) in a new tab">Sound</button>
      </nav>`
    : '';
  return `<div class="toolbar">
    <h1><span class="app-name">${APP_NAME}</span> ${appVerHtml()}</h1>
    <button type="button" id="go-start" class="${screen === 'start' ? 'active' : ''}">${inEditorSection() ? (terrainOnly ? 'Exit' : 'Exit editor') : 'Play game'}</button>
    ${sfxControlsHtml()}
    ${editorNav}
  </div>`;
}

/** Player-facing name for the tutorial playlist. Editor category stays Tutorial. */
const TUTORIAL_PLAY_TITLE = "Anthony's Lessons";

function mapPickTitle(kind: MapPickKind): string {
  if (kind === 'ai') return 'Skirmish vs AI';
  if (kind === 'hotseat') return 'Hotseat';
  if (kind === 'campaign') return 'Campaign';
  return TUTORIAL_PLAY_TITLE;
}

function mapPickMetaLine(l: SavedLevel, kind: MapPickKind, index: number, maps: SavedLevel[]): string {
  if (pickLocks(kind) && !sequenceUnlocked(maps, index)) return 'Locked';
  return l.hexRadius > 0 ? `R${l.hexRadius}` : `${l.cols}×${l.rows}`;
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
    defaultArmyStamps(RANDOM_COLS, RANDOM_ROWS, selectedPeriod),
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
      <span class="start-opt-name">${lock}${name}${levelAudioNotes(l)}</span>
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
    kind === 'tutorial'
      ? 'There was in those days a simple peasant called Anthony, a man of small account, who knew more of turnips than of spears. The thanes took him from the plough to see whether luck and a strong arm might make a warrior of him. He would not be sent on until he had done with the lesson before him.'
      : kind === 'campaign'
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
  const eraClosed = eraPlayLocked();
  const noRecruits = !rogueUnitPool(selectedPeriod, 'start', 1).length;
  const rg = getRogueConfig().globals;
  const rogueTitle = `2v2 randomised run. Win ${rg.goalBattles} for victory${rg.endlessAfterGoal ? ', then continue endless until you die' : ''}. From battle ${rg.enemyPromoStart} enemies get promotions (1, then 2, …). Killed units are gone for good. Stars + Wealthy pay gold. Scout units place hidden and grant map regenerates. Shop of ${rg.shopSize} recruits + promotions (${rg.firstPromoFree ? 'first free, extras ' : ''}${rg.promoCost}g) after each win; enemy gains one free unit.`;
  const rogueMeta = `Win ${rg.goalBattles}${rg.endlessAfterGoal ? '+' : ''} · promos`;
  const eraLock = eraClosed ? lockIconHtml() : '';
  const gateAttr = (empty: boolean, emptyTitle: string, openTitle: string) =>
    eraClosed
      ? ` disabled title="Under construction"`
      : empty
        ? ` disabled title="${emptyTitle}"`
        : ` title="${openTitle}"`;
  const gateMeta = (empty: boolean, emptyMeta: string, openMeta: string) =>
    eraClosed ? 'Under construction' : empty ? emptyMeta : openMeta;
  const rogueGateAttr = (openTitle: string) =>
    eraClosed
      ? ` disabled title="Under construction"`
      : noRecruits
        ? ` disabled title="Enable Recruitable on at least one ${PERIOD_LABEL[selectedPeriod]} unit"`
        : ` title="${openTitle}"`;
  const rogueGateMeta = (openMeta: string) =>
    eraClosed ? 'Under construction' : noRecruits ? 'No recruitable units' : openMeta;
  const tutorialTitle = eraClosed
    ? 'Under construction'
    : tutorialN
      ? TUTORIAL_PLAY_TITLE
      : 'Mark saved levels as Tutorial in the Editor';
  const periodPicks = PERIODS.map(
    (p) =>
      `<button type="button" class="period-pick${selectedPeriod === p ? ' active' : ''}" data-period="${p}">${PERIOD_LABEL[p]}${eraIsWip(p) ? '<span class="era-wip">under construction</span>' : ''}</button>`,
  ).join('');
  return `
    <div class="board-wrap start-wrap">
      <div class="start-screen">
        <p class="start-kicker">Hex Warfare ${appVerHtml()}</p>
        <h2 class="start-title"><span class="app-name">${APP_NAME}</span></h2>
        <div class="period-picks" role="radiogroup" aria-label="Period">${periodPicks}</div>
        <div class="start-menu">
          <button type="button" class="start-opt" data-start="tutorial"${eraClosed || !tutorialN ? ' disabled' : ''}
            title="${tutorialTitle}">
            <span class="start-opt-name">${eraLock}${TUTORIAL_PLAY_TITLE}</span>
            <span class="start-opt-meta">${eraClosed ? 'Under construction' : tutorialN ? 'Tutorial' : 'No tutorial maps'}</span>
          </button>
          <button type="button" class="start-opt" data-start="roguelite"${rogueGateAttr(rogueTitle)}>
            <span class="start-opt-name">${eraLock}Roguelite</span>
            <span class="start-opt-meta">${rogueGateMeta(rogueMeta)}</span>
          </button>
          <button type="button" class="start-opt" data-start="campaign"${gateAttr(!campaignN, 'Mark saved levels as Campaign in the Editor', 'Pick a campaign map vs AI. Finish one to unlock the next.')}>
            <span class="start-opt-name">${eraLock}Campaign</span>
            <span class="start-opt-meta">${gateMeta(!campaignN, 'No campaign maps', `${mapWord(campaignN)} · vs AI`)}</span>
          </button>
          <button type="button" class="start-opt" data-start="historical"${gateAttr(!historicalN, 'Mark saved levels as Historical in the Editor', 'Historical battles in editor order, vs AI')}>
            <span class="start-opt-name">${eraLock}Historical Battle</span>
            <span class="start-opt-meta">${gateMeta(!historicalN, 'No historical maps', `${mapWord(historicalN)} · vs AI`)}</span>
          </button>
          <button type="button" class="start-opt" data-start="ai"${gateAttr(false, '', 'Pick a skirmish map vs AI, or a randomised map')}>
            <span class="start-opt-name">${eraLock}Skirmish vs AI</span>
            <span class="start-opt-meta">${gateMeta(false, '', skirmishN ? `${mapWord(skirmishN)} · pick a map` : 'Randomised map · vs AI')}</span>
          </button>
          <button type="button" class="start-opt" data-start="random"${gateAttr(false, '', 'Generated map vs AI. Pick two armies and the enemy AI.')}>
            <span class="start-opt-name">${eraLock}Randomised Battle</span>
            <span class="start-opt-meta">${gateMeta(false, '', 'Generated map · vs AI')}</span>
          </button>
          <button type="button" class="start-opt" data-start="totalwar"
            title="Strategic Europe campaign map — pan, zoom, inspect regions.">
            <span class="start-opt-name">Total war</span>
            <span class="start-opt-meta">Campaign map · Europe</span>
          </button>
        </div>
        <div class="start-tools">
          <button type="button" class="start-reset" data-start="editor">Editor</button>
          <button type="button" class="start-reset" data-start="tweditor">TW editor</button>
          <button type="button" class="start-reset" data-start="terrain">Terrain presets</button>
          <button type="button" id="reset-progress" class="start-reset">Reset progress</button>
        </div>
        ${renderAccountLine()}
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
        eraPlayLocked() &&
        (kind === 'campaign' ||
          kind === 'tutorial' ||
          kind === 'historical' ||
          kind === 'ai' ||
          kind === 'random' ||
          kind === 'roguelite')
      ) {
        return;
      }
      if (kind === 'historical') startPlaylist(kind);
      else if (kind === 'campaign') showMapPick('campaign');
      else if (kind === 'tutorial') showMapPick('tutorial');
      else if (kind === 'ai') showMapPick('ai');
      else if (kind === 'random') openRandomSetup('ai');
      else if (kind === 'roguelite') startRogueRun();
      else if (kind === 'editor') enterLevels(true);
      else if (kind === 'totalwar') void enterCampaignPlay();
      else if (kind === 'tweditor') void enterCampaignMap();
      else if (kind === 'terrain') enterTerrainPresets();
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
  app.querySelector('#editor-nav-roguelite')?.addEventListener('click', () => {
    if (screen === 'roguelite') return;
    if (!confirmLeaveEditor()) return;
    enterRogueConfig();
  });
  app.querySelector('#editor-nav-unlocks')?.addEventListener('click', () => {
    if (screen === 'unlocks') return;
    if (!confirmLeaveEditor()) return;
    enterRogueUnlocks();
  });
  // Sound studio: separate local tool (~/htdocs/ChessArmy-tools/legions-studio, port 5198).
  app.querySelector('#editor-nav-sound')?.addEventListener('click', () => {
    window.open('http://127.0.0.1:5198/', '_blank', 'noopener');
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
      type === 'wall' ||
      type === 'house' ||
      type === 'palisade' ||
      type === 'tree' ||
      type === 'forest' ||
      type === 'grass'
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
      <p class="muted">Stack on a hex in paint order. Forest and house always sit on top.</p>
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
  const tokens = STATUS_UNIT_TOKEN_TYPES.map((t) => {
    const brush: UnitTokenBrush = `unit:${t}`;
    return `<button type="button" class="brush unit-token ${t}${editorBrush === brush ? ' active' : ''}" data-brush="${brush}">${unitTokenSwatchSvg(t)}<span>${UNIT_TOKEN_LABEL[t]}</span></button>`;
  }).join('');
  return `
    <section class="editor-panel editor-panel-unit-tokens">
      <h3>Unit tokens</h3>
      <p class="muted">Status stamps on a piece. Story opens a message when painted.</p>
      <div class="editor-brushes">
        ${tokens}
      </div>
    </section>`;
}

function renderPromotionPanel(): string {
  const tokens = PROMOTION_TOKEN_TYPES.map((t) => {
    const brush: UnitTokenBrush = `unit:${t}`;
    return `<button type="button" class="brush unit-token ${t}${editorBrush === brush ? ' active' : ''}" data-brush="${brush}">${unitTokenSwatchSvg(t)}<span>${UNIT_TOKEN_LABEL[t]}</span></button>`;
  }).join('');
  let blurb = `Stack up to ${MAX_UNIT_PROMOTIONS} chevrons. General is unique and does not use a slot. Clear peels one stamp per paint.`;
  if (isUnitTokenBrush(editorBrush)) {
    const kind = unitTokenFromBrush(editorBrush);
    if (isPromotionToken(kind)) blurb = PROMOTION_TOKEN_BLURB[kind];
  } else if (editorBrush === 'clear-promotions') {
    blurb = 'Peels the last promotion (including General) one paint at a time.';
  }
  return `
    <section class="editor-panel editor-panel-promotions">
      <h3>Unit promotions</h3>
      <p class="muted editor-promo-blurb">${escapeHtml(blurb)}</p>
      <div class="editor-brushes">
        ${tokens}
        <button type="button" class="brush unit-token clear-promotions${editorBrush === 'clear-promotions' ? ' active' : ''}" data-brush="clear-promotions">${TRASH_ICON_SVG}<span>Clear promotions</span></button>
      </div>
    </section>`;
}

function unitBrushIconSvg(type: UnitType): string {
  const side: Affiliation = editorArmySide;
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
  const unitButton = (t: UnitType) =>
    `<button type="button" class="brush unit${editorBrush === t ? ' active' : ''}" data-brush="${t}">${unitBrushIconSvg(t)}<span>${escapeHtml(UNIT_STATS[t].name)}</span></button>`;
  const unitGroups = UNIT_CLASSES.map((cls) => {
    const units = catUnits.filter((t) => UNIT_STATS[t].unitClass === cls);
    if (!units.length) return '';
    return `<div class="editor-unit-group">
      <span class="editor-unit-group-label">${UNIT_CLASS_LABEL[cls]}</span>
      <div class="editor-unit-group-units">${units.map(unitButton).join('')}</div>
    </div>`;
  }).join('');
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
        ${catUnits.length ? unitGroups : `<span class="lvl-meta">No ${UNIT_CATEGORY_LABEL[editorUnitCategory]} units</span>`}
      </div>
    </section>
    <div class="editor-brushes editor-erase-row">
      <button type="button" id="editor-undo" class="brush"${editorUndoStack.length ? '' : ' disabled'}>Undo</button>
      <button type="button" class="brush erase${editorBrush === 'erase' ? ' active' : ''}" data-brush="erase">Erase unit ${TRASH_ICON_SVG}</button>
      <button type="button" id="editor-clear" class="brush erase">Clear land tiles ${TRASH_ICON_SVG}</button>
    </div>
    </div>`;
}

function renderLevelThumb(lvl: {
  cols: number;
  rows: number;
  orientation: HexOrientation;
  terrain: SavedLevel['terrain'];
  tokens?: SavedLevel['tokens'];
  armies?: SavedLevel['armies'];
  hexRadius?: number;
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
  const thumbRadius = lvl.hexRadius ?? 0;
  const thumbDisk = thumbRadius > 0 ? hexDisk(thumbRadius, ori) : null;
  const thumbCenter = thumbDisk
    ? thumbDisk.cols === cols && thumbDisk.rows === rows
      ? thumbDisk.center
      : { col: Math.floor((cols - 1) / 2), row: Math.floor((rows - 1) / 2) }
    : null;
  for (let row = 0; row < rows; row++) {
    const line = lvl.terrain[row];
    if (!line) continue;
    for (let col = 0; col < cols; col++) {
      if (thumbCenter && distance({ col, row }, thumbCenter, ori) > thumbRadius) continue;
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
  let forest = '';
  let houses = '';
  for (const t of lvl.tokens ?? []) {
    if (t.type === 'tutorial') continue;
    const { x, y } = hexToPixel({ col: t.col, row: t.row }, size, ori);
    const garrison =
      t.type === 'house' &&
      (lvl.armies ?? []).some((p) => p.col === t.col && p.row === t.row);
    const g = `<g transform="translate(${x + pad}, ${y + pad})">${
      t.type === 'wall' ||
      t.type === 'house' ||
      t.type === 'palisade' ||
      t.type === 'tree' ||
      t.type === 'forest' ||
      t.type === 'grass'
        ? tokenGlyphSvg(t.type, size * 0.8, ori, null, t.hp, garrison)
        : t.type === 'flag'
          ? tokenGlyphSvg('flag', size * 1.15, ori, t.owner)
          : tokenGlyphSvg(t.type, size * 1.2)
    }${tokenIsNoTouch(t) ? noTouchMarkSvg(size * 0.55) : ''}</g>`;
    if (t.type === 'forest' || t.type === 'grass') forest += g;
    else if (t.type === 'house') houses += g;
    else hexes += g;
  }
  let dots = '';
  for (const p of lvl.armies ?? []) {
    const { x, y } = hexToPixel({ col: p.col, row: p.row }, size, ori);
    dots += `<circle class="thumb-piece ${stampAffiliation(p)}" cx="${x + pad}" cy="${y + pad}" r="${(size * 0.34).toFixed(1)}" />`;
  }
  return `<svg class="level-thumb" viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${hexes}${dots}${houses}${forest}</svg>`;
}

function levelTeaserHtml(l: SavedLevel): string {
  const t = sanitizeTeaserText(l.teaserText);
  return t ? `<span class="level-teaser">${formatCopyHtml(t)}</span>` : '';
}

function levelAudioNotes(l: SavedLevel): string {
  const slots = [
    ['intro', l.startAudio],
    ['victory', l.winAudio],
    ['lose', l.loseAudio],
  ] as const;
  const labels = slots
    .filter(([, file]) => sanitizeLevelAudio(file))
    .map(([label]) => label);
  if (!labels.length) return '';
  const note = `<svg class="level-note" viewBox="0 0 10 14" width="11" height="14" aria-hidden="true"><path fill="currentColor" d="M2.15.8h1.25v8.05a2.05 2.05 0 1 1-1.25-1.9V2.05H2.15V.8z"/><path fill="currentColor" d="M3.4.9 8.7 2.2v1.35L3.4 2.25V.9z"/></svg>`;
  return `<span class="level-notes" title="${labels.join(', ')}" aria-label="${labels.join(', ')} narration">${labels.map(() => note).join('')}</span>`;
}

function levelMetaLine(l: SavedLevel): string {
  const armyN = Array.isArray(l.armies) ? l.armies.length : null;
  const army = armyN === null ? 'stock armies' : `${armyN} pcs`;
  const size = l.hexRadius > 0 ? `R${l.hexRadius}` : `${l.cols}×${l.rows}`;
  return `${LEVEL_CATEGORY_LABEL[l.category]} · <span class="period-tag" data-period="${l.period}">${PERIOD_LABEL[l.period]}</span> · ${size} · ${l.orientation === 'flat' ? 'flat' : 'point'}${l.unitsPerTurn > 1 ? ` · ${l.unitsPerTurn}u` : ''}${l.maxTurns > 0 ? ` · ${l.maxTurns}t` : ''} · ${army}${l.id === defaultLevelId ? ' · default' : ''}`;
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
      ${renderLevelThumb(l)}
      <span class="level-copy">
        <span class="level-name">${escapeHtml(levelLabel(l))}${levelAudioNotes(l)}</span>
        ${levelTeaserHtml(l)}
        <span class="level-details">
          <span class="lvl-meta">${levelMetaLine(l)}</span>
          ${bestStarsHtml(l.id)}
        </span>
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
  const catOrder = [
    ...LEVEL_CATEGORIES.filter((c) => levelsInCategory(c, levelsPeriodFilter).length > 0),
    ...LEVEL_CATEGORIES.filter((c) => levelsInCategory(c, levelsPeriodFilter).length === 0),
  ];
  const periodOrder = [
    ...PERIODS.filter((p) => levelsInCategory(levelsFilter, p).length > 0),
    ...PERIODS.filter((p) => levelsInCategory(levelsFilter, p).length === 0),
  ];
  const filters = catOrder
    .map((c) => {
      const empty = levelsInCategory(c, levelsPeriodFilter).length === 0;
      return `<button type="button" class="levels-filter${levelsFilter === c ? ' active' : ''}${empty ? ' empty' : ''}" data-levels-filter="${c}">${LEVEL_CATEGORY_LABEL[c]}</button>`;
    })
    .join('');
  const periodFilters = periodOrder
    .map((p) => {
      const empty = levelsInCategory(levelsFilter, p).length === 0;
      return `<button type="button" class="levels-filter${levelsPeriodFilter === p ? ' active' : ''}${empty ? ' empty' : ''}" data-levels-period="${p}" data-period="${p}">${PERIOD_LABEL[p]}${eraIsWip(p) ? '<span class="era-wip">under construction</span>' : ''}</button>`;
    })
    .join('');

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

function editorAudioFile(slot: EditorAudioSlot): string {
  if (slot === 'start') return editorStartAudio;
  if (slot === 'win') return editorWinAudio;
  return editorLoseAudio;
}

function setEditorAudioFile(slot: EditorAudioSlot, file: string): void {
  const clean = sanitizeLevelAudio(file);
  if (slot === 'start') editorStartAudio = clean;
  else if (slot === 'win') editorWinAudio = clean;
  else editorLoseAudio = clean;
  if (editorAudioPlaying === slot) haltLevelAudio();
}

function levelAudioEl(): HTMLAudioElement {
  if (!levelAudio) {
    levelAudio = new Audio();
    levelAudio.preload = 'none';
    levelAudio.addEventListener('ended', () => {
      editorAudioPlaying = null;
      if (screen === 'editor') render();
    });
    levelAudio.addEventListener('error', () => {
      if (!editorAudioPlaying) return;
      editorAudioPlaying = null;
      if (screen === 'editor') render();
    });
  }
  return levelAudio;
}

function haltLevelAudio(): void {
  levelAudio?.pause();
  editorAudioPlaying = null;
}

function editorSlotText(slot: EditorAudioSlot): string {
  if (slot === 'start') return editorStartText;
  if (slot === 'win') return editorWinText;
  return editorLoseText;
}

function setEditorSlotText(slot: EditorAudioSlot, value: string): void {
  const v = sanitizeLevelText(value);
  if (slot === 'start') editorStartText = v;
  else if (slot === 'win') editorWinText = v;
  else editorLoseText = v;
}

function syncEditorSlotTextFromDom(slot: EditorAudioSlot): void {
  const ttsEl = app.querySelector<HTMLTextAreaElement>('#tts-text');
  if (ttsEl && editorTts?.slot === slot) {
    setEditorSlotText(slot, ttsEl.value);
    return;
  }
  const id =
    slot === 'start' ? 'editor-start-text' : slot === 'win' ? 'editor-win-text' : 'editor-lose-text';
  const el = app.querySelector<HTMLTextAreaElement>(`#${id}`);
  if (!el) return;
  setEditorSlotText(slot, el.value);
}

function ttsPreviewEl(): HTMLAudioElement {
  if (!ttsPreviewAudio) {
    ttsPreviewAudio = new Audio();
    ttsPreviewAudio.preload = 'auto';
    ttsPreviewAudio.addEventListener('ended', () => {
      if (editorTts) editorTts.playingFile = null;
      if (screen === 'editor' && editorTts) render();
    });
    ttsPreviewAudio.addEventListener('error', () => {
      if (!editorTts) return;
      editorTts.playingFile = null;
      if (screen === 'editor') render();
    });
  }
  return ttsPreviewAudio;
}

function haltTtsPreview(): void {
  ttsPreviewAudio?.pause();
  if (editorTts) editorTts.playingFile = null;
}

function closeEditorTts(): void {
  if (editorTts) syncEditorSlotTextFromDom(editorTts.slot);
  haltTtsPreview();
  editorTts = null;
}

function ttsFileStem(slot: EditorAudioSlot): string {
  const label = slot === 'start' ? 'intro' : slot;
  const raw = (editorName || 'level')
    .replace(/[^A-Za-z0-9._ -]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  const stem = (raw || 'level').replace(/[. ]+$/g, '');
  return `${stem}-${label}-${Date.now().toString(36)}`;
}

/** Push in-memory slot copy into the editor textareas so doSaveLevel reads them. */
function pushTtsTextIntoEditorFields(): void {
  if (!editorTts) return;
  syncEditorSlotTextFromDom(editorTts.slot);
  const map: Record<EditorAudioSlot, string> = {
    start: 'editor-start-text',
    win: 'editor-win-text',
    lose: 'editor-lose-text',
  };
  for (const s of ['start', 'win', 'lose'] as EditorAudioSlot[]) {
    const el = app.querySelector<HTMLTextAreaElement>(`#${map[s]}`);
    if (el) el.value = editorSlotText(s);
  }
}

async function openEditorTts(slot: EditorAudioSlot): Promise<void> {
  syncEditorSlotTextFromDom(slot);
  editorAudioPick = null;
  editorAudioError = '';
  haltLevelAudio();
  haltTtsPreview();
  editorTts = {
    slot,
    voices: null,
    voiceId: loadTtsVoiceId(),
    generating: false,
    saving: false,
    takes: [],
    selectedFile: null,
    playingFile: null,
    error: '',
  };
  render();
  try {
    const voices = await listTtsVoices();
    if (!editorTts || editorTts.slot !== slot) return;
    editorTts.voices = voices;
    if (!voices.some((v) => v.id === editorTts!.voiceId)) {
      const victor =
        voices.find((v) => /victor/i.test(v.name) && /malevolent|ancient/i.test(v.name)) ??
        voices.find((v) => v.id === DEFAULT_TTS_VOICE_ID) ??
        voices[0];
      if (victor) {
        editorTts.voiceId = victor.id;
        saveTtsVoiceId(victor.id);
      }
    }
  } catch (err) {
    if (!editorTts || editorTts.slot !== slot) return;
    editorTts.voices = [];
    editorTts.error = err instanceof Error ? err.message : 'could not list voices';
  }
  if (screen === 'editor' && editorTts?.slot === slot) render();
}

async function runEditorTtsGenerate(): Promise<void> {
  if (!editorTts || editorTts.generating || editorTts.saving) return;
  const slot = editorTts.slot;
  syncEditorSlotTextFromDom(slot);
  const text = textForTts(editorSlotText(slot));
  if (!text) {
    editorTts.error = 'Add some text first';
    render();
    return;
  }
  editorTts.generating = true;
  editorTts.error = '';
  haltTtsPreview();
  render();
  try {
    const blob = await generateTts(text, editorTts.voiceId);
    if (!editorTts || editorTts.slot !== slot) return;
    const file = new File([blob], `${ttsFileStem(slot)}.mp3`, { type: 'audio/mpeg' });
    const name = await uploadLevelAudio(file);
    if (!editorTts || editorTts.slot !== slot) return;
    editorTts.takes = [...editorTts.takes, { file: name, label: ttsTakeLabel(editorSlotText(slot)) }];
    editorTts.selectedFile = name;
    editorTts.generating = false;
    editorAudioFiles = await listLevelAudio().catch(() => editorAudioFiles);
    pushTtsTextIntoEditorFields();
    await doSaveLevel(false);
  } catch (err) {
    if (!editorTts || editorTts.slot !== slot) return;
    editorTts.generating = false;
    editorTts.error = err instanceof Error ? err.message : 'generate failed';
    if (screen === 'editor' && editorTts?.slot === slot) render();
  }
}

function toggleTtsTake(file: string): void {
  if (!editorTts) return;
  const url = levelAudioUrl(file);
  if (!url) return;
  editorTts.selectedFile = file;
  const el = ttsPreviewEl();
  if (editorTts.playingFile === file) {
    el.pause();
    editorTts.playingFile = null;
    render();
    return;
  }
  haltLevelAudio();
  el.src = url;
  editorTts.playingFile = file;
  void el.play().catch(() => {
    if (editorTts) editorTts.playingFile = null;
    if (screen === 'editor') render();
  });
  render();
}

async function useEditorTtsClip(): Promise<void> {
  if (!editorTts?.selectedFile || editorTts.saving || editorTts.generating) return;
  const slot = editorTts.slot;
  const keep = editorTts.selectedFile;
  const trash = editorTts.takes.map((t) => t.file).filter((f) => f !== keep);
  editorTts.saving = true;
  editorTts.error = '';
  haltTtsPreview();
  render();
  try {
    syncEditorSlotTextFromDom(slot);
    setEditorAudioFile(slot, keep);
    await Promise.all(trash.map((f) => deleteLevelAudio(f).catch(() => undefined)));
    editorAudioFiles = await listLevelAudio().catch(() => editorAudioFiles);
    const map: Record<EditorAudioSlot, string> = {
      start: 'editor-start-text',
      win: 'editor-win-text',
      lose: 'editor-lose-text',
    };
    for (const s of ['start', 'win', 'lose'] as EditorAudioSlot[]) {
      const el = app.querySelector<HTMLTextAreaElement>(`#${map[s]}`);
      if (el) el.value = editorSlotText(s);
    }
    closeEditorTts();
    await doSaveLevel(false);
  } catch (err) {
    if (!editorTts || editorTts.slot !== slot) {
      if (screen === 'editor') render();
      return;
    }
    editorTts.saving = false;
    editorTts.error = err instanceof Error ? err.message : 'save failed';
    if (screen === 'editor') render();
  }
}

function renderEditorTtsPopup(): string {
  if (!editorTts) return '';
  const slot = editorTts.slot;
  const label = slot === 'start' ? 'intro' : slot;
  const busy = editorTts.generating || editorTts.saving;
  const voices = editorTts.voices;
  const voiceOpts =
    voices == null
      ? `<option value="">Loading voices…</option>`
      : voices.length
        ? voices
            .map(
              (v) =>
                `<option value="${escapeHtml(v.id)}"${v.id === editorTts!.voiceId ? ' selected' : ''}>${escapeHtml(v.name)}</option>`,
            )
            .join('')
        : `<option value="${escapeHtml(DEFAULT_TTS_VOICE_ID)}">${escapeHtml(DEFAULT_TTS_VOICE_NAME)}</option>`;
  const err = editorTts.error
    ? `<p class="muted level-audio-err">${escapeHtml(editorTts.error)}</p>`
    : '';
  const takes = editorTts.takes;
  const takeList = takes.length
    ? `<ul class="tts-takes">${takes
        .map((t) => {
          const selected = t.file === editorTts!.selectedFile;
          const playing = t.file === editorTts!.playingFile;
          return `<li class="tts-take${selected ? ' selected' : ''}">
            <button type="button" class="tts-take-pick" data-tts-select="${escapeHtml(t.file)}" title="${escapeHtml(t.label)}"${busy ? ' disabled' : ''}>${escapeHtml(t.label)}</button>
            <button type="button" class="ghost tts-take-play" data-tts-play-file="${escapeHtml(t.file)}"${busy ? ' disabled' : ''}>${playing ? 'Stop' : 'Play'}</button>
          </li>`;
        })
        .join('')}</ul>`
    : '';
  const rows = slot === 'start' ? 8 : 5;
  return `
    <div class="end-overlay briefing tts-overlay" role="dialog" aria-modal="true" aria-label="Generate ${escapeHtml(label)} audio">
      <div class="end-card briefing tts-card">
        <h2 class="end-title">Generate ${escapeHtml(label)} audio</h2>
        <label class="tts-voice">Voice
          <select id="tts-voice"${busy || voices == null ? ' disabled' : ''}>${voiceOpts}</select>
        </label>
        <p class="muted tts-hint">Edit the text, then generate. Game glyphs like [hoplite] are skipped; unknown tags like [whispers] go to ElevenLabs. Generate also saves the level.</p>
        <label class="tts-text">Text
          <textarea id="tts-text" maxlength="${LEVEL_TEXT_MAX}" rows="${rows}"${busy ? ' disabled' : ''}>${escapeHtml(editorSlotText(slot))}</textarea>
        </label>
        ${err}
        <div class="end-actions tts-actions">
          <button type="button" class="primary" id="tts-generate"${busy || voices == null ? ' disabled' : ''}>${editorTts.generating ? 'Generating…' : 'Generate'}</button>
          <button type="button" class="primary" id="tts-use"${busy || !editorTts.selectedFile ? ' disabled' : ''}>${editorTts.saving ? 'Saving…' : 'Use this clip'}</button>
          <button type="button" class="ghost" id="tts-cancel"${editorTts.saving ? ' disabled' : ''}>Cancel</button>
        </div>
        ${takeList}
      </div>
    </div>`;
}

function toggleLevelAudio(slot: EditorAudioSlot): void {
  const file = editorAudioFile(slot);
  const url = levelAudioUrl(file);
  if (!url) return;
  if (editorAudioPlaying === slot) {
    haltLevelAudio();
    render();
    return;
  }
  const el = levelAudioEl();
  editorAudioPlaying = slot;
  el.src = url;
  void el.play().catch(() => {
    if (editorAudioPlaying === slot) editorAudioPlaying = null;
    if (screen === 'editor') render();
  });
  render();
}

async function openLevelAudioPick(slot: EditorAudioSlot): Promise<void> {
  if (editorAudioPick === slot) {
    editorAudioPick = null;
    editorAudioError = '';
    render();
    return;
  }
  if (editorTts) closeEditorTts();
  editorAudioPick = slot;
  editorAudioError = '';
  render();
  try {
    editorAudioFiles = await listLevelAudio();
  } catch {
    editorAudioFiles = editorAudioFiles ?? [];
    editorAudioError = 'Could not list audio files';
  }
  if (editorAudioPick === slot && screen === 'editor') render();
}

function levelAudioPicker(slot: EditorAudioSlot): string {
  const current = editorAudioFile(slot);
  const files = editorAudioFiles;
  const list =
    files == null
      ? `<p class="muted">Loading…</p>`
      : files.length
        ? files
            .map(
              (f) =>
                `<button type="button" class="level-audio-file${f === current ? ' active' : ''}" data-audio-choose="${escapeHtml(f)}" data-audio-slot="${slot}">${escapeHtml(f)}</button>`,
            )
            .join('')
        : `<p class="muted">No files in audio/</p>`;
  const err = editorAudioError
    ? `<p class="muted level-audio-err">${escapeHtml(editorAudioError)}</p>`
    : '';
  return `<div class="level-audio-pick" data-audio-pick="${slot}">
    ${err}
    <div class="level-audio-files">${list}</div>
    <label class="level-audio-upload">Upload
      <input type="file" accept=".mp3,.wav,.ogg,.m4a,audio/*" data-audio-upload="${slot}" />
    </label>
  </div>`;
}

function levelCopyField(
  slot: EditorAudioSlot,
  id: string,
  label: string,
  placeholder: string,
  rows: number,
  value: string,
): string {
  const file = editorAudioFile(slot);
  const playing = editorAudioPlaying === slot;
  const playBtn = file
    ? `<button type="button" class="level-audio-play${playing ? ' active' : ''}" data-audio-play="${slot}" aria-pressed="${playing ? 'true' : 'false'}">${playing ? 'Stop' : 'Play'}</button>`
    : '';
  const clearBtn = file
    ? `<button type="button" class="level-audio-clear" data-audio-clear="${slot}" aria-label="Unlink ${label} audio">×</button>`
    : '';
  const genActive = editorTts?.slot === slot;
  return `<div class="editor-cat level-copy-field">
    <div class="level-copy-head">
      <label for="${id}">${label}</label>
      <span class="level-audio-actions">
        ${playBtn}
        <button type="button" class="level-audio-generate${genActive ? ' active' : ''}" data-audio-generate="${slot}">Generate</button>
        <button type="button" class="level-audio-link${file ? ' linked' : ''}${editorAudioPick === slot ? ' active' : ''}" data-audio-link="${slot}" title="${escapeHtml(file || 'Link an audio file')}">${escapeHtml(file || 'Link audio')}</button>
        ${clearBtn}
      </span>
    </div>
    ${editorAudioPick === slot ? levelAudioPicker(slot) : ''}
    <textarea id="${id}" maxlength="${LEVEL_TEXT_MAX}" rows="${rows}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>
  </div>`;
}

function renderTerrainGenPanel(): string {
  const user = listUserTerrainPresets();
  const row = (p: { id: string; name: string; builtin?: boolean; modified?: boolean; difficulty: number }) =>
    `<li class="${p.id === editorTerrainPresetId ? 'active' : ''}">
      <button type="button" data-terrain-load="${p.id}">${escapeHtml(p.name)} <span class="lvl-meta">D${p.difficulty}${p.builtin ? ` · built-in${p.modified ? ' · edited' : ''}` : ''}</span></button>
      <button type="button" class="ghost" data-terrain-run="${p.id}" title="Load and generate">Gen</button>
      ${
        !p.builtin
          ? `<button type="button" class="ghost danger" data-terrain-del="${p.id}" title="Delete">×</button>`
          : p.modified
            ? `<button type="button" class="ghost danger" data-terrain-reset="${p.id}" title="Restore factory settings">↺</button>`
            : ''
      }
    </li>`;
  const list = [...listBuiltinTerrainPresets(), ...user].map(row).join('');
  const saved = user.find((p) => p.id === editorTerrainPresetId);
  const layerRows = TERRAIN_LAYER_IDS.map((id) => {
    const l = editorTerrainCfg.layers[id];
    return `<div class="tg-row${l.amount > 0 ? ' on' : ''}" data-tg-row="${id}">
      <span class="tg-name">${TERRAIN_LAYER_LABEL[id]}</span>
      <label class="tg-range"><input type="range" min="0" max="${MAX_LAYER_AMOUNT}" value="${l.amount}" data-tg-layer="${id}" data-tg-field="amount" aria-label="${TERRAIN_LAYER_LABEL[id]} amount" /><output data-tg-val="${id}:amount">${l.amount}%</output></label>
      <label class="tg-range" title="Chance each new tile attaches to a ${TERRAIN_LAYER_LABEL[id].toLowerCase()} tile that is already placed"><input type="range" min="0" max="100" step="5" value="${l.link}" data-tg-layer="${id}" data-tg-field="link" aria-label="${TERRAIN_LAYER_LABEL[id]} link chance" /><output data-tg-val="${id}:link">${l.link}%</output></label>
      <select data-tg-layer="${id}" data-tg-field="bias" aria-label="${TERRAIN_LAYER_LABEL[id]} placement">
        ${LAYER_BIASES.map((b) => `<option value="${b}"${l.bias === b ? ' selected' : ''}>${LAYER_BIAS_LABEL[b]}</option>`).join('')}
      </select>
    </div>`;
  }).join('');
  const builtinLoaded = listBuiltinTerrainPresets().find((p) => p.id === editorTerrainPresetId);
  const hint = saved ? saved.name : builtinLoaded ? 'built-in' : 'unsaved';
  return `
    <section class="editor-panel editor-panel-armies editor-panel-terrain">
      <details data-editor-terrain${editorTerrainGenOpen ? ' open' : ''}>
        <summary>
          <h3>Terrain generator</h3>
          <span class="lvl-meta">${escapeHtml(editorTerrainName)} · ${hint}</span>
        </summary>
        <div class="editor-fold-body">
          <div class="editor-save editor-army-save">
            <input type="text" id="terrain-name" value="${escapeHtml(editorTerrainName)}" placeholder="Preset name" maxlength="48" />
            <button type="button" id="terrain-save" class="primary">${saved || builtinLoaded ? 'Save' : 'Save new'}</button>
            ${saved || builtinLoaded ? '<button type="button" id="terrain-save-as" class="ghost">Save as new</button>' : ''}
          </div>
          <div class="editor-library">
            <span class="editor-label">Presets</span>
            <ul class="editor-levels editor-formations">${list}</ul>
          </div>
          <div class="tg-layers">
            <div class="tg-row tg-head"><span></span><span>Amount</span><span>Link chance</span><span>Placement</span></div>
            ${layerRows}
          </div>
          <div class="tg-opts">
            <label class="chk"><input type="checkbox" id="terrain-replace"${editorTerrainCfg.replace ? ' checked' : ''} /> Replace existing tiles, trees, houses + grass</label>
            <label class="chk" title="Every slope is walkable (±1 steps)"><input type="checkbox" id="terrain-ramps"${editorTerrainCfg.ramps && !editorTerrainCfg.singleRamps ? ' checked' : ''} /> Ramps (±1 slopes)</label>
            <label class="chk" title="One ramp per plateau / mountain with no way down. Other cliffs stay cliffs."><input type="checkbox" id="terrain-single-ramps"${editorTerrainCfg.singleRamps ? ' checked' : ''} /> Single ramps</label>
            <label title="Generate, then copy one half onto the other so both sides are equal. Hexes with units, their clear radius and structures are skipped.">Mirror
              <select id="terrain-mirror">${MIRROR_MODES.map((m) => `<option value="${m}"${editorTerrainCfg.mirror === m ? ' selected' : ''}>${MIRROR_MODE_LABEL[m]}</option>`).join('')}</select>
            </label>
            <label title="Which line the exact mirror folds across (the reversed mirror turns the map 180° and ignores this)"${editorTerrainCfg.mirror === 'mirror' ? '' : ' hidden'} id="terrain-mirror-axis-label">Fold
              <select id="terrain-mirror-axis">${MIRROR_AXES.map((a) => `<option value="${a}"${editorTerrainCfg.mirrorAxis === a ? ' selected' : ''}>${MIRROR_AXIS_LABEL[a]}</option>`).join('')}</select>
            </label>
            <label title="How hard this terrain is. Roguelite 'Auto' picks by it: battles 1–3 use 1, 4–7 use 1–2, 8+ any.">Difficulty
              <select id="terrain-difficulty">${TERRAIN_DIFFICULTY_LABEL.map((l, i) => `<option value="${i}"${editorTerrainCfg.difficulty === i ? ' selected' : ''}>${l}</option>`).join('')}</select>
            </label>
            <label class="tg-range" title="Hexes one line outside an Edges / Center zone that are still open to that layer. 0 = hard limit.">Edge bleed
              <input type="range" min="0" max="100" step="5" id="terrain-bleed" value="${editorTerrainCfg.bleed}" /><output id="terrain-bleed-val">${editorTerrainCfg.bleed}%</output>
            </label>
            <label>Clear around units <input type="number" id="terrain-clear" min="0" max="${MAX_CLEAR_RADIUS}" value="${editorTerrainCfg.clearRadius}" /></label>
          </div>
          <div class="tg-run">
            <label>Seed <input type="number" id="terrain-seed" min="0" max="999999" value="${editorTerrainSeed}" /></label>
            <label class="chk"><input type="checkbox" id="terrain-lock"${editorTerrainLockSeed ? ' checked' : ''} /> Lock seed</label>
            <button type="button" id="terrain-generate" class="primary">Generate</button>
          </div>
          <p class="muted tg-status" id="terrain-status">${escapeHtml(editorTerrainStatus || 'Amount = % of free hexes. Link chance = odds a tile touches one of its own kind (0 scattered, 100 one blob). Undo reverts a generate. Units and flags/walls/boards stay untouched.')}</p>
        </div>
      </details>
    </section>`;
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
  const edgeLabel = ARMY_EDGE_LABEL[editorLoadEdge];
  const sideBtns = SIDES.map(
    (s) =>
      `<button type="button" class="editor-side ${s}${editorArmySide === s ? ' active' : ''}" data-army-side="${s}">${SIDE_LABEL[s]}</button>`,
  ).join('');
  const edgeBtns = ARMY_EDGES.map((e) => {
    const owner = editorEdgeOwner[e];
    const taken = owner && owner !== editorArmySide;
    return `<button type="button" class="army-edge ${e}${editorLoadEdge === e ? ' active' : ''}${owner ? ` ${owner}` : ''}" data-army-edge="${e}" title="${taken ? `Replaces ${SIDE_LABEL[owner]}` : `Load onto ${ARMY_EDGE_LABEL[e]}`}">${ARMY_EDGE_LABEL[e]}${owner ? `<span class="lvl-meta">${SIDE_LABEL[owner]}</span>` : ''}</button>`;
  }).join('');

  return `
    <div class="editor-bar">
      <section class="editor-panel editor-panel-armies">
        <details data-editor-armies${editorArmiesOpen ? ' open' : ''}>
          <summary>
            <h3>Armies</h3>
            <span class="lvl-meta">${escapeHtml(armyHint)} · ${armyOnto} · ${edgeLabel}</span>
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
              <span class="editor-label">Load ${armyOnto} onto</span>
              <div class="army-load-sides" role="group" aria-label="Army color">${sideBtns}</div>
              <div class="army-edges" role="group" aria-label="Load onto edge">${edgeBtns}</div>
              <span class="editor-label">${UNIT_CATEGORY_LABEL[era]} armies</span>
              ${formList}
            </div>
          </div>
        </details>
      </section>
      ${renderTerrainGenPanel()}
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
          ${levelCopyField('start', 'editor-start-text', 'intro', 'Shown at the start of the level', 6, editorStartText)}
          ${levelCopyField('win', 'editor-win-text', 'victory', 'Shown when you win', 4, editorWinText)}
          ${levelCopyField('lose', 'editor-lose-text', 'lose', 'Shown when you lose', 4, editorLoseText)}
          <p class="muted star-turns-hint">[hoplite], [pikes], [energy], [spend ap], [special], [end turn], [tutorial]… — name in brackets becomes that item's icon. [tutorial] in a message points bouncing hands at painted Tutorial tokens after it closes. The same message's [special] or [end turn] points a hand at that button. The next map click hides them.</p>
          <div class="star-rules">
            <span class="editor-label">Stars</span>
            <p class="muted star-turns-hint">Turns = full rounds. HP lost = damage taken. Units lost = your pieces removed. Allies lost = AI ally pieces removed. Units killed = enemy pieces removed. Flags captured / signs read count what you achieve this match. Use &lt; ≤ = to cap, ≥ &gt; to require.</p>
            <div class="star-rule-row locked">
              <span class="star-rule-mark">${starGlyphSvg('on', 15)}</span>
              <span class="star-rule-n">1</span>
              <span class="star-rule-fixed">Win</span>
            </div>
            ${starRuleEditorRow(2, editorStar2)}
            ${starRuleEditorRow(3, editorStar3)}
          </div>
          <div class="editor-grid">
            <label class="chk">
              <input type="checkbox" id="editor-hex"${editorHex ? ' checked' : ''} />
              Hex
            </label>
            ${
              editorHex
                ? `<label>R <input type="number" id="editor-radius" min="1" max="10" value="${editorRadius}" title="Tiles from the center to the edge" /></label>`
                : `<label>W <input type="number" id="editor-cols" min="${MIN_COLS}" max="${MAX_COLS}" value="${grid.cols}" /></label>
            <label>H <input type="number" id="editor-rows" min="${MIN_ROWS}" max="${MAX_ROWS}" value="${grid.rows}" /></label>`
            }
            <button type="button" data-ori="pointy" class="${editorOrientation === 'pointy' ? 'active' : ''}">Point up</button>
            <button type="button" data-ori="flat" class="${editorOrientation === 'flat' ? 'active' : ''}">Flat up</button>
          </div>
        </div>
      </section>
      ${renderGlyphPanel()}
    </div>`;
}

function glyphChipMatches(tag: string, label: string, q: string): boolean {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  return tag.toLowerCase().includes(needle) || label.toLowerCase().includes(needle);
}

function applyGlyphFilter(): void {
  const body = app.querySelector('.editor-panel-glyphs .editor-fold-body');
  if (!body) return;
  const needle = editorGlyphQuery.trim().toLowerCase();
  const groups = [...body.querySelectorAll<HTMLElement>('.glyph-group')];
  const ranked = groups.map((el) => {
    let hits = 0;
    el.querySelectorAll<HTMLButtonElement>('.glyph-chip').forEach((chip) => {
      const tag = chip.dataset.copyTag ?? '';
      const label = chip.querySelector('.glyph-tag')?.textContent ?? '';
      const ok = glyphChipMatches(tag, label, needle);
      chip.hidden = !ok;
      if (ok) hits += 1;
    });
    el.classList.toggle('empty', !!needle && hits === 0);
    return { el, hits, order: Number(el.dataset.order ?? 0) };
  });
  ranked.sort((a, b) => {
    const ae = needle && a.hits === 0 ? 1 : 0;
    const be = needle && b.hits === 0 ? 1 : 0;
    if (ae !== be) return ae - be;
    return a.order - b.order;
  });
  for (const row of ranked) body.appendChild(row.el);
}

function renderGlyphPanel(): string {
  const groups = copyGlyphGroups()
    .map((g, i) => {
      const chips = g.glyphs
        .map(
          (item) =>
            `<button type="button" class="glyph-chip" data-copy-tag="${escapeHtml(item.tag)}" title="Insert [${escapeHtml(item.tag)}]" aria-label="Insert [${escapeHtml(item.tag)}]">${item.icon}<span class="glyph-tag">[${escapeHtml(item.tag)}]</span></button>`,
        )
        .join('');
      return `<div class="glyph-group" data-order="${i}">
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
          <label class="glyph-filter">Search
            <input type="search" id="glyph-filter" value="${escapeHtml(editorGlyphQuery)}" placeholder="Filter glyphs" autocomplete="off" />
          </label>
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
  const s = UNIT_STATS[type];
  const min =
    field === 'sight' ? defaultSight(s.move, s.shoot) : (spec?.min ?? 0);
  const max = spec?.max ?? 99;
  const val = UNIT_STATS[type][field] as number;
  const armorish = field === 'armor' || String(field).startsWith('armor');
  const damageish = String(field).startsWith('damage');
  const tint =
    armorish || damageish ? ` style="border-color:${armorColor(val)}"` : '';
  return `<label>${label} <input type="number" min="${min}" max="${max}" value="${val}" data-unit="${type}" data-field="${field}"${tint} /></label>`;
}

function abilityGlyph(id: AbilityId): string {
  return actionGlyphSvg(id, { className: 'ability-glyph', em: '16' });
}

function abilityPanel(type: UnitType, abilities: AbilityId[]): string {
  const picks = ABILITY_IDS.map((id) => {
    const on = abilities.includes(id);
    return `<button type="button" class="ability-pick${on ? ' active' : ''}" data-unit="${type}" data-ability="${id}" aria-pressed="${on}">
      ${abilityGlyph(id)}
      ${ABILITY_LABEL[id]}
    </button>`;
  }).join('');
  const blurb = abilities.length
    ? abilities.map((id) => ABILITY_BLURB[id]).join(' ')
    : 'None.';
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
  const cardOf = (type: UnitType): string => {
      const s = UNIT_STATS[type];
      const catOpts = UNIT_CATEGORIES.map(
        (c) =>
          `<option value="${c}"${s.category === c ? ' selected' : ''}>${eraIsWip(c) ? `${UNIT_CATEGORY_LABEL[c]} (under construction)` : UNIT_CATEGORY_LABEL[c]}</option>`,
      ).join('');
      const classOpts = UNIT_CLASSES.map(
        (c) =>
          `<option value="${c}"${s.unitClass === c ? ' selected' : ''}>${UNIT_CLASS_LABEL[c]}</option>`,
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
        <span class="lvl-meta unit-card-meta">${UNIT_CLASS_LABEL[s.unitClass]} · ${hpPipsHtml(s.hp, s.hp, 'catalog')} · ${s.value}</span>
      </summary>
      <div class="unit-card-body">
      <header>
        <div class="unit-card-id">
          <input type="text" class="unit-name" maxlength="32" value="${escapeHtml(s.name)}" data-unit-name="${type}" />
          <span class="lvl-meta">${escapeHtml(s.chess)}${copied ? ' · copy' : ''}</span>
        </div>
        <div class="unit-card-selects">
          <label class="unit-cat">Type
            <select data-unit-class="${type}">${classOpts}</select>
          </label>
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
          <label class="chk">
            <input type="checkbox" data-unit="${type}" data-field="recruitable"${s.recruitable ? ' checked' : ''} />
            Recruitable
          </label>
          ${unitNumField(type, 'hp', 'HP')}
          ${s.hexArmor ? '' : unitNumField(type, 'armor', 'Armor')}
          ${unitNumField(type, 'value', 'Value/weight')}
          ${unitNumField(type, 'actionPointGain', 'AP / turn')}
          ${unitNumField(type, 'actionPointSpendCap', 'Max AP spent / turn')}
          ${unitNumField(type, 'sight', 'Sight')}
        </div>
        <div class="unit-group">
          <span class="unit-group-label">Move</span>
          ${unitNumField(type, 'move', 'Range')}
          ${unitNumField(type, 'moveBudget', 'Move cap')}
          ${unitNumField(type, 'actionPoints', 'AP max')}
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
  };
  const groups = UNIT_CLASSES.map((cls) => {
    const types = shown
      .filter((t) => UNIT_STATS[t].unitClass === cls)
      .sort(
        (a, b) =>
          UNIT_STATS[a].value - UNIT_STATS[b].value ||
          UNIT_STATS[a].name.localeCompare(UNIT_STATS[b].name),
      );
    if (!types.length) return '';
    return `<section class="unit-class-group">
      <h3 class="unit-class-label">${UNIT_CLASS_LABEL[cls]}</h3>
      <div class="unit-class-cards">${types.map(cardOf).join('')}</div>
    </section>`;
  }).join('');

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
      <div class="unit-cards">${groups}</div>
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
          <dd><strong>Armor</strong> −2..+2, subtracted from incoming dmg (shots ignore negatives). Ring / hex: −2 red, −1 orange, 0 green, +1 blue, +2 purple. Stock: tank +2, general +1. Hex armor: a −2 face cannot be walked or shot. Rout: (1) two enemies on opposite adjacent hexes, one face −2 (red) — any hit routs; (2) ≥2 adjacent enemies, then hit by a 3rd source (ranged / other melee / trap / water / pikes). Friends and terrain never pin. Generals immune</dd>
          <dd><strong>Hex damage</strong> check to enable. Per-face 0–2. Each live face is facing pikes on the adjacent hex only: enemies take that damage when they enter. Standing there does not pulse again. 0 is outline only</dd>
          <dd><strong>Value/weight</strong> scoring / AI. General token +1</dd>
          <dd><strong>AP / turn</strong> action points granted at turn start</dd>
          <dd><strong>Max AP spent / turn</strong> spend window (yellow on the AP bar). Stock default was formerly gain+1</dd>
          <dd><strong>Sight</strong> AI Hold only — not fog of war. How far this piece notices enemies for turning / contact. Walls and higher ground block; units, forest and long grass do not. Hill / plateau / mountain add like shoot. Always at least 1 more than move or shoot, whichever is longer</dd>
          <dd><strong>Hide</strong> (ability) invisible to enemies while on forest / long grass / house. The Hide dock toggle shows only hideable dests. Breaks after the unit attacks or is hit, or moves over an open hex. A move that only crosses cover (forest / long grass) stays hidden, and the opponent does not see the step. Stepping onto cover again hides them. Owner still sees them. The hidden and exhausted icons follow the live status and leave when it ends</dd>
          <dd><strong>Category</strong> Modern / Ancient / Futuristic — filter above. Stock Ancient: Archer, Javelin, Horse archer, Light cavalry, Chariot archer, Cohort, Hoplite, Elephant, Barbarian, Peasant, Builder, Dude, Wolf, Catapult, Ballista. Stock Modern: Soldier, Scout, Bazooka, Sniper, Tank, General, Tower, Dummy. Stock Futuristic: Fighter, Gunship, Bomber, Frigate, Cruiser, Dreadnought</dd>
          <dd><strong>Kit</strong> icon + pathing through pieces / infantry. Does not reset numbers. Water and climb are per-unit, not kit. Tower, Javelin, Horse archer, Dude, Wolf and the spaceship kits are glyph only</dd>
          <dd><strong>Abilities</strong> granted independently of kit. Hide / Javelin / Charge / Lunge / Build / Shields up / Bash / Berserk / Inspire replace the Special dock slot (a unit can have several). Build picks Trap, Palisade, Bridge, or Remove, then an adjacent hex. Shields up, Bash, Berserk, and Inspire fire when you press the button. Inspire (1 action, 1 turn) gives +1 attack / +1 armor to every same-side unit chained to the inspirer (not the inspirer itself unless a second source is in the chain); no stacking, lost when the chain breaks. Experimental: Generals inspire passively (localStorage chessarmy-exp-general-inspires = 0 turns it off). Lunge is also a promotion (grants the ability to zero-melee kits; thrust only along non-red melee faces). Inspire is also a promotion (grants the ability). Scout places the unit hidden at battle start (+2 map regenerates each in roguelite). Wealthy pays +1g after a win. Command is the General promotion, not an ability</dd>
          <dd><strong>Copy</strong> duplicates a unit (same kit / icon / rules). Rename, recategorize, or switch kit. Delete only copies.</dd>
          <dt>Move</dt>
          <dd><strong>Range</strong> hexes in a straight line per action. Standing on a hill, plateau, or mountain does not add steps</dd>
          <dd><strong>Move cap</strong> total steps this activation, including AP extras (0 = none; scout stock 3). Cannot go past it</dd>
          <dd><strong>AP max</strong> pool. Spend 1 to climb, to stay in water at the start of your turn, or for an extra straight-line action within Max AP spent / turn — still inside the move cap. Unused steps of an action are lost</dd>
          <dd><strong>Move to water</strong> stop on water hexes (that move ends momentum). Can't step in with 0 AP and 2 HP or less. From water: 1 hex per action, cannot shoot. Start of turn in water: 1 AP penalty (not an action), or 2 HP if you can't pay — leftover spendable AP can still buy an extra 1-hex</dd>
          <dd><strong>Climb level</strong> max height: 0 land, Hill lvl.1, Plateau lvl.2, Mountain lvl.3. Step ±1 only</dd>
          <dd><strong>Melee dmg</strong> bump an occupied hex; a kill takes the spot, else stop on the hex before. 0 = cannot melee</dd>
          <dd><strong>Charge</strong> damage of the Charge special (ability required). 0 still hits for 1 if they have the ability. Hover charge dests when the dock toggle is on. No charge icon on the piece in play. Hopping over a unit still deals charge damage. Walk-to orders still work when Charge is off. A crash inside the normal move spends nothing and shows no AP mark. A destination past that move shows the normal AP bolt and spends 1 when you pick it. With no spendable AP left, that tile shows the crossed bolt instead. Same as palisade: a living blocker stops you unless that hit kills them, or you land empty beyond. Forest: charge cannot pass through</dd>
          <dt>Shoot</dt>
          <dd><strong>Range</strong> fire distance. 0 = cannot shoot (hides the rest). Shooter on hill +1, plateau +2, mountain +3. A high target costs that much extra range</dd>
          <dd><strong>DMG</strong> bullets</dd>
          <dd><strong>Reload time</strong> own turns you can't shoot after firing</dd>
          <dd><strong>Ammo limit</strong> shots this match (0 = unlimited)</dd>
          <dd><strong>Arc</strong> Straight: units, palisades and forest block from low. Arch: fire over units, palisades and forest. Laser: target like Arch through units — click the enemy; everyone on the beam takes shoot damage; breakable wood still blocks. Walls / higher ground still block</dd>
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
      <p class="muted ai-editor-lead">Same order the AI actually runs: walking filters, then melee/shooting if anyone can hit, then who to hunt, then chase, defend, retreat. Check a box to run that rule for that style (level editor, next to player / AI). Default is <strong>aggressive</strong>. <strong>Advance</strong> walks the army toward the far edge together. Stock = the defaults below.</p>
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
        <p class="muted">Sections are pickAiAction order. Unchecked rules are skipped — the AI falls through to whatever is still on. Per-army style is stored on the level.</p>
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
        if (f === 'sight') {
          inp.min = String(defaultSight(UNIT_STATS[type].move, UNIT_STATS[type].shoot));
        }
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
  app.querySelectorAll<HTMLSelectElement>('[data-unit-class]').forEach((el) => {
    el.addEventListener('change', () => {
      const type = el.dataset.unitClass as UnitType | undefined;
      if (!type) return;
      patchUnitClass(type, sanitizeUnitClass(el.value));
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
  if (id !== 'board-text' && id !== 'story-text') markEditorDirty();
}

function bindEditorGridControls(): void {
  app.querySelector('#editor-undo')?.addEventListener('click', () => undoEditor());
  app.querySelector('#editor-clear')?.addEventListener('click', () => {
    const { cols, rows } = currentGrid();
    pushEditorUndo();
    editorTerrain = emptyTerrain(cols, rows);
    editorTokens = [];
    editorDirty = true;
    render();
  });
  const commitGridSize = () => {
    const colsEl = app.querySelector<HTMLInputElement>('#editor-cols');
    const rowsEl = app.querySelector<HTMLInputElement>('#editor-rows');
    editorRectRows = rowsEl ? Number(rowsEl.value) : currentGrid().rows;
    applyEditorGrid(
      colsEl ? Number(colsEl.value) : currentGrid().cols,
      rowsEl ? Number(rowsEl.value) : currentGrid().rows,
    );
  };
  app.querySelector('#editor-cols')?.addEventListener('change', commitGridSize);
  app.querySelector('#editor-rows')?.addEventListener('change', commitGridSize);
  app.querySelector('#editor-hex')?.addEventListener('change', (e) => {
    const on = (e.target as HTMLInputElement).checked;
    if (on === editorHex) return;
    if (on) {
      const { cols, rows } = currentGrid();
      editorRectRows = rows;
      editorRadius = Math.max(1, Math.floor(cols / 2));
      applyHexBoard();
      return;
    }
    applyRectBoard(editorRadius * 2, editorRectRows);
  });
  app.querySelector('#editor-radius')?.addEventListener('change', (e) => {
    editorRadius = Math.max(1, Math.min(10, Math.floor(Number((e.target as HTMLInputElement).value)) || 1));
    applyHexBoard();
  });
  app.querySelectorAll<HTMLButtonElement>('[data-ori]').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyEditorOrientation(btn.dataset.ori as HexOrientation);
    });
  });
}

function renderTerrainPreviewPanel(): string {
  const grid = currentGrid();
  return `
    <section class="editor-panel editor-panel-terrain-preview">
      <div class="editor-panel-head">
        <h3>Preview board</h3>
        <div class="editor-panel-head-actions">
          <button type="button" id="editor-undo" class="ghost">Undo</button>
          <button type="button" id="editor-clear" class="ghost">Clear</button>
        </div>
      </div>
      <div class="editor-grid">
        <label class="chk">
          <input type="checkbox" id="editor-hex"${editorHex ? ' checked' : ''} />
          Hex
        </label>
        ${
          editorHex
            ? `<label>R <input type="number" id="editor-radius" min="1" max="10" value="${editorRadius}" title="Tiles from the center to the edge" /></label>`
            : `<label>W <input type="number" id="editor-cols" min="${MIN_COLS}" max="${MAX_COLS}" value="${grid.cols}" /></label>
        <label>H <input type="number" id="editor-rows" min="${MIN_ROWS}" max="${MAX_ROWS}" value="${grid.rows}" /></label>`
        }
        <button type="button" data-ori="pointy" class="${editorOrientation === 'pointy' ? 'active' : ''}">Point up</button>
        <button type="button" data-ori="flat" class="${editorOrientation === 'flat' ? 'active' : ''}">Flat up</button>
      </div>
      <p class="muted">Preview only — nothing here is saved as a level. Presets are what you save.</p>
    </section>`;
}

function bindTerrainOnlyEvents(): void {
  bindEditorGridControls();
  bindTerrainGenEvents();
}

function bindEditorEvents() {
  bindEditorBoardPopup();
  bindEditorStoryPopup();
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
  bindEditorGridControls();
  app.querySelector('#editor-name')?.addEventListener('change', (e) => {
    editorName = (e.target as HTMLInputElement).value;
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
  const audioSlot = (raw: string | undefined): EditorAudioSlot | null =>
    raw === 'start' || raw === 'win' || raw === 'lose' ? raw : null;
  app.querySelectorAll<HTMLButtonElement>('[data-audio-link]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const slot = audioSlot(btn.dataset.audioLink);
      if (slot) void openLevelAudioPick(slot);
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-audio-generate]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const slot = audioSlot(btn.dataset.audioGenerate);
      if (slot) void openEditorTts(slot);
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-audio-play]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const slot = audioSlot(btn.dataset.audioPlay);
      if (slot) toggleLevelAudio(slot);
    });
  });
  app.querySelector('#tts-cancel')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeEditorTts();
    render();
  });
  app.querySelector('#tts-generate')?.addEventListener('click', (e) => {
    e.stopPropagation();
    void runEditorTtsGenerate();
  });
  app.querySelector('#tts-use')?.addEventListener('click', (e) => {
    e.stopPropagation();
    void useEditorTtsClip();
  });
  app.querySelector<HTMLSelectElement>('#tts-voice')?.addEventListener('change', (e) => {
    e.stopPropagation();
    if (!editorTts) return;
    const id = (e.target as HTMLSelectElement).value;
    if (!id) return;
    editorTts.voiceId = id;
    saveTtsVoiceId(id);
  });
  app.querySelector<HTMLTextAreaElement>('#tts-text')?.addEventListener('input', (e) => {
    if (!editorTts) return;
    setEditorSlotText(editorTts.slot, (e.target as HTMLTextAreaElement).value);
    markEditorDirty();
  });
  app.querySelectorAll<HTMLButtonElement>('[data-tts-select]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!editorTts || editorTts.saving || editorTts.generating) return;
      const file = btn.dataset.ttsSelect ?? '';
      if (!sanitizeLevelAudio(file)) return;
      editorTts.selectedFile = file;
      render();
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-tts-play-file]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const file = btn.dataset.ttsPlayFile ?? '';
      if (sanitizeLevelAudio(file)) toggleTtsTake(file);
    });
  });
  app.querySelector('.tts-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget && editorTts && !editorTts.saving && !editorTts.generating) {
      closeEditorTts();
      render();
    }
  });
  app.querySelectorAll<HTMLButtonElement>('[data-audio-clear]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const slot = audioSlot(btn.dataset.audioClear);
      if (!slot) return;
      setEditorAudioFile(slot, '');
      editorAudioPick = null;
      markEditorDirty();
      render();
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-audio-choose]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const slot = audioSlot(btn.dataset.audioSlot);
      const file = btn.dataset.audioChoose ?? '';
      if (!slot || !sanitizeLevelAudio(file)) return;
      setEditorAudioFile(slot, file);
      editorAudioPick = null;
      editorAudioError = '';
      markEditorDirty();
      render();
    });
  });
  app.querySelectorAll<HTMLInputElement>('[data-audio-upload]').forEach((input) => {
    input.addEventListener('change', () => {
      const slot = audioSlot(input.dataset.audioUpload);
      const file = input.files?.[0];
      if (!slot || !file) return;
      void uploadLevelAudio(file)
        .then(async (name) => {
          setEditorAudioFile(slot, name);
          editorAudioFiles = await listLevelAudio().catch(() => editorAudioFiles);
          editorAudioPick = null;
          editorAudioError = '';
          markEditorDirty();
          if (screen === 'editor') render();
        })
        .catch((err: unknown) => {
          editorAudioError = err instanceof Error ? err.message : 'upload failed';
          if (screen === 'editor') render();
        });
    });
  });
  audioPickAbort?.abort();
  audioPickAbort = null;
  if (editorAudioPick) {
    audioPickAbort = new AbortController();
    app.addEventListener(
      'click',
      (e) => {
        const t = e.target;
        if (!(t instanceof Element)) return;
        if (t.closest('.level-audio-pick, [data-audio-link], .level-audio-actions')) return;
        editorAudioPick = null;
        editorAudioError = '';
        render();
      },
      { signal: audioPickAbort.signal },
    );
  }
  app.querySelectorAll<HTMLElement>('[data-star][data-star-field]').forEach((el) => {
    el.addEventListener('change', () => {
      if (el instanceof HTMLSelectElement && el.dataset.starField === 'metric') {
        const n = el.dataset.star === '3' ? 3 : 2;
        const metric = sanitizeStarMetric(el.value);
        const opEl = app.querySelector<HTMLSelectElement>(
          `[data-star="${n}"][data-star-field="op"]`,
        );
        if (opEl) {
          const loss = starMetricIsLoss(metric);
          if (loss && (opEl.value === 'gte' || opEl.value === 'gt')) opEl.value = 'lt';
          if (!loss && (opEl.value === 'lt' || opEl.value === 'lte')) opEl.value = 'gte';
        }
      }
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
  const glyphFilter = app.querySelector<HTMLInputElement>('#glyph-filter');
  glyphFilter?.addEventListener('input', () => {
    editorGlyphQuery = glyphFilter.value;
    applyGlyphFilter();
  });
  if (glyphFilter) applyGlyphFilter();
  app.querySelector('#army-name')?.addEventListener('change', (e) => {
    editorFormationName = (e.target as HTMLInputElement).value;
  });
  app.querySelectorAll<HTMLButtonElement>('[data-army-side]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const side = btn.dataset.armySide;
      if (!isSide(side)) return;
      editorArmySide = side;
      editorLoadEdge = ownedEditorEdge(side);
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
    const { slots } = captureFormation(
      editorPieces,
      editorArmySide,
      cols,
      rows,
      ownedEditorEdge(editorArmySide),
    );
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
    pushEditorUndo();
    editorPieces = editorPieces.filter((p) => p.side !== editorArmySide);
    for (const e of ARMY_EDGES) {
      if (editorEdgeOwner[e] === editorArmySide) editorEdgeOwner[e] = null;
    }
    markEditorDirty();
    render();
  });
  app.querySelectorAll<HTMLButtonElement>('[data-army-edge]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const edge = btn.dataset.armyEdge;
      if (!isArmyEdge(edge)) return;
      editorLoadEdge = edge;
      render();
    });
  });
  const applyFormation = (id: string) => {
    const { cols, rows } = currentGrid();
    const form =
      id === STOCK_FORMATION_ID ? stockFormation(cols, rows) : getFormation(id);
    if (!form) return;
    pushEditorUndo();
    const evicted = claimEditorEdge(editorArmySide, editorLoadEdge);
    const added = stampFormation(form, editorArmySide, cols, rows, editorLoadEdge);
    const taken = new Set(added.map((p) => `${p.col},${p.row}`));
    editorPieces = [
      ...editorPieces.filter(
        (p) =>
          p.side !== editorArmySide &&
          p.side !== evicted &&
          !taken.has(`${p.col},${p.row}`),
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
  bindTerrainGenEvents();
  bindEditorBoard();
}

/**
 * An exact mirror needs a middle line: odd rows for top/bottom, odd columns for
 * left/right, even both for the 180° turn. Nudge a rectangular board by one.
 */
function mirrorFitSize(cols: number, rows: number): { cols: number; rows: number } {
  const want = (n: number, max: number, min: number, odd: boolean) => {
    if (n % 2 === (odd ? 1 : 0)) return n;
    if (n + 1 <= max) return n + 1;
    return Math.max(min, n - 1);
  };
  const m = editorTerrainCfg.mirror;
  if (m === 'reversed') {
    return {
      cols: want(cols, MAX_COLS, MIN_COLS, false),
      rows: want(rows, MAX_ROWS, MIN_ROWS, false),
    };
  }
  if (m === 'mirror' && editorTerrainCfg.mirrorAxis === 'lr') {
    return { cols: want(cols, MAX_COLS, MIN_COLS, true), rows };
  }
  if (m === 'mirror') return { cols, rows: want(rows, MAX_ROWS, MIN_ROWS, true) };
  return { cols, rows };
}

function runTerrainGen(): void {
  let resized = '';
  if (!editorHex && editorTerrainCfg.mirror !== 'off') {
    const cur = currentGrid();
    const fit = mirrorFitSize(cur.cols, cur.rows);
    if (fit.cols !== cur.cols || fit.rows !== cur.rows) {
      editorRectRows = fit.rows;
      applyEditorGrid(fit.cols, fit.rows);
      resized = ` Board set to ${fit.cols}×${fit.rows} for an exact mirror.`;
    }
  }
  const { cols, rows } = currentGrid();
  if (!editorTerrainLockSeed) editorTerrainSeed = randomSeed();
  pushEditorUndo();
  const res = generateTerrain(editorTerrainCfg, {
    terrain: editorTerrain,
    tokens: editorTokens,
    occupied: editorPieces,
    orientation: editorOrientation,
    onBoard: inEditorHex,
    seed: editorTerrainSeed,
  });
  editorTerrain = res.terrain;
  editorTokens = sanitizeTokens(res.tokens, cols, rows);
  editorBoardHex = null;
  editorStoryHex = null;
  editorTerrainStatus = `Seed ${editorTerrainSeed}. ${describePlaced(res.placed)}.${resized}`;

  editorTerrainGenOpen = true;
  editorDirty = true;
  render();
}

function loadTerrainPreset(id: string): boolean {
  const p = getTerrainPreset(id);
  if (!p) return false;
  editorTerrainCfg = cloneTerrainConfig(p);
  editorTerrainPresetId = p.id;
  editorTerrainName = p.name;
  editorTerrainGenOpen = true;
  return true;
}

function bindTerrainGenEvents(): void {
  app.querySelector<HTMLDetailsElement>('[data-editor-terrain]')?.addEventListener('toggle', (e) => {
    editorTerrainGenOpen = (e.currentTarget as HTMLDetailsElement).open;
  });
  app.querySelectorAll<HTMLButtonElement>('[data-terrain-load]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (loadTerrainPreset(btn.dataset.terrainLoad!)) {
        editorTerrainStatus = '';
        render();
      }
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-terrain-run]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (loadTerrainPreset(btn.dataset.terrainRun!)) runTerrainGen();
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-terrain-reset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Restore this built-in preset to its factory settings?')) return;
      const id = btn.dataset.terrainReset!;
      const p = resetBuiltinTerrainPreset(id);
      if (p && editorTerrainPresetId === id) {
        editorTerrainCfg = cloneTerrainConfig(p);
        editorTerrainName = p.name;
      }
      render();
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-terrain-del]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Delete this terrain preset?')) return;
      const id = btn.dataset.terrainDel!;
      deleteTerrainPreset(id);
      if (editorTerrainPresetId === id) editorTerrainPresetId = null;
      render();
    });
  });
  // Sliders edit the draft in place — no re-render, so drags are not interrupted.
  app.querySelectorAll<HTMLInputElement>('input[data-tg-layer]').forEach((el) => {
    el.addEventListener('input', () => {
      const id = el.dataset.tgLayer as TerrainLayerId;
      const field = el.dataset.tgField as 'amount' | 'link';
      const v = Number(el.value);
      editorTerrainCfg.layers[id][field] = v;
      const out = app.querySelector<HTMLOutputElement>(`[data-tg-val="${id}:${field}"]`);
      if (out) out.textContent = `${v}%`;
      app
        .querySelector(`[data-tg-row="${id}"]`)
        ?.classList.toggle('on', editorTerrainCfg.layers[id].amount > 0);
    });
  });
  app.querySelectorAll<HTMLSelectElement>('select[data-tg-layer]').forEach((el) => {
    el.addEventListener('change', () => {
      const id = el.dataset.tgLayer as TerrainLayerId;
      editorTerrainCfg.layers[id].bias = el.value as LayerBias;
    });
  });
  app.querySelector<HTMLInputElement>('#terrain-name')?.addEventListener('change', (e) => {
    editorTerrainName = (e.target as HTMLInputElement).value;
  });
  app.querySelector<HTMLInputElement>('#terrain-replace')?.addEventListener('change', (e) => {
    editorTerrainCfg.replace = (e.target as HTMLInputElement).checked;
  });
  app.querySelector<HTMLInputElement>('#terrain-ramps')?.addEventListener('change', (e) => {
    editorTerrainCfg.ramps = (e.target as HTMLInputElement).checked;
    if (editorTerrainCfg.ramps) {
      editorTerrainCfg.singleRamps = false;
      const single = app.querySelector<HTMLInputElement>('#terrain-single-ramps');
      if (single) single.checked = false;
    }
  });
  app.querySelector<HTMLInputElement>('#terrain-single-ramps')?.addEventListener('change', (e) => {
    editorTerrainCfg.singleRamps = (e.target as HTMLInputElement).checked;
    if (editorTerrainCfg.singleRamps) {
      editorTerrainCfg.ramps = false;
      const all = app.querySelector<HTMLInputElement>('#terrain-ramps');
      if (all) all.checked = false;
    }
  });
  app.querySelector<HTMLSelectElement>('#terrain-mirror')?.addEventListener('change', (e) => {
    editorTerrainCfg.mirror = (e.target as HTMLSelectElement).value as MirrorMode;
    const axisLabel = app.querySelector<HTMLElement>('#terrain-mirror-axis-label');
    if (axisLabel) axisLabel.hidden = editorTerrainCfg.mirror !== 'mirror';
  });
  app.querySelector<HTMLSelectElement>('#terrain-mirror-axis')?.addEventListener('change', (e) => {
    editorTerrainCfg.mirrorAxis = (e.target as HTMLSelectElement).value as MirrorAxis;
  });
  app.querySelector<HTMLSelectElement>('#terrain-difficulty')?.addEventListener('change', (e) => {
    editorTerrainCfg.difficulty = Math.max(
      0,
      Math.min(MAX_TERRAIN_DIFFICULTY, Number((e.target as HTMLSelectElement).value) || 0),
    );
  });
  app.querySelector<HTMLInputElement>('#terrain-bleed')?.addEventListener('input', (e) => {
    const v = Number((e.target as HTMLInputElement).value);
    editorTerrainCfg.bleed = v;
    const out = app.querySelector<HTMLOutputElement>('#terrain-bleed-val');
    if (out) out.textContent = `${v}%`;
  });
  app.querySelector<HTMLInputElement>('#terrain-clear')?.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    editorTerrainCfg.clearRadius = Math.max(
      0,
      Math.min(MAX_CLEAR_RADIUS, Math.floor(Number(el.value)) || 0),
    );
    el.value = String(editorTerrainCfg.clearRadius);
  });
  app.querySelector<HTMLInputElement>('#terrain-seed')?.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    editorTerrainSeed = Math.max(0, Math.min(999999, Math.floor(Number(el.value)) || 0));
    el.value = String(editorTerrainSeed);
    // Typing a seed means "use this one".
    editorTerrainLockSeed = true;
    const lock = app.querySelector<HTMLInputElement>('#terrain-lock');
    if (lock) lock.checked = true;
  });
  app.querySelector<HTMLInputElement>('#terrain-lock')?.addEventListener('change', (e) => {
    editorTerrainLockSeed = (e.target as HTMLInputElement).checked;
  });
  const save = (asNew: boolean) => {
    const nameEl = app.querySelector<HTMLInputElement>('#terrain-name');
    if (nameEl) editorTerrainName = nameEl.value;
    const typed = editorTerrainName.trim() || 'Untitled terrain';
    // The name decides: same name as an existing preset = overwrite it (after a confirm
    // unless it is the one loaded). A built-in keeps its factory copy and stores the edit
    // as an override (↺ restores it). Any other name = a new preset.
    let existing: string | null = null;
    let name = typed;
    const clash = findTerrainPresetByName(typed);
    if (asNew) {
      name = uniqueTerrainName(typed);
    } else if (clash?.builtin) {
      if (clash.id !== editorTerrainPresetId && !confirm(`Overwrite built-in "${clash.name}"?`)) return;
      saveBuiltinTerrainPreset(clash.id, editorTerrainCfg);
      editorTerrainPresetId = clash.id;
      editorTerrainName = clash.name;
      editorTerrainStatus = `Saved built-in "${clash.name}" (↺ in the list restores the original).`;
      render();
      return;
    } else if (clash) {
      if (clash.id !== editorTerrainPresetId && !confirm(`Overwrite "${clash.name}"?`)) return;
      existing = clash.id;
    }
    const saved = saveTerrainPreset(name, editorTerrainCfg, existing);
    editorTerrainPresetId = saved.id;
    editorTerrainName = saved.name;
    editorTerrainStatus =
      saved.name === typed
        ? `${existing ? 'Updated' : 'Saved'} "${saved.name}".`
        : `"${typed}" is taken — saved as "${saved.name}".`;
    render();
  };
  app.querySelector('#terrain-save')?.addEventListener('click', () => save(false));
  app.querySelector('#terrain-save-as')?.addEventListener('click', () => save(true));
  app.querySelector('#terrain-generate')?.addEventListener('click', () => runTerrainGen());
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
        editorStartAudio = '';
        editorWinAudio = '';
        editorLoseAudio = '';
        editorAudioPick = null;
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
    if (editorTerrainOnly) bindTerrainOnlyEvents();
    else bindEditorEvents();
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
  if (screen === 'roguelite') {
    bindRogueConfigEvents();
    return;
  }
  if (screen === 'unlocks') {
    bindRogueEraFilter();
    return;
  }

  app.querySelector('#new-map')?.addEventListener('click', () => {
    if (activeLevelId) startMatch(false);
    else reset(true);
  });
  app.querySelector<HTMLSelectElement>('#rogue-terrain')?.addEventListener('change', (e) => {
    setRogueTerrainId((e.target as HTMLSelectElement).value);
  });
  app.querySelector('#rogue-generate')?.addEventListener('click', () => reset(true));
  app.querySelector('#start-hotseat')?.addEventListener('click', () => {
    mode = 'hotseat';
    playlist = null;
    startMatch(false);
  });
  app.querySelector('#end-rematch')?.addEventListener('click', () => reset(false));
  app.querySelector('#end-next')?.addEventListener('click', () => skipBriefing());
  app.querySelector('#end-rogue-next')?.addEventListener('click', () => advanceRogueBattle());
  app.querySelector('#end-rogue-retry')?.addEventListener('click', () => startRogueRun());
  app.querySelectorAll<HTMLButtonElement>('[data-rogue-buy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.rogueBuy);
      if (!Number.isFinite(i)) return;
      buyRogueOffer(i);
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-rogue-promo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.roguePromo);
      if (!Number.isFinite(i)) return;
      beginRoguePromoAssign(i);
    });
  });
  const assignDetail = app.querySelector('#rogue-assign-detail');
  const showAssignResume = (text: string | null) => {
    if (!assignDetail) return;
    if (text) {
      assignDetail.textContent = text;
      assignDetail.classList.add('is-hot');
    } else {
      assignDetail.textContent = 'Hover a unit';
      assignDetail.classList.remove('is-hot');
    }
  };
  app.querySelectorAll<HTMLButtonElement>('[data-rogue-promo-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.roguePromoTarget;
      if (!id) return;
      confirmRoguePromoAssign(id);
    });
    btn.addEventListener('mouseenter', () => showAssignResume(btn.dataset.rogueResume ?? null));
    btn.addEventListener('focus', () => showAssignResume(btn.dataset.rogueResume ?? null));
    btn.addEventListener('mouseleave', () => {
      if (app.querySelector('.rogue-promo-target:focus')) return;
      showAssignResume(null);
    });
    btn.addEventListener('blur', () => {
      if (app.querySelector('.rogue-promo-target:hover')) return;
      showAssignResume(null);
    });
  });
  app.querySelector('#rogue-promo-cancel')?.addEventListener('click', () => {
    cancelRoguePromoAssign();
  });
  app.querySelector('#end-start')?.addEventListener('click', () => showStart());
  bindBoardPopup();
  app.querySelector('#briefing-go')?.addEventListener('click', () => {
    const intro = levelCopy('start');
    briefingOpen = false;
    armTutorialHands(intro);
    maybeStartScoutPrep();
    render();
    if (!scoutPrepBlocks()) void maybeAi();
  });
  app.querySelectorAll<HTMLButtonElement>('[data-scout-place]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.scoutPlace;
      if (id) beginScoutPlace(id);
    });
  });
  app.querySelector('#scout-regen')?.addEventListener('click', () => regenScoutMap());
  app.querySelector('#scout-begin')?.addEventListener('click', () => finishScoutPrep());
  app.querySelector('#popup-audio')?.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopupAudio();
  });
  app.querySelector('#briefing-skip')?.addEventListener('click', () => skipBriefing());
  app.querySelector('#open-levels')?.addEventListener('click', () => {
    enterLevels();
  });
  app.querySelector('.unit-dock')?.addEventListener(
    'click',
    () => {
      clearTutorialCue();
    },
    true,
  );
  app.querySelectorAll<HTMLButtonElement>('[id^="special-"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.id.slice('special-'.length);
      if (id === 'action') return;
      if (
        id === 'bash' ||
        id === 'berserk' ||
        id === 'shields' ||
        id === 'inspire' ||
        id === 'reload'
      ) {
        void useInstantSpecial(id);
        return;
      }
      if (isAbilityId(id)) setSpecialMode(id);
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[id^="build-kind-"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = btn.id.slice('build-kind-'.length);
      if (!isBuildStructure(kind)) return;
      buildStructure = kind;
      specialMode = 'build';
      buildPickOpen = false;
      refreshHighlights();
      render();
    });
  });
  app.querySelector('#end-turn')?.addEventListener('click', () => {
    void (async () => {
      if (!canControl() || animating) return;
      animating = true;
      const actingId = selectedId;
      const turnBefore = state.turn;
      state = passTurn(state);
      if (state.turn !== turnBefore) specialMode = null;
      applyHotseatTint();
      updateChrome();
      await playPendingFx();
      animating = false;
      if (actingId) retainSelection(actingId);
      else clearSelection();
      ensureTurnSelection();
      render();
      void maybeAi();
    })();
  });
  bindHexChoice();
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
  app.querySelector('#map-forest')?.addEventListener('change', (e) => {
    mapOpts.forestCount = Number((e.target as HTMLInputElement).value);
  });
  app.querySelector('#map-high')?.addEventListener('change', (e) => {
    mapOpts.highCount = Number((e.target as HTMLInputElement).value);
  });
  app.querySelector('#map-plateau')?.addEventListener('change', (e) => {
    mapOpts.plateauCount = Number((e.target as HTMLInputElement).value);
  });
  bindBoardOnly();
  playRogueGoldFx();
}

function render() {
  // Inspiration is derived from the board — keep the glow honest for any loaded state.
  if (state) refreshInspiration(state);
  if (screen !== 'editor') {
    editorAudioPick = null;
    if (editorAudioPlaying) haltLevelAudio();
    if (editorTts) closeEditorTts();
  }
  syncPopupNarration();
  installSfx(app);
  if (state) {
    sfxObserve({
      screen,
      turn: state.turn,
      turnNumber: state.turnNumber,
      winner: state.winner,
      playerTurn: isPlayerControlled(state, state.turn),
      won: playerTeamWon(state),
      vsEnemy: matchHasEnemies(state),
      turnsLeft: turnsLeft(),
    });
  }
  maybeRecordLevelWin();
  if (screen === 'play' && rogueRun && state.winner) {
    if (playerTeamWon(state)) ensureRogueShop();
    else ensureRogueLossProgress();
  }
  applyPeriodTheme(activePeriod());
  applyHotseatTint();
  app.classList.toggle('start-screen', screen === 'start');
  app.classList.toggle(
    'editor-screen',
    screen === 'levels' || screen === 'units' || screen === 'ai' || screen === 'roguelite' || screen === 'unlocks' || screen === 'editor',
  );

  if (screen === 'start') {
    app.innerHTML = renderStartScreen();
    bindEvents();
    return;
  }

  if (screen === 'campaign-play') {
    if (!campaignPlay) {
      app.innerHTML = `<div class="board-wrap start-wrap"><p class="start-tag">Loading Total war…</p></div>`;
    }
    return;
  }

  if (screen === 'campaign-map') {
    if (!campaignEditor) {
      app.innerHTML = `<div class="board-wrap start-wrap"><p class="start-tag">Loading TW editor…</p></div>`;
    }
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

  if (screen === 'roguelite') {
    if (!rogueAdminDraft) rogueAdminDraft = cloneRogueConfig(getRogueConfig());
    app.innerHTML = `
      <div class="board-wrap start-wrap levels-wrap unit-editor-wrap">
        ${renderToolbar()}
        ${renderRogueConfigPage(rogueAdminDraft, rogueAdminDirty)}
      </div>
    `;
    bindEvents();
    return;
  }

  if (screen === 'unlocks') {
    app.innerHTML = `
      <div class="board-wrap start-wrap levels-wrap unit-editor-wrap">
        ${renderToolbar()}
        ${renderRogueUnlocksPage()}
      </div>
    `;
    bindEvents();
    return;
  }

  if (screen === 'editor' && editorTerrainOnly) {
    app.innerHTML = `
      <div class="board-wrap editor-mode terrain-only">
        ${renderToolbar()}
        <div class="terrain-only-top">
          ${renderTerrainGenPanel()}
          ${renderTerrainPreviewPanel()}
        </div>
        <div class="board-stage">
          ${renderBoard()}
        </div>
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
            ${renderPromotionPanel()}
          </div>
          ${renderArmySelectPanel()}
        </div>
        <div class="board-stage">
          ${renderBoard()}
        </div>
        ${renderEditorBar()}
      </div>
      ${renderEditorBoardPopup()}
      ${renderEditorStoryPopup()}
      ${renderEditorTtsPopup()}
    `;
    bindEvents();
    return;
  }

  app.innerHTML = `
    <div class="board-wrap ${gameOverClass()}">
      ${renderToolbar()}
      ${starGoalsHtml()}
      <div class="board-stage">
        <div class="turns-left-slot">${turnsLeftHtml()}</div>
        ${renderBoard()}
        ${renderHexChoice()}
        ${renderScoutPrep()}
        ${state.winner ? renderEndOverlay() : renderStartOverlay()}
        ${renderRoguePromoAssign()}
        ${renderBoardPopup()}
      </div>
      <div class="play-dock">
        ${renderOtherTurnBanner()}
        ${renderEndTurn()}
        ${renderActionBar()}
        ${renderUnitDock()}
      </div>
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
  await loadRogueConfig();
  if (screen === 'roguelite' && rogueAdminDraft && !rogueAdminDirty) {
    rogueAdminDraft = cloneRogueConfig(getRogueConfig());
  }
  if (screen === 'start' || screen === 'roguelite' || screen === 'unlocks') render();
  const { applied } = await syncFromServer();
  const account = await syncAccountProgress();
  defaultLevelId = getDefaultLevelId();
  if (applied && screen === 'play' && !playlist) {
    activeLevelId = defaultLevelId ?? getActiveLevelId();
    state = bootState();
    applyLayout(computeLayout(), false);
    render();
    return;
  }
  if (applied || account.applied || getAccountStatus() !== 'checking') {
    render();
    return;
  }
  paintSyncDot();
}

if (wantsUnlocksRoute()) enterRogueUnlocks();
else if (wantsRogueAdminRoute()) enterRogueConfig();
else render();
void initServerSync();
window.addEventListener('resize', scheduleLayoutRefresh);
window.addEventListener('orientationchange', () => {
  window.setTimeout(refreshLayout, 220);
});

function isBuildPickEventTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!(target.closest('.build-pick') || target.closest('#special-build'));
}

window.addEventListener('pointerdown', (e) => {
  if (!buildPickOpen) return;
  if (isBuildPickEventTarget(e.target)) return;
  buildPickOpen = false;
  window.setTimeout(() => {
    if (!buildPickOpen) render();
  }, 0);
});

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (boardPopup || briefingOpen) return;
  if (!buildPickOpen && specialMode !== 'build') return;
  e.preventDefault();
  buildPickOpen = false;
  if (specialMode === 'build') {
    specialMode = null;
    pendingHex = null;
    hoverHex = null;
    hoverPath = [];
    commitPath = [];
    refreshHighlights();
  }
  render();
});
