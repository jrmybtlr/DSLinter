/**
 * DSLinter dashboard — React UI for playgrounds, tokens, and governance.
 * Host apps should import styles once: `@import "dslinter/theme.css";` (after Tailwind + `@source` for this package).
 */
export type { PlaygroundEntry, PlaygroundMeta } from "./types/playground";
export type {
  PlaygroundArgs,
  PlaygroundControl,
  PlaygroundBooleanControl,
  PlaygroundStringControl,
  PlaygroundNumberControl,
  PlaygroundSelectControl,
} from "./types/controls";
export { defaultArgsFromControls } from "./types/controls";
export { definePlayground } from "./playground/definePlayground";
export type { DefinedPlayground } from "./playground/definePlayground";
export type { PlaygroundPreviewProps, PlaygroundPreviewComponent } from "./types/preview";
export type {
  WorkspaceReport,
  GovernanceScores,
  LintFinding,
  UsageSummary,
  UsageLocation,
  ComponentDefinition,
  FileScan,
  PlaygroundSpec,
  DeclaredPropKind,
} from "./types/report";
export type {
  TokenCatalog,
  TokenCatalogColor,
  TokenCatalogSpacing,
  TokenCatalogRadius,
  TokenCatalogTypography,
  TokenCatalogFontFamily,
  TokenCatalogFontSize,
  TokenCatalogFontWeight,
} from "./types/tokenCatalog";
export {
  defaultTailwindFontFamilies,
  defaultTailwindFontSizes,
  defaultTailwindFontWeights,
} from "./types/defaultTailwindTypography";

export {
  DashboardLayout,
  DashboardThemeProvider,
  useDashboardTheme,
} from "./shell/DashboardLayout";
export type {
  DashboardLayoutProps,
  DashboardResolvedTheme,
  DashboardThemePreference,
} from "./shell/DashboardLayout";
export { useWorkspaceReport } from "./dashboard/useWorkspaceReport";
export type { DslinterReportState } from "./dashboard/useWorkspaceReport";
export { a11ySummaryForModule, resolveModuleSourcePath } from "./report/a11yForModule";
export type { A11yModuleSummary } from "./report/a11yForModule";
export { tokenStyleFindingsForModule } from "./report/tokenStyleFindingsForModule";
export { codeScoreSummaryForModule } from "./report/codeScoreForModule";
export type { CodeScoreModuleSummary } from "./report/codeScoreForModule";
export { TokenWall } from "./dashboard/TokenWall";
export { DashboardBody } from "./dashboard/DashboardBody";

export type { HashRoute } from "./shell/hashRoute";
export { parseHashRoute, formatHashRoute } from "./shell/hashRoute";
export { useHashRoute } from "./shell/useHashRoute";
