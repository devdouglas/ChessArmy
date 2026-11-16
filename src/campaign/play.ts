import './campaign.css';
import {
  CAPITAL_LABEL,
  DEFAULT_VIEW,
  type CampaignMap,
  type CampaignRegion,
  type Point,
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
  type CampaignStack,
  type MatchState,
  type TurnPhase,
} from './match';
import {
  admitBattleDefeat,
  advancePhase,
  answerArmyPrompt,
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
  skipTaxes,
  stacksInRegion,
  toggleSupplyGrant,
  armyNeedsUpkeepPayment,
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

function stackBadge(s: CampaignStack): string {
  if (s.kind === 'army') {
    const t = s.armySize === 10 ? 'L' : s.armySize === 5 ? 'M' : 'S';
    return `${t}${s.units}`;
  }
  return `×${s.units}`;
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
  let spacePan = false;
  let panning = false;
  let panLast: Point | null = null;
  let statusMsg = '';
  let giftPayerId: string | null = null;

  let match: MatchState | null = loadMatch();
  let setupPicks: string[] = [];

  const root = document.createElement('div');
  root.className = 'campaign-root campaign-play';
  host.replaceChildren(root);

  function commit(next: MatchState): void {
    match = next;
    saveMatch(next);
    statusMsg = '';
    paintAll();
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
        <button type="button" data-act="next">Next phase</button>
        <button type="button" class="danger" data-act="resign-match">New game</button>
      </div>
      ${statusMsg ? `<p class="tw-status-err">${escapeHtml(statusMsg)}</p>` : ''}
    `;

    hud.querySelector<HTMLSelectElement>('[data-gift]')?.addEventListener('change', (e) => {
      giftPayerId = (e.target as HTMLSelectElement).value || null;
    });
    bindHudActions();
  }

  function phaseActionsHtml(phase: TurnPhase, _factionId: string): string {
    if (!match || match.phase.kind !== 'play') return '';
    if (phase === 'taxes' && !match.phase.taxesCollected) {
      return `
        <button type="button" data-act="collect-tax">Collect taxes</button>
        <button type="button" data-act="skip-tax">Skip</button>`;
    }
    if (phase === 'recruit') {
      return `<span class="cm-muted">Click a supplied region to recruit (1¢)</span>`;
    }
    if (phase === 'upkeep') {
      const due = match.stacks.filter(
        (s) =>
          s.factionId === activeSeat(match!)!.factionId &&
          armyNeedsUpkeepPayment(match!, map, sea, s),
      );
      if (!due.length) return `<span class="cm-muted">No campaigning armies</span>`;
      return due
        .map(
          (s) =>
            `<button type="button" data-act="pay-upkeep" data-stack="${s.id}">Pay upkeep · ${escapeHtml(regionByIdName(s.regionId))} (${s.units})</button>`,
        )
        .join('');
    }
    if (phase === 'move') {
      return `<span class="cm-muted">Select a stack, click a highlighted region. Move again for haste (+1¢; exhausted if invading)</span>`;
    }
    if (phase === 'invasions') {
      return invasionPanelHtml();
    }
    if (phase === 'armies' && match.armyPrompt) {
      return `
        <span class="cm-muted">${escapeHtml(regionByIdName(match.armyPrompt.regionId))}: ${match.armyPrompt.units} units</span>
        <button type="button" data-act="army-upgrade">Upgrade (greedy)</button>
        <button type="button" data-act="army-separate">Keep separate smalls</button>`;
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
    hud.querySelector('[data-act="collect-tax"]')?.addEventListener('click', () => {
      try {
        commit(collectTaxes(match!, map));
      } catch (e) {
        fail(e);
      }
    });
    hud.querySelector('[data-act="skip-tax"]')?.addEventListener('click', () => {
      commit(skipTaxes(match!));
    });
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
    hud.querySelector('[data-act="army-upgrade"]')?.addEventListener('click', () => {
      commit(answerArmyPrompt(match!, map, 'upgrade'));
    });
    hud.querySelector('[data-act="army-separate"]')?.addEventListener('click', () => {
      commit(answerArmyPrompt(match!, map, 'separate'));
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
        return `<button type="button" class="tw-stack-btn${sel}" data-stack="${s.id}" ${ctrl ? '' : 'disabled'}
          style="border-color:${factionColor(map, s.factionId)}">
          ${escapeHtml(factionName(map, s.factionId))} ${stackBadge(s)}
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
        selectedStackId = (btn as HTMLElement).dataset.stack!;
        refreshLegal();
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
    if (!match || !selectedStackId || match.phase.kind !== 'play') return;
    if (match.phase.phase !== 'move') return;
    const stack = match.stacks.find((s) => s.id === selectedStackId);
    const haste = !!stack?.moved;
    legalDests = legalMovesForStack(match, map, sea, selectedStackId, {
      haste: haste || undefined,
    }).map((m) => m.regionId);
  }

  function paintMap(): void {
    const svg = root.querySelector<SVGSVGElement>('.cm-svg');
    if (!svg) return;
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    svg.classList.toggle('tool-pan', true);
    svg.classList.toggle('panning', panning || spacePan);

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

    // Stack chips near centroid
    if (match) {
      const byRegion = new Map<string, CampaignStack[]>();
      for (const s of match.stacks) {
        const list = byRegion.get(s.regionId) ?? [];
        list.push(s);
        byRegion.set(s.regionId, list);
      }
      const chips: string[] = [];
      for (const [rid, list] of byRegion) {
        const reg = map.regions.find((r) => r.id === rid);
        if (!reg) continue;
        const c = centroid(reg.ring);
        list.forEach((s, i) => {
          const x = c.x + (i - (list.length - 1) / 2) * 18;
          const y = c.y + 12;
          const sel = selectedStackId === s.id ? ' selected' : '';
          chips.push(`<g class="cm-stack-chip${sel}" data-stack="${s.id}" transform="translate(${x},${y})">
            <rect x="-10" y="-7" width="20" height="14" rx="3" fill="${factionColor(map, s.factionId)}" stroke="#000" stroke-width="0.8"/>
            <text y="3.5" text-anchor="middle">${stackBadge(s)}</text>
          </g>`);
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
      .map(
        (n) =>
          `<circle class="cm-sea-node ${n.kind}" cx="${n.at.x}" cy="${n.at.y}" r="${n.kind === 'stop' ? 5.5 : 4.5}"/>`,
      )
      .join('');
  }

  function paintAll(): void {
    paintHud();
    paintInfo();
    paintMap();
  }

  function zoomAt(sx: number, sy: number, factor: number): void {
    const nw = Math.min(DEFAULT_VIEW.w * 3, Math.max(120, view.w * factor));
    const nh = (nw / view.w) * view.h;
    const rx = (sx - view.x) / view.w;
    const ry = (sy - view.y) / view.h;
    view = { x: sx - rx * nw, y: sy - ry * nh, w: nw, h: nh };
  }

  function onRegionClick(region: CampaignRegion, haste: boolean): void {
    if (!match || match.phase.kind !== 'play') {
      selectedId = region.id;
      paintAll();
      return;
    }
    const phase = match.phase.phase;
    const seat = activeSeat(match)!;

    if (phase === 'recruit') {
      const allowed = recruitableRegions(match, map, sea, seat.factionId);
      if (allowed.includes(region.id)) {
        try {
          commit(recruit(match, map, sea, region.id, giftPayerId ?? undefined));
          selectedId = region.id;
          return;
        } catch (e) {
          fail(e);
        }
      }
    }

    if (phase === 'move' && selectedStackId && legalDests.includes(region.id)) {
      const stack = match.stacks.find((s) => s.id === selectedStackId);
      try {
        commit(
          moveStack(match, map, sea, selectedStackId, region.id, {
            haste: stack?.moved || haste || undefined,
            payerFactionId: giftPayerId ?? undefined,
          }),
        );
        // Keep selection for optional haste step
        selectedId = region.id;
        refreshLegal();
        paintAll();
        return;
      } catch (e) {
        fail(e);
        return;
      }
    }

    selectedId = region.id;
    // Clicking a region with controllable stacks selects first
    if (phase === 'move') {
      const ctrl = controllableStackIds(match, map, seat.factionId);
      const here = stacksInRegion(match, region.id).find((s) => ctrl.includes(s.id));
      if (here) {
        selectedStackId = here.id;
        refreshLegal();
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
    paintAll();
    bindShell();
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
      if (e.button === 1 || spacePan || e.button === 0) {
        panning = true;
        panLast = { x: e.clientX, y: e.clientY };
        svg.dataset.panMoved = '0';
        svg.setPointerCapture(e.pointerId);
      }
    });
    svg.addEventListener('pointermove', (e) => {
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
      const moved = svg.dataset.panMoved === '1';
      panning = false;
      panLast = null;
      try {
        svg.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (!moved && e.button === 0) {
        const target = (e.target as Element)?.closest?.('[data-stack]');
        if (target) {
          selectedStackId = (target as HTMLElement).dataset.stack!;
          const st = match?.stacks.find((s) => s.id === selectedStackId);
          if (st) selectedId = st.regionId;
          refreshLegal();
          paintAll();
        } else {
          const p = clientToSvg(svg, e.clientX, e.clientY);
          const region = findRegionAt(map, p);
          if (region) onRegionClick(region, e.shiftKey);
          else {
            selectedId = null;
            paintAll();
          }
        }
      }
      paintMap();
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
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      root.remove();
    },
  };
}
