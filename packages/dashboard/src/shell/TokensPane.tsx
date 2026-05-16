import type { TokenCatalog } from "../types/tokenCatalog";
import { TokenWall } from "../dashboard/TokenWall";

export function TokensPane({ tokenCatalog }: { tokenCatalog: TokenCatalog }) {
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
          Supply a catalog object (same shape as your Tailwind theme docs) —
          keep it aligned with your design tokens.
        </p>
      </header>
      <div className="min-w-0 w-full px-8 py-8">
        <div className="rounded-ds-lg border border-border bg-card p-6 text-card-foreground shadow-xs">
          <TokenWall catalog={tokenCatalog} />
        </div>
      </div>
    </div>
  );
}
