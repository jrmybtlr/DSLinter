import { useCallback, useState } from "react";
import { TruncatedPath } from "../components/TruncatedPath";
import { openSourceFile } from "./editorLink";
import { resolveReportAbsolutePath, shortPath } from "./paths";

export function SourceLocationLink({
  root,
  path,
  line,
}: {
  root: string;
  path: string;
  line?: number | null;
}) {
  const fileText = shortPath(root, path);
  const locationText = line != null ? `${fileText}:${line}` : fileText;
  const absolutePath = resolveReportAbsolutePath(root, path);
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(() => {
    setError(null);
    void openSourceFile(absolutePath, line ?? undefined).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Could not open file: ${message}`);
    });
  }, [absolutePath, line]);

  return (
    <div className="w-full min-w-0">
      <button
        type="button"
        onClick={handleClick}
        className="block w-full min-w-0 text-left text-xs text-muted-foreground transition-colors"
        className:hover="text-foreground underline"
        title={locationText}
      >
        <TruncatedPath path={locationText} className="text-xs" title={undefined} />
      </button>
      {error ? (
        <p className="mt-0.5 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
