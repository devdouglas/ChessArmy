import './style.css';
import {
  ABILITY_BLURB,
  ABILITY_IDS,
  ABILITY_LABEL,
  abilitiesOf,
  applyAction,
  clampUnitsPerTurn,
  defeatKind,
  hasActed,
  MAX_UNITS_PER_TURN,
  MIN_UNITS_PER_TURN,
  passTurn,
  getPiece,
  ammoLeft,
  hpLeft,
  hpMax,
  isDepleted,
  isReloading,
  legalHighlights,
  stickyMovePlan,
  pieceAt,
  previewMove,
  rangeHighlights,
  resolveMovePath,
  armorColor,
  facingOf,
  hasSplash,
  HEX_ARMOR_LABEL,
  HEX_ARMOR_SIDES,
  netDamage,
  splashBlast,
  staminaLeft,
  staminaMax,
  STOCK_UNIT_TYPES,
  UNIT_CATEGORIES,
  UNIT_CATEGORY_LABEL,
  UNIT_ROLE_LABEL,
  UNIT_STATS,
  UNIT_TYPES,
  isAbilityId,
  isCustomUnitId,
  isUnitRole,
  SHOOT_ARCS,
  SHOOT_ARC_LABEL,
  sanitizeShootArc,
  sanitizeUnitCategory,
  type Action,
  type GameState,
  type Highlight,
  type Piece,
  type Side,
  type Terrain,
  type UnitCategory,
  type UnitType,
} from './engine';
import {
  defaultFacing,
  dirBetween,
  eq,
  hexCorners,
  hexGridExtent,
  hexToPixel,
  key,
  neighborInDir,
  pixelToHex,
  type Hex,
  type HexDir,
  type HexOrientation,
} from './hex';
import {
  COLS,
  DEFAULT_ORIENTATION,
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
  type ArmyStamp,
  type MapOptions,
} from './map';
import {
  deleteLevel,
  getActiveLevelId,
  getDefaultLevelId,
  getLevel,
  LEVEL_CATEGORIES,
  LEVEL_CATEGORY_LABEL,
  levelsInCategory,
  listLevels,
  saveLevel,
  sanitizeCategory,
  setActiveLevelId,
  setDefaultLevelId,
  type LevelCategory,
  type SavedLevel,
} from './levels';
import {
  PERIODS,
  PERIOD_LABEL,
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
  getDefaultFormationId,
  getFormation,
  listFormations,
  saveFormation,
  setDefaultFormationId,
  slotsEqual,
  stampFormation,
  stockFormation,
} from './formations';
import { pickAiAction } from './ai';
import {
  actedBadgeSvg,
  ammoBadgeSvg,
  hpBadgeSvg,
  abilityBadgeSvg,
  pieceIconSvg,
  reloadBadgeSvg,
  staminaEmptyBadgeSvg,
} from './icons';
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
  getServerStatus,
  onServerStatus,
  serverStatusLabel,
  syncFromServer,
} from './sync';

const APP_VERSION = __APP_VERSION__;
document.title = `Chess Army — v${APP_VERSION}`;

type Mode = 'hotseat' | 'ai';
type ActionMode = 'move' | 'shoot';
type Screen = 'start' | 'play' | 'editor' | 'units';
type Playlist = { kind: 'campaign' | 'tutorial'; ids: string[]; index: number };
type EditorBrush = Terrain | UnitType | 'erase-unit';

const TERRAIN_BRUSHES: { id: Terrain; label: string }[] = [
  { id: 'land', label: 'Land' },
  { id: 'water', label: 'Water' },
  { id: 'rock', label: 'Rock' },
  { id: 'wall', label: 'Wall' },
  { id: 'high', label: 'High' },
];

function isTerrainBrush(b: EditorBrush): b is Terrain {
  return TERRAIN_BRUSHES.some((t) => t.id === b);
}

function isUnitBrush(b: EditorBrush): b is UnitType {
  return UNIT_TYPES.includes(b);
}

let mapOpts: MapOptions = { ...DEFAULT_MAP };
let defaultLevelId: string | null = getDefaultLevelId();
let defaultFormationId: string | null = getDefaultFormationId();
let activeLevelId: string | null = defaultLevelId ?? getActiveLevelId();
let state: GameState = bootState();
let mode: Mode = 'ai';
const humanSide: Side = 'red';
let screen: Screen = 'start';
let selectedPeriod: Period = getSelectedPeriod();
let playlist: Playlist | null = null;
let unitEditorCategory: UnitCategory = 'modern';
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

/** Editor draft */
let editorTerrain: Terrain[][] = emptyTerrain();
let editorOrientation: HexOrientation = DEFAULT_ORIENTATION;
let editorBrush: EditorBrush = 'water';
let editorLevelId: string | null = null;
let editorName = 'New level';
let editorCategory: LevelCategory = 'free';
let editorPeriod: Period = selectedPeriod;
let editorUnitsPerTurn = 1;
let editorPieces: ArmyStamp[] = [];
let editorArmySide: Side = 'red';
let editorUnitCategory: UnitCategory = 'modern';
let editorFormationId: string | null = STOCK_FORMATION_ID;
let editorFormationName = 'New army';
let editorPainting = false;
let editorDirty = false;
let editorPointerAbort: AbortController | null = null;

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
    out.push({ type: p.type, col: p.col, row: p.row, side: p.side });
  }
  return out;
}

function stampsFromPieces(pieces: Piece[]): ArmyStamp[] {
  return pieces.map((p) => ({ type: p.type, col: p.col, row: p.row, side: p.side }));
}

function seedArmies(cols: number, rows: number): ArmyStamp[] {
  return defaultArmyStamps(cols, rows) ?? bothStockStamps(cols, rows);
}

function playArmies(
  cols: number,
  rows: number,
  level?: SavedLevel | null,
): ArmyStamp[] | null {
  if (level && Array.isArray(level.armies)) return level.armies;
  return defaultArmyStamps(cols, rows);
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
          lvl.name,
          lvl.orientation,
          playArmies(lvl.cols, lvl.rows, lvl),
        ),
        lvl,
      );
    }
  }
  return createInitialState(mapOpts, defaultArmyStamps(COLS, ROWS));
}

function startMatch(reshuffleRandom = true) {
  clearSelection();
  aiThinking = false;
  animating = false;
  if (activeLevelId) {
    const lvl = getLevel(activeLevelId);
    if (lvl) {
      state = withLevelRules(
        createStateFromTerrain(
          lvl.terrain,
          lvl.name,
          lvl.orientation,
          playArmies(lvl.cols, lvl.rows, lvl),
        ),
        lvl,
      );
      applyLayout(computeLayout(), false);
      render();
      void maybeAi();
      return;
    }
    activeLevelId = null;
    setActiveLevelId(null);
  }
  if (reshuffleRandom) {
    mapOpts = readMapInputs();
    state = withLevelRules(createInitialState(mapOpts, defaultArmyStamps(COLS, ROWS)));
  } else {
    // Keep current terrain layout; respawn armies
    state = withLevelRules(
      createStateFromTerrain(
        state.terrain,
        undefined,
        state.orientation,
        defaultArmyStamps(state.cols, state.rows),
      ),
    );
  }
  applyLayout(computeLayout(), false);
  render();
  void maybeAi();
}

