type Props = {
  id: string;
  label: string;
  placeholder?: string;
  helperText?: string;
  errorMessage?: string;
  disabled?: boolean;
  required?: boolean;
  rows?: number | string;
  defaultValue?: string;
};

/** Multi-line field with helper and error messaging. */
export function TextareaField({
  id,
  label,
  placeholder,
  helperText,
  errorMessage,
  disabled,
  required,
  rows = 4,
  defaultValue,
}: Props) {
  const rowCount =
    typeof rows === "number" && !Number.isNaN(rows)
      ? rows
      : Math.max(1, parseInt(String(rows ?? 4), 10) || 4);
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

  const areaClass = [
    "w-full resize-y rounded-ds border bg-surface-elevated px-layout-sm py-layout-xs text-sm outline-none transition",
    "ring-primary focus-visible:ring-2",
    hasError ? "border-danger focus-visible:ring-danger" : "border-surface-border",
    disabled ? "cursor-not-allowed opacity-60" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex w-full max-w-md flex-col gap-layout-xs">
      <label htmlFor={id} id={labelId} className="text-sm font-medium text-gray-800">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </label>
      <textarea
        id={id}
        aria-labelledby={labelId}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        rows={rowCount}
        defaultValue={defaultValue}
        className={areaClass}
      />
      {helperText?.trim() ? (
        <p id={helperId} className="text-xs text-gray-600">
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
