import { definePlayground } from "@dslint/workbench";

type Props = {
  children: React.ReactNode;
};

/** Layout primitive using spacing tokens from Tailwind theme. */
export function FlexStack({ children }: Props) {
  return <div className="flex flex-col gap-layout-md">{children}</div>;
}

export const { playgroundMeta, playgroundControls, PlaygroundPreview } = definePlayground({
  id: "FlexStack",
  section: "good",
  description: "Layout primitive composing children with consistent gaps.",
  controls: [
    { key: "blockA", label: "First block text", type: "string", default: "First block" },
    { key: "blockB", label: "Second block text", type: "string", default: "Second block" },
  ],
  render: (values) => (
    <FlexStack>
      <div className="rounded-ds border border-surface-border bg-surface-elevated p-layout-sm text-sm text-slate-700">
        {String(values.blockA)}
      </div>
      <div className="rounded-ds border border-surface-border bg-surface-elevated p-layout-sm text-sm text-slate-700">
        {String(values.blockB)}
      </div>
    </FlexStack>
  ),
});
