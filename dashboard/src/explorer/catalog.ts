import type { CatalogComponent, PlaygroundSpec, WorkspaceReport } from "../types/report";

/** Normalize v3 without pretending that name-only references can disambiguate duplicates. */
export function catalogFromReport(report: WorkspaceReport): CatalogComponent[] {
  if (report.components)
    return report.components.map((component) => ({
      ...component,
      preview: { ...component.preview, declared_props: component.preview.declared_props || [] },
    }));
  const components: CatalogComponent[] = [];
  const counts = new Map<string, number>();
  for (const file of report.files)
    for (const def of file.definitions) counts.set(def.name, (counts.get(def.name) || 0) + 1);
  for (const file of report.files) {
    const path = file.path
      .replaceAll("\\", "/")
      .replace(report.root.replaceAll("\\", "/") + "/", "");
    for (const def of file.definitions) {
      if (def.name.startsWith("default→")) continue;
      if (
        report.config?.hidden_components?.includes(def.name) ||
        report.config?.hidden_paths?.some((prefix) => path.startsWith(prefix))
      )
        continue;
      const id = `${path}#${def.name}`;
      const previous = report.playgrounds?.find(
        (spec) => spec.rel_path === path && spec.export_name === def.name,
      );
      const preview: PlaygroundSpec = {
        id,
        export_name: def.name === "default" ? "default" : def.name,
        rel_path: path,
        declared_props: def.declared_props || [],
        ...previous,
      };
      if (path.endsWith(".vue")) preview.export_name = "default";
      components.push({
        id,
        name: def.name,
        framework: path.endsWith(".vue") ? "vue" : "react",
        preview,
        usages:
          counts.get(def.name) === 1
            ? report.usage_by_component.find((row) => row.component === def.name)
                ?.usage_locations || []
            : [],
        bindings: {},
        dependencies: [],
        legacy_ambiguous: (counts.get(def.name) || 0) > 1,
      });
    }
  }
  return components;
}

export function resolveCatalogComponent(
  report: WorkspaceReport,
  reference: string,
): CatalogComponent | undefined {
  const components = catalogFromReport(report);
  const exact = components.find((component) => component.id === reference);
  if (exact) return exact;
  const matches = components.filter((component) => component.name === reference);
  if (matches.length > 1)
    throw new Error(
      `Ambiguous component ${reference}. Choose one of: ${matches.map((component) => component.id).join(", ")}`,
    );
  return matches[0];
}
