import { definePlayground } from "@dslint/workbench";

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

export const { playgroundMeta, playgroundControls, PlaygroundPreview } = definePlayground({
  id: "FlashBanner",
  section: "bad",
  description: "Hardcoded marketing hex instead of tokens — triggers token-hardcoded-color.",
  controls: [
    { key: "title", label: "Banner title", type: "string", default: "Hardcoded neon banner" },
    { key: "showBadLink", label: "Show link without href (a11y demo)", type: "boolean", default: true },
  ],
  render: (values) => (
    <FlashBanner>
      <>
        <p className="font-medium">{String(values.title)}</p>
        {values.showBadLink ? (
          <a className="mt-2 block text-sm underline opacity-90">Missing href</a>
        ) : null}
      </>
    </FlashBanner>
  ),
});
