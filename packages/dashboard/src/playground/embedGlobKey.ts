/** Virtual module map key for a scanner `rel_path` (embed convention). */
export function embedGlobKeyFromRelPath(relPath: string): string {
  const trimmed = relPath.replace(/^\/+/, "");
  return `@dslint-scan/${trimmed}`;
}

/** Alias for {@link embedGlobKeyFromRelPath} used by embed playground join helpers. */
export const defaultEmbedGlobKeyFromRelPath = embedGlobKeyFromRelPath;
