import type { PlaygroundControl, PlaygroundMeta, PlaygroundPreviewProps } from "@dslint/workbench";

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

export const playgroundMeta: PlaygroundMeta = {
  id: "FeatureGrid",
  title: "Feature grid",
  section: "bad",
  description: "Arbitrary pixel gaps (`[#px]`) instead of layout tokens.",
};

export const playgroundControls: PlaygroundControl[] = [
  { key: "cellText", label: "Cell text", type: "string", default: "Summary" },
];

export function PlaygroundPreview({ values }: PlaygroundPreviewProps) {
  return (
    <FeatureGrid>
      <span>{String(values.cellText)}</span>
    </FeatureGrid>
  );
}
