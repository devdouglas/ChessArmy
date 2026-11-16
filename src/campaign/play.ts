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
import { capitalMarkerSvg, villageMarkerSvg } from './settlementIcons';
import { loadCampaignMap } from './store';
import { sanitizeUnitAccess } from './units';
import {
  activeSeat,
  choosableFactions,
  clearSavedMatch,
  createMatch,
  loadMatch,
  saveMatch,
  seatOf,
  type CampaignStack,
  type MatchState,
  type TurnPhase,
} from './match';
import { coinGlyphSvg } from '../icons';
import {
  admitBattleDefeat,
  advancePhase,
  buildSeaAdjacency,
  collectTaxes,
  controllableStackIds,
  declareTreachery,
  isRegionSupplied,
  legalMovesForStack,
  moveStack,
  ownerOf,
  payUpkeep,
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
    case 'recruit':
      return 'II · Recruit';
    case 'upkeep':
      return 'III · Upkeep';
    case 'move':
      return 'IV · Move';
    case 'invasions':
      return 'V · Invasions';
    case 'armies':
      return 'VI · Armies';
  }
}

function stackBadge(s: CampaignStack, upkeepWarn = false): string {
  if (s.kind === 'army') {
    return `★${s.units}${upkeepWarn ? ' !!!' : ''}`;
  }
  return `×${s.units}`;
}

/** Tiny star path for army chips (viewBox-local around origin). */
const ARMY_STAR_PATH =
  'M0 -4.2 L0.95 -1.3 H4 L1.4 0.4 L2.3 3.3 L0 1.45 L-2.3 3.3 L-1.4 0.4 L-4 -1.3 H-0.95 Z';

