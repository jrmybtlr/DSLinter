import { definePlayground } from "@dslint/workbench";

type Props = {
  children: React.ReactNode;
};

/** Two-up layout with arbitrary pixel gaps instead of spacing tokens. */
export function FeatureGrid({ children }: Props) {
  return (
    <div className="grid grid-cols-2 gap-[13px] p-[19px]">
      <div className="rounded bg-slate-100 p-[11px]">{children}</div>
      <div className="rounded bg-slate-50 p-[7px]">{children}</div>
    </div>
  );
}

export const { playgroundMeta, playgroundControls, PlaygroundPreview } = definePlayground(FeatureGrid, {
  section: "bad",
  title: "Feature grid",
  description: "Arbitrary pixel gaps (`[#px]`) instead of layout tokens.",
  controls: [{ key: "cellText", label: "Cell text", type: "string", default: "Summary" }],
  props: (values) => ({
    children: <span>{String(values.cellText)}</span>,
  }),
});
