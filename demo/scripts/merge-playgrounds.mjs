/**
 * Adds `playgrounds` to `public/dslint-report.json` using the same rules as dslint Rust
 * (`playground_groups` in `.dslint.json`). Use after `cargo run … --json` when playgrounds
 * are not yet in the CLI output, or run `npm run dslint:report` once Rust is available.
 *
 * Also normalizes legacy nested `src/components/…` paths in older reports to the flat tree,
 * and when `declared_props` is empty, infers binding names from the TSX file via TypeScript.
 *
 * When `tsconfig.json` resolves, also fills `declared_prop_kinds` using the TypeScript checker
 * (`boolean` | `string` | `number`) so the dashboard does not rely on name heuristics alone.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));
const demoRoot = join(__dirname, "..");
const reportPath = join(demoRoot, "public/dslint-report.json");
const configPath = join(demoRoot, ".dslint.json");

function patchLegacyComponentPathsInReport(report) {
  const raw = JSON.stringify(report);
  const next = raw
    .replaceAll("src/components/bad/duplicate/", "src/components/duplicate/")
    .replaceAll("src/components/good/", "src/components/")
    .replaceAll("src/components/bad/", "src/components/");
  return JSON.parse(next);
}

/** First exported function `exportName` with an object-destructured first parameter. */
function inferDeclaredPropsFromTsx(demoRootDir, relPath, exportName) {
  const abs = join(demoRootDir, relPath);
  let text;
  try {
    text = readFileSync(abs, "utf8");
  } catch {
    return [];
  }
  const sf = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = [];

  function visit(node) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === exportName &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      const p0 = node.parameters[0];
      if (p0 && ts.isObjectBindingPattern(p0.name)) {
        for (const el of p0.name.elements) {
          if (!ts.isBindingElement(el)) continue;
          if (el.propertyName && ts.isIdentifier(el.propertyName)) {
            names.push(el.propertyName.text);
          } else if (ts.isIdentifier(el.name)) {
            names.push(el.name.text);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  names.sort();
  return [...new Set(names)];
}

function hasExportModifier(node) {
  return node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

/** First parameter type for an exported function or exported const arrow/function. */
function getExportFirstParameterType(checker, sf, exportName) {
  let found;
  function visit(node) {
    if (found !== undefined) return;
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === exportName &&
      hasExportModifier(node)
    ) {
      const p0 = node.parameters[0];
      if (p0) found = checker.getTypeAtLocation(p0);
      return;
    }
    if (ts.isVariableStatement(node) && hasExportModifier(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || decl.name.text !== exportName || !decl.initializer) {
          continue;
        }
        const init = decl.initializer;
        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
          const p0 = init.parameters[0];
          if (p0) {
            found = checker.getTypeAtLocation(p0);
            return;
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return found;
}

/**
 * @param {import("typescript").TypeChecker} checker
 * @param {import("typescript").Type} type
 * @returns {"boolean" | "string" | "number" | null}
 */
function classifyPropType(checker, type) {
  const nn = checker.getNonNullableType(type);
  if (nn.isUnion()) {
    const parts = nn.types.map((u) => classifyPropType(checker, checker.getNonNullableType(u)));
    const ok = parts.filter((p) => p !== null);
    if (!ok.length) return null;
    const set = new Set(ok);
    if (set.size === 1) return [...set][0];
    if ([...set].every((x) => x === "string")) return "string";
    if ([...set].every((x) => x === "number")) return "number";
    return null;
  }
  if (nn.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral)) return "boolean";
  if (nn.flags & (ts.TypeFlags.Enum | ts.TypeFlags.EnumLiteral)) return "string";
  if (nn.flags & (ts.TypeFlags.Number | ts.TypeFlags.NumberLike)) return "number";
  if (nn.flags & (ts.TypeFlags.String | ts.TypeFlags.StringLike)) return "string";
  return null;
}

/** @returns {Record<string, string>} */
function inferDeclaredPropKindsFromTs(checker, program, demoRootDir, relPath, exportName, declaredProps) {
  const abs = resolve(demoRootDir, relPath);
  const norm = (p) => p.replace(/\\/g, "/");
  const want = norm(abs);
  const sf = program.getSourceFiles().find((f) => norm(f.fileName) === want);
  if (!sf) return {};
  const paramType = getExportFirstParameterType(checker, sf, exportName);
  if (!paramType) return {};
  /** @type {Record<string, string>} */
  const kinds = {};
  for (const key of declaredProps) {
    if (key === "key" || key === "ref") continue;
    const sym = checker.getPropertyOfType(paramType, key);
    if (!sym) continue;
    const t = checker.getTypeOfSymbol(sym);
    const k = classifyPropType(checker, t);
    if (k !== null) kinds[key] = k;
  }
  return kinds;
}

let cachedCheckerProgram;

function getDemoCheckerProgram(demoRootDir) {
  if (cachedCheckerProgram !== undefined) return cachedCheckerProgram;
  const configPathTs = join(demoRootDir, "tsconfig.json");
  const readJson = ts.readConfigFile(configPathTs, ts.sys.readFile);
  if (readJson.error) {
    console.warn("merge-playgrounds: skip declared_prop_kinds (tsconfig read error)");
    cachedCheckerProgram = null;
    return null;
  }
  const parsed = ts.parseJsonConfigFileContent(
    readJson.config,
    ts.sys,
    demoRootDir,
    undefined,
    configPathTs,
  );
  if (parsed.errors.length) {
    const msg = parsed.errors.map((e) => e.messageText).join("; ");
    console.warn(`merge-playgrounds: skip declared_prop_kinds (parse config: ${msg})`);
    cachedCheckerProgram = null;
    return null;
  }
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    // Demo tsconfig uses `noCheck` so CLI/IDE ignores intentional playground errors; this
    // script still needs a real checker for `declared_prop_kinds`.
    options: { ...parsed.options, noCheck: false },
  });
  cachedCheckerProgram = {
    program,
    checker: program.getTypeChecker(),
  };
  return cachedCheckerProgram;
}

const report = patchLegacyComponentPathsInReport(JSON.parse(readFileSync(reportPath, "utf8")));
const config = JSON.parse(readFileSync(configPath, "utf8"));
const playgroundGroups = config.playground_groups ?? {};
const playgroundGroupKeyCount = Object.keys(playgroundGroups).length;

const root = report.root.replace(/\/$/, "");

function relPath(filePath) {
  const p = filePath.replace(/\\/g, "/");
  const r = root.replace(/\\/g, "/");
  if (!p.startsWith(r)) return "";
  return p.slice(r.length + 1);
}

function longestGroup(rel) {
  const entries = [];
  for (const [group, prefixes] of Object.entries(playgroundGroups)) {
    for (const raw of prefixes) {
      const pre = raw.replace(/^\/+/, "").replace(/\/+$/, "");
      if (!pre) continue;
      if (rel === pre || rel.startsWith(`${pre}/`)) {
        entries.push([pre.length, group]);
      }
    }
  }
  if (!entries.length) return null;
  entries.sort((a, b) => b[0] - a[0]);
  return entries[0][1];
}

const PLAYABLE = new Set([
  "function",
  "class",
  "const_arrow",
  "const_function",
  "wrapped_component",
]);

function pickDefinition(definitions, stem) {
  const playable = definitions.filter((d) => PLAYABLE.has(d.kind));
  if (!playable.length) return null;
  const exact = playable.find((d) => d.name === stem);
  if (exact) return exact;
  if (playable.length === 1) return playable[0];
  return null;
}

const playgrounds = [];
const checkerBundle = getDemoCheckerProgram(demoRoot);
const hasPlaygroundGroups = Object.keys(playgroundGroups).length > 0;

for (const file of report.files ?? []) {
  const rel = relPath(file.path);
  if (!rel) continue;
  if (hasPlaygroundGroups && !longestGroup(rel)) continue;
  if (!/\.(tsx|jsx)$/i.test(rel)) continue;
  const stem =
    rel
      .split("/")
      .pop()
      ?.replace(/\.(tsx|jsx)$/i, "") ?? "";
  const def = pickDefinition(file.definitions ?? [], stem);
  if (!def) continue;
  let declared = def.declared_props ?? [];
  const inferred = inferDeclaredPropsFromTsx(demoRoot, rel, def.name);
  if (inferred.length) {
    if (!declared.length || inferred.length > declared.length) {
      declared = inferred;
    }
  }
  const row = {
    id: def.name,
    export_name: def.name,
    rel_path: rel,
    declared_props: declared,
  };
  if (playgroundGroupKeyCount > 1) {
    row.group = longestGroup(rel);
  }
  if (checkerBundle) {
    const kinds = inferDeclaredPropKindsFromTs(
      checkerBundle.checker,
      checkerBundle.program,
      demoRoot,
      rel,
      def.name,
      declared,
    );
    if (Object.keys(kinds).length) {
      row.declared_prop_kinds = kinds;
    }
  }
  playgrounds.push(row);
}
playgrounds.sort((a, b) => a.rel_path.localeCompare(b.rel_path));

report.playgrounds = playgrounds;
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${reportPath} with ${playgrounds.length} playgrounds`);
