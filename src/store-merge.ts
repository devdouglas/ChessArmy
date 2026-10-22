export function mergeDeleted(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const out = { ...a };
  for (const [id, ts] of Object.entries(b)) {
    out[id] = Math.max(out[id] ?? 0, ts);
  }
  return out;
}

export function mergeByUpdatedAt<T extends { id: string; updatedAt: number }>(
  a: T[],
  b: T[],
  deleted: Record<string, number>,
): T[] {
  const map = new Map<string, T>();
  for (const item of [...a, ...b]) {
    if (!item?.id) continue;
    const updated = Number(item.updatedAt) || 0;
    if ((deleted[item.id] ?? 0) >= updated) continue;
    const prev = map.get(item.id);
    if (!prev || updated >= (Number(prev.updatedAt) || 0)) map.set(item.id, item);
  }
  return [...map.values()];
}

export function pruneDeleted<T extends { id: string; updatedAt: number }>(
  deleted: Record<string, number>,
  items: T[],
): Record<string, number> {
  const out = { ...deleted };
  for (const item of items) {
    if ((out[item.id] ?? 0) < (Number(item.updatedAt) || 0)) delete out[item.id];
  }
  return out;
}
