import type { PlaygroundControl, PlaygroundMeta, PlaygroundPreviewProps } from "@dslint/workbench";

type Props = {
  children: React.ReactNode;
};

/** Inline code styled from palette, not raw hex in JSX. */
export function InlineCode({ children }: Props) {
  return (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800 ring-1 ring-surface-border">
      {children}
    </code>
  );
}

export const playgroundMeta: PlaygroundMeta = {
  id: "InlineCode",
  title: "InlineCode",
  section: "good",
  description: "Inline code styled from the palette, not raw hex in JSX.",
};

export const playgroundControls: PlaygroundControl[] = [
  { key: "snippet", label: "Code snippet", type: "string", default: "primary" },
];

export function PlaygroundPreview({ values }: PlaygroundPreviewProps) {
  return (
    <p className="text-sm text-slate-700">
      Theme key <InlineCode>{String(values.snippet)}</InlineCode> maps to Tailwind extensions.
    </p>
  );
}
