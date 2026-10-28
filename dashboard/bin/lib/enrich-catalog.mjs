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

export function sampleForType(checker, type, key = "value", depth = 0, seen = new Set()) {
  type = checker.getNonNullableType(type);
  if (depth > 3 || seen.has(type.id)) return undefined;
  if (type.isUnion())
    return sampleForType(
      checker,
      type.types.find((member) => !(member.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null))) ||
        type.types[0],
      key,
      depth,
      seen,
    );
  if (type.isStringLiteral() || type.isNumberLiteral()) return type.value;
  if (type.flags & ts.TypeFlags.BooleanLiteral) return type.intrinsicName === "true";
  if (type.flags & ts.TypeFlags.Boolean) return false;
  if (type.flags & ts.TypeFlags.NumberLike) return 1;
  if (type.flags & ts.TypeFlags.StringLike) {
    if (/email/i.test(key)) return "example@example.test";
    if (/url|href|src/i.test(key)) return "#";
    return `Example ${key.replace(/([A-Z])/g, " $1").toLowerCase()}`;
  }
  if (type.getCallSignatures().length) return undefined;
  const next = new Set(seen).add(type.id);
  const element = checker.getElementTypeOfArrayType(type);
  if (element)
    return [sampleForType(checker, element, "item", depth + 1, next)].filter(
      (value) => value !== undefined,
    );
  const properties = type.getProperties();
  if (!properties.length || properties.length > 40) return undefined;
  return Object.fromEntries(
    properties
      .slice(0, 20)
      .map((property) => [
        property.name,
        sampleForType(checker, checker.getTypeOfSymbol(property), property.name, depth + 1, next),
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
    spec.declared_prop_kinds[property.name] ||= classifyPropType(checker, type) || "unknown";
    spec.declared_prop_optional[property.name] = Boolean(property.flags & ts.SymbolFlags.Optional);
    spec.declared_prop_type_labels[property.name] = checker.typeToString(type);
    const options = extractFiniteStringUnion(checker, type);
    if (options?.length > 1) spec.declared_prop_options[property.name] ||= options;
    if (
      !(property.flags & ts.SymbolFlags.Optional) &&
      !/^on[A-Z]/.test(property.name) &&
      !["children", "className", "style"].includes(property.name)
    ) {
      const sample = sampleForType(checker, type, property.name);
      if (sample !== undefined) spec.sample_props[property.name] = sample;
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

function createVueProgram(paths, projectRoot, root) {
  const config = ts.readConfigFile(join(projectRoot, "tsconfig.json"), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config || {}, ts.sys, projectRoot);
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
      const { descriptor } = compiler.parse(readFileSync(path, "utf8"), { filename: path });
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
      return { type: "placeholder", hint: node.content.content.split(".").pop() || "Example" };
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
        const { descriptor } = compiler.parse(readFileSync(path, "utf8"), { filename: path });
        if (!descriptor.template) continue;
        const { ast } = compiler.compileTemplate({
          source: descriptor.template.content,
          filename: path,
          id: path,
        });
        templates.set(source.path, { ast, offset: descriptor.template.loc.start.line - 1 });
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
      delete component.metadata_error;
    } catch (error) {
      component.metadata_error = error instanceof Error ? error.message : String(error);
    }
  }
  captureVueExamples(report, root);
  return JSON.stringify(report.components) !== before;
}
