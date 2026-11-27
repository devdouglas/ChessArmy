/**
 * Roguelite unlock conditions: migrate old kinds, AND-all arrays, progress checks.
 */
import {
  conditionSatisfied,
  describeUnlock,
  sanitizeRogueProgress,
  sanitizeUnlock,
  unlockBattleParamMax,
  unlockConditionLabel,
  unlockSatisfied,
  type RogueUnlockCondition,
} from '../src/roguelite-config';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const battleAtLeast = sanitizeUnlock({ type: 'battleAtLeast', battle: 4 });
assert(
  battleAtLeast.length === 1 &&
    battleAtLeast[0]!.type === 'reachBattle' &&
    battleAtLeast[0]!.type === 'reachBattle' &&
    (battleAtLeast[0] as { battle: number }).battle === 4,
  'battleAtLeast -> reachBattle',
);

const runs = sanitizeUnlock({ type: 'runsCompleted', count: 3 });
assert(
  runs.length === 1 &&
    runs[0]!.type === 'playGames' &&
    (runs[0] as { count: number }).count === 3,
  'runsCompleted -> playGames',
);

const dropped = sanitizeUnlock({ type: 'regionCleared', regionId: 'rome' });
assert(dropped.length === 1 && dropped[0]!.type === 'always', 'regionCleared -> always');

assert(sanitizeUnlock({ type: 'always' })[0]!.type === 'always', 'always object');
assert(sanitizeUnlock([{ type: 'always' }])[0]!.type === 'always', 'always array');

const both = sanitizeUnlock([
  { type: 'playGames', count: 2 },
  { type: 'reachBattle', battle: 5 },
]);
const short = sanitizeRogueProgress({ gamesPlayed: 2, bestBattle: 4 });
assert(!unlockSatisfied(both, short, 1), 'AND still short of reachBattle');
const ready = sanitizeRogueProgress({ gamesPlayed: 2, bestBattle: 5 });
assert(unlockSatisfied(both, ready, 1), 'AND met');

const midRun = sanitizeRogueProgress({ gamesPlayed: 2, bestBattle: 1 });
assert(unlockSatisfied(both, midRun, 5), 'reachBattle uses current battle too');

const stats = sanitizeRogueProgress({
  kills: { soldier: 3, archer: 1 },
  maxCoins: 8,
  bestNoLossBattle: 4,
  winsWith: { cavalry: 2 },
  gamesPlayed: 1,
});
const killAny: RogueUnlockCondition = { type: 'killUnits', count: 4, unitType: null };
const killSoldiers: RogueUnlockCondition = { type: 'killUnits', count: 4, unitType: 'soldier' };
assert(conditionSatisfied(killAny, stats), 'kill 4 of any');
assert(!conditionSatisfied(killSoldiers, stats), 'kill 4 soldiers not yet');
assert(conditionSatisfied({ type: 'haveCoins', count: 8 }, stats), 'have 8 coins');
assert(conditionSatisfied({ type: 'reachBattleNoLoss', battle: 4 }, stats), 'no-loss 4');
assert(
  conditionSatisfied({ type: 'winWithUnits', count: 2, unitType: 'cavalry' }, stats),
  'win with 2 cavalry',
);
assert(!conditionSatisfied({ type: 'never' }, stats), 'never');

const migrated = sanitizeRogueProgress({ runsCompleted: 3 });
assert(migrated.gamesPlayed === 3, 'gamesPlayed migrates from runsCompleted');
assert(migrated.runsCompleted === 3, 'runsCompleted kept');

const desc = describeUnlock(both, short, 1);
assert(
  desc.some((d) => d.type === 'playGames' && d.label === 'Play 2 games' && d.text === '2/2 games'),
  `playGames copy, got ${desc.map((d) => `${d.label} / ${d.text}`).join(' | ')}`,
);
assert(
  desc.some((d) => d.type === 'reachBattle' && d.label === 'Reach battle 5' && d.text === '4/5 battles'),
  `reachBattle copy, got ${desc.map((d) => `${d.label} / ${d.text}`).join(' | ')}`,
);

// Non-default X values must appear in labels and progress, not a hard-coded 1.
const play7 = sanitizeUnlock({ type: 'playGames', count: 7 });
assert((play7[0] as { count: number }).count === 7, 'playGames keeps 7');
const play7d = describeUnlock(play7, sanitizeRogueProgress({ gamesPlayed: 3 }), 1);
assert(
  play7d[0]?.label === 'Play 7 games' && play7d[0]?.text === '3/7 games',
  `play 7 games copy, got ${play7d.map((d) => `${d.label} / ${d.text}`).join(' | ')}`,
);
const reach6 = describeUnlock(
  [{ type: 'reachBattle', battle: 6 }],
  sanitizeRogueProgress({ bestBattle: 2 }),
  1,
);
assert(
  reach6[0]?.label === 'Reach battle 6' && reach6[0]?.text === '2/6 battles',
  `reach battle 6 copy, got ${reach6.map((d) => `${d.label} / ${d.text}`).join(' | ')}`,
);
assert(unlockBattleParamMax({ goalBattles: 10, endlessAfterGoal: false }) === 10, 'battle max = goal');
assert(unlockBattleParamMax({ goalBattles: 10, endlessAfterGoal: true }) === 999, 'battle max free when endless');

