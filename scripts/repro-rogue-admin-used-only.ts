/**
 * Roguelite admin "Used only" filter hides unused units/promos and disabled regions.
 */
import { readFileSync } from 'node:fs';
import {
  getRogueAdminUsedOnly,
  renderRogueConfigPage,
  ROGUE_ADMIN_USED_ONLY_KEY,
  setRogueAdminEra,
  setRogueAdminUsedOnly,
} from '../src/roguelite-admin';
import { sanitizeRogueConfig, type RogueConfig } from '../src/roguelite-config';
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
    [usedId]: { ...(shipped.units[usedId] ?? {}), used: true },
    [unusedId]: { ...(shipped.units[unusedId] ?? {}), used: false },
  },
  promotions: {
    ...shipped.promotions,
    general: { ...(shipped.promotions.general ?? {}), used: true },
    scout: { ...(shipped.promotions.scout ?? {}), used: false },
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
assert(html.includes('data-rogue-used-only'), 'Used only checkbox');
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

console.log('repro-rogue-admin-used-only: ok');
