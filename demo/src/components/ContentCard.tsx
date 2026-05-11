type Props = {
  title: string;
  children: React.ReactNode;
};

/** Card shell using semantic surface tokens. */
export function ContentCard({ title, children }: Props) {
  return (
    <article className="rounded-ds-lg border border-surface-border bg-surface-elevated p-layout-md shadow-sm">
      <h3 className="mb-layout-sm text-lg font-semibold text-slate-900">{title}</h3>
      <div className="text-sm text-slate-600">{children}</div>
    </article>
  );
}
