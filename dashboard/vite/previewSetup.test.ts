import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import type { CatalogComponent, WorkspaceReport } from "../src/types/report";
import { addPreviewSetup, previewSetupMiddleware } from "./previewSetup";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "dslinter-setup-"));
  mkdirSync(join(root, "src"));
  mkdirSync(join(root, "node_modules/sonner"), { recursive: true });
  writeFileSync(join(root, "package.json"), '{"type":"module"}');
  writeFileSync(
    join(root, "node_modules/sonner/package.json"),
    '{"name":"sonner","main":"index.js"}',
  );
  writeFileSync(join(root, "node_modules/sonner/index.js"), "module.exports = {};");
  writeFileSync(
    join(root, "src/ToastHost.tsx"),
    'import { Toaster as Sonner } from "sonner"; export function ToastHost() { return <Sonner />; }',
  );
  const component: CatalogComponent = {
    id: "src/ToastHost.tsx#ToastHost",
    name: "ToastHost",
    framework: "react",
    preview: {
      id: "ToastHost",
      rel_path: "src/ToastHost.tsx",
      export_name: "ToastHost",
      declared_props: [],
      component_imports: {
        Sonner: { specifier: "sonner", export_name: "Toaster", importer: "src/ToastHost.tsx" },
      },
    },
    usages: [],
    dependencies: [],
    bindings: {},
  };
  const app = { id: ".", name: "fixture", root, config: "", framework: "react" as const };
  const report = { root: realpathSync(root), components: [component] } as WorkspaceReport;
  return { root, app, report, component, path: join(root, "dslinter.preview.ts") };
}

describe("saving a preview setup", () => {
  it("creates an app adapter from verified source and refuses to overwrite its entry", () => {
    const f = fixture();
    const source = readFileSync(join(f.root, "src/ToastHost.tsx"), "utf8");
    expect(addPreviewSetup(f.app, f.root, f.report, f.component.id)).toEqual({
      path: "dslinter.preview.ts",
      created: true,
    });
    const saved = readFileSync(f.path, "utf8");
    expect(saved).toContain('from "./src/ToastHost.tsx"');
    expect(saved).toContain('toast("Example notification")');
    expect(() => addPreviewSetup(f.app, f.root, f.report, f.component.id)).toThrow(
      "already configured",
    );
    expect(readFileSync(f.path, "utf8")).toBe(saved);
    expect(readFileSync(join(f.root, "src/ToastHost.tsx"), "utf8")).toBe(source);
  });

  it("merges existing configuration and leaves no temporary files", () => {
    const f = fixture();
    writeFileSync(f.path, 'export default { styles: ["./theme.css"], previews: { Other: {} } };');
    const files = readdirSync(f.root);
    expect(addPreviewSetup(f.app, f.root, f.report, f.component.id).created).toBe(false);
    expect(readFileSync(f.path, "utf8")).toContain('styles: ["./theme.css"]');
    expect(readFileSync(f.path, "utf8")).toContain("Other: {}");
    expect(readdirSync(f.root)).toEqual(files);
  });

  it("preserves a dynamic configuration unchanged", () => {
    const f = fixture();
    const source = "export default makeConfig();\n";
    writeFileSync(f.path, source);
    expect(() => addPreviewSetup(f.app, f.root, f.report, f.component.id)).toThrow("dynamically");
    expect(readFileSync(f.path, "utf8")).toBe(source);
  });

  it("supports an existing JavaScript adapter", () => {
    const f = fixture();
    const path = join(f.root, "dslinter.preview.js");
    writeFileSync(path, "export default {};\n");
    expect(addPreviewSetup(f.app, f.root, f.report, f.component.id).path).toBe(
      "dslinter.preview.js",
    );
    expect(readFileSync(path, "utf8")).not.toContain("ComponentProps");
  });

  it.each(["missing-export", "missing-import", "unsupported-framework", "source-escape"])(
    "rejects an outdated or unsupported target: %s",
    (kind) => {
      const f = fixture();
      if (kind === "missing-export")
        writeFileSync(
          join(f.root, "src/ToastHost.tsx"),
          'import { Toaster } from "sonner"; export const Changed = Toaster;',
        );
      if (kind === "missing-import")
        writeFileSync(join(f.root, "src/ToastHost.tsx"), "export const ToastHost = () => null;");
      if (kind === "unsupported-framework") f.component.framework = "vue";
      if (kind === "source-escape")
        f.component.preview.rel_path = join(dirname(f.root), "outside.tsx");
      const files = readdirSync(f.root);
      expect(() => addPreviewSetup(f.app, f.root, f.report, f.component.id)).toThrow();
      expect(readdirSync(f.root)).toEqual(files);
    },
  );

  it("refuses linked configuration files without changing the target", () => {
    const f = fixture();
    const target = join(mkdtempSync(join(tmpdir(), "dslinter-linked-")), "config.ts");
    writeFileSync(target, "export default {};\n");
    symlinkSync(target, f.path);
    expect(() => addPreviewSetup(f.app, f.root, f.report, f.component.id)).toThrow("linked");
    expect(readFileSync(target, "utf8")).toBe("export default {};\n");
  });
});

describe("preview setup request", () => {
  async function send(
    overrides: {
      token?: string;
      origin?: string;
      body?: string;
      onSaved?: () => Promise<void>;
    } = {},
  ) {
    const f = fixture();
    const onSaved = overrides.onSaved || vi.fn(async () => {});
    const handler = previewSetupMiddleware({
      token: "test-token",
      apps: [f.app],
      scanRoot: f.root,
      report: () => f.report,
      onSaved,
    });
    const request = Object.assign(
      Readable.from([overrides.body ?? JSON.stringify({ app: ".", componentId: f.component.id })]),
      {
        url: "/dslinter/preview-setup",
        method: "POST",
        headers: {
          host: "127.0.0.1:5175",
          origin: overrides.origin ?? "http://127.0.0.1:5175",
          "content-type": "application/json",
          "x-dslinter-token": overrides.token ?? "test-token",
        },
      },
    ) as unknown as IncomingMessage;
    let body = "";
    const response = {
      statusCode: 200,
      setHeader() {},
      end(value: string) {
        body = value;
      },
    };
    await handler(request, response as unknown as ServerResponse, () => {});
    return { ...f, response, result: JSON.parse(body), onSaved };
  }

  it("saves and then refreshes the selected host", async () => {
    const f = await send();
    expect(f.response.statusCode).toBe(200);
    expect(f.result).toEqual({ path: "dslinter.preview.ts", created: true, reloaded: true });
    expect(f.onSaved).toHaveBeenCalledWith(f.app);
  });
  it.each([{ token: "wrong" }, { origin: "https://unrelated.example" }])(
    "requires a verified same-origin action: %s",
    async (overrides) => {
      const f = await send(overrides);
      expect(f.response.statusCode).toBe(403);
      expect(readdirSync(f.root)).not.toContain("dslinter.preview.ts");
    },
  );
  it.each(["null", "{", JSON.stringify({ app: ".", componentId: "other" }), " ".repeat(8193)])(
    "leaves files unchanged for invalid requests",
    async (body) => {
      const f = await send({ body });
      expect(f.response.statusCode).toBe(409);
      expect(readdirSync(f.root)).not.toContain("dslinter.preview.ts");
    },
  );
  it("reports a saved file separately from a failed host restart", async () => {
    const f = await send({
      onSaved: async () => {
        throw new Error("Restart failed");
      },
    });
    expect(f.response.statusCode).toBe(200);
    expect(f.result.reloaded).toBe(false);
    expect(readFileSync(f.path, "utf8")).toContain("Show notification");
  });
});
