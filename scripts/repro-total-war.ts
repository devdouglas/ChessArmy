import { createMatch, isNeutralFaction, makeStack } from '../src/campaign/match';
import {
  advancePhase,
  applyUpkeepLoss,
  buildSeaAdjacency,
  collectTaxes,
  consolidateFactionStacks,
  factionHasArmy,
  isCampaigningArmy,
  isRegionSupplied,
  legalMovesForStack,
  moveStack,
  formArmiesEndOfTurn,
  applySiegeAttrition,
  breakSiege,
  canBreakSiege,
  canDeclareColocatedAttack,
  canSiegeBattle,
  canSiegeRegion,
  siegeToBattle,
  cullUnsuppliedLooseStacks,
  declareColocatedAttack,
  recruit,
  recruitableRegions,
  needsDepartGarrison,
  departRecruitStatus,
  retreatDestinations,
  resolveBattleDice,
  resolveInvasionChoice,
  testMap,
  toggleSupplyGrant,
  armyNeedsUpkeepPayment,
} from '../src/campaign/rules';
import {
  campaignAiStep,
  landDistance,
  needsHumanInvasionInput,
  resolveAiInvasionContacts,
  runCampaignAiTurns,
} from '../src/campaign/ai';

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
  const gauleCap = m.stacks.find((s) => s.regionId === 'c' && s.factionId === 'gaule');
  const gauleVil = m.stacks.find((s) => s.regionId === 'd' && s.factionId === 'gaule');
  assert(gauleCap?.units === 1 && gauleVil?.units === 1, 'unpicked = neutral with capital+village');
  assert(m.regionOwners['c'] === 'gaule' && m.regionOwners['d'] === 'gaule', 'neutral owns homeland');
  assert(m.log[0]?.includes('neutral'), 'start log marks neutrals');
}

// --- true barbarian villages get starting garrisons ---
{
  const base = testMap();
  const barbMap = testMap({
    regions: [
      ...base.regions,
      {
        id: 'barb-vil',
        name: 'BarbVil',
        ring: [
          { x: 50, y: 0 },
          { x: 60, y: 0 },
          { x: 60, y: 10 },
          { x: 50, y: 10 },
        ],
        ownerId: 'barbarians',
        settlement: { kind: 'village', at: { x: 55, y: 5 } },
      },
      {
        id: 'null-vil',
        name: 'NullVil',
        ring: [
          { x: 60, y: 0 },
          { x: 70, y: 0 },
          { x: 70, y: 10 },
          { x: 60, y: 10 },
        ],
        ownerId: null,
        settlement: { kind: 'village', at: { x: 65, y: 5 } },
      },
    ],
    neighbors: { ...base.neighbors, 'barb-vil': [], 'null-vil': [] },
  });
  const m = createMatch(barbMap, ['rome']);
  const barbVil = m.stacks.find((s) => s.regionId === 'barb-vil' && s.factionId === 'barbarians');
  assert(barbVil?.units === 1, 'barbarian-owned village starts with garrison');
  assert(m.regionOwners['barb-vil'] === 'barbarians', 'barbarian village stays owned');
  assert(
    !m.stacks.some((s) => s.regionId === 'null-vil'),
    'ownerless village starts empty',
  );
  assert(m.regionOwners['null-vil'] == null, 'ownerless village stays unowned');
}

// --- capital cannot empty (loose); ★ depart auto-buys 1¢ garrison ---
{
  let m = createMatch(map, ['rome']);
  const capStack = m.stacks.find((s) => s.regionId === 'a')!;
  let threw = false;
  try {
    assert(m.phase.kind === 'play', 'play');
    m.phase.phase = 'move';
    moveStack(m, map, sea, capStack.id, 'b');
  } catch {
    threw = true;
  }
  assert(threw, 'loose capital garrison cannot empty capital');

  m = createMatch(map, ['rome']);
  m.phase.phase = 'move';
  m.seats[0].coins = 2;
  // Build ★ on capital (absorb village into a)
  const vil = m.stacks.find((s) => s.regionId === 'b')!;
  vil.units = 2;
  m = moveStack(m, map, sea, vil.id, 'a', { count: 'all' });
  formArmiesEndOfTurn(m, 'rome');
  const army = m.stacks.find((s) => s.regionId === 'a' && s.kind === 'army')!;
  assert(army.units >= 3, '★ on capital');
  assert(needsDepartGarrison(m, map, army.id), 'departing ★ needs auto garrison');
  assert(departRecruitStatus(m, 'rome', undefined, 'a').ok, 'can afford garrison');

  // auto 1¢ garrison + march
  let left = moveStack(m, map, sea, army.id, 'b', { count: 'all' });
  const gar = left.stacks.find(
    (s) => s.regionId === 'a' && s.factionId === 'rome' && s.moved && s.kind === 'loose',
  );
  assert(gar?.units === 1, 'auto garrison left exhausted on capital');
  assert(left.regionOwners['a'] === 'rome', 'capital still owned');
  assert(left.seats[0].coins === 1, 'paid 1¢ for garrison');
  assert(
    left.stacks.some((s) => s.regionId === 'b' && s.factionId === 'rome' && s.moved),
    'army arrived at b',
  );

  // broke → no legal ★ depart
  m = createMatch(map, ['rome']);
  m.phase.phase = 'move';
  m.seats[0].coins = 0;
  const vil2 = m.stacks.find((s) => s.regionId === 'b')!;
  vil2.units = 2;
  m = moveStack(m, map, sea, vil2.id, 'a', { count: 'all' });
  formArmiesEndOfTurn(m, 'rome');
  const army2 = m.stacks.find((s) => s.regionId === 'a' && s.kind === 'army')!;
  assert(needsDepartGarrison(m, map, army2.id), 'still needs garrison');
  assert(
    legalMovesForStack(m, map, sea, army2.id, { count: 'all' }).length === 0,
    'broke ★ has no moves',
  );
  let brokeThrew = false;
  try {
    moveStack(m, map, sea, army2.id, 'b', { count: 'all' });
  } catch {
    brokeThrew = true;
  }
  assert(brokeThrew, 'broke ★ cannot march');

  // open land (no village) also gets auto garrison
  const openMap = testMap({
    neighbors: {
      a: ['b', 'island'],
      b: ['a', 'c'],
      c: ['b', 'd'],
      d: ['c'],
      island: ['a'],
    },
  });
  const openSea = buildSeaAdjacency(openMap);
  m = createMatch(openMap, ['rome']);
  m.phase.phase = 'move';
  m.seats[0].coins = 1;
  m.stacks = [
    makeStack(m, {
      factionId: 'rome',
      regionId: 'island',
      units: 3,
      kind: 'army',
      armySize: 3,
    }),
  ];
  m.seats[0]!.tokens.small -= 1;
  m.regionOwners['island'] = 'rome';
  const openArmy = m.stacks[0]!;
  assert(needsDepartGarrison(m, openMap, openArmy.id), 'open land needs garrison');
  left = moveStack(m, openMap, openSea, openArmy.id, 'a', { count: 'all' });
  assert(
    left.stacks.some(
      (s) => s.regionId === 'island' && s.factionId === 'rome' && s.moved && s.units === 1,
    ),
    'garrison left on open land',
  );
  assert(left.regionOwners['island'] === 'rome', 'open land still owned');
  assert(left.seats[0].coins === 0, 'paid 1¢ on open land depart');
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

// --- red route: paid unless both shores owned (direct port↔port = adjacent) ---
{
  let m = createMatch(map, ['rome']);
  assert(m.phase.kind === 'play', 'play');
  m.phase.phase = 'move';
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
  assert(
    !moves.some((x) => x.regionId === 'p1' || x.regionId === 'p2'),
    'ports are not destinations',
  );
  m = moveStack(m, map, sea, army.id, 'c');
  // toll 1 + barb capital loot 1
  assert(m.seats[0].coins === 2, 'paid red crossing (+1 barb capital)');
  assert(m.regionOwners['c'] === 'rome', 'took empty barb capital');

  // Own both shores → free
  m.stacks.find((s) => s.id === army.id)!.moved = false;
  m.stacks.find((s) => s.id === army.id)!.regionId = 'a';
  // Keep presence on c so ownership sticks for the shore check
  m.stacks.push(makeStack(m, { factionId: 'rome', regionId: 'c', units: 1, kind: 'loose' }));
  m.regionOwners['c'] = 'rome';
  m.regionOwners['a'] = 'rome';
  const moves2 = legalMovesForStack(m, map, sea, army.id);
  const free = moves2.find((x) => x.regionId === 'c' && x.via === 'sea');
  assert(free?.coinCost === 0, 'owned both shores acts as blue');
}

// --- ocean stop is a waypoint (must hop onto the dot) ---
{
  const stopMap = testMap({
    seaNodes: [
      { id: 'p1', kind: 'port', at: { x: 0, y: 0 }, regionId: 'a' },
      { id: 'mid', kind: 'stop', at: { x: 0.5, y: 0 } },
      { id: 'p2', kind: 'port', at: { x: 1, y: 0 }, regionId: 'c' },
    ],
    seaLinks: [
      { id: 'l1', kind: 'blue', a: 'p1', b: 'mid' },
      { id: 'l2', kind: 'blue', a: 'mid', b: 'p2' },
    ],
  });
  const stopSea = buildSeaAdjacency(stopMap);
  let m = createMatch(stopMap, ['rome']);
  m.phase.phase = 'move';
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
  m.regionOwners['a'] = 'rome';
  m.regionOwners['c'] = 'barbarians';
  const army = m.stacks.find((s) => s.kind === 'army')!;
  const fromA = legalMovesForStack(m, stopMap, stopSea, army.id, { count: 'all' });
  assert(fromA.some((x) => x.regionId === 'mid' && x.via === 'sea'), 'a → stop');
  assert(!fromA.some((x) => x.regionId === 'c'), 'cannot skip stop to c');
  m = moveStack(m, stopMap, stopSea, army.id, 'mid');
  assert(army.regionId === 'mid' || m.stacks.find((s) => s.id === army.id)?.regionId === 'mid', 'on stop');
  const onStop = m.stacks.find((s) => s.id === army.id)!;
  onStop.moved = false;
  const fromMid = legalMovesForStack(m, stopMap, stopSea, onStop.id, { count: 'all' });
  assert(fromMid.some((x) => x.regionId === 'c'), 'stop → c');
  assert(fromMid.some((x) => x.regionId === 'a'), 'stop → a');
  m = moveStack(m, stopMap, stopSea, onStop.id, 'c');
  assert(m.regionOwners['c'] === 'rome', 'landed from stop — barb auto-resolved');
  assert(!m.pendingInvasions.some((i) => i.regionId === 'c'), 'contact cleared');
}

// --- upkeep 5 → lose 2 (floor half) ---
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
  assert(left?.units === 3, `upkeep 5 loses 2 → 3 left, got ${left?.units}`);
  assert(left?.kind === 'army', 'still army at 3');
}

