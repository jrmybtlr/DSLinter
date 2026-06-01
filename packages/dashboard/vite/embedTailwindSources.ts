import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { projectRootForConfig, readIncludeDirs } from "./collectScanModules";

const FALLBACK_INCLUDE_DIRS = ["resources/js", "src", "app"];

const DASHBOARD_SRC_MARKER = `${join("packages", "dashboard", "src")}`;

function normalizePosixPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/$/, "");
}

function isDashboardPackageSrc(absPath: string): boolean {
  return normalizePosixPath(absPath).endsWith(DASHBOARD_SRC_MARKER);
}

function resolveConsumerSourceAbsDirs(
  scanRoot: string,
  packageRoot: string,
): string[] {
  const scanAbs = resolve(scanRoot);
  const projectRoot = projectRootForConfig(scanAbs);
  let dirs = readIncludeDirs(projectRoot);

  if (!dirs?.length) {
    dirs = FALLBACK_INCLUDE_DIRS.filter((dir) =>
      existsSync(join(projectRoot, dir)),
    );
  }

  const unique = new Set<string>();
  for (const dir of dirs) {
    const norm = dir.trim().replace(/\\/g, "/").replace(/\/$/, "");
    if (!norm) continue;
    const abs = resolve(projectRoot, norm);
    if (!existsSync(abs)) continue;
    if (isDashboardPackageSrc(abs)) continue;
    unique.add(abs);
  }

  if (unique.size === 0 && normalizePosixPath(scanAbs) !== normalizePosixPath(packageRoot)) {
    for (const dir of FALLBACK_INCLUDE_DIRS) {
      const abs = resolve(scanAbs, dir);
      if (!existsSync(abs)) continue;
      if (isDashboardPackageSrc(abs)) continue;
      unique.add(abs);
    }
  }

  return [...unique].sort();
}

/** Absolute consumer include dirs to register with Tailwind `@source`. */
export function resolveEmbedConsumerSourceDirs(
  scanRoot: string,
  packageRoot: string,
): string[] {
  return resolveConsumerSourceAbsDirs(scanRoot, packageRoot);
}

/** `@source` paths relative to `embed/index.css`. */
export function embedSourcePathsRelativeToCss(
  scanRoot: string,
  packageRoot: string,
  embedCssPath: string,
): string[] {
  const embedCssDir = dirname(resolve(embedCssPath));
  return resolveEmbedConsumerSourceDirs(scanRoot, packageRoot).map((abs) => {
    let rel = relative(embedCssDir, abs).replace(/\\/g, "/");
    if (!rel.startsWith(".")) rel = `./${rel}`;
    return rel;
  });
}

export function buildEmbedIndexCss(
  base: string,
  consumerSources: string[],
): string {
  if (consumerSources.length === 0) return base;
  const injected = consumerSources.map((p) => `@source "${p}";`).join("\n");
  return base.replace(
    '@source "../src";',
    `@source "../src";\n${injected}`,
  );
}

export function shouldInjectEmbedConsumerSources(
  scanRoot: string,
  packageRoot: string,
): boolean {
  const scanAbs = resolve(scanRoot);
  const pkgAbs = resolve(packageRoot);
  if (normalizePosixPath(scanAbs) !== normalizePosixPath(pkgAbs)) {
    return true;
  }
  return resolveEmbedConsumerSourceDirs(scanRoot, packageRoot).length > 0;
}
