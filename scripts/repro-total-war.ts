import { createMatch, makeStack } from '../src/campaign/match';
import {
  applyUpkeepLoss,
  buildSeaAdjacency,
  collectTaxes,
  isRegionSupplied,
  legalMovesForStack,
  moveStack,
  packArmiesInRegion,
  recruit,
  resolveInvasionChoice,
  testMap,
  toggleSupplyGrant,
  armyNeedsUpkeepPayment,
} from '../src/campaign/rules';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const map = testMap();
const sea = buildSeaAdjacency(map);

// --- setup ---
{
  const m = createMatch(map, ['rome']);
  assert(m.seats.length === 1 && m.seats[0].coins === 1, 'start with 1 coin');
  const romeCap = m.stacks.find((s) => s.regionId === 'a' && s.factionId === 'rome');
  const romeVil = m.stacks.find((s) => s.regionId === 'b' && s.factionId === 'rome');
  assert(romeCap?.units === 1 && romeVil?.units === 1, 'units on capital + village');
  const barbCap = m.stacks.find((s) => s.regionId === 'c' && s.factionId === 'barbarians');
  assert(barbCap?.units === 1, 'unpicked capital becomes barbarian');
  assert(m.regionOwners['c'] === 'barbarians', 'barbarian owns unpicked capital');
  assert(!m.stacks.some((s) => s.regionId === 'd'), 'no units on barbarian villages at setup');
}

// --- capital cannot empty ---
{
  let m = createMatch(map, ['rome', 'spain']);
  // spain has no regions on test map — only rome + gaule capitals matter
  m = createMatch(map, ['rome']);
  const capStack = m.stacks.find((s) => s.regionId === 'a')!;
  // Recruit so we can try to move the only garrison... still 1 unit on capital
  let threw = false;
  try {
    // force phase move
    assert(m.phase.kind === 'play', 'play');
    m.phase.phase = 'move';
    moveStack(m, map, sea, capStack.id, 'b');
  } catch {
    threw = true;
  }
  assert(threw, 'capital cannot be left empty');
}

// --- supply through ally grant ---
{
  let m = createMatch(map, ['rome', 'gaule']);
  // Put a gaule unit on b (between rome capital a and ...)
  // Rome occupies a+b. Grant gaule→rome so rome can path through gaule lands.
  // Place rome army on d (gaule village) without own path — only via gaule c.
  m.stacks = m.stacks.filter((s) => s.factionId === 'rome' || s.regionId === 'c');
  m.stacks.push(
    makeStack(m, { factionId: 'rome', regionId: 'a', units: 1, kind: 'loose' }),
  );
  // gaule still has capital c. Put rome stack on b connected via... need chain a-b with rome, then grant from gaule for c-d
  m.stacks.push(
    makeStack(m, { factionId: 'gaule', regionId: 'c', units: 1, kind: 'loose' }),
  );
  m.stacks.push(
    makeStack(m, { factionId: 'rome', regionId: 'd', units: 3, kind: 'army', armySize: 3 }),
  );
  m.regionOwners['a'] = 'rome';
  m.regionOwners['c'] = 'gaule';
  // Without grant: d not supplied (rome not on c)
  assert(!isRegionSupplied(m, map, sea, 'rome', 'd'), 'd unsupplied without grant');
  // Put rome on b and grant gaule supplies rome through c
  m.stacks.push(
    makeStack(m, { factionId: 'rome', regionId: 'b', units: 1, kind: 'loose' }),
  );
  m = toggleSupplyGrant(m, 'gaule', 'rome');
  // Path: d -c(gaule grant)- b(rome) - a(rome capital)
  assert(isRegionSupplied(m, map, sea, 'rome', 'd'), 'supply via ally grant');
  m = toggleSupplyGrant(m, 'gaule', 'rome');
  assert(!isRegionSupplied(m, map, sea, 'rome', 'd'), 'grant revoked');
}

