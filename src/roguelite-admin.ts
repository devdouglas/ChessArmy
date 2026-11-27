/**
 * Editor tab: configure roguelite prices, unlocks, regions, and globals.
 */
import {
  PROMOTION_TOKEN_TYPES,
  UNIT_TOKEN_LABEL,
  type PromotionTokenType,
  type UnitType,
} from './engine';
import { pieceIconSvg, unitTokenGlyphSvg } from './icons';
import { PERIOD_LABEL, PERIODS, type Period } from './period';
import {
  applyRogueConfig,
  exportRogueConfigJson,
  getRogueConfig,
  getRogueProgress,
  hasRogueConfigOverride,
  promoRogueCfg,
  reloadShippedRogueConfig,
  saveRogueConfigLocal,
  sanitizeUnlock,
  type RogueConfig,
  type RogueProgress,
  type RoguePromoCfg,
  type RogueRegion,
  type RogueUnitCfg,
  type RogueUnlock,
  unitAvailableInRun,
  unitRogueCfg,
  unlockSatisfied,
} from './roguelite-config';
import { UNIT_STATS, UNIT_TYPES } from './roster';

export type RogueAdminPreview = {
  mode: 'current' | 'fresh' | 'custom';
  runsCompleted: number;
  bestBattle: number;
  regionsCleared: string[];
};

export const defaultRogueAdminPreview = (): RogueAdminPreview => ({
  mode: 'current',
  runsCompleted: 0,
  bestBattle: 0,
  regionsCleared: [],
});

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function previewProgress(preview: RogueAdminPreview): RogueProgress {
  if (preview.mode === 'fresh') return { runsCompleted: 0, bestBattle: 0, regionsCleared: [] };
  if (preview.mode === 'current') return getRogueProgress();
  return {
    runsCompleted: preview.runsCompleted,
    bestBattle: preview.bestBattle,
    regionsCleared: [...preview.regionsCleared],
  };
}

function unlockSelect(name: string, unlock: RogueUnlock, regions: RogueRegion[]): string {
  const t = unlock.type;
  const param =
    t === 'battleAtLeast'
      ? `<input type="number" min="1" max="999" data-unlock-param="${esc(name)}" value="${unlock.battle}" title="Battle" />`
      : t === 'runsCompleted'
        ? `<input type="number" min="0" max="999" data-unlock-param="${esc(name)}" value="${unlock.count}" title="Runs completed" />`
        : t === 'regionCleared'
          ? `<select data-unlock-param="${esc(name)}">${regions
              .map(
                (r) =>
                  `<option value="${esc(r.id)}"${unlock.regionId === r.id ? ' selected' : ''}>${esc(r.name)}</option>`,
              )
              .join('')}</select>`
          : '';
  return `<span class="rogue-unlock">
    <select data-unlock-type="${esc(name)}">
      <option value="always"${t === 'always' ? ' selected' : ''}>Always</option>
      <option value="never"${t === 'never' ? ' selected' : ''}>Never</option>
      <option value="battleAtLeast"${t === 'battleAtLeast' ? ' selected' : ''}>From battle…</option>
      <option value="runsCompleted"${t === 'runsCompleted' ? ' selected' : ''}>After N runs…</option>
      <option value="regionCleared"${t === 'regionCleared' ? ' selected' : ''}>Region cleared…</option>
    </select>
    ${param}
  </span>`;
}

function chk(name: string, on: boolean, title = ''): string {
  return `<input type="checkbox" data-flag="${esc(name)}"${on ? ' checked' : ''}${title ? ` title="${esc(title)}"` : ''} />`;
}

function unitIcon(type: UnitType): string {
  return `<svg class="side-icon rogue-ov-icon" viewBox="-10 -10 20 20" width="28" height="28" aria-hidden="true">
    <circle cx="0" cy="0" r="9.5" fill="#3d4a3a" />
    <g fill="#e8ebe6" color="#e8ebe6">${pieceIconSvg(type, 16)}</g>
  </svg>`;
}

