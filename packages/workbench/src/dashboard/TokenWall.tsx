import type { TokenCatalog } from "../types/tokenCatalog";

function hasTypographyContent(catalog: TokenCatalog): boolean {
  const t = catalog.typography;
  if (!t) return false;
  return (
    t.families.length > 0 || t.sizes.length > 0 || (t.weights?.length ?? 0) > 0
  );
}

export function TokenWall({ catalog }: { catalog: TokenCatalog }) {
  const typo = catalog.typography;
  const weights = typo?.weights ?? [];

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">Colors</h2>
        <p className="mt-1 text-xs text-neutral-500">
          From Tailwind theme extensions.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {catalog.colors.map((c) => (
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
                <p className="truncate text-xs text-neutral-500">{c.value}</p>
                <p className="truncate font-mono text-xs text-neutral-400">
                  {c.tw}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {hasTypographyContent(catalog) && typo ? (
        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">
              Typography
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Font stacks and Tailwind utilities — preview matches your theme
              tokens.
            </p>
          </div>

          {typo.families.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                Font families
              </h3>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {typo.families.map((f) => (
                  <li
                    key={f.key}
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-3"
                    title={f.value}
                  >
                    <p className={`${f.tw} text-sm text-neutral-900`}>
                      The quick brown fox jumps over the lazy dog.
                    </p>
                    <p className="mt-2 truncate font-mono text-xs text-neutral-900">
                      {f.tw}
                    </p>
                    <p className="mt-1 break-all text-xs leading-snug text-neutral-500">
                      {f.value}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {typo.families.length > 0 && typo.sizes.length > 0 ? (
            typo.families.map((family) => (
              <div key={family.key}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                  Type scale · {family.tw}
                </h3>
                <ul className="mt-3 divide-y divide-neutral-100 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
                  {typo.sizes.map((s) => (
                    <li
                      key={`${family.key}-${s.token}`}
                      className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-3 py-2.5 text-xs sm:flex-nowrap"
                    >
                      <span className="w-24 shrink-0 font-mono text-neutral-700">
                        {s.tw}
                      </span>
                      <span className="hidden w-36 shrink-0 text-neutral-500 sm:inline">
                        {s.value}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate ${family.tw} ${s.tw} text-neutral-900`}
                      >
                        Aa Bb Cc 0123456789
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : typo.sizes.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                Type scale · font-sans
              </h3>
              <ul className="mt-3 divide-y divide-neutral-100 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
                {typo.sizes.map((s) => (
                  <li
                    key={s.token}
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-3 py-2.5 text-xs sm:flex-nowrap"
                  >
                    <span className="w-24 shrink-0 font-mono text-neutral-700">
                      {s.tw}
                    </span>
                    <span className="hidden w-36 shrink-0 text-neutral-500 sm:inline">
                      {s.value}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate font-sans ${s.tw} text-neutral-900`}
                    >
                      Aa Bb Cc 0123456789
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {typo.families.length > 0 && weights.length > 0 ? (
            typo.families.map((family) => (
              <div key={`w-${family.key}`}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                  Font weights · {family.tw}
                </h3>
                <ul className="mt-3 divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
                  {weights.map((w) => (
                    <li
                      key={`${family.key}-${w.token}`}
                      className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-3 py-2 text-xs"
                    >
                      <span className="w-28 shrink-0 font-mono text-neutral-700">
                        {w.tw}
                      </span>
                      <span className="w-10 shrink-0 tabular-nums text-neutral-500">
                        {w.value ?? "—"}
                      </span>
                      <span
                        className={`min-w-0 flex-1 ${family.tw} ${w.tw} text-base text-neutral-900`}
                      >
                        Agile beige sharks vex polite judges.
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : weights.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                Font weights · font-sans
              </h3>
              <ul className="mt-3 divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
                {weights.map((w) => (
                  <li
                    key={w.token}
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-3 py-2 text-xs"
                  >
                    <span className="w-28 shrink-0 font-mono text-neutral-700">
                      {w.tw}
                    </span>
                    <span className="w-10 shrink-0 tabular-nums text-neutral-500">
                      {w.value ?? "—"}
                    </span>
                    <span
                      className={`min-w-0 flex-1 font-sans ${w.tw} text-base text-neutral-900`}
                    >
                      Agile beige sharks vex polite judges.
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Spacing</h2>
          <ul className="mt-3 divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
            {catalog.spacing.map((s) => (
              <li
                key={s.token}
                className="flex justify-between gap-4 px-3 py-2 text-xs"
              >
                <span className="font-mono text-neutral-700">{s.token}</span>
                <span className="text-neutral-500">{s.value}</span>
                <span className="hidden font-mono text-neutral-400 sm:inline">
                  {s.tw}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Radius</h2>
          <ul className="mt-3 divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
            {catalog.radius.map((r) => (
              <li
                key={r.token}
                className="flex justify-between gap-4 px-3 py-2 text-xs"
              >
                <span className="font-mono text-neutral-700">{r.token}</span>
                <span className="text-neutral-500">{r.value}</span>
                <span className="hidden font-mono text-neutral-400 sm:inline">
                  {r.tw}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
