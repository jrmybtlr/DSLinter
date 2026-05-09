type Props = {
  id: string;
  label: string;
};

/** Label wired to control — forms baseline. */
export function FormField({ id, label }: Props) {
  return (
    <div className="flex flex-col gap-layout-xs">
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
      </label>
      <input
        id={id}
        className="rounded-ds border border-surface-border bg-surface-elevated px-layout-sm py-layout-xs text-sm outline-none ring-primary focus-visible:ring-2"
      />
    </div>
  );
}
