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
}

export interface JsxUsage {
  component: string;
  line: number;
  props: string[];
}

export interface LintFinding {
  rule_id: string;
  message: string;
  path: string;
  line: number | null;
  severity: Severity;
}

export interface FileScan {
  path: string;
  definitions: ComponentDefinition[];
  usages: JsxUsage[];
  parse_errors: string[];
  findings?: LintFinding[];
}

export interface GovernanceScores {
  design_system_health: number;
  ux_consistency: number;
  accessibility: number;
  maintainability: number;
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
}

export interface UsageSummary {
  component: string;
  reference_count: number;
  file_count: number;
  max_props_on_single_use: number;
  files: string[];
  /** How many call-sites pass each named prop. */
  prop_frequencies?: Record<string, number>;
  /** Every individual call-site with its file, line, and passed props. */
  usage_locations?: UsageLocation[];
}

export interface OwnershipSummary {
  owner: string;
  files: number;
  definitions: number;
}

/** Emitted by dslint for workbench playgrounds (no per-component TS registration). */
export interface PlaygroundSpec {
  id: string;
  export_name: string;
  rel_path: string;
  declared_props: string[];
  group?: string | null;
}

export interface WorkspaceReport {
  root: string;
  files: FileScan[];
  findings: LintFinding[];
  duplicate_components: DuplicateComponent[];
  usage_by_component: UsageSummary[];
  ownership: OwnershipSummary[];
  scores: GovernanceScores;
  playgrounds?: PlaygroundSpec[];
}