// --- red route: paid unless both shores owned ---
{
  let m = createMatch(map, ['rome']);
  assert(m.phase.kind === 'play', 'play');
  m.phase.phase = 'move';
  // Army on a, move to c via red sea
  m.stacks = [
    makeStack(m, { factionId: 'rome', regionId: 'a', units: 3, kind: 'army', armySize: 3 }),
    makeStack(m, { factionId: 'rome', regionId: 'b', units: 1, kind: 'loose' }), // keep capital? a is capital — need leave 1
  ];
  // Actually capital a must keep 1 — army of 3 leaving empties. Put garrison:
  m.stacks = [
    makeStack(m, { factionId: 'rome', regionId: 'a', units: 1, kind: 'loose' }),
    makeStack(m, {
      factionId: 'rome',
      regionId: 'a',
      units: 3,
      kind: 'army',
      armySize: 3,
    }),
  ];
  m.seats[0].tokens.small -= 1;
  m.seats[0].coins = 2;
  m.regionOwners['a'] = 'rome';
  m.regionOwners['c'] = 'barbarians';
  const army = m.stacks.find((s) => s.kind === 'army')!;
  const moves = legalMovesForStack(m, map, sea, army.id);
  const seaMove = moves.find((x) => x.regionId === 'c' && x.via === 'sea');
  assert(seaMove?.coinCost === 1, 'red crossing costs 1');
  m = moveStack(m, map, sea, army.id, 'c');
  assert(m.seats[0].coins === 1, 'paid red crossing');

  // Own both shores → free
  m.regionOwners['c'] = 'rome';
  m.stacks.find((s) => s.id === army.id)!.moved = false;
  m.stacks.find((s) => s.id === army.id)!.regionId = 'a';
  const moves2 = legalMovesForStack(m, map, sea, army.id);
  const free = moves2.find((x) => x.regionId === 'c' && x.via === 'sea');
  assert(free?.coinCost === 0, 'owned both shores acts as blue');
}

// --- upkeep 5 → lose 3 ---
{
  let m = createMatch(map, ['rome']);
  const army = makeStack(m, {
    factionId: 'rome',
    regionId: 'island',
    units: 5,
    kind: 'army',
    armySize: 5,
  });
  m.stacks.push(army);
  m.seats[0].tokens.medium -= 1;
  m = applyUpkeepLoss(m, army.id);
  const left = m.stacks.find((s) => s.regionId === 'island');
  assert(left?.units === 2, `upkeep 5 loses 3 → 2 left, got ${left?.units}`);
}

// --- barbarian capture + uprising ---
{
  let m = createMatch(map, ['rome']);
  assert(m.phase.kind === 'play', 'play');
  // Army invades barb capital c; village d should rebel
  m.stacks.push(
    makeStack(m, {
      factionId: 'rome',
      regionId: 'b',
      units: 3,
      kind: 'army',
      armySize: 3,
    }),
  );
  m.seats[0].tokens.small -= 1;
  m.phase.phase = 'move';
  const army = m.stacks.find((s) => s.kind === 'army' && s.regionId === 'b')!;
  m = moveStack(m, map, sea, army.id, 'c');
  const inv = m.pendingInvasions[0];
  assert(inv, 'invasion queued');
  m = resolveInvasionChoice(m, map, sea, inv.id, 'auto')!;
  assert(m.regionOwners['c'] === 'rome', 'captured barb capital');
  assert(m.seats[0].coins >= 2, 'gain coin from barb capital');
  const rebel = m.stacks.find((s) => s.rebelOf === 'gaule' && s.regionId === 'd');
  assert(rebel?.units === 1, 'uprising rebel on gaule village');
}

// --- army prompt at 6 units ---
{
  let m = createMatch(map, ['rome']);
  m.stacks = m.stacks.filter((s) => s.regionId === 'a');
  // 6 loose units on b
  m.stacks.push(
    makeStack(m, { factionId: 'rome', regionId: 'b', units: 6, kind: 'loose' }),
  );
  m = packArmiesInRegion(m, map, 'b', 'rome');
  assert(m.armyPrompt?.units === 6, 'prompt for upgrade vs separate');
  m = packArmiesInRegion(m, map, 'b', 'rome', 'separate');
  const armies = m.stacks.filter((s) => s.regionId === 'b' && s.kind === 'army');
  assert(armies.length === 2 && armies.every((a) => a.armySize === 3), 'two smalls');
}

