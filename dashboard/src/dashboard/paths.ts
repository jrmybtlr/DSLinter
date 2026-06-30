const ELLIPSIS = "/.../";

export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/$/, "");
}

export function shortPath(root: string, fullPath: string): string {
  const r = normalizePath(root);
  const f = normalizePath(fullPath);
  if (f.startsWith(r + "/")) {
    return f.slice(r.length + 1);
  }
  const parts = f.split("/");
  return parts.slice(-3).join("/");
}

/** Resolve a report path (absolute or root-relative) to an absolute path. */
export function resolveReportAbsolutePath(root: string, path: string): string {
  const r = normalizePath(root);
  const p = normalizePath(path);
  if (p.startsWith(r + "/") || p === r) return p;
  return `${r}/${p}`;
}

/**
 * Truncate a file path from the middle, preserving the filename and path
 * separators. Leading path segments are kept when space allows.
 */
export function truncatePathMiddle(path: string, maxLength: number): string {
  const normalized = normalizePath(path);
  if (normalized.length <= maxLength) return normalized;
  if (maxLength <= 0) return normalized;

  const segments = normalized.split("/");
  const filename = segments.pop() ?? "";
  if (segments.length === 0) return filename;

  for (let keep = segments.length; keep >= 0; keep--) {
    const prefix = segments.slice(0, keep).join("/");
    const result =
      keep === 0 ? `.../${filename}` : `${prefix}${ELLIPSIS}${filename}`;
    if (result.length <= maxLength) return result;
  }

  return filename;
}

/** How many monospace characters fit in an element's client width. */
export function monospaceCharCountThatFits(element: HTMLElement): number {
  const width = element.clientWidth;
  if (width <= 0) return 1;

  const style = getComputedStyle(element);
  const probe = document.createElement("span");
  probe.textContent = "m";
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.whiteSpace = "pre";
  probe.style.font = style.font;
  document.body.appendChild(probe);
  const charWidth = probe.getBoundingClientRect().width;
  probe.remove();

  if (charWidth <= 0) return 1;
  return Math.max(1, Math.floor(width / charWidth));
}
