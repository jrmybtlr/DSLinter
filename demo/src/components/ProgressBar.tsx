type Props = {
  /** Current value (0–max). Ignored when `isIndeterminate`. */
  value?: number | string;
  max?: number | string;
  isIndeterminate?: boolean;
};

/** Determinate or indeterminate progress indicator. */
export function ProgressBar({ value = 0, max = 100, isIndeterminate = false }: Props) {
  const safeMax = Math.max(1, Number(max) || 100);
  const raw = Number(value);
  const clamped = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), safeMax) : 0;
  const pct = isIndeterminate ? undefined : Math.round((clamped / safeMax) * 100);

  return (
    <div
      role="progressbar"
      aria-valuemin={isIndeterminate ? undefined : 0}
      aria-valuemax={isIndeterminate ? undefined : safeMax}
      aria-valuenow={isIndeterminate ? undefined : clamped}
      aria-label={isIndeterminate ? "Loading" : `${pct}% complete`}
      className="h-2 w-full max-w-md overflow-hidden rounded-full bg-slate-200"
    >
      {isIndeterminate ? (
        <div className="h-full w-full">
          <div className="h-full w-1/3 rounded-full bg-primary animate-progress-indeterminate" />
        </div>
      ) : (
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${(clamped / safeMax) * 100}%` }}
        />
      )}
    </div>
  );
}
