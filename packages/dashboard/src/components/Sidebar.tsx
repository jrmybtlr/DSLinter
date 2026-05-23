import { useEffect, useMemo, useState } from "react";
import { IconMoon, IconSearch, IconSun } from "./icons";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";

import { componentCatalogNamesFromReport } from "../dashboard/aggregate";
import type { WorkspaceReport } from "../types/report";
import type { HashRoute } from "../shell/hashRoute";
import type { DashboardThemePreference } from "../shell/DashboardLayout";

type Props = {
  report: WorkspaceReport | null;
  reportLoading: boolean;
  reportError: string | null;
  route: HashRoute;
  onNavigate: (next: HashRoute) => void;
  onOpenCommandPalette: () => void;
  theme: DashboardThemePreference;
  onThemeChange: (next: DashboardThemePreference) => void;
};

function SearchShortcutBadge() {
  const [label, setLabel] = useState("⌘K");
  useEffect(() => {
    const mac = /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent);
    setLabel(mac ? "⌘K" : "Ctrl+K");
  }, []);
  return (
    <kbd className="pointer-events-none select-none rounded border border-sidebar-border bg-sidebar-accent px-1 py-px font-mono text-[10px] font-medium leading-tight text-sidebar-foreground/80 tabular-nums">
      {label}
    </kbd>
  );
}

function navButtonClass(active: boolean) {
  return `w-full rounded-md truncate px-2.5 py-1.5 text-left text-sm transition ${
    active
      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-xs"
      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
  }`;
}

function sectionLabel(text: string) {
  return (
    <p className="mb-1.5 mt-4 px-2.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 first:mt-0">
      {text}
    </p>
  );
}

export function Sidebar({
  report,
  reportLoading,
  reportError,
  route,
  onNavigate,
  onOpenCommandPalette,
  theme,
  onThemeChange,
}: Props) {
  const catalogNames = useMemo(
    () => componentCatalogNamesFromReport(report),
    [report],
  );
  const tokensActive = route.view === "tokens";
  const governanceActive = route.view === "governance";

  const onThemeValueChange = (value: string) => {
    if (value !== "light" && value !== "dark") return;
    onThemeChange(value);
  };

  return (
    <aside className="fixed flex h-full w-[240px] shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="sticky top-0 z-10 shrink-0 border-b border-sidebar-border bg-sidebar px-6 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center text-sidebar-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
            >
              <g fill="currentColor">
                <path
                  d="m22.346,4.836l-3.182-3.182c-.779-.78-2.049-.78-2.828,0l-3.182,3.182c-.78.78-.78,2.048,0,2.828l3.182,3.182c.39.39.902.585,1.414.585s1.024-.195,1.414-.585l3.182-3.182c.78-.78.78-2.048,0-2.828Z"
                  fill="currentColor"
                  strokeWidth="0"
                ></path>
                <rect
                  x="2"
                  y="2"
                  width="9"
                  height="9"
                  rx="2"
                  ry="2"
                  strokeWidth="0"
                  fill="currentColor"
                ></rect>
                <rect
                  x="13"
                  y="13"
                  width="9"
                  height="9"
                  rx="2"
                  ry="2"
                  strokeWidth="0"
                  fill="currentColor"
                ></rect>
                <rect
                  x="2"
                  y="13"
                  width="9"
                  height="9"
                  rx="2"
                  ry="2"
                  strokeWidth="0"
                  fill="currentColor"
                ></rect>
              </g>
            </svg>
          </div>
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-sidebar-foreground/70 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            aria-label="Search components and views"
          >
            <IconSearch className="size-4 shrink-0" aria-hidden />
            <SearchShortcutBadge />
          </button>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {sectionLabel("Explore")}
        <button
          type="button"
          onClick={() => onNavigate({ view: "governance" })}
          className={navButtonClass(governanceActive)}
        >
          Governance
        </button>
        <button
          type="button"
          onClick={() => onNavigate({ view: "tokens" })}
          className={navButtonClass(tokensActive)}
        >
          Design tokens
        </button>

        {sectionLabel(
          catalogNames.length > 0
            ? `Components (${catalogNames.length})`
            : "Components",
        )}
        <div className="space-y-0.5">
          {reportLoading && catalogNames.length === 0 ? (
            <p className="px-2.5 py-1.5 text-sm text-sidebar-foreground/50">
              Loading components…
            </p>
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
          {catalogNames.map((name) => {
            const active =
              route.view === "component" && route.componentId === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() =>
                  onNavigate({ view: "component", componentId: name })
                }
                className={navButtonClass(active)}
              >
                {name}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="shrink-0 border-t border-sidebar-border px-3 py-3">
        <p className="mb-2 px-2.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Appearance
        </p>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          className="w-full"
          value={theme}
          onValueChange={onThemeValueChange}
          aria-label="Color theme"
        >
          <ToggleGroupItem
            value="light"
            className="flex-1"
            aria-label="Light theme"
            title="Light"
          >
            <IconSun className="size-4" aria-hidden />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="dark"
            className="flex-1"
            aria-label="Dark theme"
            title="Dark"
          >
            <IconMoon className="size-4" aria-hidden />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </aside>
  );
}
