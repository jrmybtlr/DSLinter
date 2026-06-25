import { useMemo } from "react";
import type { TokenCatalog } from "../types/tokenCatalog";
import type { WorkspaceReport } from "../types/report";
import { TokenWall } from "../dashboard/TokenWall";
import { ScannedTokenWall } from "../dashboard/ScannedTokenWall";
import { buildMergedTokenView } from "../dashboard/mergeTokenCatalog";

export function TokensPane({
  tokenCatalog,
  dslinterReport,
}: {
  tokenCatalog?: TokenCatalog;
  dslinterReport?: WorkspaceReport | null;
}) {
  const merged = useMemo(
    () => buildMergedTokenView(dslinterReport, tokenCatalog),
    [dslinterReport, tokenCatalog],
  );

  const hasScanned = merged != null && merged.rows.length > 0;
  const hasManual = tokenCatalog != null;

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-muted/40">
      <header className="border-b border-border bg-card px-8 py-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          System
        </p>
        <h1 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
          Design tokens
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {hasScanned
            ? "CSS variables discovered from your stylesheets, with used vs unused usage across the repo."
            : "Supply a catalog object (same shape as your Tailwind theme docs) — keep it aligned with your design tokens."}
        </p>
      </header>
      <div className="min-w-0 w-full px-8 py-8">
        {hasScanned && merged ? (
          <ScannedTokenWall view={merged} />
        ) : hasManual ? (
          <TokenWall catalog={tokenCatalog} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Run <span className="font-mono">dslinter --json</span> on a project
            with CSS token sources, or pass a{" "}
            <span className="font-mono">tokenCatalog</span> prop.
          </p>
        )}
      </div>
    </div>
  );
}
