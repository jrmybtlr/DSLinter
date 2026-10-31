import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { IconChevronDown, IconSearch } from "./icons";

import {
  componentCatalogTreeFromReport,
  resolveFamilyNavigationTarget,
  type CatalogTreeItem,
} from "../dashboard/aggregate";
import {
  scoreAlertsByComponent,
  worstScoreAlert,
  type ScoreAlertLevel,
} from "../report/scoreAlert";
import type { WorkspaceReport } from "../types/report";
import type { HashRoute } from "../shell/hashRoute";

type Props = {
  report: WorkspaceReport | null;
  reportLoading: boolean;
  reportError: string | null;
  route: HashRoute;
  onNavigate: (next: HashRoute) => void;
  onOpenCommandPalette: () => void;
  catalogNames: string[];
  catalogTree?: CatalogTreeItem[];
  catalogLabels?: Record<string, { label: string; description?: string }>;
  contextPicker?: ReactNode;
  footer?: ReactNode;
};

function navButtonClass(active: boolean) {
  return `flex w-full min-w-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition ${
    active
      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-xs"
      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
  }`;
}

function familyParentButtonClass(active: boolean) {
  return `flex min-w-0 flex-1 items-center gap-2 rounded-l-md px-2.5 py-1.5 text-left text-sm transition ${
    active
      ? "text-sidebar-primary-foreground"
      : "text-sidebar-foreground/80 group-hover/family:text-sidebar-accent-foreground"
  }`;
}

function familyToggleClass(active: boolean) {
  return `flex h-8 w-8 shrink-0 items-center justify-center rounded-r-md transition ${
    active
      ? "text-sidebar-primary-foreground"
      : "text-sidebar-foreground/70 group-hover/family:text-sidebar-accent-foreground"
  }`;
}

function sectionLabel(text: string) {
  return (
    <p
      className="mt-4 mb-1.5 px-2.5 text-xs font-semibold tracking-wider text-sidebar-foreground/50 uppercase"
      className:first="mt-0"
    >
      {text}
    </p>
  );
}

const DOT_CLASS: Record<ScoreAlertLevel, string> = {
  muted: "bg-muted-foreground/20",
  warning: "bg-warning",
  critical: "bg-destructive",
};

const DOT_LABEL: Record<ScoreAlertLevel, string> = {
  muted: "Code or accessibility score below 100",
  warning: "Code or accessibility score below 90",
  critical: "Code or accessibility score below 70",
};

function ScoreAlertDot({ level }: { level: ScoreAlertLevel }) {
  return (
    <span
      role="img"
      aria-label={DOT_LABEL[level]}
      title={DOT_LABEL[level]}
      className={`size-1.5 shrink-0 rounded-full ${DOT_CLASS[level]}`}
    />
  );
}

function NavItemLabel({
  label,
  description,
  alert,
}: {
  label: string;
  description?: string;
  alert: ScoreAlertLevel | null;
}) {
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {description ? (
          <span className="mt-0.5 block truncate text-[10px] opacity-60" title={description}>
            {description}
          </span>
        ) : null}
      </span>
      {alert ? <ScoreAlertDot level={alert} /> : null}
    </>
  );
}

function scrollActiveNavItemToTop(nav: HTMLElement) {
  const active = nav.querySelector<HTMLElement>('[data-nav-active="true"]');
  if (!active) return;

  const activeRect = active.getBoundingClientRect();
  const navRect = nav.getBoundingClientRect();
  const visible = activeRect.bottom > navRect.top && activeRect.top < navRect.bottom;
  if (visible) return;

  const offset = activeRect.top - navRect.top;
  nav.scrollTop += offset;
}

