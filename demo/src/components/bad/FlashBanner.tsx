import type { PlaygroundControl, PlaygroundMeta, PlaygroundPreviewProps } from "@dslint/workbench";

type Props = {
  children: React.ReactNode;
};

/** Hardcoded marketing hex instead of tokens — triggers token-hardcoded-color. */
export function FlashBanner({ children }: Props) {
  return (
    <div className="rounded-lg px-4 py-3 text-[#ffffff]" style={{ backgroundColor: "#ff0066" }}>
      {children}
    </div>
  );
}

export const playgroundMeta: PlaygroundMeta = {
  id: "FlashBanner",
  title: "FlashBanner",
  section: "bad",
  description: "Hardcoded marketing hex instead of tokens — triggers token-hardcoded-color.",
};

export const playgroundControls: PlaygroundControl[] = [
  { key: "title", label: "Banner title", type: "string", default: "Hardcoded neon banner" },
  { key: "showBadLink", label: "Show link without href (a11y demo)", type: "boolean", default: true },
];

export function PlaygroundPreview({ values }: PlaygroundPreviewProps) {
  return (
    <FlashBanner>
      <>
        <p className="font-medium">{String(values.title)}</p>
        {values.showBadLink ? (
          <a className="mt-2 block text-sm underline opacity-90">Missing href</a>
        ) : null}
      </>
    </FlashBanner>
  );
}
