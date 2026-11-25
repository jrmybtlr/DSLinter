import { useEffect, useRef, useState } from "react";
import type { CatalogComponent } from "../types/report";
import type { PreviewResponse } from "./protocol";
import {
  previewAttemptDetails,
  previewFailureExplanation,
  propDiagnostics,
} from "./previewMessages";
import { savePreviewSetup } from "./savePreviewSetup";
import { Button } from "../components/ui/button";

export function PreviewFailureNotice({
  component,
  status,
  compact,
  onRetry,
  app,
  setupToken,
}: {
  component: CatalogComponent;
  status: PreviewResponse;
  compact: boolean;
  onRetry: () => void;
  app: string;
  setupToken?: string;
}) {
  const explanation = previewFailureExplanation(component, status);
  const attempts = previewAttemptDetails(status.attempts || []);
  const props = propDiagnostics(component, status.attemptedProps);
  const fixture = status.setupAction === "fixture";
  const [copyState, setCopyState] = useState<"ready" | "copied" | "failed">("ready");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [savedPath, setSavedPath] = useState<string>();
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const canSave = Boolean(setupToken && status.setupAction && status.adapterExample);
  useEffect(() => setCopyState("ready"), [status.adapterExample]);
  async function addSetup() {
    if (!setupToken || request.current || savedPath) return;
    const controller = new AbortController();
    request.current = controller;
    setSaving(true);
    setSaveError(undefined);
    try {
      const result = await savePreviewSetup(
        app,
        component.id,
        setupToken,
        controller.signal,
        status.setupAction,
      );
      if (controller.signal.aborted) return;
      setSavedPath(result.path);
      if (result.reloaded) onRetry();
      else
        setSaveError(
          `Saved to ${result.path}, but the preview could not restart. Use Retry preview to load the new setup.`,
        );
    } catch (error) {
      if (!controller.signal.aborted)
        setSaveError(
          error instanceof Error
            ? error.message
            : "Could not save the preview setup. Use the copyable example instead.",
        );
    } finally {
      if (!controller.signal.aborted) {
        setSaving(false);
        request.current = null;
      }
    }
  }
  async function copyExample() {
    try {
      await navigator.clipboard.writeText(status.adapterExample!);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }
  return (
    <div role="alert" className={compact ? "p-4 text-sm" : "p-6 text-sm"}>
      <p className="font-semibold text-foreground">{explanation.title}</p>
      <p className="mt-2 text-muted-foreground">{explanation.description}</p>
      <p className="mt-3 text-foreground">
        {canSave
          ? fixture
            ? "Generate a preview entry with sample data for these props. DSLinter will save it to dslinter.preview.tsx, where you can edit it, and reload this preview."
            : "Add a preview setup with a sample notification button. DSLinter will save it and reload this preview."
          : explanation.nextStep}
      </p>
      {props.length > 0 && (
        <div className="mt-4">
          <p className="font-medium text-foreground">Props passed</p>
          <ul role="list" className="mt-2 space-y-1 font-mono text-xs">
            {props.map((prop) => (
              <li
                key={prop.name}
                className={
                  prop.problem ? "break-all text-destructive" : "break-all text-muted-foreground"
                }
              >
                <span className={prop.problem ? undefined : "text-foreground"}>{prop.name}</span>:{" "}
                {prop.value}
                {prop.problem && <span className="font-sans"> (required)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {Boolean(status.contextDiagnostic?.attemptedProviders.length) && (
        <p className="mt-2 text-muted-foreground">
          DSLinter tried adding:{" "}
          {status.contextDiagnostic!.attemptedProviders.map((provider) => provider.name).join(", ")}
          .
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {canSave && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saving || Boolean(savedPath)}
            onClick={addSetup}
          >
            {saving
              ? fixture
                ? "Generating preview…"
                : "Adding preview setup…"
              : savedPath
                ? fixture
                  ? "Preview generated"
                  : "Preview setup saved"
                : fixture
                  ? "Generate preview"
                  : "Add preview setup"}
          </Button>
        )}
        <button
          type="button"
          className="font-medium underline underline-offset-4"
          disabled={saving}
          onClick={onRetry}
        >
          Retry preview
        </button>
      </div>
      {canSave && !savedPath && (
        <p className="mt-2 text-xs text-muted-foreground">
          {fixture
            ? "Writes the sample props as fixtures in your preview configuration. Required props marked TODO need real values."
            : "Saves this example to your preview configuration and reloads the preview."}
        </p>
      )}
      {fixture && savedPath && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          Saved to {savedPath}. Edit its fixture to change the preview data.
        </p>
      )}
      {saveError && (
        <p role="status" className="mt-3 text-sm text-destructive">
          {saveError}
        </p>
      )}
      {status.adapterExample && (
        <details className="mt-3 rounded-md bg-muted">
          <summary className="cursor-pointer p-3 font-medium">Preview setup</summary>
          <p className="p-3 text-muted-foreground">
            Add this example to dslinter.preview.tsx, or merge its entry into your existing
            configuration. Supply any required component data.
          </p>
          <pre className="max-h-80 overflow-auto rounded-md bg-muted/40 p-3 pt-0 text-xs whitespace-pre">
            {status.adapterExample}
          </pre>
          <button type="button" className="mt-3 underline underline-offset-4" onClick={copyExample}>
            {copyState === "copied" ? "Copied preview setup" : "Copy preview setup"}
          </button>
          {copyState === "failed" && (
            <p className="mt-2 text-muted-foreground">
              Could not copy. Select the example and copy it manually.
            </p>
          )}
        </details>
      )}
      <details className="mt-3 rounded-md bg-muted">
        <summary className="cursor-pointer p-3 font-medium">Technical details</summary>
        <div className="space-y-3 p-3 pt-0">
          <p className="font-mono text-xs break-all">{component.id}</p>
          {status.message && !attempts.some((attempt) => attempt.message === status.message) && (
            <pre className="max-h-48 overflow-auto text-xs break-words whitespace-pre-wrap">
              {status.message}
            </pre>
          )}
          {attempts.map((attempt) => (
            <div key={attempt.message}>
              <p className="font-medium">{attempt.label}</p>
              <pre className="mt-1 max-h-48 overflow-auto text-xs break-words whitespace-pre-wrap">
                {attempt.message}
              </pre>
            </div>
          ))}
          {status.contextDiagnostic && (
            <div className="space-y-2">
              {!attempts.some(
                (attempt) => attempt.message === status.contextDiagnostic!.message,
              ) && <p>{status.contextDiagnostic.message}</p>}
              <p>{status.contextDiagnostic.reason}</p>
              {status.contextDiagnostic.candidates.length > 1 && (
                <ul role="list" className="space-y-1">
                  {status.contextDiagnostic.candidates.map((provider) => (
                    <li className="font-mono text-xs break-all" key={provider.id}>
                      {provider.id}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
