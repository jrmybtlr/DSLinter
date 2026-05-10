import type { PlaygroundControl, PlaygroundMeta, PlaygroundPreviewProps } from "@dslint/workbench";

type Props = {
  children: React.ReactNode;
};

/** Layout primitive using spacing tokens from Tailwind theme. */
export function FlexStack({ children }: Props) {
  return <div className="flex flex-col gap-layout-md">{children}</div>;
}

export const playgroundMeta: PlaygroundMeta = {
  id: "FlexStack",
  title: "FlexStack",
  section: "good",
  description: "Layout primitive composing children with consistent gaps.",
};

export const playgroundControls: PlaygroundControl[] = [
  { key: "blockA", label: "First block text", type: "string", default: "First block" },
  { key: "blockB", label: "Second block text", type: "string", default: "Second block" },
];

export function PlaygroundPreview({ values }: PlaygroundPreviewProps) {
  return (
    <FlexStack>
      <div className="rounded-ds border border-surface-border bg-surface-elevated p-layout-sm text-sm text-slate-700">
        {String(values.blockA)}
      </div>
      <div className="rounded-ds border border-surface-border bg-surface-elevated p-layout-sm text-sm text-slate-700">
        {String(values.blockB)}
      </div>
    </FlexStack>
  );
}
