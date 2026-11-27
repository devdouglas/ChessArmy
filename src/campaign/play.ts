import './campaign.css';
import {
  CAPITAL_LABEL,
  DEFAULT_VIEW,
  type CampaignMap,
  type CampaignRegion,
  type Point,
  type SeaNode,
} from './types';
import { centroid, pointInPolygon, ringToPath } from './geometry';
import { UNIT_STATS } from '../roster';
import { playSfx } from '../sfx';
import { capitalMarkerSvg, siegeMarkerSvg, villageMarkerSvg } from './settlementIcons';
import { loadCampaignMap } from './store';
import { sanitizeUnitAccess } from './units';
import {
  activeSeat,
  choosableFactions,
  clearSavedMatch,
  cloneMatch,
  createMatch,
  loadMatch,
  saveMatch,
  seatOf,
  type CampaignStack,
  type MatchState,
  type TurnPhase,
} from './match';
import { actionGlyphSvg, coinGlyphSvg } from '../icons';
import {
  admitBattleDefeat,
  advancePhase,
  breakSiege,
  buildSeaAdjacency,
  canBreakSiege,
  canSiegeBattle,
  canSiegeRegion,
  siegeToBattle,
  collectTaxes,
  canDeclareColocatedAttack,
  controllableStackIds,
  declareColocatedAttack,
  declareTreachery,
  isRegionSupplied,
  legalMovesForStack,
  moveStack,
  openInvasionContacts,
  ownerOf,
  payUpkeep,
  planBattleDice,
  recruit,
  recruitableRegions,
  resolveInvasionChoice,
  retreatDestinations,
  stacksInRegion,
  taxableCapitalRegions,
  toggleSupplyGrant,
  armiesNeedingUpkeep,
  isCampaigningArmy,
  isSeaStopLocation,
  upkeepLossAmount,
} from './rules';
import {
  resolveAiInvasionContactsAsync,
  runCampaignAiTurnsAsync,
} from './ai';

export type CampaignPlayHandle = {
  destroy: () => void;
};

function factionColor(map: CampaignMap, ownerId: string | null): string {
  if (!ownerId) return '#5a6a7c';
  if (ownerId.startsWith('rebel:')) return '#8d6e63';
  return map.factions.find((f) => f.id === ownerId)?.color ?? '#5a6a7c';
}

function factionName(map: CampaignMap, ownerId: string | null): string {
  if (!ownerId) return 'Neutral';
  if (ownerId.startsWith('rebel:')) {
    const home = ownerId.slice('rebel:'.length);
    return `Rebels (${map.factions.find((f) => f.id === home)?.name ?? home})`;
  }
  return map.factions.find((f) => f.id === ownerId)?.name ?? 'Unknown';
}

function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

function svgToClient(svg: SVGSVGElement, x: number, y: number): Point {
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = pt.matrixTransform(ctm);
  return { x: p.x, y: p.y };
}

