import type { CatalogComponent, ProviderCandidate } from "../types/report";
import type { DemoNode } from "./recipes";
import { isNotificationHost } from "./previewMessages";

export type ContextRequirement = { names: string[]; message: string };
export type ContextDiagnostic = {
  message: string;
  required: string[];
  reason: string;
  candidates: ProviderCandidate[];
  attemptedProviders: ProviderCandidate[];
};

export function contextRequirement(error: unknown): ContextRequirement | undefined {
  const message = error instanceof Error ? error.message : String(error);
  const ancestor = message.match(/must be (?:used|rendered) (?:within|inside)\s+(.+?)(?:\n|$)/i);
  if (ancestor) {
    const names = ancestor[1]
      .replace(/^one of the following components:\s*/i, "")
      .replace(/\b(?:a|an|the)\s+/g, "")
      .match(/[A-Z]\w*(?:\.[A-Z]\w*)*/g);
    if (names?.length) return { names: [...new Set(names)], message };
  }
  if (/injection\s+.+?\s+not found/i.test(message)) return { names: [], message };
}

export function isMissingInjectionWarning(message: string): boolean {
  return /^injection\s+.+?\s+not found\.?$/i.test(message);
}

export class PreviewContextError extends Error {
  constructor(public diagnostic: ContextDiagnostic) {
    super(diagnostic.message);
  }
}

export function wrapProviders(
  tree: DemoNode | string,
  providers: ProviderCandidate[],
  fixtures: Record<string, Record<string, unknown>> = {},
): DemoNode | string {
  // Later discoveries provide context needed by previously added providers.
  return providers.reduce<DemoNode | string>(
    (child, provider) => ({
      name: provider.name,
      props: fixtures[provider.id],
      children: [child],
    }),
    tree,
  );
}

export async function recoverProviders<T>(options: {
  component: CatalogComponent;
  candidates: ProviderCandidate[];
  initial: ProviderCandidate[];
  authoritative: boolean;
  present?: string[];
  current: () => boolean;
  attempt: (providers: ProviderCandidate[]) => Promise<T>;
  onFailure: (message: string) => void;
}): Promise<{ result: T; providers: ProviderCandidate[] } | undefined> {
  const providers = options.authoritative ? [] : [...options.initial];
  let lastRequirement: ContextRequirement | undefined;
  while (options.current()) {
    try {
      const result = await options.attempt(providers);
      return { result, providers };
    } catch (error) {
      if (!options.current()) return;
      const requirement = contextRequirement(error);
      options.onFailure(error instanceof Error ? error.message : String(error));
      if (!requirement) {
        if (!lastRequirement) throw error;
        throw new PreviewContextError({
          message: lastRequirement.message,
          required: lastRequirement.names,
          reason: `The resolved provider composition failed: ${error instanceof Error ? error.message : String(error)}`,
          candidates: [],
          attemptedProviders: [...providers],
        });
      }
      lastRequirement = requirement;
      const matches = options.candidates.filter((candidate) =>
        requirement.names.some(
          (name) =>
            candidate.name === name ||
            candidate.export_name === name ||
            candidate.aliases?.includes(name),
        ),
      );
      let reason: string | undefined;
      if (options.authoritative)
        reason =
          "The configured preview or wrapper is authoritative; update its context configuration.";
      else if (!requirement.names.length)
        reason =
          "The injection does not identify a provider component. Configure the service with vue.setup (app.provide or app.use).";
      else if (!matches.length)
        reason =
          "No matching provider export was verified in this component's local source dependencies.";
      else if (matches.length !== 1)
        reason =
          "Multiple source-backed providers match. Choose the intended provider in a preview adapter.";
      else if (
        providers.some((provider) => provider.id === matches[0].id) ||
        matches[0].id === options.component.id ||
        options.present?.includes(matches[0].id)
      )
        reason =
          "The provider is already present; adding it again would repeat a requirement or form a cycle.";
      else if (providers.length >= 4) reason = "Recovery stopped after four added providers.";
      if (reason)
        throw new PreviewContextError({
          message: requirement.message,
          required: requirement.names,
          reason,
          candidates: matches,
          attemptedProviders: [...providers],
        });
      providers.push(matches[0]);
    }
  }
}