function withLevelRules(s: GameState, lvl?: SavedLevel | null): GameState {
  s.unitsPerTurn = clampUnitsPerTurn(lvl?.unitsPerTurn ?? 1);
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
  editorTerrain = next;
  editorPieces = clipStamps(editorPieces, next[0]?.length ?? cols, next.length);
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

function flashDamaged(
  hits: readonly { id: string; fatal?: boolean; dealt: number }[],
): Promise<void> {
  if (!hits.length) return Promise.resolve();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dying = false;
  let maxN = 0;
  for (const hit of hits) {
    const n = Math.max(0, Math.floor(hit.dealt));
    if (n <= 0) continue;
    const el = document.querySelector(`g.piece-unit[data-id="${CSS.escape(hit.id)}"]`);
    if (!el) continue;
    el.classList.remove('hit', 'dying');
    void (el as SVGElement).getBoundingClientRect();
    (el as SVGElement).style.setProperty('--hit-n', String(n));
    el.classList.add(hit.fatal ? 'dying' : 'hit');
    if (hit.fatal) dying = true;
    if (n > maxN) maxN = n;
  }
  if (maxN <= 0) return Promise.resolve();
  const blink = reduce ? 140 : HIT_FLASH_MS * maxN;
  return wait(dying && !reduce ? blink + 140 : blink);
}

function viewOrientation(): HexOrientation {
  return screen === 'editor' ? editorOrientation : state.orientation;
}

function pixelOf(h: Hex): { x: number; y: number } {
  const { x, y } = hexToPixel(h, HEX_SIZE, viewOrientation());
  return { x: x + PAD, y: y + PAD };
}

/** Degrees to rotate a piece so local -Y (icon "up") matches current facing. */
function facingRotation(piece: Piece): number {
  const o = viewOrientation();
  const from = { col: piece.col, row: piece.row };
  const n = neighborInDir(from, facingOf(piece), o);
  const a = hexToPixel(from, HEX_SIZE, o);
  const b = hexToPixel(n, HEX_SIZE, o);
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90;
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
  const wallEl = app.querySelector<HTMLInputElement>('#map-wall');
  const highEl = app.querySelector<HTMLInputElement>('#map-high');
  return {
    waterCount: waterEl ? Number(waterEl.value) : mapOpts.waterCount,
    rockCount: rockEl ? Number(rockEl.value) : mapOpts.rockCount,
    wallCount: wallEl ? Number(wallEl.value) : mapOpts.wallCount,
    highCount: highEl ? Number(highEl.value) : mapOpts.highCount,
  };
}

function reset(reshuffle = true) {
  startMatch(reshuffle);
}

function showStart() {
  editorPainting = false;
  screen = 'start';
  playlist = null;
  aiThinking = false;
  animating = false;
  clearSelection();
  render();
}

function startSkirmish(nextMode: Mode) {
  mode = nextMode;
  playlist = null;
  screen = 'play';
  if (activeLevelId && getLevel(activeLevelId)) {
    startMatch(false);
    return;
  }
  if (defaultLevelId && getLevel(defaultLevelId)) {
    activeLevelId = defaultLevelId;
    setActiveLevelId(activeLevelId);
    startMatch(false);
    return;
  }
  activeLevelId = null;
  setActiveLevelId(null);
  startMatch(true);
}

function startPlaylist(kind: 'campaign' | 'tutorial') {
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

function loadEditorLevel(lvl: SavedLevel): void {
  editorTerrain = cloneTerrain(lvl.terrain);
  editorOrientation = lvl.orientation;
  editorLevelId = lvl.id;
  editorName = lvl.name;
  editorCategory = lvl.category;
  editorPeriod = lvl.period;
  editorUnitsPerTurn = clampUnitsPerTurn(lvl.unitsPerTurn);
  const cols = lvl.cols || editorTerrain[0]?.length || COLS;
  const rows = lvl.rows || editorTerrain.length || ROWS;
  editorPieces = Array.isArray(lvl.armies)
    ? clipStamps(lvl.armies, cols, rows)
    : seedArmies(cols, rows);
}

function enterEditor(fromLevelId?: string | null) {
  const lvl = fromLevelId ? getLevel(fromLevelId) : null;
  if (lvl) {
    loadEditorLevel(lvl);
  } else if (activeLevelId) {
    const active = getLevel(activeLevelId);
    if (active) {
      loadEditorLevel(active);
    } else {
      editorTerrain = cloneTerrain(state.terrain);
      editorOrientation = state.orientation;
      editorLevelId = null;
      editorName = 'New level';
      editorCategory = 'free';
      editorPeriod = selectedPeriod;
      editorUnitsPerTurn = clampUnitsPerTurn(state.unitsPerTurn);
      editorPieces = clipStamps(
        stampsFromPieces(state.pieces),
        editorTerrain[0]?.length ?? COLS,
        editorTerrain.length || ROWS,
      );
    }
  } else {
    editorTerrain = cloneTerrain(state.terrain);
    editorOrientation = state.orientation;
    editorLevelId = null;
    editorName = 'New level';
    editorCategory = 'free';
    editorPeriod = selectedPeriod;
    editorUnitsPerTurn = clampUnitsPerTurn(state.unitsPerTurn);
    editorPieces = clipStamps(
      stampsFromPieces(state.pieces),
      editorTerrain[0]?.length ?? COLS,
      editorTerrain.length || ROWS,
    );
  }
  editorBrush = 'water';
  editorArmySide = 'red';
  editorFormationId = STOCK_FORMATION_ID;
  editorFormationName = 'New army';
  editorPainting = false;
  editorDirty = false;
  screen = 'editor';
  clearSelection();
  aiThinking = false;
  animating = false;
  applyLayout(computeLayout(), false);
  render();
}

function enterUnits() {
  editorPainting = false;
  editorPointerAbort?.abort();
  screen = 'units';
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
  const dirtyHint = app.querySelector('#editor-lib-label');
  if (dirtyHint) dirtyHint.textContent = 'Saved levels · unsaved changes';
}

function paintEditorUnit(col: number, row: number) {
  const idx = editorPieces.findIndex((p) => p.col === col && p.row === row);
  if (editorBrush === 'erase-unit') {
    if (idx < 0) return;
    editorPieces.splice(idx, 1);
  } else if (isUnitBrush(editorBrush)) {
    if (
      idx >= 0 &&
      editorPieces[idx].type === editorBrush &&
      editorPieces[idx].side === editorArmySide
    ) {
      return;
    }
    if (idx >= 0) editorPieces.splice(idx, 1);
    editorPieces.push({ type: editorBrush, col, row, side: editorArmySide });
  } else {
    return;
  }
  markEditorDirty();
  refreshEditorBoard();
}

function paintEditorHex(col: number, row: number) {
  if (row < 0 || row >= editorTerrain.length) return;
  if (col < 0 || col >= editorTerrain[0].length) return;
  if (editorBrush === 'erase-unit' || isUnitBrush(editorBrush)) {
    paintEditorUnit(col, row);
    return;
  }
  if (!isTerrainBrush(editorBrush)) return;
  const prev = editorTerrain[row][col];
  if (prev === editorBrush) return;
  editorTerrain[row][col] = editorBrush;
  markEditorDirty();

  // High rims / units need a board refresh; otherwise update the hex class in place (keeps drag)
  if (prev === 'high' || editorBrush === 'high') {
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

function doSaveLevel(asNew: boolean, asDefault = false): void {
  const nameEl = app.querySelector<HTMLInputElement>('#editor-name');
  if (nameEl) editorName = nameEl.value;
  const catEl = app.querySelector<HTMLSelectElement>('#editor-category');
  if (catEl) editorCategory = sanitizeCategory(catEl.value);
  const periodEl = app.querySelector<HTMLSelectElement>('#editor-period');
  if (periodEl) editorPeriod = sanitizePeriod(periodEl.value);
  const uptEl = app.querySelector<HTMLInputElement>('#editor-units-per-turn');
  if (uptEl) editorUnitsPerTurn = clampUnitsPerTurn(uptEl.value);
  const saved = saveLevel(
    editorName,
    editorTerrain,
    asNew ? null : editorLevelId,
    editorOrientation,
    editorPieces,
    editorCategory,
    editorUnitsPerTurn,
    editorPeriod,
  );
  editorLevelId = saved.id;
  editorName = saved.name;
  editorDirty = false;
  activeLevelId = saved.id;
  setActiveLevelId(saved.id);
  if (asDefault) {
    defaultLevelId = saved.id;
    setDefaultLevelId(saved.id);
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
}

function canControl(): boolean {
  if (state.winner || aiThinking || animating) return false;
  if (mode === 'ai') return state.turn === humanSide;
  return true;
}

/** Real options on one hex: move-onto and/or fire (not empty shoot-range). */
function hexActions(
  pieceId: string,
  hex: Hex,
): { canMove: boolean; canShoot: boolean } {
  const legal = legalHighlights(state, pieceId).filter(
    (h) => eq(h.hex, hex) && h.kind !== 'shoot-range',
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
  if (
    piece.side === state.turn &&
    canControl() &&
    !hasActed(state, pieceId) &&
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

  if (action.kind === 'skip') {
    state = applyAction(state, action);
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
    if (g) await animateMoveAlong(g, piece, path, plan.stop, action.to);
    else await wait(MOVE_MS);
    await flashDamaged(
      plan.hits.map((h) => {
        const victim = getPiece(state, h.id);
        const dealt = victim ? Math.max(0, hpLeft(victim) - h.remaining) : 0;
        return { id: h.id, fatal: h.fatal, dealt };
      }),
    );
  } else {
    await animateShot(piece, action.at);
  }

  state = applyAction(state, action);
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

async function animateShot(piece: Piece, at: Hex): Promise<void> {
  const from = pixelOf({ col: piece.col, row: piece.row });
  const to = pixelOf(at);
  const stats = UNIT_STATS[piece.type];
  const svg = document.querySelector('svg.board');
  if (!svg) {
    await wait(SHOT_FLIGHT_MS);
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

  // aim trail (dashed)
  const trail = svgEl('line', {
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
      const u = Math.min(1, (now - t0) / SHOT_FLIGHT_MS);
      // ease-out slightly
      const e = 1 - (1 - u) * (1 - u);
      const x = from.x + (to.x - from.x) * e;
      const y = from.y + (to.y - from.y) * e;
      bullet.setAttribute('cx', String(x));
      bullet.setAttribute('cy', String(y));
      if (u < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });

  bullet.remove();
  trail.classList.add('fade');

  const fromHex = { col: piece.col, row: piece.row };
  const blast = hasSplash(stats) ? splashBlast(state, at, fromHex) : [at];
  const shotHits: { id: string; fatal: boolean; dealt: number }[] = [];
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
    const dealt = Math.min(hpLeft(t), net);
    if (dealt <= 0) continue;
    const fatal = hpLeft(t) <= net;
    shotHits.push({ id: t.id, fatal, dealt });
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
    clearSelection();
    render();
    await maybeAi();
  }
}

async function skipScout() {
  if (!state.scoutPieceId || !canControl()) return;
  await playAnimatedAction({ kind: 'skip' });
  clearSelection();
  render();
  await maybeAi();
}

async function maybeAi() {
  if (mode !== 'ai' || state.winner) return;
  if (state.turn === humanSide) return;
  aiThinking = true;
  updateChrome();

  let guard = 0;
  while (state.turn !== humanSide && !state.winner && guard < 64) {
    const action = pickAiAction(state);
    if (!action) {
      state = passTurn(state);
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
      break;
    }
    clearSelection();
    render();
    guard += 1;
  }
  if (state.turn !== humanSide && !state.winner) {
    state = passTurn(state);
  }

  aiThinking = false;
  render();
}

function pieceColor(side: Side): string {
  return side === 'red' ? 'var(--piece-red)' : 'var(--piece-blue)';
}

function iconInk(side: Side): string {
  return side === 'red' ? 'var(--piece-red-ink)' : 'var(--piece-blue-ink)';
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

  // Full ranges while selected: move tint + shoot outline together
  const allHl = !editing && selectedId ? highlights : [];
  const moveMap = new Map<string, 'move' | 'stamina'>();
  const shootBorder = new Set<string>();
  const shootTargetBorder = new Set<string>();
  for (const hl of allHl) {
    const k = key(hl.hex);
    if (hl.kind === 'move' || hl.kind === 'stamina') moveMap.set(k, hl.kind);
    else if (hl.kind === 'shoot') shootTargetBorder.add(k);
    else if (hl.kind === 'shoot-range') shootBorder.add(k);
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
  let shootOutlines = '';
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
      }

      const mv = moveMap.get(k);
      if (mv === 'move') hlOverlays += `<polygon class="hl-tint move" points="${pts}" />`;
      else if (mv === 'stamina') hlOverlays += `<polygon class="hl-tint stamina" points="${pts}" />`;

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

      if (splashSet.has(k)) hlOverlays += `<polygon class="hl-tint splash" points="${pts}" />`;

      if (shootTargetBorder.has(k)) {
        shootOutlines += `<polygon class="shoot-outline target" points="${pts}" />`;
      } else if (shootBorder.has(k)) {
        shootOutlines += `<polygon class="shoot-outline" points="${pts}" />`;
      }
    }
  }

  let piecesSvg = '';
    const drawPieces: Piece[] = editing
    ? editorPieces.map((p) => ({
        id: `ed-${p.side}-${p.col}-${p.row}`,
        side: p.side,
        type: p.type,
        col: p.col,
        row: p.row,
        facing: defaultFacing(p.side),
      }))
    : state.pieces;
  for (const p of drawPieces) {
    const { x, y } = pixelOf({ col: p.col, row: p.row });
    const sel = !editing && p.id === selectedId ? ' selected' : '';
    const hexed = UNIT_STATS[p.type].hexArmor;
    const pr = HEX_SIZE * (hexed ? 0.697 : 0.581);
    const badgeR = Math.max(6.5, HEX_SIZE * 0.22);
    const emptyStamina = staminaMax(p) > 0 && staminaLeft(p) <= 0;
    const staminaIcon = emptyStamina
      ? staminaEmptyBadgeSvg(pr * 0.65, -pr * 0.7, badgeR)
      : '';
    const reloadIcon = isReloading(p)
      ? reloadBadgeSvg(
          emptyStamina ? -pr * 0.15 : pr * 0.65,
          -pr * 0.7,
          badgeR,
        )
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
            -pr * 0.65,
            -pr * 0.7,
            badgeR,
          )
        : '';
    const rot = facingRotation(p);
    const notch = pr + 1.2;
    const selRing = hexed
      ? `<polygon class="piece-sel" points="${hexCorners(0, 0, pr + 3.2, viewOrientation())}" fill="none" stroke="var(--sel)" stroke-width="2" />`
      : `<circle class="piece-sel" cx="0" cy="0" r="${pr + 3.2}" fill="none" stroke="var(--sel)" stroke-width="2" />`;
    piecesSvg += `
      <g class="piece-unit${isReloading(p) ? ' reloading' : ''}${isDepleted(p) ? ' depleted' : ''}" data-id="${p.id}" transform="translate(${x}, ${y})">
        ${sel ? selRing : ''}
        ${pieceBodySvg(p, pr)}
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
        ${staminaIcon}
        ${hpIcon}
        ${ammoIcon}
        ${actedIcon}
        ${abilityIcons}
      </g>`;
  }

  const defs = `
    <defs>
      <pattern id="rock-tex" patternUnits="userSpaceOnUse" width="14" height="14">
        <rect width="14" height="14" fill="var(--rock)"/>
        <path d="M0 3 L4 1 L8 4 L6 8 L2 7 Z" fill="var(--rock-hi)" opacity="0.85"/>
        <path d="M7 8 L12 6 L14 10 L10 13 L7 11 Z" fill="var(--rock-lo)" opacity="0.9"/>
        <path d="M1 10 L5 9 L6 13 L2 14 Z" fill="var(--rock-hi)" opacity="0.7"/>
        <path d="M0 0 L14 14 M14 0 L0 14 M4 0 L14 10 M0 6 L8 14"
          stroke="var(--rock-ink)" stroke-width="0.7" opacity="0.55" fill="none"/>
        <circle cx="3" cy="5" r="0.7" fill="var(--rock-ink)" opacity="0.5"/>
        <circle cx="10" cy="3" r="0.5" fill="var(--rock-hi)" opacity="0.45"/>
        <circle cx="9" cy="11" r="0.6" fill="var(--rock-ink)" opacity="0.4"/>
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
    </defs>`;

  return `<svg class="board" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    ${defs}
    <g class="hex-layer">${hexes}</g>
    <g class="hl-tint-layer">${hlOverlays}</g>
    <g class="shoot-outline-layer">${shootOutlines}</g>
    <g class="piece-layer">${piecesSvg}</g>
  </svg>`;
}

function endTurnButton(): string {
  if (!canControl()) return '';
  const used = state.actedIds.length;
  const max = state.unitsPerTurn;
  const label = max > 1 ? `End turn (${used}/${max})` : 'End turn';
  return `<button type="button" id="end-turn">${label}</button>`;
}

function renderActionBar(): string {
  const endBtn = endTurnButton();
  const piece = selectedId ? getPiece(state, selectedId) : null;
  if (!piece) {
    return `<div class="action-bar idle${endBtn ? ' has-end' : ''}"><span class="action-bar-hint">Select a piece</span>${endBtn}</div>`;
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
    hint = 'Already acted this turn';
  } else if (state.staminaBonus && state.scoutPieceId === piece.id) {
    const n = staminaLeft(piece);
    hint = `A second action costs 1 stamina. ${n} stamina left.`;
  } else if (state.scoutPieceId && piece.id === state.scoutPieceId) {
    hint = 'Second scout action — move, shoot, or skip';
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
    !choosing && (isDepleted(piece) || isReloading(piece))
      ? `<span class="action-flag">${isDepleted(piece) ? 'empty' : 'reloading'}</span>`
      : '';

  return `
    <div class="action-bar${scoutUi ? ' has-skip' : ''}${endBtn ? ' has-end' : ''}">
      <div class="action-bar-piece">
        <svg class="side-icon" viewBox="-10 -10 20 20" width="26" height="26" aria-hidden="true">
          <circle cx="0" cy="0" r="9.5" fill="${pieceColor(piece.side)}" stroke="${armorColor(ringArmor(piece.type))}" stroke-width="2" />
          <g fill="${iconInk(piece.side)}" color="${iconInk(piece.side)}">${pieceIconSvg(piece.type, 13)}</g>
        </svg>
        <span>${s.name}${previewOnly ? ' · preview' : ''}${
          staminaMax(piece) > 0
            ? ` · ${staminaLeft(piece)}/${staminaMax(piece)} stam`
            : ''
        }</span>
      </div>
      ${scoutUi}
      ${endBtn}
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
    const onHigh = state.terrain[piece.row][piece.col] === 'high';
    const shootVal = onHigh ? s.shoot + 1 : s.shoot;
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
    } else if (curSt < maxSt && s.staminaRegen > 0) {
      const n = Math.max(1, piece.staminaRegenWait ?? s.staminaRegen);
      stamNote = `+1 after ${n} idle turn${n === 1 ? '' : 's'}`;
    } else if (s.staminaRegen > 0) {
      stamNote = `regen ${s.staminaRegen}`;
    }

    const vitals = [
      ...(maxSt > 0
        ? [statRow('Stamina', `${curSt}/${maxSt}`, stamNote, stamWarn)]
        : []),
      statRow('HP', `${hpLeft(piece)}/${s.hp}`, hpLeft(piece) < s.hp ? 'wounded' : '', hpLeft(piece) < s.hp),
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
      statRow('Move', String(s.move), moveNote),
      statRow(
        'Shoot',
        shootRange,
        [s.shootArc === 'arch' ? 'arch over units' : 'straight', onHigh ? '+1 from high' : '']
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
        s.hexArmor ? 'hex · front follows last move' : '',
      ),
    ];
    if (s.ammo > 0) {
      moreRows.push(
        statRow(
          'Ammo',
          `${ammoLeft(piece) ?? 0}/${s.ammo}`,
          isDepleted(piece) ? 'empty' : '',
          isDepleted(piece),
        ),
      );
    }

    const abilityNotes = abilitiesOf(piece).map((id) => ABILITY_BLURB[id]);
    const extraNotes: string[] = [];
    if (s.passWater && s.passUnits) extraNotes.push('Pathing through water and pieces (not rocks)');
    else {
      if (s.passWater) extraNotes.push('Pathing through water');
      if (s.passUnits) extraNotes.push('Pathing through pieces');
    }
    if (s.charge > 0) extraNotes.push(`Charge through ${s.charge} dmg (armor applies; survivors don't block)`);
    if (s.noHigh) extraNotes.push('Cannot enter high ground');
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
            <p class="ability-sub">${piece.side.toUpperCase()} · ${escapeHtml(s.chess)} · val ${s.value}${
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
            <span class="l-shoot">Shoot (target)</span>
            <span class="l-shoot-range">Shoot range</span>
            <span class="l-shoot-border">Red border = shoot range</span>
          </div>
          <dl class="rules">
            <div><dt>Water</dt><dd>shoot over, cannot cross</dd></div>
            <div><dt>LOS low</dt><dd>rock, wall, high block; straight blocked by units</dd></div>
            <div><dt>Arch</dt><dd>over units; terrain LOS unchanged</dd></div>
            <div><dt>LOS high</dt><dd>+1 shoot; over pieces &amp; along ridge</dd></div>
            <div><dt>Walls</dt><dd>block like rock; rockets demolish</dd></div>
            <div><dt>Stamina</dt><dd>climb, or a second straight-line move after a normal one (leftover steps don't carry)</dd></div>
            <div><dt>Melee</dt><dd>enter occupied hex; kill takes it; min 1 dmg vs armor</dd></div>
            <div><dt>Shield</dt><dd>DMG = attack − shield (melee min 1). Negative shield boosts melee only — shots treat it as 0</dd></div>
            <div><dt>Units / turn</dt><dd>activate up to that many pieces, then End turn</dd></div>
            <div><dt>Win</dt><dd>kill their General (if they have one), or every enemy piece</dd></div>
          </dl>
        </details>
      </div>
    </div>`;
}

function turnLabel(): string {
  if (state.winner) {
    const loser = state.winner === 'red' ? 'blue' : 'red';
    const how = defeatKind(state, loser) === 'wipeout' ? 'army destroyed' : 'general down';
    return `<span class="${state.winner}">${state.winner.toUpperCase()} wins</span> — ${how}`;
  }
  if (aiThinking || animating) {
    if (mode === 'ai' && state.turn !== humanSide) {
      return `<span class="blue">Blue (AI)</span> moving…`;
    }
  }
  const quota =
    state.unitsPerTurn > 1
      ? ` · ${state.actedIds.length}/${state.unitsPerTurn} units`
      : '';
  if (mode === 'ai') {
    return state.turn === humanSide
      ? `<span class="red">Your turn (Red)</span>${quota}`
      : `<span class="blue">Blue (AI)</span>${quota}`;
  }
  return `<span class="${state.turn}">${state.turn.toUpperCase()} to move</span>${quota}`;
}

function renderEndOverlay(): string {
  if (!state.winner) return '';

  const youWon = mode === 'ai' && state.winner === humanSide;
  const youLost = mode === 'ai' && state.winner !== humanSide;
  const tone = youLost ? 'defeat' : 'victory';
  const inList = !!playlist;
  const lastInList = inList && !playlistHasNext();
  const listName = playlist
    ? playlist.kind === 'campaign'
      ? 'Campaign'
      : 'Tutorial'
    : '';

  const title =
    youWon && lastInList
      ? `${listName.toUpperCase()} COMPLETE`
      : youWon
        ? 'VICTORY'
        : youLost
          ? 'DEFEAT'
          : `${state.winner.toUpperCase()} WINS`;

  const loser = state.winner === 'red' ? 'blue' : 'red';
  const wiped = defeatKind(state, loser) === 'wipeout';
  const winHow = wiped ? 'Enemy army destroyed.' : 'Enemy general eliminated.';
  const loseHow = wiped ? 'Your army was destroyed.' : 'Your general has fallen.';
  const hotseatHow = wiped
    ? `${state.winner === 'red' ? 'Red' : 'Blue'} destroyed the opposing army.`
    : `${state.winner === 'red' ? 'Red' : 'Blue'} destroyed the opposing general.`;

  const sub = youWon && lastInList
    ? `Cleared all ${playlist!.ids.length} ${listName.toLowerCase()} maps.`
    : youWon && inList
      ? `${winHow} ${playlist!.index + 1} / ${playlist!.ids.length}`
      : youWon
        ? winHow
        : youLost
          ? loseHow
          : hotseatHow;

  const winnerSide = state.winner;
  const nextBtn =
    youWon && inList && !lastInList
      ? `<button type="button" id="end-next">Next map</button>`
      : '';
  const startBtn = inList
    ? `<button type="button" id="end-start" class="ghost">Start</button>`
    : '';

  return `
    <div class="end-overlay ${tone}" role="dialog" aria-label="${title}">
      <div class="end-card ${tone} side-${winnerSide}">
        <div class="end-burst" aria-hidden="true"></div>
        <svg class="end-icon" viewBox="-10 -10 20 20" width="72" height="72" aria-hidden="true">
          <circle cx="0" cy="0" r="9.5" fill="${pieceColor(winnerSide)}" />
          <g fill="${iconInk(winnerSide)}" color="${iconInk(winnerSide)}">${pieceIconSvg('general', 16)}</g>
        </svg>
        <h2 class="end-title">${title}</h2>
        <p class="end-sub">${sub}</p>
        <div class="end-actions">
          ${nextBtn}
          <button type="button" id="end-rematch">Rematch</button>
          ${startBtn}
        </div>
      </div>
    </div>`;
}

function updateChrome() {
  const banner = app.querySelector('.turn-banner');
  if (banner) banner.innerHTML = turnLabel();
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

function onHexClick(col: number, row: number) {
  if (animating || aiThinking) return;
  const hex = { col, row };
  const occ = state.pieces.find((p) => p.col === col && p.row === row);

  // Own piece selected + can act → resolve by what that hex allows
  if (canActWithSelected() && selectedId) {
    const { canMove, canShoot } = hexActions(selectedId, hex);
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
    selectPiece(occ.id);
    return;
  }

  // Shoot-range / preview tints are not actions — keep the piece selected
  if (selectedId && highlights.some((h) => eq(h.hex, hex))) {
    return;
  }

  clearSelection();
  render();
}

function bindEditorBoard() {
  const svg = app.querySelector('svg.board');
  if (!svg) return;

  editorPointerAbort?.abort();
  editorPointerAbort = new AbortController();
  const { signal } = editorPointerAbort;

  window.addEventListener('pointerup', () => {
    editorPainting = false;
  }, { signal });
  window.addEventListener('pointercancel', () => {
    editorPainting = false;
  }, { signal });

  svg.querySelectorAll<SVGPolygonElement>('polygon.hex').forEach((poly) => {
    const col = Number(poly.dataset.col);
    const row = Number(poly.dataset.row);
    poly.addEventListener(
      'pointerdown',
      (e) => {
        e.preventDefault();
        editorPainting = true;
        paintEditorHex(col, row);
      },
      { signal },
    );
    poly.addEventListener(
      'pointerenter',
      () => {
        if (editorPainting) paintEditorHex(col, row);
      },
      { signal },
    );
  });
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

  const paintHover = (next: Hex | null) => {
    const changed =
      (!!next && (!hoverHex || !eq(hoverHex, next))) || (!next && !!hoverHex);
    if (!changed) return;
    hoverHex = next;
    const board = app.querySelector('svg.board');
    if (board) {
      board.outerHTML = renderBoard();
      bindBoardOnly();
      placeHexChoice();
    }
  };

  svg.addEventListener('pointerleave', () => {
    if (animating) return;
    paintHover(null);
  });

  svg.addEventListener('pointermove', (e) => {
    if (animating) return;
    const hex = hexFromPointer(svg, e.clientX, e.clientY);
    if (!hex) {
      paintHover(null);
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
    paintHover(moveHover || splashHover ? hex : null);
  });
}

function levelSelectOptions(selectedId: string | null): string {
  const groups = LEVEL_CATEGORIES.map((cat) => ({
    cat,
    levels: listLevels()
      .filter((l) => l.category === cat)
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
      ),
  })).filter((g) => g.levels.length);
  const opts = [`<option value="random"${!selectedId ? ' selected' : ''}>Random map</option>`];
  for (const g of groups) {
    opts.push(`<optgroup label="${LEVEL_CATEGORY_LABEL[g.cat]}">`);
    for (const l of g.levels) {
      const tag = l.id === defaultLevelId ? ' (default)' : '';
      opts.push(
        `<option value="${l.id}"${selectedId === l.id ? ' selected' : ''}>${escapeHtml(l.name)}${tag}</option>`,
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

function syncStatusHtml(): string {
  return `<span class="sync-status">${serverStatusLabel(getServerStatus())}</span>`;
}

function renderToolbar(): string {
  return `<div class="toolbar">
    <h1>CHESS ARMY <span class="app-ver">v${APP_VERSION}</span></h1>
    <button type="button" id="go-start" class="${screen === 'start' ? 'active' : ''}">Start</button>
    <button type="button" id="open-editor" class="${screen === 'editor' ? 'active' : ''}">Editor</button>
    <button type="button" id="open-units" class="${screen === 'units' ? 'active' : ''}">Units</button>
    ${syncStatusHtml()}
  </div>`;
}

function renderStartScreen(): string {
  const campaignN = levelsInCategory('campaign', selectedPeriod).length;
  const tutorialN = levelsInCategory('tutorial', selectedPeriod).length;
  const mapWord = (n: number) => `${n} map${n === 1 ? '' : 's'}`;
  const periodPicks = PERIODS.map(
    (p) =>
      `<button type="button" class="period-pick${selectedPeriod === p ? ' active' : ''}" data-period="${p}">${PERIOD_LABEL[p]}</button>`,
  ).join('');
  return `
    <div class="board-wrap start-wrap">
      ${renderToolbar()}
      <div class="start-screen">
        <p class="start-kicker">Hex army-chess</p>
        <h2 class="start-title">CHESS ARMY <span class="app-ver">v${APP_VERSION}</span></h2>
        <p class="start-tag">Kill the enemy General — or the whole army.</p>
        <div class="period-picks" role="radiogroup" aria-label="Period">${periodPicks}</div>
        <div class="start-menu">
          <button type="button" class="start-opt" data-start="campaign"${campaignN ? '' : ' disabled'}
            title="${campaignN ? 'Play campaign maps in alphabetical order, vs AI' : 'Mark saved levels as Campaign in the Editor'}">
            <span class="start-opt-name">Campaign</span>
            <span class="start-opt-meta">${campaignN ? `${mapWord(campaignN)} · vs AI · A–Z` : 'No campaign maps'}</span>
          </button>
          <button type="button" class="start-opt" data-start="ai">
            <span class="start-opt-name">vs AI</span>
            <span class="start-opt-meta">Skirmish · pick any map</span>
          </button>
          <button type="button" class="start-opt" data-start="hotseat">
            <span class="start-opt-name">Hotseat</span>
            <span class="start-opt-meta">Two players, one device</span>
          </button>
          <button type="button" class="start-opt" data-start="tutorial"${tutorialN ? '' : ' disabled'}
            title="${tutorialN ? 'Tutorial maps in alphabetical order, vs AI' : 'Mark saved levels as Tutorial in the Editor'}">
            <span class="start-opt-name">Tutorial</span>
            <span class="start-opt-meta">${tutorialN ? `${mapWord(tutorialN)} · vs AI · A–Z` : 'No tutorial maps'}</span>
          </button>
        </div>
      </div>
    </div>`;
}

function bindToolbarEvents() {
  app.querySelector('#go-start')?.addEventListener('click', () => {
    if (screen === 'start') return;
    showStart();
  });
  app.querySelectorAll<HTMLButtonElement>('.period-pick').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedPeriod = sanitizePeriod(btn.dataset.period);
      setSelectedPeriod(selectedPeriod);
      applyPeriodTheme(selectedPeriod);
      render();
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-start]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.start;
      if (kind === 'campaign' || kind === 'tutorial') startPlaylist(kind);
      else if (kind === 'ai') startSkirmish('ai');
      else if (kind === 'hotseat') startSkirmish('hotseat');
    });
  });
  app.querySelectorAll('#open-editor').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (screen === 'editor') return;
      enterEditor(activeLevelId);
    });
  });
  app.querySelectorAll('#open-units').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (screen === 'units') return;
      enterUnits();
    });
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
  if (kind === 'water') {
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
    extra = `<g clip-path="url(#${clipId})">
      <path d="M-4.2 -3 L0.2 -5.2 L3.4 -1.2 L1.2 2.2 L-3.2 1.1 Z" fill="var(--rock-hi)" opacity="0.85"/>
      <path d="M1.2 1.2 L6.2 0 L7.4 4.1 L3.2 6.2 Z" fill="var(--rock-lo)" opacity="0.9"/>
      <path d="M-7 -2 L7 5 M-2 -7 L4 7" fill="none" stroke="var(--rock-ink)" stroke-width="0.6" opacity="0.55"/>
    </g>`;
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
  }
  const body =
    kind === 'high'
      ? extra
      : `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="miter"/>${extra}`;
  return `<svg class="tile-swatch" viewBox="${(-w / 2).toFixed(1)} ${(-h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" width="22" height="22" aria-hidden="true">
    <defs><clipPath id="${clipId}"><polygon points="${pts}"/></clipPath></defs>
    ${body}
  </svg>`;
}

function renderMapPanel(): string {
  const brushes = TERRAIN_BRUSHES.map(
    (b) =>
      `<button type="button" class="brush ${b.id}${editorBrush === b.id ? ' active' : ''}" data-brush="${b.id}">${terrainSwatchSvg(b.id)}<span>${b.label}</span></button>`,
  ).join('');
  return `
    <section class="editor-panel editor-panel-map">
      <h3>Map</h3>
      <div class="editor-brushes">
        ${brushes}
        <button type="button" id="editor-clear" class="ghost">Clear board</button>
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
      `<option value="${c}"${editorUnitCategory === c ? ' selected' : ''}>${UNIT_CATEGORY_LABEL[c]}</option>`,
  ).join('');
  const unitBrushes = [
    ...catUnits.map(
      (t) =>
        `<button type="button" class="brush unit${editorBrush === t ? ' active' : ''}" data-brush="${t}">${unitBrushIconSvg(t)}<span>${escapeHtml(UNIT_STATS[t].name)}</span></button>`,
    ),
    `<button type="button" class="brush unit erase${editorBrush === 'erase-unit' ? ' active' : ''}" data-brush="erase-unit">Erase <svg class="icon-trash" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M6.1 1.2h3.8l.45 1.3H14v1.25H2V2.5h3.65L6.1 1.2zM3.25 5h9.5l-.55 8.25A1.4 1.4 0 0 1 10.8 14.6H5.2a1.4 1.4 0 0 1-1.4-1.35L3.25 5zm2.3 1.35v6.15h1.15V6.35H5.55zm3.2 0v6.15H9.9V6.35H8.75z"/></svg></button>`,
  ].join('');
  return `
    <section class="editor-panel editor-panel-army">
      <h3>Army</h3>
      <div class="editor-army">
        <button type="button" class="editor-side red${editorArmySide === 'red' ? ' active' : ''}" data-army-side="red">Red</button>
        <button type="button" class="editor-side blue${editorArmySide === 'blue' ? ' active' : ''}" data-army-side="blue">Blue</button>
        <label class="editor-cat">Era
          <select id="editor-unit-cat">${eraOpts}</select>
        </label>
      </div>
      <div class="editor-army">
        ${catUnits.length ? '' : `<span class="lvl-meta">No ${UNIT_CATEGORY_LABEL[editorUnitCategory]} units</span>`}
        ${unitBrushes}
      </div>
    </section>`;
}

function renderEditorBar(): string {
  const levels = listLevels();
  const forms = listFormations();
  const grid = currentGrid();

  const levelList =
    levels.length === 0
      ? `<p class="editor-empty">No saved levels yet</p>`
      : `<ul class="editor-levels">${levels
          .map(
            (l) => `<li class="${l.id === editorLevelId ? 'active' : ''}">
              <button type="button" data-load-level="${l.id}">${escapeHtml(l.name)} <span class="lvl-meta">${LEVEL_CATEGORY_LABEL[l.category]} · <span class="period-tag" data-period="${l.period}">${PERIOD_LABEL[l.period]}</span> · ${l.cols}×${l.rows} · ${l.orientation === 'flat' ? 'flat' : 'point'}${l.unitsPerTurn > 1 ? ` · ${l.unitsPerTurn}u` : ''}${l.id === defaultLevelId ? ' · default' : ''}</span></button>
              <button type="button" class="ghost danger" data-del-level="${l.id}" title="Delete">×</button>
            </li>`,
          )
          .join('')}</ul>`;

  const stockDefault = !defaultFormationId;
  const formList = `<ul class="editor-levels editor-formations">
    <li class="${editorFormationId === STOCK_FORMATION_ID ? 'active' : ''}">
      <button type="button" data-load-form="${STOCK_FORMATION_ID}">Standard <span class="lvl-meta">${grid.cols} wide${stockDefault ? ' · default' : ''}</span></button>
    </li>
    ${forms
      .map(
        (f) => `<li class="${f.id === editorFormationId ? 'active' : ''}">
          <button type="button" data-load-form="${f.id}">${escapeHtml(f.name)} <span class="lvl-meta">${f.slots.length} pcs · ${f.cols} wide${f.id === defaultFormationId ? ' · default' : ''}</span></button>
          <button type="button" class="ghost danger" data-del-form="${f.id}" title="Delete">×</button>
        </li>`,
      )
      .join('')}
  </ul>`;

  const namedForm = editorFormationId && editorFormationId !== STOCK_FORMATION_ID;
  const isDefaultForm = namedForm && editorFormationId === defaultFormationId;

  return `
    <div class="editor-bar">
      <section class="editor-panel editor-panel-armies">
        <h3>Armies</h3>
        <div class="editor-save editor-army-save">
          <input type="text" id="army-name" value="${escapeHtml(editorFormationName)}" placeholder="Army name" maxlength="48" />
          <button type="button" id="army-save">${namedForm ? 'Save' : 'Save new'}</button>
          <button type="button" id="army-save-as" class="ghost">Save as new</button>
          <button type="button" id="army-save-default" class="${isDefaultForm ? 'active' : ''}">${isDefaultForm ? 'Default army' : 'Save as default'}</button>
          <button type="button" id="army-clear" class="ghost">Clear</button>
        </div>
        <div class="editor-library editor-army-library">
          <span class="editor-label">Load onto ${editorArmySide === 'red' ? 'Red' : 'Blue'}${editorArmySide === 'blue' ? ' (flipped)' : ''}</span>
          ${formList}
        </div>
      </section>
      <section class="editor-panel editor-panel-level">
        <h3>Level</h3>
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
                    `<option value="${p}"${editorPeriod === p ? ' selected' : ''}>${PERIOD_LABEL[p]}</option>`,
                ).join('')}
              </select>
            </label>
          </div>
          <label class="editor-cat level-settings-upt">Max units / turn
            <input type="number" id="editor-units-per-turn" min="${MIN_UNITS_PER_TURN}" max="${MAX_UNITS_PER_TURN}" value="${editorUnitsPerTurn}" />
          </label>
          <div class="editor-grid">
            <label>W <input type="number" id="editor-cols" min="${MIN_COLS}" max="${MAX_COLS}" value="${grid.cols}" /></label>
            <label>H <input type="number" id="editor-rows" min="${MIN_ROWS}" max="${MAX_ROWS}" value="${grid.rows}" /></label>
            <button type="button" data-ori="pointy" class="${editorOrientation === 'pointy' ? 'active' : ''}">Point up</button>
            <button type="button" data-ori="flat" class="${editorOrientation === 'flat' ? 'active' : ''}">Flat up</button>
          </div>
          <div class="editor-save level-settings-actions">
            <button type="button" id="editor-save">${editorLevelId ? 'Save' : 'Save new'}</button>
            <button type="button" id="editor-save-as" class="ghost">Save as new</button>
            <button type="button" id="editor-save-default" class="${editorLevelId && editorLevelId === defaultLevelId && !editorDirty ? 'active' : ''}">${editorLevelId && editorLevelId === defaultLevelId && !editorDirty ? 'Default map' : 'Save as default'}</button>
          </div>
        </div>
        <div class="editor-library">
          <span class="editor-label" id="editor-lib-label">Saved${editorDirty ? ' · unsaved changes' : ''}</span>
          ${levelList}
        </div>
      </section>
    </div>`;
}

function gameOverClass(): string {
  if (!state.winner) return '';
  if (mode === 'ai') {
    return state.winner === humanSide ? 'game-over won' : 'game-over lost';
  }
  return state.winner === 'red' ? 'game-over won' : 'game-over lost';
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
  const tint = armorish ? ` style="border-color:${armorColor(val)}"` : '';
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

function hexArmorEditor(type: UnitType): string {
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
  const faces: { field: EditableStat; a: number; b: number }[] = [
    { field: 'armorFront', a: 4, b: 5 },
    { field: 'armorFrontRight', a: 5, b: 0 },
    { field: 'armorFlankRight', a: 0, b: 1 },
    { field: 'armorRear', a: 1, b: 2 },
    { field: 'armorFlankLeft', a: 2, b: 3 },
    { field: 'armorFrontLeft', a: 3, b: 4 },
  ];
  const wedges = faces
    .map(({ field, a, b }) => {
      const fill = armorColor(s[field] as number);
      return `<polygon data-unit="${type}" data-hex-face="${field}" points="0,0 ${v[a][0]},${v[a][1]} ${v[b][0]},${v[b][1]}" fill="${fill}" stroke="#1a1f1c" stroke-width="0.6"/>`;
    })
    .join('');
  return `<div class="hex-armor">
    <span class="unit-group-label">Hex sides</span>
    <div class="hex-armor-grid">
      <div class="hex-armor-cell fl">${unitNumField(type, 'armorFrontLeft', 'Front left')}</div>
      <div class="hex-armor-cell front">${unitNumField(type, 'armorFront', 'Front')}</div>
      <div class="hex-armor-cell fr">${unitNumField(type, 'armorFrontRight', 'Front right')}</div>
      <div class="hex-armor-cell left">${unitNumField(type, 'armorFlankLeft', 'Flank left')}</div>
      <svg class="hex-armor-glyph" viewBox="-12 -12 24 24" aria-hidden="true">
        ${wedges}
        <polygon points="0,-9.4 2.1,-5.2 -2.1,-5.2" fill="#efe4d0"/>
      </svg>
      <div class="hex-armor-cell right">${unitNumField(type, 'armorFlankRight', 'Flank right')}</div>
      <div class="hex-armor-cell rear">${unitNumField(type, 'armorRear', 'Rear')}</div>
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
          `<option value="${c}"${s.category === c ? ' selected' : ''}>${UNIT_CATEGORY_LABEL[c]}</option>`,
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
        </div>
        <div class="unit-group">
          <span class="unit-group-label">Shoot</span>
          ${unitNumField(type, 'shoot', 'Range')}
          ${shootExtras}
        </div>
        <label class="chk hex-armor-toggle">
          <input type="checkbox" data-unit="${type}" data-field="hexArmor"${s.hexArmor ? ' checked' : ''} />
          Hex armor
        </label>
        ${s.hexArmor ? hexArmorEditor(type) : ''}
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
      `<button type="button" data-unit-filter="${c}" class="${unitEditorCategory === c ? 'active' : ''}">${UNIT_CATEGORY_LABEL[c]}</button>`,
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
    </div>`;
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
        if (f === 'armor' || String(f).startsWith('armor')) {
          inp.style.borderColor = armorColor(Number(v));
        }
      }
    });
    app.querySelectorAll<SVGPolygonElement>(`polygon[data-hex-face][data-unit="${type}"]`).forEach((poly) => {
      const f = poly.dataset.hexFace as EditableStat;
      poly.setAttribute('fill', armorColor(Number(UNIT_STATS[type][f])));
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

function bindEditorEvents() {
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
      editorBrush = first ?? 'erase-unit';
    }
    render();
  });
  app.querySelector('#editor-save')?.addEventListener('click', () => doSaveLevel(false));
  app.querySelector('#editor-save-as')?.addEventListener('click', () => doSaveLevel(true));
  app.querySelector('#editor-save-default')?.addEventListener('click', () =>
    doSaveLevel(false, true),
  );
  app.querySelector('#editor-clear')?.addEventListener('click', () => {
    const { cols, rows } = currentGrid();
    editorTerrain = emptyTerrain(cols, rows);
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
  });
  app.querySelector('#editor-category')?.addEventListener('change', (e) => {
    editorCategory = sanitizeCategory((e.target as HTMLSelectElement).value);
    editorDirty = true;
  });
  app.querySelector('#editor-period')?.addEventListener('change', (e) => {
    editorPeriod = sanitizePeriod((e.target as HTMLSelectElement).value);
    editorDirty = true;
    applyPeriodTheme(editorPeriod);
    render();
  });
  app.querySelector('#editor-units-per-turn')?.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    editorUnitsPerTurn = clampUnitsPerTurn(el.value);
    el.value = String(editorUnitsPerTurn);
    editorDirty = true;
  });
  app.querySelector('#army-name')?.addEventListener('change', (e) => {
    editorFormationName = (e.target as HTMLInputElement).value;
  });
  app.querySelectorAll<HTMLButtonElement>('[data-army-side]').forEach((btn) => {
    btn.addEventListener('click', () => {
      editorArmySide = btn.dataset.armySide === 'blue' ? 'blue' : 'red';
      render();
    });
  });
  const doSaveFormation = (asNew: boolean, asDefault = false) => {
    const nameEl = app.querySelector<HTMLInputElement>('#army-name');
    if (nameEl) editorFormationName = nameEl.value;
    const { cols, rows } = currentGrid();
    const { slots } = captureFormation(editorPieces, editorArmySide, cols, rows);
    if (asDefault && slotsEqual(slots, stockFormation(cols, rows).slots)) {
      defaultFormationId = null;
      setDefaultFormationId(null);
      editorFormationId = STOCK_FORMATION_ID;
      render();
      return;
    }
    const existing =
      asNew || !editorFormationId || editorFormationId === STOCK_FORMATION_ID
        ? null
        : editorFormationId;
    const saved = saveFormation(editorFormationName, slots, cols, existing);
    editorFormationId = saved.id;
    editorFormationName = saved.name;
    if (asDefault) {
      defaultFormationId = saved.id;
      setDefaultFormationId(saved.id);
    }
    render();
  };
  app.querySelector('#army-save')?.addEventListener('click', () => doSaveFormation(false));
  app.querySelector('#army-save-as')?.addEventListener('click', () => doSaveFormation(true));
  app.querySelector('#army-save-default')?.addEventListener('click', () =>
    doSaveFormation(false, true),
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
      render();
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-load-level]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.loadLevel!;
      const lvl = getLevel(id);
      if (!lvl) return;
      loadEditorLevel(lvl);
      editorDirty = false;
      applyLayout(computeLayout(), false);
      render();
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-del-level]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.delLevel!;
      if (!confirm('Delete this level?')) return;
      deleteLevel(id);
      if (editorLevelId === id) {
        editorLevelId = null;
        editorName = 'New level';
        editorCategory = 'free';
        editorPeriod = selectedPeriod;
      }
      if (defaultLevelId === id) defaultLevelId = null;
      render();
    });
  });
  bindEditorBoard();
}

