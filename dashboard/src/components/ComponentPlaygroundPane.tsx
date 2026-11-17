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
import { a11ySummaryForModule } from "../report/a11yForModule";
import { codeScoreSummaryForModule } from "../report/codeScoreForModule";
import { tokenStyleFindingsForModule } from "../report/tokenStyleFindingsForModule";
import type { WorkspaceReport } from "../types/report";
import { aggregateDeclaredProps, usageMap } from "../dashboard/aggregate";
import { defaultArgsFromControls } from "../types/controls";
import type { PlaygroundArgs, PlaygroundValuesUpdater } from "../types/controls";
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
  CONTAINER_WIDTH_PRESETS,
  SCREEN_WIDTH_PRESETS,
  containerBreakpointForWidth,
  screenBreakpointForWidth,
} from "../playground/previewBreakpoints";
import {
  mergePlaygroundA11yFindings,
  playgroundA11yScore,
  type PlaygroundA11yFinding,
} from "../playground/scanVariantA11y";
import { HideFromCatalogButton } from "./HideFromCatalogButton";
import { IconInfo } from "./icons";
import { OpenInEditorButton } from "./OpenInEditorButton";
import { SourcePathActions } from "./SourcePathActions";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { ScoreGauge } from "./ScoreGauge";
import { Section } from "./Section";
import { resolveModuleAbsolutePath } from "../dashboard/editorLink";
import { cn } from "../lib/utils";
import { useDashboardTheme, type DashboardResolvedTheme } from "../shell/DashboardTheme";
import { PreviewSectionThemeContext } from "../shell/previewSectionTheme";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

type Props = {
  entry: PlaygroundEntry;
  workspaceReport: WorkspaceReport | null;
  reportReady: boolean;
  onHideFromCatalog?: (componentId: string) => void;
  /** Immediate hide, without the catalog config dialog. */
  onHideComponent?: () => void;
  values?: PlaygroundArgs;
  onValuesChange?: PlaygroundValuesUpdater;
  onResetControls?: () => void;
  headerActions?: ReactNode;
  renderVariantPreview?: (values: PlaygroundArgs) => ReactNode;
  runtimeA11y?: { findings: PlaygroundA11yFinding[]; pending: boolean; message?: string };
  isolatedPreview?: boolean;
  /** Providers the live preview wrapped in without a configured adapter. */
  suppliedProviders?: string[];
  /** Explanation of example values applied to make the live preview visible. */
  previewNote?: string;
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

function PreviewResizeHandle({
  side,
  onPointerDown,
}: {
  side: "left" | "right";
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void;
}) {
  const positionClass = side === "left" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2";

  return (
    <button
      type="button"
      className={`absolute top-0 bottom-0 z-10 flex w-4 ${positionClass} cursor-ew-resize touch-none items-center justify-center rounded border-0 bg-muted p-0 shadow-xs ring-1 ring-border hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
      aria-label="Resize preview from center (drag left or right)"
      onPointerDown={onPointerDown}
    >
      <span className="h-10 w-px rounded-full bg-muted-foreground/40" aria-hidden />
    </button>
  );
}

function BreakpointPresetSelect({
  kind,
  value,
  presets,
  onSelectWidth,
}: {
  kind: "screen" | "container";
  value: string;
  presets: readonly { label: string; width: number }[];
  onSelectWidth: (width: number) => void;
}) {
  const kindLabel = kind === "screen" ? "Screen" : "Container";

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const preset = presets.find((p) => p.label === next);
        if (preset) onSelectWidth(preset.width);
      }}
    >
      <SelectTrigger
        aria-label={`Select ${kind} width preset`}
        title={`${kindLabel}: ${value} — click to set a predefined width`}
        className={cn(
          "h-full w-auto gap-0 rounded-none border-0 bg-transparent px-2.5 py-0 shadow-none last:border-l",
          "font-mono text-xs/none text-muted-foreground tabular-nums",
          "hover:bg-accent hover:text-accent-foreground",
          "focus:ring-0 focus:ring-offset-0 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
          "[&>svg]:hidden",
        )}
      >
        <SelectValue>
          {kindLabel}:&nbsp;{value}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="center" className="min-w-36">
        {presets.map((preset) => (
          <SelectItem
            key={preset.label}
            value={preset.label}
            textValue={`${preset.label} ${preset.width}px`}
            className="font-mono text-xs tabular-nums"
          >
            {preset.label}
            <span className="ml-2 text-muted-foreground">{preset.width}px</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TocLink({
  href,
  active,
  onActivate,
  children,
}: {
  href: string;
  active: boolean;
  onActivate: () => void;
  children: ReactNode;
}) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Modifier keys / non-primary clicks → fall back to default browser behaviour.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    const id = href.startsWith("#") ? href.slice(1) : href;
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    onActivate();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    if (typeof window !== "undefined" && window.history?.replaceState) {
      window.history.replaceState(null, "", `#${id}`);
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      aria-current={active ? "location" : undefined}
      className={cn(
        "block rounded-md px-2 py-1 transition",
        active ? "bg-accent font-medium text-foreground" : "text-muted-foreground",
      )}
      className:hover="bg-accent text-accent-foreground"
    >
      {children}
    </a>
  );
}

/** Section whose heading is in the scrollport, preferring the one at the reading position. */
function useActiveSection(rootRef: { current: HTMLElement | null }, idsKey: string) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const scroller = rootRef.current;
    if (!scroller) return;
    const ids = idsKey ? idsKey.split("\0") : [];

    const update = () => {
      const rootRect = scroller.getBoundingClientRect();
      const focusY = rootRect.top + rootRect.height * 0.4;
      let current: string | null = null;
      let bestDistance = Infinity;
      for (const id of ids) {
        const section = document.getElementById(id);
        if (!section) continue;
        const rect = section.getBoundingClientRect();
        const inView = rect.bottom > rootRect.top + 8 && rect.top < rootRect.bottom - 8;
        if (!inView) continue;
        const distance = Math.abs((rect.top + rect.bottom) / 2 - focusY);
        if (distance < bestDistance) {
          bestDistance = distance;
          current = id;
        }
      }
      setActiveId((previous) => (previous === current ? previous : current));
    };

    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(scroller);
    if (scroller.firstElementChild) resize.observe(scroller.firstElementChild);
    return () => {
      scroller.removeEventListener("scroll", update);
      resize.disconnect();
    };
  }, [idsKey, rootRef]);

  return [activeId, setActiveId] as const;
}

