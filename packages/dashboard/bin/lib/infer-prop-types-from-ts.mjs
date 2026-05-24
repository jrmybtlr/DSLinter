/**
 * TypeScript checker helpers for playground prop kinds and finite string unions.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

/** @typedef {"boolean" | "string" | "number"} DeclaredPropKind */

/**
 * @param {string} projectRoot
 * @returns {{ program: import("typescript").Program; checker: import("typescript").TypeChecker } | null}
 */
export function createCheckerProgram(projectRoot) {
  const configPath = resolve(projectRoot, "tsconfig.json");
  if (!existsSync(configPath)) return null;

  const readJson = ts.readConfigFile(configPath, ts.sys.readFile);
  if (readJson.error) return null;

  const parsed = ts.parseJsonConfigFileContent(
    readJson.config,
    ts.sys,
    projectRoot,
    undefined,
    configPath,
  );
  if (parsed.errors.length) return null;

  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: { ...parsed.options, noCheck: false },
  });

  return { program, checker: program.getTypeChecker() };
}

/**
 * @param {import("typescript").Node} node
 */
function hasExportModifier(node) {
  return node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

/**
 * @param {import("typescript").SourceFile} sf
 * @returns {Set<string>}
 */
function collectNamedExportNames(sf) {
  /** @type {Set<string>} */
  const names = new Set();

  function visit(node) {
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const el of node.exportClause.elements) {
        names.add(el.name.text);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return names;
}

/**
 * @param {import("typescript").CallExpression} call
 * @returns {import("typescript").ParameterDeclaration | undefined}
 */
function firstParamFromForwardRefCall(call) {
  const callee = call.expression;
  const isForwardRef =
    ts.isIdentifier(callee) &&
    (callee.text === "forwardRef" || callee.text.endsWith(".forwardRef"));
  if (!isForwardRef) return undefined;

  const arg = call.arguments[0];
  if (!arg || (!ts.isArrowFunction(arg) && !ts.isFunctionExpression(arg))) {
    return undefined;
  }
  return arg.parameters[0];
}

/**
 * Resolve the first parameter type for a component export.
 *
 * @param {import("typescript").TypeChecker} checker
 * @param {import("typescript").SourceFile} sf
 * @param {string} exportName
 * @returns {import("typescript").Type | undefined}
 */
export function findComponentParamType(checker, sf, exportName) {
  const namedExports = collectNamedExportNames(sf);

  /** @type {import("typescript").Type | undefined} */
  let found;

  function isTargetExport(hasDirectExportModifier) {
    return hasDirectExportModifier || namedExports.has(exportName);
  }

  function visit(node) {
    if (found !== undefined) return;

    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === exportName &&
      isTargetExport(hasExportModifier(node))
    ) {
      const p0 = node.parameters[0];
      if (p0) found = checker.getTypeAtLocation(p0);
      return;
    }

    if (ts.isVariableStatement(node)) {
      if (!isTargetExport(hasExportModifier(node))) return;

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

        if (ts.isCallExpression(init)) {
          const p0 = firstParamFromForwardRefCall(init);
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
 * @returns {DeclaredPropKind | null}
 */
export function classifyPropType(checker, type) {
  const nn = checker.getNonNullableType(type);
  if (nn.isUnion()) {
    const parts = nn.types.map((u) =>
      classifyPropType(checker, checker.getNonNullableType(u)),
    );
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

/**
 * @param {import("typescript").TypeChecker} checker
 * @param {import("typescript").Type} type
 */
function isPlainStringType(checker, type) {
  const nn = checker.getNonNullableType(type);
  return (
    (nn.flags & ts.TypeFlags.String) !== 0 &&
    (nn.flags & ts.TypeFlags.StringLiteral) === 0
  );
}

/**
 * React and other libs use `string & {}` as an open-string catch-all alongside literals.
 *
 * @param {import("typescript").TypeChecker} checker
 * @param {import("typescript").Type} type
 */
function isOpenStringCatchAllType(checker, type) {
  const nn = checker.getNonNullableType(type);
  if (isPlainStringType(checker, nn)) return true;
  if (!nn.isIntersection?.()) return false;
  const parts = nn.types.map((t) => checker.getNonNullableType(t));
  const hasString = parts.some((p) => (p.flags & ts.TypeFlags.String) !== 0);
  const hasEmptyObject = parts.some((p) => checker.typeToString(p) === "{}");
  return hasString && hasEmptyObject;
}

/**
 * Extract a finite union of string literals suitable for a select control.
 *
 * @param {import("typescript").TypeChecker} checker
 * @param {import("typescript").Type} type
 * @param {{ max?: number; seen?: Set<number> }} [opts]
 * @returns {string[] | null}
 */
export function extractFiniteStringUnion(checker, type, opts = {}) {
  const max = opts.max ?? 32;
  const seen = opts.seen ?? new Set();

  const nn = checker.getNonNullableType(type);
  if (seen.has(nn.id)) return null;
  seen.add(nn.id);

  if (nn.isUnion?.()) {
    /** @type {string[]} */
    const literals = [];
    for (const member of nn.types) {
      if (isOpenStringCatchAllType(checker, member)) continue;
      const part = extractFiniteStringUnion(checker, member, { max, seen });
      if (part === null) {
        if (isPlainStringType(checker, member)) return null;
        continue;
      }
      literals.push(...part);
    }
    const unique = [...new Set(literals)];
    if (unique.length < 2) return null;
    unique.sort();
    return unique.slice(0, max);
  }

  if (nn.aliasSymbol) {
    const aliasType = checker.getDeclaredTypeOfSymbol(nn.aliasSymbol);
    if (aliasType.id !== nn.id) {
      return extractFiniteStringUnion(checker, aliasType, { max, seen });
    }
  }

  if (nn.isStringLiteral()) {
    return [nn.value];
  }

  if (nn.flags & ts.TypeFlags.EnumLiteral) {
    const value = nn.value;
    if (typeof value === "string") return [value];
  }

  return null;
}

/**
 * @param {string} projectRoot
 * @param {string} relPath
 * @returns {import("typescript").SourceFile | undefined}
 */
function sourceFileForRelPath(program, projectRoot, relPath) {
  const abs = resolve(projectRoot, relPath);
  const norm = (p) => p.replace(/\\/g, "/");
  const want = norm(abs);
  return program.getSourceFiles().find((f) => norm(f.fileName) === want);
}

/**
 * @param {import("typescript").TypeChecker} checker
 * @param {import("typescript").Program} program
 * @param {string} projectRoot
 * @param {string} relPath
 * @param {string} exportName
 * @param {string[]} declaredProps
 * @param {{
 *   declared_prop_options?: Record<string, string[]>;
 *   declared_prop_defaults?: Record<string, string>;
 *   declared_prop_kinds?: Record<string, string>;
 * }} [existing]
 */
export function inferPlaygroundPropMetadata(
  checker,
  program,
  projectRoot,
  relPath,
  exportName,
  declaredProps,
  existing = {},
) {
  const sf = sourceFileForRelPath(program, projectRoot, relPath);
  if (!sf) {
    return {
      declared_prop_kinds: existing.declared_prop_kinds ?? {},
      declared_prop_options: existing.declared_prop_options ?? {},
      declared_prop_defaults: existing.declared_prop_defaults ?? {},
    };
  }

  const paramType = findComponentParamType(checker, sf, exportName);
  if (!paramType) {
    return {
      declared_prop_kinds: existing.declared_prop_kinds ?? {},
      declared_prop_options: existing.declared_prop_options ?? {},
      declared_prop_defaults: existing.declared_prop_defaults ?? {},
    };
  }

  /** @type {Record<string, DeclaredPropKind>} */
  const kinds = { ...existing.declared_prop_kinds };
  /** @type {Record<string, string[]>} */
  const options = { ...existing.declared_prop_options };
  /** @type {Record<string, string>} */
  const defaults = { ...existing.declared_prop_defaults };

  for (const key of declaredProps) {
    if (key === "key" || key === "ref") continue;

    const sym = checker.getPropertyOfType(paramType, key);
    if (!sym) continue;
    const propType = checker.getTypeOfSymbol(sym);

    if (!kinds[key]) {
      const kind = classifyPropType(checker, propType);
      if (kind !== null) kinds[key] = kind;
    }

    if (!options[key]) {
      const literals = extractFiniteStringUnion(checker, propType);
      if (literals && literals.length >= 2) {
        options[key] = literals;
        if (key === "type" && literals.includes("text") && !defaults[key]) {
          defaults[key] = "text";
        }
      }
    }
  }

  return {
    declared_prop_kinds: kinds,
    declared_prop_options: options,
    declared_prop_defaults: defaults,
  };
}

export function inferDeclaredPropsFromTsx(projectRoot, relPath, exportName) {
  const abs = resolve(projectRoot, relPath);
  let text;
  try {
    text = readFileSync(abs, "utf8");
  } catch {
    return [];
  }

  const sf = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  /** @type {string[]} */
  const names = [];

  function visit(node) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === exportName &&
      (hasExportModifier(node) || collectNamedExportNames(sf).has(exportName))
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
  return [...new Set(names)].sort();
}
