import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const reactTypesRoot = join(packageRoot, "node_modules/@types");
import {
  classifyPropType,
  createCheckerProgram,
  extractFiniteStringUnion,
  findComponentParamType,
  inferPlaygroundPropMetadata,
} from "./infer-prop-types-from-ts.mjs";

/**
 * @param {string} root
 * @param {Record<string, string>} files
 */
function writeProject(root, files) {
  mkdirSync(root, { recursive: true });
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
          typeRoots: [reactTypesRoot],
        },
        include: ["**/*.tsx"],
      },
      null,
      2,
    ),
  );
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, content);
  }
}

describe("infer-prop-types-from-ts", () => {
  it("extracts finite string union literals", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-ts-"));
    try {
      writeProject(root, {
        "Union.tsx": `
export function Union({ mode }: { mode: "text" | "email" | "password" }) {
  return <input type={mode} />;
}
`,
      });
      const bundle = createCheckerProgram(root);
      expect(bundle).not.toBeNull();
      const sf = bundle.program.getSourceFile(join(root, "Union.tsx"));
      expect(sf).toBeDefined();
      const paramType = findComponentParamType(bundle.checker, sf, "Union");
      expect(paramType).toBeDefined();
      const sym = bundle.checker.getPropertyOfType(paramType, "mode");
      expect(sym).toBeDefined();
      const propType = bundle.checker.getTypeOfSymbol(sym);
      expect(extractFiniteStringUnion(bundle.checker, propType)).toEqual([
        "email",
        "password",
        "text",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects unions that include plain string", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-ts-"));
    try {
      writeProject(root, {
        "Wide.tsx": `
export function Wide({ label }: { label: string | "foo" }) {
  return <span>{label}</span>;
}
`,
      });
      const bundle = createCheckerProgram(root);
      const sf = bundle.program.getSourceFile(join(root, "Wide.tsx"));
      const paramType = findComponentParamType(bundle.checker, sf, "Wide");
      const sym = bundle.checker.getPropertyOfType(paramType, "label");
      const propType = bundle.checker.getTypeOfSymbol(sym);
      expect(extractFiniteStringUnion(bundle.checker, propType)).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("finds param type for function + export { Name }", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-ts-"));
    try {
      writeProject(root, {
        "Input.tsx": `
function Input({ type }: { type?: "text" | "password" }) {
  return <input type={type} />;
}
export { Input };
`,
      });
      const bundle = createCheckerProgram(root);
      const sf = bundle.program.getSourceFile(join(root, "Input.tsx"));
      expect(findComponentParamType(bundle.checker, sf, "Input")).toBeDefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("infers type select options for ComponentProps input wrapper", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-ts-"));
    try {
      writeProject(root, {
        "input.tsx": `
import * as React from "react";

function Input({ className, type, placeholder, ...props }: React.ComponentProps<"input">) {
  return <input type={type} placeholder={placeholder} className={className} {...props} />;
}

export { Input };
`,
      });
      const bundle = createCheckerProgram(root);
      const meta = inferPlaygroundPropMetadata(
        bundle.checker,
        bundle.program,
        root,
        "input.tsx",
        "Input",
        ["className", "type", "placeholder"],
      );
      expect(meta.declared_prop_kinds.type).toBe("string");
      expect(meta.declared_prop_options.type).toBeDefined();
      expect(meta.declared_prop_options.type.length).toBeGreaterThanOrEqual(2);
      expect(meta.declared_prop_options.type).toContain("text");
      expect(meta.declared_prop_options.type).toContain("password");
      expect(meta.declared_prop_defaults.type).toBe("text");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("classifies boolean props", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-ts-"));
    try {
      writeProject(root, {
        "Toggle.tsx": `
export function Toggle({ disabled }: { disabled?: boolean }) {
  return <button disabled={disabled} />;
}
`,
      });
      const bundle = createCheckerProgram(root);
      const sf = bundle.program.getSourceFile(join(root, "Toggle.tsx"));
      const paramType = findComponentParamType(bundle.checker, sf, "Toggle");
      const sym = bundle.checker.getPropertyOfType(paramType, "disabled");
      expect(classifyPropType(bundle.checker, bundle.checker.getTypeOfSymbol(sym))).toBe(
        "boolean",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("classifies ReactNode props as node", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-ts-"));
    try {
      writeProject(root, {
        "Section.tsx": `
import type { ReactNode } from "react";

export function Section({
  children,
  actions,
}: {
  children: ReactNode;
  actions?: ReactNode;
}) {
  return null;
}
`,
      });
      const bundle = createCheckerProgram(root);
      const sf = bundle.program.getSourceFile(join(root, "Section.tsx"));
      const paramType = findComponentParamType(bundle.checker, sf, "Section");
      for (const key of ["children", "actions"]) {
        const sym = bundle.checker.getPropertyOfType(paramType, key);
        expect(classifyPropType(bundle.checker, bundle.checker.getTypeOfSymbol(sym))).toBe(
          "node",
        );
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
