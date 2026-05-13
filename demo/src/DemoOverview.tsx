import { PageHero } from "./components/PageHero";

/** Demo-only overview — simulates what an app might pass into `@dslint/workbench` `overview`. */
export function DemoOverview() {
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-gray-50">
      <PageHero
        title="DSLint Tailwind demo"
        subtitle="Workbench UI comes from the `@dslint/workbench` workspace package (same as a future npm install)."
      />
      <div className="mx-auto max-w-3xl px-8 py-8 text-sm text-gray-600">
        <p>
          Sidebar component previews are built from <code className="rounded bg-white px-1 py-0.5 font-mono text-xs ring-1 ring-gray-200">dslint-report.json</code>{" "}
          (<code className="rounded bg-white px-1 py-0.5 font-mono text-xs ring-1 ring-gray-200">playgrounds</code>) plus{" "}
          <code className="font-mono text-xs">import.meta.glob</code> in <code className="font-mono text-xs">playground/buildRegistry.ts</code> — no{" "}
          <code className="font-mono text-xs">definePlayground</code> in each component file. Regenerate the report with{" "}
          <code className="font-mono text-xs">npm run dslint:report</code> from <code className="font-mono text-xs">demo/</code>.
        </p>
        <p className="mt-4">
          URLs: <span className="font-mono text-xs text-gray-500">#!/component/PrimaryButton</span>,{" "}
          <span className="font-mono text-xs text-gray-500">#!/tokens</span>,{" "}
          <span className="font-mono text-xs text-gray-500">#!/governance</span>.
        </p>
      </div>
    </div>
  );
}
