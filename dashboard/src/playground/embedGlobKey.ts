import { trimLeadingSlashes } from "./pathUtils";

/** Virtual module map key for a scanner `rel_path` (embed convention). */
export function embedGlobKeyFromRelPath(relPath: string): string {
  return `@dslinter-scan/${trimLeadingSlashes(relPath)}`;
}

/** Alias for {@link embedGlobKeyFromRelPath} used by embed playground join helpers. */
export const defaultEmbedGlobKeyFromRelPath = embedGlobKeyFromRelPath;
