/** Mirrors `dslint` WorkspaceReport JSON (serde). */

export type DefinitionKind =
  | "function"
  | "class"
  | "const_arrow"
  | "const_function"
  | "wrapped_component"
  | "export_default"
  | "export_default_anonymous";

export type Severity = "error" | "warning" | "info";

export interface ComponentDefinition {
  name: string;
  kind: DefinitionKind;
  line: number;
  /** Props destructured from the first parameter, when detectable. */
  declared_props?: string[];
  /** CVA variant option keys per prop (playground select controls). */
  declared_prop_options?: Record<string, string[]>;
  /** Default values from CVA `defaultVariants`. */
  declared_prop_defaults?: Record<string, string>;
  cva_binding_name?: string;
}

export interface JsxUsage {
  component: string;
  line: number;
  props: string[];
  /** Statically-known literal prop values (non-literals omitted). */
  prop_values?: Record<string, string>;
}

export interface LintFinding {
  rule_id: string;
  message: string;
  path: string;
  line: number | null;
  severity: Severity;
  /** Prop combo label from CVA matrix scan (CI or playground). */
  variant_label?: string;
}

export interface FileScan {
  path: string;
  definitions: ComponentDefinition[];
  /** Per-file JSX usages (schema v2 only; v3 rolls up into `usage_by_component`). */
  usages?: JsxUsage[];
  parse_errors: string[];
  findings?: LintFinding[];
}

export interface GovernanceScores {
  design_system_health: number;
  ux_consistency: number;
  accessibility: number;
  maintainability: number;
  /** CSS / known_tokens adoption 0–100 when measurable. */
  token_adoption?: number | null;
}

export interface DuplicateComponent {
  name: string;
  locations: string[];
}

/** One individual call-site where a component is referenced. */
export interface UsageLocation {
  path: string;
  line: number;
  props: string[];
  /** Statically-known literal prop values at this call-site (non-literals omitted). */
  prop_values?: Record<string, string>;
}

export interface UsageSummary {
  component: string;
  reference_count: number;
  file_count: number;
  max_props_on_single_use: number;
  files: string[];
  /** How many call-sites pass each named prop. */
  prop_frequencies?: Record<string, number>;
  /** How many call-sites pass each literal value for each prop. */
  prop_value_frequencies?: Record<string, Record<string, number>>;
  /** Every individual call-site with its file, line, and passed props. */
  usage_locations?: UsageLocation[];
}

/**
 * Simplified prop kind from TypeScript (e.g. demo `merge-playgrounds.mjs`).
 * Dashboard falls back to name heuristics when a key is missing or kind is `unknown`.
 */
export type DeclaredPropKind =
  | "boolean"
  | "string"
  | "number"
  | "node"
  | "stringArray"
  | "numberArray"
  | "function"
  | "icon"
  | "object"
  | "unknown";

/** Statically-known literal prop value inside an `ExampleNode`. */
export type ExampleValue =
  | { kind: "string"; value: string }
  | { kind: "number"; value: number }
  | { kind: "bool"; value: boolean };

/**
 * Data-only JSX subtree serialized from a real call site by the scanner.
 * Dynamic expressions are sanitized at capture time (loops unrolled, ternary
 * branches picked, non-literal expressions replaced with placeholders).
 */
export type ExampleNode =
  | {
      type: "element";
      /** JSX name as written (`Breadcrumb`, `Stack.Item`, or intrinsic `nav`). */
      name: string;
      props?: Record<string, ExampleValue>;
      children?: ExampleNode[];
    }
  | { type: "text"; value: string }
  | {
      /** Dynamic `{expr}` child replaced with a readable hint (`item.title` → "Title"). */
      type: "placeholder";
      hint: string;
    };

/** Emitted by dslint for dashboard playgrounds (no per-component TS registration). */
export interface PlaygroundSpec {
  id: string;
  export_name: string;
  rel_path: string;
  declared_props: string[];
  group?: string | null;
  /**
   * Optional map from prop name to simplified TS kind, filled by the TS enrich step
   * after scanning (`bin/lib/enrich-playgrounds-from-ts.mjs`). Omitted when empty or unavailable.
   */
  declared_prop_kinds?: Partial<Record<string, DeclaredPropKind>>;
  /** CVA variant option keys per prop (dashboard renders as `<Select>`). */
  declared_prop_options?: Record<string, string[]>;
  /** Default values from CVA `defaultVariants`. */
  declared_prop_defaults?: Record<string, string>;
  /** True when the TS prop is optional (`title?`). */
  declared_prop_optional?: Record<string, boolean>;
  /** Display type strings for complex kinds (e.g. icon → `LucideIcon`, object → `Passkey`). */
  declared_prop_type_labels?: Record<string, string>;
  /**
   * Representative composition captured from a real call site (compound
   * components); replayed as the default preview when present.
   */
  example_tree?: ExampleNode;
}

export type CssTokenCategory =
  | "color"
  | "spacing"
  | "radius"
  | "typography"
  | "other";

export type CssTokenScope = "theme" | "root" | "selector";

export interface CssTokenDefinition {
  name: string;
  value: string;
  category: CssTokenCategory;
  scope: CssTokenScope;
  path: string;
  line: number;
}

export interface CssTokenUsage {
  name: string;
  reference_count: number;
  file_count: number;
  files: string[];
  usage_locations?: UsageLocation[];
}

export interface CssTokenSummary {
  definitions: CssTokenDefinition[];
  usage_by_token: CssTokenUsage[];
  unused_tokens?: string[];
}

/** Dashboard-relevant slice of `.dslinter.json` embedded in each scan report. */
export interface ReportConfig {
  hidden_components?: string[];
  hidden_paths?: string[];
}

/** Agent/MCP-friendly slice of `.dslinter.json` embedded in each scan report. */
export interface ConfigSnapshot {
  deprecated_components?: string[];
  known_tokens?: string[];
  include_dirs?: string[];
}

export interface WorkspaceReport {
  /** Report JSON schema version (1+). Omitted in legacy reports. */
  schema_version?: number;
  /** ISO 8601 UTC timestamp when the report was generated. */
  generated_at?: string;
  root: string;
  files: FileScan[];
  findings: LintFinding[];
  duplicate_components: DuplicateComponent[];
  usage_by_component: UsageSummary[];
  scores: GovernanceScores;
  playgrounds?: PlaygroundSpec[];
  css_tokens?: CssTokenSummary;
  config?: ReportConfig;
  config_snapshot?: ConfigSnapshot;
}