function findSeaStopAt(map: CampaignMap, p: Point, r = 14): SeaNode | null {
  let best: SeaNode | null = null;
  let bestD = r;
  for (const n of map.seaNodes) {
    if (n.kind !== 'stop') continue;
    const d = Math.hypot(n.at.x - p.x, n.at.y - p.y);
    if (d <= bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

/** Click target: prefer legal ocean stop, else land region, else any nearby stop. */
function findMoveLocationAt(
  map: CampaignMap,
  p: Point,
  legal?: string[],
): string | null {
  const stop = findSeaStopAt(map, p);
  if (stop && (!legal || legal.includes(stop.id))) return stop.id;
  const reg = findRegionAt(map, p);
  if (reg) return reg.id;
  return stop?.id ?? null;
}

/** Stack chip anchor in map space (centroid / settlement-ish). */
function locationChipAt(map: CampaignMap, locationId: string): Point | null {
  const stop = map.seaNodes.find((n) => n.kind === 'stop' && n.id === locationId);
  if (stop) return { x: stop.at.x, y: stop.at.y - 10 };
  const reg = map.regions.find((r) => r.id === locationId);
  if (!reg) return null;
  const c = centroid(reg.ring);
  return { x: c.x, y: c.y + 12 };
}

function findRegionAt(map: CampaignMap, p: Point): CampaignRegion | null {
  for (let i = map.regions.length - 1; i >= 0; i--) {
    if (pointInPolygon(p, map.regions[i].ring)) return map.regions[i];
  }
  return null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function phaseLabel(p: TurnPhase): string {
  switch (p) {
    case 'taxes':
      return 'I · Taxes';
    case 'upkeep':
      return 'II · Upkeep';
    case 'move':
      return 'III · Move';
    case 'invasions':
      return 'IV · Invasions';
    case 'armies':
      return 'V · Armies';
  }
}

/** Strength legend: 1–2 meeples, 3 ★, 4+ ★+count. */
function stackBadge(s: CampaignStack, upkeepWarn = false): string {
  const n = s.units;
  const warn = upkeepWarn ? ' !!!' : '';
  if (n <= 0) return `·${warn}`;
  if (n === 1) return `♟${warn}`;
  if (n === 2) return `♟♟${warn}`;
  if (n === 3) return `★${warn}`;
  return `★${n}${warn}`;
}

/** Compact meeple (head + body) centered at origin. */
const MEEPLE_PATH =
  'M0 -5.2 a2.15 2.15 0 1 1 0 0.01 M0 -2.7 L-3.1 0.2 L-2.2 0.55 L-2.6 5.4 H-0.85 L-0.55 2.1 H0.55 L0.85 5.4 H2.6 L2.2 0.55 L3.1 0.2 Z';

const STRENGTH_STAR_PATH =
  'M0 -5.6 L1.25 -1.75 H5.2 L2.05 0.55 L3.2 4.5 L0 2.15 L-3.2 4.5 L-2.05 0.55 L-5.2 -1.75 H-1.25 Z';

const CHIP_ICON = '#ffffff';

function meepleIconSvg(x: number): string {
  return `<path class="cm-meeple" d="${MEEPLE_PATH}" transform="translate(${x},0)" fill="${CHIP_ICON}" stroke="rgba(0,0,0,0.35)" stroke-width="0.45" stroke-linejoin="round"/>`;
}

function starIconSvg(x: number): string {
  return `<path class="cm-strength-star" d="${STRENGTH_STAR_PATH}" transform="translate(${x},0)" fill="${CHIP_ICON}" stroke="rgba(0,0,0,0.35)" stroke-width="0.45" stroke-linejoin="round"/>`;
}

/** Cooldown / exhausted — sits just right of the chip. */
function hourglassIconSvg(x: number): string {
  return `<g class="cm-hourglass" transform="translate(${x},0)" aria-hidden="true">
    <path d="M-2.6 -5 H2.6 V-3.7 L0.3 -0.85 L2.6 2 V5 H-2.6 V2 L-0.3 -0.85 L-2.6 -3.7 Z"
      fill="none" stroke="#f0d878" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M-1.45 -3.45 H1.45 L0 -0.85 Z" fill="#c9a227"/>
  </g>`;
}

/** Map chip: faction-colored plate, white meeple/★. */
function stackChipMarkup(
  s: CampaignStack,
  map: CampaignMap,
  x: number,
  y: number,
  selected: boolean,
  dragging: boolean,
  upkeepWarn: boolean,
): string {
  const n = Math.max(0, s.units);
  const fc = factionColor(map, s.factionId);
  const sel = selected ? ' selected' : '';
  const drag = dragging ? ' dragging' : '';
  const warn = upkeepWarn ? ' upkeep-warn' : '';
  const cooled = s.moved || s.exhausted;
  const moved = cooled ? ' moved' : '';
  const army = s.kind === 'army' ? ' army' : '';

  let icons = '';
  let hitW = 16;
  if (n <= 0) {
    icons = `<circle r="3" fill="${CHIP_ICON}" stroke="rgba(0,0,0,0.35)" stroke-width="0.45"/>`;
  } else if (n === 1) {
    icons = meepleIconSvg(0);
    hitW = 14;
  } else if (n === 2) {
    icons = `${meepleIconSvg(-5)}${meepleIconSvg(5)}`;
    hitW = 22;
  } else if (n === 3) {
    icons = starIconSvg(0);
    hitW = 16;
  } else {
    icons = `${starIconSvg(-5)}<text class="cm-strength-count" x="6" y="3.2" text-anchor="start">${n}</text>`;
    hitW = n >= 10 ? 28 : 24;
  }

  const bang = upkeepWarn
    ? `<text class="cm-upkeep-bang" x="0" y="-9" text-anchor="middle">!!!</text>`
    : '';
  const hourglass = cooled ? hourglassIconSvg(hitW / 2 + 5.5) : '';

  return `<g class="cm-stack-chip${sel}${drag}${warn}${moved}${army}" data-stack="${s.id}" transform="translate(${x},${y})">
    <rect class="cm-stack-hit" x="${-hitW / 2}" y="-8" width="${hitW}" height="16" rx="3" fill="${fc}" stroke="#0a0a0a" stroke-width="0.7"/>
    ${icons}
    ${bang}
    ${hourglass}
  </g>`;
}

export async function mountCampaignPlay(
  host: HTMLElement,
  opts: { onBack: () => void },
): Promise<CampaignPlayHandle> {
  const map = await loadCampaignMap();
  const sea = buildSeaAdjacency(map);
  let view = { ...map.view };
  let selectedId: string | null = null;
  let selectedStackId: string | null = null;
  let legalDests: string[] = [];
  /** Click-move peels 1; drag-move sends the whole stack. */
  let moveCountMode: 'one' | 'all' = 'one';
  /** Dock Recruit → any owned region or unowned adjacent; on by default at move start. */
  let recruitMode = false;
  let lastRecruitTurnKey = '';
  let spacePan = false;
  let panning = false;
  let panLast: Point | null = null;
  let stackDrag: {
    stackId: string;
    startX: number;
    startY: number;
    dragging: boolean;
    pointerId: number;
  } | null = null;
  let statusMsg = '';
  let giftPayerId: string | null = null;
  let taxFxBusy = false;
  let taxFxToken = 0;
  /** Army march animation in flight. */
  let moveFxBusy = false;
  /** Autoresolve battle FX (step −1 popups). */
  let battleFxBusy = false;
  /** Hide this stack chip while its march FX plays. */
  let marchingHideStackId: string | null = null;
  /** Human defender: click these adjacent owned hexes to Flight. */
  let flightDests: string[] = [];
  /** Region under attack (map highlight). */
  let invadedHighlightId: string | null = null;
  let lastCenteredTurnKey = '';

  let match: MatchState | null = loadMatch();
  let setupPicks: string[] = [];
  let setupAi = new Set<string>();
  let aiBusy = false;

  const root = document.createElement('div');
  root.className = 'campaign-root campaign-play';
  host.replaceChildren(root);

  function centerViewOn(sx: number, sy: number): void {
    view = { ...view, x: sx - view.w / 2, y: sy - view.h / 2 };
  }

  function centerOnRegion(regionId: string): boolean {
    const stop = map.seaNodes.find((n) => n.kind === 'stop' && n.id === regionId);
    if (stop) {
      centerViewOn(stop.at.x, stop.at.y);
      return true;
    }
    const reg = map.regions.find((r) => r.id === regionId);
    if (!reg) return false;
    if (reg.settlement.kind !== 'none') {
      centerViewOn(reg.settlement.at.x, reg.settlement.at.y);
    } else {
      const c = centroid(reg.ring);
      centerViewOn(c.x, c.y);
    }
    return true;
  }

  /** Start of turn: prefer newly formed army, else latest captured capital, else home capital. */
  function maybeCenterTurnStart(): void {
    if (!match || match.phase.kind !== 'play') return;
    if (match.phase.phase !== 'taxes') return;
    const key = `${match.phase.round}:${match.phase.playerIndex}`;
    if (key === lastCenteredTurnKey) return;
    lastCenteredTurnKey = key;

    const factionId = activeSeat(match)!.factionId;
    match.lastFormedArmyByFaction ??= {};
    match.lastCapturedCapitalByFaction ??= {};

    const armyId = match.lastFormedArmyByFaction[factionId];
    if (armyId) {
      const stack = match.stacks.find((s) => s.id === armyId && s.factionId === factionId);
      delete match.lastFormedArmyByFaction[factionId];
      if (stack && centerOnRegion(stack.regionId)) {
        saveMatch(match);
        return;
      }
    }

    const capId = match.lastCapturedCapitalByFaction[factionId];
    if (capId && centerOnRegion(capId)) return;

    const homeCap = map.regions.find(
      (r) =>
        r.settlement.kind === 'capital' &&
        (match!.regionOwners[r.id] === factionId || r.ownerId === factionId),
    );
    if (homeCap) centerOnRegion(homeCap.id);
  }

  async function aiAnimateBattle(
    state: MatchState,
    invasionId: string,
    rng: () => number,
  ): Promise<MatchState> {
    match = state;
    return runBattleAutoresolveFx(state, invasionId, rng);
  }

  function commit(next: MatchState): void {
    match = next;
    saveMatch(next);
    statusMsg = '';
    maybeCenterTurnStart();
    paintAll();
    void afterCommit();
  }

  async function afterCommit(): Promise<void> {
    if (!match || match.phase.kind !== 'play' || battleFxBusy) {
      void maybeAutoTaxes();
      maybeAutoSkipUpkeep();
      maybeAutoEndMoveWhenBroke();
      return;
    }
    // Auto-resolve AI side of open contacts / dice battles (with FX)
    const resolved = await resolveAiInvasionContactsAsync(
      match,
      map,
      sea,
      Math.random,
      aiAnimateBattle,
    );
    if (resolved !== match) {
      match = resolved;
      saveMatch(match);
      paintAll();
    }
    void maybeAutoTaxes();
    maybeAutoSkipUpkeep();
    maybeAutoEndMoveWhenBroke();
    void maybeRunAi();
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  /** Drive AI seats with a short delay between steps so the board updates. */
  async function maybeRunAi(): Promise<void> {
    if (
      aiBusy ||
      taxFxBusy ||
      moveFxBusy ||
      battleFxBusy ||
      !match ||
      match.phase.kind !== 'play'
    ) {
      return;
    }
    if (!activeSeat(match)?.isAi) return;
    // Let maybeAutoTaxes finish first (it re-commits into upkeep/move)
    if (match.phase.phase === 'taxes' && !match.phase.taxesCollected) return;
    aiBusy = true;
    try {
      for (let i = 0; i < 80; i++) {
        if (!match || match.phase.kind !== 'play') break;
        if (!activeSeat(match)?.isAi) break;
        if (battleFxBusy) break;
        const before = `${match.phase.phase}:${match.phase.playerIndex}:${match.log.length}:${match.stacks.length}`;
        const next = await runCampaignAiTurnsAsync(
          match,
          map,
          sea,
          Math.random,
          1,
          aiAnimateBattle,
        );
        const after = `${next.phase.kind === 'play' ? next.phase.phase : 'x'}:${
          next.phase.kind === 'play' ? next.phase.playerIndex : -1
        }:${next.log.length}:${next.stacks.length}`;
        match = next;
        saveMatch(match);
        paintAll();
        if (before === after) {
          // stuck — try a bigger burst then stop
          match = await runCampaignAiTurnsAsync(
            match,
            map,
            sea,
            Math.random,
            20,
            aiAnimateBattle,
          );
          saveMatch(match);
          paintAll();
          break;
        }
        await sleep(160);
        if (!activeSeat(match)?.isAi) break;
      }
    } finally {
      aiBusy = false;
      // Human may now be active — taxes/upkeep/broke-move auto
      void maybeAutoTaxes();
      maybeAutoSkipUpkeep();
      maybeAutoEndMoveWhenBroke();
    }
  }

  function playRecruitFx(regionId: string, factionId: string): void {
    playSfx('campaign_recruit');
    const svg = root.querySelector<SVGSVGElement>('.cm-svg');
    const layer = root.querySelector<HTMLElement>('.tw-tax-fx');
    if (!svg || !layer) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const reg = map.regions.find((r) => r.id === regionId);
    if (!reg) return;
    const at =
      reg.settlement.kind !== 'none'
        ? reg.settlement.at
        : centroid(reg.ring);
    // Aim near stack chip (below centroid) when present
    const target = { x: at.x, y: at.y + (reg.settlement.kind !== 'none' ? 10 : 0) };
    const screen = svgToClient(svg, target.x, target.y);
    const el = document.createElement('div');
    el.className = 'tw-recruit-pop';
    el.style.setProperty('--x', `${screen.x}px`);
    el.style.setProperty('--y', `${screen.y}px`);
    el.style.setProperty('--fc', factionColor(map, factionId));
    el.innerHTML = `<span class="tw-recruit-chip" aria-hidden="true">+1</span>`;
    layer.appendChild(el);
    window.setTimeout(() => el.remove(), 520);
  }

  /** −1 float above attacker (left) or defender (right) chip on the battle hex. */
  function playBattleLossFx(
    regionId: string,
    side: 'attacker' | 'defender',
  ): void {
    playSfx('campaign_battle_loss_tick');
    const svg = root.querySelector<SVGSVGElement>('.cm-svg');
    const layer = root.querySelector<HTMLElement>('.tw-tax-fx');
    if (!svg || !layer) return;
    const at = locationChipAt(map, regionId);
    if (!at) return;
    const sideOff = side === 'attacker' ? -14 : 14;
    const screen = svgToClient(svg, at.x + sideOff, at.y - 4);
    const el = document.createElement('div');
    el.className = 'tw-battle-loss-pop';
    el.style.setProperty('--x', `${screen.x}px`);
    el.style.setProperty('--y', `${screen.y}px`);
    el.innerHTML = `<span class="tw-battle-loss-chip" aria-hidden="true">−1</span>`;
    layer.appendChild(el);
    window.setTimeout(() => el.remove(), 480);
  }

  function visualLoseOne(state: MatchState, stackIds: string[]): void {
    for (const id of stackIds) {
      const s = state.stacks.find((x) => x.id === id);
      if (!s || s.units < 1) continue;
      s.units -= 1;
      if (s.units <= 0) {
        state.stacks = state.stacks.filter((x) => x.id !== id);
      } else if (s.kind === 'army') {
        if (s.units < 3) {
          s.kind = 'loose';
          delete s.armySize;
        } else {
          s.armySize = s.units >= 10 ? 10 : s.units >= 5 ? 5 : 3;
        }
      }
      return;
    }
  }

  /**
   * Center on the fight, step exchanges every 0.5s with −1 popups.
   * Returns final state (caller commits). Uses `match` for live paint.
   */
  async function runBattleAutoresolveFx(
    start: MatchState,
    invasionId: string,
    rng: () => number = Math.random,
  ): Promise<MatchState> {
    const inv = start.pendingInvasions.find((i) => i.id === invasionId);
    if (!inv) return start;

    const attIds = [...inv.attackerStackIds];
    const defIds = stacksInRegion(start, inv.regionId)
      .filter(
        (s) =>
          !attIds.includes(s.id) &&
          (inv.defenderFactionId
            ? s.factionId === inv.defenderFactionId
            : s.factionId !== inv.attackerFactionId),
      )
      .map((s) => s.id);

    const plan = planBattleDice(start, map, invasionId, rng);
    const skipFx =
      plan.exchanges.length === 0 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (skipFx) return plan.state;

    battleFxBusy = true;
    centerOnRegion(plan.regionId);
    let visual = cloneMatch(start);
    const vInv = visual.pendingInvasions.find((i) => i.id === invasionId);
    if (vInv && vInv.status === 'awaiting_defender') vInv.status = 'battle';
    match = visual;
    statusMsg = 'Battle…';
    paintAll();

    for (const ex of plan.exchanges) {
      await sleep(500);
      if (!battleFxBusy) return plan.state;
      visualLoseOne(visual, ex.loser === 'attacker' ? attIds : defIds);
      match = visual;
      playBattleLossFx(plan.regionId, ex.loser);
      paintAll();
    }

    await sleep(280);
    battleFxBusy = false;
    statusMsg = '';
    return plan.state;
  }

  async function autoresolveBattleWithFx(invasionId: string): Promise<void> {
    if (!match || battleFxBusy || moveFxBusy || taxFxBusy) return;
    try {
      const final = await runBattleAutoresolveFx(match, invasionId);
      battleFxBusy = false;
      statusMsg = '';
      commit(final);
    } catch (e) {
      battleFxBusy = false;
      statusMsg = '';
      fail(e);
    }
  }

  /**
   * Fly army unit chips from origin → destination, then resolve.
   * Respects prefers-reduced-motion (instant).
   */
  function playArmyMoveFx(
    stack: CampaignStack,
    fromId: string,
    toId: string,
  ): Promise<void> {
    playSfx('campaign_army_move');
    const svg = root.querySelector<SVGSVGElement>('.cm-svg');
    const layer = root.querySelector<HTMLElement>('.tw-tax-fx');
    if (!svg || !layer) return Promise.resolve();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return Promise.resolve();
    }

    const fromAt = locationChipAt(map, fromId);
    const toAt = locationChipAt(map, toId);
    if (!fromAt || !toAt) return Promise.resolve();

    const from = svgToClient(svg, fromAt.x, fromAt.y);
    const to = svgToClient(svg, toAt.x, toAt.y);
    const mid = {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2 - Math.min(56, Math.hypot(to.x - from.x, to.y - from.y) * 0.22),
    };
    const flightMs = 720;
    const staggerMs = 55;
    const n = Math.max(1, Math.min(stack.units, 8));
    const fc = factionColor(map, stack.factionId);

    const flyers: HTMLElement[] = [];
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = i === 0 ? 'tw-army-march lead' : 'tw-army-march';
      const jx = (i - (n - 1) / 2) * 5;
      const jy = (i % 2 === 0 ? -1 : 1) * Math.min(6, i);
      el.style.setProperty('--x0', `${from.x + jx}px`);
      el.style.setProperty('--y0', `${from.y + jy}px`);
      el.style.setProperty('--xMid', `${mid.x + jx * 0.6}px`);
      el.style.setProperty('--yMid', `${mid.y + jy}px`);
      el.style.setProperty('--x1', `${to.x + jx * 0.35}px`);
      el.style.setProperty('--y1', `${to.y + jy * 0.35}px`);
      el.style.setProperty('--fc', fc);
      el.style.animationDelay = `${i * staggerMs}ms`;
      if (i === 0) {
        el.innerHTML = `<span class="tw-army-march-chip" aria-hidden="true"><span class="tw-army-march-star">★</span>${stack.units}</span>`;
      } else {
        el.innerHTML = `<span class="tw-army-march-pip" aria-hidden="true"></span>`;
      }
      layer.appendChild(el);
      flyers.push(el);
    }

    const total = flightMs + (n - 1) * staggerMs + 60;
    return new Promise((resolve) => {
      window.setTimeout(() => {
        for (const el of flyers) el.remove();
        resolve();
      }, total);
    });
  }

  function playTaxCoinFx(capitalIds: string[]): Promise<void> {
    if (capitalIds.length) playSfx('campaign_tax');
    const svg = root.querySelector<SVGSVGElement>('.cm-svg');
    const bank = root.querySelector<HTMLElement>('.tw-coin.active');
    const layer = root.querySelector<HTMLElement>('.tw-tax-fx');
    if (!svg || !bank || !layer || capitalIds.length < 1) return Promise.resolve();

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return Promise.resolve();

    const bankRect = bank.getBoundingClientRect();
    const toX = bankRect.left + bankRect.width / 2;
    const toY = bankRect.top + bankRect.height / 2;
    const flightMs = 720;
    const staggerMs = 140;

    layer.replaceChildren();
    const coins: HTMLElement[] = [];
    capitalIds.forEach((rid, i) => {
      const region = map.regions.find((r) => r.id === rid);
      if (!region || region.settlement.kind !== 'capital') return;
      const from = svgToClient(svg, region.settlement.at.x, region.settlement.at.y);
      const el = document.createElement('div');
      el.className = 'tw-tax-fly-coin';
      el.style.setProperty('--x0', `${from.x}px`);
      el.style.setProperty('--y0', `${from.y}px`);
      el.style.setProperty('--x1', `${toX}px`);
      el.style.setProperty('--y1', `${toY}px`);
      el.style.animationDelay = `${i * staggerMs}ms`;
      el.innerHTML = coinGlyphSvg(26);
      layer.appendChild(el);
      coins.push(el);
    });

    if (!coins.length) return Promise.resolve();

    const total = flightMs + (coins.length - 1) * staggerMs + 80;
    return new Promise((resolve) => {
      window.setTimeout(() => {
        layer.replaceChildren();
        resolve();
      }, total);
    });
  }

  function canAffordRecruit(): boolean {
    if (!match || match.phase.kind !== 'play') return false;
    const seat = activeSeat(match)!;
    if (seat.coins >= 1) return true;
    if (giftPayerId) {
      const gift = seatOf(match, giftPayerId);
      if (gift && gift.coins >= 1) return true;
    }
    return false;
  }

  /** No !!! armies due → skip upkeep. */
  function maybeAutoSkipUpkeep(): void {
    if (!match || match.phase.kind !== 'play') return;
    if (match.phase.phase !== 'upkeep') return;
    if (taxFxBusy) return;
    const seat = activeSeat(match)!;
    if (armiesNeedingUpkeep(match, map, sea, seat.factionId).length > 0) return;
    try {
      selectedStackId = null;
      legalDests = [];
      commit(advancePhase(match, map, sea));
    } catch (e) {
      fail(e);
    }
  }

  /** 0¢ on move → nothing left to buy/garrison-march; advance phase. */
  function maybeAutoEndMoveWhenBroke(): void {
    if (!match || match.phase.kind !== 'play') return;
    if (match.phase.phase !== 'move') return;
    if (taxFxBusy || moveFxBusy || battleFxBusy || aiBusy) return;
    const seat = activeSeat(match);
    if (!seat || seat.isAi || seat.coins > 0) return;
    if (!canAdvancePhase()) return;
    goNextPhase();
  }

  async function maybeAutoTaxes(): Promise<void> {
    if (!match || match.phase.kind !== 'play') return;
    if (match.phase.phase !== 'taxes') return;
    if (taxFxBusy) return;

    // Already collected (legacy save / safety) → jump straight to upkeep/move
    if (match.phase.taxesCollected) {
      try {
        commit(advancePhase(match, map, sea));
      } catch (e) {
        fail(e);
      }
      return;
    }

    // AI seats: skip coin FX, collect and continue immediately
    if (activeSeat(match)?.isAi) {
      try {
        let next = collectTaxes(match, map);
        next = advancePhase(next, map, sea);
        commit(next);
      } catch (e) {
        fail(e);
      }
      return;
    }

    taxFxBusy = true;
    const token = ++taxFxToken;
    paintHud();

    const capitals = taxableCapitalRegions(match, map);
    try {
      await playTaxCoinFx(capitals);
      if (token !== taxFxToken || !match || match.phase.kind !== 'play') return;
      let next = collectTaxes(match, map);
      next = advancePhase(next, map, sea);
      taxFxBusy = false;
      commit(next);
    } catch (e) {
      taxFxBusy = false;
      fail(e);
      paintHud();
    }
  }

  function fail(err: unknown): void {
    statusMsg = err instanceof Error ? err.message : String(err);
    paintInfo();
    paintHud();
  }

  function paintHud(): void {
    const hud = root.querySelector('.tw-hud');
    if (!hud) return;
    if (!match || match.phase.kind !== 'play') {
      hud.innerHTML = '';
      paintEndTurn();
      return;
    }
    const seat = activeSeat(match)!;
    const phase = match.phase.phase;
    const treasuries = match.seats
      .map((s) => {
        const name = escapeHtml(factionName(map, s.factionId));
        const active = s.factionId === seat.factionId ? ' active' : '';
        return `<span class="tw-coin${active}" style="--fc:${factionColor(map, s.factionId)}">${name} · ${s.coins}¢</span>`;
      })
      .join('');

    giftPayerId = null;

    hud.innerHTML = `
      <div class="tw-phase-bar">
        ${(['taxes', 'upkeep', 'move', 'invasions', 'armies'] as TurnPhase[])
          .map((p) => {
            const on = p === phase ? ' on' : '';
            return `<span class="tw-phase${on}">${phaseLabel(p)}</span>`;
          })
          .join('')}
      </div>
      <div class="tw-turn-row">
        <strong style="color:${factionColor(map, seat.factionId)}">${escapeHtml(factionName(map, seat.factionId))}${
          seat.isAi ? ' · AI' : ''
        }</strong>
        <span class="cm-muted">Round ${match.phase.round}${aiBusy ? ' · thinking…' : ''}</span>
        <div class="tw-treasuries">${treasuries}</div>
      </div>
      <div class="tw-actions">
        ${phaseActionsHtml(phase, seat.factionId)}
        <button type="button" class="danger" data-act="resign-match">New game</button>
      </div>
      ${statusMsg ? `<p class="tw-status-err">${escapeHtml(statusMsg)}</p>` : ''}
    `;

    bindHudActions();
    paintEndTurn();
  }

  function canAdvancePhase(): boolean {
    if (
      !match ||
      match.phase.kind !== 'play' ||
      taxFxBusy ||
      moveFxBusy ||
      aiBusy
    ) {
      return false;
    }
    if (activeSeat(match)?.isAi) return false;
    const phase = match.phase.phase;
    if (phase === 'taxes' || phase === 'armies') return false;
    // Move linked to invasions — resolve Wait/Attack / defender response first
    if (phase === 'move' && openInvasionContacts(match).length > 0) return false;
    return true;
  }

  function goNextPhase(): void {
    if (!canAdvancePhase()) return;
    playSfx('campaign_phase_next');
    try {
      selectedStackId = null;
      recruitMode = false;
      legalDests = [];
      commit(advancePhase(match!, map, sea));
    } catch (e) {
      fail(e);
    }
  }

  const RECRUIT_PROMPT = 'Choose owned land or empty adjacent land · 1¢';

  /** Recruit mode defaults on once per move phase (human, affordable). */
  function maybeDefaultRecruitMode(): boolean {
    if (!match || match.phase.kind !== 'play' || match.phase.phase !== 'move' || taxFxBusy) {
      return false;
    }
    if (activeSeat(match)?.isAi) {
      if (recruitMode) {
        recruitMode = false;
        return true;
      }
      return false;
    }
    const key = `${match.phase.round}:${match.phase.playerIndex}`;
    if (key === lastRecruitTurnKey) return false;
    lastRecruitTurnKey = key;
    if (!canAffordRecruit()) {
      recruitMode = false;
      return true;
    }
    recruitMode = true;
    selectedStackId = null;
    moveCountMode = 'one';
    if (!statusMsg) statusMsg = RECRUIT_PROMPT;
    return true;
  }

  function paintEndTurn(): void {
    const endBtn = root.querySelector<HTMLButtonElement>('[data-act="end-turn"]');
    const coinsEl = root.querySelector<HTMLElement>('.tw-dock-coins');
    const coinsVal = root.querySelector<HTMLElement>('.tw-dock-coins-val');
    const cluster = root.querySelector<HTMLElement>('.tw-end-cluster');
    if (!endBtn || !cluster) return;
    const show = !!(match && match.phase.kind === 'play');
    cluster.hidden = !show;
    endBtn.disabled = !canAdvancePhase();
    const seat = show ? activeSeat(match!) : null;
    if (coinsEl && coinsVal) {
      coinsEl.hidden = !seat;
      if (seat) {
        coinsVal.textContent = String(seat.coins);
        coinsEl.style.setProperty('--fc', factionColor(map, seat.factionId));
        coinsEl.title = `${factionName(map, seat.factionId)} · ${seat.coins}¢`;
      }
    }
  }

  function phaseActionsHtml(phase: TurnPhase, _factionId: string): string {
    if (!match || match.phase.kind !== 'play') return '';
    if (battleFxBusy) {
      return `<span class="tw-recruit-prompt">Battle…</span>`;
    }
    if (phase === 'taxes') {
      return `<span class="cm-muted">${taxFxBusy ? 'Collecting taxes…' : 'Taxes…'}</span>`;
    }
    if (phase === 'upkeep') {
      return `<span class="cm-muted">Resolve campaigning army upkeep…</span>`;
    }
    if (phase === 'move') {
      if (openInvasionContacts(match).length) {
        return `<span class="tw-recruit-prompt">Resolve army contact…</span>`;
      }
      return recruitMode
        ? `<span class="tw-recruit-prompt">${RECRUIT_PROMPT}</span>`
        : '';
    }
    if (phase === 'invasions') {
      return `<span class="cm-muted">Battles kept for later…</span>`;
    }
    if (phase === 'armies') {
      return `<span class="cm-muted">Forming armies…</span>`;
    }
    return '';
  }

  function regionByIdName(id: string): string {
    return map.regions.find((r) => r.id === id)?.name ?? id;
  }

  function bindHudActions(): void {
    const hud = root.querySelector('.tw-hud');
    if (!hud || !match) return;
    hud.querySelectorAll('[data-act="pay-upkeep"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.stack!;
        try {
          commit(payUpkeep(match!, map, sea, id, giftPayerId ?? undefined));
        } catch (e) {
          fail(e);
        }
      });
    });
    hud.querySelector('[data-act="resign-match"]')?.addEventListener('click', () => {
      if (!confirm('Abandon this match and return to setup?')) return;
      clearSavedMatch();
      match = null;
      setupPicks = [];
      setupAi = new Set();
      selectedStackId = null;
      legalDests = [];
      paintAll();
    });
  }

  function paintInfo(): void {
    const panel = root.querySelector('.campaign-play-info');
    if (!panel) return;

    if (!match) {
      paintSetup(panel);
      return;
    }

    const region = map.regions.find((r) => r.id === selectedId);
    const seat = match.phase.kind === 'play' ? activeSeat(match) : null;
    const stacks = selectedId ? stacksInRegion(match, selectedId) : [];
    const supplied =
      seat && selectedId
        ? isRegionSupplied(match, map, sea, seat.factionId, selectedId)
        : false;

    const stackHtml = stacks
      .map((s) => {
        const sel = selectedStackId === s.id ? ' selected' : '';
        const ctrl =
          seat && controllableStackIds(match!, map, seat.factionId).includes(s.id);
        const upkeepWarn = isCampaigningArmy(match!, map, sea, s);
        const fc = factionColor(map, s.factionId);
        return `<button type="button" class="tw-stack-btn${sel}${upkeepWarn ? ' upkeep-warn' : ''}" data-stack="${s.id}" ${ctrl ? '' : 'disabled'}
          style="background:${fc};border-color:${fc};color:#fff">
          ${escapeHtml(factionName(map, s.factionId))} ${stackBadge(s, upkeepWarn)}
          ${s.exhausted ? ' · exhausted' : ''}
          ${s.moved ? ' · moved' : ''}
        </button>`;
      })
      .join('');

    const grants =
      seat && match.seats.length > 1
        ? `<h3>Supply grants</h3>
          <ul class="tw-grants">
            ${match.seats
              .filter((s) => s.factionId !== seat.factionId)
              .map((s) => {
                const on = match!.supplyGrants.some(
                  (g) =>
                    g.fromFactionId === seat.factionId && g.toFactionId === s.factionId,
                );
                return `<li>
                  <button type="button" data-grant="${s.factionId}">${on ? 'Revoke' : 'Grant'} → ${escapeHtml(factionName(map, s.factionId))}</button>
                </li>`;
              })
              .join('')}
          </ul>`
        : '';

    const treachery =
      seat &&
      selectedId &&
      stacks.some((s) => s.factionId === seat.factionId && s.kind === 'army') &&
      stacks.some((s) => s.factionId !== seat.factionId && !s.rebelOf)
        ? `<button type="button" data-treachery>Treachery!</button>`
        : '';

    const canAttack =
      selectedStackId && canDeclareColocatedAttack(match, selectedStackId);
    const attackBtn = canAttack
      ? `<button type="button" class="tw-attack-btn" data-act="declare-attack">Attack</button>`
      : '';

    if (!region) {
      panel.innerHTML = `
        <p class="empty">Click a region. Select stack badges to move.</p>
        <h2>Log</h2>
        <ul class="tw-log">${match.log
          .slice(-12)
          .map((l) => `<li>${escapeHtml(l)}</li>`)
          .reverse()
          .join('')}</ul>
        ${grants}`;
      bindInfo();
      return;
    }

    const settle =
      region.settlement.kind === 'capital'
        ? `Capital · ${CAPITAL_LABEL[region.settlement.key]}`
        : region.settlement.kind === 'village'
          ? 'Village'
          : 'Open ground';
    const unitIds =
      region.settlement.kind === 'capital'
        ? sanitizeUnitAccess(region.settlement.units)
        : [];
    const units = unitIds.length
      ? `<p class="cm-hint">Capital units: ${unitIds
          .map((id) => escapeHtml(UNIT_STATS[id]?.name ?? id))
          .join(', ')}</p>`
      : '';
    const siege = match.sieges.find((s) => s.regionId === region.id);
    const breakSiegeBtn =
      siege && canBreakSiege(match, region.id)
        ? `<button type="button" class="tw-break-siege-btn" data-act="break-siege">Break siege</button>`
        : '';
    const siegeBattleOk = siege && canSiegeBattle(match, map, region.id);
    const siegeAssault =
      siegeBattleOk && siege!.attackerFactionId === seat?.factionId;
    const siegeBattleBtn = siegeBattleOk
      ? `<button type="button" class="tw-attack-btn" data-act="siege-battle">${
          siegeAssault
            ? 'Attack (siege day 1+)'
            : 'Battle → keep for later'
        }</button>`
      : '';
    const siegeDay =
      siege && siege.days > 0 ? ` · day ${siege.days}` : siege ? ' · day 0' : '';

    panel.innerHTML = `
      <h2>${escapeHtml(region.name)}</h2>
      <p><span class="cm-muted">Owned by</span> ${escapeHtml(factionName(map, ownerOf(match, region.id)))}</p>
      <p><span class="cm-muted">Settlement</span> ${escapeHtml(settle)}</p>
      ${units}
      <p><span class="cm-muted">Supply</span> ${supplied ? 'yes' : 'no'}${siege ? ` · SIEGE${siegeDay}` : ''}</p>
      <h3>Stacks</h3>
      <div class="tw-stack-list">${stackHtml || '<p class="cm-muted">Empty</p>'}</div>
      ${breakSiegeBtn}
      ${siegeBattleBtn}
      ${attackBtn}
      ${treachery}
      ${grants}
      <h3>Log</h3>
      <ul class="tw-log">${match.log
        .slice(-20)
        .map((l) => `<li>${escapeHtml(l)}</li>`)
        .reverse()
        .join('')}</ul>`;
    bindInfo();
  }

  function paintSetup(panel: Element): void {
    const choices = choosableFactions(map);
    panel.innerHTML = `
      <h2>Setup</h2>
      <p class="cm-hint">Pick at least 2 factions (turn order = pick order). Toggle Player / AI per seat. Seats start with 1¢. All homeland factions (picked + unpicked neutrals) get units on capital + villages; barbarian villages too. Players &amp; AI recruit/move; neutrals only retreat/defend when invaded. Capital battles: defenders get +1.</p>
      <ul class="tw-setup-factions">
        ${choices
          .map((f) => {
            const on = setupPicks.includes(f.id);
            const ord = on ? setupPicks.indexOf(f.id) + 1 : '';
            const ai = setupAi.has(f.id);
            return `<li class="tw-setup-row">
              <button type="button" class="tw-setup-f${on ? ' on' : ''}" data-pick="${f.id}"
                style="--fc:${f.color}">
                <span class="swatch" style="background:${f.color}"></span>
                ${escapeHtml(f.name)}
                ${ord ? `<em>#${ord}</em>` : ''}
              </button>
              ${
                on
                  ? `<button type="button" class="tw-setup-role${ai ? ' ai' : ''}" data-role="${f.id}" title="Toggle Player / AI">${
                      ai ? 'AI' : 'Player'
                    }</button>`
                  : ''
              }
            </li>`;
          })
          .join('')}
      </ul>
      <button type="button" data-start-match ${setupPicks.length >= 2 ? '' : 'disabled'}>Start match (${setupPicks.length}/2+)</button>
      ${statusMsg ? `<p class="tw-status-err">${escapeHtml(statusMsg)}</p>` : ''}`;

    panel.querySelectorAll('[data-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.pick!;
        if (setupPicks.includes(id)) {
          setupPicks = setupPicks.filter((x) => x !== id);
          setupAi.delete(id);
        } else {
          setupPicks = [...setupPicks, id];
        }
        paintInfo();
      });
    });
    panel.querySelectorAll('[data-role]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = (btn as HTMLElement).dataset.role!;
        if (setupAi.has(id)) setupAi.delete(id);
        else setupAi.add(id);
        paintInfo();
      });
    });
    panel.querySelector('[data-start-match]')?.addEventListener('click', () => {
      if (setupPicks.length < 2) {
        fail(new Error('Need at least 2 players'));
        return;
      }
      try {
        commit(
          createMatch(map, setupPicks, {
            aiFactionIds: setupPicks.filter((id) => setupAi.has(id)),
          }),
        );
      } catch (e) {
        fail(e);
      }
    });
  }

  function bindInfo(): void {
    const panel = root.querySelector('.campaign-play-info');
    if (!panel || !match) return;
    panel.querySelectorAll('[data-stack]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectStack((btn as HTMLElement).dataset.stack!);
        paintAll();
      });
    });
    panel.querySelectorAll('[data-grant]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const to = (btn as HTMLElement).dataset.grant!;
        const seat = activeSeat(match!)!;
        commit(toggleSupplyGrant(match!, seat.factionId, to));
      });
    });
    panel.querySelector('[data-act="break-siege"]')?.addEventListener('click', () => {
      if (!match || !selectedId) return;
      try {
        commit(breakSiege(match, map, selectedId));
      } catch (e) {
        fail(e);
      }
    });
    panel.querySelector('[data-act="siege-battle"]')?.addEventListener('click', () => {
      if (!match || !selectedId) return;
      try {
        commit(siegeToBattle(match, map, sea, selectedId));
      } catch (e) {
        fail(e);
      }
    });
    panel.querySelector('[data-act="declare-attack"]')?.addEventListener('click', () => {
      if (!match || !selectedStackId) return;
      try {
        commit(declareColocatedAttack(match, map, sea, selectedStackId));
      } catch (e) {
        fail(e);
      }
    });
    panel.querySelector('[data-treachery]')?.addEventListener('click', () => {
      if (!selectedId || !match) return;
      const seat = activeSeat(match)!;
      const other = stacksInRegion(match, selectedId).find(
        (s) => s.factionId !== seat.factionId && !s.rebelOf,
      );
      if (!other) return;
      try {
        commit(
          declareTreachery(match, map, sea, selectedId, seat.factionId, other.factionId),
        );
      } catch (e) {
        fail(e);
      }
    });
  }

  /** Open invasion where a human seat must Fight / Siege / Flight. */
  function humanDefenderContact() {
    if (!match || match.phase.kind !== 'play') return null;
    const ph = match.phase.phase;
    if (ph !== 'move' && ph !== 'invasions') return null;
    return (
      openInvasionContacts(match).find((inv) => {
        if (inv.status !== 'awaiting_defender' || !inv.defenderFactionId) return false;
        const defSeat = seatOf(match!, inv.defenderFactionId);
        return !!defSeat && !defSeat.isAi;
      }) ?? null
    );
  }

  function refreshInvasionMapHints(): void {
    flightDests = [];
    invadedHighlightId = null;
    const inv = humanDefenderContact();
    if (!inv || !match) return;
    invadedHighlightId = inv.regionId;
    flightDests = retreatDestinations(match, map, inv);
  }

  function refreshLegal(): void {
    legalDests = [];
    refreshInvasionMapHints();
    if (!match || match.phase.kind !== 'play') return;
    // While answering an invasion, map is for Flight picks — not moves/recruit
    if (humanDefenderContact()) return;
    if (match.phase.phase === 'move' && recruitMode) {
      legalDests = recruitableRegions(match, map, sea, activeSeat(match)!.factionId);
      return;
    }
    if (match.phase.phase !== 'move' || !selectedStackId) return;
    const stack = match.stacks.find((s) => s.id === selectedStackId);
    if (!stack) return;
    // ★ armies always move as a whole; loose: click=1 / drag=all
    const count = stack.kind === 'army' || moveCountMode === 'all' ? 'all' : 1;
    legalDests = legalMovesForStack(match, map, sea, selectedStackId, { count }).map(
      (m) => m.regionId,
    );
  }

  function selectStack(stackId: string): void {
    playSfx('campaign_select_army');
    recruitMode = false;
    selectedStackId = stackId;
    const st = match?.stacks.find((s) => s.id === stackId);
    moveCountMode = st?.kind === 'army' ? 'all' : 'one';
    if (st) selectedId = st.regionId;
    refreshLegal();
  }

  function finishArmyMove(
    stack: CampaignStack,
    fromId: string,
    toId: string,
    next: MatchState,
  ): void {
    selectedId = toId;
    selectedStackId = null;
    moveCountMode = 'one';
    legalDests = [];
    recruitMode = false;

    const animateArmy =
      stack.kind === 'army' &&
      fromId !== toId &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!animateArmy) {
      commit(next);
      return;
    }

    moveFxBusy = true;
    marchingHideStackId = stack.id;
    paintAll();
    void playArmyMoveFx(stack, fromId, toId).then(() => {
      marchingHideStackId = null;
      moveFxBusy = false;
      commit(next);
    });
  }

  function tryMoveSelected(regionId: string, count: number | 'all'): boolean {
    if (!match || !selectedStackId || moveFxBusy) return false;
    const stack = match.stacks.find((s) => s.id === selectedStackId);
    if (!stack) return false;
    const moveCount = stack.kind === 'army' ? 'all' : count;
    const fromId = stack.regionId;

    try {
      const next = moveStack(match, map, sea, selectedStackId, regionId, {
        count: moveCount,
        payerFactionId: giftPayerId ?? undefined,
      });
      finishArmyMove(stack, fromId, regionId, next);
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  }

  function paintMap(): void {
    const svg = root.querySelector<SVGSVGElement>('.cm-svg');
    if (!svg) return;
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    svg.classList.toggle('tool-pan', true);
    svg.classList.toggle('panning', panning || spacePan);
    svg.classList.toggle('stack-dragging', !!stackDrag?.dragging);

    const regionsG = svg.querySelector('.cm-regions')!;
    const labelsG = svg.querySelector('.cm-labels')!;
    const settlementsG = svg.querySelector('.cm-settlements')!;
    const stacksG = svg.querySelector('.cm-stacks')!;
    const linksG = svg.querySelector('.cm-links')!;
    const nodesG = svg.querySelector('.cm-nodes')!;

    const owners = match?.regionOwners;

    const placing = recruitMode;
    regionsG.innerHTML = map.regions
      .map((r) => {
        const sel = selectedId === r.id ? ' selected' : '';
        const pick = legalDests.includes(r.id);
        const legal = pick ? (placing ? ' legal recruit-pick' : ' legal') : '';
        const flight = flightDests.includes(r.id) ? ' flight' : '';
        const invaded = invadedHighlightId === r.id ? ' invaded' : '';
        const siege = match?.sieges.some((s) => s.regionId === r.id) ? ' siege' : '';
        const oid = owners ? owners[r.id] ?? null : r.ownerId;
        const fill = factionColor(map, oid);
        const neut = oid ? '' : ' neutral';
        return `<path class="cm-region${sel}${legal}${flight}${invaded}${siege}${neut}" data-region="${r.id}" d="${ringToPath(r.ring)}" fill="${fill}"/>`;
      })
      .join('');

    labelsG.innerHTML = '';

    settlementsG.innerHTML = map.regions
      .map((r) => {
        if (r.settlement.kind === 'none') return '';
        const { at } = r.settlement;
        const underSiege = !!match?.sieges.some((s) => s.regionId === r.id);
        const siege = underSiege ? siegeMarkerSvg(at.x, at.y) : '';
        if (r.settlement.kind === 'village') {
          return `${siege}${villageMarkerSvg(at.x, at.y)}`;
        }
        return `${siege}${capitalMarkerSvg(at.x, at.y, CAPITAL_LABEL[r.settlement.key])}`;
      })
      .join('');

    // Stack chips near region centroid or on ocean stop
    if (match) {
      const byLoc = new Map<string, CampaignStack[]>();
      for (const s of match.stacks) {
        const list = byLoc.get(s.regionId) ?? [];
        list.push(s);
        byLoc.set(s.regionId, list);
      }
      const chips: string[] = [];
      for (const [locId, list] of byLoc) {
        const stop = map.seaNodes.find((n) => n.kind === 'stop' && n.id === locId);
        const reg = map.regions.find((r) => r.id === locId);
        if (!stop && !reg) continue;
        const c = stop ? stop.at : centroid(reg!.ring);
        const yOff = stop ? -10 : 12;
        list.forEach((s, i) => {
          if (s.id === marchingHideStackId) return;
          const x = c.x + (i - (list.length - 1) / 2) * 22;
          const y = c.y + yOff;
          chips.push(
            stackChipMarkup(
              s,
              map,
              x,
              y,
              selectedStackId === s.id,
              !!(stackDrag?.stackId === s.id && stackDrag.dragging),
              isCampaigningArmy(match!, map, sea, s),
            ),
          );
        });
      }
      stacksG.innerHTML = chips.join('');
    } else {
      stacksG.innerHTML = '';
    }

    const byId = new Map(map.seaNodes.map((n) => [n.id, n]));
    linksG.innerHTML = map.seaLinks
      .map((l) => {
        const a = byId.get(l.a);
        const b = byId.get(l.b);
        if (!a || !b) return '';
        return `<line class="cm-sea-link ${l.kind}" x1="${a.at.x}" y1="${a.at.y}" x2="${b.at.x}" y2="${b.at.y}"/>`;
      })
      .join('');

    nodesG.innerHTML = map.seaNodes
      .map((n) => {
        const legal = n.kind === 'stop' && legalDests.includes(n.id) ? ' legal' : '';
        return `<circle class="cm-sea-node ${n.kind}${legal}" data-sea-node="${n.id}" cx="${n.at.x}" cy="${n.at.y}" r="${n.kind === 'stop' ? 5.5 : 4.5}"/>`;
      })
      .join('');
  }

  function paintInvasionModal(): void {
    let modal = root.querySelector<HTMLElement>('.tw-invasion-modal');
    if (!modal) {
      playSfx('campaign_battle_start');
      modal = document.createElement('div');
      modal.className = 'tw-invasion-modal';
      modal.setAttribute('aria-hidden', 'true');
      root.appendChild(modal);
    }
    if (!match || match.phase.kind !== 'play' || battleFxBusy) {
      modal.hidden = true;
      modal.classList.remove('dock');
      modal.innerHTML = '';
      return;
    }
    const phase = match.phase.phase;
    const contacts = openInvasionContacts(match);
    const battles = match.pendingInvasions.filter((i) => i.status === 'battle');
    const humanDef = humanDefenderContact();
    const showHumanDefend = !!humanDef;
    const showContacts =
      !showHumanDefend &&
      (phase === 'move' || phase === 'invasions') &&
      contacts.length > 0;
    const showBattles =
      (phase === 'invasions' || phase === 'move') &&
      battles.length > 0 &&
      !showContacts &&
      !showHumanDefend;
    if (!showContacts && !showBattles && !showHumanDefend) {
      modal.hidden = true;
      modal.classList.remove('dock');
      modal.innerHTML = '';
      return;
    }

    const inv = showHumanDefend
      ? humanDef!
      : showContacts
        ? contacts[0]!
        : battles[0]!;
    const name = escapeHtml(regionByIdName(inv.regionId));
    const atk = escapeHtml(factionName(map, inv.attackerFactionId));
    const def = escapeHtml(factionName(map, inv.defenderFactionId));
    let body = '';
    let dock = false;

    if (showHumanDefend || inv.status === 'awaiting_defender') {
      const dests = retreatDestinations(match, map, inv);
      const canSiege = canSiegeRegion(match, map, inv.regionId, inv.defenderFactionId);
      const siegeBtn = canSiege
        ? `<button type="button" data-act="inv" data-inv="${inv.id}" data-choice="defend" title="Hold the town/capital — lose 1 unit at end of attacker turn">Siege</button>`
        : '';
      dock = true;
      body = `
        <h2>Invaded · ${name}</h2>
        <p class="tw-modal-copy"><strong>${atk}</strong> attacks <strong>${def}</strong>.</p>
        <div class="tw-modal-actions tw-inv-actions">
          <button type="button" class="primary" data-act="battle-dice" data-inv="${inv.id}" title="Roll dice now">Autoresolve</button>
          <button type="button" data-act="inv" data-inv="${inv.id}" data-choice="battle" title="Mark as battle — resolve later">Battle</button>
          ${siegeBtn}
        </div>
        <p class="cm-hint">${
          dests.length
            ? 'Retreat: click a highlighted adjacent owned region on the map.'
            : 'No adjacent owned land to retreat — Autoresolve or Battle.'
        }${canSiege ? ' Siege holds the capital/town (−1/turn; no recruits while besieged).' : ''}</p>`;
    } else if (inv.status === 'pending') {
      body = `
        <h2>Army contact · ${name}</h2>
        <p class="tw-modal-copy"><strong>${atk}</strong> faces a defending ★ army (${def}).</p>
        <div class="tw-modal-actions tw-inv-actions">
          <button type="button" data-act="inv" data-inv="${inv.id}" data-choice="wait">Wait</button>
          <button type="button" class="primary" data-act="inv" data-inv="${inv.id}" data-choice="attack">Attack</button>
        </div>`;
    } else {
      body = `
        <h2>Battle · ${name}${inv.treachery ? ' · TREACHERY' : ''}</h2>
        <p class="tw-modal-copy">Resolve with dice (unit-by-unit: roll 1..att+def, ≤att kills a defender; capital +1 to def) or admit defeat.</p>
        <div class="tw-modal-actions tw-inv-actions">
          <button type="button" class="primary" data-act="battle-dice" data-inv="${inv.id}">Autoresolve</button>
          <button type="button" data-act="battle-lose" data-inv="${inv.id}" data-who="defender">Defender admits defeat</button>
          <button type="button" data-act="battle-lose" data-inv="${inv.id}" data-who="attacker">Attacker admits defeat</button>
        </div>`;
    }

    modal.hidden = false;
    modal.classList.toggle('dock', dock);
    modal.setAttribute('aria-hidden', 'false');
    modal.innerHTML = dock
      ? `<div class="tw-modal-card tw-inv-dock" role="dialog">${body}</div>`
      : `<div class="tw-modal-backdrop"></div>
      <div class="tw-modal-card" role="dialog">${body}</div>`;

    modal.querySelectorAll('[data-act="inv"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const el = btn as HTMLElement;
        const invId = el.dataset.inv!;
        const choice = el.dataset.choice as
          | 'wait'
          | 'attack'
          | 'retreat'
          | 'defend'
          | 'battle';
        try {
          commit(resolveInvasionChoice(match!, map, sea, invId, choice));
        } catch (e) {
          fail(e);
        }
      });
    });
    modal.querySelectorAll('[data-act="battle-dice"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const el = btn as HTMLElement;
        const invId = el.dataset.inv!;
        void autoresolveBattleWithFx(invId);
      });
    });
    modal.querySelectorAll('[data-act="battle-lose"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const el = btn as HTMLElement;
        try {
          commit(
            admitBattleDefeat(
              match!,
              map,
              el.dataset.inv!,
              el.dataset.who as 'attacker' | 'defender',
            ),
          );
        } catch (e) {
          fail(e);
        }
      });
    });
  }

  function paintUpkeepModal(): void {
    let modal = root.querySelector<HTMLElement>('.tw-upkeep-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'tw-upkeep-modal';
      modal.setAttribute('aria-hidden', 'true');
      root.appendChild(modal);
    }
    if (!match || match.phase.kind !== 'play' || match.phase.phase !== 'upkeep') {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = '';
      return;
    }
    const seat = activeSeat(match)!;
    const due = armiesNeedingUpkeep(match, map, sea, seat.factionId);
    if (!due.length) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = '';
      return;
    }

    const coins = seat.coins;
    const rows = due
      .map((s) => {
        const name = escapeHtml(regionByIdName(s.regionId));
        const loss = upkeepLossAmount(s.units);
        const left = s.units - loss;
        if (coins >= 1) {
          return `<li class="tw-upkeep-row">
            <div class="tw-upkeep-meta">
              <strong>${name}</strong>
              <span>★${s.units} · !!!</span>
            </div>
            <button type="button" data-act="pay-upkeep" data-stack="${s.id}">Pay 1¢</button>
          </li>`;
        }
        return `<li class="tw-upkeep-row">
          <div class="tw-upkeep-meta">
            <strong>${name}</strong>
            <span>★${s.units} · !!!</span>
            <span class="tw-upkeep-loss">No coins — loses ${loss} → ★${left}</span>
          </div>
        </li>`;
      })
      .join('');

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    modal.innerHTML = `
      <div class="tw-modal-backdrop" data-act="upkeep-dismiss"></div>
      <div class="tw-modal-card" role="dialog" aria-labelledby="tw-upkeep-title">
        <h2 id="tw-upkeep-title">Upkeep required</h2>
        <p class="tw-modal-copy">Campaigning armies need 1¢ each, or lose half their units (rounded down).</p>
        <ul class="tw-upkeep-list">${rows}</ul>
        <div class="tw-modal-actions">
          <button type="button" data-act="upkeep-done">${coins >= 1 ? 'Continue' : 'Accept losses'}</button>
        </div>
      </div>`;

    modal.querySelectorAll('[data-act="pay-upkeep"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.stack!;
        try {
          commit(payUpkeep(match!, map, sea, id, giftPayerId ?? undefined));
        } catch (e) {
          fail(e);
        }
      });
    });
    const finish = () => {
      try {
        selectedStackId = null;
        legalDests = [];
        commit(advancePhase(match!, map, sea));
      } catch (e) {
        fail(e);
      }
    };
    modal.querySelector('[data-act="upkeep-done"]')?.addEventListener('click', finish);
    modal.querySelector('[data-act="upkeep-dismiss"]')?.addEventListener('click', finish);
  }

  function paintTurnTint(): void {
    const stage = root.querySelector<HTMLElement>('.campaign-stage');
    if (!stage) return;
    if (match?.phase.kind === 'play') {
      stage.style.setProperty(
        '--cm-turn',
        factionColor(map, activeSeat(match)!.factionId),
      );
    } else {
      stage.style.removeProperty('--cm-turn');
    }
  }

  function paintAll(): void {
    // Auto-select Recruit before refreshLegal so targets highlight immediately
    maybeDefaultRecruitMode();
    refreshLegal();
    paintHud();
    paintInfo();
    paintMap();
    paintTurnTint();
    paintUpkeepModal();
    paintInvasionModal();
  }

  function zoomAt(sx: number, sy: number, factor: number): void {
    const nw = Math.min(DEFAULT_VIEW.w * 3, Math.max(120, view.w * factor));
    const nh = (nw / view.w) * view.h;
    const rx = (sx - view.x) / view.w;
    const ry = (sy - view.y) / view.h;
    view = { x: sx - rx * nw, y: sy - ry * nh, w: nw, h: nh };
  }

  function onLocationClick(locationId: string): void {
    if (taxFxBusy || moveFxBusy || battleFxBusy) return;
    const isStop = isSeaStopLocation(map, locationId);
    if (!match || match.phase.kind !== 'play') {
      selectedId = isStop ? null : locationId;
      paintAll();
      return;
    }
    const phase = match.phase.phase;
    const seat = activeSeat(match)!;

    // Human defender: click highlighted owned neighbor → Flight
    const defInv = humanDefenderContact();
    if (defInv && !isStop) {
      if (flightDests.includes(locationId)) {
        try {
          commit(
            resolveInvasionChoice(match, map, sea, defInv.id, 'retreat', {
              retreatTo: locationId,
            }),
          );
        } catch (e) {
          fail(e);
        }
        return;
      }
      selectedId = locationId;
      paintAll();
      return;
    }

    if (phase === 'move' && recruitMode && !isStop) {
      if (legalDests.includes(locationId)) {
        try {
          const next = recruit(match, map, sea, locationId, giftPayerId ?? undefined);
          selectedId = locationId;
          const payer = giftPayerId ? seatOf(next, giftPayerId) : activeSeat(next);
          recruitMode = !!payer && payer.coins >= 1;
          commit(next);
          playRecruitFx(locationId, seat.factionId);
          if (recruitMode) {
            statusMsg = RECRUIT_PROMPT;
            refreshLegal();
            paintHud();
            paintMap();
          }
          return;
        } catch (e) {
          fail(e);
        }
      }
      return;
    }

    if (phase === 'move' && selectedStackId && legalDests.includes(locationId)) {
      tryMoveSelected(locationId, 1);
      return;
    }

    selectedId = isStop ? null : locationId;
    if (phase === 'move') {
      const ctrl = controllableStackIds(match, map, seat.factionId);
      const here = stacksInRegion(match, locationId).find(
        (s) => ctrl.includes(s.id) && !s.moved,
      );
      if (here) {
        selectStack(here.id);
      } else {
        selectedStackId = null;
        // keep recruitMode if still in default place flow
        legalDests = [];
        if (recruitMode) refreshLegal();
      }
    }
    paintAll();
  }

  function renderShell(): void {
    const base = `${import.meta.env.BASE_URL}campaign/europe.svg`;
    root.innerHTML = `
      <div class="campaign-top">
        <button type="button" data-back>Back</button>
        <h1>Total war</h1>
        <span class="cm-status">${escapeHtml(map.name)}</span>
      </div>
      <div class="tw-hud"></div>
      <div class="tw-tax-fx" aria-hidden="true"></div>
      <div class="campaign-body campaign-play-body">
        <div class="campaign-stage">
          <svg class="cm-svg tool-pan" viewBox="${view.x} ${view.y} ${view.w} ${view.h}" xmlns="http://www.w3.org/2000/svg">
            <image href="${base}" x="0" y="0" width="${DEFAULT_VIEW.w}" height="${DEFAULT_VIEW.h}" preserveAspectRatio="none" pointer-events="none"/>
            <g class="cm-regions"></g>
            <g class="cm-links"></g>
            <g class="cm-nodes"></g>
            <g class="cm-settlements"></g>
            <g class="cm-stacks"></g>
            <g class="cm-labels"></g>
          </svg>
          <div class="campaign-zoom">
            <button type="button" data-zoom="out">−</button>
            <button type="button" data-zoom="fit">Fit</button>
            <button type="button" data-zoom="in">+</button>
          </div>
          <div class="tw-end-cluster" hidden>
            <div class="tw-dock-coins" hidden title="Treasury">
              ${coinGlyphSvg(18)}
              <span class="tw-dock-coins-val">0</span>
            </div>
            <button type="button" class="tw-end-turn" data-act="end-turn" title="Next phase">
              ${actionGlyphSvg('end', { className: 'tw-end-ico' })}
              <span class="tw-end-label">End turn</span>
            </button>
          </div>
        </div>
        <aside class="campaign-inspector campaign-play-info"></aside>
      </div>`;
    maybeCenterTurnStart();
    paintAll();
    bindShell();
    void maybeAutoTaxes();
  }

  function bindShell(): void {
    root.querySelector('[data-back]')?.addEventListener('click', () => opts.onBack());
    root.querySelector('[data-act="end-turn"]')?.addEventListener('click', () => goNextPhase());
    root.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const z = btn.dataset.zoom;
        if (z === 'fit') view = { ...DEFAULT_VIEW };
        else zoomAt(view.x + view.w / 2, view.y + view.h / 2, z === 'in' ? 0.85 : 1.15);
        paintMap();
      });
    });

    const svg = root.querySelector<SVGSVGElement>('.cm-svg')!;
    svg.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const p = clientToSvg(svg, e.clientX, e.clientY);
        zoomAt(p.x, p.y, e.deltaY < 0 ? 0.9 : 1.1);
        paintMap();
      },
      { passive: false },
    );

    svg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.button !== 1) return;
      const stackEl =
        e.button === 0 && !spacePan
          ? (e.target as Element)?.closest?.('[data-stack]')
          : null;
      if (
        stackEl &&
        !moveFxBusy &&
        !humanDefenderContact() &&
        match?.phase.kind === 'play' &&
        match.phase.phase === 'move'
      ) {
        const stackId = (stackEl as HTMLElement).dataset.stack!;
        const st = match.stacks.find((s) => s.id === stackId);
        const seat = activeSeat(match);
        const mine =
          !!seat &&
          !!st &&
          !st.moved &&
          controllableStackIds(match, map, seat.factionId).includes(stackId);
        if (mine) {
          selectStack(stackId);
          stackDrag = {
            stackId,
            startX: e.clientX,
            startY: e.clientY,
            dragging: false,
            pointerId: e.pointerId,
          };
          svg.setPointerCapture(e.pointerId);
          paintAll();
          return;
        }
      }
      if (e.button === 1 || spacePan || e.button === 0) {
        panning = true;
        panLast = { x: e.clientX, y: e.clientY };
        svg.dataset.panMoved = '0';
        svg.setPointerCapture(e.pointerId);
      }
    });
    svg.addEventListener('pointermove', (e) => {
      if (stackDrag && stackDrag.pointerId === e.pointerId) {
        const dist = Math.hypot(e.clientX - stackDrag.startX, e.clientY - stackDrag.startY);
        if (!stackDrag.dragging && dist > 8) {
          stackDrag.dragging = true;
          moveCountMode = 'all';
          refreshLegal();
          paintMap();
        }
        return;
      }
      if (!panning || !panLast) return;
      const dx = e.clientX - panLast.x;
      const dy = e.clientY - panLast.y;
      if (Math.hypot(dx, dy) > 3) svg.dataset.panMoved = '1';
      panLast = { x: e.clientX, y: e.clientY };
      const rect = svg.getBoundingClientRect();
      view.x -= dx * (view.w / rect.width);
      view.y -= dy * (view.h / rect.height);
      paintMap();
    });
    svg.addEventListener('pointerup', (e) => {
      if (stackDrag && stackDrag.pointerId === e.pointerId) {
        const drag = stackDrag;
        stackDrag = null;
        try {
          svg.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        if (drag.dragging) {
          const p = clientToSvg(svg, e.clientX, e.clientY);
          const loc = findMoveLocationAt(map, p, legalDests);
          if (loc && legalDests.includes(loc)) {
            tryMoveSelected(loc, 'all');
          } else {
            moveCountMode = 'one';
            refreshLegal();
            paintAll();
          }
        } else {
          // Click-select only — destinations already lit for count=1
          paintAll();
        }
        return;
      }

      const moved = svg.dataset.panMoved === '1';
      panning = false;
      panLast = null;
      try {
        svg.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (!moved && e.button === 0) {
        const p = clientToSvg(svg, e.clientX, e.clientY);
        const loc = findMoveLocationAt(map, p, legalDests);
        if (loc) onLocationClick(loc);
        else {
          selectedId = null;
          selectedStackId = null;
          legalDests = [];
          paintAll();
        }
      }
      paintMap();
    });
    svg.addEventListener('pointercancel', (e) => {
      if (stackDrag && stackDrag.pointerId === e.pointerId) {
        stackDrag = null;
        moveCountMode = 'one';
        refreshLegal();
        paintAll();
      }
      panning = false;
      panLast = null;
    });
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === ' ' && !e.repeat) {
      spacePan = true;
      paintMap();
      e.preventDefault();
    }
  }
  function onKeyUp(e: KeyboardEvent): void {
    if (e.key === ' ') {
      spacePan = false;
      paintMap();
    }
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  renderShell();

  return {
    destroy: () => {
      taxFxToken += 1;
      taxFxBusy = false;
      moveFxBusy = false;
      battleFxBusy = false;
      marchingHideStackId = null;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      root.remove();
    },
  };
}
