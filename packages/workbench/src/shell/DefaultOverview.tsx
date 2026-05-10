export function DefaultOverview() {
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-layout-lg py-layout-md">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">DSLint workbench</h1>
        <p className="mt-layout-xs text-slate-600">
          Use the sidebar for isolated previews, design tokens, and governance inventory from DSLint.
        </p>
      </header>
      <div className="mx-auto max-w-3xl px-8 py-8 text-sm text-slate-600">
        <p>
          Optional <code className="rounded bg-white px-1 py-0.5 font-mono text-xs ring-1 ring-slate-200">playgroundMeta</code> and{" "}
          <code className="rounded bg-white px-1 py-0.5 font-mono text-xs ring-1 ring-slate-200">PlaygroundPreview</code> on your
          component modules register sidebar entries. Pass <code className="font-mono text-xs">overview</code> into{" "}
          <code className="font-mono text-xs">WorkbenchLayout</code> to customize this page.
        </p>
        <p className="mt-4">
          URLs: <span className="font-mono text-xs text-slate-500">#!/component/PrimaryButton</span>,{" "}
          <span className="font-mono text-xs text-slate-500">#!/tokens</span>,{" "}
          <span className="font-mono text-xs text-slate-500">#!/governance</span>.
        </p>
      </div>
    </div>
  );
}
