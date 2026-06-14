import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { detectBreakpoint, detectContainerBreakpoint } from "usemods";
import { a11ySummaryForModule } from "../report/a11yForModule";
import { codeScoreSummaryForModule } from "../report/codeScoreForModule";
import { tokenStyleFindingsForModule } from "../report/tokenStyleFindingsForModule";
import type { WorkspaceReport } from "../types/report";
import {
  aggregateDeclaredProps,
  catalogChildComponentsFor,
  componentCatalogFamilyForName,
  usageMap,
} from "../dashboard/aggregate";
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
import { PlaygroundAppThemeWrapper } from "./PlaygroundAppThemeWrapper";
import { PlaygroundPreviewErrorBoundary } from "./PlaygroundPreviewErrorBoundary";
import { PlaygroundVariantMatrix } from "./PlaygroundVariantMatrix";
import { enumerateControlCombinations } from "../playground/enumerateControlCombinations";
import {
  mergePlaygroundA11yFindings,
  playgroundA11yScore,
  type PlaygroundA11yFinding,
} from "../playground/scanVariantA11y";
import { HideFromCatalogButton } from "./HideFromCatalogButton";
import { OpenInEditorButton } from "./OpenInEditorButton";
import { ScoreGauge } from "./ScoreGauge";
import { Section } from "./Section";
import { resolveModuleAbsolutePath } from "../dashboard/editorLink";

type Props = {
  entry: PlaygroundEntry;
  workspaceReport: WorkspaceReport | null;
  reportReady: boolean;
  onOpenComponent: (componentId: string) => void;
  onHideFromCatalog?: (componentId: string) => void;
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
  if (Math.abs(prevPreview - prevOuter) <= 2)
    return clampPreviewWidth(nextOuter, nextOuter);
  return clampPreviewWidth(prevPreview, nextOuter);
}

