import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve, relative, basename } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import {
  createCheckerProgram,
  classifyPropType,
  extractFiniteStringUnion,
} from "./infer-prop-types-from-ts.mjs";
import { discoverApps } from "./workspace.mjs";

function compilerFor(path, root) {
  try {
    return createRequire(path)("vue/compiler-sfc");
  } catch {
    for (const app of discoverApps(root).filter((app) => app.framework === "vue")) {
      try {
        return createRequire(join(app.root, "package.json"))("vue/compiler-sfc");
      } catch {}
    }
    throw new Error("Install Vue in the selected application to infer shared SFC metadata");
  }
}

/** Arrays get a few rows so lists, separators and "first item" logic all have something to show. */
const SAMPLE_ROWS = 3;
/** Fixed so snapshots and previews stay stable between runs. */
const SAMPLE_EPOCH = Date.UTC(2025, 5, 2, 9);

function sampleString(key, index) {
  const suffix = index ? ` ${index + 1}` : "";
  if (/email/i.test(key)) return `example${suffix.trim()}@example.test`;
  if (/url|href|src|link/i.test(key)) return "#";
  if (/^id$|Id$|uuid|slug/i.test(key)) return `example-${index + 1}`;
  if (/date|time|At$|timestamp|day$/i.test(key)) {
    // Local ISO without a zone so `slice(11, 13)` style parsing and `new Date()` both work.
    const iso = new Date(SAMPLE_EPOCH + index * 3_600_000).toISOString().slice(0, 19);
    return /date|day$/i.test(key) && !/time/i.test(key) ? iso.slice(0, 10) : iso;
  }
  if (/colou?r/i.test(key)) return ["#2563eb", "#16a34a", "#d97706"][index % 3];
  return `Example ${key.replace(/([A-Z])/g, " $1").toLowerCase()}${suffix}`;
}

function sampleNumber(key, index) {
  if (/temp/i.test(key)) return 18 + index;
  if (/chance|percent|pct|progress|probability|ratio/i.test(key))
    return Math.min(100, 30 + index * 20);
  if (/^lat/i.test(key)) return 51.5;
  if (/^(lon|lng)/i.test(key)) return -0.12;
  if (/year/i.test(key)) return 2025;
  if (/hour/i.test(key)) return 9 + index;
  if (/price|amount|cost|total|balance/i.test(key)) return 12.5 * (index + 1);
  if (/^code$|Code$/.test(key)) return 0;
  return index + 1;
}

export function sampleForType(
  checker,
  type,
  key = "value",
  depth = 0,
  seen = new Set(),
  index = 0,
) {
  type = checker.getNonNullableType(type);
  if (depth > 3 || seen.has(type.id)) return undefined;
  // `boolean` is the union `true | false`; decide by name before the union branch picks `false`.
  if (type.flags & ts.TypeFlags.Boolean)
    return /^(is|has)?(day|visible|active|enabled|available|online|open|shown)$/i.test(key);
  if (type.isUnion())
    return sampleForType(
      checker,
      type.types.find((member) => !(member.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null))) ||
        type.types[0],
      key,
      depth,
      seen,
      index,
    );
  if (type.isStringLiteral() || type.isNumberLiteral()) return type.value;
  if (type.flags & ts.TypeFlags.BooleanLiteral) return type.intrinsicName === "true";
  if (type.flags & ts.TypeFlags.NumberLike) return sampleNumber(key, index);
  if (type.flags & ts.TypeFlags.StringLike) return sampleString(key, index);
  if (type.getCallSignatures().length) return undefined;
  // JSON fixtures cannot carry class instances; an empty object would only crash `.getTime()`.
  if (["Date", "Map", "Set", "Promise", "RegExp"].includes(type.getSymbol()?.getName()))
    return undefined;
  const next = new Set(seen).add(type.id);
  const element = checker.getElementTypeOfArrayType(type);
  if (element)
    return Array.from({ length: SAMPLE_ROWS }, (_, row) =>
      sampleForType(checker, element, "item", depth + 1, next, row),
    ).filter((value) => value !== undefined);
  const properties = type.getProperties();
  if (!properties.length || properties.length > 40) return undefined;
  return Object.fromEntries(
    properties
      .slice(0, 20)
      .map((property) => [
        property.name,
        sampleForType(
          checker,
          checker.getTypeOfSymbol(property),
          property.name,
          depth + 1,
          next,
          index,
        ),
      ])
      .filter(([, value]) => value !== undefined),
  );
}

