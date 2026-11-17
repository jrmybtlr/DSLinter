/**
 * Shared POSIX-path helpers for scanner `rel_path` values and Vite glob keys.
 * Reports always use `/`, but Windows absolute paths can still contain `\`.
 */

/** Normalize Windows separators so prefix checks behave consistently. */
export function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}

export function trimLeadingSlashes(value: string): string {
  let start = 0;
  while (start < value.length && value.charCodeAt(start) === 47) start++;
  return value.slice(start);
}

export function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) end--;
  return value.slice(0, end);
}

/** `…/dropdown-menu.tsx` → `dropdown-menu`. */
export function fileStemFromRelPath(relPath: string): string {
  const base = relPath.split("/").pop() ?? relPath;
  return base.replace(/\.(tsx|jsx)$/i, "");
}

/** Convert an absolute scanner path to a report-relative `rel_path`. */
export function relPathFromAbsolute(filePath: string, reportRoot: string): string {
  const file = normalizeSlashes(filePath);
  const root = trimTrailingSlashes(normalizeSlashes(reportRoot));

  if (file.startsWith(`${root}/`)) return file.slice(root.length + 1);
  if (file.startsWith(root)) return trimLeadingSlashes(file.slice(root.length));
  return trimLeadingSlashes(file);
}