// --- taxes ---
{
  let m = createMatch(map, ['rome']);
  m = collectTaxes(m, map);
  assert(m.seats[0].coins === 2, 'tax +1 for capital');
}

// --- recruit on supply ---
{
  let m = createMatch(map, ['rome']);
  assert(m.phase.kind === 'play', 'play');
  m.phase.phase = 'recruit';
  m.phase.taxesCollected = true;
  m = recruit(m, map, sea, 'a');
  const onA = m.stacks.filter((s) => s.regionId === 'a' && s.factionId === 'rome');
  const units = onA.reduce((n, s) => n + s.units, 0);
  assert(units === 2, 'recruited on capital');
  assert(m.seats[0].coins === 0, 'paid 1 for recruit');
}

// --- campaigning army needs upkeep ---
{
  const m = createMatch(map, ['rome']);
  const army = makeStack(m, {
    factionId: 'rome',
    regionId: 'island',
    units: 3,
    kind: 'army',
    armySize: 3,
  });
  m.stacks.push(army);
  m.seats[0].tokens.small -= 1;
  assert(armyNeedsUpkeepPayment(m, map, sea, army), 'island army campaigns');
}

// --- auto-retreat for 1–2 loose; capital cannot retreat ---
{
  let m = createMatch(map, ['rome', 'gaule']);
  assert(m.phase.kind === 'play', 'play');
  m.phase.phase = 'move';
  // Clear b: put 1 gaule loose there; rome army attacks from a (leave capital garrison)
  m.stacks = m.stacks.filter(
    (s) => !(s.regionId === 'b') && !(s.kind === 'army'),
  );
  if (!m.stacks.some((s) => s.regionId === 'a' && s.factionId === 'rome')) {
    m.stacks.push(
      makeStack(m, { factionId: 'rome', regionId: 'a', units: 1, kind: 'loose' }),
    );
  }
  m.stacks.push(
    makeStack(m, {
      factionId: 'rome',
      regionId: 'a',
      units: 3,
      kind: 'army',
      armySize: 3,
    }),
    makeStack(m, { factionId: 'gaule', regionId: 'b', units: 1, kind: 'loose' }),
  );
  m.seats[0].tokens.small -= 1;
  m.regionOwners['b'] = 'gaule';
  const army = m.stacks.find((s) => s.kind === 'army' && s.factionId === 'rome')!;
  m = moveStack(m, map, sea, army.id, 'b');
  const inv = m.pendingInvasions[0];
  m = resolveInvasionChoice(m, map, sea, inv.id, 'auto')!;
  assert(m.regionOwners['b'] === 'rome', 'auto-retreat cedes region');
  assert(
    m.stacks.some((s) => s.factionId === 'gaule' && s.regionId === 'c'),
    'defender fled toward capital',
  );

  // Capital: retreat choice illegal
  m = createMatch(map, ['rome', 'gaule']);
  assert(m.phase.kind === 'play', 'play');
  m.phase.phase = 'move';
  m.stacks.push(
    makeStack(m, {
      factionId: 'rome',
      regionId: 'b',
      units: 3,
      kind: 'army',
      armySize: 3,
    }),
  );
  m.seats[0].tokens.small -= 1;
  m.regionOwners['c'] = 'gaule';
  if (!m.stacks.some((s) => s.regionId === 'c' && s.factionId === 'gaule')) {
    m.stacks.push(
      makeStack(m, { factionId: 'gaule', regionId: 'c', units: 2, kind: 'loose' }),
    );
  }
  const atk = m.stacks.find((s) => s.kind === 'army' && s.factionId === 'rome')!;
  m = moveStack(m, map, sea, atk.id, 'c');
  const inv2 = m.pendingInvasions[0];
  let retreatBlocked = false;
  try {
    resolveInvasionChoice(m, map, sea, inv2.id, 'retreat');
  } catch {
    retreatBlocked = true;
  }
  assert(retreatBlocked, 'cannot retreat from capital');
}

console.log('repro-total-war: ok');