// --- true barbarian capital auto-wipe + uprising ---
{
  let m = createMatch(map, ['rome']);
  assert(m.phase.kind === 'play', 'play');
  // Replace gaule capital with true barbarians
  m.stacks = m.stacks.filter((s) => s.regionId !== 'c');
  m.stacks.push(
    makeStack(m, { factionId: 'barbarians', regionId: 'c', units: 1, kind: 'loose' }),
  );
  m.regionOwners['c'] = 'barbarians';
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
  assert(m.pendingInvasions.length === 0, 'barb capital auto on move');
  assert(m.regionOwners['c'] === 'rome', 'captured barb capital');
  assert(m.seats[0].coins >= 2, 'gain coin from barb capital');
  const rebel = m.stacks.find((s) => s.rebelOf === 'gaule' && s.regionId === 'd');
  assert(rebel?.units === 1, 'uprising rebel on gaule village');
}

// --- end of turn: 3+ stack becomes army; extras merge into army ---
{
  let m = createMatch(map, ['rome']);
  m.stacks = m.stacks.filter((s) => s.regionId === 'a');
  m.stacks.push(
    makeStack(m, { factionId: 'rome', regionId: 'b', units: 6, kind: 'loose' }),
  );
  assert(m.stacks.find((s) => s.regionId === 'b')!.kind === 'loose', 'still loose mid-turn');
  formArmiesEndOfTurn(m, 'rome');
  const army = m.stacks.find((s) => s.regionId === 'b')!;
  assert(army.kind === 'army' && army.units === 6, 'end of turn promotes 6-stack');

  m = createMatch(map, ['rome']);
  m.stacks = [
    makeStack(m, { factionId: 'rome', regionId: 'a', units: 1, kind: 'loose' }),
    makeStack(m, {
      factionId: 'rome',
      regionId: 'b',
      units: 3,
      kind: 'army',
      armySize: 3,
    }),
    makeStack(m, {
      factionId: 'rome',
      regionId: 'b',
      units: 2,
      kind: 'loose',
      moved: true,
    }),
  ];
  m.seats[0].tokens.small -= 1;
  formArmiesEndOfTurn(m, 'rome');
  const onB = m.stacks.filter((s) => s.regionId === 'b' && s.factionId === 'rome');
  assert(onB.length === 1 && onB[0].kind === 'army' && onB[0].units === 5, 'extras join army');
}

// --- taxes ---
{
  let m = createMatch(map, ['rome']);
  m = collectTaxes(m, map);
  assert(m.seats[0].coins === 2, 'tax +1 for capital');
}

// --- recruit: any owned region (not only settlements); lands in cooldown ---
{
  let m = createMatch(map, ['rome'], { aiFactionIds: ['rome'] });
  assert(m.phase.kind === 'play', 'play');
  m.phase.phase = 'move';
  m.phase.taxesCollected = true;
  const spots = recruitableRegions(m, map, sea, 'rome');
  assert(spots.includes('a'), 'own capital is recruitable');
  assert(spots.includes('b'), 'own village is recruitable');

  m = recruit(m, map, sea, 'a');
  const onA = m.stacks.filter((s) => s.regionId === 'a' && s.factionId === 'rome');
  assert(onA.some((s) => !s.moved && s.units === 1), 'capital garrison untouched');
  assert(onA.some((s) => s.moved && s.units === 1), 'recruit in capital cooldown');
  assert(m.seats[0].coins === 0, 'paid 1 for recruit');

  m.seats[0].coins = 1;
  m = recruit(m, map, sea, 'b');
  const coolB = m.stacks.filter((s) => s.regionId === 'b' && s.factionId === 'rome' && s.moved);
  const readyB = m.stacks.filter((s) => s.regionId === 'b' && s.factionId === 'rome' && !s.moved);
  assert(readyB.length === 1 && readyB[0].units === 1, 'village garrison untouched');
  assert(coolB.length === 1 && coolB[0].units === 1, 'recruit in village cooldown');

  m.seats[0].coins = 1;
  m = recruit(m, map, sea, 'b');
  const coolB2 = m.stacks.find((s) => s.regionId === 'b' && s.moved)!;
  assert(coolB2.units === 2, 'second recruit stacks cooldown');
}

// --- recruit on owned open ground (no village/capital) ---
{
  const openMap = testMap({
    regions: [
      {
        id: 'a',
        name: 'A',
        ring: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        ownerId: 'rome',
        settlement: {
          kind: 'capital',
          key: 'rome',
          at: { x: 5, y: 5 },
          units: ['infantry'],
        },
      },
      {
        id: 'open',
        name: 'Open',
        ring: [
          { x: 10, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 10 },
          { x: 10, y: 10 },
        ],
        ownerId: 'rome',
        settlement: { kind: 'none' },
      },
    ],
    neighbors: { a: ['open'], open: ['a'] },
    factions: [
      { id: 'barbarians', name: 'Barbarians', color: '#6b5b4b' },
      { id: 'rome', name: 'Rome', color: '#b71c1c' },
      { id: 'gaule', name: 'Gaule', color: '#2e7d32' },
    ],
  });
  const openSea = buildSeaAdjacency(openMap);
  let m = createMatch(openMap, ['rome']);
  m.phase.phase = 'move';
  m.seats[0].coins = 1;
  // createMatch leaves open empty (no settlement garrison) — put a presence
  m.stacks.push(
    makeStack(m, { factionId: 'rome', regionId: 'open', units: 1, kind: 'loose' }),
  );
  m.regionOwners['open'] = 'rome';
  assert(recruitableRegions(m, openMap, openSea, 'rome').includes('open'), 'owned open recruitable');
  m = recruit(m, openMap, openSea, 'open');
  assert(
    m.stacks.some((s) => s.regionId === 'open' && s.moved && s.units === 1),
    'recruit lands on open owned land',
  );
}

