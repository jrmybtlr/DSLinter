type Props = {
  title: string;
  subtitle?: string;
};

/** Single clear title + optional subtitle (heading hierarchy). */
export function PageHero({ title, subtitle }: Props) {
  return (
    <header className="border-b border-surface-border bg-surface-elevated px-layout-lg py-layout-md">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      {subtitle ? <p className="mt-layout-xs text-slate-600">{subtitle}</p> : null}
    </header>
  );
}