function bindEvents() {
  bindToolbarEvents();
  if (screen === 'start') return;
  if (screen === 'editor') {
    bindEditorEvents();
    return;
  }
  if (screen === 'units') {
    bindUnitEditorEvents();
    return;
  }

  app.querySelector('#new-map')?.addEventListener('click', () => {
    if (activeLevelId) startMatch(false);
    else reset(true);
  });
  app.querySelector('#end-rematch')?.addEventListener('click', () => reset(false));
  app.querySelector('#end-next')?.addEventListener('click', () => advancePlaylist());
  app.querySelector('#end-start')?.addEventListener('click', () => showStart());
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
  app.querySelector('#end-turn')?.addEventListener('click', () => {
    if (!canControl()) return;
    state = passTurn(state);
    clearSelection();
    render();
    void maybeAi();
  });
  app.querySelector('.hex-choice')?.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  app.querySelectorAll<HTMLButtonElement>('[data-action-mode]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      void resolvePending(btn.dataset.actionMode as ActionMode);
    });
  });
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
  app.querySelector('#map-wall')?.addEventListener('change', (e) => {
    mapOpts.wallCount = Number((e.target as HTMLInputElement).value);
  });
  app.querySelector('#map-high')?.addEventListener('change', (e) => {
    mapOpts.highCount = Number((e.target as HTMLInputElement).value);
  });
  bindBoardOnly();
}

