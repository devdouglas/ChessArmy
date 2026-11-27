/**
 * Roguelite admin "Enabled only" filter hides unused units/promos and disabled regions.
 */
import { readFileSync } from 'node:fs';
import {
  getRogueAdminUsedOnly,
  readKeptFlag,
  renderRogueConfigPage,
  ROGUE_ADMIN_USED_ONLY_KEY,
  setRogueAdminEra,
  setRogueAdminUsedOnly,
} from '../src/roguelite-admin';
import {
  applyRogueConfig,
  promoAvailableInRun,
  sanitizeRogueConfig,
  sanitizeRogueProgress,
  unitAvailableInRun,
  type RogueConfig,
} from '../src/roguelite-config';
import { UNIT_STATS, UNIT_TYPES, type UnitCategory } from '../src/roster';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const store = new Map<string, string>();
const memoryStorage: Storage = {
  get length() {
    return store.size;
  },
  clear() {
    store.clear();
  },
  getItem(key: string) {
    return store.has(key) ? store.get(key)! : null;
  },
  key(index: number) {
    return [...store.keys()][index] ?? null;
  },
  removeItem(key: string) {
    store.delete(key);
  },
  setItem(key: string, value: string) {
    store.set(key, value);
  },
};
(globalThis as { localStorage: Storage }).localStorage = memoryStorage;

const shipped = sanitizeRogueConfig(
  JSON.parse(readFileSync('public/data/roguelite.json', 'utf8')),
) as RogueConfig;

const era = 'ancient' as UnitCategory;
const ancient = UNIT_TYPES.filter((id) => UNIT_STATS[id]?.category === era);
assert(ancient.length >= 2, 'need two ancient units');
const usedId = ancient[0]!;
const unusedId = ancient[1]!;
setRogueAdminEra(era);

const draft: RogueConfig = {
  ...shipped,
  units: {
    ...shipped.units,
    [usedId]: {
      ...(shipped.units[usedId] ?? {}),
      used: true,
      inShop: true,
      inStartPool: true,
      inEnemyPool: true,
    },
    [unusedId]: {
      ...(shipped.units[unusedId] ?? {}),
      used: false,
      inShop: true,
      inStartPool: true,
      inEnemyPool: true,
    },
  },
  promotions: {
    ...shipped.promotions,
    general: { ...(shipped.promotions.general ?? {}), used: true },
    scout: { ...(shipped.promotions.scout ?? {}), used: false, inShop: true, enemyAllowed: true },
  },
  regions: {
    ...shipped.regions,
    'builtin-open-field': { ...(shipped.regions['builtin-open-field'] ?? {}), enabled: false },
    'builtin-village': { ...(shipped.regions['builtin-village'] ?? {}), enabled: true },
  },
};

setRogueAdminUsedOnly(false);
assert(!getRogueAdminUsedOnly(), 'filter starts off');
let html = renderRogueConfigPage(draft, false);
assert(html.includes('data-rogue-used-only') && html.includes('Enabled only'), 'Enabled only checkbox');
assert(!html.includes('data-rogue-used-only checked'), 'unchecked when off');
assert(html.includes(`data-unit="${usedId}"`) && html.includes(`data-unit="${unusedId}"`), 'both units when off');
assert(html.includes('data-promo="general"') && html.includes('data-promo="scout"'), 'both promos when off');
assert(
  html.includes('data-region="builtin-open-field"') && html.includes('data-region="builtin-village"'),
  'disabled and enabled regions when off',
);

setRogueAdminUsedOnly(true);
assert(getRogueAdminUsedOnly(), 'filter on');
assert(memoryStorage.getItem(ROGUE_ADMIN_USED_ONLY_KEY) === '1', 'filter persisted');
html = renderRogueConfigPage(draft, false);
assert(html.includes('data-rogue-used-only checked') || html.includes('data-rogue-used-only" checked'), 'checked when on');
assert(html.includes(`data-unit="${usedId}"`), 'used unit stays');
assert(!html.includes(`data-unit="${unusedId}"`), 'unused unit hidden');
assert(html.includes('data-promo="general"'), 'used promo stays');
assert(!html.includes('data-promo="scout"'), 'unused promo hidden');
assert(html.includes('data-region="builtin-village"'), 'enabled region stays');
assert(!html.includes('data-region="builtin-open-field"'), 'disabled region hidden');