function PreviewResizeHandle({
  side,
  onPointerDown,
}: {
  side: "left" | "right";
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void;
}) {
  const positionClass =
    side === "left" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2";

  return (
    <button
      type="button"
      className={`absolute top-0 bottom-0 z-10 flex w-4 ${positionClass} cursor-ew-resize touch-none items-center justify-center rounded border-0 bg-muted p-0 shadow-xs ring-1 ring-border hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
      aria-label="Resize preview from center (drag left or right)"
      onPointerDown={onPointerDown}
    >
      <span
        className="h-10 w-px rounded-full bg-muted-foreground/40"
        aria-hidden
      />
    </button>
  );
}

function TocLink({ href, children }: { href: string; children: ReactNode }) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Modifier keys / non-primary clicks → fall back to default browser behaviour.
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
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className="block rounded-md py-1 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
    >
      {children}
    </a>
  );
}

export function ComponentPlaygroundPane({
  entry,
  workspaceReport,
  reportReady,
  onOpenComponent: _onOpenComponent,
  onHideFromCatalog,
}: Props) {
  const { renderPreview } = entry;
  const sourceAbsolutePath = workspaceReport?.root
    ? resolveModuleAbsolutePath(workspaceReport.root, entry.modulePath)
    : undefined;

  const [values, setValues] = useState<PlaygroundArgs>(() =>
    defaultArgsFromControls(entry.controls),
  );

  useEffect(() => {
    setValues(defaultArgsFromControls(entry.controls));
  }, [entry.id]);

  const a11y = useMemo(
    () =>
      a11ySummaryForModule(
        reportReady ? workspaceReport : null,
        entry.modulePath,
      ),
    [workspaceReport, entry.modulePath, reportReady],
  );

  const tokenStyleFindings = useMemo(
    () =>
      tokenStyleFindingsForModule(
        reportReady ? workspaceReport : null,
        entry.modulePath,
      ),
    [workspaceReport, entry.modulePath, reportReady],
  );

  const codeScore = useMemo(
    () =>
      codeScoreSummaryForModule(
        reportReady ? workspaceReport : null,
        entry.modulePath,
      ),
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
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const previewWidthLabelRef = useRef<HTMLSpanElement>(null);
  const livePreviewWidthRef = useRef(DEFAULT_PREVIEW_PX);
  const maxOuterRef = useRef(0);
  const [maxOuterPx, setMaxOuterPx] = useState(0);
  const [previewWidthPx, setPreviewWidthPx] = useState(DEFAULT_PREVIEW_PX);
  const [windowBreakpoint, setWindowBreakpoint] = useState<string | null>(null);
  const [containerBreakpoint, setContainerBreakpoint] = useState<string | null>(
    null,
  );

  useEffect(() => {
    livePreviewWidthRef.current = previewWidthPx;
  }, [previewWidthPx]);

  const applyLivePreviewWidth = useCallback((w: number) => {
    const clamped = clampPreviewWidth(w, maxOuterRef.current);
    livePreviewWidthRef.current = clamped;
    const frame = previewFrameRef.current;
    if (frame) {
      frame.style.width = `${clamped}px`;
    }
    const label = previewWidthLabelRef.current;
    if (label) {
      label.textContent = `${Math.round(clamped)}px`;
    }
    return clamped;
  }, []);

  const syncPreviewToOuterWidth = useCallback((nextOuter: number) => {
    if (!Number.isFinite(nextOuter) || nextOuter <= 0) return;
    const prevOuter = maxOuterRef.current;
    maxOuterRef.current = nextOuter;
    setMaxOuterPx(nextOuter);
    setPreviewWidthPx((pw) =>
      nextPreviewWidthForResize(pw, prevOuter, nextOuter),
    );
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

  const syncUsemodsBreakpoints = useCallback(() => {
    setWindowBreakpoint(detectBreakpoint());
    const frame = previewFrameRef.current;
    setContainerBreakpoint(frame ? detectContainerBreakpoint(frame) : null);
  }, []);

  useLayoutEffect(() => {
    const frame = previewFrameRef.current;
    if (!frame) return;
    const ro = new ResizeObserver(() => {
      syncUsemodsBreakpoints();
    });
    ro.observe(frame);
    syncUsemodsBreakpoints();
    return () => ro.disconnect();
  }, [syncUsemodsBreakpoints]);

  useEffect(() => {
    syncUsemodsBreakpoints();
    window.addEventListener("resize", syncUsemodsBreakpoints);
    return () => window.removeEventListener("resize", syncUsemodsBreakpoints);
  }, [syncUsemodsBreakpoints]);

  const attachSymmetricWidthDrag = useCallback(
    (side: "left" | "right") => {
      return (e: PointerEvent<HTMLButtonElement>) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const target = e.currentTarget;
        target.setPointerCapture(e.pointerId);

        let lastX = e.clientX;
        let currentWidth = livePreviewWidthRef.current;
        let rafId = 0;
        const sign = side === "right" ? 1 : -1;
        const prevBodyCursor = document.body.style.cursor;
        const prevBodyUserSelect = document.body.style.userSelect;
        document.body.style.cursor = "ew-resize";
        document.body.style.userSelect = "none";

        const flushWidth = () => {
          rafId = 0;
          applyLivePreviewWidth(currentWidth);
        };

        const onMove = (ev: globalThis.PointerEvent) => {
          const dx = ev.clientX - lastX;
          lastX = ev.clientX;
          currentWidth = clampPreviewWidth(
            currentWidth + sign * 2 * dx,
            maxOuterRef.current,
          );
          if (!rafId) {
            rafId = requestAnimationFrame(flushWidth);
          }
        };

        const endDrag = (ev: globalThis.PointerEvent) => {
          if (rafId) {
            cancelAnimationFrame(rafId);
            applyLivePreviewWidth(currentWidth);
          }
          setPreviewWidthPx(livePreviewWidthRef.current);
          document.body.style.cursor = prevBodyCursor;
          document.body.style.userSelect = prevBodyUserSelect;
          target.releasePointerCapture(ev.pointerId);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", endDrag);
          window.removeEventListener("pointercancel", endDrag);
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", endDrag);
        window.addEventListener("pointercancel", endDrag);
      };
    },
    [applyLivePreviewWidth],
  );

  const hasControls = entry.controls.length > 0;

  const variantEnumeration = useMemo(
    () => enumerateControlCombinations(entry.controls, values),
    [entry.controls, values],
  );

  const showVariantsSection =
    hasControls &&
    (variantEnumeration.combinations.length > 0 ||
      variantEnumeration.totalCount === 0);

  const [variantA11yFindings, setVariantA11yFindings] = useState<
    PlaygroundA11yFinding[]
  >([]);
  const [variantScanComplete, setVariantScanComplete] = useState(false);

  useEffect(() => {
    setVariantA11yFindings([]);
    setVariantScanComplete(false);
  }, [entry.id, variantEnumeration.combinations]);

  const handleVariantA11yScan = useCallback(
    (findings: PlaygroundA11yFinding[]) => {
      setVariantA11yFindings(findings);
      setVariantScanComplete(true);
    },
    [],
  );

  const combinedA11y = useMemo(() => {
    const findings = mergePlaygroundA11yFindings(
      a11y.findings,
      variantA11yFindings,
    );
    return {
      ...a11y,
      findings,
      issueCount: findings.length,
      score: playgroundA11yScore(a11y.findings, variantA11yFindings),
    };
  }, [a11y, variantA11yFindings]);

  const hasVariantMatrix = variantEnumeration.combinations.length > 0;
  const variantScanPending = hasVariantMatrix && !variantScanComplete;
  const a11yScoreLabel =
    reportReady || variantScanComplete
      ? `${combinedA11y.score}/100${variantScanPending ? "…" : ""}`
      : "—";

  const report = reportReady ? workspaceReport : null;
  const family = useMemo(
    () => componentCatalogFamilyForName(report, entry.id),
    [report, entry.id],
  );
  const childComponents = catalogChildComponentsFor(family, entry.id);
  const resetControls = () =>
    setValues(defaultArgsFromControls(entry.controls));

  const tocItems: { href: string; label: string; show?: boolean }[] = [
    { href: "#api-reference", label: "API reference", show: hasControls },
    { href: "#usage", label: "Usage" },
    {
      href: "#subcomponents",
      label: "Subcomponents",
      show: childComponents.length > 0,
    },
    { href: "#repo-usage", label: "Repo usage" },
    { href: "#design-tokens", label: "Design tokens" },
    { href: "#code-score", label: "Code score" },
    { href: "#accessibility", label: "Accessibility" },
    { href: "#variants", label: "Variants", show: showVariantsSection },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="min-h-0 flex-1 overflow-auto">
        <header
          id="source"
          className="scroll-mt-20 border-b border-border bg-card p-6 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">
              Components
              {entry.meta.group ? (
                <>
                  {" "}
                  <span className="text-muted-foreground/40">/</span>{" "}
                  <span className="capitalize text-foreground/80">
                    {entry.meta.group}
                  </span>
                </>
              ) : null}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {entry.meta.title}
            </h1>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {sourceAbsolutePath ? (
                <OpenInEditorButton filePath={sourceAbsolutePath} />
              ) : null}
              {onHideFromCatalog ? (
                <HideFromCatalogButton
                  componentName={entry.meta.id}
                  onHidden={onHideFromCatalog}
                />
              ) : null}
            </div>
            <div className="flex items-start gap-5">
              <ScoreGauge
                label="Code score"
                value={reportReady ? codeScore.score : null}
                href="#code-score"
              />
              <ScoreGauge
                label="Accessibility"
                value={
                  reportReady || variantScanComplete ? combinedA11y.score : null
                }
                href="#accessibility"
                pending={variantScanPending}
              />
            </div>
          </div>
        </header>

        <section
          id="examples"
          className="ds-playground-dot-surface border-b px-16 py-10"
        >
          <div ref={previewMeasureRef}>
            <div className="flex justify-center">
              <div
                ref={previewFrameRef}
                className="relative min-w-0 shrink-0 select-none rounded-lg border border-border bg-background shadow-xs will-change-[width]"
                style={{ width: previewWidthPx }}
              >
                <PreviewResizeHandle
                  side="left"
                  onPointerDown={attachSymmetricWidthDrag("left")}
                />
                <PreviewResizeHandle
                  side="right"
                  onPointerDown={attachSymmetricWidthDrag("right")}
                />
                <PlaygroundAppThemeWrapper
                  workspaceReport={report}
                  className="min-w-0 p-8"
                >
                  <PlaygroundPreviewErrorBoundary
                    componentName={entry.meta.title}
                  >
                    {renderPreview(values)}
                  </PlaygroundPreviewErrorBoundary>
                </PlaygroundAppThemeWrapper>
              </div>
            </div>
            {maxOuterPx > 0 ? (
              <div className="mx-auto mt-4 flex h-6 w-fit items-center overflow-hidden rounded-sm border border-border bg-card text-center font-mono text-xs/none tabular-nums text-muted-foreground divide-x divide-border">
                <span ref={previewWidthLabelRef} className="p-2.5">
                  {Math.round(previewWidthPx)}px
                </span>
                <span className="p-2.5" title="usemods detectBreakpoint">
                  Screen: {windowBreakpoint ?? "—"}
                </span>
                <span
                  className="p-2.5"
                  title="usemods detectContainerBreakpoint"
                >
                  Container: {containerBreakpoint ?? "—"}
                </span>
              </div>
            ) : null}
          </div>
        </section>

        <div className="min-w-0 w-full px-6 py-10 lg:px-12">
          <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_12rem] xl:gap-14">
            <div className="min-w-0 space-y-14">
              {hasControls ? (
                <PlaygroundApiReference
                  entry={entry}
                  controls={entry.controls}
                  values={values}
                  onChange={setValues}
                  onReset={resetControls}
                  reportUsage={repoUsage}
                  declaredPropsFromScan={declaredPropsFromScan}
                  governanceReportLoaded={report != null}
                />
              ) : null}

              <PlaygroundUsageSection entry={entry} values={values} />

              <Section id="repo-usage" title="Repo usage" description="">
                <ComponentUsageDetails report={report} componentId={entry.id} />
              </Section>

              <Section
                id="design-tokens"
                title="Design tokens and colors"
                description="Hardcoded colors and non-token styling flagged by DSLinter for this module's source file."
              >
                <PlaygroundTokenStyleSection
                  findings={tokenStyleFindings}
                  reportReady={reportReady}
                />
              </Section>

              <Section
                id="code-score"
                title={`Code score: ${reportReady ? codeScore.score : "—"}/100`}
                description="Static quality rules and findings from the workspace DSLinter report scoped to this file."
              >
                <PlaygroundCodeScoreSection
                  codeScore={codeScore}
                  reportReady={reportReady}
                />
              </Section>

              <Section
                id="accessibility"
                title={`Accessibility: ${a11yScoreLabel}`}
                description="Static accessibility rules from the DSLinter report, plus runtime color-contrast checks on each variant preview below."
              >
                <PlaygroundA11ySection
                  a11y={combinedA11y}
                  reportReady={reportReady || variantScanComplete}
                  variantScanPending={variantScanPending}
                />
              </Section>
            </div>

            <aside className="mt-12 hidden self-start sticky top-8 xl:mt-0 xl:block">
              <nav
                aria-label="On this page"
                className="space-y-0.5 border-l border-border pl-4 text-sm"
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  On this page
                </p>
                {tocItems.map(({ href, label, show = true }) =>
                  show ? (
                    <TocLink key={href} href={href}>
                      {label}
                    </TocLink>
                  ) : null,
                )}
              </nav>
            </aside>
          </div>
        </div>

        {variantEnumeration.combinations.length > 0 ? (
          <section
            id="variants"
            className="ds-playground-dot-surface mt-8 w-full scroll-mt-20 border-t pt-10 pb-12"
          >
            <div className="min-w-0 w-full px-6 lg:px-12">
              <h2 className="w-fit bg-card text-xl font-semibold tracking-tight text-foreground">
                All variants
              </h2>
              <PlaygroundVariantMatrix
                renderPreview={renderPreview}
                combinations={variantEnumeration.combinations}
                finiteAxisKeys={variantEnumeration.finiteAxisKeys}
                totalCount={variantEnumeration.totalCount}
                capped={variantEnumeration.capped}
                onVariantA11yScan={handleVariantA11yScan}
              />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
