import { tokenCatalog } from "../tokenCatalog";

export function TokenWall() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">Colors</h2>
        <p className="mt-1 text-xs text-neutral-500">From Tailwind theme extensions.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {tokenCatalog.colors.map((c) => (
            <li
              key={`${c.token}-${c.shade}`}
              className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2"
              title={c.value}
            >
              <svg
                className="h-9 w-9 shrink-0 overflow-hidden rounded border border-neutral-200 shadow-inner"
                viewBox="0 0 36 36"
                aria-hidden
              >
                <rect width="36" height="36" fill={c.value} />
              </svg>
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-neutral-900">
                  {c.token}/{c.shade}
                </p>
                <p className="truncate text-[11px] text-neutral-500">{c.value}</p>
                <p className="truncate font-mono text-[10px] text-neutral-400">{c.tw}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Spacing</h2>
          <ul className="mt-3 divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
            {tokenCatalog.spacing.map((s) => (
              <li key={s.token} className="flex justify-between gap-4 px-3 py-2 text-xs">
                <span className="font-mono text-neutral-700">{s.token}</span>
                <span className="text-neutral-500">{s.value}</span>
                <span className="hidden font-mono text-neutral-400 sm:inline">{s.tw}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Radius</h2>
          <ul className="mt-3 divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
            {tokenCatalog.radius.map((r) => (
              <li key={r.token} className="flex justify-between gap-4 px-3 py-2 text-xs">
                <span className="font-mono text-neutral-700">{r.token}</span>
                <span className="text-neutral-500">{r.value}</span>
                <span className="hidden font-mono text-neutral-400 sm:inline">{r.tw}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
