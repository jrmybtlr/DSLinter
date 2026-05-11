/**
 * Adds `playgrounds` to `public/dslint-report.json` using the same rules as dslint Rust
 * (`playground_groups` in `.dslint.json`). Use after `cargo run … --json` when playgrounds
 * are not yet in the CLI output, or run `npm run dslint:report` once Rust is available.
 *
 * Also normalizes legacy nested `src/components/…` paths in older reports to the flat tree,
 * and when `declared_props` is empty, infers binding names from the TSX file via TypeScript.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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

const PLAYABLE = new Set(["function", "class", "const_arrow", "const_function", "wrapped_component"]);

function pickDefinition(definitions, stem) {
  const playable = definitions.filter((d) => PLAYABLE.has(d.kind));
  if (!playable.length) return null;
  const exact = playable.find((d) => d.name === stem);
  if (exact) return exact;
  if (playable.length === 1) return playable[0];
  return null;
}

const playgrounds = [];
if (Object.keys(playgroundGroups).length) {
  for (const file of report.files ?? []) {
    const rel = relPath(file.path);
    if (!rel) continue;
    if (!longestGroup(rel)) continue;
    if (!/\.(tsx|jsx)$/i.test(rel)) continue;
    const stem = rel.split("/").pop()?.replace(/\.(tsx|jsx)$/i, "") ?? "";
    const def = pickDefinition(file.definitions ?? [], stem);
    if (!def) continue;
    let declared = def.declared_props ?? [];
    // Prefer the TSX source-of-truth for destructured props when available.
    // This keeps `declared_props` fresh even if the JSON report is stale or
    // the Rust extractor doesn't populate `declared_props` for a file yet.
    const inferred = inferDeclaredPropsFromTsx(demoRoot, rel, def.name);
    if (inferred.length) {
      if (!declared.length || inferred.length > declared.length) {
        declared = inferred;
      }
    }
    const row = {
      id: stem,
      export_name: def.name,
      rel_path: rel,
      declared_props: declared,
    };
    if (playgroundGroupKeyCount > 1) {
      row.group = longestGroup(rel);
    }
    playgrounds.push(row);
  }
  playgrounds.sort((a, b) => a.rel_path.localeCompare(b.rel_path));
}

report.playgrounds = playgrounds;
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${reportPath} with ${playgrounds.length} playgrounds`);
