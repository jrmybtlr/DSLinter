import { resolve } from "node:path";
import ts from "typescript";

/** @typedef {"boolean" | "string" | "number"} PropKind */

const MAX_UNION_OPTIONS = 32;

/** @param {string} projectRoot */
export function createCheckerProgram(projectRoot) {
  const configPath = resolve(projectRoot, "tsconfig.json");
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

/** @param {string} p */
function normalizePath(p) {
  return p.replace(/\\/g, "/");
}

/** @param {ts.Node} node */
function hasExportModifier(node) {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ??
      false)
  );
}

/** @param {ts.SourceFile} sf */
function collectNamedExportLocalNames(sf) {
  /** @type {Set<string>} */
  const names = new Set();
  for (const stmt of sf.statements) {
    if (
      !ts.isExportDeclaration(stmt) ||
      !stmt.exportClause ||
      !ts.isNamedExports(stmt.exportClause)
    ) {
      continue;
    }
    for (const el of stmt.exportClause.elements) {
      names.add((el.propertyName ?? el.name).text);
    }
  }
  return names;
}

/** @param {ts.Expression} init */
function unwrapComponentInitializer(init) {
  if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) return init;
  if (ts.isCallExpression(init)) {
    for (const arg of init.arguments) {
      const inner = unwrapComponentInitializer(arg);
      if (inner) return inner;
    }
  }
  return undefined;
}

/**
 * @param {ts.TypeChecker} checker
 * @param {ts.SourceFile} sf
 * @param {string} exportName
 * @returns {ts.Type | undefined}
 */
