import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { a11ySummaryForModule } from "../report/a11yForModule";
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
function nextPreviewWidthForResize(prevPreview: number, prevOuter: number, nextOuter: number): number {
  if (prevOuter <= 0) return clampPreviewWidth(nextOuter, nextOuter);
  if (nextOuter < prevOuter) return clampPreviewWidth(prevPreview, nextOuter);
  if (Math.abs(prevPreview - prevOuter) <= 2) return clampPreviewWidth(nextOuter, nextOuter);
  return clampPreviewWidth(prevPreview, nextOuter);
}

function TocLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="block rounded-md py-1 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
    </a>
  );
}

export function ComponentPlaygroundPane({ entry, formatModulePath, workspaceReport, reportReady }: Props) {
  const { Preview } = entry;
  const rel = formatModulePath
    ? formatModulePath(entry.modulePath)
    : entry.modulePath.replace(/^\.\.\//, "");

  const [values, setValues] = useState<PlaygroundArgs>(() => defaultArgsFromControls(entry.controls));

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
        <header className="border-b border-slate-200 bg-white p-6">
          <div className="mx-auto">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-500">
                  {entry.meta.group ? (
                    <>
                      Components <span className="text-slate-300">/</span>{" "}
                      <span className="capitalize text-slate-700">{entry.meta.group}</span>
                    </>
                  ) : (
                    "Components"
                  )}
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{entry.meta.title}</h1>
                <p className="mt-1 truncate font-mono text-xs text-slate-500" title={rel}>
                  {rel}
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-6 py-10 lg:px-12">
          <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_12rem] xl:gap-14">
            <div className="min-w-0 space-y-14">
              <section id="examples" className="scroll-mt-20">
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">Examples</h2>
                <div ref={previewMeasureRef} className="mt-4 w-full">
                  <div className="flex justify-center">
                    <div
                      className="relative min-w-0 shrink-0 select-none rounded-lg border border-slate-200 bg-slate-50/80 shadow-sm"
                      style={{ width: previewWidthPx }}
                    >
                      <button
                        type="button"
                        className="absolute left-0 top-0 bottom-0 z-10 flex w-4 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center rounded border-0 bg-slate-100 p-0 shadow-sm ring-1 ring-slate-200/80 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                        aria-label="Resize preview from center (drag left or right)"
                        onPointerDown={attachSymmetricWidthDrag("left")}
                      >
                        <span className="h-10 w-px rounded-full bg-slate-400/90" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="absolute right-0 top-0 bottom-0 z-10 flex w-4 translate-x-1/2 cursor-ew-resize touch-none items-center justify-center rounded border-0 bg-slate-100 p-0 shadow-sm ring-1 ring-slate-200/80 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                        aria-label="Resize preview from center (drag left or right)"
                        onPointerDown={attachSymmetricWidthDrag("right")}
                      >
                        <span className="h-10 w-px rounded-full bg-slate-400/90" aria-hidden />
                      </button>
                      <div className="min-w-0 bg-white p-8">
                        <Preview values={values} />
                      </div>
                    </div>
                  </div>
                  {maxOuterPx > 0 ? (
                    <p className="mt-2 text-center text-[11px] tabular-nums text-slate-400">
                      Preview width {Math.round(previewWidthPx)}px (container {Math.round(maxOuterPx)}px)
                    </p>
                  ) : null}
                </div>
              </section>

             

              {hasControls ? (
                <section id="playground" className="scroll-mt-20">
                  
                  
                  <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">Repo usage</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Every scanned JSX reference to <span className="font-mono text-[13px]">{entry.id}</span> in the workspace: file,
                  line, and props captured at that call site (literals shown as{" "}
                  <span className="font-mono text-[13px]">size=&quot;sm&quot;</span>). Prop frequency across the repo is listed under{" "}
                  <a href="#api-reference" className="font-medium text-slate-800 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500">
                    API reference
                  </a>
                  .
                </p>
                <div className="mt-4">
                  <ComponentUsageDetails report={reportReady ? workspaceReport : null} componentId={entry.id} />
                </div>
              </section>
              
              <PlaygroundTokenStyleSection findings={tokenStyleFindings} reportReady={reportReady} />

              <PlaygroundA11ySection a11y={a11y} reportReady={reportReady} />

              <PlaygroundApiReference
                controls={entry.controls}
                reportUsage={repoUsage}
                declaredPropsFromScan={declaredPropsFromScan}
                governanceReportLoaded={reportReady && workspaceReport != null}
              />
            </div>

            <aside className="relative mt-12 hidden xl:mt-0 xl:block">
              <nav
                aria-label="On this page"
                className="sticky top-8 space-y-0.5 border-l border-slate-200 pl-4 text-[13px]"
              >
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">On this page</p>
                <TocLink href="#source">Source</TocLink>
                <TocLink href="#usage">Usage</TocLink>
                <TocLink href="#repo-usage">Repo usage</TocLink>
                {hasControls ? <TocLink href="#playground">Playground</TocLink> : null}
                <TocLink href="#examples">Examples</TocLink>
                <TocLink href="#design-tokens">Design tokens</TocLink>
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
