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
import { eraIsWip } from './period';
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
  type RoguePromoCfg,
  type RogueRegionCfg,
  type RogueUnitCfg,
  type RogueUnlock,
  type RogueUnlockCondition,
  type RogueUnlockType,
  ROGUE_UNLOCK_TYPE_LABEL,
  ROGUE_UNLOCK_TYPES,
  describeUnlock,
  listRogueRegionPresets,
  regionRogueCfg,
  unitRogueCfg,
  unlockSatisfied,
} from './roguelite-config';
import {
  UNIT_CATEGORIES,
  UNIT_CATEGORY_LABEL,
  UNIT_CLASS_LABEL,
  UNIT_CLASSES,
  UNIT_STATS,
  UNIT_TYPES,
  type UnitCategory,
} from './roster';

export const ROGUE_ADMIN_ERA_KEY = 'chessarmy-roguelite-admin-era-v1';

export function getRogueAdminEra(): UnitCategory {
  try {
    if (typeof localStorage === 'undefined') return 'ancient';
    const raw = localStorage.getItem(ROGUE_ADMIN_ERA_KEY);
    if (raw && (UNIT_CATEGORIES as readonly string[]).includes(raw)) return raw as UnitCategory;
  } catch {
    /* private mode */
  }
  return 'ancient';
}

export function isRogueAdminEra(v: unknown): v is UnitCategory {
  return typeof v === 'string' && (UNIT_CATEGORIES as readonly string[]).includes(v);
}

export function setRogueAdminEra(era: UnitCategory): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(ROGUE_ADMIN_ERA_KEY, era);
  } catch {
    /* private mode */
  }
}

/** Same grouping as the Units editor: class headers, then value, then name. */
export function unitsGroupedLikeEditor(era: UnitCategory): { cls: string; label: string; types: UnitType[] }[] {
  const shown = UNIT_TYPES.filter((t) => UNIT_STATS[t]?.category === era);
  return UNIT_CLASSES.map((cls) => {
    const types = shown
      .filter((t) => UNIT_STATS[t].unitClass === cls)
      .sort(
        (a, b) =>
          UNIT_STATS[a].value - UNIT_STATS[b].value ||
          UNIT_STATS[a].name.localeCompare(UNIT_STATS[b].name),
      );
    return { cls, label: UNIT_CLASS_LABEL[cls], types };
  }).filter((g) => g.types.length);
}

