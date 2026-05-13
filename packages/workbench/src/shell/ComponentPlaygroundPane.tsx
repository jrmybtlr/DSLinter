import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { a11ySummaryForModule } from "../report/a11yForModule";
import { codeScoreSummaryForModule } from "../report/codeScoreForModule";
import { tokenStyleFindingsForModule } from "../report/tokenStyleFindingsForModule";
import type { WorkspaceReport } from "../types/report";
import { aggregateDeclaredProps, usageMap } from "../dashboard/aggregate";
import { defaultArgsFromControls } from "../types/controls";
import type { PlaygroundArgs } from "../types/controls";
import type { PlaygroundEntry } from "../types/playground";
import { ComponentUsageDetails } from "../dashboard/ComponentUsageDetails";
import {
  PlaygroundA11ySection,
  PlaygroundApiReference,
  PlaygroundCodeScoreSection,
  PlaygroundTokenStyleSection,
  PlaygroundUsageSection,
} from "./PlaygroundA11yAndCode";
import { PlaygroundControls } from "./PlaygroundControls";

type Props = {
  entry: PlaygroundEntry;
  formatModulePath?: (modulePath: string) => string;
  workspaceReport: WorkspaceReport | null;
  reportReady: boolean;
};

const MIN_PREVIEW_PX = 280;
const DEFAULT_PREVIEW_PX = 1024;

function clampPreviewWidth(w: number, maxOuterPx: number): number {
  if (!Number.isFinite(maxOuterPx) || maxOuterPx <= 0) return w;
  const minBound = Math.min(MIN_PREVIEW_PX, maxOuterPx);
  return Math.min(Math.max(w, minBound), maxOuterPx);
}

/** If the preview was flush with the previous container width, grow/shrink with the viewport. */
function nextPreviewWidthForResize(
  prevPreview: number,
  prevOuter: number,
  nextOuter: number,
): number {
  if (prevOuter <= 0) return clampPreviewWidth(nextOuter, nextOuter);
  if (nextOuter < prevOuter) return clampPreviewWidth(prevPreview, nextOuter);
  if (Math.abs(prevPreview - prevOuter) <= 2) return clampPreviewWidth(nextOuter, nextOuter);
  return clampPreviewWidth(prevPreview, nextOuter);
}

function TocLink({ href, children }: { href: string; children: ReactNode }) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Modifier keys / non-primary clicks → fall back to default browser behaviour.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
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
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className="block rounded-md py-1 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
    >
      {children}
    </a>
  );
}