function applyType(spec, checker, type, location) {
  const props = type
    .getProperties()
    .filter(
      (property) =>
        property.declarations?.some(
          (decl) => !decl.getSourceFile().fileName.includes("node_modules"),
        ) || spec.declared_props.includes(property.name),
    );
  spec.sample_props = {};
  spec.declared_prop_kinds ||= {};
  spec.declared_prop_options ||= {};
  spec.declared_prop_optional ||= {};
  spec.declared_prop_type_labels ||= {};
  for (const property of props) {
    if (["ref", "key", "props"].includes(property.name)) continue;
    if (!spec.declared_props.includes(property.name)) spec.declared_props.push(property.name);
    const type = checker.getTypeOfSymbolAtLocation(property, property.valueDeclaration || location);
    spec.declared_prop_kinds[property.name] = classifyPropType(checker, type) || "unknown";
    spec.declared_prop_optional[property.name] = Boolean(property.flags & ts.SymbolFlags.Optional);
    spec.declared_prop_type_labels[property.name] = checker.typeToString(type);
    const options = extractFiniteStringUnion(checker, type);
    if (options?.length > 1) spec.declared_prop_options[property.name] ||= options;
    // Optional collections are usually the data the component lists; without them a
    // `v-for`/`.map` renders nothing. Optional flags and scalars keep their defaults.
    const optionalData =
      ["object", "stringArray", "numberArray"].includes(spec.declared_prop_kinds[property.name]) &&
      !/^(errors?|warnings?|style|attrs|ui|pt)$/i.test(property.name) &&
      !checker.getNonNullableType(type).getCallSignatures().length;
    if (
      (!(property.flags & ts.SymbolFlags.Optional) || optionalData) &&
      !/^on[A-Z]/.test(property.name) &&
      !["children", "className", "style", "class", "as", "asChild"].includes(property.name)
    ) {
      const sample = sampleForType(checker, type, property.name);
      if (sample !== undefined) spec.sample_props[property.name] = sample;
    }
  }
}

const RUNTIME_PROP_TYPES = {
  String: ["string", (key) => sampleString(key, 0)],
  Number: ["number", (key) => sampleNumber(key, 0)],
  Boolean: ["boolean", () => false],
  Array: ["object", () => undefined],
  Object: ["object", () => undefined],
  Function: ["function", () => undefined],
  Date: ["object", () => undefined],
};

