import type { TokenCatalog } from "../types/tokenCatalog";
import { TokenWall } from "../dashboard/TokenWall";

export function TokensPane({ tokenCatalog }: { tokenCatalog: TokenCatalog }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-gray-50">
      <header className="border-b  bg-white px-8 py-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          System
        </p>
        <h1 className="mt-1 text-lg font-semibold tracking-tight text-gray-900">
          Design tokens
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Supply a catalog object (same shape as your Tailwind theme docs) —
          keep it aligned with your design tokens.
        </p>
      </header>
      <div className="min-w-0 w-full px-8 py-8">
        <div className="rounded-ds-lg border  bg-white p-6 shadow-xs">
          <TokenWall catalog={tokenCatalog} />
        </div>
      </div>
    </div>
  );
}
