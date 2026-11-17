import type { CatalogComponent } from "../types/report";
import type { PreviewResponse } from "./protocol";

export type PreviewExplanation = { title: string; description: string; nextStep: string };

export const EMPTY_PREVIEW_MESSAGE =
  "Component produced no visible content; a composition, visibility prop, or explicit fixture may be required";

export function isNotificationHost(component: CatalogComponent): boolean {
  return (
    component.framework === "react" &&
    Object.values(component.preview.component_imports || {}).some(
      (binding) => binding.specifier === "sonner" && binding.export_name === "Toaster",
    )
  );
}

export function renderErrorExplanation(
  name: string,
  error: string,
  updating = false,
): PreviewExplanation {
  const title = updating ? `${name} stopped rendering` : `${name} could not render`;
  if (
    /invalid hook call|hooks can only be called|reading ['"](?:useContext|useState|useEffect)['"]/i.test(
      error,
    )
  )
    return {
      title: "React could not start this preview",
      description:
        "React reported a hook error. This can happen when the preview loads incompatible or duplicate copies of React.",
      nextStep:
        "Retry first. If it continues, check that the component and preview use the same React installation. The original error is in Technical details.",
    };
  if (
    /Cannot (?:read|destructure).*?(?:undefined|null)|\.map is not a function|is not iterable/i.test(
      error,
    )
  )
    return {
      title,
      description:
        "The component tried to use a value that was missing or had the wrong shape. Its preview may need props or application data.",
      nextStep:
        "Check the component controls. For objects, lists, or app data, supply sample values in dslinter.preview.tsx. See Technical details for the original error.",
    };
  return {
    title,
    description: updating
      ? "The component reported an error after the preview opened."
      : "The component reported an error while DSLinter was preparing its preview.",
    nextStep:
      "Check the original error in Technical details, update the component or its preview setup, then retry.",
  };
}