/** Options API style: `defineProps({ items: { type: Array as PropType<Item[]>, required: true } })`. */
function applyRuntimeProps(spec, checker, argument, sf) {
  spec.sample_props ||= {};
  spec.declared_prop_kinds ||= {};
  spec.declared_prop_optional ||= {};
  spec.declared_prop_type_labels ||= {};
  spec.declared_prop_defaults ||= {};
  const unwrap = (node) =>
    ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node)
      ? unwrap(node.expression)
      : node;
  if (ts.isArrayLiteralExpression(argument)) {
    for (const element of argument.elements)
      if (ts.isStringLiteral(element) && !spec.declared_props.includes(element.text))
        spec.declared_props.push(element.text);
    return;
  }
  if (!ts.isObjectLiteralExpression(argument)) return;
  for (const property of argument.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = property.name.getText(sf).replace(/^["']|["']$/g, "");
    if (!spec.declared_props.includes(name)) spec.declared_props.push(name);
    let typeNode = property.initializer;
    let required = false;
    let defaulted = false;
    if (ts.isObjectLiteralExpression(property.initializer)) {
      typeNode = undefined;
      for (const option of property.initializer.properties) {
        if (!ts.isPropertyAssignment(option)) continue;
        const key = option.name.getText(sf);
        if (key === "type") typeNode = option.initializer;
        if (key === "required") required = option.initializer.kind === ts.SyntaxKind.TrueKeyword;
        if (key === "default") {
          defaulted = true;
          if (ts.isStringLiteral(option.initializer) || ts.isNumericLiteral(option.initializer))
            spec.declared_prop_defaults[name] = option.initializer.text;
        }
      }
    }
    if (!typeNode) continue;
    // `Array as PropType<Item[]>` carries the real element type; prefer it over the constructor.
    const asType =
      ts.isAsExpression(typeNode) &&
      ts.isTypeReferenceNode(typeNode.type) &&
      typeNode.type.typeArguments?.[0];
    const ctor = unwrap(typeNode);
    const constructor = ts.isIdentifier(ctor) ? RUNTIME_PROP_TYPES[ctor.text] : undefined;
    spec.declared_prop_optional[name] = !required;
    if (asType) {
      const type = checker.getTypeFromTypeNode(asType);
      spec.declared_prop_kinds[name] = classifyPropType(checker, type) || "unknown";
      spec.declared_prop_type_labels[name] = checker.typeToString(type);
      const options = extractFiniteStringUnion(checker, type);
      if (options?.length > 1) (spec.declared_prop_options ||= {})[name] ||= options;
      const data = ["object", "stringArray", "numberArray"].includes(
        spec.declared_prop_kinds[name],
      );
      if ((required || (data && !defaulted)) && !/^on[A-Z]/.test(name)) {
        const sample = sampleForType(checker, type, name);
        if (sample !== undefined) spec.sample_props[name] = sample;
      }
    } else if (constructor) {
      spec.declared_prop_kinds[name] = constructor[0];
      spec.declared_prop_type_labels[name] = ctor.text.toLowerCase();
      const sample = required ? constructor[1](name) : undefined;
      if (sample !== undefined) spec.sample_props[name] = sample;
    }
  }
}

function nearestTsconfig(path, root) {
  for (let dir = dirname(path); dir.startsWith(root); dir = dirname(dir)) {
    if (existsSync(join(dir, "tsconfig.json"))) return dir;
    if (dir === dirname(dir)) break;
  }
  return root;
}

const VUE_EXTENSIONS = [
  {
    extension: ".vue",
    isMixedContent: true,
    scriptKind: ts.ScriptKind.Deferred,
  },
];

/**
 * Nuxt 4 and Vite templates keep compiler options (including the `~`/`@` aliases) in
 * referenced projects; a references-only root config resolves no aliased types.
 */
function vueCompilerConfig(paths, projectRoot) {
  const configPath = join(projectRoot, "tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(
    config.config || {},
    ts.sys,
    projectRoot,
    undefined,
    configPath,
    undefined,
    VUE_EXTENSIONS,
  );
  if (!parsed.projectReferences?.length || parsed.options.paths) return parsed;
  const wanted = new Set(paths.map((path) => resolve(path)));
  let fallback;
  for (const reference of parsed.projectReferences) {
    const referencePath = ts.resolveProjectReferencePath(reference);
    if (!existsSync(referencePath)) continue;
    const referenced = ts.readConfigFile(referencePath, ts.sys.readFile);
    if (referenced.error) continue;
    const child = ts.parseJsonConfigFileContent(
      referenced.config,
      ts.sys,
      dirname(referencePath),
      undefined,
      referencePath,
      undefined,
      VUE_EXTENSIONS,
    );
    if (child.fileNames.some((file) => wanted.has(resolve(file)))) return child;
    fallback ||= child.options.paths ? child : undefined;
  }
  return fallback || parsed;
}

function createVueProgram(paths, projectRoot, root) {
  const parsed = vueCompilerConfig(paths, projectRoot);
  const options = {
    ...parsed.options,
    target: ts.ScriptTarget.Latest,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    module: ts.ModuleKind.ESNext,
    skipLibCheck: true,
  };
  const scripts = new Map(
    paths.map((path) => {
      const compiler = compilerFor(path, root);
      const { descriptor } = compiler.parse(readFileSync(path, "utf8"), {
        filename: path,
      });
      return [
        path + ".ts",
        [descriptor.script?.content, descriptor.scriptSetup?.content].filter(Boolean).join("\n"),
      ];
    }),
  );
  const host = ts.createCompilerHost(options);
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (file, language, ...rest) =>
    scripts.has(file)
      ? ts.createSourceFile(file, scripts.get(file), language, true)
      : original(file, language, ...rest);
  const program = ts.createProgram([...scripts.keys()], options, host);
  return { program, checker: program.getTypeChecker() };
}

function vueMetadata(spec, path, compiler, bundle) {
  const source = readFileSync(path, "utf8");
  const { descriptor, errors } = compiler.parse(source, { filename: path });
  if (errors.length) throw new Error(String(errors[0]));
  if (descriptor.script || descriptor.scriptSetup) compiler.compileScript(descriptor, { id: path });
  const virtualPath = path + ".ts";
  const { program, checker } = bundle;
  const sf = program.getSourceFile(virtualPath);
  spec.slots = [];
  spec.models = [];
  spec.emits = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text;
      if (name === "defineProps" && node.typeArguments?.[0])
        applyType(spec, checker, checker.getTypeFromTypeNode(node.typeArguments[0]), sf);
      else if (name === "defineProps" && node.arguments[0])
        applyRuntimeProps(spec, checker, node.arguments[0], sf);
      if (name === "defineModel") {
        const key =
          node.arguments[0] && ts.isStringLiteral(node.arguments[0])
            ? node.arguments[0].text
            : "modelValue";
        spec.models.push(key);
        if (!spec.declared_props.includes(key)) spec.declared_props.push(key);
        spec.declared_prop_kinds ||= {};
        spec.declared_prop_kinds[key] = node.typeArguments?.[0]
          ? classifyPropType(checker, checker.getTypeFromTypeNode(node.typeArguments[0])) ||
            "string"
          : "string";
      }
      if (name === "defineSlots" && node.typeArguments?.[0])
        spec.slots.push(
          ...checker
            .getTypeFromTypeNode(node.typeArguments[0])
            .getProperties()
            .map((property) => property.name),
        );
      if (name === "defineEmits" && node.typeArguments?.[0])
        spec.emits.push(
          ...checker
            .getTypeFromTypeNode(node.typeArguments[0])
            .getProperties()
            .map((property) => property.name),
        );
      if (
        name === "defineEmits" &&
        node.arguments[0] &&
        ts.isArrayLiteralExpression(node.arguments[0])
      )
        spec.emits.push(
          ...node.arguments[0].elements.filter(ts.isStringLiteral).map((node) => node.text),
        );
      if (
        name === "withDefaults" &&
        node.arguments[1] &&
        ts.isObjectLiteralExpression(node.arguments[1])
      ) {
        spec.declared_prop_defaults ||= {};
        for (const property of node.arguments[1].properties)
          if (
            ts.isPropertyAssignment(property) &&
            (ts.isStringLiteral(property.initializer) || ts.isNumericLiteral(property.initializer))
          )
            spec.declared_prop_defaults[property.name.getText(sf)] = property.initializer.text;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  if (descriptor.template) {
    const template = compiler.compileTemplate({
      source: descriptor.template.content,
      filename: path,
      id: path,
    });
    function slots(node) {
      if (node.tag === "slot")
        spec.slots.push(
          node.props?.find((prop) => prop.type === 6 && prop.name === "name")?.value?.content ||
            "default",
        );
      for (const child of node.children || []) slots(child);
    }
    if (template.ast) slots(template.ast);
  }
  spec.slots = [...new Set(spec.slots)];
  spec.emits = [...new Set(spec.emits)];
}

/** Enrichment is optional; a malformed component must not suppress the catalog. */
function captureVueExamples(report, root) {
  const templates = new Map();
  function literal(source) {
    const expression = ts.createSourceFile(
      "expression.ts",
      `const value = (${source})`,
      ts.ScriptTarget.Latest,
      true,
    );
    let node = expression.statements[0]?.declarationList?.declarations[0]?.initializer;
    if (node && ts.isParenthesizedExpression(node)) node = node.expression;
    if (node && ts.isStringLiteral(node)) return { kind: "string", value: node.text };
    if (node && ts.isNumericLiteral(node)) return { kind: "number", value: Number(node.text) };
    if (node?.kind === ts.SyntaxKind.TrueKeyword || node?.kind === ts.SyntaxKind.FalseKeyword)
      return { kind: "bool", value: node.kind === ts.SyntaxKind.TrueKeyword };
  }
  function capture(node, depth = 0, budget = { remaining: 80 }) {
    if (node.type === 12) return capture(node.content, depth, budget);
    if (depth > 12 || budget.remaining-- <= 0) return;
    if (node.type === 2) return { type: "text", value: node.content };
    if (node.type === 5)
      return {
        type: "placeholder",
        hint: node.content.content.split(".").pop() || "Example",
      };
    if (node.type !== 1) return;
    const props = {};
    let slot;
    for (const prop of node.props || []) {
      if (prop.type === 6)
        props[prop.name === "class" ? "className" : prop.name] = prop.value
          ? { kind: "string", value: prop.value.content }
          : { kind: "bool", value: true };
      else if (prop.name === "bind" && prop.arg?.isStatic && prop.exp) {
        const value = literal(prop.exp.content);
        if (value) props[prop.arg.content] = value;
      } else if (prop.name === "slot") slot = prop.arg?.content || "default";
    }
    return {
      type: "element",
      name: node.tag,
      props,
      ...(slot ? { slot } : {}),
      children: (node.children || [])
        .map((child) => capture(child, depth + 1, budget))
        .filter(Boolean),
    };
  }
  for (const component of report.components) {
    const source = component.example_source;
    if (component.framework !== "vue" || !source?.path.endsWith(".vue")) continue;
    try {
      if (!templates.has(source.path)) {
        const path = resolve(root, source.path);
        const compiler = compilerFor(path, root);
        const { descriptor } = compiler.parse(readFileSync(path, "utf8"), {
          filename: path,
        });
        if (!descriptor.template) continue;
        const { ast } = compiler.compileTemplate({
          source: descriptor.template.content,
          filename: path,
          id: path,
        });
        templates.set(source.path, {
          ast,
          offset: descriptor.template.loc.start.line - 1,
        });
      }
      const { ast, offset } = templates.get(source.path);
      let candidate;
      function visit(node) {
        if (
          node.type === 1 &&
          node.loc.start.line + offset === source.line &&
          (node.tag === component.name || component.bindings[node.tag] === component.id)
        )
          candidate ||= capture(node);
        for (const child of node.children || []) visit(child);
        for (const branch of node.branches || []) visit(branch);
      }
      if (ast) visit(ast);
      if (candidate) component.preview.example_tree = candidate;
    } catch (error) {
      if (process.env.DSLINTER_DEBUG === "1")
        process.stderr.write(`dslinter Vue example: ${error}\n`);
    }
  }
}

function sourceImports(path, root) {
  const text = readFileSync(path, "utf8");
  const source = path.endsWith(".vue")
    ? [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\b[^>]*>/gi)]
        .map((match) => match[1])
        .join("\n")
    : text;
  const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const bindings = {};
  for (const statement of sf.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      statement.importClause?.isTypeOnly ||
      !statement.importClause
    )
      continue;
    const specifier = statement.moduleSpecifier.text;
    const importer = relative(root, path).replaceAll("\\", "/");
    const clause = statement.importClause;
    if (clause.name)
      bindings[clause.name.text] = {
        specifier,
        importer,
        export_name: "default",
      };
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings))
      bindings[clause.namedBindings.name.text] = {
        specifier,
        importer,
        export_name: "*",
      };
    else
      for (const binding of clause.namedBindings?.elements || [])
        if (!binding.isTypeOnly)
          bindings[binding.name.text] = {
            specifier,
            importer,
            export_name: binding.propertyName?.text || binding.name.text,
          };
  }
  return bindings;
}

