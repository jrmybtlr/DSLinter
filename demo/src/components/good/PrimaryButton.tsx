import { definePlayground } from "@dslint/workbench";

type Props = {
  children: React.ReactNode;
  type?: "button" | "submit";
};

/** Uses Tailwind theme tokens (`primary`) — “good” baseline. */
export function PrimaryButton({ children, type = "button" }: Props) {
  return (
    <button
      type={type}
      className="rounded-ds bg-primary px-layout-md py-layout-xs text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {children}
    </button>
  );
}

export const { playgroundMeta, playgroundControls, PlaygroundPreview } = definePlayground(PrimaryButton, {
  section: "good",
  description: "Uses Tailwind theme tokens (`primary`) — good baseline.",
  controls: [
    { key: "label", label: "Label", type: "string", default: "Save", placeholder: "Button text" },
    {
      key: "type",
      label: "Native type",
      type: "select",
      default: "button",
      options: [
        { value: "button", label: "button" },
        { value: "submit", label: "submit" },
      ],
    },
  ],
  props: (values): Props => ({
    children: String(values.label),
    type: values.type === "submit" ? "submit" : "button",
  }),
});
