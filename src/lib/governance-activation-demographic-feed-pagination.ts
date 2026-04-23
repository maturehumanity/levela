/** Append rows by `id`, skipping duplicates already present (stable pagination). */
export function appendUniqueById<T extends { id: string }>(existing: T[], incoming: T[]) {
  if (incoming.length === 0) {
    return existing;
  }

  const seen = new Set(existing.map((row) => row.id));
  const next = [...existing];
  for (const row of incoming) {
    if (seen.has(row.id)) {
      continue;
    }
    seen.add(row.id);
    next.push(row);
  }

  return next;
}
