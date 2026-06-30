import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { PlaygroundSpec } from "../types/report";
import {
  createCheckerProgram,
  enrichPlaygroundSpecFromTs,
  extractFiniteStringUnion,
  findComponentParamType,
} from "./inferPropTypesFromTs";

const dashboardRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function writeProject(
  dir: string,
  files: Record<string, string>,
  extraCompilerOptions: Record<string, unknown> = {},
) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  writeFileSync(
    join(dir, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          jsx: "react-jsx",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          esModuleInterop: true,
          moduleResolution: "bundler",
          module: "ESNext",
          types: ["react"],
          ...extraCompilerOptions,
        },
        include: ["**/*.tsx", "**/*.ts"],
      },
      null,
      2,
    )}\n`,
  );
}

function tempProject(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "infer-props-"));
  writeProject(dir, files, {
    typeRoots: [
      join(dashboardRoot, "node_modules/@types"),
      join(dashboardRoot, "../node_modules/@types"),
    ],
  });
  return dir;
}

describe("extractFiniteStringUnion", () => {
  it("extracts string literal unions from a minimal component", () => {
    const root = tempProject({
      "src/Widget.tsx": `
        type Mode = "text" | "email" | "password";
        export function Widget({ mode }: { mode?: Mode }) {
          return null;
        }
      `,
    });
    const bundle = createCheckerProgram(root);
    expect(bundle).not.toBeNull();
    const sf = bundle!.program.getSourceFile(join(root, "src/Widget.tsx"));
    expect(sf).toBeDefined();
    const paramType = findComponentParamType(bundle!.checker, sf!, "Widget");
    expect(paramType).toBeDefined();
    const modeSym = bundle!.checker.getPropertyOfType(paramType!, "mode");
    expect(modeSym).toBeDefined();
    const modeType = bundle!.checker.getTypeOfSymbol(modeSym!);
    expect(extractFiniteStringUnion(bundle!.checker, modeType)).toEqual([
      "email",
      "password",
      "text",
    ]);
  });

  it("extracts HTMLInputTypeAttribute-style unions with a branded string catch-all", () => {
    const root = tempProject({
      "src/input.tsx": `
        type InputType = "text" | "email" | (string & {});
        export function Input({ type }: { type?: InputType }) {
          return null;
        }
      `,
    });
    const bundle = createCheckerProgram(root)!;
    const sf = bundle.program.getSourceFile(join(root, "src/input.tsx"))!;
    const paramType = findComponentParamType(bundle.checker, sf, "Input")!;
    const typeType = bundle.checker.getTypeOfSymbol(
      bundle.checker.getPropertyOfType(paramType, "type")!,
    );
    const options = extractFiniteStringUnion(bundle.checker, typeType);
    expect(options).toEqual(["email", "text"]);
  });

  it("returns null when union contains plain string", () => {
    const root = tempProject({
      "src/Widget.tsx": `
        export function Widget({ mode }: { mode?: "text" | string }) {
          return null;
        }
      `,
    });
    const bundle = createCheckerProgram(root)!;
    const sf = bundle.program.getSourceFile(join(root, "src/Widget.tsx"))!;
    const paramType = findComponentParamType(bundle.checker, sf, "Widget")!;
    const modeType = bundle.checker.getTypeOfSymbol(
      bundle.checker.getPropertyOfType(paramType, "mode")!,
    );
    expect(extractFiniteStringUnion(bundle.checker, modeType)).toBeNull();
  });
});

describe("findComponentParamType export lookup", () => {
  it("finds param type for export { Input } function declaration", () => {
    const root = tempProject({
      "src/input.tsx": `
        function Input({ type }: { type?: "text" | "email" | "password" }) {
          return null;
        }
        export { Input };
      `,
    });
    const bundle = createCheckerProgram(root)!;
    const sf = bundle.program.getSourceFile(join(root, "src/input.tsx"))!;
    const paramType = findComponentParamType(bundle.checker, sf, "Input");
    expect(paramType).toBeDefined();
    const typeSym = bundle.checker.getPropertyOfType(paramType!, "type");
    expect(typeSym).toBeDefined();
  });

  it("finds param type for export const forwardRef component", () => {
    const root = tempProject({
      "src/input.tsx": `
        import * as React from "react";
        export const Input = React.forwardRef(function Input(
          { type }: { type?: "text" | "email" },
          ref: React.Ref<HTMLInputElement>,
        ) {
          return null;
        });
      `,
    });
    const bundle = createCheckerProgram(root)!;
    const sf = bundle.program.getSourceFile(join(root, "src/input.tsx"))!;
    const paramType = findComponentParamType(bundle.checker, sf, "Input");
    expect(paramType).toBeDefined();
  });
});

describe("enrichPlaygroundSpecFromTs", () => {
  it("does not overwrite CVA declared_prop_options from Rust", () => {
    const root = tempProject({
      "src/button.tsx": `
        export function Button({ variant }: { variant?: "default" | "ghost" | "outline" }) {
          return null;
        }
      `,
    });
    const bundle = createCheckerProgram(root)!;
    const spec: PlaygroundSpec = {
      id: "Button",
      export_name: "Button",
      rel_path: "src/button.tsx",
      declared_props: ["variant"],
      declared_prop_options: {
        variant: ["default", "destructive"],
      },
    };
    const enriched = enrichPlaygroundSpecFromTs(
      spec,
      bundle.checker,
      bundle.program,
      root,
    );
    expect(enriched.declared_prop_options?.variant).toEqual(["default", "destructive"]);
  });

  it("fills type options and default for ComponentProps<input> style destructuring", () => {
    const root = tempProject({
      "src/input.tsx": `
        import * as React from "react";
        function Input({ className, type, ...props }: React.ComponentProps<"input">) {
          return null;
        }
        export { Input };
      `,
    });
    const bundle = createCheckerProgram(root)!;
    const spec: PlaygroundSpec = {
      id: "Input",
      export_name: "Input",
      rel_path: "src/input.tsx",
      declared_props: ["className", "type", "placeholder"],
    };
    const enriched = enrichPlaygroundSpecFromTs(
      spec,
      bundle.checker,
      bundle.program,
      root,
    );
    const typeOptions = enriched.declared_prop_options?.type;
    expect(typeOptions).toBeDefined();
    expect(typeOptions!.length).toBeGreaterThanOrEqual(2);
    expect(typeOptions).toContain("text");
    expect(typeOptions).toContain("email");
    expect(typeOptions).toContain("password");
    expect(enriched.declared_prop_defaults?.type).toBe("text");
    expect(enriched.declared_prop_kinds?.type).toBe("string");
  });

  it("classifies ReactNode props as node", () => {
    const root = tempProject({
      "src/section.tsx": `
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
    const bundle = createCheckerProgram(root)!;
    const spec: PlaygroundSpec = {
      id: "Section",
      export_name: "Section",
      rel_path: "src/section.tsx",
      declared_props: ["children", "actions"],
    };
    const enriched = enrichPlaygroundSpecFromTs(
      spec,
      bundle.checker,
      bundle.program,
      root,
    );
    expect(enriched.declared_prop_kinds?.children).toBe("node");
    expect(enriched.declared_prop_kinds?.actions).toBe("node");
  });
});

describe("createCheckerProgram", () => {
  it("returns null when tsconfig.json is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "no-tsconfig-"));
    expect(createCheckerProgram(dir)).toBeNull();
  });
});
