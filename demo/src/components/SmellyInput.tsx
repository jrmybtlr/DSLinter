import { useEffect } from "react";
import { KitchenSinkModal } from "./KitchenSinkModal";
import { LegacyButton } from "./TestingButton";

/** Intentionally awful: exercise DSLint smells, tokens, deprecation, variant explosion, and intrinsic a11y rules. */
export function SmellyInput(): JSX.Element {
  // token-hardcoded-color (keep off the same source line as `[#…]` / `[…px]` arbitrary classes — dedupe drops hex there)
  const HARDCODED_CHART_COLOR = "#ff00ff";

  useEffect(() => {
    // smell-console + smell-console-error
    // eslint-disable-next-line no-console -- demo: suppression-comment smell
    console.warn("smelly-input: console noise");
    console.error("smelly-input: console.error");
    try {
      JSON.parse("{");
    } catch {
      // smell-empty-catch
    }
    if (false) {
      // smell-debugger (never runs; still scanned)
      debugger;
    }
  }, []);

  void HARDCODED_CHART_COLOR;

  // smell-suppression-comment (TypeScript directive)
  // @ts-ignore — demo only: invalid assignment shape
  const _forced: string = 1;

  // smell-todo-marker
  // TODO: tear down this demo component before shipping

  // HACK: keep a tailwind arbitrary token on its own line (token-tailwind-arbitrary)
  const tailwindArbitraryDemo = "shadow-[0_0_0_1px] ring-[12px]";

  return (
    <div
      className={`space-y-3 rounded border border-dashed text-[#000000] border-amber-400 p-3 text-xs ${tailwindArbitraryDemo}`}
    >
      {/* smell-redundant-fragment — wraps a single element */}
      <>
        <div className="space-y-2">
          <p className="font-medium text-amber-900">
            Smelly input (governance demo)
          </p>

          {/* smell-inline-style */}
          <span style={{ display: "block" }}>
            Inline style (prefer tokens / utilities)
          </span>

          {/* deprecated-component */}
          <LegacyButton variant="ghost" size="sm">
            Deprecated control
          </LegacyButton>

          {/* variant-explosion — ≥14 props on one JSX tag */}
          <KitchenSinkModal
            title="Smell"
            subtitle="Kitchen sink"
            icon="⚠️"
            confirmLabel="OK"
            cancelLabel="Cancel"
            width="max-w-md"
            dismissible
            initialFocus="confirm"
            bannerTone="warning"
            footerAlign="end"
            scrollLock
            overlayBlur
            analyticsId="smelly-input"
            testId="smelly-modal"
            role="dialog"
            portal
          />

          {/* a11y-input-label */}
          <input
            type="text"
            placeholder="Unlabeled field"
            className="w-full rounded border px-2 py-1"
          />

          {/* a11y-button-name */}
          <button type="button" className="h-8 w-8 rounded bg-slate-200" />

          {/* a11y-img-alt */}
          <img
            src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
            width={16}
            height={16}
            className="inline-block"
          />

          {/* a11y-anchor-href */}
          <a className="text-blue-600 underline">Link without href</a>

          {/* a11y-anchor-placeholder-href */}
          <a href="#" className="text-blue-600 underline">
            Placeholder href
          </a>
        </div>
      </>
    </div>
  );
}