function relativeImport(from: string, root: string, path: string): string {
  const start = from.replaceAll("\\", "/").split("/").filter(Boolean);
  const end = `${root}/${path}`.replaceAll("\\", "/").split("/").filter(Boolean);
  while (start.length && end.length && start[0] === end[0]) {
    start.shift();
    end.shift();
  }
  const result = [...start.map(() => ".."), ...end].join("/");
  return result.startsWith(".") ? result : `./${result}`;
}

function previewKey(component: CatalogComponent): string {
  return /^[A-Za-z_$][\w$]*$/.test(component.name)
    ? component.name
    : JSON.stringify(component.id);
}

export function notificationAdapterExample(
  component: CatalogComponent,
  adapterRoot: string,
  scanRoot: string,
  format: "tsx" | "js" = "tsx",
): string | undefined {
  if (component.framework !== "react" || !isNotificationHost(component)) return;
  const binding =
    component.preview.export_name === "default"
      ? "PreviewTarget"
      : `{ ${component.preview.export_name} as PreviewTarget }`;
  const from = JSON.stringify(relativeImport(adapterRoot, scanRoot, component.preview.rel_path));
  const key = previewKey(component);
  if (format === "js") {
    return [
      'import { createElement, Fragment } from "react";',
      'import { toast } from "sonner";',
      'import { preview } from "dslinter/preview";',
      `import ${binding} from ${from};`,
      "",
      "export default {",
      "  previews: {",
      `    ${key}: preview(PreviewTarget, ({ node }) =>`,
      "      createElement(Fragment, null,",
      "        node,",
      '        createElement("button", {',
      '          type: "button",',
      '          onClick: () => toast("Example notification"),',
      '        }, "Show notification"),',
      "      )),",
      "  },",
      "};",
    ].join("\n");
  }
  return [
    'import { preview, type PreviewAdapter } from "dslinter/preview";',
    'import { toast } from "sonner";',
    `import ${binding} from ${from};`,
    "",
    "export default {",
    "  previews: {",
    `    ${key}: preview(PreviewTarget, ({ node }) => (`,
    "      <>",
    "        {node}",
    '        <button type="button" onClick={() => toast("Example notification")}>',
    "          Show notification",
    "        </button>",
    "      </>",
    "    )),",
    "  },",
    "} satisfies PreviewAdapter;",
  ].join("\n");
}

export function contextAdapterExample(
  component: CatalogComponent,
  providers: ProviderCandidate[],
  adapterRoot: string,
  scanRoot: string,
): string {
  const vue = component.framework === "vue";
  const imports = [
    'import { preview, type PreviewAdapter } from "dslinter/preview";',
    ...(vue ? ['import { h } from "vue";'] : []),
    ...[component.preview, ...providers].map((item, index) => {
      const name = index ? `PreviewProvider${index}` : "PreviewTarget";
      const binding = item.export_name === "default" ? name : `{ ${item.export_name} as ${name} }`;
      return `import ${binding} from ${JSON.stringify(relativeImport(adapterRoot, scanRoot, item.rel_path))};`;
    }),
  ];
  let body = vue ? "node" : "{node}";
  providers.forEach((_, index) => {
    const name = `PreviewProvider${index + 1}`;
    body = vue
      ? `h(${name}, {}, { default: () => ${body} })`
      : `<${name}>${body}</${name}>`;
  });
  const decorate =
    providers.length === 0
      ? "preview(PreviewTarget)"
      : vue
        ? `preview(PreviewTarget, ({ node }) => ${body})`
        : `preview(PreviewTarget, ({ node }) => (${body}))`;
  return [
    ...imports,
    "",
    "export default {",
    "  previews: {",
    `    ${previewKey(component)}: ${decorate},`,
    "  },",
    ...(providers.length
      ? []
      : [
          vue
            ? "  // Configure the verified service here: vue: { setup: (app) => app.provide(key, value) }."
            : "  // Import the required provider and wrap with preview(PreviewTarget, ({ node }) => <Provider>{node}</Provider>).",
        ]),
    "} satisfies PreviewAdapter;",
  ].join("\n");
}
