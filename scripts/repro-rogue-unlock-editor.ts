/**
 * Roguelite admin unlock editor: type change shows count + type controls,
 * and the values survive a render / read / render round-trip.
 */
import { readFileSync } from 'node:fs';
import {
  renderRogueConfigPage,
  renderRogueUnlocksPage,
  setRogueAdminEra,
  unlockProgressPct,
  ROGUE_ADMIN_ERA_KEY,
} from '../src/roguelite-admin';
import {
  applyRogueConfig,
  sanitizeRogueConfig,
  sanitizeRogueProgress,
  sanitizeUnlock,
  setRogueProgress,
  type RogueConfig,
} from '../src/roguelite-config';
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

assert(unlockProgressPct({ type: 'playGames', current: 3, target: 5, done: false }) === 60, '3/5 is 60%');
assert(unlockProgressPct({ type: 'playGames', current: 8, target: 5, done: true }) === 100, 'met is 100%');
assert(unlockProgressPct({ type: 'always', current: 1, target: 1, done: true }) === null, 'always has no bar');

applyRogueConfig({
  ...base,
  units: {
    ...base.units,
    [unitId]: {
      ...(base.units[unitId] ?? {}),
      used: true,
      unlock: sanitizeUnlock([
        { type: 'playGames', count: 5 },
        { type: 'haveCoins', count: 10 },
      ]),
    },
  },
});
setRogueProgress(sanitizeRogueProgress({ gamesPlayed: 3, maxCoins: 10, bestBattle: 1 }));
const unlocksPage = renderRogueUnlocksPage();
assert(unlocksPage.includes('role="progressbar"'), 'progress bar present');
assert(unlocksPage.includes('3/5 games'), 'keeps 3/5 text');
assert(unlocksPage.includes('style="width: 60%"'), 'partial bar width');
assert(unlocksPage.includes('10/10 coins') && unlocksPage.includes('style="width: 100%"'), 'met condition is a full bar');


const killsWithCfg: RogueConfig = {
  ...base,
  units: {
    ...base.units,
    [unitId]: {
      ...(base.units[unitId] ?? {}),
      unlock: sanitizeUnlock({ type: 'killsWith', count: 10, unitType: 'archer' }),
    },
  },
};
row = unitRow(renderRogueConfigPage(killsWithCfg, true), unitId);
assert(row.includes('value="killsWith" selected'), 'killsWith selected');
assert(/data-unlock-param="count" value="10"/.test(row), 'killsWith count');
assert(/<option value="archer" selected>/.test(row), 'killsWith unit selected');
assert(row.includes('kills with'), 'killsWith phrase');
assert(!row.includes('>Any unit</option>') || row.includes('Choose a unit'), 'killsWith requires a type');

setRogueProgress(sanitizeRogueProgress({ killsBy: { archer: 4 } }));
applyRogueConfig(killsWithCfg);
const killsWithPage = renderRogueUnlocksPage();
assert(killsWithPage.includes('Get 10 kills with Archer'), 'unlocks label');
assert(killsWithPage.includes('4/10 kills') && killsWithPage.includes('style="width: 40%"'), 'killsWith progress bar');

console.log('repro-rogue-unlock-editor: ok');