// --- 3+ stays loose until end of turn; skip upkeep/invasions ---
{
  let m = createMatch(map, ['rome'], { aiFactionIds: ['rome'] });
  assert(!factionHasArmy(m, 'rome'), 'start with no army');
  assert(m.phase.kind === 'play', 'play');
  m.phase.phase = 'move';
  m.phase.taxesCollected = true;
  m.seats[0].coins = 2;
  m = recruit(m, map, sea, 'b');
  m = recruit(m, map, sea, 'b');
  formArmiesEndOfTurn(m, 'rome');
  const onB = m.stacks.filter((s) => s.regionId === 'b' && s.factionId === 'rome');
  assert(onB.length === 1 && onB[0].units === 3 && onB[0].kind === 'army', 'EOT merges → army');
  assert(factionHasArmy(m, 'rome'), 'has army');

  // Empty upkeep auto-skips into move
  m = createMatch(map, ['rome']);
  assert(m.phase.kind === 'play', 'play');
  m.phase.phase = 'taxes';
  m.phase.taxesCollected = true;
  m = advancePhase(m, map, sea);
  assert(m.phase.kind === 'play' && m.phase.phase === 'move', 'taxes → upkeep skip → move');

  // No invasions → armies auto → next turn taxes
  m.phase.phase = 'move';
  m = advancePhase(m, map, sea);
  assert(m.phase.kind === 'play' && m.phase.phase === 'taxes', 'skipped invasions+armies to next turn');

  // Campaigning army flagged
  m = createMatch(map, ['rome']);
  const army = makeStack(m, {
    factionId: 'rome',
    regionId: 'island',
    units: 3,
    kind: 'army',
    armySize: 3,
  });
  m.stacks.push(army);
  m.seats[0].tokens.small -= 1;
  assert(isCampaigningArmy(m, map, sea, army), 'island army needs upkeep warn');
}

// --- recruit unowned adjacent if capital-linked; not into detached ---
{
  let m = createMatch(map, ['rome'], { aiFactionIds: ['rome'] });
  assert(m.phase.kind === 'play', 'play');
  m.phase.phase = 'move';
  m.seats[0].coins = 2;
  const allowed = recruitableRegions(m, map, sea, 'rome');
  assert(allowed.includes('b'), 'own village');
  assert(allowed.includes('a'), 'own capital');
  // Vacate b, then recruit back onto it (unowned adjacent to capital a)
  const vil = m.stacks.find((s) => s.regionId === 'b' && s.factionId === 'rome')!;
  m = moveStack(m, map, sea, vil.id, 'a', { count: 'all' });
  assert(m.regionOwners['b'] == null, 'b vacated');
  const afterVacate = recruitableRegions(m, map, sea, 'rome');
  assert(afterVacate.includes('b'), 'can recruit adjacent empty linked to capital');
  m = recruit(m, map, sea, 'b');
  assert(m.regionOwners['b'] === 'rome', 'claims adjacent');
  assert(
    m.stacks.some((s) => s.regionId === 'b' && s.moved && s.units === 1),
    'adjacent recruit in cooldown',
  );
  assert(!recruitableRegions(m, map, sea, 'rome').includes('island'), 'no detached island');
}

// --- recruit does not chain off cooldown-only regions ---
{
  const chainMap = testMap({
    regions: [
      {
        id: 'a',
        name: 'A',
        ring: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        ownerId: 'rome',
        settlement: {
          kind: 'capital',
          key: 'rome',
          at: { x: 5, y: 5 },
          units: ['infantry'],
        },
      },
      {
        id: 'b',
        name: 'B',
        ring: [
          { x: 10, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 10 },
          { x: 10, y: 10 },
        ],
        ownerId: null,
        settlement: { kind: 'village', at: { x: 15, y: 5 } },
      },
      {
        id: 'c',
        name: 'C',
        ring: [
          { x: 20, y: 0 },
          { x: 30, y: 0 },
          { x: 30, y: 10 },
          { x: 20, y: 10 },
        ],
        ownerId: null,
        settlement: { kind: 'none' },
      },
    ],
    neighbors: { a: ['b'], b: ['a', 'c'], c: ['b'] },
    factions: [
      { id: 'barbarians', name: 'Barbarians', color: '#6b5b4b' },
      { id: 'rome', name: 'Rome', color: '#b71c1c' },
      { id: 'gaule', name: 'Gaule', color: '#2e7d32' },
    ],
  });
  const chainSea = buildSeaAdjacency(chainMap);
  let m = createMatch(chainMap, ['rome']);
  m.phase.phase = 'move';
  m.seats[0].coins = 3;
  m.stacks = [
    makeStack(m, { factionId: 'rome', regionId: 'a', units: 1, kind: 'loose' }),
    makeStack(m, {
      factionId: 'rome',
      regionId: 'a',
      units: 3,
      kind: 'army',
      armySize: 3,
      moved: true,
    }),
  ];
  m.regionOwners = { a: 'rome', b: null, c: null };

  assert(recruitableRegions(m, chainMap, chainSea, 'rome').includes('b'), 'ready seeds claim');
  m = recruit(m, chainMap, chainSea, 'b');
  assert(
    m.stacks.some((s) => s.regionId === 'b' && s.moved && s.units === 1),
    'claim unit lands resting',
  );
  // b is now owned village with only cooldown → reinforce ok; c not seeded
  const after = recruitableRegions(m, chainMap, chainSea, 'rome');
  assert(after.includes('b'), 'own village still recruitable');
  assert(!after.includes('c'), 'no chain claim from cooldown-only b');

  m.stacks = [
    makeStack(m, {
      factionId: 'rome',
      regionId: 'a',
      units: 3,
      kind: 'army',
      armySize: 3,
      moved: true,
    }),
  ];
  m.regionOwners = { a: 'rome', b: null, c: null };
  const restingOnly = recruitableRegions(m, chainMap, chainSea, 'rome');
  assert(restingOnly.includes('a'), 'own capital still recruitable while resting');
  assert(!restingOnly.includes('b') && !restingOnly.includes('c'), 'resting-only does not seed claims');
}

// --- peel 1 unit / whole stack / once per turn; movers join cooldown ---
{
  let m = createMatch(map, ['rome']);
  assert(m.phase.kind === 'play', 'play');
  m.phase.phase = 'move';
  m.phase.taxesCollected = true;
  // Village stack of 3 ready (not via recruit — recruits are cooldown)
  const vil = m.stacks.find((s) => s.regionId === 'b' && s.factionId === 'rome')!;
  vil.units = 3;

  const oneLegal = legalMovesForStack(m, map, sea, vil.id, { count: 1 });
  assert(oneLegal.some((x) => x.regionId === 'a'), '1-unit can enter friendly capital');
  m = moveStack(m, map, sea, vil.id, 'a', { count: 1 });
  const left = m.stacks.find((s) => s.id === vil.id)!;
  assert(left.units === 2 && !left.moved, 'remainder unmoved');
  const peeled = m.stacks.find((s) => s.regionId === 'a' && s.moved && s.kind === 'loose');
  assert(peeled?.units === 1, 'peeled 1 arrives in cooldown');

  // Recruit onto village joins village cooldown
  m.seats[0].coins = 1;
  m = recruit(m, map, sea, 'b');
  const coolB = m.stacks.find((s) => s.regionId === 'b' && s.moved)!;
  assert(coolB.units === 1, 'village recruit in cooldown');
  assert(left.units === 2 && !left.moved, 'ready remainder still on village');

  // Remainder can still move once — merges into dest cooldown
  m = moveStack(m, map, sea, left.id, 'a', { count: 'all' });
  // village still has recruit cooldown stack
  assert(
    m.stacks.some((s) => s.regionId === 'b' && s.factionId === 'rome' && s.moved),
    'cooldown recruit remains on village',
  );
  const movedOnA = m.stacks.filter((s) => s.regionId === 'a' && s.factionId === 'rome' && s.moved);
  const unmovedOnA = m.stacks.filter((s) => s.regionId === 'a' && s.factionId === 'rome' && !s.moved);
  assert(movedOnA.length === 1 && movedOnA[0].units === 3, 'arrivals share one cooldown stack');
  assert(unmovedOnA.length === 1 && unmovedOnA[0].units === 1, 'garrison stays unmoved');
  let threw = false;
  try {
    moveStack(m, map, sea, movedOnA[0].id, 'b', { count: 1 });
  } catch {
    threw = true;
  }
  assert(threw, 'cooldown cannot move again');
}

