import { randomBytes } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import ts from "typescript";
import { catalogFromReport } from "../src/explorer/catalog";
import { notificationAdapterExample } from "../src/explorer/providerRecovery";
import type { WorkspaceReport } from "../src/types/report";
import { findPreviewAdapter, type PreviewApp } from "./previewAdapter";
import { mergePreviewSetup, PreviewSetupConflict } from "./mergePreviewSetup";

function within(root: string, file: string): boolean {
  const tail = relative(realpathSync(root), realpathSync(file));
  return tail === "" || (!tail.startsWith("..") && !isAbsolute(tail));
}

function verifiedNotificationSource(source: string, path: string, exportName: string): boolean {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const exported = file.statements.some((statement) => {
    if (ts.isExportAssignment(statement))
      return exportName === "default" && !statement.isExportEquals;
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    )
      return statement.exportClause.elements.some((item) => item.name.text === exportName);
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    if (!modifiers?.some((item) => item.kind === ts.SyntaxKind.ExportKeyword)) return false;
    if (exportName === "default")
      return modifiers.some((item) => item.kind === ts.SyntaxKind.DefaultKeyword);
    if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.name?.text === exportName
    )
      return true;
    return (
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (item) => ts.isIdentifier(item.name) && item.name.text === exportName,
      )
    );
  });
  return (
    exported &&
    file.statements.some(
      (statement) =>
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === "sonner" &&
        statement.importClause &&
        !statement.importClause.isTypeOnly &&
        statement.importClause.namedBindings &&
        ts.isNamedImports(statement.importClause.namedBindings) &&
        statement.importClause.namedBindings.elements.some(
          (item) => !item.isTypeOnly && (item.propertyName || item.name).text === "Toaster",
        ),
    )
  );
}

/** Generate on the server from the current catalog; never accept executable code from the request. */
export function addPreviewSetup(
  app: PreviewApp,
  scanRoot: string,
  report: WorkspaceReport,
  componentId: string,
): { path: string; created: boolean } {
  const component = catalogFromReport(report).find((item) => item.id === componentId);
  if (!component || component.framework !== "react" || app.framework !== "react")
    throw new PreviewSetupConflict(
      "This component does not have an automatic preview setup available. Use the copyable example instead.",
    );
  const sourcePath = resolve(report.root, component.preview.rel_path);
  if (
    !within(scanRoot, sourcePath) ||
    !/^(?:default|[A-Za-z_$][\w$]*)$/.test(component.preview.export_name)
  )
    throw new PreviewSetupConflict(
      "The component source could not be verified. Refresh the scan and try again.",
    );
  if (
    !verifiedNotificationSource(
      readFileSync(sourcePath, "utf8"),
      sourcePath,
      component.preview.export_name,
    )
  )
    throw new PreviewSetupConflict(
      "The component source has changed. Refresh the scan before adding its preview setup.",
    );
  const path = findPreviewAdapter(app.root, scanRoot) || join(app.root, "dslinter.preview.ts");
  if (!within(app.root, dirname(path)) && !within(scanRoot, dirname(path)))
    throw new PreviewSetupConflict(
      "The preview configuration is outside this workspace. Use the copyable example instead.",
    );
  const existing = existsSync(path);
  if (existing && (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()))
    throw new PreviewSetupConflict(
      "The preview configuration is linked or is not a regular file. Update it manually using the copyable example.",
    );
  try {
    const adapterPackage = createRequire(join(dirname(path), "package.json")).resolve("sonner");
    const componentPackage = createRequire(sourcePath).resolve("sonner");
    if (realpathSync(adapterPackage) !== realpathSync(componentPackage))
      throw new Error("Different packages");
  } catch {
    throw new PreviewSetupConflict(
      "The configuration and component could not resolve the same notification package. Select the component's app, or merge the example manually.",
    );
  }
  const example = notificationAdapterExample(
    component,
    realpathSync(dirname(path)),
    realpathSync(report.root),
  );
  if (!example)
    throw new PreviewSetupConflict(
      "A complete preview setup could not be verified. Use the copyable example instead.",
    );
  const original = existing ? readFileSync(path, "utf8") : "";
  const output = existing
    ? mergePreviewSetup(original, example, component.id, component.name, path)
    : `${example}\n`;
  if (!existing) {
    writeFileSync(path, output, { flag: "wx" });
  } else {
    const temporary = `${path}.${randomBytes(8).toString("hex")}.tmp`;
    try {
      writeFileSync(temporary, output, { flag: "wx", mode: lstatSync(path).mode & 0o777 });
      if (lstatSync(path).isSymbolicLink() || readFileSync(path, "utf8") !== original)
        throw new PreviewSetupConflict(
          "The configuration changed while saving. Its changes were preserved. Try again.",
        );
      renameSync(temporary, path);
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  }
  return { path: relative(scanRoot, path).replaceAll("\\", "/"), created: !existing };
}

export function previewSetupMiddleware(options: {
  token: string;
  apps: PreviewApp[];
  scanRoot: string;
  report: () => WorkspaceReport;
  onSaved: (app: PreviewApp) => Promise<void>;
}) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> => {
    if (req.url?.split("?")[0] !== "/dslinter/preview-setup") return next();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST");
      res.end(
        JSON.stringify({ message: "Use the Add preview setup button to save this configuration." }),
      );
      return;
    }
    if (
      req.headers.origin !== `http://${req.headers.host}` ||
      req.headers["x-dslinter-token"] !== options.token
    ) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          message:
            "The preview setup request could not be verified. Refresh DSLinter and try again.",
        }),
      );
      return;
    }
    try {
      if (!req.headers["content-type"]?.startsWith("application/json"))
        throw new PreviewSetupConflict(
          "The save request was not valid. Refresh DSLinter and try again.",
        );
      let body = "";
      for await (const chunk of req) {
        body += chunk.toString();
        if (body.length > 8192)
          throw new PreviewSetupConflict(
            "The save request was too large. Refresh DSLinter and try again.",
          );
      }
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        throw new PreviewSetupConflict(
          "The save request was not valid. Refresh DSLinter and try again.",
        );
      }
      if (!input || typeof input !== "object")
        throw new PreviewSetupConflict(
          "The save request was not valid. Refresh DSLinter and try again.",
        );
      if (typeof input.app !== "string" || typeof input.componentId !== "string")
        throw new PreviewSetupConflict(
          "The selected app or component is missing. Refresh DSLinter and try again.",
        );
      const app = options.apps.find((item) => item.id === input.app);
      if (!app)
        throw new PreviewSetupConflict(
          "The selected preview app is no longer available. Refresh DSLinter and select it again.",
        );
      const saved = addPreviewSetup(app, options.scanRoot, options.report(), input.componentId);
      // A fresh host discovers newly created adapters and discards old module caches.
      let reloaded = true;
      try {
        await options.onSaved(app);
      } catch {
        reloaded = false;
      }
      res.end(JSON.stringify({ ...saved, reloaded }));
    } catch (error) {
      res.statusCode = error instanceof PreviewSetupConflict ? 409 : 500;
      const message =
        error instanceof PreviewSetupConflict
          ? error.message
          : "The preview setup could not be saved. Check that the configuration is writable, or use the copyable example.";
      res.end(JSON.stringify({ message }));
    }
  };
}
