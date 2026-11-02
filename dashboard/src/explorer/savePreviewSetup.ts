export async function savePreviewSetup(
  app: string,
  componentId: string,
  token: string,
  signal: AbortSignal,
): Promise<{ path: string; created: boolean; reloaded: boolean }> {
  let response: Response;
  try {
    response = await fetch("/dslinter/preview-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Dslinter-Token": token },
      body: JSON.stringify({ app, componentId }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(
      "Could not confirm whether the setup was saved. Retry the preview first; if it is unchanged, try adding the setup again.",
    );
  }
  const result = await response.json().catch(() => undefined);
  if (!response.ok)
    throw new Error(
      typeof result?.message === "string"
        ? result.message
        : "The preview setup could not be saved. Use the copyable example instead.",
    );
  if (
    typeof result?.path !== "string" ||
    typeof result.created !== "boolean" ||
    typeof result.reloaded !== "boolean"
  )
    throw new Error(
      "Could not confirm the saved setup. Retry the preview to check it before saving again.",
    );
  return result;
}
