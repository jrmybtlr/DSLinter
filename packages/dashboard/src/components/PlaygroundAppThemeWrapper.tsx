import { forwardRef, useMemo, type CSSProperties, type ReactNode } from "react";
import type { WorkspaceReport } from "../types/report";
import {
  buildAppPreviewThemeFromReport,
  cssVariablesForPreviewTheme,
} from "../playground/appPreviewTheme";
import { useDashboardTheme } from "../shell/DashboardLayout";
import { cn } from "../lib/utils";

type Props = {
  children: ReactNode;
  workspaceReport: WorkspaceReport | null;
  className?: string;
};

export const PlaygroundAppThemeWrapper = forwardRef<HTMLDivElement, Props>(
  function PlaygroundAppThemeWrapper(
    { children, workspaceReport, className },
    ref,
  ) {
    const { resolvedTheme } = useDashboardTheme();
    const previewTheme = useMemo(
      () => buildAppPreviewThemeFromReport(workspaceReport),
      [workspaceReport],
    );
    const isDark = resolvedTheme === "dark";

    if (!previewTheme) {
      return (
        <div
          ref={ref}
          className={cn(isDark && "dark", className)}
          data-app-preview-theme={resolvedTheme}
        >
          {children}
        </div>
      );
    }

    const vars = cssVariablesForPreviewTheme(
      previewTheme,
      isDark && Object.keys(previewTheme.dark).length > 0 ? "dark" : "light",
    );
    const usesDarkTokens =
      isDark && Object.keys(previewTheme.dark).length > 0;

    const style = {
      ...vars,
      colorScheme: usesDarkTokens ? "dark" : "light",
    } as CSSProperties;

    return (
      <div
        ref={ref}
        className={cn(
          "ds-playground-app-preview",
          isDark && "dark",
          className,
        )}
        style={style}
        data-app-preview-theme={resolvedTheme}
      >
        {children}
      </div>
    );
  },
);