// --- leaving a region empties ownership ---
{
  let m = createMatch(map, ['rome']);
  assert(m.phase.kind === 'play', 'play');
  m.phase.phase = 'move';
  const vil = m.stacks.find((s) => s.regionId === 'b' && s.factionId === 'rome')!;
  assert(m.regionOwners['b'] === 'rome', 'village owned while occupied');
  m = moveStack(m, map, sea, vil.id, 'a', { count: 'all' });
  assert(m.regionOwners['b'] == null, 'vacated village becomes neutral');
  assert(m.regionOwners['a'] === 'rome', 'destination stays owned');
}

// --- turn start consolidates moved + unmoved into one stack ---
{
  let m = createMatch(map, ['rome', 'gaule']);
  const home = m.stacks.find((s) => s.regionId === 'c' && s.factionId === 'gaule')!;
  m.stacks.push(
    makeStack(m, {
      factionId: 'gaule',
      regionId: 'c',
      units: 2,
      kind: 'loose',
      moved: true,
    }),
  );
  consolidateFactionStacks(m, 'gaule');
  const onC = m.stacks.filter((s) => s.regionId === 'c' && s.factionId === 'gaule');
  assert(onC.length === 1, 'one stack after consolidate');
  assert(onC[0].units === home.units + 2 && !onC[0].moved, 'merged and unmoved');

  // advancePhase into next seat also consolidates
  m = createMatch(map, ['rome', 'gaule']);
  m.stacks.push(
    makeStack(m, {
      factionId: 'gaule',
      regionId: 'c',
      units: 2,
      kind: 'loose',
      moved: true,
    }),
  );
  assert(m.phase.kind === 'play', 'play');
  m.phase.phase = 'armies';
  m.phase.taxesCollected = true;
  m = advancePhase(m, map, sea);
  assert(m.phase.kind === 'play' && m.phase.playerIndex === 1, 'gaule turn');
  const after = m.stacks.filter((s) => s.regionId === 'c' && s.factionId === 'gaule');
  assert(after.length === 1 && after[0].units === 3 && !after[0].moved, 'turn start merge');
}

// --- ★ army invades enemy units/armies; loose 3+ and peels cannot ---
{
  let m = createMatch(map, ['rome', 'gaule']);
  m.phase.phase = 'move';
  m.stacks = [
    makeStack(m, { factionId: 'rome', regionId: 'a', units: 1, kind: 'loose' }),
    makeStack(m, { factionId: 'rome', regionId: 'b', units: 3, kind: 'army', armySize: 3 }),
    makeStack(m, { factionId: 'gaule', regionId: 'c', units: 1, kind: 'loose' }),
    makeStack(m, { factionId: 'gaule', regionId: 'd', units: 3, kind: 'army', armySize: 3 }),
  ];
  m.seats[0].tokens.small -= 1;
  m.seats[1].tokens.small -= 1;
  m.regionOwners['a'] = 'rome';
  m.regionOwners['b'] = 'rome';
  m.regionOwners['c'] = 'gaule';
  m.regionOwners['d'] = 'gaule';
  const army = m.stacks.find((s) => s.kind === 'army' && s.factionId === 'rome')!;
  assert(legalMovesForStack(m, map, sea, army.id, { count: 1 }).length === 0, 'army cannot peel');
  assert(
    legalMovesForStack(m, map, sea, army.id, { count: 'all' }).some((x) => x.regionId === 'c'),
    'army enters enemy units',
  );

  // ★ vs ★ on village d
  army.regionId = 'c';
  m.stacks = m.stacks.filter(
    (s) => !(s.factionId === 'gaule' && s.regionId === 'c' && s.kind === 'loose'),
  );
  m.stacks.push(makeStack(m, { factionId: 'rome', regionId: 'c', units: 1, kind: 'loose' }));
  m.regionOwners['c'] = 'rome';
  assert(
    legalMovesForStack(m, map, sea, army.id, { count: 'all' }).some((x) => x.regionId === 'd'),
    'army enters enemy army region',
  );
  m = moveStack(m, map, sea, army.id, 'd');
  const contact = m.pendingInvasions.find((i) => i.regionId === 'd');
  assert(contact?.status === 'pending', '★ vs ★ → attacker Wait/Attack');
  // Wait → co-located; either ★ can Attack later via stack button
  m = resolveInvasionChoice(m, map, sea, contact!.id, 'wait');
  assert(m.pendingInvasions.length === 0, 'wait clears contact');
  const romeArmy = m.stacks.find((s) => s.kind === 'army' && s.factionId === 'rome' && s.regionId === 'd')!;
  const gauleArmy = m.stacks.find((s) => s.kind === 'army' && s.factionId === 'gaule' && s.regionId === 'd')!;
  assert(romeArmy && gauleArmy, 'both ★ still on d');
  assert(canDeclareColocatedAttack(m, romeArmy.id), 'waiter can Attack');
  m = declareColocatedAttack(m, map, sea, romeArmy.id);
  const reopened = m.pendingInvasions.find((i) => i.regionId === 'd');
  assert(reopened?.status === 'awaiting_defender', 'Attack opens defender popup');
  assert(
    canSiegeRegion(m, map, 'd', 'gaule'),
    'owner can siege when attacked on own village',
  );
  m = resolveInvasionChoice(m, map, sea, reopened!.id, 'defend');
  assert(m.sieges.some((s) => s.regionId === 'd'), 'Defend/Siege on village');
  m.seats[1]!.coins = 2;
  m.phase.playerIndex = 1;
  assert(
    !recruitableRegions(m, map, sea, 'gaule').includes('d'),
    'sieged settlement cannot receive recruits',
  );
  m.phase.playerIndex = 0;
  assert(canBreakSiege(m, 'd'), 'attacker can break siege');
  assert(!canSiegeBattle(m, map, 'd'), 'attacker cannot assault village on day 0');
  m.phase.playerIndex = 1;
  assert(!canBreakSiege(m, 'd'), 'defender cannot break siege');
  assert(canSiegeBattle(m, map, 'd'), 'defender can start battle');
  m = siegeToBattle(m, map, sea, 'd');
  assert(!m.sieges.some((s) => s.regionId === 'd'), 'siege cleared');
  assert(
    m.pendingInvasions.some((i) => i.regionId === 'd' && i.status === 'battle'),
    'battle kept for later',
  );
  m.phase.playerIndex = 0;
  // Fresh siege for break test
  m.pendingInvasions = [];
  m.sieges.push({
    regionId: 'd',
    attackerFactionId: 'rome',
    defenderFactionId: 'gaule',
    attackerStackIds: m.stacks.filter((s) => s.factionId === 'rome' && s.regionId === 'd').map((s) => s.id),
    defenderStackIds: m.stacks.filter((s) => s.factionId === 'gaule' && s.regionId === 'd').map((s) => s.id),
    days: 0,
  });
  m = breakSiege(m, map, 'd');
  assert(!m.sieges.some((s) => s.regionId === 'd'), 'siege lifted');
  assert(
    m.stacks.some((s) => s.factionId === 'rome' && s.regionId === 'd' && s.kind === 'army') &&
      m.stacks.some((s) => s.factionId === 'gaule' && s.regionId === 'd' && s.kind === 'army'),
    'both ★ still co-located after break',
  );

  // Village: after 1 siege day, attacker may assault
  m.pendingInvasions = [];
  m.sieges = [
    {
      regionId: 'd',
      attackerFactionId: 'rome',
      defenderFactionId: 'gaule',
      attackerStackIds: m.stacks
        .filter((s) => s.factionId === 'rome' && s.regionId === 'd')
        .map((s) => s.id),
      defenderStackIds: m.stacks
        .filter((s) => s.factionId === 'gaule' && s.regionId === 'd')
        .map((s) => s.id),
      days: 0,
    },
  ];
  m.phase.playerIndex = 0;
  assert(!canSiegeBattle(m, map, 'd'), 'no assault before day 1');
  m = applySiegeAttrition(m, map);
  assert(m.sieges[0]?.days === 1, 'siege day ticks to 1');
  assert(canSiegeBattle(m, map, 'd'), 'attacker may assault village after day 1');
  m = siegeToBattle(m, map, sea, 'd');
  assert(
    m.pendingInvasions.some(
      (i) => i.regionId === 'd' && i.status === 'awaiting_defender',
    ),
    'attacker assault reopens defender response',
  );

  // Fresh co-locate: visitor initiates Attack — no siege (not their land)
  m = createMatch(map, ['rome', 'gaule']);
  m.phase.phase = 'move';
  m.phase.playerIndex = 1;
  m.stacks = [
    makeStack(m, { factionId: 'rome', regionId: 'd', units: 3, kind: 'army', armySize: 3 }),
    makeStack(m, { factionId: 'gaule', regionId: 'd', units: 3, kind: 'army', armySize: 3 }),
    makeStack(m, { factionId: 'gaule', regionId: 'c', units: 1, kind: 'loose' }),
  ];
  m.seats[0].tokens.small -= 1;
  m.seats[1].tokens.small -= 1;
  m.regionOwners['d'] = 'gaule';
  m.regionOwners['c'] = 'gaule';
  const defArmy = m.stacks.find((s) => s.factionId === 'gaule' && s.kind === 'army')!;
  assert(canDeclareColocatedAttack(m, defArmy.id), 'defender can Attack while co-located');
  m = declareColocatedAttack(m, map, sea, defArmy.id);
  const gauleAtk = m.pendingInvasions.find(
    (i) => i.attackerFactionId === 'gaule' && i.status === 'awaiting_defender',
  );
  assert(gauleAtk, 'defender-initiated Attack');
  assert(
    !canSiegeRegion(m, map, 'd', 'rome'),
    'visitor under attack — no siege option',
  );
  let noSiege = false;
  try {
    resolveInvasionChoice(m, map, sea, gauleAtk!.id, 'defend');
  } catch {
    noSiege = true;
  }
  assert(noSiege, 'siege rejected off owned land');

  const loose3 = makeStack(m, { factionId: 'rome', regionId: 'c', units: 3, kind: 'loose' });
  m.stacks.push(loose3);
  assert(
    !legalMovesForStack(m, map, sea, loose3.id, { count: 'all' }).some((x) => x.regionId === 'd'),
    'loose 3 cannot enter enemy army',
  );
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
  assert(m.pendingInvasions.length === 0, '1–2 loose auto-resolved on move');
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
  assert(inv2?.status === 'awaiting_defender', 'capital loose → defender responds');
  let retreatBlocked = false;
  try {
    resolveInvasionChoice(m, map, sea, inv2.id, 'retreat');
  } catch {
    retreatBlocked = true;
  }
  assert(retreatBlocked, 'cannot retreat from capital');
}

