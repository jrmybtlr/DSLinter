import type { PlaygroundEntry } from "../types/playground";

function sortPlaygroundEntries(entries: PlaygroundEntry[]): PlaygroundEntry[] {
  return [...entries].sort((a, b) => {
    const ga = a.meta.group ?? "";
    const gb = b.meta.group ?? "";
    if (ga !== gb) return ga.localeCompare(gb);
    return a.meta.title.localeCompare(b.meta.title);
  });
}

/**
 * Merge auto-generated and manual playground entries.
 * Manual entries (from `definePlayground()`) override auto entries with the same `id`.
 */
export function mergePlaygroundEntries(
  autoEntries: PlaygroundEntry[],
  manualEntries: PlaygroundEntry[],
): PlaygroundEntry[] {
  const byId = new Map<string, PlaygroundEntry>();
  for (const entry of autoEntries) {
    byId.set(entry.id, entry);
  }
  for (const entry of manualEntries) {
    byId.set(entry.id, entry);
  }
  return sortPlaygroundEntries([...byId.values()]);
}