export function rogueEraFilterHtml(selected: UnitCategory): string {
  const buttons = UNIT_CATEGORIES.map(
    (c) =>
      `<button type="button" data-rogue-era="${c}" class="${selected === c ? 'active' : ''}">${UNIT_CATEGORY_LABEL[c]}${eraIsWip(c) ? '<span class="era-wip">under construction</span>' : ''}</button>`,
  ).join('');
  return `<div class="unit-filter rogue-era-filter" role="radiogroup" aria-label="Era">${buttons}</div>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function unitTypeOptions(selected: string | null | undefined, allowAny: boolean): string {
  const opts = allowAny
    ? [`<option value=""${selected ? '' : ' selected'}>Any unit</option>`]
    : ['<option value="">Choose a unit…</option>'];
  const byCat: Record<string, UnitType[]> = {};
  for (const typ of UNIT_TYPES) {
    const cat = UNIT_STATS[typ]?.category ?? 'other';
    (byCat[cat] ??= []).push(typ);
  }
  for (const cat of UNIT_CATEGORIES) {
    const list = byCat[cat] ?? [];
    if (!list.length) continue;
    opts.push(`<optgroup label="${esc(UNIT_CATEGORY_LABEL[cat])}">`);
    for (const typ of list) {
      const name = UNIT_STATS[typ]?.name ?? typ;
      opts.push(
        `<option value="${esc(typ)}"${selected === typ ? ' selected' : ''}>${esc(name)}</option>`,
      );
    }
    opts.push('</optgroup>');
  }
  return opts.join('');
}

function conditionParams(cond: RogueUnlockCondition): string {
  if (cond.type === 'playGames' || cond.type === 'haveCoins') {
    const title = cond.type === 'playGames' ? 'Games / runs started' : 'Coins in purse';
    return `<input type="number" min="0" max="9999" data-unlock-param="count" value="${cond.count}" title="${title}" />`;
  }
  if (cond.type === 'reachBattle' || cond.type === 'reachBattleNoLoss') {
    return `<input type="number" min="1" max="999" data-unlock-param="battle" value="${cond.battle}" title="Battle" />`;
  }
  if (cond.type === 'killUnits') {
    return `<input type="number" min="1" max="9999" data-unlock-param="count" value="${cond.count}" title="Kills" />
      <select data-unlock-param="unitType">${unitTypeOptions(cond.unitType, true)}</select>`;
  }
  if (cond.type === 'winWithUnits') {
    return `<input type="number" min="1" max="99" data-unlock-param="count" value="${cond.count}" title="How many" />
      <select data-unlock-param="unitType">${unitTypeOptions(cond.unitType, false)}</select>`;
  }
  return '';
}

function unlockEditor(name: string, unlock: RogueUnlock): string {
  const conds = sanitizeUnlock(unlock);
  const rows = conds
    .map((cond, i) => {
      const typ = cond.type;
      const opts = ROGUE_UNLOCK_TYPES.map(
        (t) =>
          `<option value="${t}"${typ === t ? ' selected' : ''}>${esc(ROGUE_UNLOCK_TYPE_LABEL[t])}</option>`,
      ).join('');
      return `<div class="rogue-unlock" data-unlock-index="${i}">
      <select data-unlock-type>${opts}</select>
      ${conditionParams(cond)}
      <button type="button" class="ghost rogue-unlock-del" data-unlock-del title="Remove condition">×</button>
    </div>`;
    })
    .join('');
  return `<div class="rogue-conds" data-unlock-scope="${esc(name)}">
    ${rows}
    <button type="button" class="ghost rogue-unlock-add" data-unlock-add="${esc(name)}">Add condition</button>
  </div>`;
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
  dirty: boolean,
): string {
  const g = draft.globals;
  const era = getRogueAdminEra();
  const groups = unitsGroupedLikeEditor(era);

  const unitRow = (t: UnitType) => {
    const s = UNIT_STATS[t];
    const c = unitRogueCfgMerged(t, draft);
    const name = s?.name ?? t;
    return `<tr data-unit="${esc(t)}">
          <td class="rogue-ico">${unitIcon(t)}</td>
          <td><strong>${esc(name)}</strong><div class="lvl-meta">${esc(t)}</div></td>
          <td class="rogue-num">${s?.value ?? '—'}</td>
          <td>${chk('used', c.used, 'Used in roguelite')}</td>
          <td><input type="number" min="0" max="9999" data-field="price" value="${c.price ?? ''}" placeholder="${s?.value ?? 0}" title="Gold. Blank = unit value (${s?.value ?? 0})" /></td>
          <td><input type="number" min="1" max="999" data-field="fromBattle" value="${c.fromBattle}" title="First battle in a run" /></td>
          <td><input type="number" min="1" max="999" data-field="toBattle" value="${c.toBattle ?? ''}" placeholder="—" title="Last battle (blank = no cap)" /></td>
          <td>${unlockEditor(`u:${t}`, c.unlock)}</td>
          <td>${chk('inShop', c.inShop)}</td>
          <td>${chk('inStartPool', c.inStartPool)}</td>
          <td>${chk('inEnemyPool', c.inEnemyPool)}</td>
        </tr>`;
  };

  const unitTables = groups.length
    ? groups
        .map(
          (group) => `
      <section class="rogue-admin-section unit-class-group" id="rogue-sec-units-${esc(era)}-${esc(group.cls)}">
        <h3 class="unit-class-label">${esc(group.label)}</h3>
        <div class="ai-check-wrap rogue-table-wrap">
          <table class="ai-check rogue-table rogue-units">
            <thead>
              <tr>
                <th></th><th>Unit</th><th>Value</th><th>Used</th><th>Price</th>
                <th>From</th><th>To</th><th>Unlock</th><th>Shop</th><th>Start</th><th>Enemy</th>
              </tr>
            </thead>
            <tbody>${group.types.map(unitRow).join('')}</tbody>
          </table>
        </div>
      </section>`,
        )
        .join('')
    : `<p class="editor-empty">No ${esc(UNIT_CATEGORY_LABEL[era])} units.</p>`;

  const promoRows = PROMOTION_TOKEN_TYPES.map((id) => {
    const c = promoRogueCfgMerged(id, draft);
    return `<tr data-promo="${id}">
      <td class="rogue-ico">${promoIcon(id)}</td>
      <td><strong>${esc(UNIT_TOKEN_LABEL[id])}</strong><div class="lvl-meta">${id}</div></td>
      <td>${chk('used', c.used)}</td>
      <td><input type="number" min="1" max="999" data-field="fromBattle" value="${c.fromBattle}" /></td>
      <td>${unlockEditor(`p:${id}`, c.unlock)}</td>
      <td>${chk('inShop', c.inShop)}</td>
      <td>${chk('enemyAllowed', c.enemyAllowed)}</td>
    </tr>`;
  }).join('');

  const regionRows = listRogueRegionPresets(draft)
    .map((r) => {
      const c = regionRogueCfgMerged(r.id, draft);
      const kind = r.builtin ? 'Built-in' : 'Custom';
      return `<tr data-region="${esc(r.id)}">
            <td><strong>${esc(r.name)}</strong><div class="lvl-meta">${esc(r.id)} · ${kind} · difficulty ${r.difficulty}</div></td>
            <td>${chk('enabled', c.enabled, 'Enabled in roguelite Auto')}</td>
            <td><input type="number" min="1" max="999" data-field="fromBattle" value="${c.fromBattle}" title="First battle this preset can appear" /></td>
            <td><input type="number" min="1" max="999" data-field="toBattle" value="${c.toBattle ?? ''}" placeholder="—" title="Last battle (blank = no cap)" /></td>
            <td><input type="number" min="0" max="999" data-field="weight" value="${c.weight}" title="Relative chance when Auto picks among eligible presets" /></td>
          </tr>`;
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
      <p class="ai-editor-lead">Prices, unlocks, in-run availability, starting gold, and the goal battle. Save applies immediately in this browser (localStorage). Export a JSON file and put it in <code>public/data/roguelite.json</code> to ship the defaults. Seeded values match the previous hard-coded rules, so play does not change until you edit this. Current unlocks are on the Unlocks tab.</p>
      ${rogueEraFilterHtml(era)}

      <section class="rogue-admin-section" id="rogue-sec-globals">
        <h3>Run settings</h3>
        <div class="rogue-globals">
          <label>Starting gold <input type="number" min="0" max="9999" data-global="startGold" value="${g.startGold}" /></label>
          <label>Goal battles (end level) <input type="number" min="1" max="999" data-global="goalBattles" value="${g.goalBattles}" /></label>
          <label>Starting unit count <input type="number" min="1" max="16" data-global="startCount" value="${g.startCount}" /></label>
          <label>Shop size <input type="number" min="1" max="12" data-global="shopSize" value="${g.shopSize}" /></label>
          <label>Promo cost (after first) <input type="number" min="0" max="99" data-global="promoCost" value="${g.promoCost}" /></label>
          <label class="chk"><input type="checkbox" data-global-flag="firstPromoFree"${g.firstPromoFree ? ' checked' : ''} /> First promo free</label>
          <label>Enemy promos from battle <input type="number" min="1" max="999" data-global="enemyPromoStart" value="${g.enemyPromoStart}" /></label>
          <label>Scout regenerates each <input type="number" min="0" max="20" data-global="scoutRegenPer" value="${g.scoutRegenPer}" /></label>
          <label>Wealthy gold each <input type="number" min="0" max="20" data-global="wealthyGoldPer" value="${g.wealthyGoldPer}" /></label>
          <label>Gold per star <input type="number" min="0" max="20" data-global="starGoldPerStar" value="${g.starGoldPerStar}" /></label>
          <label class="chk"><input type="checkbox" data-global-flag="endlessAfterGoal"${g.endlessAfterGoal ? ' checked' : ''} /> Endless after the goal</label>
        </div>
      </section>

      <section class="rogue-admin-section" id="rogue-sec-regions">
        <h3>Regions <span class="lvl-meta">Map-generation presets. Auto picks an enabled preset in the from/to range, weighted. Seeded to match the previous difficulty tiers (1–3: Village &amp; Long grass; 4–7: those plus Dense forest, Marshland, Highlands; 8+: plus Fortified ridge &amp; Badlands). Open field stays off. “Region cleared” unlocks refer to these preset ids.</span></h3>
        <div class="ai-check-wrap rogue-table-wrap">
          <table class="ai-check rogue-table rogue-regions">
            <thead><tr><th>Preset</th><th>Enabled</th><th>From</th><th>To</th><th>Weight</th></tr></thead>
            <tbody>${regionRows}</tbody>
          </table>
        </div>
      </section>

      ${unitTables}

      <section class="rogue-admin-section" id="rogue-sec-promos">
        <h3>Promotions</h3>
        <div class="ai-check-wrap rogue-table-wrap">
          <table class="ai-check rogue-table">
            <thead>
              <tr>
                <th></th><th>Promotion</th><th>Used</th><th>From battle</th>
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

export function renderRogueUnlocksPage(): string {
  const era = getRogueAdminEra();
  const progress = getRogueProgress();
  const battle = Math.max(1, progress.bestBattle);
  const groups = unitsGroupedLikeEditor(era);
  const unitBlocks = groups.length
    ? groups
        .map((group) => {
          const items = group.types
            .map((t) => {
              const c = unitRogueCfg(t);
              if (!c.used) return '';
              const unlocked = unlockSatisfied(c.unlock, progress, battle);
              const cls = ['rogue-ov-item', unlocked ? '' : 'locked'].filter(Boolean).join(' ');
              const conds = describeUnlock(c.unlock, progress, battle);
              const why = unlocked
                ? `Unlocked · from battle ${c.fromBattle}${c.toBattle ? `–${c.toBattle}` : ''} · ${c.price ?? UNIT_STATS[t]?.value ?? 0}g`
                : conds.length
                  ? conds.map((d) => d.text).join(' · ')
                  : 'Not yet unlocked';
              const detail = !unlocked && conds.length
                ? `<span class="rogue-ov-why">${conds.map((d) => esc(d.text)).join('<br>')}</span>`
                : '';
              return `<div class="${cls}" title="${esc(`${UNIT_STATS[t]?.name ?? t}: ${why}`)}">
          ${unitIcon(t)}
          <span>${esc(UNIT_STATS[t]?.name ?? t)}${detail}</span>
        </div>`;
            })
            .join('');
          if (!items) return '';
          return `<div class="rogue-ov-group unit-class-group"><h3 class="unit-class-label">${esc(group.label)}</h3><div class="rogue-ov-grid">${items}</div></div>`;
        })
        .join('')
    : `<p class="editor-empty">No ${esc(UNIT_CATEGORY_LABEL[era])} units.</p>`;

  const ovPromos = PROMOTION_TOKEN_TYPES.map((id) => {
    const c = promoRogueCfg(id);
    if (!c.used) return '';
    const unlocked = unlockSatisfied(c.unlock, progress, battle);
    const cls = ['rogue-ov-item', unlocked ? '' : 'locked'].filter(Boolean).join(' ');
    const conds = describeUnlock(c.unlock, progress, battle);
    const why = unlocked ? 'Unlocked' : conds.length ? conds.map((d) => d.text).join(' · ') : 'Not yet unlocked';
    const detail = !unlocked && conds.length
      ? `<span class="rogue-ov-why">${conds.map((d) => esc(d.text)).join('<br>')}</span>`
      : '';
    return `<div class="${cls}" title="${esc(`${UNIT_TOKEN_LABEL[id]}: ${why}`)}">
      ${promoIcon(id)}
      <span>${esc(UNIT_TOKEN_LABEL[id])}${detail}</span>
    </div>`;
  }).join('');

  return `
    <div class="rogue-admin" id="rogue-unlocks">
      <div class="ai-editor-head rogue-admin-head">
        <h2>Unlocks</h2>
        <span class="lvl-meta">${progress.runsCompleted} run${progress.runsCompleted === 1 ? '' : 's'} completed · best battle ${progress.bestBattle}</span>
      </div>
      <p class="ai-editor-lead">Current unlockable state for this browser. Only units and promotions marked Used appear here; greyed items show the remaining condition and progress. Promotions are shown for every era.</p>
      ${rogueEraFilterHtml(era)}
      ${unitBlocks}
      <div class="rogue-ov-group"><h3 class="unit-class-label">Promotions</h3><div class="rogue-ov-grid">${ovPromos}</div></div>
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

function regionRogueCfgMerged(id: string, draft: RogueConfig): RogueRegionCfg {
  return regionRogueCfg(id, draft);
}

function readOneCondition(row: Element): RogueUnlockCondition {
  const type = (row.querySelector<HTMLSelectElement>('[data-unlock-type]')?.value ?? 'always') as RogueUnlockType;
  const num = (key: string, fallback: number) => {
    const el = row.querySelector<HTMLInputElement>(`[data-unlock-param="${key}"]`);
    const n = Number(el?.value);
    return Number.isFinite(n) ? n : fallback;
  };
  const typ = row.querySelector<HTMLSelectElement>('[data-unlock-param="unitType"]')?.value ?? '';
  if (type === 'playGames') return { type, count: num('count', 1) };
  if (type === 'reachBattle' || type === 'reachBattleNoLoss') return { type, battle: num('battle', 1) };
  if (type === 'killUnits') return { type, count: num('count', 1), unitType: typ || null };
  if (type === 'haveCoins') return { type, count: num('count', 1) };
  if (type === 'winWithUnits') return { type, count: num('count', 1), unitType: typ };
  if (type === 'never') return { type: 'never' };
  return { type: 'always' };
}

function readUnlock(scope: Element, name: string): RogueUnlock {
  const root = scope.querySelector(`[data-unlock-scope="${CSS.escape(name)}"]`);
  if (!root) return sanitizeUnlock({ type: 'always' });
  const rows = [...root.querySelectorAll<HTMLElement>('[data-unlock-index]')];
  return sanitizeUnlock(rows.map(readOneCondition));
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
  const g = getRogueConfig().globals;
  const globals = {
    startGold: num('startGold', g.startGold),
    goalBattles: num('goalBattles', g.goalBattles),
    startCount: num('startCount', g.startCount),
    shopSize: num('shopSize', g.shopSize),
    promoCost: num('promoCost', g.promoCost),
    firstPromoFree: flag('firstPromoFree'),
    enemyPromoStart: num('enemyPromoStart', g.enemyPromoStart),
    scoutRegenPer: num('scoutRegenPer', g.scoutRegenPer),
    wealthyGoldPer: num('wealthyGoldPer', g.wealthyGoldPer),
    starGoldPerStar: num('starGoldPerStar', g.starGoldPerStar),
    endlessAfterGoal: flag('endlessAfterGoal'),
  };

  const units: Record<string, Partial<RogueUnitCfg>> = {};
  root.querySelectorAll<HTMLTableRowElement>('tr[data-unit]').forEach((tr) => {
    const id = tr.dataset.unit;
    if (!id) return;
    const flagOf = (n: string) => !!tr.querySelector<HTMLInputElement>(`[data-flag="${n}"]`)?.checked;
    units[id] = {
      used: flagOf('used'),
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
      used: flagOf('used'),
      fromBattle: Number(tr.querySelector<HTMLInputElement>('[data-field="fromBattle"]')?.value) || 1,
      unlock: readUnlock(tr, `p:${id}`),
      inShop: flagOf('inShop'),
      enemyAllowed: flagOf('enemyAllowed'),
    };
  });

  const regions: Record<string, Partial<RogueRegionCfg>> = { ...getRogueConfig().regions };
  root.querySelectorAll<HTMLTableRowElement>('tr[data-region]').forEach((tr) => {
    const id = tr.dataset.region;
    if (!id) return;
    const flagOf = (n: string) => !!tr.querySelector<HTMLInputElement>(`[data-flag="${n}"]`)?.checked;
    regions[id] = {
      enabled: flagOf('enabled'),
      fromBattle: Number(tr.querySelector<HTMLInputElement>('[data-field="fromBattle"]')?.value) || 1,
      toBattle: numOrNull(tr.querySelector<HTMLInputElement>('[data-field="toBattle"]')?.value ?? ''),
      weight: Number(tr.querySelector<HTMLInputElement>('[data-field="weight"]')?.value),
    };
  });

  return { version: 1, globals, units, promotions, regions };
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
