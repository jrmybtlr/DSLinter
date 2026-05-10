import { definePlayground } from "@dslint/workbench";

export type SettingsDialogProps = {
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

/** Typical “settings” dialog with a prop list that grows every sprint. */
export function SettingsDialog(props: SettingsDialogProps) {
  const {
    title = "Notification settings",
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
        <summary>Extra props (debug)</summary>
        <pre>{JSON.stringify(rest, null, 2)}</pre>
      </details>
    </div>
  );
}

export const { playgroundMeta, playgroundControls, PlaygroundPreview } = definePlayground(SettingsDialog, {
  section: "bad",
  title: "Settings dialog",
  description: "Large prop surface — variant explosion when the preview passes every knob.",
  controls: [
    { key: "title", label: "title", type: "string", default: "Notification settings" },
    {
      key: "subtitle",
      label: "subtitle",
      type: "string",
      default: "Choose how we contact you about updates.",
    },
    { key: "confirmLabel", label: "confirmLabel", type: "string", default: "Save changes" },
    { key: "cancelLabel", label: "cancelLabel", type: "string", default: "Cancel" },
    { key: "width", label: "width", type: "string", default: "520px", placeholder: "e.g. 480px" },
    {
      key: "icon",
      label: "icon",
      type: "select",
      default: "warn",
      options: [
        { value: "warn", label: "warn" },
        { value: "info", label: "info" },
        { value: "none", label: "none" },
      ],
    },
    {
      key: "initialFocus",
      label: "initialFocus",
      type: "select",
      default: "confirm",
      options: [
        { value: "confirm", label: "confirm" },
        { value: "cancel", label: "cancel" },
      ],
    },
    {
      key: "bannerTone",
      label: "bannerTone",
      type: "select",
      default: "critical",
      options: [
        { value: "critical", label: "critical" },
        { value: "neutral", label: "neutral" },
      ],
    },
    {
      key: "footerAlign",
      label: "footerAlign",
      type: "select",
      default: "end",
      options: [
        { value: "end", label: "end" },
        { value: "start", label: "start" },
        { value: "center", label: "center" },
      ],
    },
    { key: "dismissible", label: "dismissible", type: "boolean", default: true },
    { key: "scrollLock", label: "scrollLock", type: "boolean", default: true },
    { key: "overlayBlur", label: "overlayBlur", type: "boolean", default: true },
    { key: "portal", label: "portal", type: "boolean", default: false },
    {
      key: "analyticsId",
      label: "analyticsId",
      type: "string",
      default: "notification-settings-modal",
    },
    { key: "testId", label: "testId", type: "string", default: "settings-dialog" },
    {
      key: "role",
      label: "role",
      type: "select",
      default: "dialog",
      options: [
        { value: "dialog", label: "dialog" },
        { value: "alertdialog", label: "alertdialog" },
      ],
    },
  ],
  props: (values) => ({
    title: String(values.title),
    subtitle: String(values.subtitle),
    confirmLabel: String(values.confirmLabel),
    cancelLabel: String(values.cancelLabel),
    width: String(values.width),
    icon: String(values.icon),
    dismissible: Boolean(values.dismissible),
    initialFocus: String(values.initialFocus),
    bannerTone: String(values.bannerTone),
    footerAlign: String(values.footerAlign),
    scrollLock: Boolean(values.scrollLock),
    overlayBlur: Boolean(values.overlayBlur),
    analyticsId: String(values.analyticsId),
    testId: String(values.testId),
    role: String(values.role),
    portal: Boolean(values.portal),
  }),
});