// --- retreat: adjacent owned only; no dest → automatic battle ---
{
  let m = createMatch(map, ['rome', 'gaule']);
  assert(m.phase.kind === 'play', 'play');
  m.phase.phase = 'move';
  // ★ gaule on d (village), owns c+d. Rome ★ attacks d from c path… put rome ★ on c first.
  // Neighbors: c-d. If rome attacks from c, fromRegionIds={c}, so c blocked — gaule can retreat
  // to nowhere else adjacent owned (d only neighbors c). → no retreat → battle.
  m.stacks = [
    makeStack(m, { factionId: 'rome', regionId: 'a', units: 1, kind: 'loose' }),
    makeStack(m, {
      factionId: 'rome',
      regionId: 'c',
      units: 3,
      kind: 'army',
      armySize: 3,
    }),
    makeStack(m, {
      factionId: 'gaule',
      regionId: 'd',
      units: 3,
      kind: 'army',
      armySize: 3,
    }),
    makeStack(m, { factionId: 'gaule', regionId: 'c', units: 1, kind: 'loose' }),
  ];
  m.seats[0].tokens.small -= 1;
  m.seats[1].tokens.small -= 1;
  m.regionOwners['a'] = 'rome';
  m.regionOwners['b'] = null;
  m.regionOwners['c'] = 'gaule';
  m.regionOwners['d'] = 'gaule';
  // Clear gaule on c so rome can stand there — actually move rome onto d from b:
  // Setup: rome ★ on b, gaule ★ on c with only capital a owned by rome far away.
  m.stacks = [
    makeStack(m, { factionId: 'rome', regionId: 'a', units: 1, kind: 'loose' }),
    makeStack(m, {
      factionId: 'rome',
      regionId: 'b',
      units: 3,
      kind: 'army',
      armySize: 3,
    }),
    makeStack(m, {
      factionId: 'gaule',
      regionId: 'c',
      units: 3,
      kind: 'army',
      armySize: 3,
    }),
  ];
  m.regionOwners['a'] = 'rome';
  m.regionOwners['b'] = 'rome';
  m.regionOwners['c'] = 'gaule';
  m.regionOwners['d'] = null;
  const atk = m.stacks.find((s) => s.factionId === 'rome' && s.kind === 'army')!;
  m = moveStack(m, map, sea, atk.id, 'c');
  const inv = m.pendingInvasions[0];
  assert(inv?.status === 'pending', '★ vs ★ contact');
  m = resolveInvasionChoice(m, map, sea, inv.id, 'attack');
  const dests = retreatDestinations(m, map, m.pendingInvasions[0]!);
  // c neighbors b (approach, blocked) and d (unowned) — no adjacent owned for gaule
  assert(dests.length === 0, 'no adjacent owned retreat (no teleport to nowhere)');
  assert(
    !dests.includes('a') && !dests.includes('d'),
    'cannot teleport to distant/unowned',
  );
  m = resolveInvasionChoice(m, map, sea, m.pendingInvasions[0]!.id, 'retreat');
  assert(
    m.pendingInvasions.length === 0 ||
      m.log.some((l) => l.includes('battle') || l.includes('Battle')),
    'no retreat dest → automatic battle',
  );
  assert(
    m.log.some((l) => l.includes('No adjacent owned') || l.includes('Battle at')),
    'logs auto-battle',
  );

  // Adjacent owned works: gaule owns c+d, rome attacks d from… need approach not blocking c
  // Attack d from island? Use: gaule ★ on d, owns c+d; rome ★ moves b→c first (hostile?), 
  // simpler: gaule on b owns a? Rome doesn't own. 
  // Map: a-b-c-d. Gaule ★ on b, owns a+b (put garrison on a). Rome ★ on c attacks b.
  // fromRegionIds={c}. Adjacent owned for gaule: a (owned). Retreat to a OK.
  m = createMatch(map, ['rome', 'gaule']);
  m.phase.phase = 'move';
  m.stacks = [
    makeStack(m, { factionId: 'gaule', regionId: 'a', units: 1, kind: 'loose' }),
    makeStack(m, {
      factionId: 'gaule',
      regionId: 'b',
      units: 3,
      kind: 'army',
      armySize: 3,
    }),
    makeStack(m, {
      factionId: 'rome',
      regionId: 'c',
      units: 3,
      kind: 'army',
      armySize: 3,
    }),
  ];
  m.seats[0].tokens.small -= 1;
  m.seats[1].tokens.small -= 1;
  m.regionOwners['a'] = 'gaule';
  m.regionOwners['b'] = 'gaule';
  m.regionOwners['c'] = 'rome';
  m.regionOwners['d'] = null;
  const atk2 = m.stacks.find((s) => s.factionId === 'rome' && s.kind === 'army')!;
  m = moveStack(m, map, sea, atk2.id, 'b');
  const inv2 = m.pendingInvasions[0]!;
  m = resolveInvasionChoice(m, map, sea, inv2.id, 'attack');
  const dests2 = retreatDestinations(m, map, m.pendingInvasions[0]!);
  assert(dests2.includes('a'), 'adjacent owned capital is valid retreat');
  assert(!dests2.includes('d'), 'unowned not valid');
  m = resolveInvasionChoice(m, map, sea, m.pendingInvasions[0]!.id, 'retreat', {
    retreatTo: 'a',
  });
  assert(
    m.stacks.some((s) => s.factionId === 'gaule' && s.kind === 'army' && s.regionId === 'a'),
    '★ fled to adjacent owned a',
  );
  assert(m.regionOwners['b'] === 'rome', 'attacker takes vacated b');
}

