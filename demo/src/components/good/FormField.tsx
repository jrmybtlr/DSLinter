import { definePlayground } from "@dslint/workbench";

type Props = {
  id: string;
  label: string;
};

/** Label wired to control — uses `aria-labelledby` so accessible name is explicit for tooling. */
export function FormField({ id, label }: Props) {
  const labelId = `${id}-label`;
  return (
    <div className="flex flex-col gap-layout-xs">
      <label htmlFor={id} id={labelId} className="text-sm font-medium text-slate-800">
        {label}
      </label>
      <input
        id={id}
        aria-labelledby={labelId}
        className="rounded-ds border border-surface-border bg-surface-elevated px-layout-sm py-layout-xs text-sm outline-none ring-primary focus-visible:ring-2"
      />
    </div>
  );
}

export const { playgroundMeta, playgroundControls, PlaygroundPreview } = definePlayground(FormField, {
  section: "good",
  description: "Label wired to control with explicit accessible name.",
  controls: [
    { key: "id", label: "Input id", type: "string", default: "playground-field" },
    { key: "label", label: "Label", type: "string", default: "Email" },
  ],
  props: (values) => ({
    id: String(values.id),
    label: String(values.label),
  }),
});
