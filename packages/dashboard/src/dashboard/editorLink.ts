import { resolveModuleSourcePath } from "../report/modulePathMatch";
import { normalizePath } from "./paths";

const EMBED_PREFIX = "@dslinter-scan/";

/** Resolve a playground `modulePath` to an absolute file path under `reportRoot`. */
export function resolveModuleAbsolutePath(
  reportRoot: string,
  modulePath: string,
): string {
  const normalized = normalizePath(modulePath);
  if (normalized.startsWith(EMBED_PREFIX)) {
    const root = normalizePath(reportRoot);
    return `${root}/${normalized.slice(EMBED_PREFIX.length)}`;
  }
  return resolveModuleSourcePath(reportRoot, modulePath);
}

const OPEN_FILE_PATH = "/dslinter/open-file";

/** Open a local file via the dev server, falling back to editor URI handlers. */
export async function openSourceFile(
  absolutePath: string,
  line?: number,
  column = 1,
): Promise<void> {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams({ path: absolutePath });
  if (line != null) params.set("line", String(line));
  params.set("column", String(column));

  try {
    const res = await fetch(`${OPEN_FILE_PATH}?${params}`, { method: "POST" });
    if (res.ok) return;
  } catch {
    // Static build or server unavailable — fall back to protocol links below.
  }

  window.location.assign(
    buildEditorFileUri(absolutePath, line, column, "cursor"),
  );
}

/** Open a local file in VS Code / Cursor via the editor URI handler. */
export function buildEditorFileUri(
  absolutePath: string,
  line?: number,
  column = 1,
  scheme: "vscode" | "cursor" = "vscode",
): string {
  const path = normalizePath(absolutePath);
  const suffix = line != null ? `:${line}:${column}` : "";

  if (/^[a-zA-Z]:/.test(path)) {
    const drive = path.slice(0, 2).toLowerCase();
    const rest = path
      .slice(2)
      .replace(/^\//, "")
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    return `${scheme}://file/${drive}/${rest}${suffix}`;
  }

  const encoded = path
    .split("/")
    .map((segment, index) => (index === 0 && segment === "" ? "" : encodeURIComponent(segment)))
    .join("/");
  return `${scheme}://file${encoded}${suffix}`;
}