function checkbox(row: string, flag: string): string {
  const m = row.match(new RegExp(`<input type="checkbox" data-flag="${flag}"[^>]*>`));
  assert(m, `missing ${flag} in ${row.slice(0, 80)}`);
  return m[0];
}

function unitRowHtml(html: string, id: string): string {
  const m = html.match(new RegExp(`<tr data-unit="${id}"[\\s\\S]*?</tr>`));
  assert(m, `missing unit row ${id}`);
  return m[0];
}

setRogueAdminUsedOnly(false);
html = renderRogueConfigPage(draft, false);
const unusedRow = unitRowHtml(html, unusedId);
const usedRow = unitRowHtml(html, usedId);
assert(unusedRow.includes('class="rogue-row-off"'), 'unused row is dimmed');
for (const flag of ['inShop', 'inStartPool', 'inEnemyPool']) {
  const off = checkbox(unusedRow, flag);
  assert(off.includes('data-kept="1"'), `${flag} keeps stored on`);
  assert(off.includes('disabled'), `${flag} locked while unused`);
  assert(!/\schecked(?:\s|>)/.test(off), `${flag} looks unchecked while unused`);
  const on = checkbox(usedRow, flag);
  assert(on.includes('checked'), `${flag} shown when enabled`);
  assert(!on.includes('disabled'), `${flag} editable when enabled`);
}
const scout = html.match(/<tr data-promo="scout"[\s\S]*?<\/tr>/);
assert(scout, 'scout promo row');
const shop = checkbox(scout[0], 'inShop');
assert(shop.includes('disabled') && shop.includes('data-kept="1"') && !/\schecked(?:\s|>)/.test(shop), 'promo Shop locked');

const fake = (o: { disabled?: boolean; checked?: boolean; kept?: string }) =>
  ({ disabled: !!o.disabled, checked: !!o.checked, dataset: { kept: o.kept } }) as HTMLInputElement;
assert(readKeptFlag(fake({ disabled: true, checked: false, kept: '1' })) === true, 'kept on while locked');
assert(readKeptFlag(fake({ disabled: true, checked: false, kept: '0' })) === false, 'kept off while locked');
assert(readKeptFlag(fake({ disabled: false, checked: true, kept: '0' })) === true, 'live checked wins when unlocked');

applyRogueConfig({
  ...draft,
  units: {
    ...draft.units,
    [usedId]: {
      ...(draft.units[usedId] ?? {}),
      used: true,
      inShop: true,
      inStartPool: true,
      inEnemyPool: true,
      fromBattle: 1,
      toBattle: null,
      unlock: [{ type: 'always' }],
    },
    [unusedId]: {
      ...(draft.units[unusedId] ?? {}),
      used: false,
      inShop: true,
      inStartPool: true,
      inEnemyPool: true,
      fromBattle: 1,
      toBattle: null,
      unlock: [{ type: 'always' }],
    },
  },
  promotions: {
    ...draft.promotions,
    scout: {
      ...(draft.promotions.scout ?? {}),
      used: false,
      inShop: true,
      enemyAllowed: true,
      fromBattle: 1,
      unlock: [{ type: 'always' }],
    },
  },
});
const progress = sanitizeRogueProgress({});
assert(!unitAvailableInRun(unusedId, 1, 'shop', progress), 'unused unit ignored in shop');
assert(!unitAvailableInRun(unusedId, 1, 'start', progress), 'unused unit ignored in start');
assert(!unitAvailableInRun(unusedId, 1, 'enemy', progress), 'unused unit ignored in enemy');
assert(unitAvailableInRun(usedId, 1, 'shop', progress), 'enabled used unit still in shop');
assert(!promoAvailableInRun('scout', 1, 'shop', progress), 'unused promo ignored in shop');
assert(!promoAvailableInRun('scout', 1, 'enemy', progress), 'unused promo ignored in enemy');

console.log('repro-rogue-admin-used-only: ok');