export function Sidebar({
  report,
  reportLoading,
  reportError,
  route,
  onNavigate,
  onOpenCommandPalette,
  catalogNames,
  catalogTree: suppliedTree,
  catalogLabels = {},
  contextPicker,
  footer,
}: Props) {
  const catalogTree = useMemo(
    () => suppliedTree ?? componentCatalogTreeFromReport(report),
    [report, suppliedTree],
  );
  const scoreAlerts = useMemo(() => scoreAlertsByComponent(report), [report]);
  const labelFor = (id: string) => catalogLabels[id]?.label ?? id;
  const alertFor = (names: string[]) => worstScoreAlert(names.map((name) => scoreAlerts.get(name)));
  const navRef = useRef<HTMLElement>(null);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(() => new Set());
  const tokensActive = route.view === "tokens";
  const governanceActive = route.view === "governance";
  const catalogActive = route.view === "catalog";

  useEffect(() => {
    if (route.view !== "component") return;
    const activeFamily = catalogTree.find(
      (item) =>
        item.type === "family" &&
        (item.parent === route.componentId || item.children.includes(route.componentId)),
    );
    if (!activeFamily || activeFamily.type !== "family") return;
    setExpandedFamilies((prev) => {
      if (prev.has(activeFamily.parent)) return prev;
      const next = new Set(prev);
      next.add(activeFamily.parent);
      return next;
    });
  }, [catalogTree, route]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const frame = requestAnimationFrame(() => scrollActiveNavItemToTop(nav));
    return () => cancelAnimationFrame(frame);
  }, [route, catalogTree, expandedFamilies, catalogNames.length]);

  return (
    <aside className="fixed flex h-full w-60 shrink-0 flex-col overflow-hidden border-r border-border bg-background text-sidebar-foreground">
      <div className="sticky top-0 z-10 shrink-0 border-b border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center text-foreground">
            <svg
              className="size-4 shrink-0"
              viewBox="0 0 31 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <path
                d="M18.6446 -5.20202e-07C25.2173 -2.32902e-07 30.5455 5.32818 30.5455 11.9008C30.5455 18.4735 25.2173 23.8017 18.6446 23.8017L4.62965e-05 23.8016L4.73369e-05 -1.33518e-06L18.6446 -5.20202e-07Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="flex shrink-0 items-center gap-1.5 rounded-md py-0 pl-1.5 text-foreground/70 transition"
            className:hover="bg-accent text-accent-foreground"
            aria-label="Search components and views"
          >
            <IconSearch className="size-4 shrink-0" aria-hidden />
          </button>
        </div>
      </div>

      {contextPicker}

      <nav ref={navRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {sectionLabel("Explore")}
        <button
          type="button"
          onClick={() => onNavigate({ view: "governance" })}
          className={navButtonClass(governanceActive)}
          data-nav-active={governanceActive ? "true" : undefined}
        >
          Governance
        </button>
        <button
          type="button"
          onClick={() => onNavigate({ view: "catalog" })}
          className={navButtonClass(catalogActive)}
          data-nav-active={catalogActive ? "true" : undefined}
        >
          All components
        </button>
        <button
          type="button"
          onClick={() => onNavigate({ view: "tokens" })}
          className={navButtonClass(tokensActive)}
          data-nav-active={tokensActive ? "true" : undefined}
        >
          Design tokens
        </button>

        {sectionLabel(
          catalogNames.length > 0 ? `Components (${catalogNames.length})` : "Components",
        )}
        <div className="space-y-0.5">
          {reportLoading && catalogNames.length === 0 ? (
            <p className="px-2.5 py-1.5 text-sm text-sidebar-foreground/50">Loading components…</p>
          ) : null}
          {reportError && catalogNames.length === 0 ? (
            <p className="px-2.5 py-1.5 text-sm text-sidebar-foreground/50">
              Could not load report
            </p>
          ) : null}
          {!reportLoading && !reportError && catalogNames.length === 0 ? (
            <p className="px-2.5 py-1.5 text-sm text-sidebar-foreground/50">
              No components in scan
            </p>
          ) : null}
          {catalogTree.map((item) => {
            if (item.type === "component") {
              const active = route.view === "component" && route.componentId === item.name;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => onNavigate({ view: "component", componentId: item.name })}
                  className={navButtonClass(active)}
                  data-nav-active={active ? "true" : undefined}
                >
                  <NavItemLabel
                    label={labelFor(item.name)}
                    description={catalogLabels[item.name]?.description}
                    alert={alertFor([item.name])}
                  />
                </button>
              );
            }

            const parentActive = route.view === "component" && route.componentId === item.parent;
            const childActive =
              route.view === "component" && item.children.includes(route.componentId);
            const familyActive = parentActive || childActive;
            const parentNavActive = parentActive && !childActive;
            const expanded = expandedFamilies.has(item.parent);
            return (
              <div key={item.path}>
                <div
                  className={`group/family flex min-w-0 rounded-md ${familyActive ? "bg-sidebar-primary shadow-xs" : "hover:bg-sidebar-accent"}`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({
                        view: "component",
                        componentId: resolveFamilyNavigationTarget(item, catalogNames),
                      })
                    }
                    className={familyParentButtonClass(familyActive)}
                    data-nav-active={parentNavActive ? "true" : undefined}
                  >
                    <NavItemLabel
                      label={labelFor(item.parent)}
                      description={catalogLabels[item.parent]?.description}
                      alert={alertFor([item.parent, ...item.children])}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedFamilies((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.parent)) {
                          next.delete(item.parent);
                        } else {
                          next.add(item.parent);
                        }
                        return next;
                      })
                    }
                    className={familyToggleClass(familyActive)}
                    aria-label={
                      expanded
                        ? `Collapse ${labelFor(item.parent)} subcomponents${catalogLabels[item.parent]?.description ? ` (${catalogLabels[item.parent].description})` : ""}`
                        : `Expand ${labelFor(item.parent)} subcomponents${catalogLabels[item.parent]?.description ? ` (${catalogLabels[item.parent].description})` : ""}`
                    }
                    aria-expanded={expanded}
                  >
                    <IconChevronDown
                      className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>
                </div>
                {expanded ? (
                  <div className="mt-0.5 space-y-0.5 border-l border-sidebar-border/70 pl-3">
                    {item.children.map((child) => {
                      const active = route.view === "component" && route.componentId === child;
                      return (
                        <button
                          key={child}
                          type="button"
                          onClick={() =>
                            onNavigate({
                              view: "component",
                              componentId: child,
                            })
                          }
                          className={`${navButtonClass(active)} text-xs`}
                          data-nav-active={active ? "true" : undefined}
                        >
                          <NavItemLabel
                            label={labelFor(child)}
                            description={catalogLabels[child]?.description}
                            alert={alertFor([child])}
                          />
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </nav>

      {footer ? (
        <div className="shrink-0 border-t border-sidebar-border px-3 py-3">{footer}</div>
      ) : null}
    </aside>
  );
}
