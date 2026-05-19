import type { WorkspaceReport } from "../types/report";
import { pluralize } from "usemods";

/** React slot props — not attribute props. */
const SLOT_PROPS = new Set(["children"]);

export function catalogAttributeProps(props: string[]): string[] {
  return props.filter((prop) => !SLOT_PROPS.has(prop));
}

/** Set of `"ComponentName/propName"` keys for props with no recorded usage. */
export function buildUnusedPropSetForComponent(
  report: WorkspaceReport,
  componentName: string,
  declared: string[],
): Set<string> {
  const s = new Set<string>();
  const usageRow = (report.usage_by_component ?? []).find(
    (u) => u.component === componentName,
  );
  const propFrequencies = usageRow?.prop_frequencies ?? {};
  for (const propName of catalogAttributeProps(declared)) {
    if ((propFrequencies[propName] ?? 0) === 0) {
      s.add(`${componentName}/${propName}`);
    }
  }
  return s;
}

export function ComponentPropUsageDetail({
  component,
  declared,
  unusedProps,
}: {
  component: string;
  declared: string[];
  unusedProps: Set<string>;
}) {
  const attributeProps = catalogAttributeProps(declared);
  const used = attributeProps.filter(
    (prop) => !unusedProps.has(`${component}/${prop}`),
  );
  const unused = attributeProps.filter((prop) =>
    unusedProps.has(`${component}/${prop}`),
  );
  const usedPropCount = used.length;

  if (attributeProps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No declared props recorded for this component.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {usedPropCount}/{attributeProps.length}{" "}
        {pluralize("prop", usedPropCount)} used in the workspace snapshot.
      </p>
      {used.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Used
          </p>
          <ul className="mt-1 space-y-0.5 font-mono text-xs text-foreground">
            {used.map((prop) => (
              <li key={prop}>{prop}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {unused.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Never passed
          </p>
          <ul className="mt-1 space-y-0.5 font-mono text-xs text-muted-foreground/70">
            {unused.map((prop) => (
              <li key={prop} className="line-through">
                {prop}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