// --- loose cannot move off capital supply; detached loose die at EOT; paid army stays ---
{
  let m = createMatch(map, ['rome', 'gaule']);
  assert(m.phase.kind === 'play', 'play');
  m.phase.phase = 'move';
  // a(cap) - b - c. Rome on a+b; c empty. Leaving b for c breaks the chain → illegal for loose.
  m.stacks = [
    makeStack(m, { factionId: 'rome', regionId: 'a', units: 1, kind: 'loose' }),
    makeStack(m, { factionId: 'rome', regionId: 'b', units: 1, kind: 'loose' }),
    makeStack(m, { factionId: 'gaule', regionId: 'd', units: 1, kind: 'loose' }),
  ];
  m.regionOwners['a'] = 'rome';
  m.regionOwners['b'] = 'rome';
  m.regionOwners['c'] = null;
  m.regionOwners['d'] = 'gaule';
  const onB = m.stacks.find((s) => s.regionId === 'b')!;
  const fromB = legalMovesForStack(m, map, sea, onB.id, { count: 'all' });
  assert(fromB.some((x) => x.regionId === 'a'), 'loose can move toward capital');
  assert(!fromB.some((x) => x.regionId === 'c'), 'loose cannot walk into a detached spot');

  // Keep b occupied: peel from a stack of 2 on b into c → c stays linked via b
  m.stacks = [
    makeStack(m, { factionId: 'rome', regionId: 'a', units: 1, kind: 'loose' }),
    makeStack(m, { factionId: 'rome', regionId: 'b', units: 2, kind: 'loose' }),
  ];
  m.regionOwners['a'] = 'rome';
  m.regionOwners['b'] = 'rome';
  const stackB = m.stacks.find((s) => s.regionId === 'b')!;
  const peelToC = legalMovesForStack(m, map, sea, stackB.id, { count: 1 });
  assert(peelToC.some((x) => x.regionId === 'c'), 'peel into adjacent keeps supply via remainder');

  // Army may leave supply (campaign)
  m.stacks.push(
    makeStack(m, {
      factionId: 'rome',
      regionId: 'a',
      units: 3,
      kind: 'army',
      armySize: 3,
    }),
  );
  m.seats[0].tokens.small -= 1;
  const army = m.stacks.find((s) => s.kind === 'army')!;
  assert(
    legalMovesForStack(m, map, sea, army.id, { count: 'all' }).some((x) => x.regionId === 'c'),
    'army can enter unoccupied beyond the line',
  );

  // Cut-off loose on island die; paid army kept
  m.stacks.push(
    makeStack(m, { factionId: 'rome', regionId: 'island', units: 2, kind: 'loose' }),
  );
  army.regionId = 'island';
  army.upkeepPaid = true;
  assert(!isRegionSupplied(m, map, sea, 'rome', 'island'), 'island unsupplied');
  cullUnsuppliedLooseStacks(m, map, sea, 'rome');
  assert(
    !m.stacks.some((s) => s.regionId === 'island' && s.kind === 'loose'),
    'detached loose culled',
  );
  assert(
    m.stacks.some((s) => s.regionId === 'island' && s.kind === 'army' && s.upkeepPaid),
    'paid army kept',
  );

  // EOT culls before ★ promotion
  m = createMatch(map, ['rome', 'gaule']);
  assert(m.phase.kind === 'play', 'play');
  m.phase.phase = 'armies';
  m.phase.taxesCollected = true;
  m.stacks.push(
    makeStack(m, { factionId: 'rome', regionId: 'island', units: 3, kind: 'loose' }),
  );
  m = advancePhase(m, map, sea);
  assert(
    !m.stacks.some((s) => s.regionId === 'island' && s.factionId === 'rome'),
    'EOT culls detached loose before they form ★',
  );
}

// --- dice battle: 4 vs 3 unit-by-unit (scripted rolls matching the example) ---
{
  let m = createMatch(map, ['rome', 'gaule']);
  m.phase.phase = 'move';
  m.stacks = [
    makeStack(m, { factionId: 'rome', regionId: 'd', units: 4, kind: 'army', armySize: 5 }),
    makeStack(m, { factionId: 'gaule', regionId: 'd', units: 3, kind: 'army', armySize: 3 }),
  ];
  m.seats[0].tokens.medium -= 1;
  m.seats[1].tokens.small -= 1;
  m.regionOwners['d'] = 'gaule';
  m.pendingInvasions.push({
    id: 'inv-dice',
    regionId: 'd',
    attackerFactionId: 'rome',
    attackerStackIds: [m.stacks[0]!.id],
    fromRegionIds: ['c'],
    defenderFactionId: 'gaule',
    status: 'battle',
    treachery: false,
    enteredSupplied: {},
  });
  // Proportional: 4v3 d7→1 att, 4v2 d6→6 def, 3v2 d5→1 att, 3v1 d4→1 att → 3 left
  const seq = [0, 0.99, 0, 0];
  let i = 0;
  const rng = () => seq[i++] ?? 0;
  m = resolveBattleDice(m, map, 'inv-dice', rng);
  const romeLeft = m.stacks
    .filter((s) => s.factionId === 'rome' && s.regionId === 'd')
    .reduce((n, s) => n + s.units, 0);
  assert(romeLeft === 3, `attacker should have 3 left, got ${romeLeft}`);
  assert(
    !m.stacks.some((s) => s.factionId === 'gaule' && s.regionId === 'd'),
    'defender wiped',
  );
  assert(m.regionOwners['d'] === 'rome', 'attacker captures');
  assert(m.pendingInvasions.length === 0, 'invasion cleared');
  assert(
    m.log.some((l) => l.includes('4 vs 3')) &&
      m.log.some((l) => l.includes('4 vs 2')) &&
      m.log.some((l) => l.includes('3 vs 2')) &&
      m.log.some((l) => l.includes('3 vs 1')),
    'battle log shows each exchange',
  );
}

// --- AI invades human ★ → must wait for Fight/Siege/Flight (no phase skip) ---
{
  let m = createMatch(map, ['rome', 'gaule'], { aiFactionIds: ['gaule'] });
  m.phase.phase = 'move';
  m.phase.playerIndex = 1;
  m.seats[1]!.coins = 0;
  m.stacks = [
    makeStack(m, { factionId: 'rome', regionId: 'b', units: 3, kind: 'army', armySize: 3 }),
    makeStack(m, { factionId: 'gaule', regionId: 'c', units: 1, kind: 'loose' }),
    makeStack(m, { factionId: 'gaule', regionId: 'c', units: 3, kind: 'army', armySize: 3 }),
  ];
  m.seats[0].tokens.small -= 1;
  m.seats[1].tokens.small -= 1;
  m.regionOwners['a'] = 'rome';
  m.regionOwners['b'] = 'rome';
  m.regionOwners['c'] = 'gaule';
  m.regionOwners['d'] = 'gaule';
  const gauleArmy = m.stacks.find((s) => s.factionId === 'gaule' && s.kind === 'army')!;
  m = moveStack(m, map, sea, gauleArmy.id, 'b');
  m = resolveAiInvasionContacts(m, map, sea, () => 0.5);
  assert(
    m.pendingInvasions.some((i) => i.regionId === 'b' && i.status === 'awaiting_defender'),
    'human ★ must answer after AI Attack',
  );
  assert(needsHumanInvasionInput(m), 'human Fight/Siege/Flight required');
  const stuck = runCampaignAiTurns(m, map, sea, () => 0.5, 15);
  assert(
    stuck.pendingInvasions.some((i) => i.status === 'awaiting_defender'),
    'AI must not skip past human defender choice',
  );
  assert(stuck.phase.kind === 'play' && stuck.phase.playerIndex === 1, 'still AI move while waiting');
}

