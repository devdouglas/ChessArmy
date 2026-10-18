import './style.css';
import {
  applyAction,
  passTurn,
  getPiece,
  ammoLeft,
  hpLeft,
  hpMax,
  isDepleted,
  isReloading,
  legalHighlights,
  pieceAt,
  previewMove,
  rangeHighlights,
  armorColor,
  hasSplash,
  netDamage,
  splashBlast,
  UNIT_STATS,
  UNIT_TYPES,
  type Action,
  type GameState,
  type Highlight,
  type Piece,
  type Side,
  type Terrain,
  type UnitType,
} from './engine';
import {
  eq,
  hexCorners,
  hexGridExtent,
  hexToPixel,
  key,
  pixelToHex,
  type Hex,
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
  listLevels,
  saveLevel,
  setActiveLevelId,
  setDefaultLevelId,
  type SavedLevel,
} from './levels';
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
import { ammoBadgeSvg, hpBadgeSvg, pieceIconSvg, reloadBadgeSvg } from './icons';
import {
  CLAMP,
  patchUnitStat,
  resetUnitStats,
  unitStatsAreStock,
  type EditableStat,
} from './units';
import {
  getServerStatus,
  onServerStatus,
  serverStatusLabel,
  syncFromServer,
} from './sync';

type Mode = 'hotseat' | 'ai';
type ActionMode = 'move' | 'shoot';
type Screen = 'play' | 'editor' | 'units';
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
  return (UNIT_TYPES as string[]).includes(b);
}

let mapOpts: MapOptions = { ...DEFAULT_MAP };
let defaultLevelId: string | null = getDefaultLevelId();
let defaultFormationId: string | null = getDefaultFormationId();
let activeLevelId: string | null = defaultLevelId ?? getActiveLevelId();
let state: GameState = bootState();
let mode: Mode = 'ai';
const humanSide: Side = 'red';
let screen: Screen = 'play';
let selectedId: string | null = null;
/** Hex where both move-onto and shoot are legal — wait for Move/Shoot pick. */
let pendingHex: Hex | null = null;
let highlights: Highlight[] = [];
let hoverShoot: Hex | null = null;
let aiThinking = false;
let animating = false;
let endOverlayDismissed = false;

/** Editor draft */
let editorTerrain: Terrain[][] = emptyTerrain();
let editorOrientation: HexOrientation = DEFAULT_ORIENTATION;
let editorBrush: EditorBrush = 'water';
let editorLevelId: string | null = null;
let editorName = 'New level';
let editorPieces: ArmyStamp[] = [];
let editorArmySide: Side = 'red';
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
    pieceIcon: Math.max(14, Math.round(hex * 0.62)),
  };
}

let { hexSize: HEX_SIZE, pad: PAD, pieceIcon: PIECE_ICON } = computeLayout();
const MOVE_MS = 300;
const SHOT_FLIGHT_MS = 320;
const SHOT_IMPACT_MS = 280;

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
      return createStateFromTerrain(
        lvl.terrain,
        lvl.name,
        lvl.orientation,
        playArmies(lvl.cols, lvl.rows, lvl),
      );
    }
  }
  return createInitialState(mapOpts, defaultArmyStamps(COLS, ROWS));
}

