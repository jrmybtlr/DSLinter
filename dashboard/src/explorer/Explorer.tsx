import { useEffect, useMemo, useRef, useState } from "react";
import context from "virtual:dslinter/explorer";
import { useWorkspaceReport } from "../dashboard/useWorkspaceReport";
import { SourceLocationLink } from "../dashboard/SourceLocationLink";
import { FindingsList } from "../dashboard/FindingsList";
import { TokensPane } from "../components/TokensPane";
import { GovernancePane } from "../components/GovernancePane";
import { PlaygroundControls } from "../components/PlaygroundControls";
import { PlaygroundUsageCode } from "../components/PlaygroundUsageCode";
import { controlsForSpec } from "../playground/controls";
import { valuesToComponentProps } from "../playground/propCoerce";
import {
  defaultArgsFromControls,
  type PlaygroundArgs,
  type PlaygroundControl,
} from "../types/controls";
import type { CatalogComponent, WorkspaceReport } from "../types/report";
import { catalogFromReport } from "./catalog";
import { PREVIEW_PROTOCOL, type PreviewResponse } from "./protocol";
import { recipeFor, demoFromExample, type DemoNode } from "./recipes";

function parseFixtures(source: string): Record<string, unknown> {
  const value: unknown = JSON.parse(source);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Sample data must be a JSON object");
  return value as Record<string, unknown>;
}

function controlsForComponent(
  component: CatalogComponent,
  catalog: CatalogComponent[],
): PlaygroundControl[] {
  const spec = component.preview;
  const controls = controlsForSpec(
    component.id,
    spec.declared_props,
    spec.declared_prop_kinds,
    spec.declared_prop_options,
    spec.declared_prop_defaults,
    {},
    component.name,
    spec.declared_prop_optional,
    spec.declared_prop_type_labels,
  );
  const recipe = component.preview.example_tree
    ? demoFromExample(component.preview.example_tree)
    : recipeFor(component, catalog);
  function findTarget(node: DemoNode | string): DemoNode | undefined {
    if (typeof node === "string") return;
    if (node.name === component.name || component.bindings[node.name] === component.id) return node;
    return node.children?.map(findTarget).find(Boolean);
  }
  const target = recipe && typeof recipe !== "string" ? findTarget(recipe) : undefined;
  const composed = target?.children?.some((child) => typeof child !== "string");
  const label = target?.children?.filter((child) => typeof child === "string").join("");
  for (const control of controls) {
    const value = target?.props?.[control.key];
    if (value !== undefined && typeof value === typeof control.default)
      control.default = value as string | number | boolean;
    if (control.key === "children" && label) control.default = label;
  }
  for (const slot of spec.slots || []) {
    if (slot === "default" && composed) continue;
    controls.push({
      key: `slot:${slot}`,
      label: `Slot: ${slot}`,
      type: "string",
      default: slot === "default" && label ? label : `Example ${slot}`,
    });
  }
  return composed ? controls.filter((control) => control.key !== "children") : controls;
}

