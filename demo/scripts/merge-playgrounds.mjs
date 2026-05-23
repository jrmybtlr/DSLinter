/**
 * Legacy demo helper: adds `playgrounds` to `public/dslinter-report.json` when the Rust
 * scanner output predates playground emission. Prefer `npm run dslinter:report` (CLI
 * enrichment runs automatically). This script also patches legacy nested paths and
 * infers empty `declared_props` from TSX destructuring.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  createCheckerProgram,
  enrichPlaygroundSpecFromTs,
} from "../../packages/dashboard/src/playground/inferPropTypesFromTs.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const demoRoot = join(__dirname, "..");
const reportPath = join(demoRoot, "public/dslinter-report.json");
const configPath = join(demoRoot, ".dslinter.json");

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
  const namedExports = new Set();
  for (const stmt of sf.statements) {
    if (
      ts.isExportDeclaration(stmt) &&
      stmt.exportClause &&
      ts.isNamedExports(stmt.exportClause)
    ) {
      for (const el of stmt.exportClause.elements) {
        namedExports.add((el.propertyName ?? el.name).text);
      }
    }
  }

  function visit(node) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === exportName &&
      (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ||
        namedExports.has(exportName))
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

const checkerBundle = createCheckerProgram(demoRoot);
const hasPlaygroundGroups = Object.keys(playgroundGroups).length > 0;

const playgrounds = [];
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
  let row = {
    id: def.name,
    export_name: def.name,
    rel_path: rel,
    declared_props: declared,
    ...(def.declared_prop_options && Object.keys(def.declared_prop_options).length
      ? { declared_prop_options: def.declared_prop_options }
      : {}),
    ...(def.declared_prop_defaults && Object.keys(def.declared_prop_defaults).length
      ? { declared_prop_defaults: def.declared_prop_defaults }
      : {}),
  };
  if (playgroundGroupKeyCount > 1) {
    row.group = longestGroup(rel);
  }
  if (checkerBundle) {
    row = enrichPlaygroundSpecFromTs(row, checkerBundle.checker, checkerBundle.program, demoRoot);
  }
  playgrounds.push(row);
}
playgrounds.sort((a, b) => a.rel_path.localeCompare(b.rel_path));

report.playgrounds = playgrounds;
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${reportPath} with ${playgrounds.length} playgrounds`);
