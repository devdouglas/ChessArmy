import { createMatch, makeStack } from '../src/campaign/match';
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
  recruit,
  recruitableRegions,
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
  assert(m.regionOwners['d'] == null, 'empty village is neutral');
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
  assert(m.seats[0].coins === 1, 'paid red crossing');

  // Own both shores → free
  m.regionOwners['c'] = 'rome';
  m.stacks.find((s) => s.id === army.id)!.moved = false;
  m.stacks.find((s) => s.id === army.id)!.regionId = 'a';
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
  assert(m.pendingInvasions.some((i) => i.regionId === 'c'), 'landed invasion from stop');
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

// --- recruit on owned village/capital ---
{
  let m = createMatch(map, ['rome']);
  assert(m.phase.kind === 'play', 'play');
  m.phase.phase = 'recruit';
  m.phase.taxesCollected = true;
  m = recruit(m, map, sea, 'a');
  const onA = m.stacks.filter((s) => s.regionId === 'a' && s.factionId === 'rome');
  const units = onA.reduce((n, s) => n + s.units, 0);
  assert(units === 2, 'recruited on capital');
  assert(onA.every((s) => !s.moved), 'home recruit unmoved');
  assert(m.seats[0].coins === 0, 'paid 1 for recruit');

  m.seats[0].coins = 1;
  m = recruit(m, map, sea, 'b');
  const onB = m.stacks.filter((s) => s.regionId === 'b' && s.factionId === 'rome');
  const unitsB = onB.reduce((n, s) => n + s.units, 0);
  assert(unitsB === 2, 'recruited on village');
}

