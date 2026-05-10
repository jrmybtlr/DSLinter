import type { PlaygroundControl, PlaygroundMeta, PlaygroundPreviewProps } from "@dslint/workbench";

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

export const playgroundMeta: PlaygroundMeta = {
  id: "ChaosGrid",
  title: "ChaosGrid",
  section: "bad",
  description: "Arbitrary spacing drift (`[#px]`) instead of layout tokens.",
};

export const playgroundControls: PlaygroundControl[] = [
  { key: "cellText", label: "Cell text", type: "string", default: "chaotic" },
];

export function PlaygroundPreview({ values }: PlaygroundPreviewProps) {
  return (
    <ChaosGrid>
      <span>{String(values.cellText)}</span>
    </ChaosGrid>
  );
}
