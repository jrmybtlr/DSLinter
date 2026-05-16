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
        <h2 className="text-sm font-semibold text-foreground">Colors</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          From Tailwind theme extensions.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {catalog.colors.map((c) => (
            <li
              key={`${c.token}-${c.shade}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
              title={c.value}
            >
              <svg
                className="h-9 w-9 shrink-0 overflow-hidden rounded border border-border shadow-inner"
                viewBox="0 0 36 36"
                aria-hidden
              >
                <rect width="36" height="36" fill={c.value} />
              </svg>
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-foreground">
                  {c.token}/{c.shade}
                </p>
                <p className="truncate text-xs text-muted-foreground">{c.value}</p>
                <p className="truncate font-mono text-xs text-muted-foreground/70">
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
            <h2 className="text-sm font-semibold text-foreground">
              Typography
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Font stacks and Tailwind utilities — preview matches your theme
              tokens.
            </p>
          </div>

          {typo.families.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Font families
              </h3>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {typo.families.map((f) => (
                  <li
                    key={f.key}
                    className="rounded-lg border border-border bg-card px-3 py-3"
                    title={f.value}
                  >
                    <p className={`${f.tw} text-sm text-foreground`}>
                      The quick brown fox jumps over the lazy dog.
                    </p>
                    <p className="mt-2 truncate font-mono text-xs text-foreground">
                      {f.tw}
                    </p>
                    <p className="mt-1 break-all text-xs leading-snug text-muted-foreground">
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
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Type scale · {family.tw}
                </h3>
                <ul className="mt-3 divide-y divide-border overflow-x-auto rounded-lg border border-border bg-card">
                  {typo.sizes.map((s) => (
                    <li
                      key={`${family.key}-${s.token}`}
                      className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-3 py-2.5 text-xs sm:flex-nowrap"
                    >
                      <span className="w-24 shrink-0 font-mono text-foreground/90">
                        {s.tw}
                      </span>
                      <span className="hidden w-36 shrink-0 text-muted-foreground sm:inline">
                        {s.value}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate ${family.tw} ${s.tw} text-foreground`}
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
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Type scale · font-sans
              </h3>
              <ul className="mt-3 divide-y divide-border overflow-x-auto rounded-lg border border-border bg-card">
                {typo.sizes.map((s) => (
                  <li
                    key={s.token}
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-3 py-2.5 text-xs sm:flex-nowrap"
                  >
                    <span className="w-24 shrink-0 font-mono text-foreground/90">
                      {s.tw}
                    </span>
                    <span className="hidden w-36 shrink-0 text-muted-foreground sm:inline">
                      {s.value}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate font-sans ${s.tw} text-foreground`}
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
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Font weights · {family.tw}
                </h3>
                <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
                  {weights.map((w) => (
                    <li
                      key={`${family.key}-${w.token}`}
                      className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-3 py-2 text-xs"
                    >
                      <span className="w-28 shrink-0 font-mono text-foreground/90">
                        {w.tw}
                      </span>
                      <span className="w-10 shrink-0 tabular-nums text-muted-foreground">
                        {w.value ?? "—"}
                      </span>
                      <span
                        className={`min-w-0 flex-1 ${family.tw} ${w.tw} text-base text-foreground`}
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
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Font weights · font-sans
              </h3>
              <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
                {weights.map((w) => (
                  <li
                    key={w.token}
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-3 py-2 text-xs"
                  >
                    <span className="w-28 shrink-0 font-mono text-foreground/90">
                      {w.tw}
                    </span>
                    <span className="w-10 shrink-0 tabular-nums text-muted-foreground">
                      {w.value ?? "—"}
                    </span>
                    <span
                      className={`min-w-0 flex-1 font-sans ${w.tw} text-base text-foreground`}
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
          <h2 className="text-sm font-semibold text-foreground">Spacing</h2>
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
            {catalog.spacing.map((s) => (
              <li
                key={s.token}
                className="flex justify-between gap-4 px-3 py-2 text-xs"
              >
                <span className="font-mono text-foreground/90">{s.token}</span>
                <span className="text-muted-foreground">{s.value}</span>
                <span className="hidden font-mono text-muted-foreground/70 sm:inline">
                  {s.tw}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Radius</h2>
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
            {catalog.radius.map((r) => (
              <li
                key={r.token}
                className="flex justify-between gap-4 px-3 py-2 text-xs"
              >
                <span className="font-mono text-foreground/90">{r.token}</span>
                <span className="text-muted-foreground">{r.value}</span>
                <span className="hidden font-mono text-muted-foreground/70 sm:inline">
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