export function previewFailureExplanation(
  component: CatalogComponent,
  status: PreviewResponse,
): PreviewExplanation {
  const name = component.name;
  const errors = [status.message || "", ...(status.attempts || [])].join("\n");
  const diagnostic = status.contextDiagnostic;
  if (status.failurePhase === "connect" || /preview host did not become ready/i.test(errors))
    return {
      title: "The preview could not connect",
      description: `DSLinter did not receive a response from the preview for ${name}.`,
      nextStep:
        "Retry the preview. If it still cannot connect, restart DSLinter and check the selected app's Vite errors.",
    };
  if (diagnostic) {
    if (!diagnostic.required.length)
      return {
        title: `${name} needs an app service`,
        description:
          "This component uses a Vue service that is not available in the isolated preview.",
        nextStep:
          "Register the service in dslinter.preview.tsx using vue.setup with app.provide or app.use.",
      };
    const parents = diagnostic.required.join(" or ");
    const explanation = {
      title: `${name} needs ${parents}`,
      description: `This component needs ${parents} around it. DSLinter could not provide a working version of that setup.`,
      nextStep: `Wrap ${name} with ${parents} in a custom preview in dslinter.preview.tsx.`,
    };
    if (/authoritative|configured preview or wrapper/i.test(diagnostic.reason))
      explanation.nextStep = `Update the existing custom preview or wrapper in dslinter.preview.tsx to supply ${parents}. Your configured setup takes priority.`;
    else if (diagnostic.candidates.length > 1)
      explanation.nextStep = `Choose the intended ${parents} in dslinter.preview.tsx. More than one matching parent was found; their locations are in Technical details.`;
    else if (/already present|cycle/i.test(diagnostic.reason))
      explanation.nextStep = `The required parent is already included, but the component still cannot use it. Check how the parent and component are connected in your preview setup.`;
    else if (/four added providers/i.test(diagnostic.reason))
      explanation.nextStep =
        "This preview needs several layers of parents. Set up the complete parent chain in dslinter.preview.tsx; automatic recovery stopped after four additions.";
    else if (/composition failed/i.test(diagnostic.reason))
      explanation.nextStep =
        "A required parent also failed to render. Supply the data it needs in dslinter.preview.tsx. Technical details include that error.";
    else if (/after the preview mounted/i.test(diagnostic.reason))
      explanation.nextStep = `Retry to rebuild the preview with ${parents}. If it fails again, supply the parent in dslinter.preview.tsx.`;
    else
      explanation.nextStep +=
        " A matching parent could not be verified in the component's local imports.";
    return explanation;
  }
  const failures = previewAttemptDetails(status.attempts || []).map((attempt) => attempt.message);
  if (!failures.length && status.message === EMPTY_PREVIEW_MESSAGE) failures.push(status.message);
  const empty =
    failures.length > 0 && failures.every((message) => message === EMPTY_PREVIEW_MESSAGE);
  if (empty) {
    if (isNotificationHost(component))
      return {
        title: "No notification to show",
        description: `${name} displays notifications after one is triggered. No notification appeared in this preview.`,
        nextStep: status.adapterExample
          ? "Use a custom preview with a button that shows a sample notification. Open Preview setup below for a copyable example."
          : "Add a custom preview in dslinter.preview.tsx with a button that shows a sample notification.",
      };
    const iconProps = Object.entries(component.preview.declared_prop_kinds || {})
      .filter(([, kind]) => kind === "icon")
      .map(([key]) => key);
    if (iconProps.length)
      return {
        title: `${name} needs a sample icon`,
        description: `The ${iconProps.join(", ")} input expects an icon component. No icon was visible in this preview.`,
        nextStep: `Import an icon component in dslinter.preview.tsx and assign it to ${iconProps.join(", ")} in this component's fixtures.`,
      };
    return {
      title: `${name} has no visible content`,
      description:
        "The available examples did not show any visible content. The component may be hidden, empty, or waiting for data or an interaction.",
      nextStep:
        "Check its content and visibility controls. If it needs data or a parent component, supply a custom example in dslinter.preview.tsx.",
    };
  }
  if (/Ambiguous adapter key/.test(errors))
    return {
      title: "Choose which component this preview belongs to",
      description: `More than one component is named ${name}, so the custom preview cannot be matched safely.`,
      nextStep: `Use the full component ID as the preview key in dslinter.preview.tsx: ${component.id}`,
    };
  if (/Export .+ was not found|Provider export .+ was not found/.test(errors))
    return {
      title: `${name} could not be loaded`,
      description: "A component or required parent is no longer available at its recorded export.",
      nextStep: "Check the export and file listed in Technical details, then refresh the scan.",
    };
  if (
    /Example (?:dependency|import).+ (?:could not be resolved|needs)|Example does not contain/.test(
      errors,
    )
  )
    return {
      title: "The source example could not be used",
      description:
        "An example dependency is unavailable, or the example does not include the selected component.",
      nextStep:
        "Provide a custom example in dslinter.preview.tsx that includes this component and imports its required icons or child components.",
    };
  if (
    /Failed to fetch dynamically imported module|Importing a module script failed|Cannot find module|Failed to resolve import|error loading dynamically imported module/i.test(
      errors,
    )
  )
    return {
      title: "Preview code could not load",
      description: `A file or package needed by ${name} could not be loaded.`,
      nextStep:
        "Retry first. If it continues, check the missing import in Technical details and the app's Vite errors.",
    };
  return renderErrorExplanation(name, errors, status.failurePhase === "update");
}

const attemptLabels: Record<string, string> = {
  usage: "Example from source",
  recipe: "Built-in example",
  generated: "Basic preview",
  override: "Custom preview",
  "manual override": "Custom preview file",
};

/** Keep each original error once, with readable labels for the attempts that produced it. */
export function previewAttemptDetails(attempts: string[]): { label: string; message: string }[] {
  const grouped = new Map<string, Set<string>>();
  for (const attempt of attempts) {
    const match = attempt.match(
      /^(manual override|usage|recipe|generated|override):\s*(?:Error:\s*)?([\s\S]*)$/,
    );
    const label = match ? attemptLabels[match[1]] : "Preview";
    const message = match ? match[2] : attempt;
    const labels = grouped.get(message) || new Set<string>();
    labels.add(label);
    grouped.set(message, labels);
  }
  return [...grouped].map(([message, labels]) => ({ label: [...labels].join(", "), message }));
}

export function automaticStateMessage(values: Record<string, string | boolean>): string {
  const changes = Object.entries(values).map(([key, value]) => {
    const label = key
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replaceAll(/[_-]/g, " ")
      .toLowerCase();
    let displayValue = `“${value}”`;
    if (typeof value === "boolean") displayValue = value ? "on" : "off";
    return `${label}: ${displayValue}`;
  });
  return `Example values applied so the component is visible (${changes.join("; ")}). You can change them in the controls.`;
}