function promoIcon(id: PromotionTokenType): string {
  return `<svg class="rogue-ov-icon" viewBox="-12 -12 24 24" width="28" height="28" aria-hidden="true">${unitTokenGlyphSvg(id, 18)}</svg>`;
}

export function renderRogueConfigPage(
  draft: RogueConfig,
  preview: RogueAdminPreview,
  dirty: boolean,
): string {
  const g = draft.globals;
  const progress = previewProgress(preview);
  const eraUnits = (era: Period) =>
    UNIT_TYPES.filter((t) => UNIT_STATS[t]?.category === era).sort(
      (a, b) =>
        (UNIT_STATS[a]?.name ?? a).localeCompare(UNIT_STATS[b]?.name ?? b) || a.localeCompare(b),
    );

  const unitRows = (era: Period) =>
    eraUnits(era)
      .map((t) => {
        const s = UNIT_STATS[t];
        const c = unitRogueCfgMerged(t, draft);
        const name = s?.name ?? t;
        return `<tr data-unit="${esc(t)}">
          <td class="rogue-ico">${unitIcon(t)}</td>
          <td><strong>${esc(name)}</strong><div class="lvl-meta">${esc(t)}</div></td>
          <td class="rogue-num">${s?.value ?? '—'}</td>
          <td>${chk('listed', c.listed, 'Listed / accessible in roguelite')}</td>
          <td><input type="number" min="0" max="9999" data-field="price" value="${c.price ?? ''}" placeholder="${s?.value ?? 0}" title="Gold. Blank = unit value (${s?.value ?? 0})" /></td>
          <td><input type="number" min="1" max="999" data-field="fromBattle" value="${c.fromBattle}" title="First battle in a run" /></td>
          <td><input type="number" min="1" max="999" data-field="toBattle" value="${c.toBattle ?? ''}" placeholder="—" title="Last battle (blank = no cap)" /></td>
          <td>${unlockSelect(`u:${t}`, c.unlock, draft.regions)}</td>
          <td>${chk('inShop', c.inShop)}</td>
          <td>${chk('inStartPool', c.inStartPool)}</td>
          <td>${chk('inEnemyPool', c.inEnemyPool)}</td>
        </tr>`;
      })
      .join('');

  const promoRows = PROMOTION_TOKEN_TYPES.map((id) => {
    const c = promoRogueCfgMerged(id, draft);
    return `<tr data-promo="${id}">
      <td class="rogue-ico">${promoIcon(id)}</td>
      <td><strong>${esc(UNIT_TOKEN_LABEL[id])}</strong><div class="lvl-meta">${id}</div></td>
      <td>${chk('listed', c.listed)}</td>
      <td><input type="number" min="1" max="999" data-field="fromBattle" value="${c.fromBattle}" /></td>
      <td>${unlockSelect(`p:${id}`, c.unlock, draft.regions)}</td>
      <td>${chk('inShop', c.inShop)}</td>
      <td>${chk('enemyAllowed', c.enemyAllowed)}</td>
    </tr>`;
  }).join('');

  const regionRows = draft.regions
    .map(
      (r, i) => `<tr data-region-index="${i}">
        <td><input type="text" data-field="id" value="${esc(r.id)}" maxlength="40" /></td>
        <td><input type="text" data-field="name" value="${esc(r.name)}" maxlength="40" /></td>
        <td><input type="number" min="1" max="999" data-field="fromBattle" value="${r.fromBattle}" /></td>
        <td><input type="number" min="1" max="999" data-field="toBattle" value="${r.toBattle}" /></td>
        <td><button type="button" class="ghost danger" data-del-region="${i}">Remove</button></td>
      </tr>`,
    )
    .join('');

  const ovUnits = PERIODS.map((era) => {
    const items = eraUnits(era)
      .map((t) => {
        const c = unitRogueCfgMerged(t, draft);
        const unlocked = c.listed && unlockSatisfied(c.unlock, progress, Math.max(1, progress.bestBattle));
        const inRun = unitAvailableInRun(t, Math.max(1, preview.mode === 'custom' ? preview.bestBattle || 1 : progress.bestBattle || 1), 'shop', progress);
        const cls = ['rogue-ov-item', unlocked ? '' : 'locked', c.listed ? '' : 'unlist'].filter(Boolean).join(' ');
        const why = !c.listed
          ? 'Not listed in roguelite'
          : unlocked
            ? `Unlocked · from battle ${c.fromBattle}${c.toBattle ? `–${c.toBattle}` : ''} · ${c.price ?? UNIT_STATS[t]?.value ?? 0}g`
            : 'Not yet unlocked';
        return `<button type="button" class="${cls}" title="${esc(`${UNIT_STATS[t]?.name ?? t}: ${why}`)}" data-jump-unit="${esc(t)}">
          ${unitIcon(t)}
          <span>${esc(UNIT_STATS[t]?.name ?? t)}</span>
          ${inRun && unlocked ? '' : ''}
        </button>`;
      })
      .join('');
    return `<div class="rogue-ov-group"><h4>${esc(PERIOD_LABEL[era])}</h4><div class="rogue-ov-grid">${items}</div></div>`;
  }).join('');

  const ovPromos = PROMOTION_TOKEN_TYPES.map((id) => {
    const c = promoRogueCfgMerged(id, draft);
    const unlocked = c.listed && unlockSatisfied(c.unlock, progress, Math.max(1, progress.bestBattle));
    const cls = ['rogue-ov-item', unlocked ? '' : 'locked', c.listed ? '' : 'unlist'].filter(Boolean).join(' ');
    const why = !c.listed ? 'Not listed in the shop' : unlocked ? 'Unlocked' : 'Not yet unlocked';
    return `<button type="button" class="${cls}" title="${esc(`${UNIT_TOKEN_LABEL[id]}: ${why}`)}" data-jump-promo="${id}">
      ${promoIcon(id)}
      <span>${esc(UNIT_TOKEN_LABEL[id])}</span>
    </button>`;
  }).join('');

  const regionChecks = draft.regions
    .map((r) => {
      const on = progress.regionsCleared.includes(r.id);
      return `<label class="chk"><input type="checkbox" data-preview-region="${esc(r.id)}"${on ? ' checked' : ''}${preview.mode !== 'custom' ? ' disabled' : ''} /> ${esc(r.name)}</label>`;
    })
    .join('');

  const override = hasRogueConfigOverride();

  return `
    <div class="rogue-admin" id="rogue-admin">
      <div class="ai-editor-head rogue-admin-head">
        <h2>Roguelite config</h2>
        <span class="lvl-meta" id="rogue-admin-dirty">${dirty ? 'Unsaved changes (this browser)' : override ? 'Using a local override' : 'Shipped defaults'}</span>
        <div class="rogue-admin-actions">
          <button type="button" id="rogue-cfg-save">Save</button>
          <button type="button" class="ghost" id="rogue-cfg-export">Export JSON</button>
          <button type="button" class="ghost" id="rogue-cfg-reset">Reset to shipped</button>
        </div>
      </div>
      <p class="ai-editor-lead">Prices, unlocks, in-run availability, starting gold, and the goal battle. Save applies immediately in this browser (localStorage). Export a JSON file and put it in <code>public/data/roguelite.json</code> to ship the defaults. Seeded values match the previous hard-coded rules, so play does not change until you edit this.</p>

      <section class="rogue-admin-section" id="rogue-sec-globals">
        <h3>Run settings</h3>
        <div class="rogue-globals">
          <label>Starting gold <input type="number" min="0" max="9999" data-global="startGold" value="${g.startGold}" /></label>
          <label>Goal battles (end level) <input type="number" min="1" max="999" data-global="goalBattles" value="${g.goalBattles}" /></label>
          <label>Starting unit count <input type="number" min="1" max="16" data-global="startCount" value="${g.startCount}" /></label>
          <label>Shop size <input type="number" min="1" max="12" data-global="shopSize" value="${g.shopSize}" /></label>
          <label>Promo cost (after first) <input type="number" min="0" max="99" data-global="promoCost" value="${g.promoCost}" /></label>
          <label class="chk"><input type="checkbox" data-global-flag="firstPromoFree"${g.firstPromoFree ? ' checked' : ''} /> First promo free</label>
          <label>Value slack (battle + N) <input type="number" min="0" max="20" data-global="valueSlack" value="${g.valueSlack}" /></label>
          <label>Enemy promos from battle <input type="number" min="1" max="999" data-global="enemyPromoStart" value="${g.enemyPromoStart}" /></label>
          <label>Scout regenerates each <input type="number" min="0" max="20" data-global="scoutRegenPer" value="${g.scoutRegenPer}" /></label>
          <label>Wealthy gold each <input type="number" min="0" max="20" data-global="wealthyGoldPer" value="${g.wealthyGoldPer}" /></label>
          <label>Gold per star <input type="number" min="0" max="20" data-global="starGoldPerStar" value="${g.starGoldPerStar}" /></label>
          <label title="Used when the era has no Knight chess piece">Fallback general kit <input type="text" data-global-text="startGeneralKit" value="${esc(String(g.startGeneralKit))}" /></label>
          <label class="chk"><input type="checkbox" data-global-flag="endlessAfterGoal"${g.endlessAfterGoal ? ' checked' : ''} /> Endless after the goal</label>
        </div>
      </section>

      <section class="rogue-admin-section" id="rogue-sec-regions">
        <h3>Regions <span class="lvl-meta">Named slices of a run, used by “region cleared” unlocks. Seeded as Early (1–6) and Late (7–10) around the enemy-promo breakpoint.</span></h3>
        <div class="ai-check-wrap rogue-table-wrap">
          <table class="ai-check rogue-table">
            <thead><tr><th>Id</th><th>Name</th><th>From battle</th><th>To battle</th><th></th></tr></thead>
            <tbody>${regionRows}</tbody>
          </table>
        </div>
        <p><button type="button" class="ghost" id="rogue-add-region">Add region</button></p>
      </section>

      <section class="rogue-admin-section" id="rogue-sec-overview">
        <h3>Overview</h3>
        <p class="lvl-meta">Greyed items are not unlocked under the selected progress. Unlisted units stay in the grid but dimmer. Seeded unlocks are “Always”, matching current play.</p>
        <div class="rogue-preview">
          <span>Show as</span>
          <label><input type="radio" name="rogue-preview" value="current"${preview.mode === 'current' ? ' checked' : ''} /> Current progress</label>
          <label><input type="radio" name="rogue-preview" value="fresh"${preview.mode === 'fresh' ? ' checked' : ''} /> Fresh player</label>
          <label><input type="radio" name="rogue-preview" value="custom"${preview.mode === 'custom' ? ' checked' : ''} /> Custom</label>
          <label>Runs completed <input type="number" min="0" max="9999" id="rogue-preview-runs" value="${progress.runsCompleted}"${preview.mode !== 'custom' ? ' disabled' : ''} /></label>
          <label>Best battle <input type="number" min="0" max="9999" id="rogue-preview-battle" value="${progress.bestBattle}"${preview.mode !== 'custom' ? ' disabled' : ''} /></label>
          <span class="rogue-preview-regions">${regionChecks}</span>
        </div>
        ${ovUnits}
        <div class="rogue-ov-group"><h4>Promotions</h4><div class="rogue-ov-grid">${ovPromos}</div></div>
      </section>

      ${PERIODS.map(
        (era) => `
      <section class="rogue-admin-section" id="rogue-sec-units-${era}">
        <h3>Units — ${esc(PERIOD_LABEL[era])}</h3>
        <div class="ai-check-wrap rogue-table-wrap">
          <table class="ai-check rogue-table rogue-units">
            <thead>
              <tr>
                <th></th><th>Unit</th><th>Value</th><th>Listed</th><th>Price</th>
                <th>From</th><th>To</th><th>Unlock</th><th>Shop</th><th>Start</th><th>Enemy</th>
              </tr>
            </thead>
            <tbody>${unitRows(era)}</tbody>
          </table>
        </div>
      </section>`,
      ).join('')}

      <section class="rogue-admin-section" id="rogue-sec-promos">
        <h3>Promotions</h3>
        <div class="ai-check-wrap rogue-table-wrap">
          <table class="ai-check rogue-table">
            <thead>
              <tr>
                <th></th><th>Promotion</th><th>Listed</th><th>From battle</th>
                <th>Unlock</th><th>Shop</th><th>Enemy</th>
              </tr>
            </thead>
            <tbody>${promoRows}</tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function unitRogueCfgMerged(type: UnitType, draft: RogueConfig): RogueUnitCfg {
  const prev = getRogueConfig();
  applyRogueConfig(draft);
  const c = unitRogueCfg(type);
  applyRogueConfig(prev);
  return c;
}

function promoRogueCfgMerged(id: PromotionTokenType, draft: RogueConfig): RoguePromoCfg {
  const prev = getRogueConfig();
  applyRogueConfig(draft);
  const c = promoRogueCfg(id);
  applyRogueConfig(prev);
  return c;
}

function readUnlock(scope: Element, name: string): RogueUnlock {
  const typeEl = scope.querySelector<HTMLSelectElement>(`[data-unlock-type="${CSS.escape(name)}"]`);
  const paramEl = scope.querySelector<HTMLInputElement | HTMLSelectElement>(
    `[data-unlock-param="${CSS.escape(name)}"]`,
  );
  const type = typeEl?.value ?? 'always';
  if (type === 'battleAtLeast') return sanitizeUnlock({ type, battle: Number(paramEl?.value) });
  if (type === 'runsCompleted') return sanitizeUnlock({ type, count: Number(paramEl?.value) });
  if (type === 'regionCleared') return sanitizeUnlock({ type, regionId: paramEl?.value });
  if (type === 'never') return { type: 'never' };
  return { type: 'always' };
}

function numOrNull(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Read the form into a config object (does not persist). */
export function readRogueAdminForm(root: ParentNode): RogueConfig {
  const num = (name: string, fallback: number) => {
    const el = root.querySelector<HTMLInputElement>(`[data-global="${name}"]`);
    const n = Number(el?.value);
    return Number.isFinite(n) ? n : fallback;
  };
  const flag = (name: string) =>
    !!root.querySelector<HTMLInputElement>(`[data-global-flag="${name}"]`)?.checked;
  const text = (name: string, fallback: string) =>
    root.querySelector<HTMLInputElement>(`[data-global-text="${name}"]`)?.value.trim() || fallback;

  const g = getRogueConfig().globals;
  const globals = {
    startGold: num('startGold', g.startGold),
    goalBattles: num('goalBattles', g.goalBattles),
    startCount: num('startCount', g.startCount),
    shopSize: num('shopSize', g.shopSize),
    promoCost: num('promoCost', g.promoCost),
    firstPromoFree: flag('firstPromoFree'),
    valueSlack: num('valueSlack', g.valueSlack),
    enemyPromoStart: num('enemyPromoStart', g.enemyPromoStart),
    scoutRegenPer: num('scoutRegenPer', g.scoutRegenPer),
    wealthyGoldPer: num('wealthyGoldPer', g.wealthyGoldPer),
    starGoldPerStar: num('starGoldPerStar', g.starGoldPerStar),
    startGeneralKit: text('startGeneralKit', String(g.startGeneralKit)),
    endlessAfterGoal: flag('endlessAfterGoal'),
  };

  const regions: RogueRegion[] = [];
  root.querySelectorAll<HTMLTableRowElement>('tr[data-region-index]').forEach((tr) => {
    const id = tr.querySelector<HTMLInputElement>('[data-field="id"]')?.value.trim() ?? '';
    const name = tr.querySelector<HTMLInputElement>('[data-field="name"]')?.value.trim() ?? id;
    const fromBattle = Number(tr.querySelector<HTMLInputElement>('[data-field="fromBattle"]')?.value);
    const toBattle = Number(tr.querySelector<HTMLInputElement>('[data-field="toBattle"]')?.value);
    if (!id) return;
    regions.push({
      id,
      name: name || id,
      fromBattle: Number.isFinite(fromBattle) ? fromBattle : 1,
      toBattle: Number.isFinite(toBattle) ? toBattle : 1,
    });
  });

  const units: Record<string, Partial<RogueUnitCfg>> = {};
  root.querySelectorAll<HTMLTableRowElement>('tr[data-unit]').forEach((tr) => {
    const id = tr.dataset.unit;
    if (!id) return;
    const flagOf = (n: string) => !!tr.querySelector<HTMLInputElement>(`[data-flag="${n}"]`)?.checked;
    units[id] = {
      listed: flagOf('listed'),
      price: numOrNull(tr.querySelector<HTMLInputElement>('[data-field="price"]')?.value ?? ''),
      fromBattle: Number(tr.querySelector<HTMLInputElement>('[data-field="fromBattle"]')?.value) || 1,
      toBattle: numOrNull(tr.querySelector<HTMLInputElement>('[data-field="toBattle"]')?.value ?? ''),
      unlock: readUnlock(tr, `u:${id}`),
      inShop: flagOf('inShop'),
      inStartPool: flagOf('inStartPool'),
      inEnemyPool: flagOf('inEnemyPool'),
    };
  });

  const promotions: Record<string, Partial<RoguePromoCfg>> = {};
  root.querySelectorAll<HTMLTableRowElement>('tr[data-promo]').forEach((tr) => {
    const id = tr.dataset.promo;
    if (!id) return;
    const flagOf = (n: string) => !!tr.querySelector<HTMLInputElement>(`[data-flag="${n}"]`)?.checked;
    promotions[id] = {
      listed: flagOf('listed'),
      fromBattle: Number(tr.querySelector<HTMLInputElement>('[data-field="fromBattle"]')?.value) || 1,
      unlock: readUnlock(tr, `p:${id}`),
      inShop: flagOf('inShop'),
      enemyAllowed: flagOf('enemyAllowed'),
    };
  });

  return { version: 1, globals, regions, units, promotions };
}

export function readRogueAdminPreview(root: ParentNode, prev: RogueAdminPreview): RogueAdminPreview {
  const mode =
    (root.querySelector<HTMLInputElement>('input[name="rogue-preview"]:checked')?.value as
      | RogueAdminPreview['mode']
      | undefined) ?? prev.mode;
  const runsCompleted = Number(root.querySelector<HTMLInputElement>('#rogue-preview-runs')?.value);
  const bestBattle = Number(root.querySelector<HTMLInputElement>('#rogue-preview-battle')?.value);
  const regionsCleared: string[] = [];
  root.querySelectorAll<HTMLInputElement>('[data-preview-region]').forEach((el) => {
    if (el.checked && el.dataset.previewRegion) regionsCleared.push(el.dataset.previewRegion);
  });
  return {
    mode,
    runsCompleted: Number.isFinite(runsCompleted) ? runsCompleted : prev.runsCompleted,
    bestBattle: Number.isFinite(bestBattle) ? bestBattle : prev.bestBattle,
    regionsCleared: mode === 'custom' ? regionsCleared : prev.regionsCleared,
  };
}

export function persistRogueAdminDraft(draft: RogueConfig): void {
  saveRogueConfigLocal(draft);
}

export function downloadRogueConfig(cfg: RogueConfig): void {
  const blob = new Blob([exportRogueConfigJson(cfg)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'roguelite.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function resetRogueAdminDraft(): Promise<RogueConfig> {
  return reloadShippedRogueConfig();
}