// --- capital battle: defender +1 odds; AI fights when odds ≥ equal−1 else sieges ---
{
  let m = createMatch(map, ['rome']);
  assert(isNeutralFaction(m, 'gaule'), 'gaule is neutral');
  m.phase.phase = 'move';
  // 3 vs 1+1 capital → equal−1 → fight (not siege)
  m.stacks = [
    makeStack(m, { factionId: 'rome', regionId: 'b', units: 3, kind: 'army', armySize: 3 }),
    makeStack(m, { factionId: 'gaule', regionId: 'c', units: 1, kind: 'loose' }),
    makeStack(m, { factionId: 'gaule', regionId: 'd', units: 1, kind: 'loose' }),
  ];
  m.seats[0].tokens.small -= 1;
  m.regionOwners['b'] = 'rome';
  m.regionOwners['c'] = 'gaule';
  m.regionOwners['d'] = 'gaule';
  m = moveStack(m, map, sea, m.stacks[0]!.id, 'c');
  assert(
    m.pendingInvasions.some((i) => i.regionId === 'c' && i.status === 'awaiting_defender'),
    'neutral capital awaits response',
  );
  m = resolveAiInvasionContacts(m, map, sea, () => 0.5);
  assert(!m.sieges.some((s) => s.regionId === 'c'), 'equal−1 odds → fight not siege');
  assert(m.pendingInvasions.length === 0, 'fight resolved');

  // Worse than equal−1 (5 vs 1+1) → Siege
  m = createMatch(map, ['rome']);
  m.phase.phase = 'move';
  m.stacks = [
    makeStack(m, { factionId: 'rome', regionId: 'b', units: 5, kind: 'army', armySize: 5 }),
    makeStack(m, { factionId: 'gaule', regionId: 'c', units: 1, kind: 'loose' }),
  ];
  m.seats[0].tokens.medium -= 1;
  m.regionOwners['b'] = 'rome';
  m.regionOwners['c'] = 'gaule';
  m = moveStack(m, map, sea, m.stacks[0]!.id, 'c');
  m = resolveAiInvasionContacts(m, map, sea, () => 0.5);
  assert(m.sieges.some((s) => s.regionId === 'c'), 'bad odds → neutral capital sieges');

  // Capital +1: 2 vs 1 on capital → defender rolls 1..(1+1)
  m = createMatch(map, ['rome', 'gaule']);
  m.stacks = [
    makeStack(m, { factionId: 'rome', regionId: 'c', units: 2, kind: 'army', armySize: 3 }),
    makeStack(m, { factionId: 'gaule', regionId: 'c', units: 1, kind: 'loose' }),
  ];
  m.seats[0].tokens.small -= 1;
  m.regionOwners['c'] = 'gaule';
  m.pendingInvasions.push({
    id: 'inv-cap',
    regionId: 'c',
    attackerFactionId: 'rome',
    attackerStackIds: [m.stacks[0]!.id],
    fromRegionIds: ['b'],
    defenderFactionId: 'gaule',
    status: 'battle',
    treachery: false,
    enteredSupplied: {},
  });
  // 2 vs 1+1 capital → d4; rolls 3 then 4 → defender twice, att wiped
  let i = 0;
  const seq = [0.6, 0.9];
  m = resolveBattleDice(m, map, 'inv-cap', () => seq[i++] ?? 0);
  assert(
    !m.stacks.some((s) => s.factionId === 'rome' && s.regionId === 'c'),
    'capital +1 widens defender band on the d(att+def+1)',
  );
  assert(
    m.log.some((l) => l.includes('+1 capital') || l.includes('1+1') || l.includes('vs 1+1')),
    'logs capital bonus',
  );
}

// --- AI seat + recruit toward capital ---
{
  let m = createMatch(map, ['rome', 'gaule'], { aiFactionIds: ['gaule'] });
  assert(m.seats[1]?.isAi === true, 'gaule is AI');
  assert(!m.seats[0]?.isAi, 'rome is human');
  assert(m.log[0]?.includes('AI'), 'start log marks AI');
  assert(landDistance(map, 'a', 'd') === 3, 'BFS distance a→d');

  m.phase.phase = 'move';
  m.phase.playerIndex = 1;
  m.seats[1]!.coins = 3;
  m.seats[1]!.aiTargetCapitalId = 'a';
  m.stacks = [
    makeStack(m, { factionId: 'rome', regionId: 'a', units: 1, kind: 'loose' }),
    makeStack(m, { factionId: 'gaule', regionId: 'c', units: 1, kind: 'loose' }),
  ];
  m.regionOwners['a'] = 'rome';
  m.regionOwners['b'] = null;
  m.regionOwners['c'] = 'gaule';
  m.regionOwners['d'] = null;
  m = campaignAiStep(m, map, sea, () => 0);
  assert(
    m.stacks.some((s) => s.factionId === 'gaule' && s.regionId === 'b'),
    'AI recruits toward target capital into b',
  );

  // runCampaignAiTurns advances past AI when nothing left
  m = createMatch(map, ['rome', 'gaule'], { aiFactionIds: ['gaule'] });
  m.phase.phase = 'armies';
  m.phase.playerIndex = 1;
  m.phase.taxesCollected = true;
  m = runCampaignAiTurns(m, map, sea, () => 0.5, 10);
  assert(m.phase.kind === 'play' && m.phase.playerIndex === 0, 'AI turn ends → rome');
}

// --- only LAST capital fall neutralizes; earlier capitals leave faction intact ---
{
  const base = testMap();
  const multi = testMap({
    regions: [
      ...base.regions.map((r) =>
        r.id === 'island'
          ? {
              ...r,
              ownerId: 'gaule',
              settlement: {
                kind: 'capital' as const,
                key: 'paris' as const,
                at: { x: 105, y: 5 },
                units: ['infantry' as const],
              },
            }
          : r,
      ),
    ],
  });
  let m = createMatch(multi, ['rome', 'gaule']);
  m.phase.phase = 'move';
  m.stacks = [
    makeStack(m, { factionId: 'rome', regionId: 'c', units: 5, kind: 'army', armySize: 5 }),
    makeStack(m, { factionId: 'gaule', regionId: 'c', units: 1, kind: 'loose' }),
    makeStack(m, { factionId: 'gaule', regionId: 'd', units: 2, kind: 'loose' }),
    makeStack(m, { factionId: 'gaule', regionId: 'island', units: 1, kind: 'loose' }),
  ];
  m.seats[0]!.tokens.medium -= 1;
  m.regionOwners['c'] = 'gaule';
  m.regionOwners['d'] = 'gaule';
  m.regionOwners['island'] = 'gaule';
  m.pendingInvasions.push({
    id: 'inv-first-cap',
    regionId: 'c',
    attackerFactionId: 'rome',
    attackerStackIds: [m.stacks[0]!.id],
    fromRegionIds: ['b'],
    defenderFactionId: 'gaule',
    status: 'battle',
    treachery: false,
    enteredSupplied: {},
  });
  let roll = 0;
  m = resolveBattleDice(m, multi, 'inv-first-cap', () => (roll++ % 2 === 0 ? 0.99 : 0));
  assert(m.regionOwners['c'] === 'rome', 'took first gaule capital');
  assert(m.regionOwners['island'] === 'gaule', 'second capital still gaule');
  assert(
    m.stacks.some((s) => s.factionId === 'gaule' && s.regionId === 'd' && !s.rebelOf),
    'units stay gaule after non-final capital loss',
  );
  assert(!m.log.some((l) => l.includes('turn neutral')), 'no neutralize yet');

  const romeIsle = makeStack(m, {
    factionId: 'rome',
    regionId: 'island',
    units: 5,
    kind: 'army',
    armySize: 5,
  });
  m.stacks.push(romeIsle);
  m.seats[0]!.tokens.medium -= 1;
  m.pendingInvasions.push({
    id: 'inv-last-cap',
    regionId: 'island',
    attackerFactionId: 'rome',
    attackerStackIds: [romeIsle.id],
    fromRegionIds: ['c'],
    defenderFactionId: 'gaule',
    status: 'battle',
    treachery: false,
    enteredSupplied: {},
  });
  roll = 0;
  m = resolveBattleDice(m, multi, 'inv-last-cap', () => (roll++ % 2 === 0 ? 0.99 : 0));
  assert(m.regionOwners['island'] === 'rome', 'took last gaule capital');
  assert(
    m.stacks.some((s) => s.rebelOf === 'gaule' && s.regionId === 'd'),
    'last capital fall → village turns neutral',
  );
}

