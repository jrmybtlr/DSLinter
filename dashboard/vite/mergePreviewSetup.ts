import { createHash } from "node:crypto";
import ts from "typescript";

export class PreviewSetupConflict extends Error {}

function parse(source: string, path: string): ts.SourceFile {
  const file = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  if (
    (file as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length
  )
    throw new PreviewSetupConflict(
      "The preview configuration has a syntax error. Fix it before adding this example.",
    );
  return file;
}

function unwrap(expression: ts.Expression): ts.Expression {
  while (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  )
    expression = expression.expression;
  return expression;
}

function objectValue(expression: ts.Expression, file: ts.SourceFile): ts.ObjectLiteralExpression {
  let value = unwrap(expression);
  if (ts.isIdentifier(value)) {
    const name = value.text;
    const declarations = file.statements.flatMap((statement) =>
      ts.isVariableStatement(statement) && statement.declarationList.flags & ts.NodeFlags.Const
        ? [...statement.declarationList.declarations].filter(
            (item) => ts.isIdentifier(item.name) && item.name.text === name,
          )
        : [],
    );
    if (declarations.length === 1 && declarations[0].initializer)
      value = unwrap(declarations[0].initializer);
  }
  if (!ts.isObjectLiteralExpression(value))
    throw new PreviewSetupConflict(
      "This preview configuration is built dynamically. Copy the example into it manually so its existing behavior is preserved.",
    );
  if (
    value.properties.some(
      (property) =>
        ts.isSpreadAssignment(property) ||
        (property.name && ts.isComputedPropertyName(property.name)),
    )
  )
    throw new PreviewSetupConflict(
      "This preview configuration uses spread or computed entries. Copy the example into it manually so existing previews are preserved.",
    );
  return value;
}

function exportedObject(file: ts.SourceFile): ts.ObjectLiteralExpression {
  const assignments = file.statements.filter(
    (statement): statement is ts.ExportAssignment =>
      ts.isExportAssignment(statement) && !statement.isExportEquals,
  );
  if (assignments.length !== 1)
    throw new PreviewSetupConflict(
      "The preview configuration needs a single default export. Copy the example into your configuration manually.",
    );
  return objectValue(assignments[0].expression, file);
}

function propertyName(property: ts.ObjectLiteralElementLike): string | undefined {
  return property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
    ? property.name.text
    : undefined;
}

type Edit = { at: number; text: string };

function appendProperty(
  file: ts.SourceFile,
  object: ts.ObjectLiteralExpression,
  property: string,
): Edit[] {
  const edits: Edit[] = [];
  const last = object.properties.at(-1);
  if (last && !object.properties.hasTrailingComma) edits.push({ at: last.end, text: "," });
  const close = object.end - 1;
  const lineStart = file.text.lastIndexOf("\n", close) + 1;
  const closeIndent = file.text.slice(lineStart, close);
  const indent = /^\s*$/.test(closeIndent) ? closeIndent : "";
  edits.push({ at: close, text: `\n${indent}  ${property},\n${indent}` });
  return edits;
}

/** Only generated imports are renamed; existing source, comments, and bindings stay intact. */
function generatedEntry(
  example: string,
  existing: ts.SourceFile,
  componentId: string,
  path: string,
): { imports: string; entry: string } {
  if (path.endsWith(".js"))
    example = ts.transpileModule(example, {
      compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
    }).outputText;
  const generated = parse(example, path);
  const occupied = new Set<string>();
  function collect(node: ts.Node) {
    if (ts.isIdentifier(node)) occupied.add(node.text);
    ts.forEachChild(node, collect);
  }
  collect(existing);
  const prefix = `__dslinter_${createHash("sha256").update(componentId).digest("hex").slice(0, 10)}_`;
  const aliases = new Map<string, string>();
  function alias(name: ts.Identifier): ts.Identifier {
    let replacement = aliases.get(name.text);
    if (!replacement) {
      replacement = prefix + name.text;
      while (occupied.has(replacement)) replacement += "_";
      occupied.add(replacement);
      aliases.set(name.text, replacement);
    }
    return ts.factory.createIdentifier(replacement);
  }
  const imports: ts.ImportDeclaration[] = [];
  for (const statement of generated.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
    // The outer satisfies clause is not part of the inserted preview entry.
    if (
      statement.importClause.isTypeOnly &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "dslinter/preview"
    )
      continue;
    const clause = statement.importClause;
    let bindings = clause.namedBindings;
    if (bindings && ts.isNamedImports(bindings))
      bindings = ts.factory.updateNamedImports(
        bindings,
        bindings.elements.map((item) =>
          ts.factory.updateImportSpecifier(
            item,
            item.isTypeOnly,
            item.propertyName || item.name,
            alias(item.name),
          ),
        ),
      );
    else if (bindings && ts.isNamespaceImport(bindings))
      bindings = ts.factory.updateNamespaceImport(bindings, alias(bindings.name));
    imports.push(
      ts.factory.updateImportDeclaration(
        statement,
        statement.modifiers,
        ts.factory.updateImportClause(
          clause,
          clause.isTypeOnly,
          clause.name ? alias(clause.name) : undefined,
          bindings,
        ),
        statement.moduleSpecifier,
        statement.attributes,
      ),
    );
  }
  const previews = exportedObject(generated).properties.find(
    (item) => propertyName(item) === "previews",
  );
  if (!previews || !ts.isPropertyAssignment(previews))
    throw new Error("Generated preview setup is invalid");
  const entry = objectValue(previews.initializer, generated).properties.find(
    (item) => propertyName(item) === componentId,
  );
  if (!entry) throw new Error("Generated preview setup does not match the component");
  const transformed = ts.transform(entry, [
    (context) => {
      function visit(node: ts.Node): ts.VisitResult<ts.Node> {
        if (ts.isIdentifier(node) && aliases.has(node.text))
          return ts.factory.createIdentifier(aliases.get(node.text)!);
        return ts.visitEachChild(node, visit, context);
      }
      return (node) => ts.visitNode(node, visit) as typeof node;
    },
  ]);
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const result = {
    imports: imports
      .map((item) => printer.printNode(ts.EmitHint.Unspecified, item, generated))
      .join("\n"),
    entry: printer.printNode(ts.EmitHint.Unspecified, transformed.transformed[0], generated),
  };
  transformed.dispose();
  return result;
}

export function mergePreviewSetup(
  source: string,
  example: string,
  componentId: string,
  componentName: string,
  path: string,
): string {
  const file = parse(source, path);
  const adapter = exportedObject(file);
  const matching = adapter.properties.filter((item) => propertyName(item) === "previews");
  if (matching.length > 1)
    throw new PreviewSetupConflict(
      "The configuration has more than one previews entry. Merge the example manually.",
    );
  let previews: ts.ObjectLiteralExpression | undefined;
  if (matching[0]) {
    if (!ts.isPropertyAssignment(matching[0]))
      throw new PreviewSetupConflict(
        "The previews entry is not a plain object. Merge the example manually.",
      );
    previews = objectValue(matching[0].initializer, file);
    if (
      previews.properties.some((item) =>
        [componentId, componentName].includes(propertyName(item) || ""),
      )
    )
      throw new PreviewSetupConflict(
        `A preview is already configured for ${componentName}. Update that entry manually; it has not been replaced.`,
      );
  }
  const generated = generatedEntry(example, file, componentId, path);
  const edits = appendProperty(
    file,
    previews || adapter,
    previews ? generated.entry : `previews: {\n${generated.entry},\n}`,
  );
  const imports = file.statements.filter(ts.isImportDeclaration);
  let importAt = imports.at(-1)?.end ?? file.statements[0]?.getStart(file) ?? 0;
  if (!imports.length) {
    for (const statement of file.statements) {
      if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
      importAt = statement.end;
    }
  }
  edits.push({ at: importAt, text: `\n${generated.imports}\n` });
  let output = source;
  for (const edit of edits.sort((a, b) => b.at - a.at))
    output = output.slice(0, edit.at) + edit.text + output.slice(edit.at);
  parse(output, path);
  return output;
}