function render() {
  const maxT = maxTerrainCells();
  applyPeriodTheme(activePeriod());
  app.classList.toggle('start-screen', screen === 'start');

  if (screen === 'start') {
    app.innerHTML = renderStartScreen();
    bindEvents();
    return;
  }

  if (screen === 'units') {
    app.innerHTML = `
      <div class="board-wrap unit-editor-wrap">
        ${renderToolbar()}
        ${renderUnitEditor()}
      </div>
      <aside class="sidebar">
        <h2>Units</h2>
        <p class="muted">Live immediately. New match to respawn ammo and HP.</p>
        <dl class="help-list">
          <dt>Piece</dt>
          <dd><strong>HP</strong> default 1</dd>
          <dd><strong>Armor</strong> −2..+2, subtracted from incoming dmg (shots ignore negatives). Ring / hex: −2 red, −1 orange, 0 green, +1 blue, +2 purple. Stock: tank +2, general +1</dd>
          <dd><strong>Value/weight</strong> scoring / AI</dd>
          <dd><strong>Actions</strong> activations per turn</dd>
          <dd><strong>Category</strong> Modern / Ancient — filter above. Stock is Modern except Archer (Ancient)</dd>
          <dd><strong>Kit</strong> icon + specials (water, high). Does not reset numbers. Tower is glyph only</dd>
          <dd><strong>Abilities</strong> granted independently of kit. General (star): all generals on a side must fall to lose by command — one of several is not enough. Pieces can also gain/lose abilities in play</dd>
          <dd><strong>Copy</strong> duplicates a unit (same kit / icon / rules). Rename, recategorize, or switch kit. Delete only copies.</dd>
          <dt>Move</dt>
          <dd><strong>Range</strong> hexes in a straight line per action</dd>
          <dd><strong>Move cap</strong> total steps this activation (0 = none; scout stock 3)</dd>
          <dd><strong>Stamina</strong> pool. Spend 1 to climb, or after a normal move take a second straight-line action of the same range (new direction OK). Unused steps of an action are lost</dd>
          <dd><strong>Stam regen</strong> own turns to recover 1. Walking resets (that End still counts). Point lands only on an idle End. 0 = never</dd>
          <dd><strong>Melee dmg</strong> bump an occupied hex; a kill takes the spot, else stop on the hex before. 0 = cannot melee</dd>
          <dd><strong>Charge</strong> 0 = no charge through. 1+ = damage when walking through a unit (armor applies, including negative). Survivors lose HP and you pass</dd>
          <dt>Shoot</dt>
          <dd><strong>Range</strong> fire distance. 0 = cannot shoot (hides the rest)</dd>
          <dd><strong>DMG</strong> bullets</dd>
          <dd><strong>Reload time</strong> own turns you can't shoot after firing</dd>
          <dd><strong>Ammo limit</strong> shots this match (0 = unlimited)</dd>
          <dd><strong>Arc</strong> Straight: units block from low. Arch: fire over units. Terrain LOS (rock / wall / high) unchanged</dd>
          <dd><strong>Min range</strong> closest hex you can fire</dd>
          <dd><strong>Splash DMG</strong> 0 = bullets; &gt;0 = rocket blast (bazooka/tank stock 1)</dd>
        </dl>
      </aside>
    `;
    bindEvents();
    return;
  }

  if (screen === 'editor') {
    app.innerHTML = `
      <div class="board-wrap editor-mode">
        ${renderToolbar()}
        <div class="editor-top">
          ${renderMapPanel()}
          ${renderArmySelectPanel()}
        </div>
        <div class="board-stage">
          ${renderBoard()}
        </div>
        ${renderEditorBar()}
      </div>
      <aside class="sidebar">
        <h2>Editor</h2>
        <p class="muted">Set width × height (tiles) and hex orientation, then paint land, water, rock, concrete wall, and high ground. Paint units onto the selected side, or load a saved army (Blue gets the formation flipped). Save as default army uses that preset on random maps and on levels with no stamped armies.</p>
        <p class="muted">Point up = pointy-top hexes. Flat up = flat-top. Topology (neighbors / LOS) follows the orientation. Saving a level stores the pieces currently on the board. Category: <strong>Campaign</strong> / <strong>Tutorial</strong> playlists on the Start screen (A–Z), <strong>Free</strong> is skirmish-only.</p>
      </aside>
    `;
    bindEvents();
    return;
  }

  const pl = playlist;
  const plLvl = playlistLevel();
  const randomParams = pl
    ? `<div class="map-params">
        <button type="button" id="new-map">Restart level</button>
        <span class="playlist-progress">${pl.kind === 'campaign' ? 'Campaign' : 'Tutorial'} ${pl.index + 1} / ${pl.ids.length}${plLvl ? ` · ${escapeHtml(plLvl.name)}` : ''}</span>
      </div>`
    : !activeLevelId
    ? `<div class="map-params">
        <label>Water <input type="number" id="map-water" min="0" max="${maxT}" value="${mapOpts.waterCount}" /></label>
        <label>Rocks <input type="number" id="map-rock" min="0" max="${maxT}" value="${mapOpts.rockCount}" /></label>
        <label>Walls <input type="number" id="map-wall" min="0" max="${maxT}" value="${mapOpts.wallCount}" /></label>
        <label>High <input type="number" id="map-high" min="0" max="${maxT}" value="${mapOpts.highCount}" /></label>
        <button type="button" id="new-map">New map</button>
        <span class="map-hint">mid belt · climb costs stamina · high→high free · high +1 shoot</span>
      </div>`
    : `<div class="map-params">
        <button type="button" id="new-map">Restart level</button>
        <button type="button" id="open-editor">Edit this level</button>
        <span class="map-hint">Playing saved level</span>
      </div>`;

  const levelRow = pl
    ? ''
    : `<div class="map-params level-row">
        <label>Level
          <select id="level-select">${levelSelectOptions(activeLevelId)}</select>
        </label>
        <span class="map-hint">${mode === 'hotseat' ? 'Hotseat' : 'vs AI'}</span>
      </div>`;

  app.innerHTML = `
    <div class="board-wrap ${gameOverClass()}">
      ${renderToolbar()}
      ${levelRow}
      ${randomParams}
      <div class="turn-banner">${turnLabel()}</div>
      <div class="board-stage">
        ${renderBoard()}
        ${renderHexChoice()}
        ${state.winner ? renderEndOverlay() : ''}
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
  const el = app.querySelector('.sync-status');
  if (el) el.textContent = serverStatusLabel(s);
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
  const el = app.querySelector('.sync-status');
  if (el) el.textContent = serverStatusLabel();
}

render();
void initServerSync();
window.addEventListener('resize', scheduleLayoutRefresh);
window.addEventListener('orientationchange', () => {
  window.setTimeout(refreshLayout, 220);
});
