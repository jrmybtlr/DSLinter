import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CatalogComponent, LintFinding, WorkspaceReport } from "../types/report";
import type { PlaygroundEntry } from "../types/playground";
import {
  defaultArgsFromControls,
  type PlaygroundArgs,
  type PlaygroundControl,
} from "../types/controls";
import { formatVariantLabel } from "../playground/scanVariantA11y";
import { ComponentPlaygroundPane } from "../components/ComponentPlaygroundPane";
import { controlsForComponent, propsForPreview } from "./componentControls";
import { PreviewFrame } from "./PreviewFrame";
import type { PreviewResponse } from "./protocol";
import { automaticStateMessage } from "./previewMessages";
import { useDashboardTheme } from "../shell/DashboardTheme";

type Props = {
  component: CatalogComponent;
  catalog: CatalogComponent[];
  report: WorkspaceReport;
  app: string;
  onHide: (id: string) => void;
};

export function ExplorerComponent({ component, catalog, report, app, onHide }: Props) {
  const [manualControls, setManualControls] = useState<PlaygroundControl[]>([]);
  const manualReady = useRef(false);
  const controls = useMemo(() => {
    const base = controlsForComponent(component, catalog);
    return [
      ...base.filter((control) => !manualControls.some((manual) => manual.key === control.key)),
      ...manualControls,
    ];
  }, [component, catalog, manualControls]);
  const [values, setValues] = useState<PlaygroundArgs>(() => defaultArgsFromControls(controls));
  const editedKeys = useRef(new Set<string>());
  const [status, setStatus] = useState<PreviewResponse | null>(null);
  const [fixtureValues, setFixtureValues] = useState<Record<string, unknown>>(
    component.preview.sample_props || {},
  );
  const [runtimeResults, setRuntimeResults] = useState<Record<string, LintFinding[]>>({});
  const [scanPending, setScanPending] = useState(false);
  const [scanError, setScanError] = useState<string>();
  const { resolvedTheme } = useDashboardTheme();
  const scanVersion = JSON.stringify([values, fixtureValues, resolvedTheme]);
  useEffect(() => {
    setRuntimeResults({});
    setScanError(undefined);
  }, [scanVersion, component]);
  useEffect(() => {
    setFixtureValues(component.preview.sample_props || {});
  }, [component.preview.sample_props]);
  useEffect(() => {
    setValues((previous) => ({ ...defaultArgsFromControls(controls), ...previous }));
  }, [controls]);

  const handleA11y = useCallback((message: PreviewResponse) => {
    if (message.type !== "a11y") return;
    if (message.message) {
      setScanError(
        `Color-contrast checks could not finish. Retry the preview. Details: ${message.message}`,
      );
      return;
    }
    setRuntimeResults((previous) => ({
      ...previous,
      [message.requestId || "Live preview"]: message.findings || [],
    }));
  }, []);
  const handleResponse = useCallback(
    (message: PreviewResponse) => {
      handleA11y(message);
      if (message.type === "rendered") {
        if (message.revealedValues)
          setFixtureValues((previous) => ({ ...previous, ...message.revealedValues }));
        let defaults: PlaygroundArgs = {};
        if (message.controls) {
          if (!manualReady.current) {
            defaults = defaultArgsFromControls(message.controls);
            manualReady.current = true;
          }
          setManualControls((previous) =>
            JSON.stringify(previous) === JSON.stringify(message.controls)
              ? previous
              : message.controls!,
          );
        }
        const updates = { ...message.values, ...defaults };
        if (Object.keys(updates).length)
          setValues((previous) =>
            Object.entries(updates).some(([key, value]) => previous[key] !== value)
              ? { ...previous, ...updates }
              : previous,
          );
        setStatus(message);
      } else if (message.type === "event") {
        const bindings: Record<string, string> = {
          onValueChange: "value",
          onCheckedChange: "checked",
          onOpenChange: "open",
          onChange: typeof message.value === "boolean" ? "checked" : "value",
        };
        const prop = message.event?.startsWith("update:")
          ? message.event.slice(7)
          : bindings[message.event || ""];
        if (prop && ["string", "boolean", "number"].includes(typeof message.value)) {
          editedKeys.current.add(prop);
          setValues((previous) => ({
            ...previous,
            [prop]: message.value as string | number | boolean,
          }));
        }
      }
    },
    [handleA11y],
  );
  const previewProps = useCallback(
    (args: PlaygroundArgs) =>
      propsForPreview(component, controls, args, fixtureValues, editedKeys.current),
    [fixtureValues, controls, component],
  );
  const renderPreview = useCallback(
    (args: PlaygroundArgs) => (
      <PreviewFrame
        component={component}
        catalog={catalog}
        app={app}
        values={previewProps(args)}
        explicitKeys={[...editedKeys.current]}
        onResponse={handleResponse}
        onScanPending={setScanPending}
        scanVersion={scanVersion}
      />
    ),
    [component, catalog, app, previewProps, handleResponse, scanVersion],
  );
  const axes = useMemo(
    () =>
      controls
        .filter((control) => control.type === "boolean" || control.type === "select")
        .map((control) => control.key),
    [controls],
  );
  const renderVariant = useCallback(
    (args: PlaygroundArgs) => (
      <PreviewFrame
        component={component}
        catalog={catalog}
        app={app}
        values={previewProps(args)}
        explicitKeys={[...editedKeys.current]}
        compact
        scanLabel={formatVariantLabel(args, axes)}
        onResponse={handleA11y}
        scanVersion={scanVersion}
      />
    ),
    [component, catalog, app, previewProps, axes, handleA11y, scanVersion],
  );
  const entry: PlaygroundEntry = {
    id: component.id,
    meta: { id: component.id, title: component.name, group: component.framework },
    modulePath: component.preview.rel_path,
    controls,
    renderPreview,
    Preview: () => null,
    usageSnippet: () => status?.snippet || `<${component.name} />`,
  };
  const runtimeA11y = useMemo(
    () => ({
      findings: Object.values(runtimeResults).flat(),
      pending: scanPending,
      message:
        scanError ||
        (Object.keys(runtimeResults).length > 0
          ? `${Object.keys(runtimeResults).length} preview${Object.keys(runtimeResults).length === 1 ? "" : "s"} checked for color contrast.`
          : "Color-contrast checks start after the preview appears."),
    }),
    [runtimeResults, scanPending, scanError],
  );

  return (
    <ComponentPlaygroundPane
      entry={entry}
      workspaceReport={report}
      reportReady
      values={values}
      onValuesChange={(next) =>
        setValues((previous) => {
          const updated = typeof next === "function" ? next(previous) : next;
          for (const key of Object.keys(updated))
            if (updated[key] !== previous[key]) editedKeys.current.add(key);
          return updated;
        })
      }
      onResetControls={() => {
        editedKeys.current.clear();
        setFixtureValues(component.preview.sample_props || {});
        setValues(defaultArgsFromControls(controls));
      }}
      isolatedPreview
      previewNote={
        status?.type === "rendered" && Object.keys(status.revealedValues || {}).length > 0
          ? automaticStateMessage(status.revealedValues || {})
          : undefined
      }
      suppliedProviders={
        status?.type === "rendered"
          ? status.suppliedProviders?.map((provider) => provider.name)
          : undefined
      }
      renderVariantPreview={renderVariant}
      runtimeA11y={runtimeA11y}
      onHideComponent={() => onHide(component.id)}
    />
  );
}
