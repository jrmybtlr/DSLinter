
export type KitchenSinkModalProps = {
  title?: string;
  subtitle?: string;
  icon?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  width?: string;
  dismissible?: boolean;
  initialFocus?: string;
  bannerTone?: string;
  footerAlign?: string;
  scrollLock?: boolean;
  overlayBlur?: boolean;
  analyticsId?: string;
  testId?: string;
  role?: string;
  portal?: boolean;
};

/** Props surface large enough to demo “variant explosion” when fully exercised from JSX. */
export function KitchenSinkModal(props: KitchenSinkModalProps) {
  const {
    title = "Kitchen sink",
    subtitle,
    confirmLabel,
    cancelLabel,
    ...rest
  } = props;

  return (
    <div role="dialog" aria-label={title} className="rounded-lg border border-slate-300 bg-white p-4 shadow-lg">
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
      <div className="mt-3 flex gap-2 text-sm">
        {cancelLabel ? (
          <button type="button" className="rounded border px-3 py-1">
            {cancelLabel}
          </button>
        ) : null}
        {confirmLabel ? (
          <button type="button" className="rounded bg-slate-900 px-3 py-1 text-white">
            {confirmLabel}
          </button>
        ) : null}
      </div>
      <details className="mt-2 text-xs text-slate-500">
        <summary>Debug props</summary>
        <pre>{JSON.stringify(rest, null, 2)}</pre>
      </details>
    </div>
  );
}