function stackChipMarkup(
  s: CampaignStack,
  map: CampaignMap,
  x: number,
  y: number,
  selected: boolean,
  dragging: boolean,
  upkeepWarn: boolean,
): string {
  const army = s.kind === 'army';
  const w = army ? (upkeepWarn ? 34 : 26) : 20;
  const h = 14;
  const sel = selected ? ' selected' : '';
  const drag = dragging ? ' dragging' : '';
  const warn = upkeepWarn ? ' upkeep-warn' : '';
  const moved = s.moved ? ' moved' : '';
  const label = army ? String(s.units) : `×${s.units}`;
  const star = army
    ? `<path class="cm-army-star" d="${ARMY_STAR_PATH}" transform="translate(${-w / 2 + 7},0)" fill="#f0d060" stroke="#000" stroke-width="0.35"/>`
    : '';
  const bang = upkeepWarn
    ? `<text class="cm-upkeep-bang" x="${w / 2 - 7}" y="3.5" text-anchor="middle">!!!</text>`
    : '';
  return `<g class="cm-stack-chip${sel}${drag}${warn}${moved}${army ? ' army' : ''}" data-stack="${s.id}" transform="translate(${x},${y})">
    <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="3" fill="${factionColor(map, s.factionId)}" stroke="#000" stroke-width="0.8"/>
    ${star}
    <text y="3.5" text-anchor="middle" ${army ? `x="2"` : ''}>${label}</text>
    ${bang}
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
  let lastCenteredTurnKey = '';

  let match: MatchState | null = loadMatch();
  let setupPicks: string[] = [];

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

  function commit(next: MatchState): void {
    match = next;
    saveMatch(next);
    statusMsg = '';
    maybeCenterTurnStart();
    paintAll();
    void maybeAutoTaxes();
    maybeAutoSkipRecruit();
    maybeAutoSkipUpkeep();
  }

  function playRecruitFx(regionId: string, factionId: string): void {
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

  function playTaxCoinFx(capitalIds: string[]): Promise<void> {
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

  /** No coins left to recruit → skip to next phase (upkeep/move). */
  function maybeAutoSkipRecruit(): void {
    if (!match || match.phase.kind !== 'play') return;
    if (match.phase.phase !== 'recruit') return;
    if (taxFxBusy) return;
    if (canAffordRecruit()) return;
    try {
      selectedStackId = null;
      legalDests = [];
      commit(advancePhase(match, map, sea));
    } catch (e) {
      fail(e);
    }
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

  async function maybeAutoTaxes(): Promise<void> {
    if (!match || match.phase.kind !== 'play') return;
    if (match.phase.phase !== 'taxes') return;
    if (taxFxBusy) return;

    // Already collected (legacy save / safety) → jump straight to recruit
    if (match.phase.taxesCollected) {
      try {
        commit(advancePhase(match, map, sea));
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

    const gifts = match.seats
      .filter((s) => s.factionId !== seat.factionId)
      .map(
        (s) =>
          `<option value="${escapeHtml(s.factionId)}" ${giftPayerId === s.factionId ? 'selected' : ''}>${escapeHtml(factionName(map, s.factionId))} pays</option>`,
      )
      .join('');

    hud.innerHTML = `
      <div class="tw-phase-bar">
        ${(['taxes', 'recruit', 'upkeep', 'move', 'invasions', 'armies'] as TurnPhase[])
          .map((p) => {
            const on = p === phase ? ' on' : '';
            return `<span class="tw-phase${on}">${phaseLabel(p)}</span>`;
          })
          .join('')}
      </div>
      <div class="tw-turn-row">
        <strong style="color:${factionColor(map, seat.factionId)}">${escapeHtml(factionName(map, seat.factionId))}</strong>
        <span class="cm-muted">Round ${match.phase.round}</span>
        <div class="tw-treasuries">${treasuries}</div>
      </div>
      <div class="tw-actions">
        ${phaseActionsHtml(phase, seat.factionId)}
        <label class="tw-gift">Gift payer
          <select data-gift>
            <option value="">Self</option>
            ${gifts}
          </select>
        </label>
        <button type="button" data-act="next" ${taxFxBusy || phase === 'taxes' || phase === 'armies' ? 'disabled' : ''}>Next phase</button>
        <button type="button" class="danger" data-act="resign-match">New game</button>
      </div>
      ${statusMsg ? `<p class="tw-status-err">${escapeHtml(statusMsg)}</p>` : ''}
    `;

    hud.querySelector<HTMLSelectElement>('[data-gift]')?.addEventListener('change', (e) => {
      giftPayerId = (e.target as HTMLSelectElement).value || null;
      maybeAutoSkipRecruit();
    });
    bindHudActions();
  }

  function phaseActionsHtml(phase: TurnPhase, _factionId: string): string {
    if (!match || match.phase.kind !== 'play') return '';
    if (phase === 'taxes') {
      return `<span class="cm-muted">${taxFxBusy ? 'Collecting taxes…' : 'Taxes…'}</span>`;
    }
    if (phase === 'recruit') {
      return `<span class="cm-muted">Recruit on owned village/capital (ready), or adjacent region (arrives moved) · 1¢</span>`;
    }
    if (phase === 'upkeep') {
      return `<span class="cm-muted">Resolve campaigning army upkeep…</span>`;
    }
    if (phase === 'move') {
      return `<span class="cm-muted">Loose: click = 1, drag = all. ★ army always moves whole (can enter enemy units/armies). Turn start merges stacks.</span>`;
    }
    if (phase === 'invasions') {
      return invasionPanelHtml();
    }
    if (phase === 'armies') {
      return `<span class="cm-muted">Forming armies…</span>`;
    }
    return '';
  }

  function regionByIdName(id: string): string {
    return map.regions.find((r) => r.id === id)?.name ?? id;
  }

  function invasionPanelHtml(): string {
    if (!match) return '';
    const seat = activeSeat(match)!;
    const invs = match.pendingInvasions.filter(
      (i) => i.attackerFactionId === seat.factionId || i.status === 'battle',
    );
    if (!invs.length) return `<span class="cm-muted">No invasions</span>`;
    return invs
      .map((inv) => {
        const name = escapeHtml(regionByIdName(inv.regionId));
        if (inv.status === 'battle') {
          return `<div class="tw-inv">
            <strong>Battle · ${name}${inv.treachery ? ' · TREACHERY' : ''}</strong>
            <button type="button" data-act="battle-lose" data-inv="${inv.id}" data-who="defender">Defender admits defeat</button>
            <button type="button" data-act="battle-lose" data-inv="${inv.id}" data-who="attacker">Attacker admits defeat</button>
          </div>`;
        }
        const dests = retreatDestinations(match!, map, inv);
        return `<div class="tw-inv">
          <strong>Invasion · ${name}</strong>
          <button type="button" data-act="inv" data-inv="${inv.id}" data-choice="auto">Auto</button>
          <button type="button" data-act="inv" data-inv="${inv.id}" data-choice="retreat" ${dests.length ? '' : 'disabled'}>Retreat</button>
          <button type="button" data-act="inv" data-inv="${inv.id}" data-choice="defeat">Defeat</button>
          <button type="button" data-act="inv" data-inv="${inv.id}" data-choice="defend">Defend</button>
          <button type="button" data-act="inv" data-inv="${inv.id}" data-choice="battle">Battle</button>
          <button type="button" data-act="inv" data-inv="${inv.id}" data-choice="join">Join</button>
        </div>`;
      })
      .join('');
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
    hud.querySelector('[data-act="next"]')?.addEventListener('click', () => {
      if (
        taxFxBusy ||
        (match!.phase.kind === 'play' &&
          (match!.phase.phase === 'taxes' || match!.phase.phase === 'armies'))
      ) {
        return;
      }
      try {
        selectedStackId = null;
        legalDests = [];
        commit(advancePhase(match!, map, sea));
      } catch (e) {
        fail(e);
      }
    });
    hud.querySelector('[data-act="resign-match"]')?.addEventListener('click', () => {
      if (!confirm('Abandon this match and return to setup?')) return;
      clearSavedMatch();
      match = null;
      setupPicks = [];
      selectedStackId = null;
      legalDests = [];
      paintAll();
    });
    hud.querySelectorAll('[data-act="inv"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const el = btn as HTMLElement;
        const invId = el.dataset.inv!;
        const choice = el.dataset.choice as 'auto' | 'retreat' | 'defeat' | 'defend' | 'battle' | 'join';
        try {
          if (choice === 'join') {
            if (!confirm('Both sides agree to join forces?')) return;
            commit(resolveInvasionChoice(match!, map, sea, invId, 'join', { joinConfirm: true }));
          } else {
            commit(resolveInvasionChoice(match!, map, sea, invId, choice));
          }
        } catch (e) {
          fail(e);
        }
      });
    });
    hud.querySelectorAll('[data-act="battle-lose"]').forEach((btn) => {
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
        return `<button type="button" class="tw-stack-btn${sel}${upkeepWarn ? ' upkeep-warn' : ''}" data-stack="${s.id}" ${ctrl ? '' : 'disabled'}
          style="border-color:${factionColor(map, s.factionId)}">
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

    panel.innerHTML = `
      <h2>${escapeHtml(region.name)}</h2>
      <p><span class="cm-muted">Owned by</span> ${escapeHtml(factionName(map, ownerOf(match, region.id)))}</p>
      <p><span class="cm-muted">Settlement</span> ${escapeHtml(settle)}</p>
      ${units}
      <p><span class="cm-muted">Supply</span> ${supplied ? 'yes' : 'no'}${siege ? ' · SIEGE' : ''}</p>
      <h3>Stacks</h3>
      <div class="tw-stack-list">${stackHtml || '<p class="cm-muted">Empty</p>'}</div>
      ${treachery}
      ${grants}
      <h3>Log</h3>
      <ul class="tw-log">${match.log
        .slice(-8)
        .map((l) => `<li>${escapeHtml(l)}</li>`)
        .reverse()
        .join('')}</ul>`;
    bindInfo();
  }

  function paintSetup(panel: Element): void {
    const choices = choosableFactions(map);
    panel.innerHTML = `
      <h2>Setup</h2>
      <p class="cm-hint">Pick factions (turn order = pick order). Each starts with 1¢, units on capital + villages. Unpicked capitals become barbarian.</p>
      <ul class="tw-setup-factions">
        ${choices
          .map((f) => {
            const on = setupPicks.includes(f.id);
            const ord = on ? setupPicks.indexOf(f.id) + 1 : '';
            return `<li>
              <button type="button" class="tw-setup-f${on ? ' on' : ''}" data-pick="${f.id}"
                style="--fc:${f.color}">
                <span class="swatch" style="background:${f.color}"></span>
                ${escapeHtml(f.name)}
                ${ord ? `<em>#${ord}</em>` : ''}
              </button>
            </li>`;
          })
          .join('')}
      </ul>
      <button type="button" data-start-match ${setupPicks.length ? '' : 'disabled'}>Start match (${setupPicks.length})</button>
      ${statusMsg ? `<p class="tw-status-err">${escapeHtml(statusMsg)}</p>` : ''}`;

    panel.querySelectorAll('[data-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.pick!;
        if (setupPicks.includes(id)) setupPicks = setupPicks.filter((x) => x !== id);
        else setupPicks = [...setupPicks, id];
        paintInfo();
      });
    });
    panel.querySelector('[data-start-match]')?.addEventListener('click', () => {
      try {
        commit(createMatch(map, setupPicks));
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

  function refreshLegal(): void {
    legalDests = [];
    if (!match || match.phase.kind !== 'play') return;
    if (match.phase.phase === 'recruit') {
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
    selectedStackId = stackId;
    const st = match?.stacks.find((s) => s.id === stackId);
    moveCountMode = st?.kind === 'army' ? 'all' : 'one';
    if (st) selectedId = st.regionId;
    refreshLegal();
  }

  function tryMoveSelected(regionId: string, count: number | 'all'): boolean {
    if (!match || !selectedStackId) return false;
    const stack = match.stacks.find((s) => s.id === selectedStackId);
    const moveCount = stack?.kind === 'army' ? 'all' : count;
    try {
      const next = moveStack(match, map, sea, selectedStackId, regionId, {
        count: moveCount,
        payerFactionId: giftPayerId ?? undefined,
      });
      selectedId = regionId;
      selectedStackId = null;
      moveCountMode = 'one';
      legalDests = [];
      commit(next);
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

    regionsG.innerHTML = map.regions
      .map((r) => {
        const sel = selectedId === r.id ? ' selected' : '';
        const legal = legalDests.includes(r.id) ? ' legal' : '';
        const siege = match?.sieges.some((s) => s.regionId === r.id) ? ' siege' : '';
        const oid = owners ? owners[r.id] ?? null : r.ownerId;
        const fill = factionColor(map, oid);
        const neut = oid ? '' : ' neutral';
        return `<path class="cm-region${sel}${legal}${siege}${neut}" data-region="${r.id}" d="${ringToPath(r.ring)}" fill="${fill}"/>`;
      })
      .join('');

    labelsG.innerHTML = '';

    settlementsG.innerHTML = map.regions
      .map((r) => {
        if (r.settlement.kind === 'none') return '';
        const { at } = r.settlement;
        if (r.settlement.kind === 'village') {
          return villageMarkerSvg(at.x, at.y);
        }
        return capitalMarkerSvg(at.x, at.y, CAPITAL_LABEL[r.settlement.key]);
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

  function paintAll(): void {
    refreshLegal();
    paintHud();
    paintInfo();
    paintMap();
    paintUpkeepModal();
  }

  function zoomAt(sx: number, sy: number, factor: number): void {
    const nw = Math.min(DEFAULT_VIEW.w * 3, Math.max(120, view.w * factor));
    const nh = (nw / view.w) * view.h;
    const rx = (sx - view.x) / view.w;
    const ry = (sy - view.y) / view.h;
    view = { x: sx - rx * nw, y: sy - ry * nh, w: nw, h: nh };
  }

  function onLocationClick(locationId: string): void {
    if (taxFxBusy) return;
    const isStop = isSeaStopLocation(map, locationId);
    if (!match || match.phase.kind !== 'play') {
      selectedId = isStop ? null : locationId;
      paintAll();
      return;
    }
    const phase = match.phase.phase;
    const seat = activeSeat(match)!;

    if (phase === 'recruit' && !isStop) {
      const allowed = recruitableRegions(match, map, sea, seat.factionId);
      if (allowed.includes(locationId)) {
        try {
          const next = recruit(match, map, sea, locationId, giftPayerId ?? undefined);
          selectedId = locationId;
          commit(next);
          playRecruitFx(locationId, seat.factionId);
          return;
        } catch (e) {
          fail(e);
        }
      }
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
        legalDests = [];
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
        match?.phase.kind === 'play' &&
        match.phase.phase === 'move'
      ) {
        const stackId = (stackEl as HTMLElement).dataset.stack!;
        const st = match.stacks.find((s) => s.id === stackId);
        if (st && !st.moved) {
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
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      root.remove();
    },
  };
}