export function ComponentPlaygroundPane({
  entry,
  formatModulePath,
  workspaceReport,
  reportReady,
}: Props) {
  const { Preview } = entry;
  const rel = formatModulePath
    ? formatModulePath(entry.modulePath)
    : entry.modulePath.replace(/^\.\.\//, "");

  const [values, setValues] = useState<PlaygroundArgs>(() =>
    defaultArgsFromControls(entry.controls),
  );

  useEffect(() => {
    setValues(defaultArgsFromControls(entry.controls));
  }, [entry.id]);

  const a11y = useMemo(
    () => a11ySummaryForModule(reportReady ? workspaceReport : null, entry.modulePath),
    [workspaceReport, entry.modulePath, reportReady],
  );

  const tokenStyleFindings = useMemo(
    () => tokenStyleFindingsForModule(reportReady ? workspaceReport : null, entry.modulePath),
    [workspaceReport, entry.modulePath, reportReady],
  );

  const codeScore = useMemo(
    () => codeScoreSummaryForModule(reportReady ? workspaceReport : null, entry.modulePath),
    [workspaceReport, entry.modulePath, reportReady],
  );

  const repoUsage = useMemo(() => {
    if (!reportReady || !workspaceReport) return undefined;
    return usageMap(workspaceReport).get(entry.id);
  }, [workspaceReport, entry.id, reportReady]);

  const declaredPropsFromScan = useMemo(() => {
    if (!reportReady || !workspaceReport) return [];
    return aggregateDeclaredProps(workspaceReport).get(entry.id) ?? [];
  }, [workspaceReport, entry.id, reportReady]);

  const previewMeasureRef = useRef<HTMLDivElement>(null);
  const maxOuterRef = useRef(0);
  const [maxOuterPx, setMaxOuterPx] = useState(0);
  const [previewWidthPx, setPreviewWidthPx] = useState(DEFAULT_PREVIEW_PX);

  const syncPreviewToOuterWidth = useCallback((nextOuter: number) => {
    if (!Number.isFinite(nextOuter) || nextOuter <= 0) return;
    const prevOuter = maxOuterRef.current;
    maxOuterRef.current = nextOuter;
    setMaxOuterPx(nextOuter);
    setPreviewWidthPx((pw) => nextPreviewWidthForResize(pw, prevOuter, nextOuter));
  }, []);

  useLayoutEffect(() => {
    const el = previewMeasureRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      syncPreviewToOuterWidth(el.clientWidth);
    });
    ro.observe(el);
    syncPreviewToOuterWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [syncPreviewToOuterWidth]);

  const attachSymmetricWidthDrag = useCallback((side: "left" | "right") => {
    return (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      let lastX = e.clientX;
      const sign = side === "right" ? 1 : -1;
      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - lastX;
        lastX = ev.clientX;
        setPreviewWidthPx((w) => clampPreviewWidth(w + sign * 2 * dx, maxOuterRef.current));
      };
      const onUp = (ev: PointerEvent) => {
        target.releasePointerCapture(ev.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    };
  }, []);

  const hasControls = entry.controls.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="min-h-0 flex-1 overflow-auto">
        <header id="source" className="scroll-mt-20 border-b border-gray-200 bg-white p-6">
          <div className="mx-auto">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-500">
                  {entry.meta.group ? (
                    <>
                      Components <span className="text-gray-300">/</span>{" "}
                      <span className="capitalize text-gray-700">{entry.meta.group}</span>
                    </>
                  ) : (
                    "Components"
                  )}
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
                  {entry.meta.title}
                </h1>
                <p className="mt-1 truncate font-mono text-xs text-gray-500" title={rel}>
                  {rel}
                </p>
              </div>
            </div>
          </div>
        </header>

        <section
          id="examples"
          className="px-16 py-10 border-b"
          style={{
            backgroundImage: "radial-gradient(circle, #e2e8f0 1px, transparent 1.5px)",
            backgroundSize: "18px 18px",
          }}
        >
          <div ref={previewMeasureRef}>
            <div className="flex justify-center">
              <div
                className="relative min-w-0 shrink-0 select-none rounded-lg border border-gray-200 bg-gray-50/80 shadow-xs"
                style={{ width: previewWidthPx }}
              >
                <button
                  type="button"
                  className="absolute left-0 top-0 bottom-0 z-10 flex w-4 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center rounded border-0 bg-gray-100 p-0 shadow-xs ring-1 ring-gray-200/80 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                  aria-label="Resize preview from center (drag left or right)"
                  onPointerDown={attachSymmetricWidthDrag("left")}
                >
                  <span className="h-10 w-px rounded-full bg-gray-400/90" aria-hidden />
                </button>
                <button
                  type="button"
                  className="absolute right-0 top-0 bottom-0 z-10 flex w-4 translate-x-1/2 cursor-ew-resize touch-none items-center justify-center rounded border-0 bg-gray-100 p-0 shadow-xs ring-1 ring-gray-200/80 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                  aria-label="Resize preview from center (drag left or right)"
                  onPointerDown={attachSymmetricWidthDrag("right")}
                >
                  <span className="h-10 w-px rounded-full bg-gray-400/90" aria-hidden />
                </button>
                <div className="min-w-0 bg-white p-8">
                  <Preview values={values} />
                </div>
              </div>
            </div>
            {maxOuterPx > 0 ? (
              <p className="mt-2 bg-white w-fit mx-auto p-1 text-center text-xs/none tabular-nums text-gray-400">
                Preview width {Math.round(previewWidthPx)}px (container {Math.round(maxOuterPx)}px)
              </p>
            ) : null}
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-6 py-10 lg:px-12">
          <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_12rem] xl:gap-14">
            <div className="min-w-0 space-y-14">
              {hasControls ? (
                <section id="playground" className="scroll-mt-20">
                  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs">
                    <PlaygroundControls
                      controls={entry.controls}
                      values={values}
                      onChange={setValues}
                      onReset={() => setValues(defaultArgsFromControls(entry.controls))}
                      bare
                    />
                  </div>
                </section>
              ) : null}

              <PlaygroundUsageSection entry={entry} values={values} />

              <section id="repo-usage" className="scroll-mt-20">
                <h2 className="text-lg font-semibold tracking-tight text-gray-900">Repo usage</h2>
                <div className="mt-4">
                  <ComponentUsageDetails
                    report={reportReady ? workspaceReport : null}
                    componentId={entry.id}
                  />
                </div>
              </section>

              <PlaygroundTokenStyleSection
                findings={tokenStyleFindings}
                reportReady={reportReady}
              />

              <PlaygroundCodeScoreSection codeScore={codeScore} reportReady={reportReady} />

              <PlaygroundA11ySection a11y={a11y} reportReady={reportReady} />

              <PlaygroundApiReference
                controls={entry.controls}
                reportUsage={repoUsage}
                declaredPropsFromScan={declaredPropsFromScan}
                governanceReportLoaded={reportReady && workspaceReport != null}
              />
            </div>

            <aside className="mt-12 hidden self-start sticky top-8 xl:mt-0 xl:block">
              <nav
                aria-label="On this page"
                className="space-y-0.5 border-l border-gray-200 pl-4 text-sm"
              >
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  On this page
                </p>
                <TocLink href="#source">Source</TocLink>
                <TocLink href="#usage">Usage</TocLink>
                <TocLink href="#repo-usage">Repo usage</TocLink>
                {hasControls ? <TocLink href="#playground">Playground</TocLink> : null}
                <TocLink href="#examples">Examples</TocLink>
                <TocLink href="#design-tokens">Design tokens</TocLink>
                <TocLink href="#code-score">Code score</TocLink>
                <TocLink href="#accessibility">Accessibility</TocLink>
                {hasControls ? <TocLink href="#api-reference">API reference</TocLink> : null}
              </nav>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
