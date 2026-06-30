import { readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { enrichReportFile } from "./enrich-playgrounds-from-ts.mjs";

describe("enrich-playgrounds-from-ts", () => {
  it("writes declared_prop_options for Input.type into report file", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-enrich-"));
    const reportPath = join(root, "report.json");
    try {
      writeFileSync(
        reportPath,
        JSON.stringify(
          {
            root,
            playgrounds: [
              {
                id: "Input",
                export_name: "Input",
                rel_path: "input.tsx",
                declared_props: ["type"],
              },
            ],
          },
          null,
          2,
        ),
      );

      writeFileSync(
        join(root, "tsconfig.json"),
        JSON.stringify(
          {
            compilerOptions: {
              strict: true,
              jsx: "react-jsx",
              module: "ESNext",
              moduleResolution: "bundler",
              noEmit: true,
              skipLibCheck: true,
              typeRoots: [
                join(process.cwd(), "node_modules/@types"),
              ],
            },
            include: ["**/*.tsx"],
          },
          null,
          2,
        ),
      );

      writeFileSync(
        join(root, "input.tsx"),
        `
import * as React from "react";
function Input({ type }: React.ComponentProps<"input">) {
  return <input type={type} />;
}
export { Input };
`,
      );

      expect(enrichReportFile(reportPath, root)).toBe(true);
      const report = JSON.parse(readFileSync(reportPath, "utf8"));
      const input = report.playgrounds[0];
      expect(input.declared_prop_options.type).toContain("email");
      expect(input.declared_prop_defaults.type).toBe("text");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
