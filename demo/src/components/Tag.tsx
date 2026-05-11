import { useState } from "react";

type Tone = "neutral" | "success" | "warning" | "danger";

type Props = {
  children: React.ReactNode;
  tone?: Tone;
  /** Shows a remove control; hides the tag after dismiss (local state). */
  dismissible?: boolean;
};

const toneClass: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-800 border-surface-border",
  success: "bg-emerald-50 text-emerald-900 border-emerald-200",
  warning: "bg-amber-50 text-amber-950 border-amber-200",
  danger: "bg-danger/10 text-danger border-danger/30",
};

/** Compact label with optional dismiss. */
export function Tag({ children, tone = "neutral", dismissible = false }: Props) {
  const [visible, setVisible] = useState(true);
  const t = tone in toneClass ? tone : "neutral";
  if (!visible) return null;

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneClass[t]}`}
    >
      <span className="min-w-0 truncate">{children}</span>
      {dismissible ? (
        <button
          type="button"
          className="-mr-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-slate-400"
          aria-label="Remove"
          onClick={() => setVisible(false)}
        >
          <span aria-hidden className="text-[10px] leading-none">
            ×
          </span>
        </button>
      ) : null}
    </span>
  );
}
