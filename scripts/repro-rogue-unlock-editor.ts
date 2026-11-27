/**
 * Roguelite admin unlock editor: type change shows count + type controls,
 * and the values survive a render / read / render round-trip.
 */
import { readFileSync } from 'node:fs';
import {
  renderRogueConfigPage,
  setRogueAdminEra,
  ROGUE_ADMIN_ERA_KEY,
} from '../src/roguelite-admin';
import { sanitizeRogueConfig, sanitizeUnlock, type RogueConfig } from '../src/roguelite-config';
import { UNIT_STATS, type UnitCategory } from '../src/roster';

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

function unitRow(html: string, id: string): string {
  const re = new RegExp(`<tr data-unit="${id}"[\\s\\S]*?</tr>`);
  const m = html.match(re);
  assert(m, `missing unit row ${id}`);
  return m[0];
}

function promoRow(html: string, id: string): string {
  const re = new RegExp(`<tr data-promo="${id}"[\\s\\S]*?</tr>`);
  const m = html.match(re);
  assert(m, `missing promo row ${id}`);
  return m[0];
}

const unitId = 'elephant';
const unitCat = (UNIT_STATS[unitId]?.category ?? 'ancient') as UnitCategory;
setRogueAdminEra(unitCat);
assert(memoryStorage.getItem(ROGUE_ADMIN_ERA_KEY) === unitCat, 'era persisted');

const base: RogueConfig = {
  ...shipped,
  units: {
    ...shipped.units,
    [unitId]: { ...(shipped.units[unitId] ?? {}), used: true, unlock: sanitizeUnlock({ type: 'always' }) },
  },
};

let html = renderRogueConfigPage(base, true);
let row = unitRow(html, unitId);
assert(row.includes('data-unlock-type'), 'type select present');
assert(
  !row.includes('data-unlock-param="unitType"') && !row.includes('data-unlock-param="count"'),
  'always has no count/type params',
);

const afterType: RogueConfig = {
  ...base,
  units: {
    ...base.units,
    [unitId]: {
      ...(base.units[unitId] ?? {}),
      unlock: sanitizeUnlock({ type: 'winWithUnits', count: 1, unitType: '' }),
    },
  },
};
html = renderRogueConfigPage(afterType, true);
row = unitRow(html, unitId);
assert(row.includes('value="winWithUnits" selected'), 'winWithUnits selected');
assert(/<input type="number" class="rogue-unlock-x"[^>]*data-unlock-param="count"/.test(row), 'count input');
assert(/<select data-unlock-param="unitType"/.test(row), 'unit picker');
assert(row.includes('Choose a unit'), 'unit placeholder');
assert(/<option value="elephant"/.test(row), 'used units listed');

const killAnyCfg: RogueConfig = {
  ...base,
  units: {
    ...base.units,
    [unitId]: {
      ...(base.units[unitId] ?? {}),
      unlock: sanitizeUnlock({ type: 'killUnits', count: 5, unitType: null }),
    },
  },
};
row = unitRow(renderRogueConfigPage(killAnyCfg, true), unitId);
assert(row.includes('>Any unit</option>') || row.includes('>Any unit<'), 'killUnits has Any unit');
assert(/<option value="" selected>Any unit</.test(row), 'Any unit is the default');
assert(!row.includes('Choose a unit'), 'killUnits does not use the choose placeholder');

const saved: RogueConfig = {
  ...afterType,
  units: {
    ...afterType.units,
    [unitId]: {
      ...(afterType.units[unitId] ?? {}),
      unlock: sanitizeUnlock({ type: 'winWithUnits', count: 3, unitType: 'elephant' }),
    },
  },
};
html = renderRogueConfigPage(saved, true);
row = unitRow(html, unitId);
assert(/data-unlock-param="count" value="3"/.test(row), 'count 3 survived render');
assert(/<option value="elephant" selected>/.test(row), 'Elephant selected after save');
assert(row.includes('Win a battle with'), 'winWithUnits phrase');

const killCfg: RogueConfig = {
  ...base,
  units: {
    ...base.units,
    [unitId]: {
      ...(base.units[unitId] ?? {}),
      unlock: sanitizeUnlock({ type: 'killUnits', count: 5, unitType: 'elephant' }),
    },
  },
};
row = unitRow(renderRogueConfigPage(killCfg, true), unitId);
assert(/data-unlock-param="count" value="5"/.test(row), 'killUnits count');
assert(/<select data-unlock-param="unitType"/.test(row), 'killUnits unit picker');
assert(/<option value="elephant" selected>/.test(row), 'killUnits unit selected');

const breakCfg: RogueConfig = {
  ...base,
  units: {
    ...base.units,
    [unitId]: {
      ...(base.units[unitId] ?? {}),
      unlock: sanitizeUnlock({ type: 'breakObstacles', count: 8, obstacleType: 'palisade' }),
    },
  },
};
row = unitRow(renderRogueConfigPage(breakCfg, true), unitId);
assert(/data-unlock-param="count" value="8"/.test(row), 'breakObstacles count');
assert(/<select data-unlock-param="obstacleType"/.test(row), 'breakObstacles type picker');
assert(/<option value="palisade" selected>/.test(row), 'palisade selected');

const promoId = 'general';
const promoCfg: RogueConfig = {
  ...base,
  promotions: {
    ...base.promotions,
    [promoId]: {
      ...(base.promotions[promoId] ?? {}),
      used: true,
      unlock: sanitizeUnlock({ type: 'winWithUnits', count: 2, unitType: 'elephant' }),
    },
  },
};
const prow = promoRow(renderRogueConfigPage(promoCfg, true), promoId);
assert(/data-unlock-param="count" value="2"/.test(prow), 'promo count');
assert(/<option value="elephant" selected>/.test(prow), 'promo unit selected');

console.log('repro-rogue-unlock-editor: ok');
