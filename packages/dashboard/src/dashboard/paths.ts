export function shortPath(root: string, fullPath: string): string {
  const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/$/, "");
  const r = norm(root);
  const f = norm(fullPath);
  if (f.startsWith(r + "/")) {
    return f.slice(r.length + 1);
  }
  const parts = f.split("/");
  return parts.slice(-3).join("/");
}
