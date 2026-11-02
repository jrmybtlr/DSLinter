import type { CatalogComponent, UsageSummary, WorkspaceReport } from "../types/report";
import type { CatalogTreeItem } from "../dashboard/aggregate";
import { fileStemToCatalogGroupLabel } from "../dashboard/aggregate";

export type CatalogLabels = Record<string, { label: string; description?: string }>;

export function componentUsage(component: CatalogComponent): UsageSummary {
  const frequencies: Record<string, number> = {};
  const values: Record<string, Record<string, number>> = {};
  for (const usage of component.usages) {
    for (const prop of usage.props) frequencies[prop] = (frequencies[prop] || 0) + 1;
    for (const [prop, value] of Object.entries(usage.prop_values || {})) {
      values[prop] ||= {};
      values[prop][value] = (values[prop][value] || 0) + 1;
    }
  }
  const files = [...new Set(component.usages.map((usage) => usage.path))];
  return {
    component: component.id,
    reference_count: component.usages.length,
    file_count: files.length,
    files,
    max_props_on_single_use: Math.max(0, ...component.usages.map((usage) => usage.props.length)),
    prop_frequencies: frequencies,
    prop_value_frequencies: values,
    usage_locations: component.usages,
  };
}

/** Feed the established dashboard widgets resolved identities instead of merged names. */
export function dashboardReport(
  report: WorkspaceReport,
  catalog: CatalogComponent[],
): WorkspaceReport {
  const byPath = new Map<string, CatalogComponent[]>();
  for (const component of catalog) {
    const key = component.preview.rel_path;
    byPath.set(key, [...(byPath.get(key) || []), component]);
  }
  return {
    ...report,
    files: report.files.map((file) => {
      const relative = file.path
        .replaceAll("\\", "/")
        .replace(report.root.replaceAll("\\", "/") + "/", "");
      return {
        ...file,
        definitions: (byPath.get(relative) || []).map((component) => {
          const source = file.definitions.find((definition) => definition.name === component.name);
          return {
            ...source,
            name: component.id,
            kind:
              source?.kind === "export_default" || source?.kind === "export_default_anonymous"
                ? "function"
                : source?.kind || "function",
            line: source?.line || 1,
            declared_props: component.preview.declared_props,
          };
        }),
      };
    }),
    playgrounds: catalog.map((component) => ({
      ...component.preview,
      id: component.id,
      export_name: component.id,
    })),
    usage_by_component: catalog.map(componentUsage),
  };
}

export function catalogLabels(catalog: CatalogComponent[]): CatalogLabels {
  const counts = new Map<string, number>();
  for (const component of catalog)
    counts.set(component.name, (counts.get(component.name) || 0) + 1);
  return Object.fromEntries(
    catalog.map((component) => [
      component.id,
      {
        label: component.name,
        description: (counts.get(component.name) || 0) > 1 ? component.preview.rel_path : undefined,
      },
    ]),
  );
}

/** Preserve file families and Vue's multi-file compound components without merging apps. */
export function catalogNavigation(catalog: CatalogComponent[]): CatalogTreeItem[] {
  const groups = new Map<string, CatalogComponent[]>();
  const files = new Map<string, CatalogComponent[]>();
  for (const component of catalog)
    files.set(component.preview.rel_path, [
      ...(files.get(component.preview.rel_path) || []),
      component,
    ]);
  for (const component of catalog) {
    const path = component.preview.rel_path;
    const directory = path.split("/").slice(0, -1).join("/");
    const stem = fileStemToCatalogGroupLabel(
      path
        .split("/")
        .pop()!
        .replace(/\.[^.]+$/, ""),
    );
    const fileMembers = files.get(path)!;
    const fileRoot =
      fileMembers.length > 1
        ? fileMembers.find((member) => member.name.toLowerCase() === stem.toLowerCase())
        : undefined;
    const family =
      fileRoot?.name ||
      component.name.match(
        /^(Button|Card|Dialog|Select|Tabs|Popover|Tooltip|Accordion|AlertDialog|DropdownMenu|NavigationMenu|ContextMenu)(?=[A-Z]|$)/,
      )?.[1];
    const key = family ? `${directory}/${family}` : path;
    groups.set(key, [...(groups.get(key) || []), component]);
  }
  const items: { label: string; item: CatalogTreeItem }[] = [];
  for (const [path, members] of groups) {
    const duplicateNames = new Set(members.map((member) => member.name)).size !== members.length;
    const byModule = new Map<string, CatalogComponent[]>();
    for (const member of members) {
      const key = duplicateNames ? member.preview.rel_path : path;
      byModule.set(key, [...(byModule.get(key) || []), member]);
    }
    for (const [module, bucket] of byModule) {
      const sorted = [...bucket].sort((a, b) => a.name.localeCompare(b.name));
      if (sorted.length === 1) {
        items.push({ label: sorted[0].name, item: { type: "component", name: sorted[0].id } });
        continue;
      }
      const stem = fileStemToCatalogGroupLabel(
        module
          .split("/")
          .pop()!
          .replace(/\.[^.]+$/, ""),
      );
      const parent = sorted.find((component) => component.name === stem) || sorted[0];
      items.push({
        label: parent.name,
        item: {
          type: "family",
          parent: parent.id,
          path: module,
          children: sorted.map((component) => component.id),
        },
      });
    }
  }
  return items.sort((a, b) => a.label.localeCompare(b.label)).map(({ item }) => item);
}
