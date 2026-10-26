import { mergeStarMaps, sanitizeStarMap, starMapsEqual } from '../src/progress';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

{
  const a = { 'lvl-a': 1, 'lvl-b': 2 };
  const b = { 'lvl-a': 3, 'lvl-c': 1 };
  const m = mergeStarMaps(a, b);
  assert(m['lvl-a'] === 3, 'max stars win');
  assert(m['lvl-b'] === 2, 'local-only kept');
  assert(m['lvl-c'] === 1, 'remote-only kept');
}

{
  const junk = sanitizeStarMap({
    ok: 2,
    bad: 0,
    over: 9,
    '': 2,
    nope: 'x',
  });
  assert(junk.ok === 2, 'valid kept');
  assert(!('bad' in junk), 'zero dropped');
  assert(junk.over === 3, 'clamped to 3');
  assert(!('' in junk), 'empty id dropped');
  assert(!('nope' in junk), 'NaN dropped');
}

{
  assert(starMapsEqual({ a: 1 }, { a: 1 }), 'equal');
  assert(!starMapsEqual({ a: 1 }, { a: 2 }), 'star mismatch');
  assert(!starMapsEqual({ a: 1 }, { a: 1, b: 1 }), 'key mismatch');
  assert(starMapsEqual({ a: 1, b: 0 as unknown as number }, { a: 1 }), 'missing is 0');
}

console.log('repro-progress-merge ok');