const REVEAL_NAME =
  /^(?:open$|isOpen$|visible$|isVisible$|show[A-Z]|can[A-Z]|message$|title$|description$|label$|children$)/;
/** Guards that switch to a degraded state rather than revealing the component's content. */
const DEGRADED_NAME =
  /^(?:is)?(?:loading|pending|error|errors|disabled|hidden|empty|readonly|skeleton|busy|failed|offline|collapsed)$/i;
const REVEAL_KINDS = ["boolean", "string", "node"];
const TEMPLATE_KINDS = ["boolean", "string", "number", "object", "stringArray", "numberArray"];

function visibilityProps(path, spec) {
  const sf = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const named = new Set();
  const guarded = new Set();
  function collect(node, template = false) {
    if (ts.isIdentifier(node)) {
      const kind = spec.declared_prop_kinds?.[node.text];
      if (REVEAL_NAME.test(node.text) && REVEAL_KINDS.includes(kind)) named.add(node.text);
      // A template guard on any data prop (`v-if="hours.length"`, `v-if="forecast"`) is a
      // reveal candidate as long as it is not a loading/error/disabled switch.
      else if (
        template &&
        TEMPLATE_KINDS.includes(kind) &&
        !DEGRADED_NAME.test(node.text) &&
        spec.sample_props?.[node.text] === undefined
      )
        guarded.add(node.text);
    }
    ts.forEachChild(node, (child) => collect(child, template));
  }
  function visit(node) {
    if (ts.isIfStatement(node) || ts.isConditionalExpression(node))
      collect(node.condition || node.expression);
    if (
      ts.isJsxAttribute(node) &&
      ["open", "visible"].includes(node.name.getText(sf)) &&
      node.initializer
    )
      collect(node.initializer);
    ts.forEachChild(node, visit);
  }
  visit(sf);
  if (path.endsWith(".vue")) {
    const text = readFileSync(path, "utf8");
    for (const match of text.matchAll(
      /(?:v-if|v-else-if|v-show|:(?:open|visible))=["']([^"']+)["']/g,
    )) {
      const condition = ts.createSourceFile(
        "condition.ts",
        `(${match[1]})`,
        ts.ScriptTarget.Latest,
        true,
      );
      // Skip member names (`item.chance`) so only bare prop references count.
      (function walk(node) {
        if (ts.isPropertyAccessExpression(node)) return walk(node.expression);
        if (ts.isIdentifier(node)) return collect(node, true);
        ts.forEachChild(node, walk);
      })(condition);
    }
  }
  return [...named, ...guarded].slice(0, 4);
}

