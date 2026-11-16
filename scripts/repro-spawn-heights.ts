import {
  climbLevelOf,
  legalHighlights,
  terrainHeight,
  type GameState,
} from '../src/engine';
import { neighbors } from '../src/hex';
import {
  createRogueInitialState,
  DEFAULT_MAP,
  settleRandomSpawnHeights,
  type ArmyStamp,
} from '../src/map';
import { createRogueRun, rogueArmyStamps } from '../src/roguelite';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function hasDownRamp(s: GameState, col: number, row: number): boolean {
  const h = terrainHeight(s.terrain[row][col]);
  if (h <= 0) return true;
  return neighbors({ col, row }, s.orientation).some((n) => {
    if (n.col < 0 || n.col >= s.cols || n.row < 0 || n.row >= s.rows) return false;
    return terrainHeight(s.terrain[n.row][n.col]) === h - 1;
  });
}

function canStepDown(s: GameState, id: string): boolean {
  const p = s.pieces.find((x) => x.id === id);
  if (!p) return false;
  const h = terrainHeight(s.terrain[p.row][p.col]);
  if (h <= 0) return true;
  return legalHighlights(s, id).some((x) => {
    if (x.kind !== 'move' && x.kind !== 'ap') return false;
    return terrainHeight(s.terrain[x.hex.row][x.hex.col]) === h - 1;
  });
}

function fatStamps(): ArmyStamp[] {
  const run = createRogueRun('ancient');
  while (run.playerArmy.length < 16) run.playerArmy.push({ type: 'tank' });
  while (run.enemyArmy.length < 16) run.enemyArmy.push({ type: 'soldier' });
  return rogueArmyStamps(run);
}

{
  // settle on a hand-built illegal placement
  const run = createRogueRun('ancient');
  run.playerArmy = [{ type: 'tank', unitTokens: ['general'] }, { type: 'tank' }];
  run.enemyArmy = [{ type: 'soldier', unitTokens: ['general'] }];
  const stamps = rogueArmyStamps(run);
  // Force mid-belt stamps onto rock / plateau.
  for (const s of stamps) {
    if (s.side === 'red') {
      s.col = 5;
      s.row = 5;
      break;
    }
  }
  const state = createRogueInitialState(
    { ...DEFAULT_MAP, highCount: 0, plateauCount: 0, rockCount: 0, waterCount: 0 },
    stamps,
  );
  // Paint mountain under the red tank after creation, then re-settle.
  const tank = state.pieces.find((p) => p.side === 'red' && p.type === 'tank')!;
  state.terrain[tank.row][tank.col] = 'rock';
  // Neighbors flat land — cliff without settle.
  assert(terrainHeight(state.terrain[tank.row][tank.col]) === 3, 'setup rock');
  settleRandomSpawnHeights(state);
  assert(
    terrainHeight(state.terrain[tank.row][tank.col]) <= climbLevelOf(tank),
    'tank spawn clamped to climb 0',
  );
  assert(
    terrainHeight(state.terrain[tank.row][tank.col]) === 0,
    'tank on land after clamp',
  );
}

{
  // Climb-2 soldier on mountain: clamp to plateau and carve ramp to land.
  const run = createRogueRun('ancient');
  run.playerArmy = [{ type: 'soldier', unitTokens: ['general'] }];
  run.enemyArmy = [{ type: 'soldier', unitTokens: ['general'] }];
  const stamps = rogueArmyStamps(run);
  const state = createRogueInitialState(
    { ...DEFAULT_MAP, highCount: 0, plateauCount: 0, rockCount: 0, waterCount: 0 },
    stamps,
  );
  const grunt = state.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
  state.terrain[grunt.row][grunt.col] = 'rock';
  for (const n of neighbors(grunt, state.orientation)) {
    if (n.col < 0 || n.col >= state.cols || n.row < 0 || n.row >= state.rows) continue;
    state.terrain[n.row][n.col] = 'land';
  }
  settleRandomSpawnHeights(state);
  const h = terrainHeight(state.terrain[grunt.row][grunt.col]);
  assert(h <= climbLevelOf(grunt), 'soldier clamped to climb');
  assert(h === 2, `soldier kept plateau when climb allows, got ${h}`);
  assert(hasDownRamp(state, grunt.col, grunt.row), 'plateau has high neighbor');
  // Follow the ramp to land.
  let cur = { col: grunt.col, row: grunt.row };
  let height = terrainHeight(state.terrain[cur.row][cur.col]);
  while (height > 0) {
    const step = neighbors(cur, state.orientation).find((n) => {
      if (n.col < 0 || n.col >= state.cols || n.row < 0 || n.row >= state.rows) return false;
      return terrainHeight(state.terrain[n.row][n.col]) === height - 1;
    });
    assert(step, `missing ramp step from height ${height}`);
    cur = step!;
    height = terrainHeight(state.terrain[cur.row][cur.col]);
  }
}

{
  let illegal = 0;
  let noRamp = 0;
  let elevated = 0;
  for (let i = 0; i < 80; i++) {
    const s = createRogueInitialState(
      { ...DEFAULT_MAP, highCount: 18, plateauCount: 14, rockCount: 12, waterCount: 8 },
      fatStamps(),
    );
    for (const p of s.pieces) {
      const t = s.terrain[p.row][p.col];
      const h = terrainHeight(t);
      if (h > 0) elevated++;
      if (h > climbLevelOf(p)) illegal++;
      if (h > 0 && !hasDownRamp(s, p.col, p.row)) noRamp++;
    }
  }
  assert(illegal === 0, `illegal spawns after settle: ${illegal}`);
  assert(noRamp === 0, `no-ramp spawns after settle: ${noRamp}`);
  assert(elevated > 0, 'expected some elevated spawns in stress run');
  console.log('stress ok', { elevated, maps: 80 });
}

{
  // Soldier on plateau can legally step onto the carved high.
  const run = createRogueRun('ancient');
  run.playerArmy = [{ type: 'soldier', unitTokens: ['general'] }];
  run.enemyArmy = [{ type: 'soldier', unitTokens: ['general'] }];
  const stamps = rogueArmyStamps(run);
  const state = createRogueInitialState(
    { ...DEFAULT_MAP, highCount: 0, plateauCount: 0, rockCount: 0, waterCount: 0 },
    stamps,
  );
  const grunt = state.pieces.find((p) => p.side === 'red' && p.type === 'soldier')!;
  state.terrain[grunt.row][grunt.col] = 'plateau';
  for (const n of neighbors(grunt, state.orientation)) {
    if (n.col < 0 || n.col >= state.cols || n.row < 0 || n.row >= state.rows) continue;
    state.terrain[n.row][n.col] = 'land';
  }
  settleRandomSpawnHeights(state);
  state.turn = grunt.side;
  assert(canStepDown(state, grunt.id), 'spawn can walk one level down');
}

console.log('repro-spawn-heights: ok');