// --- 3+ stays loose until end of turn; skip upkeep/invasions ---
{
  let m = createMatch(map, ['rome']);
  assert(!factionHasArmy(m, 'rome'), 'start with no army');
  assert(m.phase.kind === 'play', 'play');
  m.phase.phase = 'recruit';
  m.phase.taxesCollected = true;
  m.seats[0].coins = 2;
  m = recruit(m, map, sea, 'a');
  m = recruit(m, map, sea, 'a');
  const cap = m.stacks.find((s) => s.regionId === 'a' && s.factionId === 'rome')!;
  assert(cap.units === 3 && cap.kind === 'loose', '3 units still loose mid-turn');
  formArmiesEndOfTurn(m, 'rome');
  assert(cap.kind === 'army', 'end of turn → army');
  assert(factionHasArmy(m, 'rome'), 'has army');

  // No army: skip upkeep recruit→move
  m = createMatch(map, ['rome']);
  assert(m.phase.kind === 'play', 'play');
  m.phase.phase = 'recruit';
  m.phase.taxesCollected = true;
  m = advancePhase(m, map, sea);
  assert(m.phase.kind === 'play' && m.phase.phase === 'move', 'skipped upkeep with no armies');

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

// --- recruit-and-move into adjacent neutral ---
{
  let m = createMatch(map, ['rome']);
  assert(m.phase.kind === 'play', 'play');
  m.phase.phase = 'recruit';
  m.phase.taxesCollected = true;
  // Vacate b so we can treat a neighbor path; c borders b. Own a+b, recruit into c (barb capital).
  // c has barbarian unit — hostile, blocked. Use empty d via b: b neighbors a,c — need empty adjacent.
  // Vacate b, own only a; a neighbors b (empty neutral after vacate).
  m.phase.phase = 'move';
  const vil = m.stacks.find((s) => s.regionId === 'b' && s.factionId === 'rome')!;
  m = moveStack(m, map, sea, vil.id, 'a', { count: 'all' });
  assert(m.regionOwners['b'] == null, 'b vacated');
  m.phase.phase = 'recruit';
  m.seats[0].coins = 1;
  m = recruit(m, map, sea, 'b');
  const arrived = m.stacks.filter((s) => s.regionId === 'b' && s.factionId === 'rome');
  assert(arrived.length === 1 && arrived[0].units === 1 && arrived[0].moved, 'adjacent recruit arrives moved');
  assert(m.regionOwners['b'] === 'rome', 'claims adjacent');
  // Moved presence on b must not unlock c this turn
  const allowed = recruitableRegions(m, map, sea, 'rome');
  assert(!allowed.includes('c'), 'moved recruit does not unlock past b');
}

// --- peel 1 unit / whole stack / once per turn ---
{
  let m = createMatch(map, ['rome']);
  assert(m.phase.kind === 'play', 'play');
  m.phase.phase = 'move';
  // Capital a has 1 — recruit so we can peel from village b (2 units after recruit)
  m.phase.phase = 'recruit';
  m.phase.taxesCollected = true;
  m.seats[0].coins = 2;
  m = recruit(m, map, sea, 'b');
  m = recruit(m, map, sea, 'b');
  const vil = m.stacks.find((s) => s.regionId === 'b' && s.factionId === 'rome')!;
  assert(vil.units === 3, 'village stack 3');
  m.phase.phase = 'move';

  const oneLegal = legalMovesForStack(m, map, sea, vil.id, { count: 1 });
  assert(oneLegal.some((x) => x.regionId === 'a'), '1-unit can enter friendly capital');
  m = moveStack(m, map, sea, vil.id, 'a', { count: 1 });
  const left = m.stacks.find((s) => s.id === vil.id)!;
  assert(left.units === 2 && !left.moved, 'remainder unmoved');
  const peeled = m.stacks.find((s) => s.regionId === 'a' && s.moved && s.kind === 'loose');
  assert(peeled?.units === 1, 'peeled 1 arrives moved');

  // Remainder can still move once — merges into dest moved stack
  m = moveStack(m, map, sea, left.id, 'a', { count: 'all' });
  assert(!m.stacks.some((s) => s.regionId === 'b' && s.factionId === 'rome'), 'village emptied');
  const movedOnA = m.stacks.filter((s) => s.regionId === 'a' && s.factionId === 'rome' && s.moved);
  const unmovedOnA = m.stacks.filter((s) => s.regionId === 'a' && s.factionId === 'rome' && !s.moved);
  assert(movedOnA.length === 1 && movedOnA[0].units === 3, 'arrivals share one moved stack');
  assert(unmovedOnA.length === 1 && unmovedOnA[0].units === 1, 'garrison stays unmoved');
  let threw = false;
  try {
    moveStack(m, map, sea, movedOnA[0].id, 'b', { count: 1 });
  } catch {
    threw = true;
  }
  assert(threw, 'already-moved cannot move again');
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
  let m = createMatch(map, ['rome']);
  m.phase.phase = 'move';
  m.stacks = [
    makeStack(m, { factionId: 'rome', regionId: 'a', units: 1, kind: 'loose' }),
    makeStack(m, { factionId: 'rome', regionId: 'b', units: 3, kind: 'army', armySize: 3 }),
    makeStack(m, { factionId: 'barbarians', regionId: 'c', units: 1, kind: 'loose' }),
  ];
  m.seats[0].tokens.small -= 1;
  m.regionOwners['a'] = 'rome';
  m.regionOwners['b'] = 'rome';
  m.regionOwners['c'] = 'barbarians';
  const army = m.stacks.find((s) => s.kind === 'army')!;
  assert(legalMovesForStack(m, map, sea, army.id, { count: 1 }).length === 0, 'army cannot peel');
  const allMoves = legalMovesForStack(m, map, sea, army.id, { count: 'all' });
  assert(allMoves.some((x) => x.regionId === 'c'), 'army enters enemy units');

  // Enemy army on d — rome ★ on c with garrison so capital can be left
  m.stacks.push(
    makeStack(m, { factionId: 'gaule', regionId: 'd', units: 3, kind: 'army', armySize: 3 }),
  );
  m.regionOwners['d'] = 'gaule';
  army.regionId = 'c';
  m.stacks = m.stacks.filter((s) => !(s.factionId === 'barbarians' && s.regionId === 'c'));
  m.stacks.push(makeStack(m, { factionId: 'rome', regionId: 'c', units: 1, kind: 'loose' }));
  m.regionOwners['c'] = 'rome';
  const vsArmy = legalMovesForStack(m, map, sea, army.id, { count: 'all' });
  assert(vsArmy.some((x) => x.regionId === 'd'), 'army enters enemy army region');
  m = moveStack(m, map, sea, army.id, 'd');
  assert(m.pendingInvasions.some((i) => i.regionId === 'd'), 'invasion vs enemy army queued');

  // Loose 3+ is not an army yet — cannot invade
  const loose3 = makeStack(m, { factionId: 'rome', regionId: 'c', units: 3, kind: 'loose' });
  m.stacks.push(loose3);
  // Put another enemy on b so loose on c… use fresh: enemy on b, loose on a can't leave capital.
  // From c (garrison left), loose cannot enter d which still has gaule army after invasion pending.
  const looseMoves = legalMovesForStack(m, map, sea, loose3.id, { count: 'all' });
  assert(!looseMoves.some((x) => x.regionId === 'd'), 'loose 3 cannot enter enemy army');
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