function ComponentDetail({
  component,
  catalog,
  report,
  app,
}: {
  component: CatalogComponent;
  catalog: CatalogComponent[];
  report: WorkspaceReport;
  app: string;
}) {
  const [manualControls, setManualControls] = useState<PlaygroundControl[]>([]);
  const controls = useMemo(() => {
    const base = controlsForComponent(component, catalog);
    return [
      ...base.filter((control) => !manualControls.some((manual) => manual.key === control.key)),
      ...manualControls,
    ];
  }, [component, catalog, manualControls]);
  const [values, setValues] = useState<PlaygroundArgs>(() => defaultArgsFromControls(controls));
  const [status, setStatus] = useState<PreviewResponse | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [width, setWidth] = useState("100%");
  const [revision, setRevision] = useState(0);
  const [fixtures, setFixtures] = useState(
    JSON.stringify(component.preview.sample_props || {}, null, 2),
  );
  const [fixtureValues, setFixtureValues] = useState<Record<string, unknown>>(
    component.preview.sample_props || {},
  );
  const fixturesEdited = useRef(false);
  const [fixtureError, setFixtureError] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);
  const frameOrigin = useRef<string | null>(null);
  const props = useMemo(() => {
    const typed = valuesToComponentProps(
      controls,
      component.preview.declared_props,
      values,
      component.preview.declared_prop_kinds,
      component.name,
    );
    return { ...fixtureValues, ...typed };
  }, [values, controls, fixtureValues, component]);
  const latest = useRef({ component, catalog, props });
  latest.current = { component, catalog, props };
  useEffect(() => {
    if (fixturesEdited.current) return;
    const samples = component.preview.sample_props || {};
    setFixtureValues(samples);
    setFixtures(JSON.stringify(samples, null, 2));
  }, [component.preview.sample_props]);
  useEffect(() => {
    setValues((previous) => ({ ...defaultArgsFromControls(controls), ...previous }));
  }, [controls]);
  useEffect(() => {
    if (frameOrigin.current)
      frame.current?.contentWindow?.postMessage(
        {
          protocol: PREVIEW_PROTOCOL,
          type: "mount",
          component,
          catalog,
          values: latest.current.props,
        },
        frameOrigin.current,
      );
  }, [component, catalog]);
  useEffect(() => {
    const timeout = setTimeout(
      () =>
        setStatus(
          (previous) =>
            previous || {
              protocol: PREVIEW_PROTOCOL,
              type: "error",
              message:
                "The preview host did not become ready. Its startup error is shown in the frame or terminal. Check the selected app's Vite configuration.",
            },
        ),
      20000,
    );
    function receive(event: MessageEvent<PreviewResponse>) {
      if (
        event.source !== frame.current?.contentWindow ||
        event.data?.protocol !== PREVIEW_PROTOCOL
      )
        return;
      if (event.data.type === "ready") {
        clearTimeout(timeout);
        frameOrigin.current = event.origin;
        frame.current?.contentWindow?.postMessage(
          {
            protocol: PREVIEW_PROTOCOL,
            type: "mount",
            component: latest.current.component,
            catalog: latest.current.catalog,
            values: latest.current.props,
          },
          { targetOrigin: event.origin },
        );
      } else if (event.data.type === "event") {
        setEvents((previous) =>
          [`${event.data.event}: ${JSON.stringify(event.data.value)}`, ...previous].slice(0, 15),
        );
        const name = event.data.event || "";
        const value = event.data.value;
        const bindings: Record<string, string> = {
          onValueChange: "value",
          onCheckedChange: "checked",
          onOpenChange: "open",
          onChange: typeof value === "boolean" ? "checked" : "value",
        };
        const prop = name.startsWith("update:") ? name.slice(7) : bindings[name];
        if (prop && ["string", "boolean", "number"].includes(typeof value))
          setValues((previous) => ({ ...previous, [prop]: value as string | number | boolean }));
      } else {
        if (event.data.controls)
          setManualControls((previous) =>
            JSON.stringify(previous) === JSON.stringify(event.data.controls)
              ? previous
              : event.data.controls!,
          );
        if (event.data.values)
          setValues((previous) =>
            Object.entries(event.data.values!).some(([key, value]) => previous[key] !== value)
              ? { ...previous, ...event.data.values }
              : previous,
          );
        setStatus(event.data);
      }
    }
    window.addEventListener("message", receive);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("message", receive);
      frameOrigin.current = null;
    };
  }, [app, revision]);
  useEffect(() => {
    if (frameOrigin.current)
      frame.current?.contentWindow?.postMessage(
        { protocol: PREVIEW_PROTOCOL, type: "update", values: props },
        frameOrigin.current,
      );
  }, [props]);
  const compatible =
    context.apps.find((candidate) => candidate.id === app)?.framework === component.framework;
  const findings = report.findings.filter((finding) =>
    finding.path.replaceAll("\\", "/").endsWith(component.preview.rel_path),
  );
  return (
    <article className="min-w-0 flex-1 overflow-auto">
      <header className="border-b border-border px-6 py-5">
        <p className="text-xs text-muted-foreground">
          {component.framework === "vue" ? "Vue" : "React"} component · {component.usages.length}{" "}
          usages · {new Set(component.usages.map((usage) => usage.path)).size} files
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{component.name}</h1>
        <div className="mt-2">
          <SourceLocationLink root={report.root} path={component.preview.rel_path} />
        </div>
      </header>
      <div className="space-y-7 p-6">
        <section
          aria-label="Component preview"
          className="overflow-hidden rounded-lg border border-border bg-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 text-xs">
            <span>
              {status?.provenance ? `${status.provenance} example` : "Live preview"}
              {status?.substitutedContext ? " · Sample app context" : ""}
            </span>
            <div className="flex gap-3">
              <label>
                Width{" "}
                <select
                  aria-label="Preview width"
                  className="rounded border border-border bg-background px-2 py-1"
                  value={width}
                  onChange={(event) => setWidth(event.target.value)}
                >
                  <option value="100%">Responsive</option>
                  <option value="375px">375px</option>
                  <option value="768px">768px</option>
                  <option value="1024px">1024px</option>
                </select>
              </label>
              <button
                className="underline"
                onClick={() => {
                  setStatus(null);
                  setRevision((value) => value + 1);
                }}
              >
                Retry preview
              </button>
            </div>
          </div>
          {compatible ? (
            <div className="overflow-x-auto bg-muted/30 p-3">
              <iframe
                key={`${app}:${revision}`}
                ref={frame}
                title={`${component.name} preview`}
                src={`/__dslinter/frame?app=${encodeURIComponent(app)}`}
                style={{
                  width,
                  minWidth: width === "100%" ? undefined : width,
                  height: 400,
                  border: 0,
                  display: "block",
                  margin: "auto",
                  background: "white",
                }}
              />
            </div>
          ) : (
            <p className="p-8 text-sm text-muted-foreground">
              Choose a {component.framework === "vue" ? "Vue" : "React"} application above to
              preview this component.
            </p>
          )}
          {status?.type === "error" && (
            <div role="alert" className="border-t border-border p-4 text-sm">
              <p className="font-medium">Preview needs more context</p>
              <p className="mt-2 text-muted-foreground">{status.message}</p>
              {status.attempts?.map((attempt) => (
                <p key={attempt} className="mt-1 font-mono text-xs">
                  {attempt}
                </p>
              ))}
            </div>
          )}
          {status?.type === "rendered" && (
            <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              {status.styles?.length
                ? "Using application CSS"
                : "No application stylesheet detected; add styles in dslinter.preview.ts"}
              {status.synthetic ? " · Generated sample content" : ""}
            </p>
          )}
        </section>
        <PlaygroundControls
          controls={controls}
          values={values}
          onChange={setValues}
          onReset={() => setValues(defaultArgsFromControls(controls))}
        />
        <details className="rounded-lg border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">Sample data (JSON)</summary>
          <textarea
            aria-label="Sample data"
            className="mt-3 min-h-32 w-full rounded border border-border bg-background p-3 font-mono text-xs"
            value={fixtures}
            onChange={(event) => {
              fixturesEdited.current = true;
              setFixtures(event.target.value);
              try {
                setFixtureValues(parseFixtures(event.target.value));
                setFixtureError("");
              } catch {
                setFixtureError("Enter a valid JSON object to apply sample data.");
              }
            }}
          />
          {fixtureError && (
            <p role="alert" className="text-xs text-destructive">
              {fixtureError}
            </p>
          )}
        </details>
        {status?.snippet && (
          <section>
            <h2 className="mb-3 text-sm font-semibold">Generated preview code</h2>
            <PlaygroundUsageCode source={status.snippet} />
          </section>
        )}
        <section>
          <h2 className="mb-3 text-sm font-semibold">Used across the codebase</h2>
          {component.legacy_ambiguous && (
            <p className="text-sm text-muted-foreground">
              This older report cannot distinguish same-named components. Rescan to resolve their
              usage.
            </p>
          )}
          {component.example_source && (
            <div className="mb-3 text-xs">
              <span>Original example: </span>
              <SourceLocationLink
                root={report.root}
                path={component.example_source.path}
                line={component.example_source.line}
              />
            </div>
          )}
          {component.usages.length ? (
            <ul className="divide-y divide-border rounded border border-border">
              {component.usages.map((usage, index) => (
                <li
                  key={`${usage.path}:${usage.line}:${index}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <SourceLocationLink root={report.root} path={usage.path} line={usage.line} />
                  <code className="text-xs text-muted-foreground">{usage.props.join(", ")}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No resolved usages in this scan.</p>
          )}
        </section>
        {events.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold">Interactions</h2>
            <pre className="overflow-auto rounded border border-border bg-muted p-4 text-xs">
              {events.join("\n")}
            </pre>
          </section>
        )}
        <section>
          <h2 className="mb-3 text-sm font-semibold">Component findings</h2>
          <FindingsList findings={findings} root={report.root} />
        </section>
      </div>
    </article>
  );
}

export default function Explorer() {
  const state = useWorkspaceReport({
    reportUrl: "/dslinter-report.json",
    watchUrl: "/events",
    refreshIntervalMs: 1000,
  });
  const catalog = useMemo(
    () => (state.report ? catalogFromReport(state.report) : []),
    [state.report],
  );
  const [query, setQuery] = useState("");
  const [ambiguousName, setAmbiguousName] = useState<string | null>(null);
  const [selected, setSelected] = useState(() => decodeURIComponent(location.hash.slice(1)));
  const [tab, setTab] = useState("components");
  const [app, setApp] = useState(context.selectedApp || context.apps[0]?.id || "");
  const visible = catalog.filter((component) =>
    `${component.name} ${component.preview.rel_path}`.toLowerCase().includes(query.toLowerCase()),
  );
  const current = ambiguousName
    ? undefined
    : catalog.find((component) => component.id === selected) ||
      visible.find(
        (component) => app === "." || component.preview.rel_path.startsWith(app + "/"),
      ) ||
      visible[0];
  function openComponent(reference: string) {
    const exact = catalog.find((item) => item.id === reference);
    const matches = catalog.filter((item) => item.name === reference);
    if (!exact && matches.length > 1) {
      setAmbiguousName(reference);
      setQuery(reference);
      setTab("components");
      return;
    }
    const component = exact || matches[0];
    if (component) {
      setAmbiguousName(null);
      setSelected(component.id);
      location.hash = encodeURIComponent(component.id);
      setTab("components");
    }
  }
  return (
    <div data-dashboard-theme="light" className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-5 py-3">
        <div>
          <span className="text-sm font-semibold tracking-tight">DSLinter</span>
          <span className="ml-3 text-xs text-muted-foreground">Design-system explorer</span>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Preview app
          <select
            aria-label="Preview application"
            value={app}
            onChange={(event) => setApp(event.target.value)}
            className="max-w-64 rounded-md border border-border bg-background px-3 py-2 text-foreground"
          >
            {context.apps.map((app) => (
              <option key={app.id} value={app.id}>
                {app.name} · {app.framework}
              </option>
            ))}
            {!context.apps.length && <option value="">No Vite app detected</option>}
          </select>
        </label>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card max-sm:w-44">
          <nav aria-label="Explorer sections" className="flex gap-1 border-b border-border p-2">
            {["components", "tokens", "governance"].map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                aria-pressed={tab === item}
                className={`rounded px-2 py-2 text-xs capitalize ${tab === item ? "bg-accent font-medium" : "text-muted-foreground"}`}
              >
                {item}
              </button>
            ))}
          </nav>
          <div className="p-3">
            <input
              aria-label="Find a component"
              placeholder={`Search ${catalog.length} components…`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
            />
          </div>
          <ul aria-label="Component catalog" className="min-h-0 flex-1 overflow-auto p-2">
            {visible.map((component) => (
              <li key={component.id}>
                <button
                  onClick={() => openComponent(component.id)}
                  aria-current={current?.id === component.id ? "page" : undefined}
                  className={`mb-1 block w-full rounded-md px-3 py-2 text-left ${current?.id === component.id ? "bg-accent" : "hover:bg-muted"}`}
                >
                  <span className="flex justify-between gap-2 text-sm">
                    <span className="truncate">{component.name}</span>
                    <span className="text-xs text-muted-foreground">{component.usages.length}</span>
                  </span>
                  <span
                    className="mt-1 block truncate text-[10px] text-muted-foreground"
                    title={component.preview.rel_path}
                  >
                    {component.preview.rel_path}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        {state.error ? (
          <p role="alert" className="p-8 text-sm">
            Could not load the scan: {state.error}
          </p>
        ) : !state.report ? (
          <p className="p-8 text-sm text-muted-foreground">Scanning workspace…</p>
        ) : tab === "tokens" ? (
          <TokensPane dslinterReport={state.report} />
        ) : tab === "governance" ? (
          <GovernancePane
            dslinterReport={state}
            onOpenComponent={openComponent}
            onOpenCatalog={() => setTab("components")}
          />
        ) : current ? (
          <ComponentDetail
            key={`${current.id}:${app}`}
            component={current}
            catalog={catalog}
            report={state.report}
            app={app}
          />
        ) : (
          <p className="p-8 text-sm text-muted-foreground">
            {ambiguousName
              ? `Multiple components are named ${ambiguousName}. Choose a source module in the catalog.`
              : "No components match this scan."}
          </p>
        )}
      </div>
    </div>
  );
}
