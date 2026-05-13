import type { PlaygroundControl } from "../types/controls";

export type ApiTableRow = {
  prop: string;
  type: string;
  /** Select option values as JSON literals; Type column renders these as badges instead of a `|` string. */
  unionLiterals: string[] | null;
  default: string;
  description: string;
};

function formatDefault(c: PlaygroundControl): string {
  switch (c.type) {
    case "boolean":
      return String(c.default);
    case "number":
      return String(c.default);
    case "string":
      return c.default === "" ? "—" : JSON.stringify(c.default);
    case "select":
      return JSON.stringify(c.default);
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
    case "select":
      return "string";
    default:
      return "—";
  }
}

function unionLiteralsForControl(c: PlaygroundControl): string[] | null {
  if (c.type !== "select") return null;
  return c.options.map((o) => JSON.stringify(o.value));
}

function formatDescription(c: PlaygroundControl): string {
  const parts: string[] = [];
  if (c.type === "boolean" && c.hint) parts.push(c.hint);
  if (c.type === "string" && c.placeholder) parts.push(`Placeholder: ${c.placeholder}`);
  if (c.type === "number") {
    if (c.min != null || c.max != null) {
      parts.push(
        [c.min != null ? `min ${c.min}` : null, c.max != null ? `max ${c.max}` : null]
          .filter(Boolean)
          .join(", "),
      );
    }
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function controlsToApiRows(controls: PlaygroundControl[]): ApiTableRow[] {
  return controls.map((c) => ({
    prop: c.key,
    type: formatType(c),
    unionLiterals: unionLiteralsForControl(c),
    default: formatDefault(c),
    description: formatDescription(c),
  }));
}
