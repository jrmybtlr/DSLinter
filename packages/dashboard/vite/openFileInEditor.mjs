import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const CONFIG_NAMES = [".dslinter.json", "dslinter.json"];

/** @typedef {{ file: string; line?: number; column?: number; scanRoot: string }} OpenFileOptions */

/**
 * @param {string} startDir
 * @returns {string | null}
 */
function findConfigPath(startDir) {
  let dir = resolve(startDir);
  for (;;) {
    for (const name of CONFIG_NAMES) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function readEditorOpenCommand(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * @param {string} projectRoot
 * @returns {string | null}
 */
export function loadEditorOpenCommand(projectRoot) {
  const fromEnv = process.env.DSLINTER_EDITOR?.trim();
  if (fromEnv) return fromEnv;

  const configPath = findConfigPath(projectRoot);
  if (!configPath) return null;
  try {
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return readEditorOpenCommand(parsed.editor_open_command);
  } catch {
    return null;
  }
}

/**
 * @param {string} absPath
 * @param {string} root
 */
export function isPathUnderRoot(absPath, root) {
  const normalized = resolve(absPath);
  const normalizedRoot = resolve(root);
  if (normalized === normalizedRoot) return true;
  const prefix = normalizedRoot.endsWith("/")
    ? normalizedRoot
    : `${normalizedRoot}/`;
  return normalized.startsWith(prefix);
}

/**
 * @param {string} template
 * @param {{ file: string; line: number; column: number }} ctx
 * @returns {string[]}
 */
export function expandEditorOpenCommand(template, ctx) {
  const withPlaceholders = template
    .replaceAll("{file}", ctx.file)
    .replaceAll("{line}", String(ctx.line))
    .replaceAll("{column}", String(ctx.column));
  return splitShellArgs(withPlaceholders);
}

/**
 * Minimal shell-like split (no nested quotes); good enough for editor commands.
 * @param {string} input
 * @returns {string[]}
 */
function splitShellArgs(input) {
  const args = [];
  let current = "";
  let quote = null;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (current.length > 0) args.push(current);
  return args;
}

/**
 * @param {string} command
 * @returns {boolean}
 */
function commandExists(command) {
  const probe =
    process.platform === "win32" ? "where" : "command";
  const args =
    process.platform === "win32" ? [command] : ["-v", command];
  const result = spawnSync(probe, args, { stdio: "ignore" });
  return result.status === 0;
}

/**
 * @param {{ file: string; line: number; column: number }} ctx
 * @param {string | null} configured
 * @returns {string[] | null}
 */
export function resolveEditorOpenArgv(ctx, configured) {
  if (configured) {
    const argv = expandEditorOpenCommand(configured, ctx);
    return argv.length > 0 ? argv : null;
  }

  const templates = [
    "cursor --goto {file}:{line}:{column}",
    "code --goto {file}:{line}:{column}",
    "codium --goto {file}:{line}:{column}",
    "subl {file}:{line}:{column}",
    "webstorm --line {line} {file}",
    "idea --line {line} {file}",
  ];

  for (const template of templates) {
    const argv = expandEditorOpenCommand(template, ctx);
    if (argv.length > 0 && commandExists(argv[0])) return argv;
  }

  if (process.platform === "darwin") {
    return ["open", "-t", ctx.file];
  }
  if (process.platform === "win32") {
    return ["cmd", "/c", "start", "", ctx.file];
  }
  return ["xdg-open", ctx.file];
}

/**
 * @param {OpenFileOptions} options
 */
export function openFileInEditor(options) {
  const file = resolve(options.file);
  const scanRoot = resolve(options.scanRoot);
  if (!isPathUnderRoot(file, scanRoot)) {
    throw new Error("Refusing to open path outside scan root");
  }
  if (!existsSync(file)) {
    throw new Error(`File not found: ${file}`);
  }

  const ctx = {
    file,
    line: options.line ?? 1,
    column: options.column ?? 1,
  };
  const configured = loadEditorOpenCommand(scanRoot);
  const argv = resolveEditorOpenArgv(ctx, configured);
  if (!argv) {
    throw new Error("No editor command configured");
  }

  const [command, ...args] = argv;
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}
