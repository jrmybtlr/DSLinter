import { useMemo } from "react";
import type { WorkspaceReport } from "../types/report";
import { buildPlaygroundEntriesFromReportWithSkips } from "./buildPlaygroundEntriesFromReport";
import type { BuildPlaygroundResult } from "./buildPlaygroundEntriesFromReport";
import { scanPlaygroundModules } from "./scanPlaygroundModules";

/**
 * Join scanner `playgrounds` to eager modules from the dslinter Vite plugin
 * (`virtual:dslinter/playground-modules`). Requires `plugins: [dslinter()]` from
 * `dslinter/vite`, or `npx dslinter` which merges the plugin automatically.
 */
export function usePlaygroundFromReport(
  report: WorkspaceReport | null | undefined,
): BuildPlaygroundResult {
  return useMemo(
    () =>
      buildPlaygroundEntriesFromReportWithSkips(
        report,
        scanPlaygroundModules,
      ),
    [report],
  );
}