// --- capital fall → remnants neutral; join ★ that don't hold their capital ---
{
  let m = createMatch(map, ['rome', 'spain']);
  m.phase.phase = 'move';
  m.stacks = [
    makeStack(m, { factionId: 'rome', regionId: 'c', units: 5, kind: 'army', armySize: 5 }),
    makeStack(m, { factionId: 'gaule', regionId: 'c', units: 1, kind: 'loose' }),
    makeStack(m, { factionId: 'gaule', regionId: 'd', units: 3, kind: 'loose' }),
  ];
  m.seats[0]!.tokens.medium -= 1;
  m.regionOwners['c'] = 'gaule';
  m.regionOwners['d'] = 'gaule';
  m.pendingInvasions.push({
    id: 'inv-fall',
    regionId: 'c',
    attackerFactionId: 'rome',
    attackerStackIds: [m.stacks[0]!.id],
    fromRegionIds: ['b'],
    defenderFactionId: 'gaule',
    status: 'battle',
    treachery: false,
    enteredSupplied: {},
  });
  let roll = 0;
  m = resolveBattleDice(m, map, 'inv-fall', () => (roll++ % 2 === 0 ? 0.99 : 0));
  assert(m.regionOwners['c'] === 'rome', 'rome took gaule capital');
  const rem = m.stacks.find((s) => s.regionId === 'd');
  assert(rem?.rebelOf === 'gaule' && rem.factionId === 'rebel:gaule', 'village stack neutralized');
  assert(m.regionOwners['d'] === 'rebel:gaule', 'remnants hold their hex');
  assert(m.log.some((l) => l.includes('turn neutral')), 'neutralize log');

  // Conqueror holding their capital does not absorb — fights remnants
  const romeArmy = m.stacks.find((s) => s.factionId === 'rome' && s.kind === 'army')!;
  romeArmy.moved = false;
  romeArmy.regionId = 'c';
  m.phase.phase = 'move';
  m = moveStack(m, map, sea, romeArmy.id, 'd');
  assert(m.stacks.some((s) => s.rebelOf === 'gaule' && s.regionId === 'd'), 'conqueror does not absorb');
  assert(
    m.pendingInvasions.some(
      (i) => i.regionId === 'd' && i.defenderFactionId === 'rebel:gaule',
    ),
    'conqueror fights remnants',
  );

  // Other ★ (spain) enters remnant hex → they defect and join
  m = createMatch(map, ['rome', 'spain']);
  m.phase.phase = 'move';
  m.stacks = [
    makeStack(m, { factionId: 'spain', regionId: 'c', units: 3, kind: 'army', armySize: 3 }),
    makeStack(m, {
      factionId: 'rebel:gaule',
      regionId: 'd',
      units: 2,
      kind: 'loose',
      rebelOf: 'gaule',
    }),
  ];
  m.seats[1]!.tokens.small -= 1;
  m.phase.playerIndex = 1;
  m.regionOwners['c'] = 'rome';
  m.regionOwners['d'] = 'rebel:gaule';
  m = moveStack(m, map, sea, m.stacks[0]!.id, 'd');
  const spain = m.stacks.find((s) => s.factionId === 'spain')!;
  assert(spain.units === 5 && spain.regionId === 'd', 'spain absorbs 2 remnants');
  assert(!m.stacks.some((s) => s.rebelOf === 'gaule'), 'no remnants left');
  assert(m.log.some((l) => l.includes('join')), 'absorb log');
}

// --- cannot move another player's units ---
{
  let m = createMatch(map, ['rome', 'spain']);
  m.phase.phase = 'move';
  m.stacks = [
    makeStack(m, { factionId: 'rome', regionId: 'a', units: 1, kind: 'loose' }),
    makeStack(m, { factionId: 'spain', regionId: 'b', units: 3, kind: 'army', armySize: 3 }),
  ];
  m.seats[1]!.tokens.small -= 1;
  m.regionOwners['a'] = 'rome';
  m.regionOwners['b'] = 'spain';
  const spainArmy = m.stacks.find((s) => s.factionId === 'spain')!;
  assert(legalMovesForStack(m, map, sea, spainArmy.id).length === 0, 'no legal moves for foe ★');
  let threw = false;
  try {
    moveStack(m, map, sea, spainArmy.id, 'a');
  } catch (e) {
    threw = e instanceof Error && e.message === 'Not your units';
  }
  assert(threw, 'rome cannot move spain units');
}

// --- remnant neutrals retreat to adjacent owned like anyone else ---
{
  const base = testMap();
  const retreatMap = testMap({
    regions: [
      ...base.regions,
      {
        id: 'e',
        name: 'E',
        ring: [
          { x: 40, y: 0 },
          { x: 50, y: 0 },
          { x: 50, y: 10 },
          { x: 40, y: 10 },
        ],
        ownerId: 'gaule',
        settlement: { kind: 'none' },
      },
    ],
    neighbors: {
      ...base.neighbors,
      d: ['c', 'e'],
      e: ['d'],
    },
  });
  const retreatSea = buildSeaAdjacency(retreatMap);
  let m = createMatch(retreatMap, ['rome']);
  m.phase.phase = 'move';
  // Invade village d from c; remnant can flight to owned e
  m.stacks = [
    makeStack(m, { factionId: 'rome', regionId: 'c', units: 3, kind: 'army', armySize: 3 }),
    makeStack(m, {
      factionId: 'rebel:gaule',
      regionId: 'd',
      units: 1,
      kind: 'loose',
      rebelOf: 'gaule',
    }),
    makeStack(m, {
      factionId: 'rebel:gaule',
      regionId: 'e',
      units: 1,
      kind: 'loose',
      rebelOf: 'gaule',
    }),
  ];
  m.seats[0]!.tokens.small -= 1;
  m.regionOwners['c'] = 'rome';
  m.regionOwners['d'] = 'rebel:gaule';
  m.regionOwners['e'] = 'rebel:gaule';
  m = moveStack(m, retreatMap, retreatSea, m.stacks[0]!.id, 'd');
  assert(m.pendingInvasions.length === 0, '1 loose remnant auto-retreats');
  const onE = m.stacks
    .filter((s) => s.rebelOf === 'gaule' && s.regionId === 'e')
    .reduce((n, s) => n + s.units, 0);
  assert(onE === 2, 'remnant fled to adjacent owned e');
  assert(m.regionOwners['d'] === 'rome', 'rome takes vacated hex');
  assert(m.log.some((l) => l.includes('auto-retreat')), 'retreat log');
}

// --- AI: enemy ★ adjacent to capital → village troops rush in ---
{
  let m = createMatch(map, ['rome', 'gaule'], { aiFactionIds: ['gaule'] });
  m.phase.phase = 'move';
  m.phase.playerIndex = 1;
  m.seats[1]!.coins = 0; // no recruit distraction
  m.stacks = [
    makeStack(m, { factionId: 'rome', regionId: 'b', units: 3, kind: 'army', armySize: 3 }),
    makeStack(m, { factionId: 'gaule', regionId: 'c', units: 1, kind: 'loose' }),
    makeStack(m, { factionId: 'gaule', regionId: 'd', units: 2, kind: 'loose' }),
  ];
  m.seats[0]!.tokens.small -= 1;
  m.regionOwners['b'] = 'rome';
  m.regionOwners['c'] = 'gaule';
  m.regionOwners['d'] = 'gaule';
  m = campaignAiStep(m, map, sea, () => 0);
  assert(
    !m.stacks.some((s) => s.factionId === 'gaule' && s.regionId === 'd'),
    'village emptied toward capital',
  );
  const onCap = m.stacks
    .filter((s) => s.factionId === 'gaule' && s.regionId === 'c')
    .reduce((n, s) => n + s.units, 0);
  assert(onCap === 3, 'capital reinforced to 3');
  assert(m.log.some((l) => l.includes('rushes village')), 'rush log');
}

console.log('repro-total-war: ok');
