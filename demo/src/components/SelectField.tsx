type Props = {
  id: string;
  label: string;
  /** Comma-separated options (label = value). */
  options: string;
  helperText?: string;
  errorMessage?: string;
  disabled?: boolean;
  required?: boolean;
  defaultValue?: string;
};

function parseOptions(raw: string): { value: string; label: string }[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => ({ value: part, label: part }));
}

/** Native select with the same helper/error pattern as `TextField`. */
export function SelectField({
  id,
  label,
  options,
  helperText,
  errorMessage,
  disabled,
  required,
  defaultValue,
}: Props) {
  const labelId = `${id}-label`;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const hasError = Boolean(errorMessage && errorMessage.trim().length > 0);
  const describedBy = [
    helperText?.trim() ? helperId : null,
    hasError ? errorId : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  const opts = parseOptions(options);

  const selectClass = [
    "w-full rounded-ds border bg-surface-elevated px-layout-sm py-layout-xs text-sm outline-none transition",
    "ring-primary focus-visible:ring-2",
    hasError ? "border-danger focus-visible:ring-danger" : "border-surface-border",
    disabled ? "cursor-not-allowed opacity-60" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex w-full max-w-md flex-col gap-layout-xs">
      <label htmlFor={id} id={labelId} className="text-sm font-medium text-slate-800">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </label>
      <select
        id={id}
        aria-labelledby={labelId}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        disabled={disabled}
        required={required}
        defaultValue={defaultValue}
        className={selectClass}
      >
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {helperText?.trim() ? (
        <p id={helperId} className="text-xs text-slate-600">
          {helperText}
        </p>
      ) : null}
      {hasError ? (
        <p id={errorId} className="text-xs font-medium text-danger" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
