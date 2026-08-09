import { describe, expect, it } from "vitest";
import { controlsToApiRows } from "./controlApiTable";
import type { PlaygroundControl } from "../types/controls";

describe("controlsToApiRows", () => {
  it("does not expose generated example defaults as type badges", () => {
    const controls: PlaygroundControl[] = [
      {
        key: "children",
        label: "children",
        type: "string",
        default: "Example",
        defaultSource: "example",
      },
      {
        key: "variant",
        label: "variant",
        type: "string",
        default: "default",
        defaultSource: "type",
      },
    ];

    expect(controlsToApiRows(controls)).toMatchObject([
      { prop: "children", default: '"Example"', defaultBadge: null },
      { prop: "variant", default: '"default"', defaultBadge: '"default"' },
    ]);
  });

  it("maps node controls to ReactNode in the type column", () => {
    const controls: PlaygroundControl[] = [
      {
        key: "actions",
        label: "actions",
        type: "node",
        default: "actions",
      },
    ];

    expect(controlsToApiRows(controls)).toMatchObject([{ prop: "actions", type: "ReactNode" }]);
  });

  it("maps stringArray controls to string[] in the type column", () => {
    const controls: PlaygroundControl[] = [
      {
        key: "errors",
        label: "errors",
        type: "stringArray",
        default: "Something went wrong.",
      },
      {
        key: "title",
        label: "title",
        type: "string",
        default: "Label",
      },
    ];

    expect(controlsToApiRows(controls)).toMatchObject([
      { prop: "errors", type: "string[]" },
      { prop: "title", type: "string" },
    ]);
  });

  it("maps numberArray, icon, object, and function controls; marks optional props", () => {
    const controls: PlaygroundControl[] = [
      {
        key: "ids",
        label: "ids",
        type: "numberArray",
        default: "1\n2",
        optional: true,
      },
      {
        key: "iconNode",
        label: "iconNode",
        type: "icon",
        default: "",
        typeLabel: "LucideIcon",
        optional: true,
      },
      {
        key: "passkey",
        label: "passkey",
        type: "object",
        default: "",
        typeLabel: "Passkey",
      },
      {
        key: "onDelete",
        label: "onDelete",
        type: "function",
        default: "",
        typeLabel: "(id: number, onError: () => void) => void",
      },
      {
        key: "title",
        label: "title",
        type: "string",
        default: "Label",
        optional: true,
      },
    ];

    expect(controlsToApiRows(controls)).toMatchObject([
      { prop: "ids?", type: "number[]" },
      { prop: "iconNode?", type: "LucideIcon", default: "—" },
      { prop: "passkey", type: "Passkey", default: "—" },
      {
        prop: "onDelete",
        type: "(id: number, onError: () => void) => void",
        default: "—",
      },
      { prop: "title?", type: "string" },
    ]);
  });
});
