import type { PlaygroundControl, PlaygroundMeta, PlaygroundPreviewProps } from "@dslint/workbench";

type Props = {
  children: React.ReactNode;
};

/** Marketing strip using hardcoded hex instead of design tokens. */
export function PromoBanner({ children }: Props) {
  return (
    <div className="rounded-lg px-4 py-3 text-[#ffffff]" style={{ backgroundColor: "#dc2626" }}>
      {children}
    </div>
  );
}

export const playgroundMeta: PlaygroundMeta = {
  id: "PromoBanner",
  title: "Promo banner",
  section: "bad",
  description: "Hardcoded banner colors instead of tokens — triggers token-hardcoded-color.",
};

export const playgroundControls: PlaygroundControl[] = [
  { key: "title", label: "Headline", type: "string", default: "Free shipping on orders over $50" },
  { key: "showBadLink", label: "Show link without href (a11y demo)", type: "boolean", default: true },
];

export function PlaygroundPreview({ values }: PlaygroundPreviewProps) {
  return (
    <PromoBanner>
      <>
        <p className="font-medium">{String(values.title)}</p>
        {values.showBadLink ? (
          <a className="mt-2 block text-sm underline opacity-90">See details</a>
        ) : null}
      </>
    </PromoBanner>
  );
}