function startMatch(reshuffleRandom = true) {
  clearSelection();
  endOverlayDismissed = false;
  aiThinking = false;
  animating = false;
  if (activeLevelId) {
    const lvl = getLevel(activeLevelId);
    if (lvl) {
      state = createStateFromTerrain(
        lvl.terrain,
        lvl.name,
        lvl.orientation,
        playArmies(lvl.cols, lvl.rows, lvl),
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
    state = createInitialState(mapOpts, defaultArmyStamps(COLS, ROWS));
  } else {
    // Keep current terrain layout; respawn armies
    state = createStateFromTerrain(
      state.terrain,
      undefined,
      state.orientation,
      defaultArmyStamps(state.cols, state.rows),
    );
  }
  applyLayout(computeLayout(), false);
  render();
  void maybeAi();
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

function viewOrientation(): HexOrientation {
  return screen === 'editor' ? editorOrientation : state.orientation;
}

function pixelOf(h: Hex): { x: number; y: number } {
  const { x, y } = hexToPixel(h, HEX_SIZE, viewOrientation());
  return { x: x + PAD, y: y + PAD };
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

function loadEditorLevel(lvl: SavedLevel): void {
  editorTerrain = cloneTerrain(lvl.terrain);
  editorOrientation = lvl.orientation;
  editorLevelId = lvl.id;
  editorName = lvl.name;
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
  const saved = saveLevel(
    editorName,
    editorTerrain,
    asNew ? null : editorLevelId,
    editorOrientation,
    editorPieces,
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
  hoverShoot = null;
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
): { canMove: boolean; canShoot: boolean; moveSprint: boolean } {
  const legal = legalHighlights(state, pieceId).filter(
    (h) => eq(h.hex, hex) && h.kind !== 'shoot-range',
  );
  const moveHl = legal.find((h) => h.kind === 'move' || h.kind === 'sprint');
  return {
    canMove: !!moveHl,
    canShoot: legal.some((h) => h.kind === 'shoot'),
    moveSprint: moveHl?.kind === 'sprint',
  };
}

/** Real options anywhere: move hexes, or actual fire targets. */
function availableActions(pieceId: string): { canMove: boolean; canShoot: boolean } {
  const piece = getPiece(state, pieceId);
  if (!piece) return { canMove: false, canShoot: false };
  const all = highlightsFor(pieceId);
  const canMove = all.some((h) => h.kind === 'move' || h.kind === 'sprint');
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
  hoverShoot = null;
  refreshHighlights();
  render();
}

function canActWithSelected(): boolean {
  if (!selectedId || !canControl()) return false;
  const p = getPiece(state, selectedId);
  if (!p || p.side !== state.turn) return false;
  if (state.scoutPieceId && state.scoutPieceId !== selectedId) return false;
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
    const plan = previewMove(state, piece, action.to);
    const stopPx = pixelOf(plan.stop);
    const destPx = pixelOf(action.to);
    const g = document.querySelector<SVGGElement>(
      `g.piece-unit[data-id="${CSS.escape(piece.id)}"]`,
    );
    for (const hit of plan.hits) {
      document
        .querySelector(`g.piece-unit[data-id="${CSS.escape(hit.id)}"]`)
        ?.classList.add(hit.fatal ? 'dying' : 'hit');
    }
    if (g) {
      g.classList.add('moving');
      g.style.transition = `transform ${MOVE_MS}ms ease-out`;
      const bounced = !eq(plan.stop, action.to);
      const stay = eq(plan.stop, { col: piece.col, row: piece.row });
      if (stay && bounced) {
        const bump = {
          x: stopPx.x + (destPx.x - stopPx.x) * 0.4,
          y: stopPx.y + (destPx.y - stopPx.y) * 0.4,
        };
        g.setAttribute('transform', `translate(${bump.x}, ${bump.y})`);
        await wait(MOVE_MS * 0.55);
        g.setAttribute('transform', `translate(${stopPx.x}, ${stopPx.y})`);
        await wait(MOVE_MS * 0.45);
      } else {
        g.setAttribute('transform', `translate(${stopPx.x}, ${stopPx.y})`);
        await wait(MOVE_MS);
      }
    } else {
      await wait(MOVE_MS);
    }
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
    const fatal = hpLeft(t) <= netDamage(t, dmgAmt);
    document
      .querySelector(`g.piece-unit[data-id="${CSS.escape(t.id)}"]`)
      ?.classList.add(fatal ? 'dying' : 'hit');
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

  await wait(SHOT_IMPACT_MS);
  layer.remove();
}

async function tryAct(hex: Hex, kind: ActionMode) {
  if (!canActWithSelected() || !selectedId) return;

  const { canMove, canShoot, moveSprint } = hexActions(selectedId, hex);
  if (kind === 'move' && !canMove) return;
  if (kind === 'shoot' && !canShoot) return;

  const action: Action =
    kind === 'move'
      ? { kind: 'move', pieceId: selectedId, to: hex, sprint: moveSprint }
      : { kind: 'shoot', pieceId: selectedId, at: hex };

  const actingId = selectedId;
  pendingHex = null;
  await playAnimatedAction(action);

  if (state.scoutPieceId === actingId && (state.scoutActionsLeft ?? 0) > 0) {
    selectedId = actingId;
    hoverShoot = null;
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
  while (state.turn !== humanSide && !state.winner && guard < 8) {
    const action = pickAiAction(state);
    if (!action) {
      state = passTurn(state);
      break;
    }
    const turnBefore = state.turn;
    const scoutBefore = state.scoutPieceId;
    await wait(180);
    await playAnimatedAction(action);
    if (state.turn === turnBefore && state.scoutPieceId === scoutBefore && !state.winner) {
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
  return side === 'red' ? '#a33' : '#356';
}

function iconInk(side: Side): string {
  return side === 'red' ? '#ffe4e0' : '#e0ecff';
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
  const moveMap = new Map<string, 'move' | 'sprint'>();
  const shootBorder = new Set<string>();
  const shootTargetBorder = new Set<string>();
  for (const hl of allHl) {
    const k = key(hl.hex);
    if (hl.kind === 'move' || hl.kind === 'sprint') moveMap.set(k, hl.kind);
    else if (hl.kind === 'shoot') shootTargetBorder.add(k);
    else if (hl.kind === 'shoot-range') shootBorder.add(k);
  }

  const splashSet = new Set<string>();
  if (!editing && hoverShoot) {
    const sel = selectedId ? getPiece(state, selectedId) : null;
    if (sel && hasSplash(UNIT_STATS[sel.type])) {
      const fromHex = { col: sel.col, row: sel.row };
      for (const n of splashBlast(state, hoverShoot, fromHex)) {
        splashSet.add(key(n));
      }
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
      else if (mv === 'sprint') hlOverlays += `<polygon class="hl-tint sprint" points="${pts}" />`;

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
      }))
    : state.pieces;
  for (const p of drawPieces) {
    const { x, y } = pixelOf({ col: p.col, row: p.row });
    const sel = !editing && p.id === selectedId ? ' selected' : '';
    const pr = HEX_SIZE * 0.48;
    const reloadIcon = isReloading(p)
      ? reloadBadgeSvg(pr * 0.65, -pr * 0.7, Math.max(6.5, HEX_SIZE * 0.22))
      : '';
    const shots = ammoLeft(p);
    const ammoIcon =
      shots !== null
        ? ammoBadgeSvg(shots, pr * 0.65, pr * 0.7, Math.max(6.5, HEX_SIZE * 0.22))
        : '';
    const maxHp = hpMax(p);
    const hpIcon =
      maxHp > 1
        ? hpBadgeSvg(
            hpLeft(p),
            -pr * 0.65,
            -pr * 0.7,
            Math.max(6.5, HEX_SIZE * 0.22),
          )
        : '';
    const ring = armorColor(UNIT_STATS[p.type].armor);
    piecesSvg += `
      <g class="piece-unit${isReloading(p) ? ' reloading' : ''}${isDepleted(p) ? ' depleted' : ''}" data-id="${p.id}" transform="translate(${x}, ${y})">
        ${
          sel
            ? `<circle class="piece-sel" cx="0" cy="0" r="${pr + 3.2}" fill="none" stroke="var(--sel)" stroke-width="2" />`
            : ''
        }
        <circle class="piece-bg" cx="0" cy="0" r="${pr}"
          fill="${pieceColor(p.side)}" stroke="${ring}" stroke-width="2.2" />
        <g class="piece-glyph ${p.side}" fill="${iconInk(p.side)}" stroke="none" color="${iconInk(p.side)}">
          ${pieceIconSvg(p.type, PIECE_ICON)}
        </g>
        ${reloadIcon}
        ${hpIcon}
        ${ammoIcon}
      </g>`;
  }

  const defs = `
    <defs>
      <pattern id="rock-tex" patternUnits="userSpaceOnUse" width="14" height="14">
        <rect width="14" height="14" fill="#5c574f"/>
        <path d="M0 3 L4 1 L8 4 L6 8 L2 7 Z" fill="#6a655c" opacity="0.85"/>
        <path d="M7 8 L12 6 L14 10 L10 13 L7 11 Z" fill="#4a463f" opacity="0.9"/>
        <path d="M1 10 L5 9 L6 13 L2 14 Z" fill="#706b60" opacity="0.7"/>
        <path d="M0 0 L14 14 M14 0 L0 14 M4 0 L14 10 M0 6 L8 14"
          stroke="#3a3630" stroke-width="0.7" opacity="0.55" fill="none"/>
        <circle cx="3" cy="5" r="0.7" fill="#2e2b26" opacity="0.5"/>
        <circle cx="10" cy="3" r="0.5" fill="#7a756a" opacity="0.45"/>
        <circle cx="9" cy="11" r="0.6" fill="#2e2b26" opacity="0.4"/>
      </pattern>
      <pattern id="wall-tex" patternUnits="userSpaceOnUse" width="12" height="12">
        <rect width="12" height="12" fill="#6e7278"/>
        <rect x="0" y="0" width="12" height="5.5" fill="#7a7e84"/>
        <rect x="0" y="6" width="12" height="5.5" fill="#63676d"/>
        <path d="M0 6 H12 M6 0 V6 M0 12 H12" stroke="#4a4e54" stroke-width="1"/>
        <path d="M0 0 H12 M0 0 V12" stroke="#8a8e94" stroke-width="0.6" opacity="0.5"/>
      </pattern>
      <pattern id="water-tex" patternUnits="userSpaceOnUse" width="18" height="12">
        <rect width="18" height="12" fill="#2a4a5c"/>
        <path d="M-2 3 Q2 1 6 3 T14 3 T22 3" fill="none" stroke="#3d6a82" stroke-width="1.2" opacity="0.75"/>
        <path d="M-2 7 Q2 5 6 7 T14 7 T22 7" fill="none" stroke="#1e3a4a" stroke-width="1.1" opacity="0.7"/>
        <path d="M-2 11 Q3 9 7 11 T15 11 T23 11" fill="none" stroke="#4a7a94" stroke-width="1" opacity="0.55"/>
        <ellipse cx="4" cy="2" rx="1.8" ry="0.6" fill="#6a9ab0" opacity="0.25"/>
        <ellipse cx="13" cy="8" rx="2.2" ry="0.7" fill="#6a9ab0" opacity="0.2"/>
      </pattern>
      <pattern id="high-tex" patternUnits="userSpaceOnUse" width="20" height="20">
        <rect width="20" height="20" fill="#8a7348"/>
        <rect width="20" height="20" fill="#a08a55" opacity="0.45"/>
        <!-- topo contours -->
        <ellipse cx="10" cy="10" rx="8" ry="6.5" fill="none" stroke="#6b5530" stroke-width="1" opacity="0.55"/>
        <ellipse cx="10" cy="10" rx="5" ry="4" fill="none" stroke="#c4b07a" stroke-width="1" opacity="0.5"/>
        <ellipse cx="10" cy="10" rx="2.2" ry="1.8" fill="#d2c08a" opacity="0.35"/>
        <path d="M1 15 Q6 12 10 14 T19 13" fill="none" stroke="#5c4828" stroke-width="0.8" opacity="0.4"/>
        <path d="M2 6 Q8 3 14 5" fill="none" stroke="#efe0b0" stroke-width="0.7" opacity="0.35"/>
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
      ? 'Melee (take the hex on a kill) or shoot this hex?'
      : 'Move onto or shoot this hex?';
  } else if (
    pending?.canMove &&
    pieceAt(state, pendingHex!) &&
    pieceAt(state, pendingHex!)!.side !== piece.side
  ) {
    hint = `Melee — ${UNIT_STATS[piece.type].meleeDamage} dmg; kill takes the hex`;
  } else if (
    state.scoutPieceId &&
    state.scoutPieceId !== piece.id &&
    piece.side === state.turn
  ) {
    hint = 'Scout still has an action — finish or skip it';
  } else if (!canMove && !canShoot) {
    hint = isDepleted(piece)
      ? "Empty — can't shoot"
      : isReloading(piece)
        ? "Reloading — can't shoot"
        : 'No moves or shots';
  } else if (previewOnly) {
    hint = 'Range preview';
  } else {
    hint = 'Green = move · click enemy in range to shoot';
  }

  const scoutUi =
    state.scoutPieceId && canControl()
      ? `<button type="button" id="skip-scout">Skip scout</button>`
      : '';

  const picker = choosing
    ? ''
    : `<div class="action-solo">${
        canShoot && !canMove ? 'Shoot' : canMove ? 'Move' : '—'
      }${isDepleted(piece) ? ' · empty' : isReloading(piece) ? ' · reloading' : ''}</div>`;

  return `
    <div class="action-bar">
      <div class="action-bar-piece">
        <svg class="side-icon" viewBox="-10 -10 20 20" width="26" height="26" aria-hidden="true">
          <circle cx="0" cy="0" r="9.5" fill="${pieceColor(piece.side)}" stroke="${armorColor(s.armor)}" stroke-width="2" />
          <g fill="${iconInk(piece.side)}" color="${iconInk(piece.side)}">${pieceIconSvg(piece.type, 13)}</g>
        </svg>
        <span>${s.name}${previewOnly ? ' · preview' : ''}</span>
      </div>
      ${picker}
      ${scoutUi}
      <span class="action-bar-hint">${hint}</span>
    </div>`;
}

function renderSidebar(): string {
  const piece = selectedId ? getPiece(state, selectedId) : null;
  let detail =
    '<p class="empty-hint">Click a piece — move + shoot range show together. Pick Move or Shoot to act.</p>';

  if (piece) {
    const s = UNIT_STATS[piece.type];
    const sprintLine =
      s.sprint
        ? piece.hasSprint
          ? `<div><strong>Sprint:</strong> ready (move ${s.sprintMove} once — shooting spends it)</div>`
          : `<div><strong>Sprint:</strong> spent</div>`
        : '';
    const scoutLine =
      s.actions > 1
        ? `<div><strong>Actions:</strong> ${s.actions} per turn${
            s.moveBudget > 0 ? ` · move cap ${s.moveBudget}` : ''
          }</div>
           ${
             piece.type === 'scout'
               ? `<div><strong>Pathing:</strong> moves through water and pieces (not rocks)</div>`
               : ''
           }`
        : '';
    const tankLine =
      piece.type === 'tank'
        ? `<div><strong>Pathing:</strong> overruns infantry (${s.meleeDamage} dmg; survivor blocks); blocked by rock/wall/high</div>
           <div><strong>Min range:</strong> cannot shoot closer than ${s.shootMin}</div>`
        : '';
    const splashLine = hasSplash(s)
      ? `<div><strong>Splash:</strong> ${s.splashDamage} dmg · full ring / wall hits = 3 tiles back-arc (FF)</div>`
      : '';
    const cd = s.shootCooldown;
    const reloadLine =
      cd > 0
        ? isReloading(piece)
          ? `<div><strong>Weapon:</strong> reloading (${piece.shootCooldown} left) — can still move</div>`
          : `<div><strong>Weapon:</strong> ${cd}-turn cooldown after firing</div>`
        : '';
    const ammoLine =
      s.ammo > 0
        ? `<div><strong>Ammo:</strong> ${ammoLeft(piece) ?? 0}/${s.ammo}${
            isDepleted(piece) ? ' — empty' : ''
          }</div>`
        : '';
    const hpLine =
      s.hp > 1 || hpLeft(piece) < s.hp
        ? `<div><strong>HP:</strong> ${hpLeft(piece)}/${s.hp}</div>`
        : '';

    const previewOnly = piece.side !== state.turn || !canControl();

    detail = `
      <h2>
        <svg class="side-icon" viewBox="-10 -10 20 20" width="28" height="28" aria-hidden="true">
          <circle cx="0" cy="0" r="9.5" fill="${pieceColor(piece.side)}" stroke="${armorColor(s.armor)}" stroke-width="2" />
          <g fill="${iconInk(piece.side)}" color="${iconInk(piece.side)}">${pieceIconSvg(piece.type, 14)}</g>
        </svg>
        ${s.name} <span class="meta">(${s.chess})</span>
      </h2>
      <div class="meta">${piece.side.toUpperCase()} · value ${s.value}${
        previewOnly ? ' · preview' : ''
      }</div>
      <div class="stats">
        <div><strong>Move:</strong> ${s.move}</div>
        <div><strong>Shoot:</strong> ${
          s.shootMin > 1 ? `${s.shootMin}–${s.shoot}` : String(s.shoot)
        }${
          state.terrain[piece.row][piece.col] === 'high' ? ' (+1 high ground)' : ''
        }</div>
        <div><strong>Melee:</strong> ${s.meleeDamage} dmg</div>
        <div><strong>Shot:</strong> ${s.shootDamage} dmg</div>
        <div><strong>Armor:</strong> ${s.armor > 0 ? '+' : ''}${s.armor}</div>
        ${sprintLine}${scoutLine}${tankLine}${splashLine}${reloadLine}${ammoLine}${hpLine}
        ${
          state.terrain[piece.row][piece.col] === 'high'
            ? `<div><strong>High ground:</strong> +1 shoot range</div>`
            : ''
        }
      </div>`;
  }

  const log = [...state.log]
    .slice(-40)
    .reverse()
    .map((l) => `<div>${l}</div>`)
    .join('');

  return `
    <div class="sidebar">
      <h2>Abilities</h2>
      ${detail}
      <div class="legend">
        <span class="l-move">Move</span>
        <span class="l-sprint">Sprint (soldier)</span>
        <span class="l-shoot">Shoot (target)</span>
        <span class="l-shoot-range">Shoot range</span>
        <span class="l-shoot-border">Red border = shoot range</span>
      </div>
      <div class="meta">
        Water: shoot over, no cross.<br/>
        From low: rock/wall + pieces + high block LOS.<br/>
        From high: +1 shoot; over pieces & along ridge; rock/wall still block.<br/>
        Walls = rock but rockets demolish them. Climb from low −1; high→high free.<br/>
        Melee: move into an occupied hex — melee dmg; a kill takes the hex, else you stop before.<br/>
        Shot / splash / melee each use their own damage, minus the target's armor.<br/>
        Win: kill the enemy General.
      </div>
      <h2>Log</h2>
      <div class="log">${log}</div>
    </div>`;
}

function turnLabel(): string {
  if (state.winner) {
    return `<span class="${state.winner}">${state.winner.toUpperCase()} wins</span> — general down`;
  }
  if (aiThinking || animating) {
    if (mode === 'ai' && state.turn !== humanSide) {
      return `<span class="blue">Blue (AI)</span> moving…`;
    }
  }
  if (mode === 'ai') {
    return state.turn === humanSide
      ? `<span class="red">Your turn (Red)</span>`
      : `<span class="blue">Blue (AI)</span>`;
  }
  return `<span class="${state.turn}">${state.turn.toUpperCase()} to move</span>`;
}

function renderEndOverlay(): string {
  if (!state.winner) return '';

  const youWon = mode === 'ai' && state.winner === humanSide;
  const youLost = mode === 'ai' && state.winner !== humanSide;
  const tone = youLost ? 'defeat' : 'victory';

  const title = youWon
    ? 'VICTORY'
    : youLost
      ? 'DEFEAT'
      : `${state.winner.toUpperCase()} WINS`;

  const sub = youWon
    ? 'Enemy general eliminated.'
    : youLost
      ? 'Your general has fallen.'
      : `${state.winner === 'red' ? 'Red' : 'Blue'} destroyed the opposing general.`;

  const winnerSide = state.winner;

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
          <button type="button" id="end-rematch">Rematch</button>
          <button type="button" id="end-dismiss" class="ghost">Keep board</button>
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
  const piece = getPiece(state, selectedId);
  const occ = pieceAt(state, pendingHex);
  const melee = !!(piece && occ && occ.side !== piece.side);
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
      pendingHex = hex;
      hoverShoot = null;
      render();
      return;
    }
    if (canShoot) {
      void tryAct(hex, 'shoot');
      return;
    }
    if (canMove) {
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

  svg.addEventListener('pointermove', (e) => {
    if (animating) return;
    const hex = hexFromPointer(svg, e.clientX, e.clientY);
    if (!hex) {
      if (hoverShoot) {
        hoverShoot = null;
        const board = app.querySelector('svg.board');
        if (board) {
          board.outerHTML = renderBoard();
          bindBoardOnly();
          placeHexChoice();
        }
      }
      return;
    }
    const sel = selectedId ? getPiece(state, selectedId) : null;
    const isValidSplashAim =
      !!sel &&
      hasSplash(UNIT_STATS[sel.type]) &&
      highlights.some((h) => h.kind === 'shoot' && eq(h.hex, hex));

    const nextHover = isValidSplashAim ? hex : null;
    const changed =
      (!!nextHover && (!hoverShoot || !eq(hoverShoot, nextHover))) ||
      (!nextHover && !!hoverShoot);
    if (changed) {
      hoverShoot = nextHover;
      const board = app.querySelector('svg.board');
      if (board) {
        board.outerHTML = renderBoard();
        bindBoardOnly();
        placeHexChoice();
      }
    }
  });
}

function levelSelectOptions(selectedId: string | null): string {
  const levels = listLevels();
  const opts = [`<option value="random"${!selectedId ? ' selected' : ''}>Random map</option>`];
  for (const l of levels) {
    const tag = l.id === defaultLevelId ? ' (default)' : '';
    opts.push(
      `<option value="${l.id}"${selectedId === l.id ? ' selected' : ''}>${escapeHtml(l.name)}${tag}</option>`,
    );
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
    <h1>CHESS ARMY</h1>
    <button type="button" data-mode="ai" class="${mode === 'ai' ? 'active' : ''}">vs AI</button>
    <button type="button" data-mode="hotseat" class="${mode === 'hotseat' ? 'active' : ''}">Hotseat</button>
    <button type="button" id="reset">Reset</button>
    <button type="button" id="open-editor" class="${screen === 'editor' ? 'active' : ''}">Editor</button>
    <button type="button" id="open-units" class="${screen === 'units' ? 'active' : ''}">Units</button>
    ${syncStatusHtml()}
  </div>`;
}

function leaveEditors() {
  if (screen === 'editor') editorPainting = false;
  screen = 'play';
}

function bindToolbarEvents() {
  app.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode as Mode;
      leaveEditors();
      startMatch(false);
    });
  });
  app.querySelector('#reset')?.addEventListener('click', () => {
    leaveEditors();
    reset(false);
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

function renderEditorBar(): string {
  const levels = listLevels();
  const forms = listFormations();
  const grid = currentGrid();
  const brushes = TERRAIN_BRUSHES.map(
    (b) =>
      `<button type="button" class="brush ${b.id}${editorBrush === b.id ? ' active' : ''}" data-brush="${b.id}">${b.label}</button>`,
  ).join('');
  const unitBrushes = [
    ...UNIT_TYPES.map(
      (t) =>
        `<button type="button" class="brush unit ${t}${editorBrush === t ? ' active' : ''}" data-brush="${t}">${escapeHtml(UNIT_STATS[t].name)}</button>`,
    ),
    `<button type="button" class="brush unit erase${editorBrush === 'erase-unit' ? ' active' : ''}" data-brush="erase-unit">Erase</button>`,
  ].join('');

  const levelList =
    levels.length === 0
      ? `<p class="editor-empty">No saved levels yet</p>`
      : `<ul class="editor-levels">${levels
          .map(
            (l) => `<li class="${l.id === editorLevelId ? 'active' : ''}">
              <button type="button" data-load-level="${l.id}">${escapeHtml(l.name)} <span class="lvl-meta">${l.cols}×${l.rows} · ${l.orientation === 'flat' ? 'flat' : 'point'}${l.id === defaultLevelId ? ' · default' : ''}</span></button>
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
      <div class="editor-grid">
        <span class="editor-label">Grid</span>
        <label>W <input type="number" id="editor-cols" min="${MIN_COLS}" max="${MAX_COLS}" value="${grid.cols}" /></label>
        <label>H <input type="number" id="editor-rows" min="${MIN_ROWS}" max="${MAX_ROWS}" value="${grid.rows}" /></label>
        <span class="editor-label">Tiles</span>
        <button type="button" data-ori="pointy" class="${editorOrientation === 'pointy' ? 'active' : ''}">Point up</button>
        <button type="button" data-ori="flat" class="${editorOrientation === 'flat' ? 'active' : ''}">Flat up</button>
      </div>
      <div class="editor-brushes">
        <span class="editor-label">Paint</span>
        ${brushes}
      </div>
      <div class="editor-army">
        <span class="editor-label">Army</span>
        <button type="button" class="editor-side red${editorArmySide === 'red' ? ' active' : ''}" data-army-side="red">Red</button>
        <button type="button" class="editor-side blue${editorArmySide === 'blue' ? ' active' : ''}" data-army-side="blue">Blue</button>
        <span class="editor-label">Units</span>
        ${unitBrushes}
      </div>
      <div class="editor-save editor-army-save">
        <input type="text" id="army-name" value="${escapeHtml(editorFormationName)}" placeholder="Army name" maxlength="48" />
        <button type="button" id="army-save">${namedForm ? 'Save' : 'Save new'}</button>
        <button type="button" id="army-save-as" class="ghost">Save as new</button>
        <button type="button" id="army-save-default" class="${isDefaultForm ? 'active' : ''}">${isDefaultForm ? 'Default army' : 'Save as default'}</button>
        <button type="button" id="army-clear" class="ghost">Clear</button>
      </div>
      <div class="editor-library editor-army-library">
        <span class="editor-label">Saved armies · load onto ${editorArmySide === 'red' ? 'Red' : 'Blue'}${editorArmySide === 'blue' ? ' (flipped)' : ''}</span>
        ${formList}
      </div>
      <div class="editor-save">
        <input type="text" id="editor-name" value="${escapeHtml(editorName)}" placeholder="Level name" maxlength="48" />
        <button type="button" id="editor-save">${editorLevelId ? 'Save' : 'Save new'}</button>
        <button type="button" id="editor-save-as" class="ghost">Save as new</button>
        <button type="button" id="editor-save-default" class="${editorLevelId && editorLevelId === defaultLevelId && !editorDirty ? 'active' : ''}">${editorLevelId && editorLevelId === defaultLevelId && !editorDirty ? 'Default map' : 'Save as default'}</button>
        <button type="button" id="editor-clear" class="ghost">Clear board</button>
      </div>
      <div class="editor-library">
        <span class="editor-label" id="editor-lib-label">Saved levels${editorDirty ? ' · unsaved changes' : ''}</span>
        ${levelList}
      </div>
    </div>`;
}

function gameOverClass(): string {
  if (!state.winner) return '';
  if (endOverlayDismissed) return 'game-over';
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
  return `<label>${label} <input type="number" min="${min}" max="${max}" value="${val}" data-unit="${type}" data-field="${field}" /></label>`;
}

function unitChkField(type: UnitType, field: EditableStat, label: string): string {
  const on = UNIT_STATS[type][field] as boolean;
  return `<label class="chk"><input type="checkbox" data-unit="${type}" data-field="${field}"${on ? ' checked' : ''} /> ${label}</label>`;
}

function renderUnitEditor(): string {
  const cards = UNIT_TYPES.map((type) => {
    const s = UNIT_STATS[type];
    return `<article class="unit-card">
      <header>
        <svg class="side-icon" viewBox="-10 -10 20 20" width="32" height="32" aria-hidden="true">
          <circle cx="0" cy="0" r="9.5" fill="#3d4a3a" stroke="${armorColor(s.armor)}" stroke-width="2" />
          <g fill="#e8ebe6" color="#e8ebe6">${pieceIconSvg(type, 16)}</g>
        </svg>
        <div>
          <h3>${escapeHtml(s.name)}</h3>
          <span class="lvl-meta">${escapeHtml(s.chess)}</span>
        </div>
      </header>
      <div class="unit-fields">
        <div class="unit-group">
          <span class="unit-group-label">Move</span>
          ${unitNumField(type, 'move', 'Range')}
          ${unitNumField(type, 'actions', 'Actions')}
          ${unitNumField(type, 'moveBudget', 'Move cap')}
          ${unitNumField(type, 'sprintMove', 'Sprint mv')}
          ${unitNumField(type, 'meleeDamage', 'Melee dmg')}
          ${unitChkField(type, 'sprint', 'Sprint')}
        </div>
        <div class="unit-group">
          <span class="unit-group-label">Shoot</span>
          ${unitNumField(type, 'shoot', 'Range')}
          ${unitNumField(type, 'shootMin', 'Min rng')}
          ${unitNumField(type, 'shootCooldown', 'Reload')}
          ${unitNumField(type, 'ammo', 'Ammo')}
          ${unitNumField(type, 'shootDamage', 'Shot dmg')}
          ${unitNumField(type, 'splashDamage', 'Splash dmg')}
        </div>
        <div class="unit-group">
          <span class="unit-group-label">Piece</span>
          ${unitNumField(type, 'hp', 'HP')}
          ${unitNumField(type, 'armor', 'Armor')}
          ${unitNumField(type, 'value', 'Value')}
        </div>
      </div>
    </article>`;
  }).join('');

  return `
    <div class="unit-editor">
      <p class="editor-label" id="units-status">${
        unitStatsAreStock()
          ? 'Stock stats'
          : 'Custom stats · saved in this browser'
      }</p>
      <div class="unit-cards">${cards}</div>
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
    if (el.type === 'checkbox') patchUnitStat(type, field, el.checked);
    else patchUnitStat(type, field, Number(el.value));
    // Sanitize may clamp min>max; sync the live input values for this unit
    app.querySelectorAll<HTMLInputElement>(`input[data-unit="${type}"]`).forEach((inp) => {
      const f = inp.dataset.field as EditableStat;
      const v = UNIT_STATS[type][f];
      if (inp.type === 'checkbox') inp.checked = Boolean(v);
      else if (Number(inp.value) !== v) inp.value = String(v);
    });
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
      }
      if (defaultLevelId === id) defaultLevelId = null;
      render();
    });
  });
  bindEditorBoard();
}

function bindEvents() {
  bindToolbarEvents();
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
  app.querySelector('#end-dismiss')?.addEventListener('click', () => {
    endOverlayDismissed = true;
    render();
  });
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
  app.querySelector('.hex-choice')?.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  app.querySelectorAll<HTMLButtonElement>('[data-action-mode]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      void resolvePending(btn.dataset.actionMode as ActionMode);
    });
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
  if (!state.winner) endOverlayDismissed = false;

  if (screen === 'units') {
    app.innerHTML = `
      <div class="board-wrap unit-editor-wrap">
        ${renderToolbar()}
        ${renderUnitEditor()}
      </div>
      <aside class="sidebar">
        <h2>Units</h2>
        <p class="muted">Live immediately. New match to respawn sprint, ammo, and HP.</p>
        <dl class="help-list">
          <dt>Move</dt>
          <dd><strong>Range</strong> hexes per action</dd>
          <dd><strong>Actions</strong> activations per turn</dd>
          <dd><strong>Move cap</strong> total steps this activation (0 = none; scout stock 3)</dd>
          <dd><strong>Sprint</strong> once-per-game extra move; shooting spends it</dd>
          <dd><strong>Melee dmg</strong> bump an occupied hex; a kill takes the spot, else stop on the hex before</dd>
          <dt>Shoot</dt>
          <dd><strong>Range / min</strong> fire distance</dd>
          <dd><strong>Reload</strong> own turns you can't shoot after firing</dd>
          <dd><strong>Ammo</strong> shots this match (0 = unlimited)</dd>
          <dd><strong>Shot dmg</strong> bullets</dd>
          <dd><strong>Splash dmg</strong> 0 = bullets; &gt;0 = rocket blast (bazooka/tank stock 1)</dd>
          <dt>Piece</dt>
          <dd><strong>HP</strong> default 1</dd>
          <dd><strong>Armor</strong> subtracted from incoming dmg (can be negative). Ring: +2 green, +1 orange, 0 red, −1 purple. Stock: tank +2, general +1</dd>
          <dd><strong>Value</strong> scoring / AI</dd>
          <dd>Tank overrun and scout water-walk stay type-locked.</dd>
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
        <div class="turn-banner">Paint terrain or units · load an army onto Red / Blue (Blue is flipped)</div>
        <div class="board-stage">
          ${renderBoard()}
        </div>
        ${renderEditorBar()}
      </div>
      <aside class="sidebar">
        <h2>Editor</h2>
        <p class="muted">Set width × height (tiles) and hex orientation, then paint land, water, rock, concrete wall, and high ground. Paint units onto the selected side, or load a saved army (Blue gets the formation flipped). Save as default army uses that preset on random maps and on levels with no stamped armies.</p>
        <p class="muted">Point up = pointy-top hexes. Flat up = flat-top. Topology (neighbors / LOS) follows the orientation. Saving a level stores the pieces currently on the board.</p>
      </aside>
    `;
    bindEvents();
    return;
  }

  const randomParams = !activeLevelId
    ? `<div class="map-params">
        <label>Water <input type="number" id="map-water" min="0" max="${maxT}" value="${mapOpts.waterCount}" /></label>
        <label>Rocks <input type="number" id="map-rock" min="0" max="${maxT}" value="${mapOpts.rockCount}" /></label>
        <label>Walls <input type="number" id="map-wall" min="0" max="${maxT}" value="${mapOpts.wallCount}" /></label>
        <label>High <input type="number" id="map-high" min="0" max="${maxT}" value="${mapOpts.highCount}" /></label>
        <button type="button" id="new-map">New map</button>
        <span class="map-hint">mid belt · climb from low −1 · high→high free · high +1 shoot</span>
      </div>`
    : `<div class="map-params">
        <button type="button" id="new-map">Restart level</button>
        <button type="button" id="open-editor">Edit this level</button>
        <span class="map-hint">Playing saved level</span>
      </div>`;

  app.innerHTML = `
    <div class="board-wrap ${gameOverClass()}">
      ${renderToolbar()}
      <div class="map-params level-row">
        <label>Level
          <select id="level-select">${levelSelectOptions(activeLevelId)}</select>
        </label>
      </div>
      ${randomParams}
      <div class="turn-banner">${turnLabel()}</div>
      <div class="board-stage">
        ${renderBoard()}
        ${renderHexChoice()}
        ${!endOverlayDismissed ? renderEndOverlay() : ''}
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
  if (applied && screen === 'play') {
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
