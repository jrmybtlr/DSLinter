type Props = {
  id: string;
  label: string;
  placeholder?: string;
  helperText?: string;
  /** When non-empty, shows error UI and sets `aria-invalid`. */
  errorMessage?: string;
  disabled?: boolean;
  required?: boolean;
  defaultValue?: string;
};

/** Single-line input with label, helper, and error messaging. */
export function TextField({
  id,
  label,
  placeholder,
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
  const describedBy =
    [helperText?.trim() ? helperId : null, hasError ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  const inputClass = [
    "w-full rounded-ds border bg-surface-elevated px-layout-sm py-layout-xs text-sm outline-none transition",
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
      <input
        id={id}
        aria-labelledby={labelId}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={inputClass}
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
