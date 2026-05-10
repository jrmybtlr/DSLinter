import { definePlayground } from "@dslint/workbench";

type Props = {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "danger";
};

const toneClass: Record<NonNullable<Props["tone"]>, string> = {
  neutral: "bg-slate-100 text-slate-800 border-surface-border",
  success: "bg-emerald-50 text-emerald-900 border-emerald-200",
  danger: "bg-danger/10 text-danger border-danger/30",
};

/** Small status pill with constrained variants. */
export function StatusBadge({ children, tone = "neutral" }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}

export const { playgroundMeta, playgroundControls, PlaygroundPreview } = definePlayground(StatusBadge, {
  section: "good",
  description: "Small status pill with constrained variants.",
  controls: [
    {
      key: "tone",
      label: "Tone",
      type: "select",
      default: "success",
      options: [
        { value: "neutral", label: "neutral" },
        { value: "success", label: "success" },
        { value: "danger", label: "danger" },
      ],
    },
    { key: "text", label: "Label text", type: "string", default: "Synced" },
  ],
  props: (values): Props => ({
    children: String(values.text),
    tone: values.tone === "neutral" || values.tone === "danger" ? values.tone : "success",
  }),
});