function visibilityValue(spec, key) {
  const kind = spec.declared_prop_kinds?.[key];
  if (kind === "boolean") return true;
  if (kind === "number") return sampleNumber(key, 0);
  if (kind === "stringArray") return [0, 1, 2].map((index) => sampleString("item", index));
  if (kind === "numberArray") return [1, 2, 3];
  if (kind === "object") return undefined;
  return `Example ${key}`;
}

export function enrichCatalog(report, root) {
  if (!Array.isArray(report.components)) return false;
  const before = JSON.stringify(report.components);
  const programs = new Map();
  const vuePrograms = new Map();
  for (const component of report.components) {
    const spec = component.preview;
    spec.declared_props ||= [];
    const path = resolve(root, spec.rel_path);
    try {
      if (component.example_source)
        spec.source_imports = sourceImports(resolve(root, component.example_source.path), root);
      spec.component_imports = sourceImports(path, root);
    } catch {}
    try {
      const native = readFileSync(path, "utf8").match(/<(input|button)(?:\s|\/?>)/);
      if (native) spec.native_element = native[1];
      const stem = basename(path).replace(/\.[^.]+$/, "");
      if (stem.replace(/[-_]/g, "").toLowerCase() === component.name.toLowerCase()) {
        const example = ["tsx", "jsx"]
          .map((extension) => join(dirname(path), `${stem}.playground.${extension}`))
          .find(existsSync);
        if (example) {
          const sf = ts.createSourceFile(
            example,
            readFileSync(example, "utf8"),
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TSX,
          );
          const names = sf.statements
            .filter(
              (statement) =>
                ts.isVariableStatement(statement) &&
                statement.modifiers?.some(
                  (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
                ),
            )
            .flatMap((statement) => statement.declarationList.declarations)
            .filter((decl) => ts.isIdentifier(decl.name))
            .map((decl) => decl.name.text);
          const exported =
            names.find(
              (name) =>
                name.replace(/Playground$/, "").toLowerCase() === component.name.toLowerCase(),
            ) || (names.length === 1 ? names[0] : undefined);
          if (exported)
            spec.manual_preview = {
              rel_path: relative(root, example).replaceAll("\\", "/"),
              export_name: exported,
            };
        }
      }
      if (component.framework === "vue" && path.endsWith(".vue")) {
        const projectRoot = nearestTsconfig(path, root);
        if (!vuePrograms.has(projectRoot)) {
          const paths = report.components
            .filter((item) => item.framework === "vue" && item.preview.rel_path.endsWith(".vue"))
            .map((item) => resolve(root, item.preview.rel_path))
            .filter((path) => nearestTsconfig(path, root) === projectRoot);
          vuePrograms.set(projectRoot, createVueProgram(paths, projectRoot, root));
        }
        vueMetadata(spec, path, compilerFor(path, root), vuePrograms.get(projectRoot));
      } else {
        const projectRoot = nearestTsconfig(path, root);
        if (!programs.has(projectRoot)) {
          let bundle = createCheckerProgram(projectRoot);
          if (!bundle?.program.getSourceFile(path)) {
            const paths = report.components
              .filter((item) => !item.preview.rel_path.endsWith(".vue"))
              .map((item) => resolve(root, item.preview.rel_path))
              .filter((path) => nearestTsconfig(path, root) === projectRoot);
            const program = ts.createProgram(paths, {
              jsx: ts.JsxEmit.ReactJSX,
              allowJs: true,
              strict: true,
              module: ts.ModuleKind.ESNext,
              moduleResolution: ts.ModuleResolutionKind.Bundler,
              skipLibCheck: true,
              ...bundle?.program.getCompilerOptions(),
            });
            bundle = { program, checker: program.getTypeChecker() };
          }
          programs.set(projectRoot, bundle);
        }
        const bundle = programs.get(projectRoot);
        if (!bundle) continue;
        const { checker, program } = bundle;
        const sf = program.getSourceFile(path);
        if (!sf) continue;
        const module = checker.getSymbolAtLocation(sf);
        let exported =
          module &&
          checker.getExportsOfModule(module).find((symbol) => symbol.name === spec.export_name);
        if (exported?.flags & ts.SymbolFlags.Alias) exported = checker.getAliasedSymbol(exported);
        if (!exported) continue;
        const type = checker.getTypeOfSymbolAtLocation(exported, sf);
        const signature = type.getCallSignatures()[0] || type.getConstructSignatures()[0];
        const parameter = signature?.getParameters()[0];
        const publicProps = type.getConstructSignatures()[0]?.getReturnType().getProperty("$props");
        const propType = publicProps
          ? checker.getTypeOfSymbolAtLocation(publicProps, sf)
          : parameter &&
            checker.getTypeOfSymbolAtLocation(parameter, parameter.valueDeclaration || sf);
        if (propType) {
          if (component.framework === "vue") {
            const editable =
              /^(modelValue|defaultValue|open|defaultOpen|checked|defaultChecked|disabled|required|name|multiple|orientation|delayDuration)$/;
            spec.declared_props = propType
              .getProperties()
              .map((property) => property.name)
              .filter((name) => editable.test(name));
            spec.models = ["modelValue", "open", "checked"].filter((name) =>
              spec.declared_props.includes(name),
            );
          }
          applyType(spec, checker, propType, sf);
          for (const model of spec.models || []) {
            if (
              spec.declared_prop_kinds?.[model] === "unknown" ||
              /\bT\b/.test(spec.declared_prop_type_labels?.[model] || "")
            )
              spec.declared_prop_kinds[model] =
                model === "open" || model === "checked" || /Checkbox|Switch/.test(component.name)
                  ? "boolean"
                  : "string";
          }
        }
      }
      spec.visibility_props = visibilityProps(path, spec).filter(
        (key) => visibilityValue(spec, key) !== undefined,
      );
      spec.visibility_values = Object.fromEntries(
        spec.visibility_props.map((key) => [key, visibilityValue(spec, key)]),
      );
      delete component.metadata_error;
    } catch (error) {
      component.metadata_error = error instanceof Error ? error.message : String(error);
    }
  }
  captureVueExamples(report, root);
  return JSON.stringify(report.components) !== before;
}