const kill5el = sanitizeUnlock({ type: 'killUnits', count: 5, unitType: 'elephant' });
assert(
  kill5el[0]!.type === 'killUnits' &&
    (kill5el[0] as { count: number; unitType: string }).count === 5 &&
    (kill5el[0] as { unitType: string }).unitType === 'elephant',
  'killUnits keeps count 5 and elephant',
);
assert(
  unlockConditionLabel(kill5el[0]!) === 'Kill 5 Elephant',
  `killUnits label, got ${unlockConditionLabel(kill5el[0]!)}`,
);
const kill5d = describeUnlock(kill5el, sanitizeRogueProgress({ kills: { elephant: 2 } }), 1);
assert(
  kill5d[0]?.label === 'Kill 5 Elephant' && kill5d[0]?.text === '2/5 Elephant',
  `kill 5 Elephant progress, got ${kill5d.map((d) => `${d.label} / ${d.text}`).join(' | ')}`,
);

const kill5any = sanitizeUnlock({ type: 'killUnits', count: 5, unitType: '' });
assert(
  kill5any[0]!.type === 'killUnits' &&
    (kill5any[0] as { unitType: string | null }).unitType === null &&
    (kill5any[0] as { count: number }).count === 5,
  'empty killUnits type stays any-unit',
);
assert(
  unlockConditionLabel(kill5any[0]!) === 'Kill 5 units',
  `any-unit label, got ${unlockConditionLabel(kill5any[0]!)}`,
);
const kill5anyd = describeUnlock(
  kill5any,
  sanitizeRogueProgress({ kills: { elephant: 2, soldier: 1 } }),
  1,
);
assert(
  kill5anyd[0]?.label === 'Kill 5 units' && kill5anyd[0]?.text === '3/5 units',
  `any-unit progress uses total kills, got ${kill5anyd.map((d) => `${d.label} / ${d.text}`).join(' | ')}`,
);
assert(!conditionSatisfied(kill5any[0]!, sanitizeRogueProgress({ kills: { elephant: 2, soldier: 1 } })), '3/5 not yet');
assert(
  conditionSatisfied(kill5any[0]!, sanitizeRogueProgress({ kills: { elephant: 2, soldier: 3 } })),
  'total kills 5 meets any-unit',
);

const win3 = sanitizeUnlock({ type: 'winWithUnits', count: 3, unitType: 'elephant' });
assert((win3[0] as { count: number }).count === 3, 'winWithUnits keeps 3');
assert(
  unlockConditionLabel(win3[0]!) === 'Win a battle with 3 Elephant',
  `winWithUnits label, got ${unlockConditionLabel(win3[0]!)}`,
);
const win3d = describeUnlock(win3, sanitizeRogueProgress({ winsWith: { elephant: 1 } }), 1);
assert(
  win3d[0]?.label === 'Win a battle with 3 Elephant' && win3d[0]?.text === '1/3 Elephant',
  `win 3 Elephant progress, got ${win3d.map((d) => `${d.label} / ${d.text}`).join(' | ')}`,
);

const break8 = sanitizeUnlock({ type: 'breakObstacles', count: 8, obstacleType: 'palisade' });
assert((break8[0] as { count: number }).count === 8, 'breakObstacles keeps 8');
assert(
  unlockConditionLabel(break8[0]!) === 'Break 8 Palisade',
  `breakObstacles label, got ${unlockConditionLabel(break8[0]!)}`,
);

const broke = sanitizeRogueProgress({
  broken: { palisade: 2, tree: 1, forest: 1 },
});
assert(
  conditionSatisfied({ type: 'breakObstacles', count: 4, obstacleType: null }, broke),
  'break 4 of any',
);
assert(
  conditionSatisfied({ type: 'breakObstacles', count: 2, obstacleType: 'palisade' }, broke),
  'break 2 palisades',
);
assert(
  !conditionSatisfied({ type: 'breakObstacles', count: 3, obstacleType: 'palisade' }, broke),
  'break 3 palisades not yet',
);
const unknown = sanitizeUnlock({ type: 'breakObstacles', count: 2, obstacleType: 'banana' });
assert(
  unknown[0]!.type === 'breakObstacles' &&
    (unknown[0] as { obstacleType: string | null }).obstacleType === null,
  'unknown obstacle type becomes any',
);
const breakText = describeUnlock(
  [{ type: 'breakObstacles', count: 5, obstacleType: 'tree' }],
  broke,
  1,
);
assert(
  breakText.some(
    (d) =>
      d.type === 'breakObstacles' &&
      d.label === 'Break 5 Tree' &&
      d.text.includes('1/5'),
  ),
  `breakObstacles copy, got ${breakText.map((d) => `${d.label} / ${d.text}`).join(' | ')}`,
);

console.log('repro-rogue-unlocks: ok');