export function ComponentPlaygroundPane({
  entry,
  workspaceReport,
  reportReady,
  onHideFromCatalog,
  onHideComponent,
  values: controlledValues,
  onValuesChange,
  onResetControls,
  headerActions,
  renderVariantPreview,
  runtimeA11y,
  isolatedPreview = false,
  suppliedProviders = [],
  previewNote,
}: Props) {
  const { renderPreview } = entry;
  const sourceAbsolutePath = workspaceReport?.root
    ? resolveModuleAbsolutePath(workspaceReport.root, entry.modulePath)
    : undefined;

  const [localValues, setLocalValues] = useState<PlaygroundArgs>(() =>
    defaultArgsFromControls(entry.controls),
  );
  const values = controlledValues ?? localValues;
  const setValues = onValuesChange ?? setLocalValues;

  const controlsSignature = entry.controls
    .map((c) => {
      if (c.type === "select") {
        return `${c.key}:select:${c.default}:${c.options.map((o) => o.value).join(",")}`;
      }
      return `${c.key}:${c.type}:${String(c.default)}`;
    })
    .join("|");

  useEffect(() => {
    if (controlledValues === undefined) setLocalValues(defaultArgsFromControls(entry.controls));
  }, [entry.id, controlsSignature, controlledValues]);

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useDashboardTheme();
  const [previewTheme, setPreviewTheme] = useState<DashboardResolvedTheme | null>(null);
  const sectionTheme = previewTheme ?? resolvedTheme;
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const previewWidthLabelRef = useRef<HTMLSpanElement>(null);
  const livePreviewWidthRef = useRef(DEFAULT_PREVIEW_PX);
  const maxOuterRef = useRef(0);
  const [maxOuterPx, setMaxOuterPx] = useState(0);
  const [previewWidthPx, setPreviewWidthPx] = useState(DEFAULT_PREVIEW_PX);
  const [screenBreakpoint, setScreenBreakpoint] = useState(() =>
    screenBreakpointForWidth(DEFAULT_PREVIEW_PX),
  );
  const [containerBreakpoint, setContainerBreakpoint] = useState(() =>
    containerBreakpointForWidth(DEFAULT_PREVIEW_PX),
  );

  useEffect(() => {
    livePreviewWidthRef.current = previewWidthPx;
  }, [previewWidthPx]);

  const syncBreakpointsFromWidth = useCallback((width: number) => {
    if (!Number.isFinite(width) || width <= 0) return;
    setScreenBreakpoint(screenBreakpointForWidth(width));
    setContainerBreakpoint(containerBreakpointForWidth(width));
  }, []);

  const applyLivePreviewWidth = useCallback(
    (w: number) => {
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
      syncBreakpointsFromWidth(clamped);
      return clamped;
    },
    [syncBreakpointsFromWidth],
  );

  const setPreviewWidthFromPreset = useCallback(
    (width: number) => {
      const clamped = applyLivePreviewWidth(width);
      setPreviewWidthPx(clamped);
    },
    [applyLivePreviewWidth],
  );

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

  useLayoutEffect(() => {
    syncBreakpointsFromWidth(previewWidthPx);
  }, [previewWidthPx, syncBreakpointsFromWidth]);

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
          currentWidth = clampPreviewWidth(currentWidth + sign * 2 * dx, maxOuterRef.current);
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

  const showVariantsSection = hasControls && variantEnumeration.combinations.length > 0;

  const [variantA11yFindings, setVariantA11yFindings] = useState<PlaygroundA11yFinding[]>([]);
  const [variantScanComplete, setVariantScanComplete] = useState(false);

  useEffect(() => {
    setVariantA11yFindings([]);
    setVariantScanComplete(false);
  }, [entry.id, variantEnumeration.combinations]);

  const handleVariantA11yScan = useCallback((findings: PlaygroundA11yFinding[]) => {
    setVariantA11yFindings(findings);
    setVariantScanComplete(true);
  }, []);

  const combinedA11y = useMemo(() => {
    const runtimeFindings = runtimeA11y?.findings ?? variantA11yFindings;
    const findings = mergePlaygroundA11yFindings(a11y.findings, runtimeFindings);
    return {
      ...a11y,
      findings,
      issueCount: findings.length,
      score: playgroundA11yScore(a11y.findings, runtimeFindings),
    };
  }, [a11y, variantA11yFindings, runtimeA11y]);

  const hasVariantMatrix = variantEnumeration.combinations.length > 0;
  const variantScanPending = runtimeA11y?.pending ?? (hasVariantMatrix && !variantScanComplete);
  const a11yScoreLabel =
    reportReady || variantScanComplete
      ? `${combinedA11y.score}/100${variantScanPending ? "…" : ""}`
      : "—";

  const report = reportReady ? workspaceReport : null;
  const resetControls = () =>
    onResetControls ? onResetControls() : setValues(defaultArgsFromControls(entry.controls));

  const tocItems: { href: string; label: string; show?: boolean }[] = [
    { href: "#api-reference", label: "API reference", show: hasControls },
    { href: "#usage", label: "Usage" },
    { href: "#repo-usage", label: "Repo usage" },
    { href: "#design-tokens", label: "Token drift" },
    { href: "#code-score", label: "Code score" },
    { href: "#accessibility", label: "Accessibility" },
    { href: "#variants", label: "Variants", show: showVariantsSection },
  ];
  const tocKey = tocItems
    .filter((item) => item.show !== false)
    .map((item) => item.href.slice(1))
    .join("\0");
  const [activeSection, setActiveSection] = useActiveSection(scrollRef, tocKey);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
        <header
          id="source"
          className="flex scroll-mt-20 flex-wrap items-center justify-between gap-4 border-b border-border bg-card p-6"
        >
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {entry.meta.title}
            </h1>
            {isolatedPreview && entry.modulePath ? (
              <SourcePathActions
                displayPath={entry.modulePath}
                filePath={sourceAbsolutePath}
                componentName={entry.meta.id}
                onHideFromCatalog={onHideFromCatalog}
                onHideComponent={onHideComponent}
              />
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {isolatedPreview ? null : headerActions}
              {isolatedPreview || !sourceAbsolutePath ? null : (
                <OpenInEditorButton filePath={sourceAbsolutePath} />
              )}
              {isolatedPreview || !onHideFromCatalog ? null : (
                <HideFromCatalogButton componentName={entry.meta.id} onHidden={onHideFromCatalog} />
              )}
            </div>
            <div className="flex items-start gap-5">
              <ScoreGauge
                label="Code score"
                value={reportReady ? codeScore.score : null}
                href="#code-score"
              />
              <ScoreGauge
                label="Accessibility"
                value={reportReady || variantScanComplete ? combinedA11y.score : null}
                href="#accessibility"
                pending={variantScanPending}
              />
            </div>
          </div>
        </header>

        <section
          id="examples"
          data-preview-theme={sectionTheme}
          className="ds-playground-dot-surface relative border-b bg-background px-16 py-24"
        >
          <PreviewSectionThemeContext.Provider value={sectionTheme}>
            <div ref={previewMeasureRef}>
              <div className="flex justify-center">
                <div
                  ref={previewFrameRef}
                  className="relative min-w-0 shrink-0 rounded-md border border-border bg-background shadow-xs will-change-[width] select-none"
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
                    workspaceReport={isolatedPreview ? null : report}
                    className={
                      isolatedPreview ? "min-w-0 overflow-hidden rounded-md" : "min-w-0 p-8"
                    }
                  >
                    <PlaygroundPreviewErrorBoundary componentName={entry.meta.title}>
                      {renderPreview(values)}
                    </PlaygroundPreviewErrorBoundary>
                  </PlaygroundAppThemeWrapper>
                </div>
              </div>
              {maxOuterPx > 0 ? (
                <div className="mx-auto mt-4 flex w-fit items-center gap-2">
                  <div className="flex h-6 w-fit items-center divide-x divide-border overflow-hidden rounded-sm border border-border bg-card text-center font-mono text-xs/none text-muted-foreground tabular-nums">
                    <span ref={previewWidthLabelRef} className="px-2.5">
                      {Math.round(previewWidthPx)}px
                    </span>
                    <BreakpointPresetSelect
                      kind="screen"
                      value={screenBreakpoint}
                      presets={SCREEN_WIDTH_PRESETS}
                      onSelectWidth={setPreviewWidthFromPreset}
                    />
                    <BreakpointPresetSelect
                      kind="container"
                      value={containerBreakpoint}
                      presets={CONTAINER_WIDTH_PRESETS}
                      onSelectWidth={setPreviewWidthFromPreset}
                    />
                  </div>
                  <div className="flex h-6 overflow-hidden rounded-sm border border-border bg-card text-xs">
                    {(
                      [
                        ["light", "Light"],
                        ["dark", "Dark"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={sectionTheme === value}
                        onClick={() => setPreviewTheme(value)}
                        className={cn(
                          "px-2.5 transition",
                          sectionTheme === value
                            ? "bg-accent font-medium text-foreground"
                            : "text-muted-foreground",
                        )}
                        className:hover="bg-accent text-foreground"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {suppliedProviders.length > 0 || previewNote ? (
                    <HoverCard openDelay={200} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <button
                          type="button"
                          className="flex size-6 items-center justify-center rounded-sm border border-border bg-card text-muted-foreground transition"
                          className:hover="bg-accent text-foreground"
                          aria-label="Preview information"
                        >
                          <IconInfo className="size-3.5" aria-hidden />
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-72 p-3 text-xs" align="end">
                        <div className="space-y-3">
                          {suppliedProviders.length > 0 ? (
                            <div>
                              <p className="font-medium text-foreground">
                                Context supplied automatically
                              </p>
                              <p className="mt-2 text-muted-foreground">
                                DSLinter added {suppliedProviders.join(", ")} as required parents so
                                this preview can render.
                              </p>
                            </div>
                          ) : null}
                          {previewNote ? (
                            <div>
                              <p className="font-medium text-foreground">Example values applied</p>
                              <p className="mt-2 text-muted-foreground">{previewNote}</p>
                            </div>
                          ) : null}
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  ) : null}
                </div>
              ) : null}
            </div>
          </PreviewSectionThemeContext.Provider>
        </section>

        <div className="w-full min-w-0 px-6 py-10" className:lg="px-12">
          <div className:xl="grid grid-cols-[minmax(0,1fr)_12rem] gap-14">
            <div className="min-w-0 space-y-10">
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
                title="Token drift"
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
                <PlaygroundCodeScoreSection codeScore={codeScore} reportReady={reportReady} />
              </Section>

              <Section
                id="accessibility"
                title={`Accessibility: ${a11yScoreLabel}`}
                description={
                  isolatedPreview
                    ? "Static accessibility rules and runtime color-contrast checks from loaded preview frames."
                    : "Static accessibility rules from the DSLinter report, plus runtime color-contrast checks on each variant preview below."
                }
              >
                {runtimeA11y?.message && (
                  <p role="status" className="mb-3 text-sm text-muted-foreground">
                    {runtimeA11y.message}
                  </p>
                )}
                <PlaygroundA11ySection
                  a11y={combinedA11y}
                  reportReady={reportReady || variantScanComplete}
                  variantScanPending={variantScanPending}
                />
              </Section>
            </div>

            <aside className="sticky top-8 mt-12 hidden self-start" className:xl="mt-0 block">
              <nav
                aria-label="On this page"
                className="space-y-0.5 border-l border-border pl-4 text-sm"
              >
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  On this page
                </p>
                {tocItems.map(({ href, label, show = true }) =>
                  show ? (
                    <TocLink
                      key={href}
                      href={href}
                      active={activeSection === href.slice(1)}
                      onActivate={() => setActiveSection(href.slice(1))}
                    >
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
            <div className="w-full min-w-0 px-6" className:lg="px-12">
              <h2 className="w-fit bg-card text-xl font-semibold tracking-tight text-foreground">
                All variants
              </h2>
              <PlaygroundVariantMatrix
                renderPreview={renderVariantPreview ?? renderPreview}
                combinations={variantEnumeration.combinations}
                finiteAxisKeys={variantEnumeration.finiteAxisKeys}
                totalCount={variantEnumeration.totalCount}
                capped={variantEnumeration.capped}
                onVariantA11yScan={isolatedPreview ? undefined : handleVariantA11yScan}
                pageSize={isolatedPreview ? 12 : undefined}
              />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
