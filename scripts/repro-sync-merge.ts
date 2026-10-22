import {
  mergeByUpdatedAt,
  mergeDeleted,
  pruneDeleted,
} from '../src/store-merge';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const local = [
  { id: 'a', updatedAt: 10, name: 'local-a' },
  { id: 'b', updatedAt: 30, name: 'local-b' },
];
const remote = [
  { id: 'a', updatedAt: 20, name: 'remote-a' },
  { id: 'c', updatedAt: 5, name: 'remote-c' },
];

const merged = mergeByUpdatedAt(local, remote, {});
assert(merged.find((x) => x.id === 'a')?.name === 'remote-a', 'newer a wins');
assert(merged.find((x) => x.id === 'b')?.name === 'local-b', 'local-only kept');
assert(merged.find((x) => x.id === 'c')?.name === 'remote-c', 'remote-only kept');

const deleted = mergeDeleted({ b: 40 }, { c: 1 });
const afterDelete = mergeByUpdatedAt(local, remote, deleted);
assert(!afterDelete.some((x) => x.id === 'b'), 'tombstone drops b');
assert(afterDelete.some((x) => x.id === 'c'), 'older tombstone does not drop newer c');

const resurrect = pruneDeleted({ a: 15 }, remote);
assert(!('a' in resurrect), 'edit newer than tombstone resurrects');

console.log('repro-sync-merge ok');
