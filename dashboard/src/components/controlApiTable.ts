import type { PlaygroundControl } from "../types/controls";

export type ApiTableRow = {
  prop: string;
  type: string;
  /** Select option values; Type column renders these as badges instead of a `|` string. */
  unionLiterals: string[] | null;
  default: string;
  /** Default text that is API-sourced enough to show in the Type badge. */
  defaultBadge: string | null;
};

function formatDefault(c: PlaygroundControl): string {
  switch (c.type) {
    case "boolean":
      return String(c.default);
    case "number":
      return String(c.default);
    case "string":
      return c.default === "" ? "—" : JSON.stringify(c.default);
    case "node":
      return c.default === "" ? "—" : JSON.stringify(c.default);
    case "select":
      return c.default === "" ? "—" : c.default;
    default:
      return "—";
  }
}

function formatType(c: PlaygroundControl): string {
  switch (c.type) {
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "string":
      return "string";
    case "node":
      return "ReactNode";
    case "select":
      return "string";
    default:
      return "—";
  }
}

function unionLiteralsForControl(c: PlaygroundControl): string[] | null {
  if (c.type !== "select") return null;
  return c.options.map((o) => o.value);
}

export function controlsToApiRows(controls: PlaygroundControl[]): ApiTableRow[] {
  return controls.map((c) => ({
    prop: c.key,
    type: formatType(c),
    unionLiterals: unionLiteralsForControl(c),
    default: formatDefault(c),
    defaultBadge: c.defaultSource === "type" ? formatDefault(c) : null,
  }));
}
