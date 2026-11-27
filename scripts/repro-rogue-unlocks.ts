/**
 * Roguelite unlock conditions: migrate old kinds, AND-all arrays, progress checks.
 */
import {
  conditionSatisfied,
  describeUnlock,
  sanitizeRogueProgress,
  sanitizeUnlock,
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
  desc.some((d) => d.type === 'playGames' && d.text.includes('2/2 games')),
  `playGames copy, got ${desc.map((d) => d.text).join(' | ')}`,
);
assert(
  desc.some((d) => d.type === 'reachBattle' && d.text.includes('best 4')),
  `reachBattle copy, got ${desc.map((d) => d.text).join(' | ')}`,
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
  breakText.some((d) => d.type === 'breakObstacles' && d.text.includes('1/5')),
  `breakObstacles copy, got ${breakText.map((d) => d.text).join(' | ')}`,
);

console.log('repro-rogue-unlocks: ok');
