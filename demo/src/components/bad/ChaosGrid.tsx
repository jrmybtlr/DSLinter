import { definePlayground } from "@dslint/workbench";

type Props = {
  children: React.ReactNode;
};

/** Arbitrary spacing drift (`[#px]`) instead of layout tokens. */
export function ChaosGrid({ children }: Props) {
  return (
    <div className="grid grid-cols-2 gap-[13px] p-[19px]">
      <div className="rounded bg-slate-100 p-[11px]">{children}</div>
      <div className="rounded bg-slate-50 p-[7px]">{children}</div>
    </div>
  );
}

export const { playgroundMeta, playgroundControls, PlaygroundPreview } = definePlayground(ChaosGrid, {
  section: "bad",
  description: "Arbitrary spacing drift (`[#px]`) instead of layout tokens.",
  controls: [{ key: "cellText", label: "Cell text", type: "string", default: "chaotic" }],
  props: (values) => ({
    children: <span>{String(values.cellText)}</span>,
  }),
});
