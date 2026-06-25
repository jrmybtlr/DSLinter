import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AliasOptions } from "vite";
import { flattenViteAlias, type FlatAlias } from "./consumerAlias";

const TSCONFIG_NAMES = ["tsconfig.json", "jsconfig.json"] as const;

/** Strip line and block comments so JSONC tsconfig files parse. */
export function stripJsonComments(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === '"' || text[i] === "'") {
      const quote = text[i]!;
      out += quote;
      i++;
      while (i < text.length) {
        if (text[i] === "\\") {
          out += text[i]!;
          i++;
          if (i < text.length) {
            out += text[i]!;
            i++;
          }
          continue;
        }
        if (text[i] === quote) {
          out += text[i]!;
          i++;
          break;
        }
        out += text[i]!;
        i++;
      }
      continue;
    }
    if (text[i] === "/" && text[i + 1] === "/") {
      i += 2;
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (text[i] === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += text[i]!;
    i++;
  }
  return out;
}

type TsPaths = Record<string, string[]>;

function readTsPaths(consumerRoot: string): TsPaths | null {
  const root = resolve(consumerRoot);
  for (const name of TSCONFIG_NAMES) {
    const filePath = join(root, name);
    if (!existsSync(filePath)) continue;
    try {
      const raw = readFileSync(filePath, "utf8");
      const parsed = JSON.parse(stripJsonComments(raw)) as {
        compilerOptions?: { paths?: TsPaths };
      };
      const paths = parsed.compilerOptions?.paths;
      if (paths && typeof paths === "object") return paths;
    } catch {
      // try next file
    }
  }
  return null;
}

/** Convert tsconfig paths (e.g. @/* → ./resources/js/*) into Vite-style aliases. */
export function flattenTsconfigPaths(
  paths: TsPaths,
  consumerRoot: string,
): FlatAlias[] {
  const root = resolve(consumerRoot);
  const out: FlatAlias[] = [];

  for (const [find, targets] of Object.entries(paths)) {
    if (!Array.isArray(targets) || targets.length === 0) continue;
    const target = targets[0]!;
    if (typeof target !== "string") continue;

    if (find.endsWith("/*")) {
      const prefix = find.slice(0, -2);
      const targetBase = target.endsWith("/*")
        ? target.slice(0, -2)
        : target.replace(/\*$/, "");
      out.push({
        find: prefix,
        replacement: resolve(root, targetBase),
      });
      continue;
    }

    out.push({
      find,
      replacement: resolve(root, target),
    });
  }

  return out.sort((a, b) => {
    const al = typeof a.find === "string" ? a.find.length : 0;
    const bl = typeof b.find === "string" ? b.find.length : 0;
    return bl - al;
  });
}

function hasAtAlias(aliases: FlatAlias[]): boolean {
  return aliases.some(
    (a) =>
      typeof a.find === "string" &&
      (a.find === "@" || a.find === "@/"),
  );
}

function laravelResourcesJsAlias(consumerRoot: string): FlatAlias | null {
  const jsDir = join(resolve(consumerRoot), "resources", "js");
  if (!existsSync(jsDir)) return null;
  return { find: "@", replacement: jsDir };
}

/** Build consumer aliases: static Vite config, tsconfig paths, then Laravel @ fallback. */
export function loadConsumerAliases(
  consumerRoot: string,
  viteAlias: AliasOptions | undefined,
): FlatAlias[] {
  const root = resolve(consumerRoot);
  const merged: FlatAlias[] = [];

  const fromVite = flattenViteAlias(viteAlias, root);
  merged.push(...fromVite);

  if (!hasAtAlias(merged)) {
    const paths = readTsPaths(root);
    if (paths) {
      merged.push(...flattenTsconfigPaths(paths, root));
    }
  }

  if (!hasAtAlias(merged)) {
    const laravel = laravelResourcesJsAlias(root);
    if (laravel) merged.push(laravel);
  }

  return merged.sort((a, b) => {
    const al = typeof a.find === "string" ? a.find.length : 0;
    const bl = typeof b.find === "string" ? b.find.length : 0;
    return bl - al;
  });
}
