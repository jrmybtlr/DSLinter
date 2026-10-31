import { describe, expect, it } from "vitest";
import type { CatalogComponent, ProviderCandidate } from "../types/report";
import { PREVIEW_PROTOCOL, type PreviewResponse } from "./protocol";
import {
  automaticStateMessage,
  EMPTY_PREVIEW_MESSAGE,
  previewAttemptDetails,
  previewFailureExplanation,
} from "./previewMessages";
import { notificationAdapterExample } from "./providerRecovery";

const target: CatalogComponent = {
  id: "src/Example.tsx#Example",
  name: "Example",
  framework: "react",
  preview: {
    id: "Example",
    rel_path: "src/Example.tsx",
    export_name: "Example",
    declared_props: [],
  },
  usages: [],
  dependencies: [],
  bindings: {},
};
function failure(message: string, extras: Partial<PreviewResponse> = {}): PreviewResponse {
  return { protocol: PREVIEW_PROTOCOL, type: "error", message, ...extras };
}
function parent(path: string): ProviderCandidate {
  return {
    id: `${path}#SidebarProvider`,
    name: "SidebarProvider",
    rel_path: path,
    export_name: "SidebarProvider",
  };
}

describe("preview explanations", () => {
  it("explains an empty notification host from source metadata, without guessing by its name", () => {
    const component = {
      ...target,
      name: "NotificationArea",
      preview: {
        ...target.preview,
        component_imports: {
          Sonner: {
            specifier: "sonner",
            export_name: "Toaster",
            importer: target.preview.rel_path,
          },
        },
      },
    };
    const status = failure("All attempts failed", {
      attempts: [`usage: ${EMPTY_PREVIEW_MESSAGE}`, `generated: ${EMPTY_PREVIEW_MESSAGE}`],
    });
    const explanation = previewFailureExplanation(component, status);
    expect(explanation.title).toBe("No notification to show");
    expect(explanation.nextStep).toContain("button");
    expect(explanation.nextStep).not.toContain("below");
    expect(previewFailureExplanation({ ...target, name: "Toaster" }, status).title).toBe(
      "Toaster has no visible content",
    );
    const setup = notificationAdapterExample(component, "/repo/app", "/repo")!;
    expect(setup).toContain('from "../src/Example.tsx"');
    expect(setup).toContain('"src/Example.tsx#Example"');
    expect(setup).toContain('onClick: () => toast("Example notification")');
    expect(
      previewFailureExplanation(component, { ...status, adapterExample: setup }).nextStep,
    ).toContain("Preview setup below");
    expect(notificationAdapterExample(target, "/repo", "/repo")).toBeUndefined();
  });

  it("keeps generic empty guidance separate from component crashes", () => {
    expect(previewFailureExplanation(target, failure(EMPTY_PREVIEW_MESSAGE)).title).toBe(
      "Example has no visible content",
    );
    const crash = previewFailureExplanation(target, failure("A surprising component bug"));
    expect(crash.title).toBe("Example could not render");
    expect(crash.nextStep).toContain("Technical details");
    expect(crash.description).not.toContain("missing");
    expect(
      previewFailureExplanation(
        target,
        failure("A surprising component bug", { failurePhase: "update" }),
      ).title,
    ).toBe("Example stopped rendering");
  });

  it("uses declared icon inputs to explain an empty icon preview", () => {
    const component = {
      ...target,
      preview: { ...target.preview, declared_prop_kinds: { iconNode: "icon" as const } },
    };
    const explanation = previewFailureExplanation(component, failure(EMPTY_PREVIEW_MESSAGE));
    expect(explanation.title).toBe("Example needs a sample icon");
    expect(explanation.nextStep).toContain("iconNode in this component's fixtures");
  });

  it.each([
    ["The preview host did not become ready", "The preview could not connect"],
    ["Failed to fetch dynamically imported module: /src/example", "Preview code could not load"],
    ["Export Example was not found in src/Example.tsx", "Example could not be loaded"],
    [
      "Example dependency Link needs an import binding or fixture",
      "The source example could not be used",
    ],
    ["Example does not contain the selected component", "The source example could not be used"],
    [
      "Ambiguous adapter key Example; use src/Example.tsx#Example",
      "Choose which component this preview belongs to",
    ],
    [
      "Invalid hook call. Hooks can only be called inside a component",
      "React could not start this preview",
    ],
  ])("gives distinct guidance for %s", (message, title) => {
    expect(previewFailureExplanation(target, failure(message)).title).toBe(title);
  });

  it("explains missing values as a possible preview-data issue without asserting an app bug", () => {
    const result = previewFailureExplanation(
      target,
      failure("All attempts failed", {
        attempts: [
          "usage: Cannot read properties of undefined (reading 'replaceAll')",
          "generated: Cannot read properties of undefined (reading 'replaceAll')",
        ],
      }),
    );
    expect(result.description).toContain("may need props or application data");
    expect(result.nextStep).toContain("sample values");
  });

  it.each([
    ["No matching provider export was verified", "matching parent could not be verified"],
    ["The configured preview or wrapper is authoritative", "existing custom preview"],
    ["The provider is already present", "already included"],
    ["Recovery stopped after four added providers.", "complete parent chain"],
    ["The resolved provider composition failed: No account data", "required parent also failed"],
  ])("explains why parent recovery stopped: %s", (reason, nextStep) => {
    const result = previewFailureExplanation(
      target,
      failure("All attempts failed", {
        contextDiagnostic: {
          message: "useSidebar must be used within SidebarProvider",
          required: ["SidebarProvider"],
          reason,
          candidates: [],
          attemptedProviders: [],
        },
      }),
    );
    expect(result.title).toBe("Example needs SidebarProvider");
    expect(result.nextStep).toContain(nextStep);
  });

  it("distinguishes ambiguous parents and Vue services", () => {
    const contextDiagnostic = {
      message: "missing",
      required: ["SidebarProvider"],
      reason: "Multiple source-backed providers match",
      candidates: [parent("a.tsx"), parent("b.tsx")],
      attemptedProviders: [],
    };
    expect(
      previewFailureExplanation(target, failure("missing", { contextDiagnostic })).nextStep,
    ).toContain("More than one");
    const service = previewFailureExplanation(
      { ...target, framework: "vue" },
      failure("missing", {
        contextDiagnostic: { ...contextDiagnostic, required: [], candidates: [] },
      }),
    );
    expect(service.title).toBe("Example needs an app service");
    expect(service.nextStep).toContain("vue.setup with app.provide or app.use");
  });

  it("deduplicates retry errors, preserves original details, and replaces internal strategy names", () => {
    const message = "Cannot read properties of undefined\n    at Example (example.tsx:10)";
    expect(
      previewAttemptDetails([
        `usage: ${message}`,
        `generated: ${message}`,
        "manual override: Error: Import failed",
      ]),
    ).toEqual([
      { label: "Example from source, Basic preview", message },
      { label: "Custom preview file", message: "Import failed" },
    ]);
  });

  it("explains automatic changes in control terms, including the actual values", () => {
    expect(automaticStateMessage({ showContent: true, message: "Example" })).toContain(
      "show content: on; message: “Example”",
    );
  });
});