export function findComponentParamType(checker, sf, exportName) {
  const namedExports = collectNamedExportLocalNames(sf);
  /** @type {ts.Type | undefined} */
  let found;

  /** @param {ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration} fn */
  function paramTypeFromFn(fn) {
    const p0 = fn.parameters[0];
    return p0 ? checker.getTypeAtLocation(p0) : undefined;
  }

  /** @param {ts.Node} node */
  function visit(node) {
    if (found !== undefined) return;

    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === exportName &&
      (hasExportModifier(node) || namedExports.has(exportName))
    ) {
      found = paramTypeFromFn(node);
      return;
    }

    if (ts.isVariableStatement(node) && hasExportModifier(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || decl.name.text !== exportName || !decl.initializer) {
          continue;
        }
        const inner = unwrapComponentInitializer(decl.initializer);
        if (inner) {
          found = paramTypeFromFn(inner);
          return;
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sf);
  return found;
}

/**
 * @param {ts.TypeChecker} checker
 * @param {ts.Type} type
 * @returns {PropKind | null}
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
    return null;
  }
  if (nn.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral)) return "boolean";
  if (nn.flags & (ts.TypeFlags.Enum | ts.TypeFlags.EnumLiteral)) return "string";
  if (nn.flags & (ts.TypeFlags.Number | ts.TypeFlags.NumberLike)) return "number";
  if (nn.flags & (ts.TypeFlags.String | ts.TypeFlags.StringLike)) return "string";
  return null;
}

/** @param {ts.TypeChecker} checker @param {ts.Type} type */
function followTypeAlias(checker, type) {
  if (type.aliasSymbol) {
    return followTypeAlias(checker, checker.getDeclaredTypeOfSymbol(type.aliasSymbol));
  }
  return type;
}

/** @param {ts.TypeChecker} checker @param {ts.Type} type */
function isBrandedStringCatchAll(checker, type) {
  const nn = checker.getNonNullableType(type);
  if (!nn.isIntersection()) return false;
  let hasOpenString = false;
  let hasEmptyObject = false;
  for (const part of nn.types) {
    const t = checker.getNonNullableType(part);
    if (t.flags & ts.TypeFlags.String && !(t.flags & ts.TypeFlags.StringLiteral)) {
      hasOpenString = true;
      continue;
    }
    if (
      t.flags & ts.TypeFlags.Object &&
      !t.isUnion() &&
      !t.isIntersection() &&
      t.getProperties().length === 0
    ) {
      hasEmptyObject = true;
    }
  }
  return hasOpenString && hasEmptyObject;
}

/** @param {ts.TypeChecker} checker @param {ts.Type} type */
function isRejectUnionMember(checker, type) {
  const nn = checker.getNonNullableType(type);
  if (isBrandedStringCatchAll(checker, nn)) return false;
  if (nn.isUnion()) return false;
  if (nn.isStringLiteral()) return false;
  if (nn.flags & ts.TypeFlags.Undefined) return false;
  if (nn.flags & ts.TypeFlags.Null) return false;
  if (nn.flags & ts.TypeFlags.Never) return false;

  if (nn.flags & ts.TypeFlags.String && !(nn.flags & ts.TypeFlags.StringLiteral)) {
    return true;
  }
  if (nn.flags & (ts.TypeFlags.Number | ts.TypeFlags.NumberLike)) return true;
  if (nn.isIntersection()) return true;
  if (nn.flags & ts.TypeFlags.Object) return true;
  if (nn.flags & ts.TypeFlags.Enum) return true;
  if (nn.flags & ts.TypeFlags.TemplateLiteral) return true;

  return false;
}

/**
 * @param {ts.TypeChecker} checker
 * @param {ts.Type} type
 * @returns {string[] | null}
 */
export function extractFiniteStringUnion(checker, type) {
  const nn = checker.getNonNullableType(followTypeAlias(checker, type));

  if (nn.isUnion()) {
    /** @type {string[]} */
    const literals = [];
    for (const member of nn.types) {
      const memberNn = checker.getNonNullableType(followTypeAlias(checker, member));
      if (isBrandedStringCatchAll(checker, memberNn)) continue;
      if (isRejectUnionMember(checker, memberNn)) return null;
      if (memberNn.isStringLiteral()) {
        literals.push(memberNn.value);
        continue;
      }
      const nested = extractFiniteStringUnion(checker, memberNn);
      if (nested === null) return null;
      literals.push(...nested);
    }
    const unique = [...new Set(literals)].sort();
    if (unique.length < 2) return null;
    return unique.slice(0, MAX_UNION_OPTIONS);
  }

  if (nn.isStringLiteral()) {
    return null;
  }

  return null;
}

/** @param {ts.Program} program @param {string} projectRoot @param {string} relPath */
function sourceFileForRelPath(program, projectRoot, relPath) {
  const abs = normalizePath(resolve(projectRoot, relPath));
  return program.getSourceFiles().find((f) => normalizePath(f.fileName) === abs);
}

/**
 * @param {ts.TypeChecker} checker
 * @param {ts.Program} program
 * @param {string} projectRoot
 * @param {string} relPath
 * @param {string} exportName
 * @param {string[]} declaredProps
 */
export function inferDeclaredPropKindsFromTs(
  checker,
  program,
  projectRoot,
  relPath,
  exportName,
  declaredProps,
) {
  const sf = sourceFileForRelPath(program, projectRoot, relPath);
  if (!sf) return {};

  const paramType = findComponentParamType(checker, sf, exportName);
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

/**
 * @param {import("../types/report.js").PlaygroundSpec} spec
 * @param {ts.TypeChecker} checker
 * @param {ts.Program} program
 * @param {string} projectRoot
 */
export function enrichPlaygroundSpecFromTs(spec, checker, program, projectRoot) {
  const sf = sourceFileForRelPath(program, projectRoot, spec.rel_path);
  if (!sf) return spec;

  const paramType = findComponentParamType(checker, sf, spec.export_name);
  if (!paramType) return spec;

  const declaredPropOptions = { ...spec.declared_prop_options };
  const declaredPropKinds = { ...spec.declared_prop_kinds };
  const declaredPropDefaults = { ...spec.declared_prop_defaults };

  for (const prop of spec.declared_props) {
    if (prop === "key" || prop === "ref") continue;
    const sym = checker.getPropertyOfType(paramType, prop);
    if (!sym) continue;
    const propType = checker.getTypeOfSymbol(sym);

    if (!declaredPropOptions[prop]) {
      const literals = extractFiniteStringUnion(checker, propType);
      if (literals && literals.length >= 2) {
        declaredPropOptions[prop] = literals;
        if (prop === "type" && literals.includes("text") && !declaredPropDefaults[prop]) {
          declaredPropDefaults[prop] = "text";
        }
      }
    }

    if (!declaredPropKinds[prop]) {
      const kind = classifyPropType(checker, propType);
      if (kind !== null) declaredPropKinds[prop] = kind;
    }
  }

  /** @type {import("../types/report.js").PlaygroundSpec} */
  const next = { ...spec };
  if (Object.keys(declaredPropOptions).length) {
    next.declared_prop_options = declaredPropOptions;
  }
  if (Object.keys(declaredPropKinds).length) {
    next.declared_prop_kinds = declaredPropKinds;
  }
  if (Object.keys(declaredPropDefaults).length) {
    next.declared_prop_defaults = declaredPropDefaults;
  }
  return next;
}

/**
 * @param {{ playgrounds?: import("../types/report.js").PlaygroundSpec[] }} report
 * @param {ts.TypeChecker} checker
 * @param {ts.Program} program
 * @param {string} projectRoot
 */
export function enrichPlaygroundsFromReport(report, checker, program, projectRoot) {
  if (!report.playgrounds?.length) return;
  report.playgrounds = report.playgrounds.map((spec) =>
    enrichPlaygroundSpecFromTs(spec, checker, program, projectRoot),
  );
}
