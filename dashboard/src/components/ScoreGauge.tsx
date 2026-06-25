import type { MouseEvent } from "react";
import { cn } from "../lib/utils";

/** Score bands (0–49 poor, 50–89 average, 90–100 good). */
export type ScoreGaugeBand = "poor" | "average" | "good";

export function scoreGaugeBand(score: number): ScoreGaugeBand {
  if (score >= 90) return "good";
  if (score >= 50) return "average";
  return "poor";
}

const BAND_STYLES: Record<
  ScoreGaugeBand,
  { stroke: string; track: string; text: string }
> = {
  good: {
    stroke: "stroke-success",
    track: "stroke-success/15",
    text: "text-success",
  },
  average: {
    stroke: "stroke-warning",
    track: "stroke-warning/15",
    text: "text-warning",
  },
  poor: {
    stroke: "stroke-destructive",
    track: "stroke-destructive/15",
    text: "text-destructive",
  },
};

const PENDING_STYLES = {
  stroke: "stroke-muted-foreground",
  track: "stroke-border",
  text: "text-muted-foreground",
};

type ScoreGaugeProps = {
  label: string;
  /** 0–100, or null when the score is not yet available. */
  value: number | null;
  href?: string;
  /** Show a trailing ellipsis on the numeric label (e.g. variant scan still running). */
  pending?: boolean;
  className?: string;
};

const GAUGE_SIZE = 56;
const STROKE_WIDTH = 4;

function scrollToHash(href: string, e: MouseEvent<HTMLAnchorElement>) {
  if (
    e.defaultPrevented ||
    e.button !== 0 ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.altKey
  ) {
    return;
  }
  const id = href.startsWith("#") ? href.slice(1) : href;
  const target = id ? document.getElementById(id) : null;
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  if (typeof window !== "undefined" && window.history?.replaceState) {
    window.history.replaceState(null, "", `#${id}`);
  }
}

export function ScoreGauge({
  label,
  value,
  href,
  pending = false,
  className,
}: ScoreGaugeProps) {
  const radius = (GAUGE_SIZE - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped =
    value == null ? 0 : Math.max(0, Math.min(100, Math.round(value)));
  const styles =
    value == null ? PENDING_STYLES : BAND_STYLES[scoreGaugeBand(clamped)];
  const dashOffset =
    value == null
      ? circumference
      : circumference - (clamped / 100) * circumference;

  const content = (
    <>
      <div
        className="relative shrink-0"
        style={{ width: GAUGE_SIZE, height: GAUGE_SIZE }}
        aria-hidden
      >
        <svg
          width={GAUGE_SIZE}
          height={GAUGE_SIZE}
          viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`}
          className="-rotate-90"
          fill="none"
        >
          <circle
            cx={GAUGE_SIZE / 2}
            cy={GAUGE_SIZE / 2}
            r={radius}
            className={cn("fill-none", styles.track)}
            strokeWidth={STROKE_WIDTH}
          />
          {value != null ? (
            <circle
              cx={GAUGE_SIZE / 2}
              cy={GAUGE_SIZE / 2}
              r={radius}
              className={cn("fill-none", styles.stroke)}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          ) : null}
        </svg>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center text-base font-semibold tabular-nums",
            styles.text,
          )}
        >
          {value == null ? "—" : clamped}
        </span>
      </div>
      <span className="mt-1 max-w-22 text-center text-xs leading-tight text-muted-foreground">
        {label}
        {pending ? "…" : null}
      </span>
    </>
  );

  const rootClass = cn(
    "flex flex-col items-center gap-0",
    href &&
      "rounded-lg transition hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );

  if (href) {
    return (
      <a
        href={href}
        onClick={(e) => scrollToHash(href, e)}
        className={rootClass}
        aria-label={
          value == null
            ? `${label}: not available`
            : `${label}: ${clamped} out of 100${pending ? ", updating" : ""}`
        }
      >
        {content}
      </a>
    );
  }

  return (
    <div
      className={rootClass}
      role="img"
      aria-label={
        value == null
          ? `${label}: not available`
          : `${label}: ${clamped} out of 100${pending ? ", updating" : ""}`
      }
    >
      {content}
    </div>
  );
}
