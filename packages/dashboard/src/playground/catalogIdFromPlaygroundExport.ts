/** `alertPlayground` → `Alert`, `toggleGroupPlayground` → `ToggleGroup`. */
export function catalogIdFromPlaygroundExport(exportName: string): string | undefined {
  const match = /^(.+)Playground$/.exec(exportName);
  if (!match) return undefined;
  const stem = match[1];
  if (!stem) return undefined;
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}
